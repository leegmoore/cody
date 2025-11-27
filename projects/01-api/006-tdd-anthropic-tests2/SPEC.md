# Technical Specification: Anthropic Multi-Turn & Extended Thinking Tests
**Project:** 006-tdd-anthropic-tests2
**Created:** 2025-11-26
**Status:** Draft
---

## 1. Overview

Add tests 3 and 4 (multi-turn history and extended thinking) to the Anthropic test suite. The multi-turn test mirrors OpenAI test 3. The extended thinking test requires code changes to enable Anthropic's extended thinking feature.

**Key Insight from Code Review:**
- Anthropic adapter already captures "thinking" blocks → maps to "reasoning" items
- BUT: No mechanism to enable extended thinking in the request
- Need to add `thinking` config and beta header to enable it

---

## 2. Location & Execution

**Test file:** `cody-fastify/test-suites/tdd-api/anthropic-prompts.test.ts`

**Script:**
```json
"test:tdd-api": "bun test test-suites/tdd-api/ --timeout 30000"
```

**Note:** Extended thinking takes longer than reasoning, may need 30-second timeout.

---

## 3. Pre-Requisites

All already in place from 005:

- [x] `validate-env.ts` has 5 checks (Redis, Convex, OpenAI, Fastify, Anthropic)
- [x] `openai-prompts.test.ts` has 4 tests
- [x] `anthropic-prompts.test.ts` has 2 tests (simple, tool calls)
- [x] All 6 tests passing

---

## 4. Phased Approach

### Phase 1: Multi-Turn History Test (No Code Changes)

Add Test 3 to `anthropic-prompts.test.ts`:

**Prompts (same thread, sequential):**
1. "Hi Claude, how are you?"
2. "This is great to hear!"
3. "Have a good evening!"

**Assertions:**
- Same thread_id for all 3 turns
- 3 distinct run_ids
- All runs complete with status: "complete"
- output_items contain message type only (no function_call, no reasoning)
- All 3 runs persisted correctly
- Hydrated vs persisted comparison for each turn

---

### GATE 1: Regression Verification

**STOP. Do not proceed to Phase 2 until:**

1. Run `bun run test:tdd-api` from cody-fastify/
2. All 7 tests pass (4 OpenAI + 3 Anthropic)
3. No regressions in existing tests
4. Note timing

If any test fails, investigate and fix before proceeding.

---

### Phase 2: Extended Thinking Support (Code Changes)

Enable extended thinking in Anthropic adapter.

**Files to modify:**

| File | Change |
|------|--------|
| `src/api/routes/submit.ts` | Add `thinkingBudget?: number` to request schema |
| `src/core/model-factory.ts` | Add `thinkingBudget?: number` to `StreamAdapterParams` |
| `src/core/adapters/anthropic-adapter.ts` | Add thinking config when `thinkingBudget` is set |

**Anthropic Extended Thinking Configuration:**

```typescript
// In anthropic-adapter.ts request body:
const reqBody = {
  model: this.model,
  max_tokens: this.maxOutputTokens,
  stream: true,
  messages: [...],
  tools: formattedTools,
  // ADD: When thinkingBudget is set
  ...(options.thinkingBudget && {
    thinking: {
      type: "enabled",
      budget_tokens: options.thinkingBudget
    }
  })
};

// ADD: Beta header when thinking is enabled
if (options.thinkingBudget) {
  headers["anthropic-beta"] = "interleaved-thinking-2025-05-14";
}
```

**Notes:**
- `thinkingBudget` is Anthropic-specific (token count, not effort level)
- Suggest values: 4096 (low), 10240 (medium), 32768 (high)
- For test: use 4096 (faster)

---

### GATE 2: Code Change Verification

**STOP. After Phase 2 code changes:**

1. Run `bun run test:tdd-api` from cody-fastify/
2. All 7 tests pass (no regressions from code changes)
3. Note timing - should NOT be slower (thinking not enabled by default)

If any test fails, investigate and fix before proceeding.

---

### Phase 3: Extended Thinking Test

Add Test 4 to `anthropic-prompts.test.ts`:

**Test Prompt:**
```
Solve the puzzle and reply with only the final number.

PUZZLE: I am a 2-digit number. My digits are different. The sum of my digits is 11. If you reverse my digits, the number increases by 27. What number am I?
```

**Request Configuration:**
```typescript
const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: puzzlePrompt,
    providerId: "anthropic",
    model: "claude-haiku-4-5",
    thinkingBudget: 4096  // Enable extended thinking
  })
});
```

**Assertions - Streaming:**
- item_start event with item_type: "reasoning" appears
- item_delta events accumulate reasoning content
- item_done event with final_item.type: "reasoning"
- item_start event with item_type: "message" appears
- item_done event with final_item.type: "message"
- response_done event

**Assertions - Hydrated/Persisted:**
- output_items contains at least 1 item with type: "reasoning"
- output_items contains at least 1 item with type: "message"
- reasoning item has content (not empty)
- message item has content containing answer
- provider_id: "anthropic"
- model_id: "claude-haiku-4-5"

**Assertions - Comparison:**
Full hydrated vs persisted comparison (see Section 5.5).

---

## 5. Test Structure

### 5.1 Multi-Turn Test

```typescript
it("multi-turn: maintains conversation history across 3 turns", async () => {
  // Step 1: Create thread
  // Step 2: Turn 1 - "Hi Claude, how are you?"
  // Step 3: Turn 2 - "This is great to hear!"
  // Step 4: Turn 3 - "Have a good evening!"
  // Step 5: Wait for persistence
  // Step 6: Fetch thread, verify 3 runs
  // Step 7: Compare hydrated vs persisted for each turn
});
```

