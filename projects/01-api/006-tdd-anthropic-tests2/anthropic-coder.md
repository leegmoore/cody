# CODER PROMPT: anthropic-tests2

**Generated:** 2025-11-26
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer. Your task: **Add multi-turn history test and extended thinking support to the Anthropic test suite.**

This is a three-phase task with mandatory gates between phases:
1. **Phase 1:** Add multi-turn test (no code changes)
2. **GATE 1:** Verify all 7 tests pass
3. **Phase 2:** Add extended thinking support (code changes)
4. **GATE 2:** Verify all 7 tests still pass (no regression)
5. **Phase 3:** Add extended thinking test

---

## PROJECT CONTEXT

**cody-fastify** is a streaming-first LLM harness. We need this work because:

- Validating Anthropic multi-turn conversation works
- Enabling extended thinking (Claude's reasoning feature)
- Ensuring thinking content is captured and persisted

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
- `validate-env.ts` - 5 environment checks (Redis, Convex, OpenAI, Fastify, Anthropic)
- `openai-prompts.test.ts` - 4 tests (simple-prompt, tool-calls, multi-turn, reasoning)
- `anthropic-prompts.test.ts` - 2 tests (simple-prompt, tool-calls)
- `README.md` - Suite documentation

**Important finding from code review:**
- Anthropic adapter already captures "thinking" blocks → maps to "reasoning" output items
- BUT: No mechanism to enable extended thinking in requests
- Need to add `thinkingBudget` parameter and beta header

---

## PHASE 1: Multi-Turn History Test

### Implementation

Add Test 3 to `anthropic-prompts.test.ts`:

```typescript
it("multi-turn: maintains conversation history across 3 turns", async () => {
  const prompts = [
    "Hi Claude, how are you?",
    "This is great to hear!",
    "Have a good evening!"
  ];

  // Step 1: Create thread
  const createRes = await fetch(`${BASE_URL}/api/v2/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  const thread = await createRes.json();
  const threadId = thread.id;

  const hydratedResponses: Response[] = [];

  // Step 2-4: Send 3 prompts sequentially
  for (const prompt of prompts) {
    const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        threadId,
        providerId: "anthropic",
        model: "claude-haiku-4-5"
      })
    });

    const runId = (await submitRes.json()).runId;
    const streamUrl = `${BASE_URL}/api/v2/stream/${runId}`;

    // Consume stream, hydrate response
    const reducer = new ResponseReducer();
    // ... stream consumption and hydration
    hydratedResponses.push(reducer.getResponse());
  }

  // Step 5: Wait for persistence
  await pollForPersistence(threadId, 3);

  // Step 6: Fetch thread, verify 3 runs
  const threadRes = await fetch(`${BASE_URL}/api/v2/threads/${threadId}`);
  const threadData = await threadRes.json();

  expect(threadData.runs.length).toBe(3);

  // Step 7: Compare hydrated vs persisted for each turn
  for (let i = 0; i < 3; i++) {
    const hydrated = hydratedResponses[i];
    const persisted = threadData.runs[i];

    // Full comparison (see Hydrated vs Persisted section)
  }
});
```

### Assertions - Multi-Turn

| Assertion | Expected |
|-----------|----------|
| thread_id | Same for all 3 turns |
| run_id | 3 distinct values |
| status | "complete" for all |
| output_items | message type only (no function_call, no reasoning) |
| provider_id | "anthropic" |
| model_id | "claude-haiku-4-5" |

---

## GATE 1: Regression Verification

```
╔═══════════════════════════════════════════════════════════════╗
║  STOP. Do not proceed to Phase 2 until this gate passes.      ║
╠═══════════════════════════════════════════════════════════════╣
║  1. Run: cd cody-fastify && bun run test:tdd-api              ║
║  2. All 7 tests must pass (4 OpenAI + 3 Anthropic)            ║
║  3. Note timing                                               ║
║  4. If ANY test fails, fix before proceeding                  ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## PHASE 2: Extended Thinking Support (Code Changes)

### File 1: `src/api/routes/submit.ts`

Add `thinkingBudget` to the request schema:

```typescript
const SubmitBody = z.object({
  prompt: z.string().min(1),
  model: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  threadId: z.string().optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  thinkingBudget: z.number().int().positive().optional(),  // ADD THIS
});
```

Pass to adapter:

```typescript
const params: StreamAdapterParams = {
  prompt: body.prompt,
  threadId: body.threadId,
  reasoningEffort: body.reasoningEffort,
  thinkingBudget: body.thinkingBudget,  // ADD THIS
  // ...
};
```

