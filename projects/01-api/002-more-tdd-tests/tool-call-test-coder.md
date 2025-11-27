# CODER PROMPT: tool-call-test

**Generated:** 2025-11-26
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer. Your task: **Add a tool call integration test to the existing tdd-api test suite, validating the complete tool execution flow.**

You will implement the specified changes, follow technical standards, complete all definition of done items, and report issues and recommendations.

---

## PROJECT CONTEXT

**cody-fastify** is a streaming-first LLM harness. We need this work because:

- Building toward a production-ready streaming LLM platform
- Validating that tool calls stream correctly and persist properly
- Ensuring real integration (no mocked infrastructure)

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

**Core Design:** One shape (OpenAI Responses API schema) at multiple hydration levels:
- **Streaming** - Events flowing in real-time
- **Dehydrated** - Complete but compact (persistence)
- **Hydrated** - Reconstructed rich objects (UI)

**Key Components:**
- `src/core/schema.ts` - Canonical Zod schemas (Response, StreamEvent, OutputItem)
- `src/core/reducer.ts` - Event accumulation into Response state
- `src/core/adapters/` - Provider adapters (OpenAI, Anthropic)
- `src/workers/` - Persistence and tool execution workers

---

## CURRENT STATE

Phase 1 complete. The tdd-api test suite exists at `test-suites/tdd-api/` with:
- `validate-env.ts` - Environment validation (Redis, Convex, OpenAI, Fastify checks)
- `simple-prompt.test.ts` - First integration test (submit → stream → persist → verify)
- `README.md` - Suite documentation

All environment validation and the simple prompt test are working. Test runs with 20 second timeout.

---

## TECHNICAL SPECIFICATION

### File Rename

Rename `simple-prompt.test.ts` → `openai-prompts.test.ts`

### Test Execution Structure

```
beforeAll: validateEnvironment()
    ↓
test: "simple prompt" ──────────────┐
                                    ├── run in PARALLEL
test: "tool calls" ─────────────────┘
```

Both tests are multi-stage internally (submit → stream → persist → verify), but the two tests run concurrently with each other.

### New Test: Tool Calls

**Prompt:**
```
"please run a shell pwd in 1 tool call and a shell ls in another tool call then in your next response to me tell me what the working directory is and the first 10 files and directories in that working directory"
```

**Test Flow:**

```
PHASE 1: Submit prompt
  POST /api/v2/submit { prompt: "<tool call prompt>" }
  → Assert 202 response with valid UUID runId

PHASE 2: Stream response
  GET /api/v2/stream/:runId (SSE)
  → Collect events until response_done
  → Hydrate events using ResponseReducer
  → Assert event sequence and shapes
  → Save hydrated Response for comparison

PHASE 2 ASSERTIONS - Tool Call Specific:
  → Assert item_start events with item_type: "function_call" - count >= 2
  → Assert item_done events with final_item.type: "function_call" - count >= 2
  → Assert item_done events with final_item.type: "function_call_output" - count >= 2
  → Assert each function_call has name, call_id populated
  → Assert final message exists (model's summary response)

PHASE 3: Validate persistence
  Poll GET /api/v2/threads/:threadId until run status is terminal
  → Assert thread structure
  → Assert run persisted correctly
  → Assert output_items contains >= 2 function_call items
  → Assert output_items contains >= 2 function_call_output items
  → Assert each function_call has matching function_call_output (by call_id)
  → Compare hydrated Response to persisted run (detailed field matching)
```

### Assertions Summary

**Streaming Phase:**
| Assertion | Criteria |
|-----------|----------|
| function_call item_start | count >= 2 |
| function_call item_done | count >= 2 |
| function_call_output item_done | count >= 2 |
| function_call has name | all function_calls |
| function_call has call_id | all function_calls |
| final message exists | exactly 1 agent message at end |

**Persistence Phase:**
| Assertion | Criteria |
|-----------|----------|
| output_items function_call | count >= 2 |
| output_items function_call_output | count >= 2 |
| call_id matching | each function_call has matching output |

### Hydrated vs Persisted Comparison (Detailed)

Follow the pattern from the existing simple-prompt test. Compare field-by-field, excluding timestamp fields (created_at, updated_at).

**Response-level fields:**
```typescript
expect(hydratedResponse.id).toBe(run.id);
expect(hydratedResponse.turn_id).toBe(run.turn_id);
expect(hydratedResponse.thread_id).toBe(run.thread_id);
expect(hydratedResponse.model_id).toBe(run.model_id);
expect(hydratedResponse.provider_id).toBe(run.provider_id);
expect(hydratedResponse.status).toBe(run.status);
expect(hydratedResponse.finish_reason).toBe(run.finish_reason);
expect(hydratedResponse.output_items.length).toBe(run.output_items.length);
```

**For each output_item, compare by type:**

