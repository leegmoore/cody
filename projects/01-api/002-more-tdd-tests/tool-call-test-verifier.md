# VERIFIER PROMPT: tool-call-test

**Generated:** 2025-11-26
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer verifying completed implementation work.

Your task: Review the implementation of **Add a tool call integration test to the existing tdd-api test suite, validating the complete tool execution flow.**

You will run definition of done checks, review code against standards, assess completeness, and provide a clear recommendation.

---

## PROJECT CONTEXT

**cody-fastify** is a streaming-first LLM harness built on:
- Fastify (API server)
- Redis Streams (event transport)
- Convex (persistence)
- OpenAI Responses API schema (canonical data model)

**Core Design:** One shape at multiple hydration levels (streaming → dehydrated → hydrated).

**Key Components:**
- `src/core/schema.ts` - Canonical Zod schemas
- `src/core/reducer.ts` - Event accumulation
- `src/core/adapters/` - Provider adapters
- `src/workers/` - Persistence and tool workers

---

## ORIGINAL TASK

The coder was asked to: **Add a tool call integration test to the existing tdd-api test suite, validating the complete tool execution flow.**

### Technical Specification Given

**File Rename:** `simple-prompt.test.ts` → `openai-prompts.test.ts`

**Test Execution Structure:**
```
beforeAll: validateEnvironment()
    ↓
test: "simple prompt" ──────────────┐
                                    ├── run in PARALLEL
test: "tool calls" ─────────────────┘
```

**New Test Prompt:**
```
"please run a shell pwd in 1 tool call and a shell ls in another tool call then in your next response to me tell me what the working directory is and the first 10 files and directories in that working directory"
```

**Required Assertions:**

Streaming Phase:
- function_call item_start count >= 2
- function_call item_done count >= 2
- function_call_output item_done count >= 2
- Each function_call has name, call_id populated
- Final message exists

Persistence Phase:
- output_items function_call count >= 2
- output_items function_call_output count >= 2
- Each function_call has matching function_call_output (by call_id)

**Hydrated vs Persisted Comparison (Detailed):**

Response-level fields to compare:
- id, turn_id, thread_id, model_id, provider_id, status, finish_reason
- output_items.length

For each output_item by type:
- All types: id, type
- message: content, origin
- function_call: name, arguments, call_id, origin
- function_call_output: call_id, output, success, origin

Usage sub-object:
- prompt_tokens, completion_tokens, total_tokens

**Package.json:**
- `typecheck` script present

---

## KEY FILES TO REVIEW

- `test-suites/tdd-api/openai-prompts.test.ts` (renamed from simple-prompt.test.ts)
- `test-suites/tdd-api/README.md`
- `package.json`

---

## TECHNICAL STANDARDS TO VERIFY AGAINST

### Infrastructure Rules

**NO MOCKING of infrastructure.** Should use real:
- Redis (local)
- Convex (local)
- Workers
- LLM API (real OpenAI calls)

**Only mock:** Nothing - this is full integration.

### Code Quality

- TypeScript strict mode
- Zod for runtime validation
- Explicit error handling
- Domain-specific naming
- Strong types (no `any`)

### Anti-Patterns to Check For

- Mocks where there shouldn't be
- Shims/adapters bypassing real integration
- Scaffolds that change behavior
- Tests that don't test real behavior
- Shortcuts skipping infrastructure
- Environment variable pre-checks (should just try connection)
- Fixed waits instead of polling
- Exact count assertions (==2) instead of >= 2

### Hydrated vs Persisted Comparison Verification

Check that the test compares fields properly:

**Response-level (should compare):**
- id, turn_id, thread_id, model_id, provider_id, status, finish_reason
- output_items.length

**Output items by type (should compare):**

For `message` items:
- id, type, content, origin

For `function_call` items:
- id, type, name, arguments, call_id, origin

For `function_call_output` items:
- id, type, call_id, output, success, origin

