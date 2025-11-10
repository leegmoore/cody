# Phase 2: Tool Integration - Task Checklist

**Phase:** 2 - Tool Integration
**Status:** Not Started
**Estimated Code:** ~300 lines (CLI ~200, tests ~100)

---

## Setup

- [ ] Review Phase 1 code (understand existing CLI structure)
- [ ] Read tool registry: codex-ts/src/tools/registry.ts
- [ ] Read exec tool: codex-ts/src/core/exec/index.ts
- [ ] Understand FunctionCall/FunctionCallOutput types

---

## Approval Module

- [ ] Create src/cli/approval.ts
- [ ] Import readline/promises
- [ ] Implement promptApproval(toolName, args) function
  - [ ] Display tool name and arguments
  - [ ] Prompt user for y/n
  - [ ] Return boolean Promise
- [ ] Handle edge cases (Ctrl+C, invalid input)
- [ ] Test manually: Can prompt and get response

---

## Display Enhancements

- [ ] Open src/cli/display.ts (from Phase 1)
- [ ] Add renderToolCall(call: FunctionCall)
  - [ ] Display tool name
  - [ ] Display arguments (formatted JSON)
- [ ] Add renderToolResult(output: FunctionCallOutput)
  - [ ] Parse output JSON
  - [ ] Display result (stdout, content, or full object)
- [ ] Test: Functions render nicely to console

---

## Event Loop Enhancement

- [ ] Open src/cli/commands/chat.ts (from Phase 1)
- [ ] Modify to handle multiple events (not just single response)
- [ ] Add event loop:
  - [ ] While not complete, call nextEvent()
  - [ ] Handle different event types
  - [ ] Display appropriately
- [ ] Handle tool_call events (display via renderToolCall)
- [ ] Handle tool_result events (display via renderToolResult)
- [ ] Handle final assistant message
- [ ] Test: Event loop works for multi-event responses

---

## Approval Callback Injection

- [ ] Determine where to inject approval callback
  - [ ] Check Codex.spawn() signature
  - [ ] Or Session constructor
  - [ ] Or ConversationManager
- [ ] Modify CLI initialization (src/cli/index.ts)
  - [ ] Import promptApproval
  - [ ] Pass to Codex/Session/Manager during creation
- [ ] Document injection point in DECISIONS.md
- [ ] Test: Approval callback gets called

---

## Session Integration (if needed)

- [ ] Check if Session already routes tools (likely yes from port)
- [ ] If not: Add tool detection logic
  - [ ] Scan ResponseItems for FunctionCall
  - [ ] Look up in ToolRegistry
  - [ ] Check requiresApproval
  - [ ] Call approval callback if needed
  - [ ] Execute tool
  - [ ] Return FunctionCallOutput
- [ ] If yes: Just wire approval callback, rest works
- [ ] Document findings in DECISIONS.md

---

## Mocked-Service Tests (TDD - Write These FIRST)

### Test Setup

- [ ] Create tests/mocked-service/phase-2-tool-execution.test.ts
- [ ] Create tests/mocks/tool-handlers.ts
- [ ] Implement createMockToolHandler(result)
  - [ ] Returns RegisteredTool with mocked execute
  - [ ] Configurable result
- [ ] Enhance tests/mocks/model-client.ts
  - [ ] Add createMockClientWithToolCall(toolName, args)
  - [ ] Returns ResponseItems including FunctionCall

### Test 1: Execute Approved Tool

- [ ] Setup: Mock client with FunctionCall, mock tool handler, approval = true
- [ ] Execute: Create conversation, send message
- [ ] Verify: Tool handler execute() called
- [ ] Verify: Response includes FunctionCallOutput
- [ ] Test passes

### Test 2: Block Denied Tool

- [ ] Setup: Mock client with FunctionCall, approval = false
- [ ] Execute: Send message
- [ ] Verify: Tool handler execute() NOT called
- [ ] Verify: FunctionCallOutput has denial error
- [ ] Test passes

### Test 3: Multiple Tools Sequence

- [ ] Setup: Mock client with two tool calls
- [ ] Approval = true for both
- [ ] Execute: Send message
- [ ] Verify: Both tools executed
- [ ] Verify: Both outputs returned
- [ ] Test passes

### Test 4: Tool Not Found

- [ ] Setup: Mock client requests 'fake_tool'
- [ ] Execute: Send message
- [ ] Verify: Error output (tool not found)
- [ ] Verify: No crash
- [ ] Test passes

### Test 5: Tool Execution Fails

- [ ] Setup: Mock tool throws error
- [ ] Execute: Send message (approve)
- [ ] Verify: Error captured in output
- [ ] Verify: Model receives error message
- [ ] Test passes

### Test 6: Display Functions

- [ ] Spy on renderToolCall and renderToolResult
- [ ] Execute tool flow
- [ ] Verify: Display functions called
- [ ] Test passes

### All Tests

- [ ] All 6 tests pass
- [ ] Tests run fast (<2 seconds)
- [ ] No real tool execution (all mocked)

---

## Functional Verification (Manual CLI Testing)

- [ ] Test: Tool approval (approve case) - readFile
- [ ] Test: Tool approval (deny case) - exec
- [ ] Test: Multiple tools in conversation
- [ ] Test: Tool execution error handling
- [ ] Verify: All manual tests from manual-test-script.md pass

---

## Quality Gates

- [ ] Run: npm run format → no changes
- [ ] Run: npm run lint → 0 errors
- [ ] Run: npx tsc --noEmit → 0 errors
- [ ] Run: npm test
  - [ ] Phase 2 mocked-service tests: all passing
  - [ ] Unit test baseline: 1,876+ maintained
  - [ ] No skipped tests
- [ ] Combined: npm run format && npm run lint && npx tsc --noEmit && npm test
  - [ ] All pass in sequence

---

## Documentation

- [ ] Update DECISIONS.md
  - [ ] Approval callback injection point
  - [ ] Event loop approach
  - [ ] Tool display format choices
  - [ ] Any other key decisions
- [ ] Review: All tasks checked off above
- [ ] Verify: Checklist complete

---

## Final

- [ ] All tasks complete
- [ ] All quality gates passed
- [ ] Manual testing successful
- [ ] Code committed and pushed
- [ ] Phase 2 ready for verification stages
