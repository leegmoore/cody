import { RedisStream } from "../core/redis.js";
import { ResponseReducer } from "../core/reducer.js";
import { streamKeyForRun } from "../core/schema.js";
import { ConvexHttpClient } from "convex/browser";

export interface ProjectorOptions {
  redisUrl?: string;
  convexUrl?: string;
  idleMax?: number;
}

/**
 * Tail a single run stream and persist snapshots to Convex.
 * Intended to be launched per-run from the API path that starts a run.
 */
export async function runProjectorForRun(
  runId: string,
  opts?: ProjectorOptions,
): Promise<void> {
  const convexUrl = opts?.convexUrl ?? process.env.CONVEX_URL;
  if (!convexUrl) throw new Error("CONVEX_URL is required");
  const convex = new ConvexHttpClient(convexUrl);

  const redis = await RedisStream.connect({ url: opts?.redisUrl });
  const reducer = new ResponseReducer();
  const streamKey = streamKeyForRun(runId);

  let cursor = "0-0";
  let idle = 0;
  const idleMax = opts?.idleMax ?? 3;

  let running = true;
  while (running) {
    const records = await redis.read(streamKey, cursor, 5000, 100);
    if (!records.length) {
      idle += 1;
      if (idle >= idleMax) break;
      continue;
    }
    idle = 0;

    for (const rec of records) {
      cursor = rec.id;
      const snapshot = reducer.apply(rec.event);
      if (snapshot) {
        await convex.mutation("messages:projectRunSnapshot", {
          runId: snapshot.id,
          turnId: snapshot.turn_id,
          threadId: snapshot.thread_id,
          agentId: snapshot.agent_id,
          modelId: snapshot.model_id,
          providerId: snapshot.provider_id,
          status: snapshot.status,
          createdAt: snapshot.created_at,
          updatedAt: snapshot.updated_at,
          outputItems: snapshot.output_items,
          usage: snapshot.usage,
          finishReason: snapshot.finish_reason ?? undefined,
          error: snapshot.error ?? undefined,
        });
      }
      if (
        rec.event.payload.type === "response_done" ||
        rec.event.payload.type === "response_error"
      ) {
        running = false;
        break;
      }
    }
  }

  await redis.close();
}
