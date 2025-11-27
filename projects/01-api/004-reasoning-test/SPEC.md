# Technical Specification: Reasoning Configuration & Test

**Project:** 004-reasoning-test
**Created:** 2025-11-26
**Status:** Draft

---

## 1. Overview

**Purpose:** Add configurable reasoning effort to the submit API, then create a test that validates reasoning/thinking output is correctly streamed and persisted.

**Primary Function:**
1. Make reasoning effort optional and configurable via `/api/v2/submit`
2. Remove hardcoded `reasoning: { effort: "medium" }` from OpenAI adapter
3. Add a reasoning test that uses `reasoningEffort: "low"` with a puzzle prompt

**Location:**
```
cody-fastify/
  src/
    api/routes/submit.ts           # Add reasoningEffort to schema
    core/model-factory.ts          # Add to StreamAdapterParams interface
    core/adapters/openai-adapter.ts # Conditional reasoning block
  test-suites/
    tdd-api/
      README.md                    # Suite documentation (update)
      openai-prompts.test.ts       # Add reasoning test
```

**Script:**
```json
"test:tdd-api": "bun test test-suites/tdd-api/ --timeout 20000"
```

---

## 2. Core Principles

```
NO MOCKS.
NO SHIMS.
NO SPECIAL CONFIG OVERRIDES.
NO TEST INJECTIONS.

Full integration of real infrastructure.
Changes require EXPLICIT user approval after discussion.
```

These tests exercise the complete system:
- Real Redis
- Real Convex
- Real LLM APIs (OpenAI)
- Real HTTP endpoints

---

## 3. Prerequisites

*Already in place:*

1. Redis configured and running
2. Convex configured and running
3. OpenAI API accessible
4. Fastify Server running on port 4010
5. `openai-prompts.test.ts` with existing tests (simple-prompt, tool-calls, multi-turn)

**The test suite validates each of these before running via `validate-env.ts`.**

---

## 4. Technology Stack

| Component | Version | Notes |
|-----------|---------|-------|
| Bun | 1.3.3 | Runtime and test runner |
| bun:test | built-in | Jest-compatible API |
| ioredis | ^5.8.2 | Redis connectivity check |

**Test timeout:** 20 seconds (runner level)

---

## 5. Phase 1: API Changes (Reasoning Configuration)

### 5.1 Problem Statement

Currently, `openai-adapter.ts:192` has:
```typescript
reasoning: { effort: "medium" }
```

This means:
- Every OpenAI request triggers medium-effort reasoning (slower)
- No way to disable reasoning for simple prompts
- No way to request "low" or "high" effort
- No reasoning summaries returned (`summary: "auto"` not set)

### 5.2 Solution

Make reasoning opt-in via the submit endpoint:
- When `reasoningEffort` is NOT provided: No reasoning (faster)
- When `reasoningEffort` IS provided: Add `reasoning: { effort: <value>, summary: "auto" }`

### 5.3 Code Changes

**File 1: `src/api/routes/submit.ts`**

Add to SubmitBody schema:
```typescript
const SubmitBody = z.object({
  prompt: z.string().min(1, "prompt cannot be empty"),
  model: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),  // ADD
  runId: z.string().uuid().optional(),
  turnId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
});
```

Pass to adapter stream call:
```typescript
await adapter.stream({
  prompt: body.prompt,
  runId,
  turnId,
  threadId,
  agentId: body.agentId,
  traceContext,
  tools: toolSpecs,
  reasoningEffort: body.reasoningEffort,  // ADD
});
```

**File 2: `src/core/model-factory.ts`**

Add to StreamAdapterParams interface:
```typescript
export interface StreamAdapterParams {
  prompt: string;
  runId?: string;
  turnId?: string;
  threadId?: string;
  agentId?: string;
  traceContext?: TraceContext;
  tools?: ToolSpec[];
  reasoningEffort?: "low" | "medium" | "high";  // ADD
}
```

**File 3: `src/core/adapters/openai-adapter.ts`**

Change request body construction (around line 188-195):

FROM:
```typescript
const reqBody = {
  model: this.model,
  input: options.conversation,
  stream: true,
  reasoning: { effort: "medium" },  // HARDCODED
  tools: options.formattedTools,
  tool_choice: options.formattedTools ? "auto" : undefined,
};
```

TO:
```typescript
const reqBody = {
  model: this.model,
  input: options.conversation,
  stream: true,
  ...(options.reasoningEffort && {
    reasoning: { effort: options.reasoningEffort, summary: "auto" }
  }),
  tools: options.formattedTools,
  tool_choice: options.formattedTools ? "auto" : undefined,
};
```

### 5.4 Verification: Existing Tests

After making changes, run existing tests:
```bash
bun run test:tdd-api
```

**Expected outcomes:**
- All 3 existing tests still pass (simple-prompt, tool-calls, multi-turn)
- Tests should run FASTER (no longer forcing reasoning on every request)
- Note the timing before/after for comparison

**If tests fail:** This is a regression - fix before proceeding to Phase 2.

---

## 6. Phase 2: Reasoning Test

### 6.1 Test Case

