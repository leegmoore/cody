# CODER PROMPT: Core 2.0 Phase 5.1 - Error Handling Tests

**Generated:** 2025-01-22
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`

---

## ROLE

You are a senior TypeScript/Node.js developer implementing **error handling and edge case tests** for the Core 2.0 streaming architecture. The happy path test suite (10/10 passing) validates the pipeline works correctly. Now we need to validate it **fails gracefully** when things go wrong.

---

## PROJECT CONTEXT

**Cody Core 2.0** streaming pipeline is validated for happy paths. We now need to test error scenarios to ensure:
1. Errors are surfaced correctly (not silent failures)
2. System doesn't crash under error conditions
3. Error messages are clear and actionable
4. Recovery and resilience work as designed

**Current State:**
- ✅ 10 happy path tests passing
- ✅ Test harness fully functional
- ✅ ToolWorker integrated and validated
- ✅ Real Redis, Convex, Fastify infrastructure

---

## CURRENT PHASE

**Phase:** Core 2.0 Phase 5.1 - Error Handling Tests
**Objective:** Implement 6 critical error scenario tests

**FUNCTIONAL OUTCOME:**
After this phase, we will have validated that the system handles errors gracefully across LLM failures, tool execution failures, and streaming issues. All error paths will have clear, actionable error messages and no uncaught exceptions.

---

## PREREQUISITES

✅ **Happy Path Suite Complete:**
- 10/10 tests passing in `tests/e2e/core-2.0/happy-path.spec.ts`
- Test harness validated and stable
- ToolWorker integrated with mock tool handlers

✅ **Test Conditions Defined:**
- `docs/cc/test-conditions-phase-5.md` (contains 12 test conditions for Phase 5)

✅ **Local Environment:**
- Redis running on localhost:6379
- Convex dev server running
- All dependencies installed

---

## STATE LOADING (READ THESE FIRST)

### FIRST: Load Test Conditions

1. **Test Conditions:** `docs/cc/test-conditions-phase-5.md`
   - Read Phase 5.1 section (6 tests: TC-ER-01 through TC-ER-06)
   - Understand each error scenario
   - Note verification points for each test

2. **Existing Happy Path Tests:** `tests/e2e/core-2.0/happy-path.spec.ts`
   - Review test structure and patterns
   - Note how fixtures are loaded and used
   - Review assertion patterns

### THEN: Review Implementation

3. **Test Harness:** `tests/harness/core-harness.ts`
   - Review submit(), consumeSSE(), hydrate() methods
   - Note error handling in these methods
   - Understand cleanup/reset behavior

4. **Mock Adapter:** `tests/mocks/mock-stream-adapter.ts`
   - Review how fixtures are replayed
   - Note error handling in parsing
   - Understand how to create error fixtures

5. **Tool Registry:** Review `installMockTools()` in happy-path.spec.ts
   - Understand how to mock tool failures
   - Note how to add new tool mocks

---

## TASK SPECIFICATION

Implement **6 error handling tests** for Phase 5.1.

### **Deliverables:**

1. **Error Fixtures** (`tests/fixtures/openai/`) - 5 new JSON files
   - `error-response.json` - LLM error
   - `tool-error.json` - Tool failure
   - `tool-timeout.json` - Tool timeout
   - `malformed-chunk.json` - Invalid JSON
   - `empty-message.json` - Empty content

2. **Error Test Suite** (`tests/e2e/core-2.0/error-handling.spec.ts`) - ~400 lines
   - NEW file for error tests (separate from happy-path.spec.ts)
   - 6 test cases: TC-ER-01 through TC-ER-06
   - Use same harness infrastructure
   - Focus on error assertions (status, error fields, graceful degradation)

3. **Tool Mock Enhancements** - ~50 lines
   - Extend `installMockTools()` to support error scenarios
   - Add conditional logic (if args match error condition, return error)
   - Support timeout simulation (if needed)

**Effort Estimate:** ~500 lines total

---

## WORKFLOW STEPS

1. **Create Error Test File**
   ```bash
   touch tests/e2e/core-2.0/error-handling.spec.ts
   ```

2. **Copy Harness Setup from Happy Path**
   - Reuse `beforeAll()`, `afterAll()`, `afterEach()` patterns
   - Same harness instance
   - Same fixture registration approach

3. **Implement TC-ER-01 (LLM Error Response)**
   - Create `openai/error-response.json` fixture
   - Fixture should have response_error event (research OpenAI error format)
   - Write test that submits, consumes SSE, expects error status
   - Verify Response.error is populated
   - Run test: `npx vitest run tests/e2e/core-2.0/error-handling.spec.ts -t "TC-ER-01"`

4. **Implement TC-ER-05 (Empty Message) - Easiest**
   - Create `empty-message.json` fixture
   - Standard message flow, just content = ""
   - Verify it's treated as valid (not error)

5. **Implement TC-ER-06 (Provider Mismatch) - No Fixture Needed**
   - Test factory validation directly
   - Submit with mismatched provider/model
   - Expect InvalidModelError
   - Verify 400 response

6. **Implement TC-ER-02 (Tool Failure)**
   - Create `tool-error.json` fixture
   - Update `installMockTools()` to conditionally return errors:
   ```typescript
   overrideTool(createMockTool("readFile", async (params) => {
     if (params.path === 'nonexistent.txt') {
       return {
         success: false,
         output: 'Error: ENOENT - File not found'
       };
     }
     return {success: true, output: 'file content'};
   }));
   ```
   - Verify function_call_output.success = false

7. **Implement TC-ER-04 (Malformed Chunk)**
   - Create `malformed-chunk.json` with invalid JSON in middle
   - Test that MockAdapter handles parse error
   - Verify system doesn't crash

8. **Implement TC-ER-03 (Tool Timeout) - If Time Permits**
   - Check if ToolWorker has timeout config
   - If not, document as "requires ToolWorker timeout implementation"
   - If yes, mock tool that sleeps too long
   - Verify timeout error emitted

9. **Run Full Error Suite**
   ```bash
   npx vitest run tests/e2e/core-2.0/error-handling.spec.ts
   ```

10. **Update TEST_RESULTS.md**
    - Document error test results
    - Note any bugs discovered
    - List any tests deferred (e.g., tool timeout if not implemented)

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **Create separate error test file**
   - Don't add to happy-path.spec.ts
   - Keep error tests isolated
   - Makes it easy to run happy vs error suites separately

2. **Follow fixture format**
   - Use same JSON structure as happy path fixtures
   - Include description, provider, model, chunks, expected_response
   - For error fixtures, expected_response should show error state

3. **Test error surfacing, not error creation**
   - Don't test "can I make Redis crash" (out of scope)
   - Test "does system handle Redis error gracefully"
   - Focus on graceful degradation and clear errors

4. **All tests must be deterministic**
   - No random failures
   - No dependency on external timing
   - Mock all error conditions explicitly

5. **Use valid models only**
   - gpt-5-mini, gpt-5-codex, claude-haiku-4.5, claude-sonnet-4.5
   - For TC-ER-06 (provider mismatch), use these valid models in wrong combinations

### **INTERRUPT PROTOCOL**

**STOP and ask if:**
- OpenAI error response format is unclear (research API docs)
- ToolWorker timeout implementation doesn't exist (may need to implement or defer test)
- Malformed chunk handling requires MockAdapter changes beyond simple try/catch
- Unsure how to simulate specific error conditions

**DO NOT:**
- Skip tests because they're hard
- Mock additional infrastructure (only mock tool handlers and LLM responses)
- Simplify error responses (use realistic error structures)

---

## CRITICAL IMPLEMENTATION NOTES

### **For TC-ER-01 (LLM Error):**

Research OpenAI Responses API error format. Likely:
```json
{
  "type": "response_error",
  "error": {
    "type": "invalid_request_error",
    "code": "...",
    "message": "..."
  }
}
```

Verify this matches actual API or ask for clarification.

---

### **For TC-ER-02 (Tool Timeout):**

**Check if ToolWorker has timeout config:**
```bash
grep -r "timeout" cody-fastify/src/workers/tool-worker.ts
```

**If timeout exists:** Configure mock tool to exceed it
**If timeout doesn't exist:** Document as blocker, defer test, note in TEST_RESULTS.md

---

### **For TC-ER-04 (Malformed Chunk):**

The MockAdapter currently expects all chunks to parse. You may need to add error handling:

```typescript
// tests/mocks/mock-stream-adapter.ts
for (const chunk of fixture.chunks) {
  try {
    const event = parseSseChunk(chunk);
    // ... emit to Redis
  } catch (err) {
    console.error('[mock-adapter] Failed to parse chunk:', err);
    // Option 1: Emit error event to Redis
    // Option 2: Skip and continue
    // Option 3: Throw and abort
    // Decide based on how real adapters should handle this
  }
}
```

**Ask user:** How should adapters handle malformed LLM chunks?

---

### **For TC-ER-06 (Provider Mismatch):**

This tests factory validation. No fixture needed:

```typescript
test('TC-ER-06: Provider mismatch', async () => {
  await expect(
    harness.submit({
      prompt: 'Test',
      model: 'claude-haiku-4.5',  // Anthropic model
      providerId: 'openai'        // OpenAI provider
    })
  ).rejects.toThrow('Model "claude-haiku-4.5" is not allowed for provider "openai"');
});
```

If submit() doesn't throw (returns HTTP error instead), check response status:
```typescript
const response = await fetch(`${harness.baseUrl}/api/v2/submit`, {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Test',
    model: 'claude-haiku-4.5',
    providerId: 'openai'
  })
});

