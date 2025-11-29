# VERIFIER PROMPT: TDD Test Utilities Extraction

**Generated:** 2025-11-28
**Project:** 01-api

---

## ROLE

You are a senior TypeScript/Node.js developer verifying completed implementation work.

---

## TASK

Verify the test utilities extraction was completed correctly:
1. Utilities are properly implemented
2. Both test files refactored correctly
3. All tests still pass
4. Code quality standards met

---

## VERIFICATION CHECKLIST

### 1. File Structure

Verify these files exist:

```
test-suites/tdd-api/
├── test-utils/
│   ├── index.ts
│   ├── types.ts
│   ├── submit.ts
│   ├── assertions.ts
│   ├── persistence.ts
│   └── compare.ts
├── openai-prompts.test.ts
└── anthropic-prompts.test.ts
```

- [ ] All 6 utility files exist
- [ ] test-utils/index.ts exports all modules

### 2. Type Definitions (types.ts)

- [ ] ThreadBody type defined
- [ ] RunData type defined
- [ ] OutputItemData type defined with all output item types
- [ ] UsageData type defined
- [ ] SubmitOptions type defined with all options (prompt, model, providerId, threadId, reasoningEffort, thinkingBudget)
- [ ] StreamResult type defined
- [ ] ProviderExpectations type defined

### 3. Submit Utilities (submit.ts)

- [ ] `submitPrompt()` function exists and validates response
- [ ] `streamAndCollect()` function exists and handles SSE parsing
- [ ] `submitAndStream()` convenience function exists
- [ ] All functions handle both OpenAI and Anthropic submit body formats
- [ ] Timeout handling implemented

### 4. Assertion Utilities (assertions.ts)

Verify these functions exist and work correctly:

- [ ] `assertResponseStart()` - validates response_start event fields, supports provider expectations
- [ ] `assertResponseDone()` - validates response_done event
- [ ] `assertEventEnvelopes()` - validates all events have event_id, timestamp, run_id, trace_context
- [ ] `assertThreadId()` - validates UUID format
- [ ] `getItemStarts()` - filters item_start events
- [ ] `getItemDones()` - filters item_done events
- [ ] `assertItemStarts()` - asserts minimum count
- [ ] `assertItemDones()` - asserts minimum count
- [ ] `assertMessageDone()` - validates message content and origin
- [ ] `assertThreadStructure()` - validates thread fields
- [ ] `assertRunFields()` - validates run fields, supports provider expectations
- [ ] `assertFunctionCallItems()` - validates function_call fields (name, call_id, arguments)
- [ ] `assertFunctionCallPairs()` - validates call_id matching
- [ ] `assertAgentMessage()` - validates agent message
- [ ] `assertReasoningItems()` - validates reasoning content
- [ ] `assertUsage()` - validates usage with optional required flag

### 5. Persistence Utilities (persistence.ts)

- [ ] `waitForPersistence()` function exists
- [ ] Supports `expectedRunCount` option
- [ ] Supports `timeoutMs` option
- [ ] Supports `retryIntervalMs` option
- [ ] Throws descriptive error on timeout

### 6. Comparison Utilities (compare.ts)

- [ ] `compareResponseToRun()` - compares response-level fields
- [ ] `compareOutputItems()` - compares each output item by type:
  - [ ] message: id, type, content, origin
  - [ ] function_call: id, type, name, call_id, arguments, origin
  - [ ] function_call_output: id, type, call_id, output, success, origin
  - [ ] reasoning: id, type, content, origin
- [ ] `compareUsage()` - compares token counts with optional required flag

### 7. Test File Refactoring

**openai-prompts.test.ts:**

- [ ] Imports from test-utils
- [ ] ThreadBody type NOT defined in file (was defined 4 times)
- [ ] All 4 tests use utility functions
- [ ] Tests are significantly shorter (target: ~300 lines total)

**anthropic-prompts.test.ts:**

- [ ] Imports from test-utils
- [ ] ThreadBody type NOT defined in file (was defined 4 times)
- [ ] All 4 tests use utility functions
- [ ] Provider expectations passed to assertions (`expectedProviderId: "anthropic"`, `expectedModelId: "claude-haiku-4-5"`)
- [ ] Usage assertions use `required: false`
- [ ] Tests are significantly shorter (target: ~320 lines total)

### 8. Test Execution

Run the tests:

```bash
cd cody-fastify && bun run test:tdd-api
```

- [ ] All 8 tests pass
- [ ] No timeouts
- [ ] No type errors

### 9. Code Quality

Run sequentially:

```bash
cd cody-fastify && bun run format
cd cody-fastify && bun run lint
cd cody-fastify && bun run typecheck
```

- [ ] format: no changes needed
- [ ] lint: no errors
- [ ] typecheck: no errors

### 10. Line Count Verification

Check final line counts:

```bash
wc -l test-suites/tdd-api/openai-prompts.test.ts
wc -l test-suites/tdd-api/anthropic-prompts.test.ts
wc -l test-suites/tdd-api/test-utils/*.ts
```

- [ ] openai-prompts.test.ts: < 400 lines (was 1841)
- [ ] anthropic-prompts.test.ts: < 400 lines (was 1982)
- [ ] Total utilities: ~500 lines
- [ ] Net reduction: > 2500 lines

---

## SPECIFIC CHECKS

### Provider-Specific Handling

**OpenAI tests should:**
- Submit with `model: "gpt-5.1-codex-mini"` (no providerId)
- Not pass provider expectations to most assertions (implicit)
- Use `assertUsage(run.usage)` (required by default)
- Use `compareUsage(..., required: true)` or just `compareUsage(...)`

**Anthropic tests should:**
- Submit with `providerId: "anthropic", model: "claude-haiku-4-5"`
- Pass `{ expectedProviderId: "anthropic", expectedModelId: "claude-haiku-4-5" }` to assertions
- Use `assertUsage(run.usage, false)` (not always required)
- Use `compareUsage(..., false)`

### Reasoning/Thinking Tests

**OpenAI reasoning test should:**
- Submit with `reasoningEffort: "low"`
- Assert reasoning items in output

**Anthropic extended thinking test should:**
- Submit with `thinkingBudget: 4096`
- Assert reasoning items in output

---

## OUTPUT FORMAT

```
## Verification Result: [PASS/FAIL]

### File Structure
- [✓/✗] test-utils directory exists with 6 files

### Type Definitions
- [✓/✗] All types defined correctly

### Utilities Implementation
- [✓/✗] submit.ts: [notes]
- [✓/✗] assertions.ts: [notes]
- [✓/✗] persistence.ts: [notes]
- [✓/✗] compare.ts: [notes]

### Test Refactoring
- [✓/✗] openai-prompts.test.ts: [line count], ThreadBody removed: [yes/no]
- [✓/✗] anthropic-prompts.test.ts: [line count], ThreadBody removed: [yes/no]

### Test Execution
- [✓/✗] All 8 tests pass

### Code Quality
- [✓/✗] format: [status]
- [✓/✗] lint: [status]
- [✓/✗] typecheck: [status]

### Line Count Summary
| File | Before | After |
|------|--------|-------|
| openai-prompts.test.ts | 1841 | [X] |
| anthropic-prompts.test.ts | 1982 | [X] |
| test-utils (total) | 0 | [X] |
| **Net change** | 3823 | [X] |

### Issues Found
[List any issues, or "None"]

### Recommendations
[List any recommendations for improvement, or "None - implementation is complete"]
```
