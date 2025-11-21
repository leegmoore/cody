/* eslint-disable no-console */
import { randomUUID } from "node:crypto";
import { OpenAIStreamAdapter } from "../src/core/adapters/openai-adapter.js";
import { RedisStream } from "../src/core/redis.js";
import { initObservability } from "../src/core/observability.js";
import { streamKeyForRun, type StreamEvent } from "../src/core/schema.js";
import { ResponseReducer } from "../src/core/reducer.js";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to run verify_pipeline");
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

  console.log("trace: starting pipeline");
  const tailPromise = tailStream(redis, streamKey, process.env.SHOW_SNAPSHOT === "1");

  await adapter.stream({
    prompt,
    runId,
    turnId,
    threadId,
  });

  await tailPromise;

  await redis.deleteStream(streamKey);
  await redis.close();
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

void main().catch((err) => {
  console.error("[error] verify_pipeline failed:", err);
  process.exit(1);
});
