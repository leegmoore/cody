# VERIFIER PROMPT: multi-turn-test

**Generated:** 2025-11-26
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer verifying completed implementation work.

Your task: Review the implementation of **Multi-turn conversation test for the tdd-api test suite.**

**Two possible outcomes to verify:**
1. Tests pass → Verify standard DoD items
2. Tests fail (application issues) → Verify analysis quality and recommendations

---

## PROJECT CONTEXT

**cody-fastify** is a streaming-first LLM harness built on:
- Fastify (API server)
- Redis Streams (event transport)
- Convex (persistence)
- OpenAI Responses API schema (canonical data model)

---

## ORIGINAL TASK

The coder was asked to: **Add a multi-turn conversation test with 3 turns on the same thread.**

### Test Specification

**Conversation:**
- Turn 1: "Hi cody how are you"
- Turn 2: "This is great to hear!"
- Turn 3: "Have a good evening!"

**Assertions:**
- All turns use same threadId
- Each turn streams and completes
- Thread ends with exactly 3 runs
- All runs have status "complete"
- No function_call or reasoning items
- **Hydrated vs persisted comparison for all 3 turns**

### Hydrated vs Persisted Comparison

For each of the 3 turns, the coder should compare:

**Response-level fields:**
- id, turn_id, thread_id, model_id, provider_id, status, finish_reason
- output_items.length

**For each output_item (message type):**
- id, type, content, origin

**Usage sub-object:**
- prompt_tokens, completion_tokens, total_tokens

**Should NOT compare:** created_at, updated_at (timestamps)

### Failure Handling Instruction

If tests fail due to application code (not test code):
- Coder should NOT fix application code
- Coder should provide analysis and recommendations
- You verify the quality of that analysis

---

## VERIFICATION PATH A: Tests Pass

### Files to Review

- `test-suites/tdd-api/openai-prompts.test.ts` (new test added)
- `test-suites/tdd-api/README.md` (updated)

### Definition of Done to Verify

- [ ] Multi-turn test added to `openai-prompts.test.ts`
- [ ] README.md updated with new test
- [ ] `bun run test:tdd-api` executes
- [ ] All tests pass
- [ ] Tests complete within 20 second timeout
- [ ] Tests do NOT hang after pass/fail
- [ ] `bun run format` - no changes
- [ ] `bun run lint` - no errors
- [ ] `bun run typecheck` - no errors
- [ ] Checks run sequentially with no changes or errors

### Code Quality Checks

- [ ] Test uses same threadId across all 3 turns
- [ ] threadId captured from turn 1, passed to turns 2 and 3
- [ ] Each turn waits for completion before starting next
- [ ] ResponseReducer used for hydration
- [ ] Polling used for persistence check (not fixed wait)
- [ ] Strong types (no `any`)
- [ ] No mocks

### Hydrated vs Persisted Comparison Verification

Verify the test compares for EACH of the 3 turns:

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
- [ ] content (for message items)
- [ ] origin (for message items)

**Usage sub-object (must compare):**
- [ ] prompt_tokens
- [ ] completion_tokens
- [ ] total_tokens

**Must NOT compare:**
- [ ] Confirms timestamps (created_at, updated_at) are excluded

**Implementation pattern:**
- [ ] Hydrated response stored during each turn's streaming phase
- [ ] After thread fetch, each hydrated response compared to corresponding persisted run

---

## VERIFICATION PATH B: Tests Fail (Application Issues)

### Analysis Quality Checklist

If coder reported application failure:

**1. Failure Identification:**
- [ ] Specific assertion that failed is identified
- [ ] Expected vs actual values documented
- [ ] Error messages/stack traces captured

**2. Hypotheses:**
- [ ] 1-3 specific hypotheses formed
- [ ] Hypotheses are actionable (not vague)
- [ ] Each hypothesis points to specific code/behavior

**3. Investigation:**
- [ ] Relevant code was read and referenced
- [ ] Data flow was traced
- [ ] Evidence gathered for each hypothesis

**4. Conclusions:**
- [ ] Each hypothesis marked CONFIRMED, DISPROVEN, or INCONCLUSIVE
- [ ] Evidence supports the conclusion
- [ ] Root cause clearly identified

