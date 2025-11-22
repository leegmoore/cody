/* eslint-disable no-console */
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { ConvexHttpClient } from "convex/browser";
import { OpenAIStreamAdapter } from "../src/core/adapters/openai-adapter.js";
import { RedisStream } from "../src/core/redis.js";
import { initObservability } from "../src/core/observability.js";
import { streamKeyForRun, type StreamEvent } from "../src/core/schema.js";
import { ResponseReducer } from "../src/core/reducer.js";
import { PersistenceWorker } from "../src/workers/persistence-worker.js";
import { api } from "../convex/_generated/api.js";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to run verify_pipeline");
  }

  const convexUrl = process.env.CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("CONVEX_URL is required to verify pipeline persistence");
  }

  initObservability({ serviceName: "core2-verify" });

  const model =
    process.env.CORE2_MODEL ??
    process.env.OPENAI_MODEL ??
    "gpt-5-mini"; // aligns with requested default

  const redis = await RedisStream.connect();
  await redis.ping().catch(() => {
    console.warn("[warn] Redis ping failed; continuing anyway");
  });

  const adapter = new OpenAIStreamAdapter({
    model,
    apiKey,
    redis,
  });

  const runId = randomUUID();
  const turnId = randomUUID();
  const threadId = randomUUID();
  const prompt = "Hello world, explain quantum physics in one sentence.";
  const streamKey = streamKeyForRun(runId);

  const worker = new PersistenceWorker({
    redisUrl: process.env.REDIS_URL,
    convexUrl,
  });
  await worker.start();

  const convex = new ConvexHttpClient(convexUrl);

  console.log("trace: starting pipeline");

  try {
    const tailPromise = tailStream(
      redis,
      streamKey,
      process.env.SHOW_SNAPSHOT === "1",
    );

    await adapter.stream({
      prompt,
      runId,
      turnId,
      threadId,
    });

    await tailPromise;

    const persisted = await waitForRunSnapshot(convex, runId, 45000);
    console.log("trace: convex snapshot stored", {
      runId,
      status: persisted.status,
      outputItems: persisted.outputItems.length,
    });
  } finally {
    await worker.stop();
    await convex.mutation(api.messages.deleteByRunId, { runId }).catch(() => undefined);
    await redis.deleteStream(streamKey).catch(() => undefined);
    await redis.close();
  }

  console.log("trace: verification complete");
}

async function tailStream(redis: RedisStream, streamKey: string, showSnapshot: boolean) {
  let lastId = "0-0";
  let done = false;
  const reducer = showSnapshot ? new ResponseReducer() : undefined;
  while (!done) {
    const entries = await redis.read(streamKey, lastId, 5000, 50);
    if (!entries.length) {
      continue;
    }

    for (const entry of entries) {
      lastId = entry.id;
      const ev = entry.event;
      logEvent(ev);
      reducer?.apply(ev);
      if (ev.payload.type === "response_done") {
        done = true;
      }
    }
  }
  if (reducer) {
    const snapshot = reducer.snapshot();
    if (snapshot) {
      console.log("=== FINAL SNAPSHOT ===");
      console.log(JSON.stringify(snapshot, null, 2));
    }
  }
}

function logEvent(event: StreamEvent) {
  console.log(
    JSON.stringify(
      {
        id: event.event_id,
        type: event.payload.type,
        payload: event.payload,
        traceparent: event.trace_context.traceparent,
      },
      null,
      2,
    ),
  );
}

const FINAL_STATUSES = new Set(["complete", "error", "aborted"]);

async function waitForRunSnapshot(
  convex: ConvexHttpClient,
  runId: string,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  let firstSeenAt: number | undefined;
  let lastStatus: string | undefined;

  while (Date.now() < deadline) {
    const doc = await convex
      .query(api.messages.getByRunId, { runId })
      .catch(() => undefined);

    if (doc) {
      lastStatus = doc.status;
      if (FINAL_STATUSES.has(doc.status)) {
        return doc;
      }
      if (!firstSeenAt) {
        firstSeenAt = Date.now();
      } else if (Date.now() - firstSeenAt > 10_000) {
        throw new Error(
          `Run ${runId} stuck in status ${doc.status} after 10s while waiting for completion`,
        );
      }
    }

    await sleep(500);
  }

  if (lastStatus) {
    throw new Error(
      `Timed out waiting for run ${runId} to reach a terminal status; last status was ${lastStatus}`,
    );
  }
  throw new Error(`Timed out waiting for Convex snapshot for run ${runId}`);
}

void main().catch((err) => {
  console.error("[error] verify_pipeline failed:", err);
  process.exit(1);
});
