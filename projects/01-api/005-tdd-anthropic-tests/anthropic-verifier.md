# VERIFIER PROMPT: anthropic-tests

**Generated:** 2025-11-26
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer verifying completed implementation work.

Your task: Review the implementation of **Anthropic API connectivity check and Anthropic test suite.**

---

## PROJECT CONTEXT

**cody-fastify** is a streaming-first LLM harness built on:
- Fastify (API server)
- Redis Streams (event transport)
- Convex (persistence)
- OpenAI Responses API schema (canonical data model)

---

## ORIGINAL TASK

The coder was asked to:

1. **Phase 1:** Add `checkAnthropic()` to `validate-env.ts` (5th environment check)
2. **Gate 1:** Verify all 4 existing OpenAI tests still pass
3. **Phase 2:** Create `anthropic-prompts.test.ts` with 2 tests (simple prompt, tool calls)

---

## KEY FILES TO REVIEW

- `test-suites/tdd-api/validate-env.ts` - Should have `checkAnthropic()`
- `test-suites/tdd-api/anthropic-prompts.test.ts` - NEW file with 2 tests
- `test-suites/tdd-api/README.md` - Should be updated

---

## VERIFICATION CHECKLIST

### Phase 1: Environment Check

**checkAnthropic() function:**
- [ ] Uses endpoint: `https://api.anthropic.com/v1/models`
- [ ] Uses header: `x-api-key` (not `Authorization: Bearer`)
- [ ] Uses header: `anthropic-version: 2023-06-01`
- [ ] Has timeout (AbortSignal.timeout)
- [ ] Handles 200 (ok), 401/403 (invalid key), other statuses
- [ ] Returns proper EnvCheckResult structure

**validateEnvironment():**
- [ ] Calls `checkAnthropic()` as 5th check
- [ ] Order: Redis, Convex, OpenAI, Fastify, Anthropic

### Gate 1: Regression Check

- [ ] Coder confirmed all 5 environment checks pass
- [ ] Coder confirmed all 4 OpenAI tests pass
- [ ] No regressions introduced

### Phase 2: Anthropic Tests

**Test file structure:**
- [ ] File: `anthropic-prompts.test.ts`
- [ ] Imports validateEnvironment, StreamEvent, ResponseReducer
- [ ] describe block: `"tdd-api: anthropic-prompts"`
- [ ] beforeAll calls validateEnvironment()
- [ ] Tests use test.concurrent()

**Test 1: Simple Prompt**
- [ ] Request includes `providerId: "anthropic"`
- [ ] Request includes `model: "claude-haiku-4-5"`
- [ ] Asserts response_start has `provider_id: "anthropic"`
- [ ] Asserts response_start has `model_id: "claude-haiku-4-5"`
- [ ] Asserts message item_done received
- [ ] Asserts response_done with status "complete"
- [ ] Polls for persistence (not fixed wait)
- [ ] Hydrated vs persisted comparison implemented

**Test 2: Tool Calls**
- [ ] Request includes `providerId: "anthropic"`
- [ ] Request includes `model: "claude-haiku-4-5"`
- [ ] Asserts >= 2 function_call item_done events (not ==)
- [ ] Asserts >= 2 function_call_output item_done events (not ==)
- [ ] Asserts call_id matching between function_call and function_call_output
- [ ] Asserts final message item_done
- [ ] Polls for persistence (not fixed wait)
- [ ] Hydrated vs persisted comparison for all item types

### Hydrated vs Persisted Comparison

**Simple Prompt Test:**

Response-level (must compare):
- [ ] id
- [ ] turn_id
- [ ] thread_id
- [ ] model_id
- [ ] provider_id
- [ ] status
- [ ] finish_reason
- [ ] output_items.length

OutputItem - message (must compare):
- [ ] id
- [ ] type
- [ ] content
- [ ] origin

Usage (must compare):
- [ ] prompt_tokens
- [ ] completion_tokens
- [ ] total_tokens

Timestamps (must exclude):
- [ ] created_at, updated_at NOT compared

**Tool Calls Test:**

All of the above, plus:

OutputItem - function_call (must compare):
- [ ] id
- [ ] type
- [ ] name
- [ ] arguments
- [ ] call_id
- [ ] origin

OutputItem - function_call_output (must compare):
- [ ] id
- [ ] type
- [ ] call_id
- [ ] output
- [ ] success
- [ ] origin

---

