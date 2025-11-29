import { expect } from "bun:test";
import type { StreamEvent } from "../../../src/core/schema";
import type { ThreadBody, RunData, OutputItemData } from "./types";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Type for item_done events with final_item
 */
export type ItemDoneEvent = StreamEvent & {
  payload: {
    type: "item_done";
    item_id: string;
    final_item: {
      type: string;
      content?: string;
      origin?: string;
      name?: string;
      call_id?: string;
      arguments?: string;
      output?: string;
      success?: boolean;
    };
  };
};

/**
 * Type for item_start events
 */
export type ItemStartEvent = StreamEvent & {
  payload: {
    type: "item_start";
    item_id: string;
    item_type: string;
  };
};

// ============================================================================
// GETTER FUNCTIONS (no assertions, just filtering with proper types)
// ============================================================================

/**
 * Get all item_done events (no assertion, just filter)
 */
export function getItemDones(
  events: StreamEvent[],
  itemType?: string,
): ItemDoneEvent[] {
  const itemDones = events.filter(
    (e): e is ItemDoneEvent => e.payload?.type === "item_done",
  );
  if (itemType) {
    return itemDones.filter((e) => e.payload.final_item?.type === itemType);
  }
  return itemDones;
}

/**
 * Get all item_start events (no assertion, just filter)
 */
export function getItemStarts(
  events: StreamEvent[],
  itemType?: string,
): ItemStartEvent[] {
  const itemStarts = events.filter(
    (e): e is ItemStartEvent => e.payload?.type === "item_start",
  );
  if (itemType) {
    return itemStarts.filter((e) => e.payload.item_type === itemType);
  }
  return itemStarts;
}

/**
 * Get all item_done events (alias for backwards compatibility)
 */
export function getAllItemDones(events: StreamEvent[]): ItemDoneEvent[] {
  return getItemDones(events);
}

// ============================================================================
// ASSERTION FUNCTIONS
// ============================================================================

/**
 * Assert response_start event is valid
 */
export function assertResponseStart(
  event: StreamEvent,
  options?: { expectedProviderId?: string; expectedModelId?: string },
): void {
  expect(event.payload.type).toBe("response_start");
  if (event.payload.type !== "response_start") {
    throw new Error("Event is not response_start");
  }

  expect(event.payload.response_id).toBeDefined();
  expect(event.payload.turn_id).toBeDefined();
  expect(event.payload.thread_id).toBeDefined();
  expect(event.payload.model_id).toBeDefined();
  expect(event.payload.provider_id).toBeDefined();
  expect(event.payload.created_at).toBeDefined();
  expect(typeof event.payload.created_at).toBe("number");

  if (options?.expectedProviderId) {
    expect(event.payload.provider_id).toBe(options.expectedProviderId);
  }
  if (options?.expectedModelId) {
    expect(event.payload.model_id).toBe(options.expectedModelId);
  }
}

/**
 * Assert all events have required envelope fields
 */
export function assertEventEnvelopes(
  events: StreamEvent[],
  runId: string,
): void {
  for (const event of events) {
    expect(event.event_id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.run_id).toBe(runId);
    expect(event.trace_context).toBeDefined();
    expect(event.trace_context.traceparent).toBeDefined();
  }
}

/**
 * Assert response_done event is valid
 */
export function assertResponseDone(event: StreamEvent): void {
  expect(event.payload.type).toBe("response_done");
  if (event.payload.type !== "response_done") {
    throw new Error("Event is not response_done");
  }
  expect(event.payload.status).toBe("complete");
  expect(event.payload.response_id).toBeDefined();
}

/**
 * Assert item_start events exist for a given item_type
 * Returns properly typed ItemStartEvent[]
 */
export function assertItemStarts(
  events: StreamEvent[],
  itemType: string,
  minCount: number = 1,
): ItemStartEvent[] {
  const filtered = getItemStarts(events, itemType);
  expect(filtered.length).toBeGreaterThanOrEqual(minCount);

  for (const event of filtered) {
    expect(event.payload.item_id).toBeDefined();
  }

  return filtered;
}

/**
 * Assert item_delta events exist (streaming happened)
 */
export function assertItemDeltas(
  events: StreamEvent[],
  minCount: number = 1,
): void {
  const itemDeltas = events.filter((e) => e.payload?.type === "item_delta");
  expect(itemDeltas.length).toBeGreaterThanOrEqual(minCount);
}

/**
 * Assert item_done events exist with final_item of given type
 * Returns properly typed ItemDoneEvent[]
 */
export function assertItemDones(
  events: StreamEvent[],
  itemType: string,
  minCount: number = 1,
): ItemDoneEvent[] {
  const filtered = getItemDones(events, itemType);
  expect(filtered.length).toBeGreaterThanOrEqual(minCount);
  return filtered;
}

/**
 * Assert thread structure is valid
 */
export function assertThreadStructure(
  threadBody: ThreadBody,
  threadId: string,
): void {
  expect(threadBody.thread).toBeDefined();
  expect(threadBody.runs).toBeDefined();
  expect(Array.isArray(threadBody.runs)).toBe(true);

  expect(threadBody.thread.threadId).toBe(threadId);
  expect(threadBody.thread.modelProviderId).toBeDefined();
  expect(threadBody.thread.model).toBeDefined();
  expect(threadBody.thread.createdAt).toBeDefined();
  expect(threadBody.thread.updatedAt).toBeDefined();
}

