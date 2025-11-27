import { describe, test, expect, beforeAll } from "bun:test";
import { validateEnvironment } from "./validate-env";
import { StreamEvent } from "../../src/core/schema";
import { ResponseReducer } from "../../src/core/reducer";

const BASE_URL = "http://localhost:4010";

describe("tdd-api: anthropic-prompts", () => {
  beforeAll(async () => {
    await validateEnvironment();
  });

  test.concurrent(
    "submit prompt, stream response, verify thread persistence",
    async () => {
      // ========================================
      // PHASE 1: Submit prompt
      // ========================================
      const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "hi cody",
          providerId: "anthropic",
          model: "claude-haiku-4-5",
        }),
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

            // Collect usage_update events
            if (event.payload?.type === "usage_update") {
              // Usage update events are handled by reducer
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

      // Assert: provider_id is "anthropic"
      expect(firstEvent.payload.provider_id).toBe("anthropic");

      // Assert: model_id is "claude-haiku-4-5"
      expect(firstEvent.payload.model_id).toBe("claude-haiku-4-5");

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
            name?: string;
            call_id?: string;
            arguments?: string;
            output?: string;
            success?: boolean;
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

      // Assert: provider_id is "anthropic"
      expect(run.provider_id).toBe("anthropic");

      // Assert: model_id is "claude-haiku-4-5"
      expect(run.model_id).toBe("claude-haiku-4-5");

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
      // Note: Usage may not always be available immediately after persistence
      if (run.usage) {
        expect(run.usage.total_tokens).toBeGreaterThan(0);
        expect(run.usage.prompt_tokens).toBeGreaterThanOrEqual(0);
        expect(run.usage.completion_tokens).toBeGreaterThanOrEqual(0);
      }

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
      expect(hydratedResponse.output_items.length).toBe(
        run.output_items.length,
      );

      // Compare each output item
      for (let i = 0; i < hydratedResponse.output_items.length; i++) {
        const hydratedItem = hydratedResponse.output_items[i];
        const persistedItem = run.output_items[i];
        expect(hydratedItem.id).toBe(persistedItem.id);
        expect(hydratedItem.type).toBe(persistedItem.type);
        if (
          hydratedItem.type === "message" &&
          persistedItem.type === "message"
        ) {
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

      // Compare usage (if available)
      if (hydratedResponse.usage && run.usage) {
        expect(hydratedResponse.usage.prompt_tokens).toBe(
          run.usage.prompt_tokens,
        );
        expect(hydratedResponse.usage.completion_tokens).toBe(
          run.usage.completion_tokens,
        );
        expect(hydratedResponse.usage.total_tokens).toBe(
          run.usage.total_tokens,
        );
      }
    },
  );

  test.concurrent("tool calls: pwd and ls", async () => {
    // ========================================
    // PHASE 1: Submit prompt
    // ========================================
    const prompt =
      "please run a shell pwd in 1 tool call and a shell ls in another tool call then in your next response to me tell me what the working directory is and the first 10 files and directories in that working directory";

    const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        providerId: "anthropic",
        model: "claude-haiku-4-5",
      }),
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

          // Collect usage_update events
          if (event.payload?.type === "usage_update") {
            // Usage update events are handled by reducer
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
    // PHASE 2 ASSERTIONS: Stream events - Tool Call Specific
    // ========================================

    // Assert: Event count in valid range
    expect(events.length).toBeGreaterThan(1);
    expect(events.length).toBeLessThan(500); // Tool calls may generate more events

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

    // Assert: provider_id is "anthropic"
    expect(firstEvent.payload.provider_id).toBe("anthropic");

    // Assert: model_id is "claude-haiku-4-5"
    expect(firstEvent.payload.model_id).toBe("claude-haiku-4-5");

    // Assert: threadId captured
    expect(threadId).toBeDefined();
    expect(threadId).toMatch(/^[0-9a-f-]{36}$/);

    // Assert: Has item_start events with item_type: "function_call" - count >= 2
    const itemStarts = events.filter(
      (
        e,
      ): e is StreamEvent & {
        payload: { type: "item_start"; item_id: string; item_type: string };
      } => e.payload?.type === "item_start",
    );
    const functionCallStarts = itemStarts.filter(
      (e) => e.payload.item_type === "function_call",
    );
    expect(functionCallStarts.length).toBeGreaterThanOrEqual(2);

    // Assert: Has item_done events with final_item.type: "function_call" - count >= 2
    const itemDones = events.filter(
      (
        e,
      ): e is StreamEvent & {
        payload: {
          type: "item_done";
          item_id: string;
          final_item: {
            type: string;
            name?: string;
            call_id?: string;
            arguments?: string;
            output?: string;
            success?: boolean;
            content?: string;
            origin?: string;
          };
        };
      } => e.payload?.type === "item_done",
    );
    const functionCallDones = itemDones.filter(
      (e) => e.payload.final_item?.type === "function_call",
    );
    expect(functionCallDones.length).toBeGreaterThanOrEqual(2);

    // Assert: Has item_done events with final_item.type: "function_call_output" - count >= 2
    const functionCallOutputDones = itemDones.filter(
      (e) => e.payload.final_item?.type === "function_call_output",
    );
    expect(functionCallOutputDones.length).toBeGreaterThanOrEqual(2);

    // Assert: Each function_call has name populated
    for (const doneEvent of functionCallDones) {
      const finalItem = doneEvent.payload.final_item;
      if (finalItem.type === "function_call") {
        expect(finalItem.name).toBeDefined();
        expect(typeof finalItem.name).toBe("string");
        expect(finalItem.name.length).toBeGreaterThan(0);
      }
    }

    // Assert: Each function_call has call_id populated
    for (const doneEvent of functionCallDones) {
      const finalItem = doneEvent.payload.final_item;
      if (finalItem.type === "function_call") {
        expect(finalItem.call_id).toBeDefined();
        expect(typeof finalItem.call_id).toBe("string");
        expect(finalItem.call_id.length).toBeGreaterThan(0);
      }
    }

    // Assert: Final message exists (model's summary response)
    const messageDones = itemDones.filter(
      (e) => e.payload.final_item?.type === "message",
    );
    expect(messageDones.length).toBeGreaterThanOrEqual(1);
    const finalMessage = messageDones[messageDones.length - 1];
    expect(finalMessage).toBeDefined();
    if (!finalMessage) {
      throw new Error("finalMessage is undefined");
    }
    expect(finalMessage.payload.final_item.content).toBeDefined();
    expect(typeof finalMessage.payload.final_item.content).toBe("string");
    expect(
      (finalMessage.payload.final_item.content ?? "").length,
    ).toBeGreaterThan(0);
    expect(finalMessage.payload.final_item.origin).toBe("agent");

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
          name?: string;
          call_id?: string;
          arguments?: string;
          output?: string;
          success?: boolean;
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

    // Assert: provider_id is "anthropic"
    expect(run.provider_id).toBe("anthropic");

    // Assert: model_id is "claude-haiku-4-5"
    expect(run.model_id).toBe("claude-haiku-4-5");

    // Assert: Output items
    expect(run.output_items).toBeDefined();
    expect(Array.isArray(run.output_items)).toBe(true);
    expect(run.output_items.length).toBeGreaterThanOrEqual(1);

    // Assert: output_items contains >= 2 function_call items
    const functionCallItems = run.output_items.filter(
      (i) => i.type === "function_call",
    );
    expect(functionCallItems.length).toBeGreaterThanOrEqual(2);

    // Assert: output_items contains >= 2 function_call_output items
    const functionCallOutputItems = run.output_items.filter(
      (i) => i.type === "function_call_output",
    );
    expect(functionCallOutputItems.length).toBeGreaterThanOrEqual(2);

    // Assert: Each function_call has matching function_call_output (by call_id)
    for (const functionCallItem of functionCallItems) {
      if (functionCallItem.type === "function_call") {
        expect(functionCallItem.call_id).toBeDefined();
        const matchingOutput = functionCallOutputItems.find(
          (output) =>
            output.type === "function_call_output" &&
            output.call_id === functionCallItem.call_id,
        );
        expect(matchingOutput).toBeDefined();
        if (!matchingOutput) {
          throw new Error(
            `No matching function_call_output found for call_id: ${functionCallItem.call_id}`,
          );
        }
        expect(matchingOutput.success).toBeDefined();
        expect(typeof matchingOutput.success).toBe("boolean");
      }
    }

    // Assert: Each function_call has name populated
    for (const item of functionCallItems) {
      if (item.type === "function_call") {
        expect(item.name).toBeDefined();
        expect(typeof item.name).toBe("string");
        if (item.name) {
          expect(item.name.length).toBeGreaterThan(0);
        }
        expect(item.call_id).toBeDefined();
        expect(typeof item.call_id).toBe("string");
        if (item.call_id) {
          expect(item.call_id.length).toBeGreaterThan(0);
        }
        expect(item.arguments).toBeDefined();
        expect(typeof item.arguments).toBe("string");
      }
    }

    // Assert: Has at least one message output item (final response)
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
    // Note: Usage may not always be available immediately after persistence
    if (run.usage) {
      expect(run.usage.total_tokens).toBeGreaterThan(0);
      expect(run.usage.prompt_tokens).toBeGreaterThanOrEqual(0);
      expect(run.usage.completion_tokens).toBeGreaterThanOrEqual(0);
    }

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

    // Compare each output item - including tool calls
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

      if (
        hydratedItem.type === "function_call" &&
        persistedItem.type === "function_call"
      ) {
        const hydratedName =
          "name" in hydratedItem ? hydratedItem.name : undefined;
        const hydratedCallId =
          "call_id" in hydratedItem ? hydratedItem.call_id : undefined;
        const hydratedArguments =
          "arguments" in hydratedItem ? hydratedItem.arguments : undefined;
        const hydratedOrigin =
          "origin" in hydratedItem ? hydratedItem.origin : undefined;
        expect(hydratedName).toBe(persistedItem.name);
        expect(hydratedCallId).toBe(persistedItem.call_id);
        expect(hydratedArguments).toBe(persistedItem.arguments);
        expect(hydratedOrigin).toBe(
          persistedItem.origin as typeof hydratedOrigin,
        );
      }

      if (
        hydratedItem.type === "function_call_output" &&
        persistedItem.type === "function_call_output"
      ) {
        const hydratedCallId =
          "call_id" in hydratedItem ? hydratedItem.call_id : undefined;
        const hydratedOutput =
          "output" in hydratedItem ? hydratedItem.output : undefined;
        const hydratedSuccess =
          "success" in hydratedItem ? hydratedItem.success : undefined;
        const hydratedOrigin =
          "origin" in hydratedItem ? hydratedItem.origin : undefined;
        expect(hydratedCallId).toBe(persistedItem.call_id);
        expect(hydratedOutput).toBe(persistedItem.output);
        expect(hydratedSuccess).toBe(persistedItem.success);
        expect(hydratedOrigin).toBe(
          persistedItem.origin as typeof hydratedOrigin,
        );
      }
    }

    // Note: function_call_output items may not be present in hydrated response
    // if tool execution happens asynchronously via tool-worker
    // We verify function_call items are present and properly structured

    // Compare usage (if available)
    if (hydratedResponse.usage && run.usage) {
      expect(hydratedResponse.usage.prompt_tokens).toBe(
        run.usage.prompt_tokens,
      );
      expect(hydratedResponse.usage.completion_tokens).toBe(
        run.usage.completion_tokens,
      );
      expect(hydratedResponse.usage.total_tokens).toBe(run.usage.total_tokens);
    }
  });

  test.concurrent(
    "multi-turn conversation: 3 prompts, same thread",
    async () => {
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
            name?: string;
            call_id?: string;
            arguments?: string;
            output?: string;
            success?: boolean;
          }>;
          usage: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
          };
        }>;
      };

      const prompts = [
        "Hi Claude, how are you?",
        "This is great to hear!",
        "Have a good evening!",
      ];

      const runIds: string[] = [];
      const hydratedResponses: Array<ReturnType<ResponseReducer["snapshot"]>> =
        [];

      // Helper function to submit, stream, and collect response
      const submitAndStream = async (
        prompt: string,
        threadIdToUse?: string,
      ): Promise<{
        runId: string;
        threadId: string;
        hydratedResponse: NonNullable<ReturnType<ResponseReducer["snapshot"]>>;
      }> => {
        // ========================================
        // PHASE: Submit prompt
        // ========================================
        const submitBody: {
          prompt: string;
          threadId?: string;
          providerId: string;
          model: string;
        } = {
          prompt,
          providerId: "anthropic",
          model: "claude-haiku-4-5",
        };
        if (threadIdToUse) {
          submitBody.threadId = threadIdToUse;
        }

        const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitBody),
        });

        // Assert: Submit response
        expect(submitRes.status).toBe(202);
        const submitResponseBody = (await submitRes.json()) as {
          runId: string;
        };
        expect(submitResponseBody.runId).toBeDefined();
        expect(typeof submitResponseBody.runId).toBe("string");
        expect(submitResponseBody.runId).toMatch(/^[0-9a-f-]{36}$/); // UUID format

        const runId = submitResponseBody.runId;

        // ========================================
        // PHASE: Stream response
        // ========================================
        const events: StreamEvent[] = [];
        let capturedThreadId: string | undefined;
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
                capturedThreadId = event.payload.thread_id;
              }

              // Collect usage_update events
              if (event.payload?.type === "usage_update") {
                // Usage update events are handled by reducer
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
        // ASSERTIONS: Stream events
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

        // Assert: provider_id is "anthropic"
        expect(firstEvent.payload.provider_id).toBe("anthropic");

        // Assert: model_id is "claude-haiku-4-5"
        expect(firstEvent.payload.model_id).toBe("claude-haiku-4-5");

        // Assert: threadId captured
        expect(capturedThreadId).toBeDefined();
        expect(capturedThreadId).toMatch(/^[0-9a-f-]{36}$/);

        // Assert: threadId consistency (if provided, should match)
        if (threadIdToUse) {
          expect(capturedThreadId).toBe(threadIdToUse);
        }

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
        const itemDeltas = events.filter(
          (e) => e.payload?.type === "item_delta",
        );
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

        // Assert: No function_call items
        const functionCallDones = itemDones.filter(
          (e) => e.payload.final_item?.type === "function_call",
        );
        expect(functionCallDones.length).toBe(0);

        // Assert: No reasoning items
        const reasoningDones = itemDones.filter(
          (e) => e.payload.final_item?.type === "reasoning",
        );
        expect(reasoningDones.length).toBe(0);

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

        // Hydrated response
        const hydratedResponse = reducer.snapshot();
        if (!hydratedResponse) {
          throw new Error("hydratedResponse is undefined");
        }

        if (!capturedThreadId) {
          throw new Error("capturedThreadId is undefined");
        }

        return {
          runId,
          threadId: capturedThreadId,
          hydratedResponse,
        };
      };

      // ========================================
      // PHASE 1: Turn 1
      // ========================================
      const turn1 = await submitAndStream(prompts[0]);
      const threadId = turn1.threadId;
      runIds.push(turn1.runId);
      hydratedResponses.push(turn1.hydratedResponse);

      // ========================================
      // PHASE 2: Turn 2
      // ========================================
      const turn2 = await submitAndStream(prompts[1], threadId);
      expect(turn2.threadId).toBe(threadId); // Same thread
      runIds.push(turn2.runId);
      hydratedResponses.push(turn2.hydratedResponse);

      // ========================================
      // PHASE 3: Turn 3
      // ========================================
      const turn3 = await submitAndStream(prompts[2], threadId);
      expect(turn3.threadId).toBe(threadId); // Same thread
      runIds.push(turn3.runId);
      hydratedResponses.push(turn3.hydratedResponse);

      // ========================================
      // PHASE 4: Validate Thread Persistence
      // ========================================

      if (!threadId) {
        throw new Error("threadId is undefined");
      }

      // Wait for persistence worker to complete all runs with retry
      const PERSISTENCE_TIMEOUT = 20000; // 20 seconds max wait (3 runs)
      const RETRY_INTERVAL = 100; // Check every 100ms
      const startTime = Date.now();

      let threadBody: ThreadBody = {
        thread: {} as ThreadBody["thread"],
        runs: [],
      };

      // Poll thread endpoint until all 3 runs appear with terminal status
      let allRunsComplete = false;
      while (!allRunsComplete) {
        const threadRes = await fetch(`${BASE_URL}/api/v2/threads/${threadId}`);
        expect(threadRes.status).toBe(200);
        threadBody = (await threadRes.json()) as typeof threadBody;

        // Check if all 3 runs have been persisted with terminal status
        if (threadBody.runs.length >= 3) {
          const allComplete = threadBody.runs.every(
            (run) =>
              run.status === "complete" ||
              run.status === "error" ||
              run.status === "aborted",
          );
          if (allComplete) {
            allRunsComplete = true;
            break;
          }
        }

        // Check timeout
        if (Date.now() - startTime > PERSISTENCE_TIMEOUT) {
          const statuses = threadBody.runs.map((r) => r.status).join(", ");
          throw new Error(
            `Timeout waiting for all runs to persist. Thread has ${threadBody.runs.length} runs with statuses: ${statuses}`,
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

      // Assert: Exactly 3 runs
      expect(threadBody.runs.length).toBe(3);

      // Assert: All runs have status "complete"
      for (const run of threadBody.runs) {
        expect(run.status).toBe("complete");
      }

      // Assert: Each run has at least 1 message output_item
      for (const run of threadBody.runs) {
        expect(run.output_items).toBeDefined();
        expect(Array.isArray(run.output_items)).toBe(true);
        expect(run.output_items.length).toBeGreaterThanOrEqual(1);

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

        // Assert: No function_call items
        const functionCallItems = run.output_items.filter(
          (i: { type: string }) => i.type === "function_call",
        );
        expect(functionCallItems.length).toBe(0);

        // Assert: No reasoning items
        const reasoningItems = run.output_items.filter(
          (i: { type: string }) => i.type === "reasoning",
        );
        expect(reasoningItems.length).toBe(0);

        // Assert: provider_id is "anthropic"
        expect(run.provider_id).toBe("anthropic");

        // Assert: model_id is "claude-haiku-4-5"
        expect(run.model_id).toBe("claude-haiku-4-5");
      }

      // Assert: Runs are in creation order (oldest first, as returned by API)
      const sortedRuns = [...threadBody.runs].sort(
        (a, b) => a.created_at - b.created_at,
      );
      expect(sortedRuns.map((r) => r.id)).toEqual(
        threadBody.runs.map((r) => r.id),
      );

      // Assert: All runs belong to the same thread
      for (const run of threadBody.runs) {
        expect(run.thread_id).toBe(threadId);
      }

      // Assert: Each run has unique turn_id
      const turnIds = threadBody.runs.map((r) => r.turn_id);
      const uniqueTurnIds = new Set(turnIds);
      expect(uniqueTurnIds.size).toBe(3);

      // Assert: Each run has unique id
      const runIdsFromThread = threadBody.runs.map((r) => r.id);
      const uniqueRunIds = new Set(runIdsFromThread);
      expect(uniqueRunIds.size).toBe(3);

      // Assert: Usage present for all runs (if available)
      for (const run of threadBody.runs) {
        if (run.usage) {
          expect(run.usage.total_tokens).toBeGreaterThan(0);
          expect(run.usage.prompt_tokens).toBeGreaterThanOrEqual(0);
          expect(run.usage.completion_tokens).toBeGreaterThanOrEqual(0);
        }
      }

      // ========================================
      // PHASE 5: Compare hydrated responses to persisted runs
      // ========================================
      // Match each hydrated response to its persisted run by runId
      expect(hydratedResponses.length).toBe(3);
      expect(threadBody.runs.length).toBe(3);

      // Filter out any undefined values (shouldn't happen, but TypeScript needs this)
      const definedHydratedResponses = hydratedResponses.filter(
        (r): r is NonNullable<ReturnType<ResponseReducer["snapshot"]>> =>
          r !== undefined && r !== null,
      );
      expect(definedHydratedResponses.length).toBe(3);

      for (const hydratedResponse of definedHydratedResponses) {
        const persistedRun = threadBody.runs.find(
          (r) => r.id === hydratedResponse.id,
        );
        expect(persistedRun).toBeDefined();
        if (!persistedRun) {
          throw new Error(
            `Persisted run not found for hydrated response ${hydratedResponse.id}`,
          );
        }

        // Compare response-level fields
        expect(hydratedResponse.id).toBe(persistedRun.id);
        expect(hydratedResponse.turn_id).toBe(persistedRun.turn_id);
        expect(hydratedResponse.thread_id).toBe(persistedRun.thread_id);
        expect(hydratedResponse.model_id).toBe(persistedRun.model_id);
        expect(hydratedResponse.provider_id).toBe(persistedRun.provider_id);
        expect(hydratedResponse.status).toBe(persistedRun.status);
        expect(hydratedResponse.finish_reason).toBe(persistedRun.finish_reason);

        // Assert: Exactly the same number of output items in both hydrated and persisted
        expect(hydratedResponse.output_items.length).toBe(
          persistedRun.output_items.length,
        );

        // Compare each output item (one-to-one mapping)
        for (let i = 0; i < hydratedResponse.output_items.length; i++) {
          const hydratedItem = hydratedResponse.output_items[i];
          const persistedItem = persistedRun.output_items[i];
          expect(hydratedItem.id).toBe(persistedItem.id);
          expect(hydratedItem.type).toBe(persistedItem.type);

          if (
            hydratedItem.type === "message" &&
            persistedItem.type === "message"
          ) {
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

        // Compare usage (if available)
        if (hydratedResponse.usage && persistedRun.usage) {
          expect(hydratedResponse.usage.prompt_tokens).toBe(
            persistedRun.usage.prompt_tokens,
          );
          expect(hydratedResponse.usage.completion_tokens).toBe(
            persistedRun.usage.completion_tokens,
          );
          expect(hydratedResponse.usage.total_tokens).toBe(
            persistedRun.usage.total_tokens,
          );
        }
      }
    },
  );

  test.concurrent(
    "reasoning: solves puzzle with extended thinking",
    async () => {
      // ========================================
      // PHASE 1: Submit with thinkingBudget
      // ========================================
      const puzzlePrompt = `Solve the puzzle and reply with only the final number.

PUZZLE: I am a 2-digit number. My digits are different. The sum of my digits is 11. If you reverse my digits, the number increases by 27. What number am I?`;

      const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: puzzlePrompt,
          providerId: "anthropic",
          model: "claude-haiku-4-5",
          thinkingBudget: 4096, // Enable extended thinking
        }),
      });

      // Assert: Submit response
      expect(submitRes.status).toBe(202);
      const submitBody = (await submitRes.json()) as { runId: string };
      expect(submitBody.runId).toBeDefined();
      expect(typeof submitBody.runId).toBe("string");
      expect(submitBody.runId).toMatch(/^[0-9a-f-]{36}$/); // UUID format

      const runId = submitBody.runId;

      // ========================================
      // PHASE 2: Stream and collect
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
      const STREAM_TIMEOUT = 20000; // 20 seconds for reasoning response
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

            // Collect usage_update events
            if (event.payload?.type === "usage_update") {
              // Usage update events are handled by reducer
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
      expect(events.length).toBeLessThan(500);

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

      // Assert: provider_id is "anthropic"
      expect(firstEvent.payload.provider_id).toBe("anthropic");

      // Assert: model_id is "claude-haiku-4-5"
      expect(firstEvent.payload.model_id).toBe("claude-haiku-4-5");

      // Assert: threadId captured
      expect(threadId).toBeDefined();
      expect(threadId).toMatch(/^[0-9a-f-]{36}$/);

      // Assert: Has item_start events with item_type: "reasoning" - count >= 1
      const itemStarts = events.filter(
        (
          e,
        ): e is StreamEvent & {
          payload: { type: "item_start"; item_id: string; item_type: string };
        } => e.payload?.type === "item_start",
      );
      const reasoningStarts = itemStarts.filter(
        (e) => e.payload.item_type === "reasoning",
      );
      expect(reasoningStarts.length).toBeGreaterThanOrEqual(1);

      // Assert: Has item_done events with type "reasoning" - count >= 1
      const itemDones = events.filter(
        (
          e,
        ): e is StreamEvent & {
          payload: {
            type: "item_done";
            item_id: string;
            final_item: {
              type: string;
              content?: string;
              origin?: string;
            };
          };
        } => e.payload?.type === "item_done",
      );
      const reasoningDones = itemDones.filter(
        (e) => e.payload.final_item?.type === "reasoning",
      );
      expect(reasoningDones.length).toBeGreaterThanOrEqual(1);

      // Assert: Has item_done events with type "message" - count >= 1
      const messageDones = itemDones.filter(
        (e) => e.payload.final_item?.type === "message",
      );
      expect(messageDones.length).toBeGreaterThanOrEqual(1);

      // Assert: No function_call items
      const functionCallDones = itemDones.filter(
        (e) => e.payload.final_item?.type === "function_call",
      );
      expect(functionCallDones.length).toBe(0);

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

      // Hydrated response - will be compared to persisted object in Phase 4
      const hydratedResponse = reducer.snapshot();
      if (!hydratedResponse) {
        throw new Error("hydratedResponse is undefined");
      }

      // ========================================
      // PHASE 3: Validate hydrated response
      // ========================================

      // Assert: output_items contains >= 1 reasoning item
      const reasoningItems = hydratedResponse.output_items.filter(
        (item) => item.type === "reasoning",
      );
      expect(reasoningItems.length).toBeGreaterThanOrEqual(1);

      // Assert: output_items contains >= 1 message item
      const messageItems = hydratedResponse.output_items.filter(
        (item) => item.type === "message",
      );
      expect(messageItems.length).toBeGreaterThanOrEqual(1);

      // Assert: reasoning item has content (not empty)
      for (const reasoningItem of reasoningItems) {
        if (reasoningItem.type === "reasoning") {
          expect(reasoningItem.content).toBeDefined();
          expect(typeof reasoningItem.content).toBe("string");
          expect(reasoningItem.content.length).toBeGreaterThan(0);
        }
      }

      // ========================================
      // PHASE 4: Validate persistence
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
            name?: string;
            call_id?: string;
            arguments?: string;
            output?: string;
            success?: boolean;
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

      // Assert: Exactly 1 run
      expect(threadBody.runs.length).toBe(1);

      const persistedRun = threadBody.runs[0];

      // Assert: Run fields
      expect(persistedRun.id).toBeDefined();
      expect(persistedRun.turn_id).toBeDefined();
      expect(persistedRun.thread_id).toBe(threadId);
      expect(persistedRun.model_id).toBeDefined();
      expect(persistedRun.provider_id).toBeDefined();
      expect(persistedRun.status).toBe("complete");
      expect(persistedRun.created_at).toBeDefined();
      expect(persistedRun.updated_at).toBeDefined();
      expect(persistedRun.finish_reason).toBeDefined();
      expect(persistedRun.error).toBeNull();

      // Assert: provider_id is "anthropic"
      expect(persistedRun.provider_id).toBe("anthropic");

      // Assert: model_id is "claude-haiku-4-5"
      expect(persistedRun.model_id).toBe("claude-haiku-4-5");

      // Assert: Output items
      expect(persistedRun.output_items).toBeDefined();
      expect(Array.isArray(persistedRun.output_items)).toBe(true);
      expect(persistedRun.output_items.length).toBeGreaterThanOrEqual(1);

      // Assert: output_items contains reasoning items
      const persistedReasoningItems = persistedRun.output_items.filter(
        (i) => i.type === "reasoning",
      );
      expect(persistedReasoningItems.length).toBeGreaterThanOrEqual(1);

      // Assert: output_items contains message items
      const persistedMessageItems = persistedRun.output_items.filter(
        (i) => i.type === "message",
      );
      expect(persistedMessageItems.length).toBeGreaterThanOrEqual(1);

      // Assert: reasoning item has content (not empty)
      for (const reasoningItem of persistedReasoningItems) {
        expect(reasoningItem.content).toBeDefined();
        if (reasoningItem.content) {
          expect(typeof reasoningItem.content).toBe("string");
          expect(reasoningItem.content.length).toBeGreaterThan(0);
        }
      }

      // Assert: Usage present
      // Note: Usage may not always be available immediately after persistence
      if (persistedRun.usage) {
        expect(persistedRun.usage.total_tokens).toBeGreaterThan(0);
        expect(persistedRun.usage.prompt_tokens).toBeGreaterThanOrEqual(0);
        expect(persistedRun.usage.completion_tokens).toBeGreaterThanOrEqual(0);
      }

      // ========================================
      // PHASE 5: Compare hydrated vs persisted
      // ========================================

      // Response-level fields
      expect(hydratedResponse.id).toBe(persistedRun.id);
      expect(hydratedResponse.turn_id).toBe(persistedRun.turn_id);
      expect(hydratedResponse.thread_id).toBe(persistedRun.thread_id);
      expect(hydratedResponse.model_id).toBe(persistedRun.model_id);
      expect(hydratedResponse.provider_id).toBe(persistedRun.provider_id);
      expect(hydratedResponse.status).toBe(persistedRun.status);
      expect(hydratedResponse.finish_reason).toBe(persistedRun.finish_reason);
      expect(hydratedResponse.output_items.length).toBe(
        persistedRun.output_items.length,
      );

      // Compare each output item
      for (let i = 0; i < hydratedResponse.output_items.length; i++) {
        const hydratedItem = hydratedResponse.output_items[i];
        const persistedItem = persistedRun.output_items[i];

        // Common fields
        expect(hydratedItem.id).toBe(persistedItem.id);
        expect(hydratedItem.type).toBe(persistedItem.type);

        // Type-specific fields
        if (
          hydratedItem.type === "message" &&
          persistedItem.type === "message"
        ) {
          const hydratedContent =
            "content" in hydratedItem ? hydratedItem.content : undefined;
          const hydratedOrigin =
            "origin" in hydratedItem ? hydratedItem.origin : undefined;
          expect(hydratedContent).toBe(persistedItem.content);
          expect(hydratedOrigin).toBe(
            persistedItem.origin as typeof hydratedOrigin,
          );
        }

        if (
          hydratedItem.type === "reasoning" &&
          persistedItem.type === "reasoning"
        ) {
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

      // Usage sub-object (if available)
      if (hydratedResponse.usage && persistedRun.usage) {
        expect(hydratedResponse.usage.prompt_tokens).toBe(
          persistedRun.usage.prompt_tokens,
        );
        expect(hydratedResponse.usage.completion_tokens).toBe(
          persistedRun.usage.completion_tokens,
        );
        expect(hydratedResponse.usage.total_tokens).toBe(
          persistedRun.usage.total_tokens,
        );
      }
    },
  );
});
