# CODER PROMPT: TDD Test Utilities Extraction

**Generated:** 2025-11-28
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer. Your task: **Extract duplicated code from the TDD test files into shared utilities, then refactor both test files to use those utilities.**

---

## APPLICATION OVERVIEW

This is a streaming-first LLM harness using Fastify, Redis, and Convex. The test suite at `test-suites/tdd-api/` validates the complete pipeline: submit → stream → persist → verify.

Two test files exist with nearly identical patterns:
- `openai-prompts.test.ts` (~1841 lines, 4 tests)
- `anthropic-prompts.test.ts` (~1982 lines, 4 tests)

Both files contain massive duplication that needs extraction into shared utilities.

---

## CURRENT STATE

- All 8 tests pass
- Files are functional but bloated with repeated code
- Same patterns repeated 4x in each file (ThreadBody type, stream loop, assertions, persistence polling, comparisons)

---

## JOB OVERVIEW

1. Create `test-suites/tdd-api/test-utils/` directory with utility modules
2. Implement shared types, submit helpers, assertion functions, persistence polling, and comparison utilities
3. Refactor `openai-prompts.test.ts` to use utilities
4. Refactor `anthropic-prompts.test.ts` to use utilities
5. Verify all 8 tests still pass

---

## DIRECTORY STRUCTURE

```
cody-fastify/
├── test-suites/
│   └── tdd-api/
│       ├── validate-env.ts
│       ├── openai-prompts.test.ts    # Refactor target
│       ├── anthropic-prompts.test.ts # Refactor target
│       └── test-utils/               # CREATE THIS
│           ├── index.ts
│           ├── types.ts
│           ├── submit.ts
│           ├── assertions.ts
│           ├── persistence.ts
│           └── compare.ts
└── src/core/
    ├── schema.ts    # StreamEvent types
    └── reducer.ts   # ResponseReducer
```

---

## DETAILED JOB BREAKDOWN

### Phase 1: Create test-utils directory and types

**File: `test-utils/types.ts`**

Extract the ThreadBody type that appears 4 times in each test file:

```typescript
import type { StreamEvent } from "../../../src/core/schema";
import type { ResponseReducer } from "../../../src/core/reducer";

export type ThreadBody = {
  thread: {
    threadId: string;
    modelProviderId: string | null;
    model: string | null;
    createdAt: string;
    updatedAt: string;
  };
  runs: Array<RunData>;
};

export type RunData = {
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
  output_items: Array<OutputItemData>;
  usage: UsageData;
};

export type OutputItemData = {
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
};

export type UsageData = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type SubmitOptions = {
  prompt: string;
  model?: string;
  providerId?: string;
  threadId?: string;
  reasoningEffort?: "low" | "medium" | "high";
  thinkingBudget?: number;
};

export type StreamResult = {
  events: StreamEvent[];
  threadId: string;
  hydratedResponse: NonNullable<ReturnType<ResponseReducer["snapshot"]>>;
  runId: string;
};

export type ProviderExpectations = {
  expectedProviderId?: string;
  expectedModelId?: string;
};
```

**File: `test-utils/index.ts`**

```typescript
export * from "./types";
export * from "./submit";
export * from "./assertions";
export * from "./persistence";
export * from "./compare";

export const BASE_URL = "http://localhost:4010";
export const DEFAULT_STREAM_TIMEOUT = 15000;
export const DEFAULT_PERSISTENCE_TIMEOUT = 10000;
export const DEFAULT_RETRY_INTERVAL = 50;
```

### Phase 2: Implement submit utilities

**File: `test-utils/submit.ts`**

