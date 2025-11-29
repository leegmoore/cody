# Technical Specification: TDD Test Utilities Extraction

**Project:** 007-tdd-test-util
**Created:** 2025-11-28
**Status:** Draft

---

## 1. Overview

Extract duplicated code from `openai-prompts.test.ts` and `anthropic-prompts.test.ts` into shared test utilities. Both files have ~1900 lines each with massive duplication. The goal is to create reusable utilities that reduce test boilerplate while maintaining test clarity.

---

## 2. Analysis Summary

### 2.1 Files Analyzed

| File | Lines | Tests |
|------|-------|-------|
| `openai-prompts.test.ts` | 1841 | 4 (simple, tool-calls, multi-turn, reasoning) |
| `anthropic-prompts.test.ts` | 1982 | 4 (simple, tool-calls, multi-turn, extended-thinking) |

### 2.2 Identified Duplication Categories

| Category | Description | Approximate Lines Per Instance |
|----------|-------------|-------------------------------|
| ThreadBody type | Identical type definition | ~45 lines |
| Stream collection loop | SSE parsing, event collection | ~50 lines |
| Submit request | POST to /api/v2/submit | ~15 lines |
| Response start assertions | First event validation | ~15 lines |
| Envelope field assertions | event_id, timestamp, trace_context | ~8 lines |
| Persistence polling | Wait for run completion | ~40 lines |
| Thread assertions | Thread structure validation | ~15 lines |
| Run assertions | Run field validation | ~20 lines |
| Output item comparison | Hydrated vs persisted | ~60 lines |
| Usage comparison | Token counts | ~10 lines |

### 2.3 Provider-Specific Differences

| Aspect | OpenAI | Anthropic | Treatment |
|--------|--------|-----------|-----------|
| Submit body | `model: "gpt-5.1-codex-mini"` | `providerId: "anthropic", model: "claude-haiku-4-5"` | Parameter in utility |
| Reasoning param | `reasoningEffort: "low"` | `thinkingBudget: 4096` | Separate params |
| Provider assertions | `expect(provider_id).toBe("openai")` (not present) | `expect(provider_id).toBe("anthropic")` | Optional param |
| Model assertions | `expect(model_id).toBe("gpt-5.1-codex-mini")` (not present) | `expect(model_id).toBe("claude-haiku-4-5")` | Optional param |
| Usage handling | Always present | `if (run.usage)` conditional | Handle in utility |
| usage_update events | Not mentioned | Explicitly captured | Both handle via reducer |

---

## 3. Proposed Utility Functions

### 3.1 Types

**File:** `test-suites/tdd-api/test-utils/types.ts`

```typescript
// ThreadBody - identical in both files, extract once
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
  type: "message" | "reasoning" | "function_call" | "function_call_output" | "error" | "cancelled" | "script_execution" | "script_execution_output";
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
  reasoningEffort?: "low" | "medium" | "high";  // OpenAI
  thinkingBudget?: number;  // Anthropic
};

export type StreamResult = {
  events: StreamEvent[];
  threadId: string;
  hydratedResponse: NonNullable<ReturnType<ResponseReducer["snapshot"]>>;
  runId: string;
};

export type ProviderConfig = {
  providerId?: string;
  model: string;
  expectedProviderId?: string;  // For assertions
  expectedModelId?: string;     // For assertions
};
```

### 3.2 Submit and Stream

**File:** `test-suites/tdd-api/test-utils/submit.ts`

```typescript
/**
 * Submit a prompt to the API
 * Returns runId after validating response
 */
export async function submitPrompt(
  baseUrl: string,
  options: SubmitOptions
): Promise<string>;

/**
 * Stream events for a run and collect them
 * Returns events array, threadId, and hydrated response
 */
export async function streamAndCollect(
  baseUrl: string,
  runId: string,
  timeoutMs?: number  // default 15000
): Promise<StreamResult>;

/**
 * Combined submit + stream for convenience
 */
export async function submitAndStream(
  baseUrl: string,
  options: SubmitOptions,
  timeoutMs?: number
): Promise<StreamResult>;
```

