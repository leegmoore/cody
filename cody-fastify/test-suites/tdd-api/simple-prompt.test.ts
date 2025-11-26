import { describe, test, expect, beforeAll } from "bun:test";
import { validateEnvironment } from "./validate-env";
import { StreamEvent } from "../../src/core/schema";
import { ResponseReducer } from "../../src/core/reducer";

const BASE_URL = "http://localhost:4010";

describe("tdd-api: simple-prompt", () => {
  beforeAll(async () => {
    await validateEnvironment();
  });

  test("submit prompt, stream response, verify thread persistence", async () => {
    // ========================================
    // PHASE 1: Submit prompt
    // ========================================
    const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi cody" }),
    });

    // Assert: Submit response
    expect(submitRes.status).toBe(202);
    const submitBody = (await submitRes.json()) as { runId: string };
    expect(submitBody.runId).toBeDefined();
    expect(typeof submitBody.runId).toBe("string");
    expect(submitBody.runId).toMatch(/^[0-9a-f-]{36}$/); // UUID format

    const runId = submitBody.runId;

    // ========================================
    // PHASE 2: Stream response
    // ========================================
    const events: StreamEvent[] = [];
    let threadId: string | undefined;
    const reducer = new ResponseReducer();

    const streamRes = await fetch(`${BASE_URL}/api/v2/stream/${runId}`);
    expect(streamRes.ok).toBe(true);
    expect(streamRes.headers.get("content-type")).toContain(
      "text/event-stream",
    );

    // Collect events
    if (!streamRes.body) {
      throw new Error("Stream response body is null");
    }
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const streamStart = Date.now();
    const STREAM_TIMEOUT = 15000; // 15 seconds for LLM response
    let streamComplete = false;

    while (!streamComplete) {
      if (Date.now() - streamStart > STREAM_TIMEOUT) {
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

    // ========================================
    // PHASE 2 ASSERTIONS: Stream events
    // ========================================

    // Assert: Event count in valid range
    expect(events.length).toBeGreaterThan(1);
    expect(events.length).toBeLessThan(200);

    // Assert: First event is response_start
    const firstEvent = events[0];
    expect(firstEvent.payload.type).toBe("response_start");
    if (firstEvent.payload.type !== "response_start") {
      throw new Error("First event is not response_start");
    }
    expect(firstEvent.payload.response_id).toBeDefined();
    expect(firstEvent.payload.turn_id).toBeDefined();
    expect(firstEvent.payload.thread_id).toBeDefined();
    expect(firstEvent.payload.model_id).toBeDefined();
    expect(firstEvent.payload.provider_id).toBeDefined();
    expect(firstEvent.payload.created_at).toBeDefined();
    expect(typeof firstEvent.payload.created_at).toBe("number");

    // Assert: threadId captured
    expect(threadId).toBeDefined();
    expect(threadId).toMatch(/^[0-9a-f-]{36}$/);

    // Assert: Has item_start for message
    const itemStarts = events.filter(
      (
        e,
      ): e is StreamEvent & {
        payload: { type: "item_start"; item_id: string; item_type: string };
      } => e.payload?.type === "item_start",
    );
    expect(itemStarts.length).toBeGreaterThanOrEqual(1);
    const messageStart = itemStarts.find(
      (e) => e.payload.item_type === "message",
    );
    expect(messageStart).toBeDefined();
    if (!messageStart) {
      throw new Error("messageStart is undefined");
    }
    expect(messageStart.payload.item_id).toBeDefined();

    // Assert: Has item_delta events (streaming happened)
    const itemDeltas = events.filter((e) => e.payload?.type === "item_delta");
    expect(itemDeltas.length).toBeGreaterThanOrEqual(1);

    // Assert: Has item_done with final message
    const itemDones = events.filter(
      (
        e,
      ): e is StreamEvent & {
        payload: {
          type: "item_done";
          item_id: string;
          final_item: { type: string; content?: string; origin?: string };
        };
      } => e.payload?.type === "item_done",
    );
    expect(itemDones.length).toBeGreaterThanOrEqual(1);
    const messageDone = itemDones.find(
      (e) => e.payload.final_item?.type === "message",
    );
    expect(messageDone).toBeDefined();
    if (!messageDone) {
      throw new Error("messageDone is undefined");
    }
    expect(messageDone.payload.final_item.content).toBeDefined();
    expect(typeof messageDone.payload.final_item.content).toBe("string");
    expect(
      (messageDone.payload.final_item.content ?? "").length,
    ).toBeGreaterThan(0);
    expect(messageDone.payload.final_item.origin).toBe("agent");

    // Assert: Last event is response_done
    const lastEvent = events[events.length - 1];
    expect(lastEvent.payload.type).toBe("response_done");
    if (lastEvent.payload.type !== "response_done") {
      throw new Error("Last event is not response_done");
    }
    expect(lastEvent.payload.status).toBe("complete");
    expect(lastEvent.payload.response_id).toBeDefined();

    // Assert: All events have required envelope fields
    for (const event of events) {
      expect(event.event_id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.run_id).toBe(runId);
      expect(event.trace_context).toBeDefined();
      expect(event.trace_context.traceparent).toBeDefined();
    }

    // Hydrated response - will be compared to persisted object in Phase 3
    const hydratedResponse = reducer.snapshot();
    if (!hydratedResponse) {
      throw new Error("hydratedResponse is undefined");
    }

    // ========================================
    // PHASE 3: Pull thread and validate persistence
    // ========================================

    if (!threadId) {
      throw new Error("threadId is undefined");
    }

    // Wait for persistence worker to complete with retry
    const PERSISTENCE_TIMEOUT = 10000; // 10 seconds max wait
    const RETRY_INTERVAL = 50; // Check every 50ms
    const startTime = Date.now();

    type ThreadBody = {
      thread: {
        threadId: string;
        modelProviderId: string | null;
        model: string | null;
        createdAt: string;
        updatedAt: string;
      };
      runs: Array<{
        id: string;
        turn_id: string;
        thread_id: string;
        model_id: string;
        provider_id: string;
        status: "queued" | "in_progress" | "complete" | "error" | "aborted";
        created_at: number;
        updated_at: number;
        finish_reason: string | null;
        error: unknown;
        output_items: Array<{
          id: string;
          type:
            | "message"
            | "reasoning"
            | "function_call"
            | "function_call_output"
            | "error"
            | "cancelled"
            | "script_execution"
            | "script_execution_output";
          content?: string;
          origin?: string;
        }>;
        usage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      }>;
    };

    let threadBody: ThreadBody = {
      thread: {} as ThreadBody["thread"],
      runs: [],
    };

    // Poll thread endpoint until run appears with terminal status
    // (Since intermediate snapshots are persisted, run may appear with "in_progress" first)
    let runComplete = false;
    while (!runComplete) {
      const threadRes = await fetch(`${BASE_URL}/api/v2/threads/${threadId}`);
      expect(threadRes.status).toBe(200);
      threadBody = (await threadRes.json()) as typeof threadBody;

      // Check if run has been persisted with terminal status
      if (threadBody.runs.length > 0) {
        const runStatus = threadBody.runs[0]?.status;
        if (
          runStatus === "complete" ||
          runStatus === "error" ||
          runStatus === "aborted"
        ) {
          runComplete = true;
          break;
        }
      }

      // Check timeout
      if (Date.now() - startTime > PERSISTENCE_TIMEOUT) {
        const currentStatus = threadBody.runs[0]?.status ?? "no run found";
        throw new Error(
          `Timeout waiting for run persistence. Thread has ${threadBody.runs.length} runs with status: ${currentStatus}`,
        );
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
    }

    // Assert: Thread structure
    expect(threadBody.thread).toBeDefined();
    expect(threadBody.runs).toBeDefined();
    expect(Array.isArray(threadBody.runs)).toBe(true);

    // Assert: Thread fields
    expect(threadBody.thread.threadId).toBe(threadId);
    expect(threadBody.thread.modelProviderId).toBeDefined();
    expect(threadBody.thread.model).toBeDefined();
    expect(threadBody.thread.createdAt).toBeDefined();
    expect(threadBody.thread.updatedAt).toBeDefined();

    // Assert: Exactly 1 run (we submitted 1 prompt)
    expect(threadBody.runs.length).toBe(1);

    const run = threadBody.runs[0];

    // Assert: Run fields
    expect(run.id).toBeDefined();
    expect(run.turn_id).toBeDefined();
    expect(run.thread_id).toBe(threadId);
    expect(run.model_id).toBeDefined();
    expect(run.provider_id).toBeDefined();
    expect(run.status).toBe("complete");
    expect(run.created_at).toBeDefined();
    expect(run.updated_at).toBeDefined();
    expect(run.finish_reason).toBeDefined();
    expect(run.error).toBeNull();

    // Assert: Output items
    expect(run.output_items).toBeDefined();
    expect(Array.isArray(run.output_items)).toBe(true);
    expect(run.output_items.length).toBeGreaterThanOrEqual(1);

    // Assert: Has at least one message output item
    const messageItems = run.output_items.filter(
      (i: { type: string }) => i.type === "message",
    );
    expect(messageItems.length).toBeGreaterThanOrEqual(1);

    const agentMessage = messageItems.find((i) => i.origin === "agent");
    expect(agentMessage).toBeDefined();
    if (!agentMessage) {
      throw new Error("agentMessage is undefined");
    }
    expect(agentMessage.content).toBeDefined();
    if (!agentMessage.content) {
      throw new Error("agentMessage.content is undefined");
    }
    expect(typeof agentMessage.content).toBe("string");
    expect(agentMessage.content.length).toBeGreaterThan(0);
    expect(agentMessage.id).toBeDefined();

    // Assert: Usage present
    // Note: In streaming mode, OpenAI may not provide token breakdowns
    expect(run.usage).toBeDefined();
    expect(run.usage.total_tokens).toBeGreaterThan(0);
    // Token breakdown may be 0 in streaming mode, so we check total is consistent
    expect(run.usage.prompt_tokens).toBeGreaterThanOrEqual(0);
    expect(run.usage.completion_tokens).toBeGreaterThanOrEqual(0);

    // ========================================
    // PHASE 3: Compare hydrated response to persisted run
    // ========================================
    expect(hydratedResponse.id).toBe(run.id);
    expect(hydratedResponse.turn_id).toBe(run.turn_id);
    expect(hydratedResponse.thread_id).toBe(run.thread_id);
    expect(hydratedResponse.model_id).toBe(run.model_id);
    expect(hydratedResponse.provider_id).toBe(run.provider_id);
    expect(hydratedResponse.status).toBe(run.status);
    expect(hydratedResponse.finish_reason).toBe(run.finish_reason);
    expect(hydratedResponse.output_items.length).toBe(run.output_items.length);

    // Compare each output item
    for (let i = 0; i < hydratedResponse.output_items.length; i++) {
      const hydratedItem = hydratedResponse.output_items[i];
      const persistedItem = run.output_items[i];
      expect(hydratedItem.id).toBe(persistedItem.id);
      expect(hydratedItem.type).toBe(persistedItem.type);
      if (hydratedItem.type === "message" && persistedItem.type === "message") {
        const hydratedContent =
          "content" in hydratedItem ? hydratedItem.content : undefined;
        const hydratedOrigin =
          "origin" in hydratedItem ? hydratedItem.origin : undefined;
        expect(hydratedContent).toBe(persistedItem.content);
        expect(hydratedOrigin).toBe(
          persistedItem.origin as typeof hydratedOrigin,
        );
      }
    }

    // Compare usage
    expect(hydratedResponse.usage?.prompt_tokens).toBe(run.usage.prompt_tokens);
    expect(hydratedResponse.usage?.completion_tokens).toBe(
      run.usage.completion_tokens,
    );
    expect(hydratedResponse.usage?.total_tokens).toBe(run.usage.total_tokens);
  });
});
