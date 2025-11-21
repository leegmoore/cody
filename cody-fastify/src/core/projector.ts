import { ConvexHttpClient } from "convex/browser";
import { RedisStream } from "./redis.js";
import { ResponseReducer } from "./reducer.js";
import { streamKeyForRun } from "./schema.js";

export async function projectRunToConvex(
  runId: string,
  options?: { redisUrl?: string; idleMax?: number },
) {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) throw new Error("CONVEX_URL is required for projector");
  const convex = new ConvexHttpClient(convexUrl);

  const redis = await RedisStream.connect({ url: options?.redisUrl });
  const reducer = new ResponseReducer();
  const streamKey = streamKeyForRun(runId);

  let cursor = "0-0";
  let done = false;
  let idle = 0;
  const idleMax = options?.idleMax ?? 3;

  while (!done) {
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
      if (rec.event.payload.type === "response_done" || rec.event.payload.type === "response_error") {
        done = true;
        break;
      }
    }
  }

  await redis.close();
}