expect(response.status).toBe(400);
const error = await response.json();
expect(error.message).toContain('not allowed');
```

---

## CODE QUALITY STANDARDS

### **Mandatory Quality Gates:**

- ✅ TypeScript: Zero errors (`npx tsc --noEmit`)
- ✅ ESLint: Zero errors (`npm run lint`)
- ✅ Error tests: Runnable and deterministic
- ✅ No test.skip (all tests must run)

### **Verification Command:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npx vitest run tests/e2e/core-2.0/error-handling.spec.ts
```

---

## SESSION COMPLETION CHECKLIST

1. ✅ **Run verification command**

2. ✅ **Update TEST_RESULTS.md:**
   ```markdown
   ## Phase 5.1: Error Handling Tests

   **Status:** X/6 passing

   | Test | Status | Notes |
   |------|--------|-------|
   | TC-ER-01: LLM error | ✅ PASS | Error surfaced correctly |
   | TC-ER-02: Tool failure | ✅ PASS | - |
   | TC-ER-03: Tool timeout | ⏸️ DEFERRED | ToolWorker timeout not implemented |
   | ... | ... | ... |

   **Bugs Found:**
   - (List any new bugs discovered)

   **Total Coverage:** 16/16 tests passing (10 happy + 6 error)
   ```

3. ✅ **Commit work:**
   ```bash
   git add -A
   git commit -m "feat(test): implement Phase 5.1 error handling tests

   Added 6 error scenario tests validating graceful failure handling.

   Tests Implemented:
   - TC-ER-01: LLM error response
   - TC-ER-02: Tool execution failure
   - TC-ER-03: Tool timeout
   - TC-ER-04: Malformed SSE chunk
   - TC-ER-05: Empty message content
   - TC-ER-06: Provider/model mismatch

   Results: X/6 passing (see TEST_RESULTS.md)

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

4. ✅ **Report summary:**
   - Fixtures created: X
   - Tests implemented: 6
   - Tests passing: X/6
   - Bugs found: (list)
   - Deferred tests: (list with reason)

---

## STARTING POINT

**BEGIN by:**

1. Reading Phase 5.1 test conditions (`docs/cc/test-conditions-phase-5.md`)
2. Creating `tests/e2e/core-2.0/error-handling.spec.ts`
3. Implementing TC-ER-05 first (simplest - empty message)
4. Then TC-ER-06 (no fixture - factory validation)
5. Then TC-ER-01 (LLM error)
6. Then TC-ER-02 (tool failure)
7. Then TC-ER-04 (malformed chunk)
8. Finally TC-ER-03 (tool timeout - may defer if timeout not implemented)

**Start with easiest tests to validate harness works for errors, then tackle harder scenarios.**

---

## EXPECTED OUTCOME

After this session:
- ✅ 6 error test cases implemented
- ✅ 5-10 error fixtures created
- ✅ At least 4-5 tests passing (some may expose new bugs)
- ✅ Clear documentation of any new bugs found
- ✅ Foundation for Phase 5.2 (edge cases)

**It's OK if some tests fail** - that means we found real bugs in error handling. Document them clearly for fixing.