```typescript
import { expect } from "bun:test";
import { StreamEvent } from "../../../src/core/schema";
import { ResponseReducer } from "../../../src/core/reducer";
import type { SubmitOptions, StreamResult } from "./types";
import { BASE_URL, DEFAULT_STREAM_TIMEOUT } from "./index";

/**
 * Submit a prompt to the API and return the runId
 */
export async function submitPrompt(
  options: SubmitOptions,
  baseUrl: string = BASE_URL
): Promise<string> {
  const body: Record<string, unknown> = { prompt: options.prompt };

  if (options.model) body.model = options.model;
  if (options.providerId) body.providerId = options.providerId;
  if (options.threadId) body.threadId = options.threadId;
  if (options.reasoningEffort) body.reasoningEffort = options.reasoningEffort;
  if (options.thinkingBudget) body.thinkingBudget = options.thinkingBudget;

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
 * Stream events for a run and collect them with hydration
 */
export async function streamAndCollect(
  runId: string,
  baseUrl: string = BASE_URL,
  timeoutMs: number = DEFAULT_STREAM_TIMEOUT
): Promise<Omit<StreamResult, "runId">> {
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

        if (event.payload?.type === "response_start") {
          threadId = event.payload.thread_id;
        }

        if (event.payload?.type === "response_done") {
          await reader.cancel();
          streamComplete = true;
          break;
        }
      }
    }

    if (events.some((e) => e.payload?.type === "response_done")) {
      streamComplete = true;
      break;
    }
  }

  const hydratedResponse = reducer.snapshot();
  if (!hydratedResponse) {
    throw new Error("hydratedResponse is undefined");
  }
  if (!threadId) {
    throw new Error("threadId not captured from stream");
  }

  return { events, threadId, hydratedResponse };
}

/**
 * Combined submit and stream for convenience
 */
export async function submitAndStream(
  options: SubmitOptions,
  baseUrl: string = BASE_URL,
  timeoutMs: number = DEFAULT_STREAM_TIMEOUT
): Promise<StreamResult> {
  const runId = await submitPrompt(options, baseUrl);
  const result = await streamAndCollect(runId, baseUrl, timeoutMs);
  return { ...result, runId };
}
```

### Phase 3: Implement assertion utilities

**File: `test-utils/assertions.ts`**