**5. Recommendations:**
- [ ] Specific file:line references provided
- [ ] Changes are clearly described
- [ ] Complexity estimated (trivial/moderate/significant)
- [ ] Risks or dependencies noted

### Analysis Red Flags

Watch for these issues in the analysis:

- Vague hypotheses ("something is wrong with history")
- Missing evidence for conclusions
- Recommendations without file references
- Over-complicated solutions for simple problems
- Under-estimating complexity

---

## VERIFICATION STEPS

### For Passing Tests:

1. **Run DoD checks**
   - Run format, lint, typecheck sequentially
   - Verify no changes or errors

2. **Run the tests**
   - Execute `bun run test:tdd-api`
   - Verify all tests pass
   - Verify no hang after completion

3. **Review test code**
   - Check multi-turn test follows spec
   - Verify threadId handling across turns
   - Check assertions match requirements

4. **Verify hydrated vs persisted comparison**
   - Response-level fields compared for all 3 turns
   - OutputItem fields compared (id, type, content, origin)
   - Usage sub-object compared
   - Timestamps excluded

5. **Provide recommendation**

### For Failing Tests (Application Issues):

1. **Verify test code is correct**
   - The test itself should be properly written
   - Failure should be in application, not test
   - Test includes hydrated vs persisted comparison (even if failing)

2. **Assess analysis quality**
   - Use checklist above
   - Look for red flags

3. **Evaluate recommendations**
   - Are they actionable?
   - Do file references exist?
   - Is complexity estimate reasonable?

4. **Provide assessment**

---

## OUTPUT FORMAT

### For Passing Tests:

```
### Recommendation

**[X] RECOMMENDED** for approval
**[ ] NOT RECOMMENDED** - needs revision

### Definition of Done Verification

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

### Code Review Findings

**Positive:**
- [What was done well]

**Issues Found:**
- [Issue]: [Description] - [Severity]

### Hydrated vs Persisted Comparison

**Response-level (all 3 turns):**
- [ ] id compared
- [ ] turn_id compared
- [ ] thread_id compared
- [ ] model_id compared
- [ ] provider_id compared
- [ ] status compared
- [ ] finish_reason compared
- [ ] output_items.length compared

**OutputItem fields:**
- [ ] id compared
- [ ] type compared
- [ ] content compared (message items)
- [ ] origin compared (message items)

**Usage sub-object:**
- [ ] prompt_tokens compared
- [ ] completion_tokens compared
- [ ] total_tokens compared

**Timestamps:**
- [ ] created_at/updated_at correctly excluded

### Reasoning

[Explain recommendation]
```

### For Failing Tests (Application Issues):

```
### Recommendation

**[X] ANALYSIS APPROVED** - Ready for user decision on fixes
**[ ] ANALYSIS NEEDS WORK** - Issues with coder's analysis

### Test Code Verification

- [ ] Test code is correctly written
- [ ] Test includes hydrated vs persisted comparison
- [ ] Failure is confirmed to be in application code

### Analysis Assessment

**Failure Identification:** [Good / Adequate / Insufficient]
- [Comments]

**Hypotheses Quality:** [Good / Adequate / Insufficient]
- [Comments]

**Investigation Quality:** [Good / Adequate / Insufficient]
- [Comments]

**Conclusions Quality:** [Good / Adequate / Insufficient]
- [Comments]

**Recommendations Quality:** [Good / Adequate / Insufficient]
- [Comments]

### Verifier's Assessment of Root Cause

[Do you agree with coder's analysis? Any additional insights?]

### Verifier's Assessment of Recommendations

[Are recommendations sound? Any concerns or alternatives?]

### Reasoning

[Explain your assessment]

### If Analysis Needs Work

[What specifically needs to be improved before user review]
```

---

## STARTING POINT

1. Determine which path applies (tests pass or fail)
2. Run verification steps for that path
3. Complete appropriate output format
4. Provide clear recommendation

**Be thorough but fair. For failing tests, focus on analysis quality, not the failure itself.**
