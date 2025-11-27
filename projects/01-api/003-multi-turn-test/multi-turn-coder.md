# CODER PROMPT: multi-turn-test

**Generated:** 2025-11-26
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer. Your task: **Add a multi-turn conversation test to the tdd-api test suite, validating that conversation history is maintained across multiple turns.**

You will implement the test, and if it passes, complete all definition of done items. **If the test fails due to application code issues (not test code issues), you will NOT fix the application - instead you will analyze, investigate, and provide recommendations.**

---

## PROJECT CONTEXT

**cody-fastify** is a streaming-first LLM harness. We need this work because:

- Validating multi-turn conversation flow
- Ensuring history is properly maintained across turns
- Real integration testing (no mocked infrastructure)

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

Phase 2 in progress. The tdd-api test suite exists at `test-suites/tdd-api/` with:
- `validate-env.ts` - Environment validation
- `openai-prompts.test.ts` - Existing tests (simple-prompt, tool-calls)
- `README.md` - Suite documentation

---

## TECHNICAL SPECIFICATION

### Test Case: Multi-Turn Conversation

Submit 3 prompts on the same thread, verify conversation context is maintained, validate all turns are persisted correctly.

**Characteristics:**
- 3 prompts, 3 responses
- Same thread throughout
- No tool calls
- No thinking/reasoning
- Simple message content only

### Conversation Flow

```
Turn 1: "Hi cody how are you"
Turn 2: "This is great to hear!"
Turn 3: "Have a good evening!"
```

### Test Flow

```
PHASE 1: Turn 1
  POST /api/v2/submit { prompt: "Hi cody how are you" }
  → Assert 202 response with valid UUID runId
  → Capture threadId from response_start event
  GET /api/v2/stream/:runId (SSE)
  → Collect events until response_done
  → Hydrate using ResponseReducer
  → Assert message response exists
  → Save threadId for subsequent turns

PHASE 2: Turn 2
  POST /api/v2/submit { prompt: "This is great to hear!", threadId: <from turn 1> }
  → Assert 202 response
  → Assert same threadId returned
  GET /api/v2/stream/:runId (SSE)
  → Collect events until response_done
  → Hydrate using ResponseReducer
  → Assert message response exists

PHASE 3: Turn 3
  POST /api/v2/submit { prompt: "Have a good evening!", threadId: <from turn 1> }
  → Assert 202 response
  → Assert same threadId returned
  GET /api/v2/stream/:runId (SSE)
  → Collect events until response_done
  → Hydrate using ResponseReducer
  → Assert message response exists

PHASE 4: Validate Thread Persistence
  Poll GET /api/v2/threads/:threadId until all runs complete
  → Assert thread exists
  → Assert thread has exactly 3 runs
  → Assert all 3 runs have status "complete"
  → Assert each run has at least 1 message output_item
  → Assert runs are in correct order
```

### Assertions Summary

**Per-Turn Streaming Phase:**
| Assertion | Criteria |
|-----------|----------|
| Submit response | 202 status |
| runId | Valid UUID |
| threadId | Consistent across all turns |
| response_start | Event received |
| item_done (message) | At least 1 |
| response_done | Event received, status "complete" |
| No function_call items | count == 0 |
| No reasoning items | count == 0 |

**Thread Persistence Phase:**
| Assertion | Criteria |
|-----------|----------|
| Thread exists | threadId matches |
| Run count | exactly 3 |
| All runs complete | status == "complete" for all |
| Each run has message | output_items includes message type |

### Hydrated vs Persisted Comparison (Detailed)

For each of the 3 turns, compare the hydrated response (from ResponseReducer) to the persisted run (from GET /api/v2/threads/:threadId). This is a critical verification step. Exclude timestamp fields (created_at, updated_at).

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

**For each output_item (message type only in this test):**
```typescript
for (let i = 0; i < hydratedResponse.output_items.length; i++) {
  const hydratedItem = hydratedResponse.output_items[i];
  const persistedItem = persistedRun.output_items[i];

  // Common fields for all output item types
  expect(hydratedItem.id).toBe(persistedItem.id);
  expect(hydratedItem.type).toBe(persistedItem.type);

  // Message-specific fields
  if (hydratedItem.type === "message") {
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

**Summary of fields:**

| Object | Fields to Compare |
|--------|-------------------|
| Response | id, turn_id, thread_id, model_id, provider_id, status, finish_reason, output_items.length |
| OutputItem (all) | id, type |
| OutputItem (message) | content, origin |
| Usage | prompt_tokens, completion_tokens, total_tokens |

**Fields to EXCLUDE:** created_at, updated_at

**Important:** Perform this comparison for EACH of the 3 turns. Store the hydrated response from each turn during streaming, then compare to the corresponding persisted run after fetching the thread.

---

## FAILURE HANDLING - CRITICAL

### Test Code Issues vs Application Code Issues

**If tests fail due to TEST CODE or HARNESS issues:**
- Fix the test code
- Continue with implementation

**If tests fail due to FASTIFY/APPLICATION CODE issues:**
- **DO NOT fix the application code**
- Perform analysis workflow below

### Analysis Workflow (For Application Failures)

If the test reveals problems in the Fastify application code:

```
1. IDENTIFY the failure
   - What assertion failed?
   - What was expected vs actual?
   - Capture error messages and stack traces

