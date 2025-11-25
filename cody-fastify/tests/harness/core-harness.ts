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
  REDIS_STREAM_KEY_PREFIX,
  StreamEventSchema,
  type StreamEvent,
  type Response,
} from "../../src/core/schema.js";
import { RedisStream } from "../../src/core/redis.js";
import {
  PersistenceWorker,
  type PersistenceWorkerOptions,
} from "../../src/workers/persistence-worker.js";
import {
  ToolWorker,
  type ToolWorkerOptions,
} from "../../src/workers/tool-worker.js";
import { createServer } from "../../src/server.js";
import { StreamHydrator } from "../../src/client/hydration.js";
import type { ToolRegistry } from "codex-ts/src/tools/registry.js";
// Original import removed: import type { ToolRegistry as ScriptToolRegistry } from "codex-ts/src/core/script-harness/tool-facade.js";

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
  private toolWorker: ToolWorker | undefined;
  private readonly activeRunIds = new Set<string>();
  private readonly workerOptions: PersistenceWorkerOptions;
  private readonly toolWorkerOptions: ToolWorkerOptions;
  private readonly scriptToolRegistry: ToolRegistry | undefined; // Changed from ScriptToolRegistry

  constructor(scriptToolRegistry?: ToolRegistry) { // Changed from ScriptToolRegistry
    this.factory = new MockModelFactory({
      adapterFactory: createMockStreamAdapter,
    });
    this.hydrator = new StreamHydrator();
    this.workerOptions = {
      discoveryIntervalMs: 200,
      blockMs: 100, // Reduced for test environment to speed up cleanup
      reclaimIntervalMs: 100, // Reduced to allow rapid shutdown
      reclaimMinIdleMs: 5000,
      persistIntermediateSnapshots: false,
    };
    this.toolWorkerOptions = {
      discoveryIntervalMs: 200,
      blockMs: 100, // Ensure ToolWorker also has a small blockMs for cleanup
      reclaimIntervalMs: 100, // Reduced to allow rapid shutdown
      reclaimMinIdleMs: 5000,
      batchSize: 25,
      toolTimeoutMs: 2_000,
    };
    this.scriptToolRegistry = scriptToolRegistry; // Store the custom registry
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

    const redis = await RedisStream.connect();
    try {
      await this.deleteAllRunStreams(redis);
    } finally {
      await redis.close();
    }

    this.worker = new PersistenceWorker(this.workerOptions);
    await this.worker.start();

    // Pass the custom scriptToolRegistry to ToolWorker
    this.toolWorker = new ToolWorker(
      this.toolWorkerOptions,
      this.scriptToolRegistry,
    );
    await this.toolWorker.start();
  }

  async cleanup(): Promise<void> {
    console.log("[DEBUG - cleanup] Before worker?.stop()");
    await this.worker?.stop();
    this.worker = undefined;
    console.log("[DEBUG - cleanup] Before toolWorker?.stop()");
    await this.toolWorker?.stop();
    this.toolWorker = undefined;

    this.convex = undefined;

    if (this.app) {
      console.log("[DEBUG] Closing Fastify...");
      await this.app.close();
      console.log("[DEBUG] Fastify closed.");
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
    const blockMs = 500; // Explicitly set blockMs for test client to speed up server-side Redis read loop
    const urlWithBlockMs = `${url}${url.includes("?") ? "&" : "?"}blockMs=${blockMs}`;

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_SSE_TIMEOUT_MS;
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof (timeoutHandle as { unref?: () => void }).unref === "function") {
      (timeoutHandle as { unref?: () => void }).unref?.();
    }

    try {
      const res = await fetch(urlWithBlockMs, { signal: controller.signal, keepalive: false });
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
    if (this.worker) {
      await this.worker.stop();
      this.worker = undefined;
    }
    if (this.toolWorker) {
      await this.toolWorker.stop();
      this.toolWorker = undefined;
    }

    const redis = await RedisStream.connect();
    try {
      await this.deleteAllRunStreams(redis);
      // Ensure consumer group exists for the next run
      // Since we delete streams, the group is gone.
      // However, the worker creates the group when it discovers streams.
      // But if the worker starts before any streams exist, it might not create the group?
      // No, when submit() happens, a stream is created.
      // The worker discovers it.
      // The worker calls ensureGroup.
      // So it should be fine.
      // The issue might be that the worker's internal state `this.streams` isn't cleared?
      // We recreate the worker: `this.worker = new PersistenceWorker(...)`.
      // So state is clear.
      // Maybe we need to wait for the worker to be ready?
      // Let's add a small delay after start.
    } finally {
      await redis.close();
    }

    if (this.convex) {
      for (const runId of this.activeRunIds) {
        await this.convex.mutation(api.messages.deleteByRunId, { runId });
      }
    }

    this.activeRunIds.clear();

    this.worker = new PersistenceWorker(this.workerOptions);
    await this.worker.start();

    this.toolWorker = new ToolWorker(this.toolWorkerOptions);
    await this.toolWorker.start();
  }

  async loadFixtureFile(filePath: string): Promise<MockFixtureFile> {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as MockFixtureFile;
  }

  private async deleteAllRunStreams(redis: RedisStream): Promise<void> {
    let cursor = "0";
    do {
      const { cursor: nextCursor, keys } = await redis.scanStreams(
        `${REDIS_STREAM_KEY_PREFIX}:*:events`,
        cursor,
        100,
      );
      if (keys.length) {
        for (const key of keys) {
          await redis.deleteStream(key);
        }
      }
      cursor = nextCursor;
    } while (cursor !== "0");
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