**Usage sub-object (should compare):**
- prompt_tokens, completion_tokens, total_tokens

**Should NOT compare (timestamp fields):**
- created_at, updated_at

---

## DEFINITION OF DONE TO VERIFY

### Standard Checks

Run these sequentially. All must pass with no changes or errors.

- [ ] `bun run format` - no changes
- [ ] `bun run lint` - no errors
- [ ] `bun run typecheck` - no errors
- [ ] All three ran sequentially with no changes or errors between runs

### Job-Specific Items

- [ ] README.md updated with new test and file rename
- [ ] `simple-prompt.test.ts` renamed to `openai-prompts.test.ts`
- [ ] package.json has `typecheck` script
- [ ] `bun run test:tdd-api` executes
- [ ] Both tests pass
- [ ] Tests complete within 20 second timeout
- [ ] Tests do NOT hang after pass/fail

---

## VERIFICATION STEPS

1. **Run DoD checks**
   - Run format, lint, typecheck sequentially
   - Verify no changes or errors from any

2. **Run the tests**
   - Execute `bun run test:tdd-api`
   - Time the execution (must be < 20 seconds)
   - Verify no hang after completion

3. **Review the changes**
   - Check `openai-prompts.test.ts` - verify file was renamed and describe block updated
   - Check new tool call test follows same pattern as simple prompt test
   - Verify assertions use >= 2 (not == 2) for tool call counts
   - Check call_id matching logic between function_call and function_call_output

4. **Verify hydrated vs persisted comparison**
   - Response-level fields are compared
   - Each output_item type has proper field comparisons
   - Usage sub-object fields are compared
   - Timestamp fields are NOT compared

5. **Check for anti-patterns**
   - No mocks anywhere
   - No fixed waits (should use polling for persistence)
   - No env var pre-checks
   - No `any` types

6. **Review package.json**
   - typecheck script exists

7. **Review README.md**
   - Documents both tests
   - File rename reflected

8. **Provide recommendation**

---

## OUTPUT FORMAT

Provide your final output in this format:

```
### Recommendation

**[ ] RECOMMENDED** for approval
**[ ] NOT RECOMMENDED** - needs revision

### Definition of Done Verification

**Standard Checks:**
- [ ] Format clean (no changes)
- [ ] Lint clean (no errors)
- [ ] Typecheck clean (no errors)
- [ ] All three ran sequentially with no changes or errors

**Job-Specific Items:**
- [ ] README.md updated with new test
- [ ] simple-prompt.test.ts renamed to openai-prompts.test.ts
- [ ] package.json has typecheck script
- [ ] bun run test:tdd-api executes
- [ ] Both tests pass
- [ ] Tests complete within 20 second timeout
- [ ] Tests do NOT hang after pass/fail

### Code Review Findings

**Positive:**
- [What was done well]

**Issues Found:**
- [Issue]: [Description] - [Severity: Critical/Major/Minor]

**Hydrated vs Persisted Comparison:**
- [ ] Response-level fields compared correctly
- [ ] message items: id, type, content, origin compared
- [ ] function_call items: id, type, name, arguments, call_id, origin compared
- [ ] function_call_output items: id, type, call_id, output, success, origin compared
- [ ] Usage sub-object compared correctly
- [ ] Timestamp fields excluded from comparison

**Anti-Patterns Detected:**
- [None found / List any found]

### Reasoning

[Explain your recommendation. Why recommended or why not.]

### Risks if Approved Anyway

[If NOT RECOMMENDED, list risks of approving despite issues]

### Suggestions for Improvement

- [Actionable suggestions]
```

---

## STARTING POINT

1. Run the DoD verification (format, lint, typecheck sequentially)
2. Run the tests and time them
3. Review the changed files
4. Verify hydrated vs persisted comparison is complete
5. Check for anti-patterns
6. Write your recommendation

**Be thorough but fair. Focus on correctness and integration.**