2. HYPOTHESIZE
   - Form 1-3 hypotheses about root cause
   - Be specific: "The history loading in X doesn't Y because Z"

3. INVESTIGATE
   - Read relevant application code
   - Trace the data flow
   - Look for evidence supporting or refuting each hypothesis

4. CONFIRM or DISPROVE
   - For each hypothesis, state: CONFIRMED, DISPROVEN, or INCONCLUSIVE
   - Provide evidence for the conclusion

5. RECOMMEND
   - Provide specific, actionable recommendations
   - Reference file:line where changes would be needed
   - Estimate complexity (trivial / moderate / significant)
   - Note any dependencies or risks

6. REPORT to user
   - Do NOT implement fixes
   - Present analysis and recommendations for user decision
```

---

## KEY FILES

- `test-suites/tdd-api/openai-prompts.test.ts` (add test here)
- `test-suites/tdd-api/README.md`
- `src/core/schema.ts` (reference for types)
- `src/core/reducer.ts` (ResponseReducer)
- `src/api/routes/v2/` (submit, stream, threads endpoints)

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

### If Tests Pass:

- [ ] Multi-turn test added to `openai-prompts.test.ts`
- [ ] README.md updated with new test
- [ ] Hydrated vs persisted comparison for all 3 turns
  - [ ] Response-level fields (id, turn_id, thread_id, model_id, provider_id, status, finish_reason, output_items.length)
  - [ ] OutputItem fields (id, type, content, origin for messages)
  - [ ] Usage fields (prompt_tokens, completion_tokens, total_tokens)
  - [ ] Timestamps excluded (created_at, updated_at)
- [ ] `bun run test:tdd-api` executes
- [ ] All tests pass
- [ ] Tests complete within 20 second timeout
- [ ] Tests do NOT hang after pass/fail
- [ ] `bun run format` - no changes
- [ ] `bun run lint` - no errors
- [ ] `bun run typecheck` - no errors
- [ ] Format/lint/typecheck run sequentially with no changes or errors

### If Tests Fail (Application Issues):

- [ ] Multi-turn test added to `openai-prompts.test.ts`
- [ ] Test code includes hydrated vs persisted comparison (even if failing)
- [ ] Test code is correct (issue confirmed in application)
- [ ] Analysis completed per failure handling workflow
- [ ] Hypotheses formed and investigated
- [ ] Each hypothesis marked CONFIRMED, DISPROVEN, or INCONCLUSIVE
- [ ] Recommendations provided with file:line references
- [ ] Complexity estimates provided
- [ ] `bun run format` - no changes
- [ ] `bun run lint` - no errors
- [ ] `bun run typecheck` - no errors

---

## OUTPUT FORMAT

### If Tests Pass:

```
### Definition of Done

**Standard Checks:**
- [ ] Format clean (no changes)
- [ ] Lint clean (no errors)
- [ ] Typecheck clean (no errors)
- [ ] All three ran sequentially with no changes or errors

**Job-Specific Items:**
- [ ] Multi-turn test added
- [ ] README.md updated
- [ ] All tests pass
- [ ] Tests complete within 20 seconds
- [ ] Tests do NOT hang

**Hydrated vs Persisted Comparison (all 3 turns):**
- [ ] Response-level fields compared (id, turn_id, thread_id, model_id, provider_id, status, finish_reason, output_items.length)
- [ ] OutputItem fields compared (id, type, content, origin for messages)
- [ ] Usage fields compared (prompt_tokens, completion_tokens, total_tokens)
- [ ] Timestamps correctly excluded

### Changes Made

- `path/to/file.ts` - What was changed

### Recommendations

- [Any suggestions for future work]
```

### If Tests Fail (Application Issues):

```
### Test Status

**Result:** FAIL - Application code issue identified

**Failure Point:**
- Test: [test name]
- Assertion: [what failed]
- Expected: [expected value]
- Actual: [actual value]
- Error: [error message if any]

### Analysis

**Hypothesis 1:** [Specific hypothesis]
- Evidence for: [what supports this]
- Evidence against: [what contradicts this]
- **Status:** CONFIRMED / DISPROVEN / INCONCLUSIVE

**Hypothesis 2:** [If applicable]
...

### Root Cause

[Summary of confirmed root cause]

### Recommendations

**Recommendation 1:** [Specific action]
- File: `path/to/file.ts:lineNumber`
- Change: [What needs to change]
- Complexity: trivial / moderate / significant
- Risks: [Any risks or dependencies]

**Recommendation 2:** [If applicable]
...

### Definition of Done (Partial)

**Completed:**
- [ ] Multi-turn test added (correctly written)
- [ ] Analysis completed
- [ ] Recommendations provided

**Blocked (awaiting user decision):**
- [ ] Tests passing (requires application fix)
```

---

## STARTING POINT

1. Read this entire prompt
2. Review existing tests in `openai-prompts.test.ts` for patterns
3. Implement the multi-turn test
4. Run `bun run test:tdd-api`
5. If pass → complete DoD
6. If fail due to test code → fix and retry
7. If fail due to application code → analyze and report

**Focus on correctness. Do NOT fix application code - analyze and recommend only.**