```typescript
import { expect } from "bun:test";
import type { StreamEvent } from "../../../src/core/schema";
import type { ThreadBody, RunData, OutputItemData, ProviderExpectations } from "./types";

/**
 * Assert response_start event is valid
 */
export function assertResponseStart(
  event: StreamEvent,
  expectations?: ProviderExpectations
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

  if (expectations?.expectedProviderId) {
    expect(event.payload.provider_id).toBe(expectations.expectedProviderId);
  }
  if (expectations?.expectedModelId) {
    expect(event.payload.model_id).toBe(expectations.expectedModelId);
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
 * Assert all events have required envelope fields
 */
export function assertEventEnvelopes(events: StreamEvent[], runId: string): void {
  for (const event of events) {
    expect(event.event_id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.run_id).toBe(runId);
    expect(event.trace_context).toBeDefined();
    expect(event.trace_context.traceparent).toBeDefined();
  }
}

/**
 * Assert threadId is valid UUID format
 */
export function assertThreadId(threadId: string | undefined): asserts threadId is string {
  expect(threadId).toBeDefined();
  expect(threadId).toMatch(/^[0-9a-f-]{36}$/);
}

/**
 * Get item_start events filtered by item_type
 */
export function getItemStarts(
  events: StreamEvent[],
  itemType?: string
): Array<StreamEvent & { payload: { type: "item_start"; item_id: string; item_type: string } }> {
  const starts = events.filter(
    (e): e is StreamEvent & { payload: { type: "item_start"; item_id: string; item_type: string } } =>
      e.payload?.type === "item_start"
  );
  if (itemType) {
    return starts.filter((e) => e.payload.item_type === itemType);
  }
  return starts;
}

/**
 * Get item_done events filtered by final_item type
 */
export function getItemDones(
  events: StreamEvent[],
  itemType?: string
): Array<StreamEvent & { payload: { type: "item_done"; item_id: string; final_item: Record<string, unknown> } }> {
  const dones = events.filter(
    (e): e is StreamEvent & { payload: { type: "item_done"; item_id: string; final_item: Record<string, unknown> } } =>
      e.payload?.type === "item_done"
  );
  if (itemType) {
    return dones.filter((e) => (e.payload.final_item as { type?: string })?.type === itemType);
  }
  return dones;
}

/**
 * Assert item_start events exist for given type with minimum count
 */
export function assertItemStarts(
  events: StreamEvent[],
  itemType: string,
  minCount: number = 1
): void {
  const starts = getItemStarts(events, itemType);
  expect(starts.length).toBeGreaterThanOrEqual(minCount);
}

/**
 * Assert item_done events exist for given type with minimum count
 */
export function assertItemDones(
  events: StreamEvent[],
  itemType: string,
  minCount: number = 1
): void {
  const dones = getItemDones(events, itemType);
  expect(dones.length).toBeGreaterThanOrEqual(minCount);
}

/**
 * Assert message item_done has content and origin
 */
export function assertMessageDone(events: StreamEvent[]): void {
  const messageDones = getItemDones(events, "message");
  expect(messageDones.length).toBeGreaterThanOrEqual(1);

  const messageDone = messageDones.find(
    (e) => (e.payload.final_item as { type?: string })?.type === "message"
  );
  expect(messageDone).toBeDefined();
  if (!messageDone) throw new Error("messageDone is undefined");

  const finalItem = messageDone.payload.final_item as { content?: string; origin?: string };
  expect(finalItem.content).toBeDefined();
  expect(typeof finalItem.content).toBe("string");
  expect((finalItem.content ?? "").length).toBeGreaterThan(0);
  expect(finalItem.origin).toBe("agent");
}

/**
 * Assert thread structure is valid
 */
export function assertThreadStructure(threadBody: ThreadBody, threadId: string): void {
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
  expectations?: ProviderExpectations
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

  if (expectations?.expectedProviderId) {
    expect(run.provider_id).toBe(expectations.expectedProviderId);
  }
  if (expectations?.expectedModelId) {
    expect(run.model_id).toBe(expectations.expectedModelId);
  }
}

/**
 * Assert function_call items have required fields
 */
export function assertFunctionCallItems(items: OutputItemData[], minCount: number = 2): void {
  const functionCalls = items.filter((i) => i.type === "function_call");
  expect(functionCalls.length).toBeGreaterThanOrEqual(minCount);

  for (const item of functionCalls) {
    expect(item.name).toBeDefined();
    expect(typeof item.name).toBe("string");
    expect(item.name!.length).toBeGreaterThan(0);
    expect(item.call_id).toBeDefined();
    expect(typeof item.call_id).toBe("string");
    expect(item.call_id!.length).toBeGreaterThan(0);
    expect(item.arguments).toBeDefined();
    expect(typeof item.arguments).toBe("string");
  }
}

/**
 * Assert function_call/function_call_output pairs match by call_id
 */
export function assertFunctionCallPairs(outputItems: OutputItemData[]): void {
  const functionCalls = outputItems.filter((i) => i.type === "function_call");
  const functionOutputs = outputItems.filter((i) => i.type === "function_call_output");

  expect(functionOutputs.length).toBeGreaterThanOrEqual(functionCalls.length);

  for (const call of functionCalls) {
    expect(call.call_id).toBeDefined();
    const matchingOutput = functionOutputs.find(
      (output) => output.call_id === call.call_id
    );
    expect(matchingOutput).toBeDefined();
    if (!matchingOutput) {
      throw new Error(`No matching function_call_output for call_id: ${call.call_id}`);
    }
    expect(matchingOutput.success).toBeDefined();
    expect(typeof matchingOutput.success).toBe("boolean");
  }
}

/**
 * Assert and return agent message from output items
 */
export function assertAgentMessage(items: OutputItemData[]): OutputItemData {
  const messageItems = items.filter((i) => i.type === "message");
  expect(messageItems.length).toBeGreaterThanOrEqual(1);

  const agentMessage = messageItems.find((i) => i.origin === "agent");
  expect(agentMessage).toBeDefined();
  if (!agentMessage) throw new Error("agentMessage is undefined");

  expect(agentMessage.content).toBeDefined();
  expect(typeof agentMessage.content).toBe("string");
  expect(agentMessage.content!.length).toBeGreaterThan(0);
  expect(agentMessage.id).toBeDefined();

  return agentMessage;
}

/**
 * Assert reasoning items have content
 */
export function assertReasoningItems(items: OutputItemData[], minCount: number = 1): void {
  const reasoningItems = items.filter((i) => i.type === "reasoning");
  expect(reasoningItems.length).toBeGreaterThanOrEqual(minCount);

  for (const item of reasoningItems) {
    expect(item.content).toBeDefined();
    expect(typeof item.content).toBe("string");
    expect(item.content!.length).toBeGreaterThan(0);
  }
}

/**
 * Assert usage is present and valid
 */
export function assertUsage(usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined, required: boolean = true): void {
  if (required) {
    expect(usage).toBeDefined();
    expect(usage!.total_tokens).toBeGreaterThan(0);
    expect(usage!.prompt_tokens).toBeGreaterThanOrEqual(0);
    expect(usage!.completion_tokens).toBeGreaterThanOrEqual(0);
  } else if (usage) {
    expect(usage.total_tokens).toBeGreaterThan(0);
    expect(usage.prompt_tokens).toBeGreaterThanOrEqual(0);
    expect(usage.completion_tokens).toBeGreaterThanOrEqual(0);
  }
}
```

