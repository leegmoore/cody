import { expect } from "bun:test";
import type { StreamEvent } from "../../../src/core/schema";
import { ResponseReducer } from "../../../src/core/reducer";
import type { SubmitOptions, StreamResult } from "./types";
import { DEFAULT_STREAM_TIMEOUT } from "./index";

/**
 * Submit a prompt to the API
 * Returns runId after validating response
 */
export async function submitPrompt(
  baseUrl: string,
  options: SubmitOptions,
): Promise<string> {
  const body: Record<string, unknown> = {
    prompt: options.prompt,
  };

  if (options.model) {
    body.model = options.model;
  }
  if (options.providerId) {
    body.providerId = options.providerId;
  }
  if (options.threadId) {
    body.threadId = options.threadId;
  }
  if (options.reasoningEffort) {
    body.reasoningEffort = options.reasoningEffort;
  }
  if (options.thinkingBudget) {
    body.thinkingBudget = options.thinkingBudget;
  }

  const submitRes = await fetch(`${baseUrl}/api/v2/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  expect(submitRes.status).toBe(202);
  const submitBody = (await submitRes.json()) as { runId: string };
  expect(submitBody.runId).toBeDefined();
  expect(typeof submitBody.runId).toBe("string");
  expect(submitBody.runId).toMatch(/^[0-9a-f-]{36}$/);

  return submitBody.runId;
}

/**
 * Stream events for a run and collect them
 * Returns events array, threadId, and hydrated response
 */
export async function streamAndCollect(
  baseUrl: string,
  runId: string,
  timeoutMs: number = DEFAULT_STREAM_TIMEOUT,
): Promise<StreamResult> {
  const events: StreamEvent[] = [];
  let threadId: string | undefined;
  const reducer = new ResponseReducer();

  const streamRes = await fetch(`${baseUrl}/api/v2/stream/${runId}`);
  expect(streamRes.ok).toBe(true);
  expect(streamRes.headers.get("content-type")).toContain("text/event-stream");

  if (!streamRes.body) {
    throw new Error("Stream response body is null");
  }

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const streamStart = Date.now();
  let streamComplete = false;

  while (!streamComplete) {
    if (Date.now() - streamStart > timeoutMs) {
      throw new Error("Stream timeout waiting for response_done");
    }

    const { done, value } = await reader.read();
    if (done) {
      streamComplete = true;
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const event = JSON.parse(line.slice(6)) as StreamEvent;
        events.push(event);
        reducer.apply(event);

        // Capture threadId from response_start
        if (event.payload?.type === "response_start") {
          threadId = event.payload.thread_id;
        }

        // Stop when response_done received
        if (event.payload?.type === "response_done") {
          await reader.cancel();
          streamComplete = true;
          break;
        }
      }
    }

    // Check if we got response_done
    if (events.some((e) => e.payload?.type === "response_done")) {
      streamComplete = true;
      break;
    }
  }

  if (!threadId) {
    throw new Error("threadId not captured from response_start");
  }

  const hydratedResponse = reducer.snapshot();
  if (!hydratedResponse) {
    throw new Error("hydratedResponse is undefined");
  }

  return {
    events,
    threadId,
    hydratedResponse,
    runId,
  };
}

/**
 * Combined submit + stream for convenience
 */
export async function submitAndStream(
  baseUrl: string,
  options: SubmitOptions,
  timeoutMs?: number,
): Promise<StreamResult> {
  const runId = await submitPrompt(baseUrl, options);
  return streamAndCollect(baseUrl, runId, timeoutMs);
}