### File 2: `src/core/model-factory.ts`

Add to `StreamAdapterParams` interface:

```typescript
export interface StreamAdapterParams {
  prompt: string;
  threadId?: string;
  turnId?: string;
  runId?: string;
  tools?: unknown[];
  agentId?: string;
  traceContext?: TraceContext;
  reasoningEffort?: "low" | "medium" | "high";
  thinkingBudget?: number;  // ADD THIS
}
```

### File 3: `src/core/adapters/anthropic-adapter.ts`

Add thinking configuration to request:

```typescript
// In runStreamedConversation method, modify reqBody:

const reqBody: {
  model: string;
  max_tokens: number;
  stream: true;
  messages: Array<{ role: "user"; content: Array<{ type: "text"; text: string }> }>;
  tools?: ReturnType<typeof formatToolsForAnthropicMessages>;
  thinking?: { type: "enabled"; budget_tokens: number };  // ADD TYPE
} = {
  model: this.model,
  max_tokens: this.maxOutputTokens,
  stream: true,
  messages: [
    {
      role: "user" as const,
      content: [{ type: "text" as const, text: params.prompt }],
    },
  ],
  tools: formattedTools,
  // ADD: Conditional thinking config
  ...(params.thinkingBudget && {
    thinking: {
      type: "enabled" as const,
      budget_tokens: params.thinkingBudget
    }
  })
};

// ADD: Beta header when thinking is enabled
if (params.thinkingBudget) {
  headers["anthropic-beta"] = "interleaved-thinking-2025-05-14";
}
```

---

## GATE 2: Code Change Verification