### 3.3 Assertions

**File:** `test-suites/tdd-api/test-utils/assertions.ts`

```typescript
/**
 * Assert submit response is valid
 * - status 202
 * - runId is UUID format
 */
export function assertSubmitResponse(response: Response, body: { runId: string }): void;

/**
 * Assert response_start event is valid
 * - Has required fields (response_id, turn_id, thread_id, model_id, provider_id, created_at)
 * - Optional: validate provider_id and model_id match expected
 */
export function assertResponseStart(
  event: StreamEvent,
  options?: { expectedProviderId?: string; expectedModelId?: string }
): void;

/**
 * Assert all events have required envelope fields
 * - event_id, timestamp, run_id, trace_context.traceparent
 */
export function assertEventEnvelopes(events: StreamEvent[], runId: string): void;

/**
 * Assert response_done event is valid
 * - status is "complete"
 * - response_id is present
 */
export function assertResponseDone(event: StreamEvent): void;

/**
 * Assert item_start events exist for a given item_type
 */
export function assertItemStarts(
  events: StreamEvent[],
  itemType: string,
  minCount?: number
): void;

/**
 * Assert item_done events exist with final_item of given type
 */
export function assertItemDones(
  events: StreamEvent[],
  itemType: string,
  minCount?: number
): StreamEvent[];

/**
 * Assert thread structure is valid
 */
export function assertThreadStructure(
  threadBody: ThreadBody,
  threadId: string
): void;

/**
 * Assert run fields are valid
 * - Includes optional provider/model assertions
 */
export function assertRunFields(
  run: RunData,
  threadId: string,
  options?: { expectedProviderId?: string; expectedModelId?: string }
): void;

/**
 * Assert function_call items have required fields
 */
export function assertFunctionCallItems(
  items: OutputItemData[],
  minCount?: number
): void;

/**
 * Assert function_call/function_call_output pairs match by call_id
 */
export function assertFunctionCallPairs(
  outputItems: OutputItemData[]
): void;

/**
 * Assert message output item is valid
 */
export function assertAgentMessage(items: OutputItemData[]): OutputItemData;

/**
 * Assert reasoning items have content
 */
export function assertReasoningItems(items: OutputItemData[], minCount?: number): void;
```

### 3.4 Persistence

**File:** `test-suites/tdd-api/test-utils/persistence.ts`

```typescript
/**
 * Poll thread endpoint until run(s) reach terminal status
 * - Handles timeout with descriptive error
 * - Returns populated ThreadBody
 */
export async function waitForPersistence(
  baseUrl: string,
  threadId: string,
  options?: {
    expectedRunCount?: number;  // default 1
    timeoutMs?: number;         // default 10000
    retryIntervalMs?: number;   // default 50
  }
): Promise<ThreadBody>;
```

### 3.5 Comparison

**File:** `test-suites/tdd-api/test-utils/compare.ts`

```typescript
/**
 * Compare hydrated response to persisted run
 * - Response-level fields (id, turn_id, thread_id, model_id, provider_id, status, finish_reason)
 * - Output items count
 */
export function compareResponseToRun(
  hydratedResponse: NonNullable<ReturnType<ResponseReducer["snapshot"]>>,
  persistedRun: RunData
): void;

/**
 * Compare output items (hydrated vs persisted)
 * - Handles message, function_call, function_call_output, reasoning types
 * - Compares all relevant fields per type
 */
export function compareOutputItems(
  hydratedItems: OutputItem[],
  persistedItems: OutputItemData[]
): void;

/**
 * Compare usage (with optional handling for missing data)
 */
export function compareUsage(
  hydratedUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined,
  persistedUsage: UsageData | undefined,
  required?: boolean  // default true for OpenAI, false for Anthropic
): void;
```

### 3.6 Index Export

**File:** `test-suites/tdd-api/test-utils/index.ts`