### Phase 4: Implement persistence utilities

**File: `test-utils/persistence.ts`**

```typescript
import { expect } from "bun:test";
import type { ThreadBody } from "./types";
import { BASE_URL, DEFAULT_PERSISTENCE_TIMEOUT, DEFAULT_RETRY_INTERVAL } from "./index";

export interface WaitForPersistenceOptions {
  expectedRunCount?: number;
  timeoutMs?: number;
  retryIntervalMs?: number;
}

/**
 * Poll thread endpoint until run(s) reach terminal status
 */
export async function waitForPersistence(
  threadId: string,
  options: WaitForPersistenceOptions = {},
  baseUrl: string = BASE_URL
): Promise<ThreadBody> {
  const {
    expectedRunCount = 1,
    timeoutMs = DEFAULT_PERSISTENCE_TIMEOUT,
    retryIntervalMs = DEFAULT_RETRY_INTERVAL,
  } = options;

  const startTime = Date.now();
  let threadBody: ThreadBody = {
    thread: {} as ThreadBody["thread"],
    runs: [],
  };

  while (true) {
    const threadRes = await fetch(`${baseUrl}/api/v2/threads/${threadId}`);
    expect(threadRes.status).toBe(200);
    threadBody = (await threadRes.json()) as ThreadBody;

    if (threadBody.runs.length >= expectedRunCount) {
      const allComplete = threadBody.runs.every(
        (run) =>
          run.status === "complete" ||
          run.status === "error" ||
          run.status === "aborted"
      );
      if (allComplete) {
        break;
      }
    }

    if (Date.now() - startTime > timeoutMs) {
      const statuses = threadBody.runs.map((r) => r.status).join(", ");
      throw new Error(
        `Timeout waiting for run persistence. Thread has ${threadBody.runs.length} runs with statuses: ${statuses || "no runs found"}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
  }

  return threadBody;
}
```

### Phase 5: Implement comparison utilities

**File: `test-utils/compare.ts`**

```typescript
import { expect } from "bun:test";
import type { ResponseReducer } from "../../../src/core/reducer";
import type { RunData, OutputItemData } from "./types";

type HydratedResponse = NonNullable<ReturnType<ResponseReducer["snapshot"]>>;
type HydratedOutputItem = HydratedResponse["output_items"][number];

/**
 * Compare response-level fields between hydrated and persisted
 */
export function compareResponseToRun(
  hydratedResponse: HydratedResponse,
  persistedRun: RunData
): void {
  expect(hydratedResponse.id).toBe(persistedRun.id);
  expect(hydratedResponse.turn_id).toBe(persistedRun.turn_id);
  expect(hydratedResponse.thread_id).toBe(persistedRun.thread_id);
  expect(hydratedResponse.model_id).toBe(persistedRun.model_id);
  expect(hydratedResponse.provider_id).toBe(persistedRun.provider_id);
  expect(hydratedResponse.status).toBe(persistedRun.status);
  expect(hydratedResponse.finish_reason).toBe(persistedRun.finish_reason);
  expect(hydratedResponse.output_items.length).toBe(persistedRun.output_items.length);
}

/**
 * Compare output items between hydrated and persisted
 */