```
╔═══════════════════════════════════════════════════════════════╗
║  STOP. After Phase 2 code changes, verify no regression.      ║
╠═══════════════════════════════════════════════════════════════╣
║  1. Run: cd cody-fastify && bun run test:tdd-api              ║
║  2. All 7 tests must pass                                     ║
║  3. Timing should NOT be slower (thinking not enabled by      ║
║     default, only when thinkingBudget is set)                 ║
║  4. If ANY test fails, fix before proceeding                  ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## PHASE 3: Extended Thinking Test

### Implementation

Add Test 4 to `anthropic-prompts.test.ts`:

```typescript
it("reasoning: solves puzzle with extended thinking", async () => {
  const puzzlePrompt = `Solve the puzzle and reply with only the final number.

PUZZLE: I am a 2-digit number. My digits are different. The sum of my digits is 11. If you reverse my digits, the number increases by 27. What number am I?`;

  // Step 1: Create thread
  const createRes = await fetch(`${BASE_URL}/api/v2/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  const thread = await createRes.json();
  const threadId = thread.id;

  // Step 2: Submit with thinkingBudget
  const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: puzzlePrompt,
      threadId,
      providerId: "anthropic",
      model: "claude-haiku-4-5",
      thinkingBudget: 4096  // Enable extended thinking
    })
  });

  const { runId } = await submitRes.json();

  // Step 3: Consume stream
  const streamUrl = `${BASE_URL}/api/v2/stream/${runId}`;
  const events: StreamEvent[] = [];
  // ... stream consumption

  // Step 4: Verify reasoning events
  const reasoningStarts = events.filter(
    e => e.type === "item_start" && e.payload.item_type === "reasoning"
  );
  expect(reasoningStarts.length).toBeGreaterThanOrEqual(1);

  // Step 5: Hydrate response
  const reducer = new ResponseReducer();
  events.forEach(e => reducer.apply(e));
  const hydratedResponse = reducer.getResponse();

  // Step 6: Wait for persistence
  await pollForPersistence(threadId, 1);

  // Step 7: Fetch persisted run
  const threadRes = await fetch(`${BASE_URL}/api/v2/threads/${threadId}`);
  const threadData = await threadRes.json();
  const persistedRun = threadData.runs[0];

  // Step 8: Assert reasoning + message items
  const reasoningItems = persistedRun.output_items.filter(
    (i: OutputItem) => i.type === "reasoning"
  );
  const messageItems = persistedRun.output_items.filter(
    (i: OutputItem) => i.type === "message"
  );

  expect(reasoningItems.length).toBeGreaterThanOrEqual(1);
  expect(messageItems.length).toBeGreaterThanOrEqual(1);
  expect(reasoningItems[0].content.length).toBeGreaterThan(0);

  // Step 9: Compare hydrated vs persisted
  // Full comparison (see section below)
});
```

### Assertions - Extended Thinking

| Assertion | Expected |
|-----------|----------|
| Streaming reasoning events | >= 1 item_start with item_type: "reasoning" |
| output_items reasoning | count >= 1 |
| output_items message | count >= 1 |
| reasoning content | not empty |
| provider_id | "anthropic" |
| model_id | "claude-haiku-4-5" |

---

## HYDRATED VS PERSISTED COMPARISON (Detailed)

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

  // Function call (for multi-turn if applicable)
  if (hydratedItem.type === "function_call") {
    expect(hydratedItem.name).toBe(persistedItem.name);
    expect(hydratedItem.arguments).toBe(persistedItem.arguments);
    expect(hydratedItem.call_id).toBe(persistedItem.call_id);
    expect(hydratedItem.origin).toBe(persistedItem.origin);
  }

  // Function call output
  if (hydratedItem.type === "function_call_output") {
    expect(hydratedItem.call_id).toBe(persistedItem.call_id);
    expect(hydratedItem.output).toBe(persistedItem.output);
    expect(hydratedItem.success).toBe(persistedItem.success);
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

## TECHNICAL STANDARDS

### Anti-Patterns to Avoid

- **DO NOT** mock Redis, Convex, or Anthropic
- **DO NOT** use fixed waits (use polling for persistence)
- **DO NOT** use `any` types
- **DO NOT** create environment variable pre-checks (use connectivity checks)
- **DO NOT** proceed past gates without verification

### Required Patterns

- Use `ResponseReducer` for hydration (follow existing tests)
- Poll for persistence before comparing
- Strong types throughout
- Follow existing test structure exactly

---

## DEFINITION OF DONE

### Standard Checks

Run these sequentially. If any produces changes or errors, fix and re-run ALL from the beginning.

- [ ] `bun run format` - no changes
- [ ] `bun run lint` - no errors
- [ ] `bun run typecheck` - no errors
- [ ] All three ran sequentially with no changes or errors between runs

### Job-Specific Items

- [ ] Multi-turn test added to `anthropic-prompts.test.ts`
- [ ] Extended thinking code changes in 3 files:
  - [ ] `submit.ts` - thinkingBudget in schema
  - [ ] `model-factory.ts` - thinkingBudget in interface
  - [ ] `anthropic-adapter.ts` - thinking config + beta header
- [ ] Extended thinking test added to `anthropic-prompts.test.ts`
- [ ] README.md updated with new tests
- [ ] Hydrated vs persisted comparison for all tests:
  - [ ] Response-level fields
  - [ ] OutputItem fields (message, reasoning)
  - [ ] Usage fields
  - [ ] Timestamps excluded
- [ ] `bun run test:tdd-api` executes
- [ ] All 8 tests pass (4 OpenAI + 4 Anthropic)
- [ ] Tests complete within 30 second timeout
- [ ] Tests do NOT hang after pass/fail

---

## OUTPUT FORMAT

When complete, provide:

```markdown
## Summary

[Brief description of what was implemented]

### Definition of Done

**Standard Checks:**
- [ ] Format clean (no changes)
- [ ] Lint clean (no errors)
- [ ] Typecheck clean (no errors)
- [ ] All three ran sequentially with no changes or errors

**Job-Specific Items:**
- [ ] Multi-turn test added
- [ ] Extended thinking code changes (3 files)
- [ ] Extended thinking test added
- [ ] README.md updated
- [ ] All 8 tests pass
- [ ] Tests complete within 30 seconds
- [ ] Tests do NOT hang

**Hydrated vs Persisted Comparison:**
- [ ] Response-level fields compared
- [ ] OutputItem fields compared (message, reasoning)
- [ ] Usage fields compared
- [ ] Timestamps correctly excluded

### Gate Results

**Gate 1 (after multi-turn test):**
- Tests passed: X/7
- Timing: Xs

**Gate 2 (after code changes):**
- Tests passed: X/7
- Timing: Xs (compare to Gate 1)

**Final:**
- Tests passed: X/8
- Timing: Xs

### Changes Made

- `path/to/file.ts` - What was changed

### Test Output

[Paste final test run output]
```

---

## STARTING POINT

1. Read `anthropic-prompts.test.ts` to understand existing structure
2. Read `openai-prompts.test.ts` tests 3 and 4 as reference
3. Phase 1: Add multi-turn test
4. GATE 1: Verify 7 tests pass
5. Phase 2: Add extended thinking support (3 file changes)
6. GATE 2: Verify 7 tests still pass
7. Phase 3: Add extended thinking test
8. Update README.md
9. Run final verification
10. Report results

**Follow the gates strictly. Do not skip verification steps.**
