import { randomUUID } from "node:crypto";
import { StreamEvent, StreamEventSchema, streamKeyForRun } from "./schema.js";

export const PROJECTOR_CONSUMER_GROUP = "codex-projector-group";

type RedisClientLike = {
  xadd: (...args: Array<string | number | Buffer>) => Promise<string>;
  xread: (...args: Array<string | number | Buffer>) => Promise<unknown>;
  xreadgroup: (...args: Array<string | number | Buffer>) => Promise<unknown>;
  xgroup: (...args: Array<string | number | Buffer>) => Promise<unknown>;
  xack: (
    streamKey: string,
    groupName: string,
    ...ids: string[]
  ) => Promise<number>;
  xautoclaim: (
    streamKey: string,
    groupName: string,
    consumerName: string,
    minIdle: string | number,
    start: string,
    ...rest: Array<string | number>
  ) => Promise<unknown>;
  scan: (
    cursor: string,
    ...args: Array<string | number>
  ) => Promise<[string, string[]]>;
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

export interface RedisStreamGroupRecord extends RedisStreamRecord {
  stream: string;
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
      opts?.url ?? process.env.REDIS_URL?.trim() ?? "redis://127.0.0.1:6379";
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
    const parsed = this.parseXReadRaw(raw, streamKey);
    return parsed.map(({ id, event }) => ({ id, event }));
  }

  async ensureGroup(
    streamKey: string,
    groupName: string,
    startId = "0-0",
  ): Promise<void> {
    try {
      await this.client.xgroup(
        "CREATE",
        streamKey,
        groupName,
        startId,
        "MKSTREAM", // Always use MKSTREAM to ensure group is created even if stream is empty
      );
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("BUSYGROUP") ||
          error.message.includes("BUSYGROUP"))
      ) {
        return;
      }
      throw error;
    }
  }

  async readGroup(
    streamKeys: string[],
    groupName: string,
    consumerName: string,
    fromIds: string[],
    blockMs = 5000,
    count = 50,
  ): Promise<RedisStreamGroupRecord[]> {
    if (!streamKeys.length) return [];
    const ids =
      fromIds.length === streamKeys.length
        ? fromIds
        : new Array(streamKeys.length).fill(">");

    const raw = await this.client.xreadgroup(
      "GROUP",
      groupName,
      consumerName,
      "COUNT",
      String(count),
      "BLOCK",
      String(blockMs),
      "STREAMS",
      ...streamKeys,
      ...ids,
    );
    return this.parseXReadRaw(raw);
  }

  async ack(
    streamKey: string,
    groupName: string,
    ...ids: string[]
  ): Promise<number> {
    if (!ids.length) return 0;
    return this.client.xack(streamKey, groupName, ...ids);
  }

  async autoClaim(
    streamKey: string,
    groupName: string,
    consumerName: string,
    minIdleMs: number,
    count = 25,
    startId = "0-0",
  ): Promise<RedisStreamGroupRecord[]> {
    const result = await this.client.xautoclaim(
      streamKey,
      groupName,
      consumerName,
      String(minIdleMs),
      startId,
      "COUNT",
      String(count),
    );

    if (!Array.isArray(result)) return [];
    const entries = result[1];
    return this.parseClaimEntries(streamKey, entries);
  }

  async scanStreams(
    pattern: string,
    cursor = "0",
    count = 50,
  ): Promise<{ cursor: string; keys: string[] }> {
    const [nextCursor, keys] = await this.client.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      String(count),
    );
    return {
      cursor: nextCursor,
      keys: Array.isArray(keys) ? keys : [],
    };
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

  private parseXReadRaw(
    raw: unknown,
    knownStream?: string,
  ): Array<{ stream: string; id: string; event: StreamEvent }> {
    if (!Array.isArray(raw)) return [];
    const records: Array<{ stream: string; id: string; event: StreamEvent }> =
      [];
    for (const streamEntry of raw) {
      if (!Array.isArray(streamEntry) || streamEntry.length < 2) continue;
      const streamKey =
        typeof streamEntry[0] === "string" ? streamEntry[0] : knownStream;
      if (!streamKey) continue;
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
            records.push({ stream: streamKey, id, event: parsed });
          }
        }
      }
    }
    return records;
  }

  private parseClaimEntries(
    streamKey: string,
    entries: unknown,
  ): RedisStreamGroupRecord[] {
    if (!Array.isArray(entries)) return [];
    const results: RedisStreamGroupRecord[] = [];
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
          results.push({ stream: streamKey, id, event: parsed });
        }
      }
    }
    return results;
  }

  private safeParseEvent(serialized: string): StreamEvent | undefined {
    try {
      const candidate = JSON.parse(serialized);
      return StreamEventSchema.parse(candidate);
    } catch (err) {
      const stub: StreamEvent = {
        event_id: randomUUID(),
        timestamp: Date.now(),
        trace_context: {
          traceparent:
            "00-" +
            randomUUID().replace(/-/g, "").padEnd(32, "0") +
            "-0000000000000000-00",
        },
        run_id: randomUUID(),
        type: "response_error",
        payload: {
          type: "response_error",
          response_id: randomUUID(),
          error: {
            code: "STREAM_PARSE_ERROR",
            message: err instanceof Error ? err.message : "Unknown parse error",
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