export function compareOutputItems(
  hydratedItems: HydratedOutputItem[],
  persistedItems: OutputItemData[]
): void {
  expect(hydratedItems.length).toBe(persistedItems.length);

  for (let i = 0; i < hydratedItems.length; i++) {
    const hydratedItem = hydratedItems[i];
    const persistedItem = persistedItems[i];

    expect(hydratedItem.id).toBe(persistedItem.id);
    expect(hydratedItem.type).toBe(persistedItem.type);

    if (hydratedItem.type === "message" && persistedItem.type === "message") {
      const hydratedContent = "content" in hydratedItem ? hydratedItem.content : undefined;
      const hydratedOrigin = "origin" in hydratedItem ? hydratedItem.origin : undefined;
      expect(hydratedContent).toBe(persistedItem.content);
      expect(hydratedOrigin).toBe(persistedItem.origin as typeof hydratedOrigin);
    }

    if (hydratedItem.type === "function_call" && persistedItem.type === "function_call") {
      const hydratedName = "name" in hydratedItem ? hydratedItem.name : undefined;
      const hydratedCallId = "call_id" in hydratedItem ? hydratedItem.call_id : undefined;
      const hydratedArguments = "arguments" in hydratedItem ? hydratedItem.arguments : undefined;
      const hydratedOrigin = "origin" in hydratedItem ? hydratedItem.origin : undefined;
      expect(hydratedName).toBe(persistedItem.name);
      expect(hydratedCallId).toBe(persistedItem.call_id);
      expect(hydratedArguments).toBe(persistedItem.arguments);
      expect(hydratedOrigin).toBe(persistedItem.origin as typeof hydratedOrigin);
    }

    if (hydratedItem.type === "function_call_output" && persistedItem.type === "function_call_output") {
      const hydratedCallId = "call_id" in hydratedItem ? hydratedItem.call_id : undefined;
      const hydratedOutput = "output" in hydratedItem ? hydratedItem.output : undefined;
      const hydratedSuccess = "success" in hydratedItem ? hydratedItem.success : undefined;
      const hydratedOrigin = "origin" in hydratedItem ? hydratedItem.origin : undefined;
      expect(hydratedCallId).toBe(persistedItem.call_id);
      expect(hydratedOutput).toBe(persistedItem.output);
      expect(hydratedSuccess).toBe(persistedItem.success);
      expect(hydratedOrigin).toBe(persistedItem.origin as typeof hydratedOrigin);
    }

    if (hydratedItem.type === "reasoning" && persistedItem.type === "reasoning") {
      const hydratedContent = "content" in hydratedItem ? hydratedItem.content : undefined;
      const hydratedOrigin = "origin" in hydratedItem ? hydratedItem.origin : undefined;
      expect(hydratedContent).toBe(persistedItem.content);
      expect(hydratedOrigin).toBe(persistedItem.origin as typeof hydratedOrigin);
    }
  }
}

/**
 * Compare usage between hydrated and persisted
 */