## ANTI-PATTERNS TO CHECK

### Environment Check:
- Using `Authorization: Bearer` instead of `x-api-key` (wrong header format)
- Missing `anthropic-version` header
- No timeout

### Test Code:
- Mocks anywhere
- Fixed waits instead of polling
- Exact count assertions (== 2 instead of >= 2) for tool calls
- Missing `providerId: "anthropic"` in requests
- Missing `model: "claude-haiku-4-5"` in requests
- Not verifying `provider_id` in response_start or persisted run
- Missing field comparisons in hydrated vs persisted
- `any` types

---

## VERIFICATION STEPS

1. **Review validate-env.ts**
   - Check checkAnthropic() implementation
   - Verify correct headers (x-api-key, anthropic-version)
   - Verify it's called as 5th check

2. **Run DoD checks**
   - Run format, lint, typecheck sequentially
   - Verify no changes or errors

3. **Run the tests**
   - Execute `bun run test:tdd-api`
   - Verify all 6 tests pass (4 OpenAI + 2 Anthropic)
   - Verify 5 environment checks shown and pass
   - Verify no hang after completion

4. **Review anthropic-prompts.test.ts**
   - Check both tests include providerId and model
   - Check response_start assertions verify provider_id/model_id
   - Check persisted run assertions verify provider_id
   - Check hydrated vs persisted comparison is complete

5. **Verify provider-specific assertions**
   - provider_id should be "anthropic" (not "openai")
   - model_id should be "claude-haiku-4-5"

6. **Provide recommendation**

---

## OUTPUT FORMAT

```
### Recommendation

**[X] RECOMMENDED** for approval
**[ ] NOT RECOMMENDED** - needs revision

### Phase 1 Verification (Environment Check)

**checkAnthropic():**
- [ ] Correct endpoint (api.anthropic.com/v1/models)
- [ ] Correct headers (x-api-key, anthropic-version)
- [ ] Timeout implemented
- [ ] Error handling correct

**validateEnvironment():**
- [ ] 5 checks shown
- [ ] Anthropic is 5th check

### Gate 1 Verification

- [ ] Coder confirmed gate passed
- [ ] All 4 OpenAI tests still pass

### Phase 2 Verification (Anthropic Tests)

**Simple Prompt Test:**
- [ ] providerId: "anthropic" in request
- [ ] model: "claude-haiku-4-5" in request
- [ ] provider_id verified in response_start
- [ ] provider_id verified in persisted run
- [ ] Hydrated vs persisted comparison complete

**Tool Calls Test:**
- [ ] providerId: "anthropic" in request
- [ ] model: "claude-haiku-4-5" in request
- [ ] >= 2 function_calls (not exact count)
- [ ] call_id matching verified
- [ ] Hydrated vs persisted for all item types

### Hydrated vs Persisted - Simple Prompt

- [ ] Response-level fields compared
- [ ] message items compared (id, type, content, origin)
- [ ] Usage fields compared
- [ ] Timestamps excluded

### Hydrated vs Persisted - Tool Calls

- [ ] Response-level fields compared
- [ ] message items compared
- [ ] function_call items compared (id, type, name, arguments, call_id, origin)
- [ ] function_call_output items compared (id, type, call_id, output, success, origin)
- [ ] Usage fields compared
- [ ] Timestamps excluded

### Standard Checks

- [ ] Format clean
- [ ] Lint clean
- [ ] Typecheck clean
- [ ] All ran sequentially with no changes or errors

### All Tests Pass

- [ ] simple-prompt (OpenAI)
- [ ] tool-calls (OpenAI)
- [ ] multi-turn (OpenAI)
- [ ] reasoning (OpenAI)
- [ ] simple-prompt (Anthropic)
- [ ] tool-calls (Anthropic)

### Code Review Findings

**Positive:**
- [What was done well]

**Issues Found:**
- [Issue]: [Description] - [Severity: Critical/Major/Minor]

### Reasoning

[Explain recommendation]
```

---

## STARTING POINT

1. Review validate-env.ts for checkAnthropic()
2. Verify correct Anthropic API headers
3. Run format, lint, typecheck
4. Run tests and verify all 6 pass
5. Review anthropic-prompts.test.ts
6. Verify provider-specific assertions (anthropic, claude-haiku-4-5)
7. Verify hydrated vs persisted comparison completeness
8. Write recommendation

**Key focus: Anthropic-specific headers and provider_id/model_id verification.**