Submit a puzzle prompt with `reasoningEffort: "low"`, verify reasoning output items are streamed and persisted correctly.

**Characteristics:**
- Single turn
- Reasoning enabled (`reasoningEffort: "low"`)
- Puzzle prompt requiring thought
- Expected: 1+ reasoning output items, 1 message output item
- No tool calls

### 6.2 Prompt

```
Solve the puzzle and reply with only the final number.

PUZZLE: I am a 2-digit number. My digits are different. The sum of my digits is 11. If you reverse my digits, the number increases by 27. What number am I?
```

**Expected answer:** 47 (digits 4+7=11, reverse is 74, 74-47=27)

### 6.3 Test Flow

```
PHASE 1: Submit with reasoning
  POST /api/v2/submit {
    prompt: "<puzzle>",
    reasoningEffort: "low"
  }
  → Assert 202 response with valid UUID runId
  → Capture threadId from response_start event

PHASE 2: Stream and collect
  GET /api/v2/stream/:runId (SSE)
  → Collect events until response_done
  → Assert reasoning events received (item_start/item_delta/item_done with type "reasoning")
  → Assert message events received
  → Hydrate using ResponseReducer

PHASE 3: Validate hydrated response
  → Assert output_items contains at least 1 reasoning item
  → Assert output_items contains at least 1 message item
  → Assert reasoning item has content (not empty)
  → Assert message item contains the answer (should include "47")

PHASE 4: Validate persistence
  Poll GET /api/v2/runs/:runId until complete
  → Assert run exists
  → Assert status "complete"
  → Assert output_items contains reasoning item(s)
  → Assert output_items contains message item(s)

PHASE 5: Compare hydrated vs persisted
  → Field-by-field comparison (see section 6.5)
```

### 6.4 Assertions Summary

**Streaming Phase:**
| Assertion | Criteria |
|-----------|----------|
| Submit response | 202 status |
| runId | Valid UUID |
| response_start | Event received |
| item_start (reasoning) | At least 1 |
| item_done (reasoning) | At least 1 |
| item_start (message) | At least 1 |
| item_done (message) | At least 1 |
| response_done | Event received, status "complete" |
| No function_call items | count == 0 |

**Hydrated Response:**
| Assertion | Criteria |
|-----------|----------|
| output_items reasoning | count >= 1 |
| output_items message | count >= 1 |
| reasoning content | Non-empty string |
| message content | Contains expected answer |

**Persistence Phase:**
| Assertion | Criteria |
|-----------|----------|
| Run exists | runId matches |
| Status | "complete" |
| output_items reasoning | count >= 1 |
| output_items message | count >= 1 |

### 6.5 Hydrated vs Persisted Comparison (Detailed)

Compare the hydrated response (from ResponseReducer) to the persisted run (from GET /api/v2/runs/:runId). Exclude timestamp fields (created_at, updated_at).

**Response-level fields to compare:**
```typescript
expect(hydratedResponse.id).toBe(persistedRun.id);
expect(hydratedResponse.turn_id).toBe(persistedRun.turn_id);
expect(hydratedResponse.thread_id).toBe(persistedRun.thread_id);
expect(hydratedResponse.model_id).toBe(persistedRun.model_id);
expect(hydratedResponse.provider_id).toBe(persistedRun.provider_id);
expect(hydratedResponse.status).toBe(persistedRun.status);
expect(hydratedResponse.finish_reason).toBe(persistedRun.finish_reason);
expect(hydratedResponse.output_items.length).toBe(persistedRun.output_items.length);
```

**For each output_item, compare by type:**
```typescript
for (let i = 0; i < hydratedResponse.output_items.length; i++) {
  const hydratedItem = hydratedResponse.output_items[i];
  const persistedItem = persistedRun.output_items[i];

  // Common fields for all output item types
  expect(hydratedItem.id).toBe(persistedItem.id);
  expect(hydratedItem.type).toBe(persistedItem.type);

  // Type-specific fields
  if (hydratedItem.type === "message") {
    expect(hydratedItem.content).toBe(persistedItem.content);
    expect(hydratedItem.origin).toBe(persistedItem.origin);
  }

  if (hydratedItem.type === "reasoning") {
    expect(hydratedItem.content).toBe(persistedItem.content);
    expect(hydratedItem.origin).toBe(persistedItem.origin);
  }
}
```

**Usage sub-object:**
```typescript
expect(hydratedResponse.usage?.prompt_tokens).toBe(persistedRun.usage.prompt_tokens);
expect(hydratedResponse.usage?.completion_tokens).toBe(persistedRun.usage.completion_tokens);
expect(hydratedResponse.usage?.total_tokens).toBe(persistedRun.usage.total_tokens);
```

**Summary table:**

| Object | Fields to Compare |
|--------|-------------------|
| Response | id, turn_id, thread_id, model_id, provider_id, status, finish_reason, output_items.length |
| OutputItem (all) | id, type |
| OutputItem (message) | content, origin |
| OutputItem (reasoning) | content, origin |
| Usage | prompt_tokens, completion_tokens, total_tokens |

**Fields to EXCLUDE (timestamps):**
- created_at, updated_at

---

## 7. Test Structure

