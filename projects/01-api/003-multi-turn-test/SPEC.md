# Technical Specification: Multi-Turn Conversation Test

**Project:** 003-multi-turn-test
**Created:** 2025-11-26
**Status:** Draft

---

## 1. Overview

**Purpose:** Add a multi-turn conversation test to the tdd-api test suite, validating that conversation history is maintained across multiple turns.

**Primary Function:** Submit 3 prompts on the same thread, verify each response streams correctly, validate all 3 turns are persisted to the thread with correct history context.

**Location:**
```
cody-fastify/
  test-suites/
    tdd-api/
      README.md                 # Suite documentation (update)
      validate-env.ts           # Environment validation (no change)
      openai-prompts.test.ts    # Add multi-turn test
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
5. `openai-prompts.test.ts` with existing tests (simple-prompt, tool-calls)

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

## 5. Test Structure

### 5.1 Test Execution Order

```
beforeAll: validateEnvironment()
    ↓
test: "simple prompt" ──────────────┐
                                    │
test: "tool calls" ─────────────────┼── run in PARALLEL
                                    │
test: "multi-turn conversation" ────┘
```

All tests are multi-stage internally, running concurrently with each other.

---

## 6. New Test: Multi-Turn Conversation

### 6.1 Test Case

Submit 3 prompts on the same thread, verify conversation context is maintained, validate all turns are persisted correctly.

**Characteristics:**
- 3 prompts, 3 responses
- Same thread throughout
- No tool calls
- No thinking/reasoning
- Simple message content only

### 6.2 Conversation Flow

```
Turn 1:
  User: "Hi cody how are you"
  Agent: [response]

Turn 2:
  User: "This is great to hear!"
  Agent: [response]

Turn 3:
  User: "Have a good evening!"
  Agent: [response]
```

### 6.3 Test Flow

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
  → Assert runs are in correct order (by created_at or turn sequence)
```

### 6.4 Assertions Summary

**Per-Turn Streaming Phase:**
| Assertion | Criteria |
|-----------|----------|
| Submit response | 202 status |
| runId | Valid UUID |
| threadId | Consistent across all turns |
| response_start | Event received |
| item_start (message) | At least 1 |
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
| Run order | turn 1 < turn 2 < turn 3 |

### 6.5 Hydrated vs Persisted Comparison (Detailed)

For each of the 3 turns, compare the hydrated response (from ResponseReducer) to the persisted run (from GET /api/v2/threads/:threadId). Exclude timestamp fields (created_at, updated_at).

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

**Summary table:**

| Object | Fields to Compare |
|--------|-------------------|
| Response | id, turn_id, thread_id, model_id, provider_id, status, finish_reason, output_items.length |
| OutputItem (all) | id, type |
| OutputItem (message) | content, origin |
| Usage | prompt_tokens, completion_tokens, total_tokens |

**Fields to EXCLUDE (timestamps):**
- created_at, updated_at

---

## 7. Failure Handling

### 7.1 Test Code Issues vs Fastify Code Issues

**If tests fail due to TEST CODE or HARNESS issues:**
- Fix the test code
- Continue with implementation

**If tests fail due to FASTIFY/APPLICATION CODE issues:**
- **DO NOT fix the application code**
- Instead, perform analysis (see 7.2)

### 7.2 Analysis Workflow (For Application Failures)

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

## 8. Coder Workflow

### Step 1: Add multi-turn test
Add new test in `openai-prompts.test.ts`:

```typescript
test("multi-turn conversation", async () => {
  // PHASE 1: Turn 1 - "Hi cody how are you"
  // PHASE 2: Turn 2 - "This is great to hear!"
  // PHASE 3: Turn 3 - "Have a good evening!"
  // PHASE 4: Validate thread has all 3 runs
});
```

### Step 2: Implement turn submission helper (optional)
If helpful, extract common turn logic to reduce duplication.

### Step 3: Update README.md
Add multi-turn test to test documentation.

### Step 4: Run and verify
- All tests must pass (or analysis provided if application issues)
- Tests must NOT hang after completion

### Step 5: Handle failures appropriately
- Test/harness issues → Fix and re-run
- Application issues → Analyze and report (see Section 7.2)

---

## 9. Definition of Done

### If Tests Pass:

| # | Criteria | |
|---|----------|---|
| 1 | Multi-turn test added to `openai-prompts.test.ts` | |
| 2 | README.md updated with new test | |
| 3 | Hydrated vs persisted comparison for all 3 turns | |
| 3a | - Response-level fields (id, turn_id, thread_id, model_id, provider_id, status, finish_reason, output_items.length) | |
| 3b | - OutputItem fields (id, type, content, origin for messages) | |
| 3c | - Usage fields (prompt_tokens, completion_tokens, total_tokens) | |
| 3d | - Timestamps excluded (created_at, updated_at) | |
| 4 | `bun run test:tdd-api` executes | |
| 5 | All tests pass | |
| 6 | Tests complete within 20 second timeout | |
| 7 | Tests do NOT hang after pass/fail | |
| 8 | `bun run format` - no changes | |
| 9 | `bun run lint` - no errors | |
| 10 | `bun run typecheck` - no errors | |
| 11 | **Checks 8-10 run sequentially with NO changes or errors between runs** | |

### If Tests Fail (Application Issues):

| # | Criteria | |
|---|----------|---|
| 1 | Multi-turn test added to `openai-prompts.test.ts` | |
| 2 | Test code includes hydrated vs persisted comparison (even if failing) | |
| 3 | Test code is correct (issue is in application) | |
| 4 | Analysis completed per Section 7.2 | |
| 5 | Hypotheses formed and investigated | |
| 6 | Recommendations provided with file:line references | |
| 7 | `bun run format` - no changes | |
| 8 | `bun run lint` - no errors | |
| 9 | `bun run typecheck` - no errors | |
| 10 | **Checks 7-9 run sequentially with NO changes or errors between runs** | |

---

## 10. File Deliverables

| File | Action |
|------|--------|
| `test-suites/tdd-api/openai-prompts.test.ts` | Add multi-turn test |
| `test-suites/tdd-api/README.md` | Update with new test |

---

## 11. API Reference

### Multi-Turn Scenario

**Turn 1 Request:**
```json
{
  "prompt": "Hi cody how are you"
}
```

**Turn 2 Request:**
```json
{
  "prompt": "This is great to hear!",
  "threadId": "<threadId from turn 1>"
}
```

**Turn 3 Request:**
```json
{
  "prompt": "Have a good evening!",
  "threadId": "<threadId from turn 1>"
}
```

**Expected Thread State (after all turns):**
```json
{
  "thread": {
    "threadId": "...",
    "modelProviderId": "openai",
    "model": "...",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "runs": [
    {
      "id": "...",
      "turn_id": "...",
      "thread_id": "...",
      "status": "complete",
      "output_items": [
        { "type": "message", "content": "...", "origin": "agent" }
      ]
    },
    {
      "id": "...",
      "turn_id": "...",
      "thread_id": "...",
      "status": "complete",
      "output_items": [
        { "type": "message", "content": "...", "origin": "agent" }
      ]
    },
    {
      "id": "...",
      "turn_id": "...",
      "thread_id": "...",
      "status": "complete",
      "output_items": [
        { "type": "message", "content": "...", "origin": "agent" }
      ]
    }
  ]
}
```

**Key Verification:**
- All 3 runs share the same `thread_id`
- Each run has distinct `id` and `turn_id`
- All runs have `status: "complete"`
- No `function_call` or `reasoning` items in any run