```typescript
for (let i = 0; i < hydratedResponse.output_items.length; i++) {
  const hydratedItem = hydratedResponse.output_items[i];
  const persistedItem = run.output_items[i];

  // Common fields for all types
  expect(hydratedItem.id).toBe(persistedItem.id);
  expect(hydratedItem.type).toBe(persistedItem.type);

  // Type-specific field comparisons
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
expect(hydratedResponse.usage?.prompt_tokens).toBe(run.usage.prompt_tokens);
expect(hydratedResponse.usage?.completion_tokens).toBe(run.usage.completion_tokens);
expect(hydratedResponse.usage?.total_tokens).toBe(run.usage.total_tokens);
```

### call_id Matching

Verify each function_call has a corresponding function_call_output with matching call_id:

```typescript
const functionCalls = run.output_items.filter(i => i.type === "function_call");
const functionCallOutputs = run.output_items.filter(i => i.type === "function_call_output");

for (const call of functionCalls) {
  const matchingOutput = functionCallOutputs.find(o => o.call_id === call.call_id);
  expect(matchingOutput).toBeDefined();
  expect(matchingOutput.success).toBe(true);
}
```

### Coder Workflow

**Step 1:** Update package.json timeout from 20000 to 10000:
```json
"test:tdd-api": "bun test test-suites/tdd-api/ --timeout 10000"
```

**Step 2:** Ensure package.json has a `typecheck` script (if not present, add it):
```json
"typecheck": "tsc --noEmit"
```

**Step 3:** Rename test file:
```bash
mv test-suites/tdd-api/simple-prompt.test.ts test-suites/tdd-api/openai-prompts.test.ts
```

**Step 4:** Update describe block name from `"tdd-api: simple-prompt"` to `"tdd-api: openai-prompts"`.

**Step 5:** Add tool call test in `openai-prompts.test.ts` that runs parallel with existing test.

**Step 6:** Update README.md with file rename and new test case.

**Step 7:** Run verification - both tests pass, no hang, under 10 second timeout.

---

## KEY FILES

- `test-suites/tdd-api/simple-prompt.test.ts` (rename to `openai-prompts.test.ts`)
- `test-suites/tdd-api/README.md`
- `package.json`
- `src/core/schema.ts` (reference for types)
- `src/core/reducer.ts` (ResponseReducer)

---

## TECHNICAL STANDARDS

### Infrastructure Rules

**NO MOCKING of infrastructure.** Use real:
- Redis (local)
- Convex (local)
- Workers

**Only mock:** External LLM API responses. (In this case, we use REAL LLM API - no mocking at all.)

### Code Quality

- TypeScript strict mode
- Zod for runtime validation
- Explicit error handling (no silent failures)
- Domain-specific naming (threadId, runId, StreamEvent)
- Strong types throughout (no `any`)

### Convergent Defaults to Avoid

Models drift toward these patterns. Explicitly avoid:
- Mocking everything (use real infrastructure)
- Generic variable names (use domain terms)
- Copy-paste without adaptation
- Minimal implementations
- Skipping tests

### Job-Specific Constraints

- Do NOT add environment variable pre-checks - just attempt connections
- Do NOT use fixed waits for persistence - use polling
- Do NOT assert exact tool call count (==2) - use >= 2 to allow for retries
- Do NOT modify validate-env.ts - it's already working

---

## DEFINITION OF DONE

All items must be checked off before completion.

### Standard Checks

Run these sequentially. If any produces changes or errors, fix and re-run ALL from the beginning.

- [ ] `bun run format` - no changes
- [ ] `bun run lint` - no errors
- [ ] `bun run typecheck` - no errors
- [ ] All three ran sequentially with no changes or errors between runs

### Job-Specific Items

- [ ] README.md updated with new test and file rename
- [ ] `simple-prompt.test.ts` renamed to `openai-prompts.test.ts`
- [ ] package.json timeout updated to 10000
- [ ] package.json has `typecheck` script
- [ ] `bun run test:tdd-api` executes
- [ ] Both tests pass
- [ ] Tests complete within 10 second timeout
- [ ] Tests do NOT hang after pass/fail

---

## OUTPUT FORMAT

Provide your final output in this format:

```
### Definition of Done

**Standard Checks:**
- [ ] Format clean (no changes)
- [ ] Lint clean (no errors)
- [ ] Typecheck clean (no errors)
- [ ] All three ran sequentially with no changes or errors

**Job-Specific Items:**
- [ ] README.md updated with new test
- [ ] simple-prompt.test.ts renamed to openai-prompts.test.ts
- [ ] package.json timeout updated to 10000
- [ ] package.json has typecheck script
- [ ] bun run test:tdd-api executes
- [ ] Both tests pass
- [ ] Tests complete within 10 second timeout
- [ ] Tests do NOT hang after pass/fail

### Changes Made

- `path/to/file.ts` - What was changed

### Issues Encountered

- Issue: [Description]
- Resolution: [How handled or "Unresolved - needs attention"]

### Recommendations

- **Priority 1:** [Most important]
- **Priority 2:** [Next important]
- **Priority 3:** [Nice to have]
```

---

## STARTING POINT

1. Read this entire prompt
2. Review the existing `simple-prompt.test.ts` to understand the pattern
3. Rename the file first
4. Add the new test following the same structure
5. Update README and package.json
6. Run verification
7. Complete all DoD items before finishing

**Focus on correctness and integration over speed.**
