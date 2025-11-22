/* eslint-disable no-console */
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { spawn } from "bun";
import type { Subprocess } from "bun";
import { RedisStream } from "../src/core/redis.js";
import {
  StreamEvent,
  StreamEventSchema,
  streamKeyForRun,
} from "../src/core/schema.js";
import { createTraceContext } from "../src/core/tracing.js";

type ItemDoneEvent = StreamEvent & {
  payload: Extract<StreamEvent["payload"], { type: "item_done" }>;
};

async function main() {
  const redis = await RedisStream.connect();
  await redis.ping().catch(() => {
    console.warn("[warn] Redis ping failed; proceeding anyway");
  });

  const skipWorker = process.env.SKIP_WORKER === "1";
  const worker = skipWorker ? undefined : spawnToolWorker();
  const runId = randomUUID();
  const turnId = randomUUID();
  const threadId = randomUUID();
  const streamKey = streamKeyForRun(runId);
  const keepStream = process.env.KEEP_STREAM === "1";
  try {
    if (!skipWorker) {
      // Give the worker enough time to complete its initial discovery cycle
      // so it can see the newly created stream.
      await sleep(2_000);
    }

    const trace = createTraceContext();
    const callId = randomUUID();
    const callItemId = callId;

    const events: StreamEvent[] = [
      makeEvent(trace, runId, {
        type: "response_start",
        response_id: runId,
        turn_id: turnId,
        thread_id: threadId,
        agent_id: undefined,
        model_id: "test-model",
        provider_id: "test-provider",
        created_at: Date.now(),
      }),
      makeEvent(trace, runId, {
        type: "item_start",
        item_id: callItemId,
        item_type: "function_call",
        name: "listDir",
        arguments: JSON.stringify({ dirPath: "." }),
      }),
      makeEvent(trace, runId, {
        type: "item_done",
        item_id: callItemId,
        final_item: {
          id: callItemId,
          type: "function_call",
          name: "listDir",
          arguments: JSON.stringify({ dirPath: "." }),
          call_id: callId,
          origin: "agent",
        },
      }),
    ];

    for (const event of events) {
      await redis.publish(event);
    }

    const outputEvent = await waitForFunctionOutput(
      redis,
      streamKey,
      callId,
      30_000,
    );
    if (!outputEvent) {
      throw new Error("Timed out waiting for function_call_output event");
    }

    const finalItem = outputEvent.payload.final_item;
    if (finalItem.type !== "function_call_output") {
      throw new Error(
        `Expected function_call_output item, received ${finalItem.type}`,
      );
    }

    if (!finalItem.success) {
      throw new Error(
        `Tool reported failure: ${finalItem.output.slice(0, 200)}`,
      );
    }

    if (!/Absolute path/i.test(finalItem.output)) {
      throw new Error(
        `Tool output did not contain expected listing data: ${finalItem.output.slice(0, 200)}`,
      );
    }

    console.log("trace: tool worker produced function_call_output event");
  } finally {
    if (worker) {
      await cleanup(worker);
    }
    if (!keepStream) {
      await redis.deleteStream(streamKey).catch(() => undefined);
    }
    await sleep(200);
    await redis.close();
  }
}

function spawnToolWorker(): Subprocess {
  return spawn({
    cmd: [process.execPath, "run", "src/workers/run_tool_worker.ts"],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
}

async function cleanup(worker: Subprocess): Promise<void> {
  try {
    worker.kill();
  } catch {
    // ignore
  }
  try {
    await worker.exited;
  } catch {
    // ignore
  }
}

async function waitForFunctionOutput(
  redis: RedisStream,
  streamKey: string,
  callId: string,
  timeoutMs: number,
): Promise<ItemDoneEvent | undefined> {
  const deadline = Date.now() + timeoutMs;
  let lastId = "0-0";

  while (Date.now() < deadline) {
    const records = await redis.read(streamKey, lastId, 1000, 50);
    if (!records.length) {
      continue;
    }

    for (const record of records) {
      lastId = record.id;
      const event = record.event;
      if (
        event.payload.type === "item_done" &&
        event.payload.final_item.type === "function_call_output" &&
        event.payload.final_item.call_id === callId
      ) {
        return event as ItemDoneEvent;
      }
    }
  }
  return undefined;
}

function makeEvent(
  trace: StreamEvent["trace_context"],
  runId: string,
  payload: StreamEvent["payload"],
): StreamEvent {
  const event: StreamEvent = {
    event_id: randomUUID(),
    timestamp: Date.now(),
    trace_context: trace,
    run_id: runId,
    type: payload.type,
    payload,
  };
  return StreamEventSchema.parse(event);
}

void main().catch((error) => {
  console.error("[error] verify_tools failed:", error);
  process.exit(1);
});
