# VERIFIER PROMPT: reasoning-test

**Generated:** 2025-11-26
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer verifying completed implementation work.

Your task: Review the implementation of **configurable reasoning effort API and reasoning test.**

This was a two-phase task:
1. **Phase 1:** API changes to make reasoning configurable (not hardcoded)
2. **Phase 2:** Reasoning test that validates reasoning output items

---

## PROJECT CONTEXT

**cody-fastify** is a streaming-first LLM harness built on:
- Fastify (API server)
- Redis Streams (event transport)
- Convex (persistence)
- OpenAI Responses API schema (canonical data model)

---

## ORIGINAL TASK

### Phase 1: API Changes

The coder was asked to make reasoning configurable:

**Problem:** `openai-adapter.ts` had hardcoded `reasoning: { effort: "medium" }` on every request.

**Solution:**
1. Add `reasoningEffort` to submit endpoint schema (optional, enum: low/medium/high)
2. Add to `StreamAdapterParams` interface
3. Change OpenAI adapter to conditionally include reasoning only when specified
4. Include `summary: "auto"` when reasoning is enabled

### Phase 2: Reasoning Test

Add a test with:
- Prompt: Puzzle requiring thought (2-digit number, sum 11, reverse +27)
- `reasoningEffort: "low"`
- Assertions on reasoning output items (streaming, hydrated, persisted)
- Hydrated vs persisted comparison

---

## KEY FILES TO REVIEW

### API Changes (Phase 1):

- `src/api/routes/submit.ts` - `reasoningEffort` in schema, passed to adapter
- `src/core/model-factory.ts` - `reasoningEffort` in `StreamAdapterParams`
- `src/core/adapters/openai-adapter.ts` - Conditional reasoning block

### Test (Phase 2):

- `test-suites/tdd-api/openai-prompts.test.ts` - New reasoning test
- `test-suites/tdd-api/README.md` - Updated documentation

---

## VERIFICATION CHECKLIST

### Phase 1: API Changes

**Submit Schema (`submit.ts`):**
- [ ] `reasoningEffort` added to SubmitBody schema
- [ ] Type is `z.enum(["low", "medium", "high"]).optional()`
- [ ] Passed to `adapter.stream()` call

**Interface (`model-factory.ts`):**
- [ ] `reasoningEffort?: "low" | "medium" | "high"` in `StreamAdapterParams`

**OpenAI Adapter (`openai-adapter.ts`):**
- [ ] Hardcoded `reasoning: { effort: "medium" }` is REMOVED
- [ ] Conditional spread used: `...(options.reasoningEffort && { ... })`
- [ ] When enabled, includes `summary: "auto"`
- [ ] When NOT enabled, no `reasoning` field at all

**Regression Check:**
- [ ] Existing 3 tests still pass
- [ ] Timing improvement noted (tests faster without forced reasoning)

### Phase 2: Reasoning Test

**Test Structure:**
- [ ] Test named appropriately (e.g., "reasoning with puzzle")
- [ ] Uses `reasoningEffort: "low"` in submit request
- [ ] Uses the specified puzzle prompt
- [ ] Runs in parallel with other tests

**Assertions - Streaming:**
- [ ] Checks for reasoning item_done events
- [ ] Checks for message item_done events
- [ ] No function_call items expected

**Assertions - Hydrated:**
- [ ] output_items contains >= 1 reasoning item
- [ ] output_items contains >= 1 message item
- [ ] reasoning content is non-empty

**Assertions - Persisted:**
- [ ] Poll for run completion (not fixed wait)
- [ ] Verify reasoning items persisted
- [ ] Verify message items persisted

### Hydrated vs Persisted Comparison

**Response-level (must compare):**
- [ ] id
- [ ] turn_id
- [ ] thread_id
- [ ] model_id
- [ ] provider_id
- [ ] status
- [ ] finish_reason
- [ ] output_items.length

**OutputItem fields - message (must compare):**
- [ ] id
- [ ] type
- [ ] content
- [ ] origin

**OutputItem fields - reasoning (must compare):**
- [ ] id
- [ ] type
- [ ] content
- [ ] origin

**Usage sub-object (must compare):**
- [ ] prompt_tokens
- [ ] completion_tokens
- [ ] total_tokens

**Must NOT compare:**
- [ ] created_at, updated_at excluded

---

## ANTI-PATTERNS TO CHECK

### API Changes:
- Hardcoded reasoning still present (should be removed)
- Missing `summary: "auto"` when reasoning enabled
- Breaking changes to existing functionality

### Test Code:
- Mocks anywhere
- Fixed waits instead of polling
- Exact count assertions (== instead of >=) for reasoning items
- Missing field comparisons in hydrated vs persisted
- `any` types

---

## VERIFICATION STEPS

1. **Review API changes**
   - Check all 3 files modified correctly
   - Verify hardcoded reasoning is gone
   - Verify conditional logic is correct

2. **Run DoD checks**
   - Run format, lint, typecheck sequentially
   - Verify no changes or errors

3. **Run the tests**
   - Execute `bun run test:tdd-api`
   - Verify all 4 tests pass
   - Note timing (should be faster for non-reasoning tests)
   - Verify no hang after completion

4. **Review test code**
   - Check reasoning test follows spec
   - Verify assertions match requirements
   - Check hydrated vs persisted comparison is complete

5. **Verify timing improvement**
   - Coder should have noted before/after timing
   - Non-reasoning tests should be faster

6. **Provide recommendation**

---

## OUTPUT FORMAT

```
### Recommendation

**[X] RECOMMENDED** for approval
**[ ] NOT RECOMMENDED** - needs revision

### Phase 1 Verification (API Changes)

**Submit Schema:**
- [ ] reasoningEffort added correctly
- [ ] Passed to adapter.stream()

**StreamAdapterParams:**
- [ ] Interface updated correctly

**OpenAI Adapter:**
- [ ] Hardcoded reasoning REMOVED
- [ ] Conditional spread implemented
- [ ] summary: "auto" included when enabled

**Regression Check:**
- [ ] Existing tests pass
- [ ] Timing improved

### Phase 2 Verification (Reasoning Test)

**Test Structure:**
- [ ] Correct prompt used
- [ ] reasoningEffort: "low" used
- [ ] Runs in parallel

**Assertions:**
- [ ] Streaming: reasoning events checked
- [ ] Hydrated: reasoning items validated
- [ ] Persisted: reasoning items validated

### Hydrated vs Persisted Comparison

**Response-level:**
- [ ] All fields compared

**OutputItem (message):**
- [ ] id, type, content, origin compared

**OutputItem (reasoning):**
- [ ] id, type, content, origin compared

**Usage:**
- [ ] All fields compared

**Timestamps:**
- [ ] Correctly excluded

### Standard Checks

- [ ] Format clean
- [ ] Lint clean
- [ ] Typecheck clean
- [ ] All ran sequentially with no changes or errors

### All Tests Pass

- [ ] simple-prompt
- [ ] tool-calls
- [ ] multi-turn
- [ ] reasoning

### Timing Comparison

[Include coder's before/after timing if provided]

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

1. Review the 3 API change files
2. Verify hardcoded reasoning is removed
3. Run format, lint, typecheck
4. Run tests and verify all 4 pass
5. Review reasoning test code
6. Verify hydrated vs persisted comparison
7. Check timing improvement
8. Write recommendation

**Focus on: API correctness, test completeness, timing improvement.**