### 5.2 Extended Thinking Test

```typescript
it("reasoning: solves puzzle with extended thinking", async () => {
  // Step 1: Create thread
  // Step 2: Submit with thinkingBudget: 4096
  // Step 3: Capture stream events
  // Step 4: Verify reasoning events
  // Step 5: Hydrate response
  // Step 6: Wait for persistence
  // Step 7: Fetch persisted run
  // Step 8: Assert reasoning + message items
  // Step 9: Compare hydrated vs persisted
});
```

### 5.3 Assertions Summary

| Assertion | Multi-Turn | Reasoning |
|-----------|------------|-----------|
| Same thread_id | ✓ (all 3) | ✓ |
| run_id count | 3 | 1 |
| status complete | ✓ (all 3) | ✓ |
| has reasoning | ✗ | ✓ (>= 1) |
| has message | ✓ | ✓ |
| provider_id | "anthropic" | "anthropic" |
| model_id | "claude-haiku-4-5" | "claude-haiku-4-5" |

### 5.4 Provider-Specific Assertions

```typescript
expect(run.provider_id).toBe("anthropic");
expect(run.model_id).toBe("claude-haiku-4-5");
```

### 5.5 Hydrated vs Persisted Comparison (Detailed)

For each turn/run, compare field-by-field. Exclude timestamps (created_at, updated_at).

**Response-level fields:**
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

**For each output_item by type:**

```typescript
for (let i = 0; i < hydratedResponse.output_items.length; i++) {
  const hydratedItem = hydratedResponse.output_items[i];
  const persistedItem = persistedRun.output_items[i];

  // Common fields
  expect(hydratedItem.id).toBe(persistedItem.id);
  expect(hydratedItem.type).toBe(persistedItem.type);

  // Message
  if (hydratedItem.type === "message") {
    expect(hydratedItem.content).toBe(persistedItem.content);
    expect(hydratedItem.origin).toBe(persistedItem.origin);
  }

  // Reasoning
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

---

## 6. Coder Workflow

### Step 1: Add Multi-Turn Test

Add Test 3 to `anthropic-prompts.test.ts`:
- 3 sequential prompts
- Same thread, different runs
- Verify history maintained

### GATE 1: Verify 7 Tests Pass

```
STOP. Run bun run test:tdd-api
- All 7 tests must pass
- Note timing
- If failures, fix before proceeding
```

### Step 2: Add Extended Thinking Support

Modify 3 files:
1. `submit.ts` - Add thinkingBudget to schema
2. `model-factory.ts` - Add to interface
3. `anthropic-adapter.ts` - Add thinking config + beta header

### GATE 2: Verify 7 Tests Pass (No Regression)

```
STOP. Run bun run test:tdd-api
- All 7 tests must pass
- Timing should NOT be slower
- If failures, fix before proceeding
```

### Step 3: Add Extended Thinking Test

Add Test 4 to `anthropic-prompts.test.ts`:
- Puzzle prompt
- thinkingBudget: 4096
- Verify reasoning items

### Step 4: Update README

Add entries for new tests.

### Step 5: Final Verification

Run full suite - all 8 tests pass.

---

## 7. Definition of Done

### If Tests Pass:

| # | Criteria | ✓ |
|---|----------|---|
| 1 | Multi-turn test added to `anthropic-prompts.test.ts` | |
| 2 | Extended thinking code changes in 3 files | |
| 3 | Extended thinking test added to `anthropic-prompts.test.ts` | |
| 4 | README.md updated with new tests | |
| 5 | Hydrated vs persisted comparison for all tests | |
| 5a | - Response-level fields | |
| 5b | - OutputItem fields (message, reasoning) | |
| 5c | - Usage fields | |
| 5d | - Timestamps excluded | |
| 6 | `bun run test:tdd-api` executes | |
| 7 | All 8 tests pass | |
| 8 | Tests complete within 30 second timeout | |
| 9 | Tests do NOT hang after pass/fail | |
| 10 | `bun run format` - no changes | |
| 11 | `bun run lint` - no errors | |
| 12 | `bun run typecheck` - no errors | |
| 13 | **Checks 10-12 run sequentially with NO changes or errors** | |

---

## 8. File Deliverables

| File | Action |
|------|--------|
| `src/api/routes/submit.ts` | Add thinkingBudget to schema |
| `src/core/model-factory.ts` | Add thinkingBudget to interface |
| `src/core/adapters/anthropic-adapter.ts` | Add thinking config + beta header |
| `test-suites/tdd-api/anthropic-prompts.test.ts` | Add 2 tests |
| `test-suites/tdd-api/README.md` | Update |

---

## 9. API Reference

### Submit Endpoint (Updated)

```typescript
POST /api/v2/submit
{
  prompt: string;           // Required
  model?: string;           // Optional (default: gpt-5-mini)
  providerId?: string;      // Optional (default: openai)
  threadId?: string;        // Optional (for continuation)
  reasoningEffort?: "low" | "medium" | "high";  // OpenAI only
  thinkingBudget?: number;  // Anthropic only (e.g., 4096)
}
```

### Provider Parameter Mapping

| Provider | Parameter | Mapping |
|----------|-----------|---------|
| OpenAI | reasoningEffort | `reasoning: { effort: X, summary: "auto" }` |
| Anthropic | thinkingBudget | `thinking: { type: "enabled", budget_tokens: X }` |

---

## 10. Test Count Summary

| File | Tests Before | Tests After |
|------|--------------|-------------|
| openai-prompts.test.ts | 4 | 4 |
| anthropic-prompts.test.ts | 2 | 4 |
| **Total** | 6 | 8 |
