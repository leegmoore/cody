# VERIFIER PROMPT: anthropic-tests2

**Generated:** 2025-11-26
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer verifying completed implementation work.

Your task: **Verify the Anthropic multi-turn and extended thinking tests are correctly implemented.**

---

## WHAT WAS REQUESTED

### Phase 1: Multi-Turn Test
- Add Test 3 to `anthropic-prompts.test.ts`
- 3 sequential prompts on same thread
- Verify history maintained across turns

### Phase 2: Extended Thinking Support (Code Changes)
- Add `thinkingBudget` to submit schema
- Add to `StreamAdapterParams` interface
- Add thinking config + beta header to Anthropic adapter

### Phase 3: Extended Thinking Test
- Add Test 4 to `anthropic-prompts.test.ts`
- Puzzle prompt with thinkingBudget: 4096
- Verify reasoning items captured

### Gates Required
- Gate 1: After multi-turn test, verify 7 tests pass
- Gate 2: After code changes, verify 7 tests still pass (no regression)

---

## KEY FILES TO REVIEW

| File | Expected Changes |
|------|-----------------|
| `test-suites/tdd-api/anthropic-prompts.test.ts` | 2 new tests |
| `src/api/routes/submit.ts` | thinkingBudget in schema |
| `src/core/model-factory.ts` | thinkingBudget in interface |
| `src/core/adapters/anthropic-adapter.ts` | thinking config + beta header |
| `test-suites/tdd-api/README.md` | Updated documentation |

---

## VERIFICATION CHECKLIST

### Multi-Turn Test (Test 3)

- [ ] Test exists in `anthropic-prompts.test.ts`
- [ ] Creates new thread
- [ ] Sends 3 sequential prompts to same thread
- [ ] Prompts: "Hi Claude, how are you?", "This is great to hear!", "Have a good evening!"
- [ ] Uses providerId: "anthropic" and model: "claude-haiku-4-5"
- [ ] Verifies same thread_id for all 3 turns
- [ ] Verifies 3 distinct run_ids
- [ ] Verifies all runs have status: "complete"
- [ ] Verifies output_items contain message type only
- [ ] Polls for persistence (not fixed wait)
- [ ] Compares hydrated vs persisted for each turn

### Code Changes Verification

**submit.ts:**
- [ ] `thinkingBudget` added to Zod schema
- [ ] Type is `z.number().int().positive().optional()`
- [ ] Passed to adapter in params

**model-factory.ts:**
- [ ] `thinkingBudget?: number` added to `StreamAdapterParams`

**anthropic-adapter.ts:**
- [ ] `thinking` type added to reqBody type definition
- [ ] Conditional thinking config when thinkingBudget set:
  ```typescript
  thinking: {
    type: "enabled",
    budget_tokens: params.thinkingBudget
  }
  ```
- [ ] Beta header added when thinking enabled:
  ```typescript
  headers["anthropic-beta"] = "interleaved-thinking-2025-05-14"
  ```
- [ ] Thinking only enabled when `params.thinkingBudget` is set (not by default)

### Extended Thinking Test (Test 4)

- [ ] Test exists in `anthropic-prompts.test.ts`
- [ ] Uses puzzle prompt
- [ ] Sets thinkingBudget: 4096 in submit
- [ ] Uses providerId: "anthropic" and model: "claude-haiku-4-5"
- [ ] Captures streaming events
- [ ] Verifies reasoning events appear (>= 1)
- [ ] Hydrates response
- [ ] Polls for persistence
- [ ] Fetches persisted run
- [ ] Verifies reasoning items (>= 1) in output_items
- [ ] Verifies message items (>= 1) in output_items
- [ ] Verifies reasoning content not empty
- [ ] Compares hydrated vs persisted

### Hydrated vs Persisted Comparison

For EACH test (multi-turn: all 3 turns, reasoning: 1 turn):

**Response-level (must compare):**
- [ ] id
- [ ] turn_id
- [ ] thread_id
- [ ] model_id
- [ ] provider_id
- [ ] status
- [ ] finish_reason
- [ ] output_items.length

**OutputItem fields (must compare for each item):**
- [ ] id
- [ ] type
- [ ] content (for message and reasoning items)
- [ ] origin (for message and reasoning items)

**Usage sub-object (must compare):**
- [ ] prompt_tokens
- [ ] completion_tokens
- [ ] total_tokens

**Must NOT compare:**
- [ ] Confirms timestamps (created_at, updated_at) are excluded

---

## ANTI-PATTERNS TO CHECK