/**
 * Assert run fields are valid
 */
export function assertRunFields(
  run: RunData,
  threadId: string,
  options?: { expectedProviderId?: string; expectedModelId?: string },
): void {
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

  if (options?.expectedProviderId) {
    expect(run.provider_id).toBe(options.expectedProviderId);
  }
  if (options?.expectedModelId) {
    expect(run.model_id).toBe(options.expectedModelId);
  }
}

/**
 * Assert output items are present
 */
export function assertOutputItems(run: RunData, minCount: number = 1): void {
  expect(run.output_items).toBeDefined();
  expect(Array.isArray(run.output_items)).toBe(true);
  expect(run.output_items.length).toBeGreaterThanOrEqual(minCount);
}

/**
 * Assert function_call items have required fields
 */
export function assertFunctionCallItems(
  items: OutputItemData[],
  minCount: number = 1,
): OutputItemData[] {
  const functionCallItems = items.filter((i) => i.type === "function_call");
  expect(functionCallItems.length).toBeGreaterThanOrEqual(minCount);

  for (const item of functionCallItems) {
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

  return functionCallItems;
}

/**
 * Assert function_call_output items have required fields
 */
export function assertFunctionCallOutputItems(
  items: OutputItemData[],
  minCount: number = 1,
): OutputItemData[] {
  const outputItems = items.filter((i) => i.type === "function_call_output");
  expect(outputItems.length).toBeGreaterThanOrEqual(minCount);

  for (const item of outputItems) {
    expect(item.call_id).toBeDefined();
    expect(item.success).toBeDefined();
    expect(typeof item.success).toBe("boolean");
  }

  return outputItems;
}

/**
 * Assert function_call/function_call_output pairs match by call_id
 */
export function assertFunctionCallPairs(outputItems: OutputItemData[]): void {
  const functionCallItems = outputItems.filter(
    (i) => i.type === "function_call",
  );
  const functionCallOutputItems = outputItems.filter(
    (i) => i.type === "function_call_output",
  );

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
}

/**
 * Assert message output item is valid
 */
export function assertAgentMessage(items: OutputItemData[]): OutputItemData {
  const messageItems = items.filter((i) => i.type === "message");
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

  return agentMessage;
}

/**
 * Assert reasoning items have content
 */
export function assertReasoningItems(
  items: OutputItemData[],
  minCount: number = 1,
): OutputItemData[] {
  const reasoningItems = items.filter((i) => i.type === "reasoning");
  expect(reasoningItems.length).toBeGreaterThanOrEqual(minCount);

  for (const item of reasoningItems) {
    expect(item.content).toBeDefined();
    expect(typeof item.content).toBe("string");
    if (item.content) {
      expect(item.content.length).toBeGreaterThan(0);
    }
  }

  return reasoningItems;
}

/**
 * Assert usage is present and valid
 */
export function assertUsage(run: RunData, required: boolean = true): void {
  if (required) {
    expect(run.usage).toBeDefined();
    expect(run.usage.total_tokens).toBeGreaterThan(0);
  }
  if (run.usage) {
    expect(run.usage.prompt_tokens).toBeGreaterThanOrEqual(0);
    expect(run.usage.completion_tokens).toBeGreaterThanOrEqual(0);
  }
}

/**
 * Assert event count is in valid range
 */
export function assertEventCount(
  events: StreamEvent[],
  minCount: number = 2,
  maxCount: number = 200,
): void {
  expect(events.length).toBeGreaterThan(minCount - 1);
  expect(events.length).toBeLessThan(maxCount);
}

/**
 * Assert threadId is valid UUID format
 */
export function assertThreadId(
  threadId: string | undefined,
): asserts threadId is string {
  expect(threadId).toBeDefined();
  expect(threadId).toMatch(/^[0-9a-f-]{36}$/);
}

/**
 * Assert message item_done has valid content
 */
export function assertMessageDone(events: StreamEvent[]): void {
  const itemDones = getAllItemDones(events);
  const messageDone = itemDones.find(
    (e) => e.payload.final_item?.type === "message",
  );
  expect(messageDone).toBeDefined();
  if (!messageDone) {
    throw new Error("messageDone is undefined");
  }
  const finalItem = messageDone.payload.final_item;
  expect(finalItem.content).toBeDefined();
  expect(typeof finalItem.content).toBe("string");
  expect((finalItem.content ?? "").length).toBeGreaterThan(0);
  expect(finalItem.origin).toBe("agent");
}

/**
 * Assert no function_call items in stream
 */
export function assertNoFunctionCalls(events: StreamEvent[]): void {
  const itemDones = getAllItemDones(events);
  const functionCallDones = itemDones.filter(
    (e) => e.payload.final_item?.type === "function_call",
  );
  expect(functionCallDones.length).toBe(0);
}

/**
 * Assert no reasoning items in stream
 */
export function assertNoReasoning(events: StreamEvent[]): void {
  const itemDones = getAllItemDones(events);
  const reasoningDones = itemDones.filter(
    (e) => e.payload.final_item?.type === "reasoning",
  );
  expect(reasoningDones.length).toBe(0);
}
