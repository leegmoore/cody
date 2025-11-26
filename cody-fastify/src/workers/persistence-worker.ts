import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { ConvexHttpClient } from "convex/browser";
import {
  ROOT_CONTEXT,
  SpanStatusCode,
  propagation,
  trace,
} from "@opentelemetry/api";
import { ConvexWriter } from "../core/persistence/convex-writer.js";
import {
  PROJECTOR_CONSUMER_GROUP,
  RedisStream,
  type RedisStreamGroupRecord,
} from "../core/redis.js";
import { ResponseReducer } from "../core/reducer.js";
import { REDIS_STREAM_KEY_PREFIX, type StreamEvent } from "../core/schema.js";

const tracer = trace.getTracer("codex.projector");

export interface PersistenceWorkerOptions {
  redisUrl?: string;
  convexUrl?: string;
  groupName?: string;
  consumerName?: string;
  streamPattern?: string;
  discoveryIntervalMs?: number;
  scanCount?: number;
  blockMs?: number;
  batchSize?: number;
  reclaimIntervalMs?: number;
  reclaimMinIdleMs?: number;
  persistIntermediateSnapshots?: boolean;
}

const DEFAULT_GROUP_NAME = PROJECTOR_CONSUMER_GROUP;

export class PersistenceWorker {
  private readonly groupName: string;
  private readonly consumerName: string;
  private readonly streamPattern: string;
  private readonly options: Required<
    Pick<
      PersistenceWorkerOptions,
      | "discoveryIntervalMs"
      | "scanCount"
      | "blockMs"
      | "batchSize"
      | "reclaimIntervalMs"
      | "reclaimMinIdleMs"
    >
  >;

  private redis: RedisStream | undefined;
  private convexWriter: ConvexWriter | undefined;
  private running = false;
  private joinPromise: Promise<void> | undefined;
  private readonly reducers = new Map<string, ResponseReducer>();
  private readonly streams = new Set<string>();
  private readonly streamOffsets = new Map<string, string>();
  private readonly persistIntermediateSnapshots: boolean;

  constructor(private readonly config: PersistenceWorkerOptions = {}) {
    this.groupName = config.groupName ?? DEFAULT_GROUP_NAME;
    this.consumerName =
      config.consumerName ?? `projector-${process.pid}-${randomUUID()}`;
    this.streamPattern =
      config.streamPattern ?? `${REDIS_STREAM_KEY_PREFIX}:*:events`;
    this.options = {
      discoveryIntervalMs: config.discoveryIntervalMs ?? 50,
      scanCount: config.scanCount ?? 100,
      blockMs: config.blockMs ?? 50,
      batchSize: config.batchSize ?? 50,
      reclaimIntervalMs: config.reclaimIntervalMs ?? 15000,
      reclaimMinIdleMs: config.reclaimMinIdleMs ?? 60000,
    };
    this.persistIntermediateSnapshots =
      config.persistIntermediateSnapshots ?? true;
  }

  async start(): Promise<void> {
    if (this.running) return;

    const convexUrl =
      this.config.convexUrl ?? process.env.CONVEX_URL?.trim() ?? "";
    if (!convexUrl) {
      throw new Error("CONVEX_URL is required to run persistence worker");
    }
    this.redis = await RedisStream.connect({ url: this.config.redisUrl });
    this.convexWriter = new ConvexWriter(new ConvexHttpClient(convexUrl));
    this.running = true;

    await this.fullDiscoveryCycle();

    const consume = this.consumeLoop();
    const discover = this.discoveryLoop();
    const reclaim = this.reclaimLoop();
    this.joinPromise = Promise.all([consume, discover, reclaim]).then(() => {});
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    console.log("[DEBUG - PersistenceWorker] Waiting for loops to join...");
    await this.joinPromise;
    await this.redis?.close();
    this.redis = undefined;
    this.convexWriter = undefined;
    this.reducers.clear();
    this.streams.clear();
    this.streamOffsets.clear();
  }

  async join(): Promise<void> {
    await this.joinPromise;
  }

  private async discoveryLoop(): Promise<void> {
    while (this.running) {
      await sleep(this.options.discoveryIntervalMs);
      if (!this.running) break;
      try {
        await this.discoverOnce();
      } catch (error) {
        console.error("[projector] discovery error", error);
      }
    }
  }

  private async reclaimLoop(): Promise<void> {
    while (this.running) {
      await sleep(this.options.reclaimIntervalMs);
      if (!this.running) break;
      const redis = this.redis;
      if (!redis) continue;
      for (const stream of this.streams) {
        if (!this.running) break;
        try {
          const records = await redis.autoClaim(
            stream,
            this.groupName,
            this.consumerName,
            this.options.reclaimMinIdleMs,
          );
          if (!records.length) continue;
          for (const record of records) {
            await this.processAndAck(record);
            if (!this.running) break;
          }
        } catch (error) {
          if (this.isNoGroupError(error)) {
            const redis = this.redis;
            if (redis) {
              try {
                await redis.ensureGroup(stream, this.groupName);
              } catch (ensureError) {
                console.error(
                  "[projector] ensureGroup failed after NOGROUP in reclaimLoop",
                  ensureError,
                );
              }
            }
            await sleep(200); // Small delay before next iteration
            continue; // Continue to next stream or next reclaim loop iteration
          }
          console.error("[projector] auto-claim error", error);
        }
      }
    }
  }