- [ ] No mocks (Redis, Convex, Anthropic all real)
- [ ] No fixed waits (uses polling)
- [ ] No env var pre-checks (uses connectivity checks)
- [ ] No `any` types
- [ ] Tests run in parallel where independent

---

## DEFINITION OF DONE TO VERIFY

### Standard Checks

Run these sequentially. All must pass with no changes or errors.

- [ ] `bun run format` - no changes
- [ ] `bun run lint` - no errors
- [ ] `bun run typecheck` - no errors
- [ ] All three ran sequentially with no changes or errors between runs

### Job-Specific Items

- [ ] Multi-turn test added to `anthropic-prompts.test.ts`
- [ ] Extended thinking code changes in 3 files
- [ ] Extended thinking test added to `anthropic-prompts.test.ts`
- [ ] README.md updated with new tests
- [ ] `bun run test:tdd-api` executes
- [ ] All 8 tests pass (4 OpenAI + 4 Anthropic)
- [ ] Tests complete within 30 second timeout
- [ ] Tests do NOT hang after pass/fail

---

## VERIFICATION STEPS

1. **Run DoD checks**
   - Run format, lint, typecheck sequentially
   - Verify no changes or errors from any

2. **Run the tests**
   - Execute `bun run test:tdd-api`
   - Verify all 8 tests pass
   - Verify no hang after completion

3. **Review multi-turn test**
   - Check 3 prompts sent to same thread
   - Check all assertions present
   - Check hydrated vs persisted comparison

4. **Review code changes**
   - submit.ts: thinkingBudget in schema
   - model-factory.ts: thinkingBudget in interface
   - anthropic-adapter.ts: thinking config + beta header
   - Verify thinking only enabled when thinkingBudget is set

5. **Review extended thinking test**
   - Check puzzle prompt used
   - Check thinkingBudget: 4096 passed
   - Check reasoning assertions
   - Check hydrated vs persisted comparison

6. **Verify hydrated vs persisted comparison**
   - Response-level fields compared for all tests
   - OutputItem fields compared (id, type, content, origin)
   - Usage sub-object compared
   - Timestamps excluded

7. **Verify gate compliance**
   - Coder should have reported Gate 1 results (7 tests after multi-turn)
   - Coder should have reported Gate 2 results (7 tests after code changes)
   - Compare timings (Gate 2 should not be slower than Gate 1)

8. **Check for anti-patterns**
   - No mocks anywhere
   - No fixed waits
   - No `any` types

9. **Provide recommendation**

---

## OUTPUT FORMAT

```markdown
## Verification Summary

**Recommendation:** APPROVE / NEEDS CHANGES

### Definition of Done Verification

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

### Code Review Findings

**Issues Found:**
- [Issue]: [Description] - [Severity: Critical/Major/Minor]

### Multi-Turn Test Verification

- [ ] 3 sequential prompts on same thread
- [ ] Assertions complete
- [ ] Hydrated vs persisted comparison

### Code Changes Verification

- [ ] submit.ts correct
- [ ] model-factory.ts correct
- [ ] anthropic-adapter.ts correct
- [ ] Thinking only enabled when thinkingBudget set

### Extended Thinking Test Verification

- [ ] Puzzle prompt used
- [ ] thinkingBudget: 4096 passed
- [ ] Reasoning assertions correct
- [ ] Hydrated vs persisted comparison

### Hydrated vs Persisted Comparison

**Response-level (all tests):**
- [ ] id, turn_id, thread_id compared
- [ ] model_id, provider_id compared
- [ ] status, finish_reason compared
- [ ] output_items.length compared

**OutputItem fields:**
- [ ] id, type compared
- [ ] content, origin compared (message/reasoning)

**Usage sub-object:**
- [ ] prompt_tokens, completion_tokens, total_tokens compared

**Timestamps:**
- [ ] created_at/updated_at correctly excluded

### Gate Compliance

- [ ] Gate 1 reported (7 tests after multi-turn)
- [ ] Gate 2 reported (7 tests after code changes)
- [ ] Gate 2 timing not slower than Gate 1

### Anti-Patterns Detected

- [None found / List any found]

### Reasoning

[Explain recommendation]
```

---

## STARTING POINT

1. Run DoD verification (format, lint, typecheck sequentially)
2. Run the tests
3. Review multi-turn test implementation
4. Review code changes (3 files)
5. Review extended thinking test implementation
6. Verify hydrated vs persisted comparisons
7. Verify gate compliance from coder's report
8. Check for anti-patterns
9. Write your recommendation

**Be thorough but fair. Focus on correctness and integration.**