### 7.1 Test Execution Order

```
beforeAll: validateEnvironment()
    ↓
test: "simple prompt" ──────────────────┐
                                        │
test: "tool calls" ─────────────────────┼── run in PARALLEL
                                        │
test: "multi-turn conversation" ────────┤
                                        │
test: "reasoning with puzzle" ──────────┘
```

All tests are multi-stage internally, running concurrently with each other.

---

## 8. Coder Workflow

### Step 1: Make API changes (Phase 1)

1. Update `src/api/routes/submit.ts` - Add `reasoningEffort` to schema and pass to adapter
2. Update `src/core/model-factory.ts` - Add to `StreamAdapterParams` interface
3. Update `src/core/adapters/openai-adapter.ts` - Conditional reasoning block

### Step 2: Run existing tests

```bash
bun run test:tdd-api
```

- Verify all 3 existing tests pass
- Note timing (should be faster without forced reasoning)
- If any test fails, this is a regression - fix before proceeding

### Step 3: Add reasoning test (Phase 2)

Add new test in `openai-prompts.test.ts`:

```typescript
test("reasoning with puzzle", async () => {
  // Submit with reasoningEffort: "low"
  // Stream and collect events
  // Hydrate response
  // Validate reasoning items present
  // Validate persistence
  // Compare hydrated vs persisted
});
```

### Step 4: Update README.md

Add reasoning test to test documentation.

### Step 5: Run full test suite

```bash
bun run test:tdd-api
```

- All 4 tests must pass
- Tests must NOT hang after completion

---

## 9. Definition of Done

| # | Criteria | |
|---|----------|---|
| 1 | `reasoningEffort` added to submit endpoint schema | |
| 2 | `reasoningEffort` added to `StreamAdapterParams` interface | |
| 3 | OpenAI adapter uses conditional reasoning (not hardcoded) | |
| 4 | Reasoning includes `summary: "auto"` when enabled | |
| 5 | Existing tests still pass (no regressions) | |
| 6 | Timing improvement noted (existing tests faster) | |
| 7 | Reasoning test added to `openai-prompts.test.ts` | |
| 8 | README.md updated with new test | |
| 9 | Hydrated vs persisted comparison for reasoning test | |
| 9a | - Response-level fields | |
| 9b | - OutputItem fields (message: content, origin) | |
| 9c | - OutputItem fields (reasoning: content, origin) | |
| 9d | - Usage fields | |
| 9e | - Timestamps excluded | |
| 10 | `bun run test:tdd-api` executes | |
| 11 | All 4 tests pass | |
| 12 | Tests complete within 20 second timeout | |
| 13 | Tests do NOT hang after pass/fail | |
| 14 | `bun run format` - no changes | |
| 15 | `bun run lint` - no errors | |
| 16 | `bun run typecheck` - no errors | |
| 17 | **Checks 14-16 run sequentially with NO changes or errors between runs** | |

---

## 10. File Deliverables

| File | Action |
|------|--------|
| `src/api/routes/submit.ts` | Add `reasoningEffort` to schema, pass to adapter |
| `src/core/model-factory.ts` | Add `reasoningEffort` to `StreamAdapterParams` |
| `src/core/adapters/openai-adapter.ts` | Conditional reasoning block |
| `test-suites/tdd-api/openai-prompts.test.ts` | Add reasoning test |
| `test-suites/tdd-api/README.md` | Update with new test |

---

## 11. API Reference

### Reasoning Test Request

```json
{
  "prompt": "Solve the puzzle and reply with only the final number.\n\nPUZZLE: I am a 2-digit number. My digits are different. The sum of my digits is 11. If you reverse my digits, the number increases by 27. What number am I?",
  "reasoningEffort": "low"
}
```

### Expected OpenAI Request Body (when reasoningEffort is set)

```json
{
  "model": "gpt-5-mini",
  "input": [...],
  "stream": true,
  "reasoning": { "effort": "low", "summary": "auto" }
}
```

### Expected OpenAI Request Body (when reasoningEffort is NOT set)

```json
{
  "model": "gpt-5-mini",
  "input": [...],
  "stream": true
}
```

Note: No `reasoning` field at all when not requested.

### Expected Response Structure

```json
{
  "id": "...",
  "turn_id": "...",
  "thread_id": "...",
  "status": "complete",
  "output_items": [
    {
      "type": "reasoning",
      "content": "Let me solve this step by step...",
      "origin": "agent"
    },
    {
      "type": "message",
      "content": "47",
      "origin": "agent"
    }
  ],
  "usage": {
    "prompt_tokens": ...,
    "completion_tokens": ...,
    "total_tokens": ...
  }
}
```

**Key Verification:**
- `reasoning` output item(s) present with non-empty content
- `message` output item present with answer
- Both hydrated and persisted responses match

---

## 12. Scope Limitations

**In scope:**
- OpenAI adapter reasoning configuration
- Single reasoning test with puzzle prompt

**Out of scope (future work):**
- Anthropic adapter reasoning/thinking configuration
- OpenRouter adapter
- Other reasoning effort levels (medium, high) tests
- Reasoning summary extraction/verification