  private async consumeLoop(): Promise<void> {
    while (this.running) {
      const redis = this.redis;
      if (!redis) break;
      if (!this.streams.size) {
        await sleep(250);
        continue;
      }

      const streams = Array.from(this.streams);
      const offsets = streams.map(
        (stream) => this.streamOffsets.get(stream) ?? ">",
      );

      try {
        const records = await redis.readGroup(
          streams,
          this.groupName,
          this.consumerName,
          offsets,
          this.options.blockMs,
          this.options.batchSize,
        );

        for (const stream of streams) {
          this.streamOffsets.set(stream, ">");
        }

        if (!records.length) {
          continue;
        }

        for (const record of records) {
          await this.processAndAck(record);
          if (!this.running) break;
        }
      } catch (error) {
        if (this.isNoGroupError(error)) {
          const redis = this.redis;
          if (redis) {
            for (const stream of streams) {
              try {
                await redis.ensureGroup(stream, this.groupName);
              } catch (ensureError) {
                console.error(
                  "[projector] ensureGroup failed after NOGROUP",
                  ensureError,
                );
              }
            }
          }
          await sleep(200);
          continue;
        }
        console.error("[projector] readGroup error", error);
        await sleep(1000);
      }
    }
  }

  private async processAndAck(record: RedisStreamGroupRecord): Promise<void> {
    const redis = this.redis;
    if (!redis) return;
    try {
      await this.processRecord(record);
      await redis.ack(record.stream, this.groupName, record.id);
    } catch (error) {
      console.error("[projector] failed to process event", error);
      // Leave message pending so it can be reclaimed later.
    }
  }

  private async processRecord(record: RedisStreamGroupRecord): Promise<void> {
    const writer = this.convexWriter;
    if (!writer) {
      throw new Error("Convex writer not initialized");
    }

    const runId = record.event.run_id;
    const reducer = this.ensureReducer(runId);
    const carrier = {
      traceparent: record.event.trace_context.traceparent,
      ...(record.event.trace_context.tracestate
        ? { tracestate: record.event.trace_context.tracestate }
        : {}),
    };
    const parentCtx = propagation.extract(ROOT_CONTEXT, carrier);

    await tracer.startActiveSpan(
      `projector.${record.event.payload.type}`,
      {
        attributes: {
          "codex.run_id": runId,
          "codex.stream_key": record.stream,
          "codex.event_id": record.id,
          "codex.event_type": record.event.payload.type,
        },
      },
      parentCtx,
      async (span) => {
        try {
          const snapshot = reducer.apply(record.event);
          if (snapshot && this.shouldPersist(record.event.payload.type)) {
            await writer.persist(snapshot);
          }
          if (
            record.event.payload.type === "response_done" ||
            record.event.payload.type === "response_error"
          ) {
            this.reducers.delete(runId);
            this.streams.delete(record.stream);
            this.streamOffsets.delete(record.stream);
          }
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private ensureReducer(runId: string): ResponseReducer {
    let reducer = this.reducers.get(runId);
    if (!reducer) {
      reducer = new ResponseReducer();
      this.reducers.set(runId, reducer);
    }
    return reducer;
  }

  private async discoverOnce(): Promise<void> {
    const redis = this.redis;
    if (!redis) return;

    // Always use KEYS for discovery - it's O(N) but reliable and fast for dev workloads.
    // SCAN is unreliable for sparse keyspaces and can miss keys entirely.
    const discoveredKeys = await redis.keysMatch(this.streamPattern);

    let newCount = 0;
    for (const key of discoveredKeys) {
      if (!this.streams.has(key)) {
        await redis.ensureGroup(key, this.groupName);
        this.streams.add(key);
        // Use ">" to read new messages immediately (not PEL which is empty for new consumers)
        this.streamOffsets.set(key, ">");
        newCount++;
      }
    }

    if (newCount > 0) {
      console.log(`[projector] Discovered ${newCount} new stream(s)`);
    }
  }

  private async fullDiscoveryCycle(): Promise<void> {
    // Single discovery call is sufficient since we use KEYS command
    await this.discoverOnce();
  }

  private isNoGroupError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.message.includes("NOGROUP");
  }

  private shouldPersist(type: StreamEvent["payload"]["type"]): boolean {
    if (this.persistIntermediateSnapshots) {
      return true;
    }
    return (
      type === "response_done" ||
      type === "response_error" ||
      type === "turn_aborted_by_user"
    );
  }
}
