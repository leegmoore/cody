# CODER PROMPT: anthropic-tests

**Generated:** 2025-11-26
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer. Your task: **Add Anthropic API connectivity check and create a test suite for Anthropic provider with simple prompt and tool call tests.**

This is a two-phase task with a mandatory gate between phases:
1. **Phase 1:** Add Anthropic check to validate-env.ts
2. **GATE:** Verify existing OpenAI tests still pass
3. **Phase 2:** Create anthropic-prompts.test.ts with 2 tests

---

## PROJECT CONTEXT

**cody-fastify** is a streaming-first LLM harness. We need this work because:

- Validating Anthropic provider works end-to-end
- Ensuring multi-provider support is functional
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

The tdd-api test suite exists at `test-suites/tdd-api/` with:
- `validate-env.ts` - 4 environment checks (Redis, Convex, OpenAI, Fastify)
- `openai-prompts.test.ts` - 4 tests (simple-prompt, tool-calls, multi-turn, reasoning)
- `README.md` - Suite documentation

---

## PHASE 1: Add Anthropic Environment Check

### Implementation

Add `checkAnthropic()` function to `validate-env.ts`:

```typescript
async function checkAnthropic(): Promise<EnvCheckResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    const res = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 200) {
      return {
        name: "Anthropic",
        status: "ok",
        message: "API reachable, key valid",
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        name: "Anthropic",
        status: "fail",
        message: "API key invalid or missing",
      };
    }
    return {
      name: "Anthropic",
      status: "fail",
      message: `Unexpected status: ${res.status}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "Anthropic",
      status: "fail",
      message: `Not reachable: ${msg}`,
    };
  }
}
```

Add to `validateEnvironment()`:
```typescript
// 5. Check Anthropic API connectivity
results.push(await checkAnthropic());
```

---

## GATE 1: Verify Existing Tests Pass

### **STOP. Do not proceed to Phase 2 until this gate passes.**

After adding the Anthropic check, run:

```bash
cd cody-fastify && bun run test:tdd-api
```

### Gate Requirements (ALL must pass):

- [ ] Environment validation shows 5 checks
- [ ] All 5 environment checks pass (Redis, Convex, OpenAI, Fastify, Anthropic)
- [ ] All 4 OpenAI tests pass (simple-prompt, tool-calls, multi-turn, reasoning)
- [ ] No test hangs or timeouts

### If Gate Fails:

- Fix the issue
- Re-run tests
- Do NOT proceed to Phase 2 until gate passes

### If Gate Passes:

- Proceed to Phase 2

---

## PHASE 2: Create Anthropic Test File

### File: `test-suites/tdd-api/anthropic-prompts.test.ts`

Create a new test file following the same patterns as `openai-prompts.test.ts`.

### Test 1: Simple Prompt

**Request:**
```typescript
const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "hi cody",
    providerId: "anthropic",
    model: "claude-haiku-4-5",
  }),
});
```

**Key Assertions:**
- Submit returns 202 with valid UUID runId
- response_start event has `provider_id: "anthropic"` and `model_id: "claude-haiku-4-5"`
- At least 1 message item_done event
- response_done with status "complete"
- Persisted run has `provider_id: "anthropic"`
- Hydrated vs persisted comparison passes

### Test 2: Tool Calls (pwd and ls)

**Request:**
```typescript
const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "please run a shell pwd in 1 tool call and a shell ls in another tool call then in your next response to me tell me what the working directory is and the first 10 files and directories in that working directory",
    providerId: "anthropic",
    model: "claude-haiku-4-5",
  }),
});
```

**Key Assertions:**
- Submit returns 202 with valid UUID runId
- response_start event has `provider_id: "anthropic"`
- At least 2 function_call item_done events
- At least 2 function_call_output item_done events
- Each function_call has matching function_call_output (by call_id)
- At least 1 message item_done (final response)
- response_done with status "complete"
- Hydrated vs persisted comparison passes for all item types

---

## HYDRATED VS PERSISTED COMPARISON

For both tests, implement full field-by-field comparison.

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

  expect(hydratedItem.id).toBe(persistedItem.id);
  expect(hydratedItem.type).toBe(persistedItem.type);

  if (hydratedItem.type === "message") {
    expect(hydratedItem.content).toBe(persistedItem.content);
    expect(hydratedItem.origin).toBe(persistedItem.origin);
  }

  if (hydratedItem.type === "function_call") {
    expect(hydratedItem.name).toBe(persistedItem.name);
    expect(hydratedItem.arguments).toBe(persistedItem.arguments);
    expect(hydratedItem.call_id).toBe(persistedItem.call_id);
    expect(hydratedItem.origin).toBe(persistedItem.origin);
  }

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

**Fields to EXCLUDE:** created_at, updated_at

---

## KEY FILES

**To modify:**
- `test-suites/tdd-api/validate-env.ts` - Add checkAnthropic()
- `test-suites/tdd-api/README.md` - Update docs

**To create:**
- `test-suites/tdd-api/anthropic-prompts.test.ts` - New test file

**Reference:**
- `test-suites/tdd-api/openai-prompts.test.ts` - Pattern to follow
- `src/core/adapters/anthropic-adapter.ts` - Anthropic implementation

---

## TECHNICAL STANDARDS

### Infrastructure Rules

**NO MOCKING of infrastructure.** Use real:
- Redis (local)
- Convex (local)
- Workers
- LLM API (real Anthropic calls)

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
- Exact count assertions (use >= for tool calls)

---

## DEFINITION OF DONE

### Phase 1:

- [ ] `checkAnthropic()` added to `validate-env.ts`
- [ ] Environment validation shows 5 checks

### Gate 1:

- [ ] **All 5 environment checks pass**
- [ ] **All 4 OpenAI tests pass**

### Phase 2:

- [ ] `anthropic-prompts.test.ts` created
- [ ] Simple prompt test with hydrated vs persisted comparison
- [ ] Tool calls test with hydrated vs persisted comparison
- [ ] Both tests verify `provider_id: "anthropic"`
- [ ] Both tests verify `model_id: "claude-haiku-4-5"`
- [ ] README.md updated

### Final:

- [ ] `bun run test:tdd-api` executes
- [ ] All 6 tests pass (4 OpenAI + 2 Anthropic)
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

**Phase 1 - Environment Check:**
- [ ] checkAnthropic() added
- [ ] 5 environment checks shown

**Gate 1 - Regression Check:**
- [ ] All 5 env checks pass
- [ ] All 4 OpenAI tests pass
- [ ] No regressions

**Phase 2 - Anthropic Tests:**
- [ ] anthropic-prompts.test.ts created
- [ ] Simple prompt test implemented
- [ ] Tool calls test implemented
- [ ] README.md updated

**Hydrated vs Persisted (Simple Prompt):**
- [ ] Response-level fields compared
- [ ] message items: id, type, content, origin compared
- [ ] Usage fields compared
- [ ] Timestamps excluded

**Hydrated vs Persisted (Tool Calls):**
- [ ] Response-level fields compared
- [ ] message items compared
- [ ] function_call items: id, type, name, arguments, call_id, origin compared
- [ ] function_call_output items: id, type, call_id, output, success, origin compared
- [ ] Usage fields compared
- [ ] Timestamps excluded

**Standard Checks:**
- [ ] Format clean (no changes)
- [ ] Lint clean (no errors)
- [ ] Typecheck clean (no errors)
- [ ] All ran sequentially with no changes or errors

**All Tests:**
- [ ] simple-prompt (OpenAI): PASS
- [ ] tool-calls (OpenAI): PASS
- [ ] multi-turn (OpenAI): PASS
- [ ] reasoning (OpenAI): PASS
- [ ] simple-prompt (Anthropic): PASS
- [ ] tool-calls (Anthropic): PASS

### Changes Made

- `test-suites/tdd-api/validate-env.ts` - Added checkAnthropic()
- `test-suites/tdd-api/anthropic-prompts.test.ts` - NEW (2 tests)
- `test-suites/tdd-api/README.md` - Updated
```

---

## STARTING POINT

1. Read this entire prompt
2. **Phase 1:** Add `checkAnthropic()` to validate-env.ts
3. **GATE 1:** Run `bun run test:tdd-api` - verify all pass
4. **Phase 2:** Create anthropic-prompts.test.ts with 2 tests
5. Update README.md
6. Run full suite - all 6 tests pass
7. Run format, lint, typecheck
8. Report results

**Focus on the gate. Do NOT proceed to Phase 2 if Gate 1 fails.**
