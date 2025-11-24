import { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import {
  DefaultModelFactory,
  type ModelFactory,
} from "../../src/core/model-factory.js";
import {
  REDIS_STREAM_KEY_PREFIX,
  StreamEventSchema,
  type Response,
  type StreamEvent,
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

const DEFAULT_SSE_TIMEOUT_MS = 60_000;

export interface SmokeHarnessSubmitParams {
  prompt: string;
  model: string;
  providerId: string;
  turnId?: string;
  agentId?: string;
}

export interface SmokeHarnessSubmitResult {
  runId: string;
  streamUrl: string;
}

export type ThreadSession = {
  submit(params: SmokeHarnessSubmitParams): Promise<SmokeHarnessSubmitResult>;
};

export class SmokeTestHarness {
  private readonly modelFactory: ModelFactory;
  private readonly hydrator = new StreamHydrator();
  private readonly workerOptions: PersistenceWorkerOptions;
  private readonly toolWorkerOptions: ToolWorkerOptions;
  private app: FastifyInstance | undefined;
  private baseUrl: string | undefined;
  private convex: ConvexHttpClient | undefined;
  private worker: PersistenceWorker | undefined;
  private toolWorker: ToolWorker | undefined;
  private readonly activeRunIds = new Set<string>();

  constructor() {
    this.modelFactory = new DefaultModelFactory({
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseUrl: process.env.ANTHROPIC_BASE_URL,
      },
    });
    this.workerOptions = {
      discoveryIntervalMs: 200,
      blockMs: 500,
      reclaimIntervalMs: 5000,
      reclaimMinIdleMs: 5000,
      persistIntermediateSnapshots: false,
    };
    this.toolWorkerOptions = {
      discoveryIntervalMs: 200,
      blockMs: 100,
      reclaimIntervalMs: 5000,
      reclaimMinIdleMs: 5000,
      batchSize: 25,
      toolTimeoutMs: 2_000,
    };
  }

  async setup(): Promise<void> {
    if (this.app) return;

    this.app = await createServer({
      modelFactory: this.modelFactory,
    });

    await this.app.listen({ host: "127.0.0.1", port: 0 });
    const address = this.app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to determine Fastify listening address");
    }
    this.baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

    const convexUrl = process.env.CONVEX_URL?.trim();
    if (!convexUrl) {
      throw new Error("CONVEX_URL must be set for smoke tests");
    }
    this.convex = new ConvexHttpClient(convexUrl);

    await this.flushRedisStreams();

    this.worker = new PersistenceWorker(this.workerOptions);
    await this.worker.start();

    this.toolWorker = new ToolWorker(this.toolWorkerOptions);
    await this.toolWorker.start();
  }

  async cleanup(): Promise<void> {
    await this.worker?.stop();
    this.worker = undefined;
    await this.toolWorker?.stop();
    this.toolWorker = undefined;

    this.convex = undefined;

    if (this.app) {
      await this.app.close();
      this.app = undefined;
      this.baseUrl = undefined;
    }

    this.activeRunIds.clear();
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

    await this.flushRedisStreams();

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

  async withThread<T>(fn: (session: ThreadSession) => Promise<T>): Promise<T> {
    const threadId = await this.createThread();
    const session: ThreadSession = {
      submit: (params) => this.submitOnThread(threadId, params),
    };
    try {
      return await fn(session);
    } finally {
      await this.deleteThread(threadId).catch(() => undefined);
    }
  }

  async consumeSSE(
    streamPath: string,
    options: {
      timeoutMs?: number;
      onEvent?: (event: StreamEvent) => void;
    } = {},
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
          options.onEvent?.(eventData);
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

  private async submitOnThread(
    threadId: string,
    params: SmokeHarnessSubmitParams,
  ): Promise<SmokeHarnessSubmitResult> {
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
        threadId,
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
    this.activeRunIds.add(data.runId);
    return { runId: data.runId, streamUrl: `/api/v2/stream/${data.runId}` };
  }

  private async createThread(): Promise<string> {
    if (!this.baseUrl) {
      throw new Error("Harness not initialized. Call setup() first.");
    }
    const response = await fetch(`${this.baseUrl}/api/v2/threads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        modelProviderId: process.env.CORE2_PROVIDER_ID ?? "openai",
        modelProviderApi: process.env.CORE2_PROVIDER_API ?? "responses",
        model: process.env.CORE2_MODEL ?? "gpt-5-mini",
        title: "Smoke Harness Thread",
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to create thread: ${response.status} ${text || "unknown"}`,
      );
    }
    const data = (await response.json()) as { threadId: string };
    return data.threadId;
  }

  private async deleteThread(threadId: string): Promise<void> {
    if (!this.baseUrl) return;
    await fetch(`${this.baseUrl}/api/v2/threads/${threadId}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }

  private async flushRedisStreams(): Promise<void> {
    const redis = await RedisStream.connect();
    try {
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
    } finally {
      await redis.close();
    }
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