```typescript
export * from './types';
export * from './submit';
export * from './assertions';
export * from './persistence';
export * from './compare';

// Constants
export const BASE_URL = "http://localhost:4010";
export const DEFAULT_STREAM_TIMEOUT = 15000;
export const DEFAULT_PERSISTENCE_TIMEOUT = 10000;
export const DEFAULT_RETRY_INTERVAL = 50;
```

---

## 4. Refactoring Map

### 4.1 openai-prompts.test.ts

| Lines | Current Code | Replace With |
|-------|--------------|--------------|
| 6 | `const BASE_URL = ...` | `import { BASE_URL } from './test-utils'` |
| 212-256 | ThreadBody type definition | `import { ThreadBody } from './test-utils'` |
| 19-32 | Submit and assert | `submitPrompt(BASE_URL, { prompt, model })` |
| 37-98 | Stream collection loop | `streamAndCollect(BASE_URL, runId)` |
| 100-124 | Response start assertions | `assertResponseStart(events[0])` |
| 127-146 | Item start assertions | `assertItemStarts(events, 'message')` |
| 149-173 | Item done assertions | `assertItemDones(events, 'message')` |
| 176-191 | Response done + envelope | `assertResponseDone(lastEvent); assertEventEnvelopes(events, runId)` |
| 208-294 | Persistence polling | `waitForPersistence(BASE_URL, threadId)` |
| 296-306 | Thread assertions | `assertThreadStructure(threadBody, threadId)` |
| 311-356 | Run assertions | `assertRunFields(run, threadId)` |
| 360-399 | Compare hydrated vs persisted | `compareResponseToRun(hydratedResponse, run); compareOutputItems(...)` |
| 636-680 | ThreadBody (repeated) | Remove - use imported type |
| 911-955 | ThreadBody (repeated) | Remove - use imported type |
| 1638-1682 | ThreadBody (repeated) | Remove - use imported type |

**Specific test refactors:**

1. **simple test (lines 13-401):**
   - Extract submit/stream to `submitAndStream()`
   - Use assertion helpers for all phases
   - Reduce from ~390 lines to ~50 lines

2. **tool calls test (lines 403-906):**
   - Same pattern as simple
   - Add `assertFunctionCallItems()` and `assertFunctionCallPairs()`
   - Reduce from ~500 lines to ~80 lines

3. **multi-turn test (lines 908-1421):**
   - Extract `submitAndStream` helper (already partially done in test)
   - Use `waitForPersistence(..., { expectedRunCount: 3 })`
   - Reduce from ~510 lines to ~100 lines

4. **reasoning test (lines 1423-1840):**
   - Same pattern with `assertReasoningItems()`
   - Reduce from ~420 lines to ~70 lines

### 4.2 anthropic-prompts.test.ts

Same patterns, with these differences:

| Aspect | OpenAI | Anthropic Change |
|--------|--------|------------------|
| Provider config | `{ model: "gpt-5.1-codex-mini" }` | `{ providerId: "anthropic", model: "claude-haiku-4-5" }` |
| Provider assertions | None | `{ expectedProviderId: "anthropic", expectedModelId: "claude-haiku-4-5" }` |
| Usage assertions | Required | `compareUsage(..., required: false)` |
| Reasoning parameter | `reasoningEffort: "low"` | `thinkingBudget: 4096` |

**Lines to change (same pattern as OpenAI):**

- Lines 227-271: ThreadBody type → import
- Lines 676-720: ThreadBody type (repeated) → remove
- Lines 967-1011: ThreadBody type (repeated) → remove
- Lines 1760-1804: ThreadBody type (repeated) → remove

**Provider-specific assertions (add to all Anthropic tests):**

```typescript
// In response_start assertions
assertResponseStart(events[0], {
  expectedProviderId: "anthropic",
  expectedModelId: "claude-haiku-4-5"
});

// In run assertions
assertRunFields(run, threadId, {
  expectedProviderId: "anthropic",
  expectedModelId: "claude-haiku-4-5"
});
```

---

## 5. File Structure After Refactor

