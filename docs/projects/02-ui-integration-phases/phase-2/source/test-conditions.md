# Phase 2: Test Conditions

**Test Framework:** Vitest
**Test Location:** `tests/mocked-service/phase-2-tool-execution.test.ts`
**Mocks:** model-client.ts (enhanced), tool-handlers.ts (new)

---

## Test Suite: Phase 2 Tool Execution

### Test 1: Executes Approved Tool

**Functional description:**
When model requests tool and user approves, tool executes and result returns to model.

**Setup:**
- Mock ModelClient returns FunctionCall for 'exec' tool
- Mock tool handler (exec) returns preset result
- Mock approval callback returns true (approved)

**Execute:**
- Create conversation
- Send message
- Approval callback will be called
- Tool executes

**Verify:**
- Mock tool handler execute() was called
- Response includes FunctionCallOutput item
- Output contains tool result

**Implementation:** Setup mocks with pre-programmed approval (true), verify tool.execute called, assert FunctionCallOutput in response.

---

### Test 2: Blocks Denied Tool

**Functional description:**
When model requests tool requiring approval and user denies, tool doesn't execute and denial error returned.

**Setup:**
- Mock ModelClient returns FunctionCall
- Mock tool handler (exec)
- Mock approval callback returns false (denied)

**Execute:**
- Create conversation
- Send message
- Approval callback called, returns false

**Verify:**
- Mock tool handler execute() NOT called
- Response includes FunctionCallOutput with error
- Error message contains "denied" or "User denied approval"

**Implementation:** Pre-program approval to false, verify execute not called, assert error in output.

---

### Test 3: Multiple Tools in Sequence

**Functional description:**
Model can request multiple tools in one conversation (tool A, then tool B after seeing A's result).

**Setup:**
- Mock ModelClient with two responses:
  - First: Returns FunctionCall for 'readFile'
  - Second: Returns FunctionCall for 'exec' (after seeing readFile result)
- Mock both tool handlers
- Approval callback returns true for both

**Execute:**
- Send message
- First tool executes
- Model sees result
- Second tool requested
- Second tool executes

**Verify:**
- Both tools executed (both mock handlers called)
- Both results returned
- Model received both FunctionCallOutput items

**Implementation:** Mock client with sequential responses, both approvals true, verify both handlers called in sequence.

---

### Test 4: Tool Not Found Error

**Functional description:**
If model requests tool that doesn't exist in registry, graceful error returned (doesn't crash).

**Setup:**
- Mock ModelClient returns FunctionCall for 'nonexistent_tool'

**Execute:**
- Send message
- Tool lookup fails

**Verify:**
- Response includes FunctionCallOutput with error
- Error indicates tool not found
- No crash, graceful handling

**Implementation:** Mock requests fake tool, assert error output, no throw.

---

### Test 5: Tool Execution Failure

**Functional description:**
If tool executes but fails (e.g., command returns non-zero exit code), failure communicated to model.

**Setup:**
- Mock ModelClient returns FunctionCall for 'exec'
- Mock tool handler throws or returns failure result
- Approval callback returns true

**Execute:**
- Tool approved
- Tool execution fails

**Verify:**
- FunctionCallOutput contains error or failure status
- Error message descriptive
- Model receives failure info

**Implementation:** Mock tool.execute to throw or return {exitCode: 1}, assert error in output.

---

### Test 6: Display Functions Called

**Functional description:**
CLI displays tool calls and results to user (not just silent execution).

**Setup:**
- Spy on console.log or renderToolCall/renderToolResult functions
- Mock tool execution

**Execute:**
- Tool requested and executed

**Verify:**
- renderToolCall was called (tool call displayed)
- renderToolResult was called (result displayed)
- User sees what's happening

**Implementation:** Use vi.spyOn to track display calls, assert they occurred.

---

## Mock Strategy

**Mock:**
- ModelClient (returns FunctionCall items)
- Tool handlers (return preset results, don't actually execute)
- Approval callback (pre-program yes/no responses)

**Don't mock:**
- ToolRegistry (use real registry with mocked handlers)
- Session tool routing logic (testing this integration)

**Test boundary:** Tool detection → approval → execution → result flow. Assume ported tools work.

---

## Success Criteria

All 6 tests pass. Tool approval flow verified (both approval and denial). Tool execution integrated. Error cases handled. Display functions work.
