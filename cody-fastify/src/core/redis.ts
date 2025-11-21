import { randomUUID } from "node:crypto";
import {
  StreamEvent,
  StreamEventSchema,
  streamKeyForRun,
} from "./schema.js";

type RedisClientLike = {
  xadd: (...args: Array<string | number | Buffer>) => Promise<string>;
  xread: (...args: Array<string | number | Buffer>) => Promise<unknown>;
  del: (...args: Array<string | number>) => Promise<unknown>;
  quit?: () => Promise<void>;
  ping?: () => Promise<string>;
  on?: (event: string, handler: (err: Error) => void) => void;
};

export interface RedisStreamOptions {
  url?: string;
  approximateMaxLen?: number;
}

export interface RedisStreamRecord {
  id: string;
  event: StreamEvent;
}

/**
  * Thin, typed wrapper around Bun's Redis client focused on Streams (XADD/XREAD).
  */
export class RedisStream {
  private readonly client: RedisClientLike;
  private readonly approximateMaxLen: number;

  constructor(client: RedisClientLike, opts?: RedisStreamOptions) {
    this.client = client;
    this.approximateMaxLen = opts?.approximateMaxLen ?? 1000;
  }

  static async connect(opts?: RedisStreamOptions): Promise<RedisStream> {
    const url =
      opts?.url ??
      process.env.REDIS_URL?.trim() ??
      "redis://127.0.0.1:6379";
    const client = await createRedisClient(url);
    return new RedisStream(client, opts);
  }

  async publish(event: StreamEvent): Promise<string> {
    const streamKey = streamKeyForRun(event.run_id);
    const payload = JSON.stringify(event);
    const id = await this.client.xadd(
      streamKey,
      "MAXLEN",
      "~",
      String(this.approximateMaxLen),
      "*",
      "event",
      payload,
    );
    return id;
  }

  /**
   * Read from a stream, defaulting to blocking for up to blockMs.
   * fromId: use "0-0" for full history, or "$" for new messages only.
   */
  async read(
    streamKey: string,
    fromId = "0-0",
    blockMs = 5000,
    count = 50,
  ): Promise<RedisStreamRecord[]> {
    const raw = await this.client.xread(
      "COUNT",
      String(count),
      "BLOCK",
      String(blockMs),
      "STREAMS",
      streamKey,
      fromId,
    );
    return this.parseXRead(raw);
  }

  async deleteStream(streamKey: string): Promise<void> {
    await this.client.del(streamKey);
  }

  async ping(): Promise<string | undefined> {
    if (typeof this.client.ping === "function") {
      return this.client.ping();
    }
    return undefined;
  }

  async close(): Promise<void> {
    if (typeof this.client.quit === "function") {
      await this.client.quit();
    }
  }

  private parseXRead(raw: unknown): RedisStreamRecord[] {
    if (!Array.isArray(raw)) return [];
    const records: RedisStreamRecord[] = [];
    for (const streamEntry of raw) {
      if (!Array.isArray(streamEntry) || streamEntry.length < 2) continue;
      const entries = streamEntry[1];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const [id, fields] = entry as [unknown, unknown];
        if (typeof id !== "string" || !Array.isArray(fields)) continue;
        for (let i = 0; i < fields.length; i += 2) {
          const field = fields[i];
          const value = fields[i + 1];
          if (field !== "event" || typeof value !== "string") continue;
          const parsed = this.safeParseEvent(value);
          if (parsed) {
            records.push({ id, event: parsed });
          }
        }
      }
    }
    return records;
  }

  private safeParseEvent(serialized: string): StreamEvent | undefined {
    try {
      const candidate = JSON.parse(serialized);
      return StreamEventSchema.parse(candidate);
    } catch (err) {
      const stub: StreamEvent = {
        event_id: randomUUID(),
        timestamp: Date.now(),
        trace_context: { traceparent: "00-" + randomUUID().replace(/-/g, "").padEnd(32, "0") + "-0000000000000000-00" },
        run_id: randomUUID(),
        type: "response_error",
        payload: {
          type: "response_error",
          response_id: randomUUID(),
          error: {
            code: "STREAM_PARSE_ERROR",
            message:
              err instanceof Error ? err.message : "Unknown parse error",
          },
        },
      };
      return stub;
    }
  }
}

async function createRedisClient(url: string): Promise<RedisClientLike> {
  const IORedis = (await import("ioredis")).default;
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // fail fast
    reconnectOnError: () => false,
    lazyConnect: false,
  });

  // Surface connection errors instead of silent event spam
  client.on?.("error", (err: Error) => {
    throw err;
  });

  await client.ping();
  return client as unknown as RedisClientLike;
}
