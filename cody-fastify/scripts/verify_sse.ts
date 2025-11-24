/* eslint-disable no-console */
import EventSource from "eventsource";
import { z } from "zod";
import { RunStreamClient } from "../src/core/client-bridge.js";
import type { EventSourceCtor } from "../src/core/client-bridge.js";
import { initObservability } from "../src/core/observability.js";

const SubmitResponseSchema = z.object({
  runId: z.string().uuid(),
});

async function main() {
  const baseUrl =
    process.env.API_BASE_URL?.trim() ?? "http://127.0.0.1:4010";
  const prompt =
    process.env.VERIFY_PROMPT ??
    "Explain why streaming architectures improve user experience.";

  initObservability({ serviceName: "core2-verify-sse" });

  console.log("[verify] creating thread");
  const threadRes = await fetch(`${baseUrl}/api/v2/threads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: process.env.CORE2_MODEL ?? "gpt-5-mini",
      title: "Verify SSE",
    }),
  });

  if (!threadRes.ok) {
    const text = await threadRes.text();
    throw new Error(
      `failed to create thread: ${threadRes.status} ${text || "unknown"}`,
    );
  }

  const { threadId } = (await threadRes.json()) as { threadId: string };

  console.log("[verify] submitting prompt", { threadId });
  const submitRes = await fetch(`${baseUrl}/api/v2/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, threadId }),
  });

  if (!submitRes.ok) {
    const errorText = await submitRes.text();
    throw new Error(
      `submit endpoint returned ${submitRes.status}: ${errorText}`,
    );
  }

  const submitJson = await submitRes.json();
  const { runId } = SubmitResponseSchema.parse(submitJson);
  console.log("[verify] run started", { runId });

  const streamUrl = `${baseUrl}/api/v2/stream/${runId}`;
  console.log("[verify] connecting to stream", { streamUrl });

  await new Promise<void>((resolve, reject) => {
    const client = new RunStreamClient(
      streamUrl,
      {
        onEvent: (event) => {
          console.log(
            "[stream]",
            event.payload.type,
            event.payload.type === "item_delta"
              ? { itemId: event.payload.item_id }
              : {},
          );
        },
        onDone: (event) => {
          clearTimeout(timeout);
          if (event.payload.type !== "response_done") {
            reject(
              new Error(
                `Stream ended with ${event.payload.type} instead of response_done`,
              ),
            );
            return;
          }
          console.log("[stream] response_done received");
          client.stop();
          resolve();
        },
        onError: (error) => {
          clearTimeout(timeout);
          client.stop();
          reject(error);
        },
      },
      {
        eventSourceCtor: EventSource as unknown as EventSourceCtor,
        keepAliveTimeoutMs: 60_000,
      },
    );

    const timeout = setTimeout(() => {
      client.stop();
      reject(
        new Error(
          "Timed out waiting for response_done event from SSE stream",
        ),
      );
    }, 180_000);

    client.start();
  });

  console.log("[verify] SSE flow complete");
}

void main().catch((error) => {
  console.error("[verify] failed:", error);
  process.exit(1);
});
