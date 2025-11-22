import { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import {
  MockModelFactory,
  type RegisterFixtureOptions,
} from "../../src/core/model-factory.js";
import {
  createMockStreamAdapter,
  type MockFixtureFile,
} from "../mocks/mock-stream-adapter.js";
import {
  StreamEventSchema,
  type StreamEvent,
  type Response,
} from "../../src/core/schema.js";
import { streamKeyForRun } from "../../src/core/schema.js";
import { RedisStream } from "../../src/core/redis.js";
import { PersistenceWorker } from "../../src/workers/persistence-worker.js";
import { createServer } from "../../src/server.js";
import { StreamHydrator } from "../../src/client/hydration.js";

const DEFAULT_SSE_TIMEOUT_MS = 30_000;

export interface HarnessSubmitParams {
  prompt: string;
  model: string;
  providerId: string;
  threadId?: string;
  turnId?: string;
  agentId?: string;
}

export interface HarnessSubmitResult {
  runId: string;
  streamUrl: string;
}

export class Core2TestHarness {
  private readonly factory: MockModelFactory;
  private readonly hydrator: StreamHydrator;
  private app: FastifyInstance | undefined;
  private baseUrl: string | undefined;
  private convex: ConvexHttpClient | undefined;
  private worker: PersistenceWorker | undefined;
  private readonly activeRunIds = new Set<string>();

  constructor() {
    this.factory = new MockModelFactory({
      adapterFactory: createMockStreamAdapter,
    });
    this.hydrator = new StreamHydrator();
  }

  get modelFactory(): MockModelFactory {
    return this.factory;
  }

  async setup(): Promise<void> {
    if (this.app) return;

    this.app = await createServer({
      modelFactory: this.factory,
    });

    await this.app.listen({ port: 0, host: "127.0.0.1" });
    const address = this.app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to determine Fastify listening address");
    }
    const port = (address as AddressInfo).port;
    this.baseUrl = `http://127.0.0.1:${port}`;

    const convexUrl = process.env.CONVEX_URL?.trim();
    if (!convexUrl) {
      throw new Error("CONVEX_URL must be set for test harness");
    }
    this.convex = new ConvexHttpClient(convexUrl);

    this.worker = new PersistenceWorker();
    await this.worker.start();
  }

  async cleanup(): Promise<void> {
    await this.worker?.stop();
    this.worker = undefined;

    this.convex = undefined;

    if (this.app) {
      await this.app.close();
      this.app = undefined;
      this.baseUrl = undefined;
    }

    this.activeRunIds.clear();
  }

  async registerFixture(options: RegisterFixtureOptions): Promise<void> {
    this.factory.registerFixture(options);
  }

  async submit(params: HarnessSubmitParams): Promise<HarnessSubmitResult> {
    if (!this.baseUrl) {
      throw new Error("Harness not initialized. Call setup() first.");
    }

    const response = await fetch(`${this.baseUrl}/api/v2/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: params.prompt,
        model: params.model,
        providerId: params.providerId,
        threadId: params.threadId,
        turnId: params.turnId,
        agentId: params.agentId,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Submit failed with status ${response.status}: ${text || "unknown error"}`,
      );
    }

    const data = (await response.json()) as { runId: string };
    if (!data.runId) {
      throw new Error("Submit response missing runId");
    }

    this.activeRunIds.add(data.runId);
    const streamUrl = `/api/v2/stream/${data.runId}`;

    return { runId: data.runId, streamUrl };
  }

  async consumeSSE(
    streamPath: string,
    options: { timeoutMs?: number } = {},
  ): Promise<StreamEvent[]> {
    if (!this.baseUrl) {
      throw new Error("Harness not initialized. Call setup() first.");
    }

    const url = normalizeUrl(this.baseUrl, streamPath);
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_SSE_TIMEOUT_MS;
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof (timeoutHandle as { unref?: () => void }).unref === "function") {
      (timeoutHandle as { unref?: () => void }).unref?.();
    }

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(
          `SSE request failed with status ${res.status}: ${text || "unknown error"}`,
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const buffer: string[] = [];
      const events: StreamEvent[] = [];

      let completed = false;
      while (!completed) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer.push(decoder.decode(value, { stream: true }));
        }
        const joined = buffer.join("");
        const blocks = joined.split("\n\n");
        buffer.length = 0;
        const trailing = blocks.pop();
        if (trailing) {
          buffer.push(trailing);
        }

        for (const block of blocks) {
          const parsed = parseSseBlock(block);
          if (!parsed?.data) continue;
          if (parsed.data === "[DONE]") {
            completed = true;
            break;
          }
          const eventData = parseEventData(parsed.data);
          events.push(eventData);
          if (
            eventData.payload.type === "response_done" ||
            eventData.payload.type === "response_error"
          ) {
            completed = true;
            break;
          }
        }
      }

      await reader.cancel().catch(() => undefined);
      controller.abort();
      return events;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`SSE consumption timed out after ${timeoutMs} ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  getStreamUrl(streamPath: string): string {
    if (!this.baseUrl) {
      throw new Error("Harness not initialized. Call setup() first.");
    }
    return normalizeUrl(this.baseUrl, streamPath);
  }

  async hydrate(events: StreamEvent[]): Promise<Response> {
    const { response } = this.hydrator.hydrateFromEvents(events);
    return response;
  }

  async getPersistedResponse(runId: string): Promise<unknown> {
    if (!this.convex) {
      throw new Error("Convex client not initialized");
    }

    return this.convex.query(api.messages.getByRunId, { runId });
  }

  async reset(): Promise<void> {
    if (!this.activeRunIds.size) return;

    const redis = await RedisStream.connect();
    try {
      for (const runId of this.activeRunIds) {
        const streamKey = streamKeyForRun(runId);
        await redis.deleteStream(streamKey);
        if (this.convex) {
          await this.convex.mutation(api.messages.deleteByRunId, { runId });
        }
      }
    } finally {
      await redis.close();
      this.activeRunIds.clear();
    }
  }

  async loadFixtureFile(filePath: string): Promise<MockFixtureFile> {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as MockFixtureFile;
  }
}

function normalizeUrl(baseUrl: string, streamPath: string): string {
  if (streamPath.startsWith("http://") || streamPath.startsWith("https://")) {
    return streamPath;
  }
  if (streamPath.startsWith("/")) {
    return `${baseUrl}${streamPath}`;
  }
  return `${baseUrl}/${streamPath}`;
}

function parseEventData(raw: string): StreamEvent {
  try {
    return StreamEventSchema.parse(JSON.parse(raw));
  } catch (error) {
    throw new Error(
      `Failed to parse SSE event data: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseSseBlock(
  block: string,
): { event?: string; data?: string } | undefined {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return undefined;

  let eventName: string | undefined;
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice("data:".length).trim();
    }
  }
  return { event: eventName, data };
}
