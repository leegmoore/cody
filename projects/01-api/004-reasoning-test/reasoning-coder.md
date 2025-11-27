# CODER PROMPT: reasoning-test

**Generated:** 2025-11-26
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer. Your task: **Add configurable reasoning effort to the submit API, then create a test that validates reasoning/thinking output is correctly streamed and persisted.**

This is a two-phase task:
1. **Phase 1:** API changes to make reasoning configurable
2. **Phase 2:** Add a reasoning test that uses the new configuration

---

## PROJECT CONTEXT

**cody-fastify** is a streaming-first LLM harness. We need this work because:

- Currently reasoning is hardcoded to "medium" for ALL requests (slower)
- No way to disable reasoning for simple prompts
- No reasoning summaries returned
- Need to validate reasoning output items work correctly

### Architecture

```
Client → Fastify API → LLM Provider (OpenAI/Anthropic)
                ↓
           Redis Streams (event transport, backpressure)
                ↓
        ┌───────┴───────┐
        ↓               ↓
  Persistence       Streaming
    Worker          Endpoint
        ↓               ↓
      Convex        Client (SSE)
```

**Core Design:** One shape (OpenAI Responses API schema) at multiple hydration levels.

---

## CURRENT STATE

The tdd-api test suite exists at `test-suites/tdd-api/` with:
- `validate-env.ts` - Environment validation
- `openai-prompts.test.ts` - Existing tests (simple-prompt, tool-calls, multi-turn)
- `README.md` - Suite documentation

**Problem:** `openai-adapter.ts:192` has hardcoded `reasoning: { effort: "medium" }` which slows down every request.

---

## PHASE 1: API CHANGES

### The Problem

```typescript
// openai-adapter.ts line ~192 - CURRENT (hardcoded)
const reqBody = {
  model: this.model,
  input: options.conversation,
  stream: true,
  reasoning: { effort: "medium" },  // Always on, always medium
  // ...
};
```

### The Solution

Make reasoning opt-in via submit endpoint. When not specified, no reasoning. When specified, include `summary: "auto"`.

### Code Changes Required

**File 1: `src/api/routes/submit.ts`**

Add `reasoningEffort` to SubmitBody schema:
```typescript
const SubmitBody = z.object({
  prompt: z.string().min(1, "prompt cannot be empty"),
  model: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),  // ADD THIS
  runId: z.string().uuid().optional(),
  turnId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
});
```

Pass to adapter stream call (find the `adapter.stream()` call):
```typescript
await adapter.stream({
  prompt: body.prompt,
  runId,
  turnId,
  threadId,
  agentId: body.agentId,
  traceContext,
  tools: toolSpecs,
  reasoningEffort: body.reasoningEffort,  // ADD THIS
});
```

**File 2: `src/core/model-factory.ts`**

Add to `StreamAdapterParams` interface:
```typescript
export interface StreamAdapterParams {
  prompt: string;
  runId?: string;
  turnId?: string;
  threadId?: string;
  agentId?: string;
  traceContext?: TraceContext;
  tools?: ToolSpec[];
  reasoningEffort?: "low" | "medium" | "high";  // ADD THIS
}
```

**File 3: `src/core/adapters/openai-adapter.ts`**

Find where `reqBody` is constructed (around line 188-195) and change:

FROM:
```typescript
const reqBody = {
  model: this.model,
  input: options.conversation,
  stream: true,
  reasoning: { effort: "medium" },  // REMOVE THIS HARDCODED LINE
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

### Verification: Existing Tests

After making Phase 1 changes, run:
```bash
bun run test:tdd-api
```

**Expected:**
- All 3 existing tests pass (simple-prompt, tool-calls, multi-turn)
- Tests should run FASTER (no forced reasoning)
- Note the timing before/after

**If tests fail:** This is a regression - fix before proceeding to Phase 2.

---

## PHASE 2: REASONING TEST

### Test Case

Submit a puzzle prompt with `reasoningEffort: "low"`, verify reasoning output items are streamed and persisted.

**Prompt:**
```
Solve the puzzle and reply with only the final number.

PUZZLE: I am a 2-digit number. My digits are different. The sum of my digits is 11. If you reverse my digits, the number increases by 27. What number am I?
```

**Expected answer:** 47

### Test Flow

```
PHASE 1: Submit with reasoning
  POST /api/v2/submit {
    prompt: "<puzzle>",
    reasoningEffort: "low"
  }
  → Assert 202 response with valid UUID runId

PHASE 2: Stream and collect
  GET /api/v2/stream/:runId (SSE)
  → Collect events until response_done
  → Assert reasoning events received (item_start/item_done with type "reasoning")
  → Assert message events received
  → Hydrate using ResponseReducer

PHASE 3: Validate hydrated response
  → Assert output_items contains >= 1 reasoning item
  → Assert output_items contains >= 1 message item
  → Assert reasoning item has content (not empty)

PHASE 4: Validate persistence
  Poll GET /api/v2/runs/:runId until complete
  → Assert run exists with status "complete"
  → Assert output_items contains reasoning and message items

PHASE 5: Compare hydrated vs persisted
  → Field-by-field comparison