export function compareUsage(
  hydratedUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined,
  persistedUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined,
  required: boolean = true
): void {
  if (required) {
    expect(hydratedUsage).toBeDefined();
    expect(persistedUsage).toBeDefined();
    expect(hydratedUsage!.prompt_tokens).toBe(persistedUsage!.prompt_tokens);
    expect(hydratedUsage!.completion_tokens).toBe(persistedUsage!.completion_tokens);
    expect(hydratedUsage!.total_tokens).toBe(persistedUsage!.total_tokens);
  } else if (hydratedUsage && persistedUsage) {
    expect(hydratedUsage.prompt_tokens).toBe(persistedUsage.prompt_tokens);
    expect(hydratedUsage.completion_tokens).toBe(persistedUsage.completion_tokens);
    expect(hydratedUsage.total_tokens).toBe(persistedUsage.total_tokens);
  }
}
```

---

## GATE 1: Utilities compile

After creating all utility files:

```bash
cd cody-fastify && bun run typecheck
```

**STOP. Do not proceed until typecheck passes.**

---

### Phase 6: Refactor openai-prompts.test.ts

Transform each test to use utilities. Here's the pattern for the "simple" test:

**BEFORE (~390 lines):**
```typescript
test.concurrent("submit prompt, stream response, verify thread persistence", async () => {
  // 390 lines of code
});
```

**AFTER (~40 lines):**
```typescript
test.concurrent("submit prompt, stream response, verify thread persistence", async () => {
  // Phase 1: Submit and stream
  const { events, threadId, hydratedResponse, runId } = await submitAndStream({
    prompt: "hi cody",
    model: "gpt-5.1-codex-mini",
  });

  // Phase 2: Assert stream events
  expect(events.length).toBeGreaterThan(1);
  expect(events.length).toBeLessThan(200);

  assertResponseStart(events[0]);
  assertThreadId(threadId);
  assertItemStarts(events, "message");
  assertItemDones(events, "message");
  assertMessageDone(events);
  assertResponseDone(events[events.length - 1]);
  assertEventEnvelopes(events, runId);

  // Phase 3: Validate persistence
  const threadBody = await waitForPersistence(threadId);
  assertThreadStructure(threadBody, threadId);
  expect(threadBody.runs.length).toBe(1);

  const run = threadBody.runs[0];
  assertRunFields(run, threadId);
  assertAgentMessage(run.output_items);
  assertUsage(run.usage);

  // Phase 4: Compare hydrated vs persisted
  compareResponseToRun(hydratedResponse, run);
  compareOutputItems(hydratedResponse.output_items, run.output_items);
  compareUsage(hydratedResponse.usage, run.usage);
});
```

Apply similar patterns to:
- "tool calls: pwd and ls" - add `assertFunctionCallItems()`, `assertFunctionCallPairs()`
- "multi-turn conversation" - use loop with `submitAndStream()`, `waitForPersistence(..., { expectedRunCount: 3 })`
- "reasoning" - add `assertReasoningItems()`

**Remove all 4 ThreadBody type definitions** - they're now imported from test-utils.

---

## GATE 2: OpenAI tests pass

```bash
cd cody-fastify && bun run test:tdd-api
```

Verify all 4 OpenAI tests pass before proceeding.

**STOP. Do not proceed until all OpenAI tests pass.**

---

### Phase 7: Refactor anthropic-prompts.test.ts

Same pattern as OpenAI with provider-specific options:

```typescript
const ANTHROPIC_CONFIG: ProviderExpectations = {
  expectedProviderId: "anthropic",
  expectedModelId: "claude-haiku-4-5",
};

test.concurrent("submit prompt...", async () => {
  const { events, threadId, hydratedResponse, runId } = await submitAndStream({
    prompt: "hi cody",
    providerId: "anthropic",
    model: "claude-haiku-4-5",
  });

  assertResponseStart(events[0], ANTHROPIC_CONFIG);
  // ... rest of assertions
  assertRunFields(run, threadId, ANTHROPIC_CONFIG);
  // Usage is optional for Anthropic
  assertUsage(run.usage, false);
  compareUsage(hydratedResponse.usage, run.usage, false);
});
```

**Remove all 4 ThreadBody type definitions** from this file as well.

---

## GATE 3: All tests pass

```bash
cd cody-fastify && bun run test:tdd-api
```

**STOP. Verify all 8 tests pass.**

---

### Phase 8: Final verification

Run sequentially:
1. `bun run format`
2. `bun run lint`
3. `bun run typecheck`

If any command produces changes or errors, fix and re-run ALL from the beginning.

---

## TECHNICAL STANDARDS

- Strong types throughout (no `any`)
- Preserve exact assertion logic from original tests
- Utilities should be generic enough for both providers
- Keep test intent clear - utilities reduce boilerplate, not readability
- Each test should still clearly show what it's testing

---

## DEFINITION OF DONE

- [ ] `test-utils/` directory created with 6 files
- [ ] All utility functions implemented
- [ ] ThreadBody type removed from test files (8 instances)
- [ ] openai-prompts.test.ts refactored (~300 lines target)
- [ ] anthropic-prompts.test.ts refactored (~320 lines target)
- [ ] All 8 tests pass
- [ ] format, lint, typecheck pass sequentially with no changes

---

## OUTPUT FORMAT

```
## Summary
[What was accomplished]

## Files Created
- test-utils/index.ts
- test-utils/types.ts
- test-utils/submit.ts
- test-utils/assertions.ts
- test-utils/persistence.ts
- test-utils/compare.ts

## Files Modified
- openai-prompts.test.ts: [old lines] → [new lines]
- anthropic-prompts.test.ts: [old lines] → [new lines]

## Line Count
- Total test files: [X] lines (down from ~3823)
- Total utilities: [Y] lines
- Net reduction: [Z] lines

## Test Results
[bun run test:tdd-api output]

## Verification
- [ ] format: passed
- [ ] lint: passed
- [ ] typecheck: passed
```