```
test-suites/tdd-api/
├── validate-env.ts          # Unchanged
├── openai-prompts.test.ts   # ~300 lines (down from 1841)
├── anthropic-prompts.test.ts # ~320 lines (down from 1982)
└── test-utils/
    ├── index.ts             # ~20 lines - exports and constants
    ├── types.ts             # ~60 lines - shared types
    ├── submit.ts            # ~80 lines - submit/stream helpers
    ├── assertions.ts        # ~200 lines - assertion helpers
    ├── persistence.ts       # ~50 lines - polling helpers
    └── compare.ts           # ~100 lines - comparison helpers
```

**Total utilities:** ~510 lines
**Total test files:** ~620 lines (down from ~3823 lines)
**Net reduction:** ~2700 lines

---

## 6. Coder Workflow

### Phase 1: Create test-utils directory and types

1. Create `test-suites/tdd-api/test-utils/` directory
2. Create `types.ts` with ThreadBody, RunData, OutputItemData, UsageData, SubmitOptions, StreamResult, ProviderConfig
3. Create `index.ts` with exports and constants

**GATE 1:** Existing tests still pass (no code changes to test files yet)

### Phase 2: Implement submit utilities

1. Create `submit.ts` with `submitPrompt()`, `streamAndCollect()`, `submitAndStream()`
2. Ensure they work with both OpenAI and Anthropic submit body formats

**GATE 2:** Write a simple manual test to verify utilities work

### Phase 3: Implement assertion utilities

1. Create `assertions.ts` with all assertion functions
2. Each function should mirror the assertion patterns in the existing tests

**GATE 3:** Utilities compile without type errors

### Phase 4: Implement persistence and comparison utilities

1. Create `persistence.ts` with `waitForPersistence()`
2. Create `compare.ts` with comparison functions

**GATE 4:** All utilities compile and export properly

### Phase 5: Refactor openai-prompts.test.ts

1. Add imports from test-utils
2. Remove ThreadBody type definitions (4 instances)
3. Refactor "simple" test first
4. Run tests - verify passing
5. Refactor "tool calls" test
6. Run tests - verify passing
7. Refactor "multi-turn" test
8. Run tests - verify passing
9. Refactor "reasoning" test
10. Run tests - verify passing

**GATE 5:** All 4 OpenAI tests pass with refactored code

### Phase 6: Refactor anthropic-prompts.test.ts

Same pattern as Phase 5 with provider-specific options

**GATE 6:** All 4 Anthropic tests pass with refactored code

### Phase 7: Final verification

1. Run `bun run test:tdd-api` - all 8 tests pass
2. Run format, lint, typecheck sequentially
3. Verify no changes needed after format

---

## 7. Definition of Done

- [ ] `test-utils/` directory created with 6 files
- [ ] All utility functions implemented with proper types
- [ ] ThreadBody type definition removed from test files (8 instances total)
- [ ] openai-prompts.test.ts refactored to use utilities
- [ ] anthropic-prompts.test.ts refactored to use utilities
- [ ] All 8 tests pass
- [ ] format, lint, typecheck pass sequentially with no changes
- [ ] Line count reduction achieved (target: test files < 700 lines total)

---

## 8. File Deliverables

**New files:**
- `test-suites/tdd-api/test-utils/index.ts`
- `test-suites/tdd-api/test-utils/types.ts`
- `test-suites/tdd-api/test-utils/submit.ts`
- `test-suites/tdd-api/test-utils/assertions.ts`
- `test-suites/tdd-api/test-utils/persistence.ts`
- `test-suites/tdd-api/test-utils/compare.ts`

**Modified files:**
- `test-suites/tdd-api/openai-prompts.test.ts` (major refactor)
- `test-suites/tdd-api/anthropic-prompts.test.ts` (major refactor)

---

## 9. References

- `openai-prompts.test.ts` - Source for OpenAI patterns
- `anthropic-prompts.test.ts` - Source for Anthropic patterns
- `src/core/schema.ts` - StreamEvent types
- `src/core/reducer.ts` - ResponseReducer type
