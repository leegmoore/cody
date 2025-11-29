import { describe, test, expect, beforeAll } from "bun:test";
import { validateEnvironment } from "./validate-env";
import {
  BASE_URL,
  submitAndStream,
  waitForPersistence,
  assertResponseStart,
  assertEventEnvelopes,
  assertResponseDone,
  assertItemStarts,
  assertItemDeltas,
  assertItemDones,
  getAllItemDones,
  assertMessageDone,
  assertThreadStructure,
  assertRunFields,
  assertOutputItems,
  assertAgentMessage,
  assertUsage,
  assertEventCount,
  assertThreadId,
  assertFunctionCallItems,
  assertFunctionCallOutputItems,
  assertFunctionCallPairs,
  assertReasoningItems,
  assertNoFunctionCalls,
  assertNoReasoning,
  compareResponseToRun,
  compareOutputItems,
  compareUsage,
  type StreamResult,
} from "./test-utils";

// Anthropic provider config
const ANTHROPIC_CONFIG = {
  providerId: "anthropic",
  model: "claude-haiku-4-5",
  expectedProviderId: "anthropic",
  expectedModelId: "claude-haiku-4-5",
};

describe("tdd-api: anthropic-prompts", () => {
  beforeAll(async () => {
    await validateEnvironment();
  });

  test.concurrent(
    "submit prompt, stream response, verify thread persistence",
    async () => {
      // ========================================
      // PHASE 1 & 2: Submit and stream
      // ========================================
      const result = await submitAndStream(BASE_URL, {
        prompt: "hi cody",
        providerId: ANTHROPIC_CONFIG.providerId,
        model: ANTHROPIC_CONFIG.model,
      });

      const { events, threadId, hydratedResponse, runId } = result;

      // ========================================
      // PHASE 2 ASSERTIONS: Stream events
      // ========================================
      assertEventCount(events, 2, 200);
      assertResponseStart(events[0], {
        expectedProviderId: ANTHROPIC_CONFIG.expectedProviderId,
        expectedModelId: ANTHROPIC_CONFIG.expectedModelId,
      });
      assertThreadId(threadId);
      assertItemStarts(events, "message");
      assertItemDeltas(events);
      assertMessageDone(events);
      assertResponseDone(events[events.length - 1]);
      assertEventEnvelopes(events, runId);

      // ========================================
      // PHASE 3: Pull thread and validate persistence
      // ========================================
      const threadBody = await waitForPersistence(BASE_URL, threadId);

      assertThreadStructure(threadBody, threadId);
      expect(threadBody.runs.length).toBe(1);

      const run = threadBody.runs[0];
      assertRunFields(run, threadId, {
        expectedProviderId: ANTHROPIC_CONFIG.expectedProviderId,
        expectedModelId: ANTHROPIC_CONFIG.expectedModelId,
      });
      assertOutputItems(run);
      assertAgentMessage(run.output_items);

      // Usage may not always be available for Anthropic
      assertUsage(run, false);

      // ========================================
      // PHASE 4: Compare hydrated response to persisted run
      // ========================================
      compareResponseToRun(hydratedResponse, run);
      compareOutputItems(hydratedResponse.output_items, run.output_items);
      // Usage comparison with required=false for Anthropic
      compareUsage(hydratedResponse.usage, run.usage, false);
    },
  );

  test.concurrent("tool calls: pwd and ls", async () => {
    // ========================================
    // PHASE 1 & 2: Submit and stream
    // ========================================
    const prompt =
      "please run a shell pwd in 1 tool call and a shell ls in another tool call then in your next response to me tell me what the working directory is and the first 10 files and directories in that working directory";

    const result = await submitAndStream(BASE_URL, {
      prompt,
      providerId: ANTHROPIC_CONFIG.providerId,
      model: ANTHROPIC_CONFIG.model,
    });

    const { events, threadId, hydratedResponse, runId } = result;

    // ========================================
    // PHASE 2 ASSERTIONS: Stream events - Tool Call Specific
    // ========================================
    assertEventCount(events, 2, 500);
    assertResponseStart(events[0], {
      expectedProviderId: ANTHROPIC_CONFIG.expectedProviderId,
      expectedModelId: ANTHROPIC_CONFIG.expectedModelId,
    });
    assertThreadId(threadId);

    // Assert: function_call items
    assertItemStarts(events, "function_call", 2);
    const functionCallDones = assertItemDones(events, "function_call", 2);

    // Assert: Each function_call has name and call_id populated
    for (const doneEvent of functionCallDones) {
      const finalItem = doneEvent.payload.final_item;
      expect(finalItem.name).toBeDefined();
      expect(typeof finalItem.name).toBe("string");
      expect((finalItem.name ?? "").length).toBeGreaterThan(0);
      expect(finalItem.call_id).toBeDefined();
      expect(typeof finalItem.call_id).toBe("string");
      expect((finalItem.call_id ?? "").length).toBeGreaterThan(0);
    }

    // Assert: function_call_output items
    assertItemDones(events, "function_call_output", 2);

    // Assert: Final message exists
    const messageDones = getAllItemDones(events).filter(
      (e) => e.payload.final_item?.type === "message",
    );
    expect(messageDones.length).toBeGreaterThanOrEqual(1);
    const finalMessage = messageDones[messageDones.length - 1];
    expect(finalMessage.payload.final_item.content).toBeDefined();
    expect(finalMessage.payload.final_item.origin).toBe("agent");

    assertResponseDone(events[events.length - 1]);
    assertEventEnvelopes(events, runId);

    // ========================================
    // PHASE 3: Pull thread and validate persistence
    // ========================================
    const threadBody = await waitForPersistence(BASE_URL, threadId);

    assertThreadStructure(threadBody, threadId);
    expect(threadBody.runs.length).toBe(1);

    const run = threadBody.runs[0];
    assertRunFields(run, threadId, {
      expectedProviderId: ANTHROPIC_CONFIG.expectedProviderId,
      expectedModelId: ANTHROPIC_CONFIG.expectedModelId,
    });
    assertOutputItems(run);

    // Assert: output_items contains function_call and function_call_output items
    assertFunctionCallItems(run.output_items, 2);
    assertFunctionCallOutputItems(run.output_items, 2);
    assertFunctionCallPairs(run.output_items);

    assertAgentMessage(run.output_items);
    assertUsage(run, false);

    // ========================================
    // PHASE 4: Compare hydrated response to persisted run
    // ========================================
    compareResponseToRun(hydratedResponse, run);
    compareOutputItems(hydratedResponse.output_items, run.output_items);
    compareUsage(hydratedResponse.usage, run.usage, false);
  });

  test.concurrent(
    "multi-turn conversation: 3 prompts, same thread",
    async () => {
      const prompts = [
        "Hi cody how are you",
        "This is great to hear!",
        "Have a good evening!",
      ];

      const results: StreamResult[] = [];

      // ========================================
      // PHASE 1: Turn 1
      // ========================================
      const turn1 = await submitAndStream(BASE_URL, {
        prompt: prompts[0],
        providerId: ANTHROPIC_CONFIG.providerId,
        model: ANTHROPIC_CONFIG.model,
      });
      const threadId = turn1.threadId;
      results.push(turn1);

      // Validate turn 1 stream
      assertEventCount(turn1.events, 2, 200);
      assertResponseStart(turn1.events[0], {
        expectedProviderId: ANTHROPIC_CONFIG.expectedProviderId,
        expectedModelId: ANTHROPIC_CONFIG.expectedModelId,
      });
      assertMessageDone(turn1.events);
      assertNoFunctionCalls(turn1.events);
      assertNoReasoning(turn1.events);
      assertResponseDone(turn1.events[turn1.events.length - 1]);
      assertEventEnvelopes(turn1.events, turn1.runId);

      // ========================================
      // PHASE 2: Turn 2
      // ========================================
      const turn2 = await submitAndStream(BASE_URL, {
        prompt: prompts[1],
        providerId: ANTHROPIC_CONFIG.providerId,
        model: ANTHROPIC_CONFIG.model,
        threadId,
      });
      expect(turn2.threadId).toBe(threadId);
      results.push(turn2);

      // Validate turn 2 stream
      assertEventCount(turn2.events, 2, 200);
      assertResponseStart(turn2.events[0], {
        expectedProviderId: ANTHROPIC_CONFIG.expectedProviderId,
        expectedModelId: ANTHROPIC_CONFIG.expectedModelId,
      });
      assertMessageDone(turn2.events);
      assertNoFunctionCalls(turn2.events);
      assertNoReasoning(turn2.events);
      assertResponseDone(turn2.events[turn2.events.length - 1]);
      assertEventEnvelopes(turn2.events, turn2.runId);

      // ========================================
      // PHASE 3: Turn 3
      // ========================================
      const turn3 = await submitAndStream(BASE_URL, {
        prompt: prompts[2],
        providerId: ANTHROPIC_CONFIG.providerId,
        model: ANTHROPIC_CONFIG.model,
        threadId,
      });
      expect(turn3.threadId).toBe(threadId);
      results.push(turn3);

      // Validate turn 3 stream
      assertEventCount(turn3.events, 2, 200);
      assertResponseStart(turn3.events[0], {
        expectedProviderId: ANTHROPIC_CONFIG.expectedProviderId,
        expectedModelId: ANTHROPIC_CONFIG.expectedModelId,
      });
      assertMessageDone(turn3.events);
      assertNoFunctionCalls(turn3.events);
      assertNoReasoning(turn3.events);
      assertResponseDone(turn3.events[turn3.events.length - 1]);
      assertEventEnvelopes(turn3.events, turn3.runId);

      // ========================================
      // PHASE 4: Validate Thread Persistence
      // ========================================
      const threadBody = await waitForPersistence(BASE_URL, threadId, {
        expectedRunCount: 3,
        timeoutMs: 20000,
        retryIntervalMs: 100,
      });

      assertThreadStructure(threadBody, threadId);
      expect(threadBody.runs.length).toBe(3);

      // Assert: All runs have status "complete" and expected provider
      for (const run of threadBody.runs) {
        expect(run.status).toBe("complete");
        expect(run.provider_id).toBe(ANTHROPIC_CONFIG.expectedProviderId);
        expect(run.model_id).toBe(ANTHROPIC_CONFIG.expectedModelId);
        assertOutputItems(run);
        assertAgentMessage(run.output_items);
      }

      // Assert: Runs are in creation order
      const sortedRuns = [...threadBody.runs].sort(
        (a, b) => a.created_at - b.created_at,
      );
      expect(sortedRuns.map((r) => r.id)).toEqual(
        threadBody.runs.map((r) => r.id),
      );

      // Assert: All runs belong to same thread
      for (const run of threadBody.runs) {
        expect(run.thread_id).toBe(threadId);
      }

      // Assert: Unique turn_ids and run_ids
      const turnIds = new Set(threadBody.runs.map((r) => r.turn_id));
      const runIds = new Set(threadBody.runs.map((r) => r.id));
      expect(turnIds.size).toBe(3);
      expect(runIds.size).toBe(3);

      // Assert: Usage present for all runs (not required for Anthropic)
      for (const run of threadBody.runs) {
        assertUsage(run, false);
      }

      // ========================================
      // PHASE 5: Compare hydrated responses to persisted runs
      // ========================================
      for (const result of results) {
        const persistedRun = threadBody.runs.find(
          (r) => r.id === result.hydratedResponse.id,
        );
        expect(persistedRun).toBeDefined();
        if (!persistedRun) {
          throw new Error(
            `Persisted run not found for hydrated response ${result.hydratedResponse.id}`,
          );
        }

        compareResponseToRun(result.hydratedResponse, persistedRun);
        compareOutputItems(
          result.hydratedResponse.output_items,
          persistedRun.output_items,
        );
        compareUsage(result.hydratedResponse.usage, persistedRun.usage, false);
      }
    },
  );

  test.concurrent(
    "extended thinking: submit puzzle with thinkingBudget, verify reasoning output streamed and persisted",
    async () => {
      // ========================================
      // PHASE 1 & 2: Submit and stream with thinking budget
      // ========================================
      const puzzlePrompt =
        "Solve the puzzle and reply with only the final number.\n\nPUZZLE: I am a 2-digit number. My digits are different. The sum of my digits is 11. If you reverse my digits, the number increases by 27. What number am I?";

      const result = await submitAndStream(
        BASE_URL,
        {
          prompt: puzzlePrompt,
          providerId: ANTHROPIC_CONFIG.providerId,
          model: ANTHROPIC_CONFIG.model,
          thinkingBudget: 4096,
        },
        20000, // Extended timeout for thinking
      );

      const { events, threadId, hydratedResponse, runId } = result;

      // ========================================
      // PHASE 2 ASSERTIONS: Stream events - Extended Thinking Specific
      // ========================================
      assertEventCount(events, 2, 500);
      assertResponseStart(events[0], {
        expectedProviderId: ANTHROPIC_CONFIG.expectedProviderId,
        expectedModelId: ANTHROPIC_CONFIG.expectedModelId,
      });
      assertThreadId(threadId);

      // Assert: Has reasoning items
      assertItemStarts(events, "reasoning");
      const reasoningDones = assertItemDones(events, "reasoning");
      expect(reasoningDones.length).toBeGreaterThanOrEqual(1);

      // Assert: Has message items
      assertItemDones(events, "message");

      // Assert: No function_call items
      assertNoFunctionCalls(events);

      assertResponseDone(events[events.length - 1]);
      assertEventEnvelopes(events, runId);

      // ========================================
      // PHASE 3: Validate hydrated response
      // ========================================
      const reasoningItems = hydratedResponse.output_items.filter(
        (item) => item.type === "reasoning",
      );
      expect(reasoningItems.length).toBeGreaterThanOrEqual(1);

      const messageItems = hydratedResponse.output_items.filter(
        (item) => item.type === "message",
      );
      expect(messageItems.length).toBeGreaterThanOrEqual(1);

      // Assert: reasoning items have content
      for (const item of reasoningItems) {
        if (item.type === "reasoning") {
          expect(item.content).toBeDefined();
          expect(item.content.length).toBeGreaterThan(0);
        }
      }

      // ========================================
      // PHASE 4: Validate persistence
      // ========================================
      const threadBody = await waitForPersistence(BASE_URL, threadId);

      assertThreadStructure(threadBody, threadId);
      expect(threadBody.runs.length).toBe(1);

      const persistedRun = threadBody.runs[0];
      assertRunFields(persistedRun, threadId, {
        expectedProviderId: ANTHROPIC_CONFIG.expectedProviderId,
        expectedModelId: ANTHROPIC_CONFIG.expectedModelId,
      });
      assertOutputItems(persistedRun);

      // Assert: persisted reasoning items
      assertReasoningItems(persistedRun.output_items);

      // Assert: persisted message items
      assertAgentMessage(persistedRun.output_items);

      assertUsage(persistedRun, false);

      // ========================================
      // PHASE 5: Compare hydrated vs persisted
      // ========================================
      compareResponseToRun(hydratedResponse, persistedRun);
      compareOutputItems(
        hydratedResponse.output_items,
        persistedRun.output_items,
      );
      compareUsage(hydratedResponse.usage, persistedRun.usage, false);
    },
  );
});