```

### Assertions Summary

**Streaming Phase:**
| Assertion | Criteria |
|-----------|----------|
| Submit response | 202 status |
| runId | Valid UUID |
| response_start | Event received |
| item_done (reasoning) | At least 1 |
| item_done (message) | At least 1 |
| response_done | Event received, status "complete" |
| No function_call items | count == 0 |

**Hydrated Response:**
| Assertion | Criteria |
|-----------|----------|
| output_items reasoning | count >= 1 |
| output_items message | count >= 1 |
| reasoning content | Non-empty string |

### Hydrated vs Persisted Comparison (Detailed)

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

  // Common fields
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

**Fields to EXCLUDE:** created_at, updated_at

---

## KEY FILES

**To modify:**
- `src/api/routes/submit.ts` - Add reasoningEffort to schema
- `src/core/model-factory.ts` - Add to StreamAdapterParams
- `src/core/adapters/openai-adapter.ts` - Conditional reasoning
- `test-suites/tdd-api/openai-prompts.test.ts` - Add test
- `test-suites/tdd-api/README.md` - Update docs

**Reference:**
- `src/core/schema.ts` - ReasoningItemSchema definition
- `src/core/reducer.ts` - ResponseReducer

---

## TECHNICAL STANDARDS

### Infrastructure Rules

**NO MOCKING of infrastructure.** Use real:
- Redis (local)
- Convex (local)
- Workers
- LLM API (real OpenAI calls)

### Code Quality

- TypeScript strict mode
- Strong types throughout (no `any`)
- Explicit error handling
- Domain-specific naming

### Convergent Defaults to Avoid

- Mocking anything
- Generic variable names
- Copy-paste without adaptation
- Fixed waits instead of polling

---

## DEFINITION OF DONE

### Phase 1 (API Changes):

- [ ] `reasoningEffort` added to submit endpoint schema
- [ ] `reasoningEffort` added to `StreamAdapterParams` interface
- [ ] OpenAI adapter uses conditional reasoning (not hardcoded)
- [ ] Reasoning includes `summary: "auto"` when enabled
- [ ] Existing 3 tests still pass (no regressions)
- [ ] Timing noted (existing tests should be faster)

### Phase 2 (Reasoning Test):

- [ ] Reasoning test added to `openai-prompts.test.ts`
- [ ] README.md updated with new test
- [ ] Hydrated vs persisted comparison implemented
  - [ ] Response-level fields
  - [ ] OutputItem fields (message: content, origin)
  - [ ] OutputItem fields (reasoning: content, origin)
  - [ ] Usage fields
  - [ ] Timestamps excluded

### Final Verification:

- [ ] `bun run test:tdd-api` executes
- [ ] All 4 tests pass
- [ ] Tests complete within 20 second timeout
- [ ] Tests do NOT hang after pass/fail
- [ ] `bun run format` - no changes
- [ ] `bun run lint` - no errors
- [ ] `bun run typecheck` - no errors
- [ ] Format/lint/typecheck run sequentially with no changes or errors

---

## OUTPUT FORMAT

```
### Definition of Done

**Phase 1 - API Changes:**
- [ ] reasoningEffort added to submit schema
- [ ] reasoningEffort added to StreamAdapterParams
- [ ] OpenAI adapter conditional reasoning
- [ ] summary: "auto" included when reasoning enabled
- [ ] Existing tests pass
- [ ] Timing improvement: [X seconds → Y seconds]

**Phase 2 - Reasoning Test:**
- [ ] Test added
- [ ] README updated

**Standard Checks:**
- [ ] Format clean (no changes)
- [ ] Lint clean (no errors)
- [ ] Typecheck clean (no errors)
- [ ] All ran sequentially with no changes or errors

**Hydrated vs Persisted Comparison:**
- [ ] Response-level fields compared
- [ ] OutputItem fields compared (message: content, origin)
- [ ] OutputItem fields compared (reasoning: content, origin)
- [ ] Usage fields compared
- [ ] Timestamps excluded

**All Tests:**
- [ ] simple-prompt: PASS
- [ ] tool-calls: PASS
- [ ] multi-turn: PASS
- [ ] reasoning: PASS

### Changes Made

- `src/api/routes/submit.ts` - Added reasoningEffort to schema
- `src/core/model-factory.ts` - Added to StreamAdapterParams
- `src/core/adapters/openai-adapter.ts` - Conditional reasoning block
- `test-suites/tdd-api/openai-prompts.test.ts` - Added reasoning test
- `test-suites/tdd-api/README.md` - Updated docs

### Timing Comparison

Before (with hardcoded reasoning):
- simple-prompt: Xs
- tool-calls: Xs
- multi-turn: Xs

After (no forced reasoning):
- simple-prompt: Xs
- tool-calls: Xs
- multi-turn: Xs
- reasoning: Xs
```

---

## STARTING POINT

1. Read this entire prompt
2. **Phase 1:** Make API changes (3 files)
3. Run existing tests - verify no regressions, note timing
4. **Phase 2:** Add reasoning test following existing patterns
5. Update README
6. Run full suite - all 4 tests pass
7. Run format, lint, typecheck
8. Report results

**Focus on correctness and timing improvement.**
