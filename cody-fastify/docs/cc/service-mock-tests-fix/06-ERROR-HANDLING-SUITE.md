# CODER PROMPT: Service Mock Tests - Slice 6 - Error Handling Suite

**Generated:** 2025-11-24
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`
**Slice:** 6 of 7 (Error Handling)

---

## ROLE

You are a senior TypeScript/Node.js developer implementing the **6-test error handling suite** for Core 2.0. Your focus is validating that the system handles failures gracefully (LLM errors, tool failures, timeouts, malformed data).

---

## PROJECT CONTEXT

**Current State:**
- ✅ **Slices 1-5 Complete**: Happy path suite (10/10 passing)
- ⏳ **Error Handling Suite**: 6 tests defined, need validation

**Tests in This Suite:**
- TC-ER-01: LLM API error response
- TC-ER-02: Tool execution failure (ENOENT)
- TC-ER-03: Tool timeout (slowTool)
- TC-ER-04: Malformed SSE chunk
- TC-ER-05: Empty message handling
- TC-ER-06: Provider mismatch validation

---

## CURRENT PHASE

**Phase:** Service Mock Tests - Slice 6
**Objective:** Validate error handling - system degrades gracefully under failure conditions.

**FUNCTIONAL OUTCOME:**
After this slice, all 6 error handling tests pass, proving the system handles: LLM errors, tool failures, timeouts, malformed data, empty messages, and configuration errors without crashing or corrupting state.

---

## PREREQUISITES

✅ **Happy Path Complete:**
- 10/10 happy path tests passing
- Infrastructure, persistence, tools all working
- Test data management established

✅ **Error Handling Tests Exist:**
- `tests/e2e/core-2.0/error-handling.spec.ts`
- 6 test conditions defined
- Fixtures created (error-response.json, tool-error.json, etc.)

---

## TASK SPECIFICATION

### **Task 1: Fix slowTool Registration** (~30 min)

**The Issue:** TC-ER-03 needs slowTool to test timeout behavior

**Current Approach:** testToolRegistry passed to Core2TestHarness

**File:** `tests/e2e/core-2.0/error-handling.spec.ts`

**Pattern:**
```typescript
import { ToolRegistry } from "codex-ts/src/tools/registry.js";

// Create test-specific registry
const testToolRegistry = new ToolRegistry();

// Register slowTool
testToolRegistry.register({
  metadata: {
    name: "slowTool",
    description: "Sleeps for 5 seconds to test timeout",
    requiresApproval: false,
    schema: { type: "object", properties: {} },
  },
  execute: async () => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    return { success: true, output: "done" };
  },
});

// Pass to harness
const harness = new Core2TestHarness(testToolRegistry);
```

**Verify:**
- TC-ER-03 fixture requests slowTool
- ToolWorker has 2s timeout (shorter than 5s sleep)
- Test expects function_call_output with success: false
- Timeout error message in output

---

### **Task 2: Validate Error Test Fixtures** (~45 min)

**Ensure fixtures accurately represent error scenarios:**

**TC-ER-01 (LLM error):**
- Fixture: `tests/fixtures/openai/error-response.json`
- Should have: response_error event with error object
- Verify: Error captured in Response.error

**TC-ER-02 (Tool failure):**
- Fixture: `tests/fixtures/openai/tool-error.json`
- Should request: readFile for nonexistent file
- Real tool should fail with ENOENT
- Verify: function_call_output.success === false

**TC-ER-04 (Malformed chunk):**
- Fixture: `tests/fixtures/openai/malformed-chunk.json`
- Should have: invalid JSON in chunks array
- Verify: MockAdapter handles gracefully or emits error event

**TC-ER-05 (Empty message):**
- Should be simple - message with empty content
- Verify: System accepts it without error

**TC-ER-06 (Provider mismatch):**
- Request: OpenAI model with Anthropic provider (or vice versa)
- Should: Return 400 validation error
- Verify: Error before adapter invoked

---

### **Task 3: Run and Fix Each Test** (~1 hour)

**Process for each test:**

1. Run individually:
   ```bash
   npx vitest run tests/e2e/core-2.0/error-handling.spec.ts -t "TC-ER-01"
   ```

2. If fails:
   - Read error message
   - Check fixture is correct
   - Verify assertion expects right error format
   - Fix issue

3. Verify passes

4. Move to next test

**Expected issues:**
- Fixtures might need adjustment
- Assertions might expect wrong error format
- Some tests might already pass

---

## WORKFLOW STEPS

1. **Run full error handling suite**
   ```bash
   npx vitest run tests/e2e/core-2.0/error-handling.spec.ts
   ```

2. **Fix TC-ER-03** (slowTool registration)

3. **For each failing test:**
   - Run individually
   - Debug failure
   - Fix (fixture, assertion, or code)
   - Verify passes

4. **Run full suite**
   ```bash
   npx vitest run tests/e2e/core-2.0/error-handling.spec.ts
   ```

5. **Verify 6/6 passing**

6. **Run 3 times for consistency**

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **NO MOCKING** except LLM responses
   - slowTool is test-specific (via testToolRegistry) - OK
   - But it must REALLY execute (actually sleep)
   - Other tools are REAL production tools

2. **Error tests must use real failures**
   - TC-ER-02: REAL file not found error
   - TC-ER-03: REAL timeout (tool actually sleeps)
   - Don't fake errors to make tests pass

---

## EXPECTED OUTCOME

After this session:
- ✅ 6/6 error handling tests passing
- ✅ Error scenarios validated
- ✅ System handles failures gracefully
- ✅ No crashes, corruption, or hangs

**Combined status:**
- Happy Path: 10/10 passing
- Error Handling: 6/6 passing
- **Total: 16/22 passing**

Edge cases (6 tests) remain for Slice 7.
