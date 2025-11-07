# Phase 4.4 Checklist

**Status:** Not Started
**Design:** SCRIPT_HARNESS_DESIGN_FINAL.md

---

## Setup & Phase 4.2 Cleanup

- [x] Phase 4.2 complete (Messages API)
- [x] Final design complete
- [ ] Fix Phase 4.2 errors (2 errors in retry.test.ts cleanup)
- [ ] Add missing Phase 4.2 tests (Stage 6: Response Parser)
- [ ] Implement non-streaming response parser (20 tests from design RP-01 through RP-20)
- [ ] Verify all 167 Phase 4.2 tests passing (currently 148)
- [ ] Verify no errors
- [ ] Review design document thoroughly
- [ ] Install quickjs-emscripten

---

## Week 1: Runtime & Hardening

### Runtime Infrastructure
- [ ] Create src/core/script-harness/ directory
- [ ] Create runtime/types.ts (ScriptRuntimeAdapter interface)
- [ ] Create runtime/quickjs-runtime.ts
- [ ] Implement worker pool
- [ ] Implement memory limits (setMemoryLimit 96MB)
- [ ] Implement interrupt handler (timeout detection)
- [ ] Implement async function binding
- [ ] Test runtime creation and cleanup
- [ ] Verify tests pass

### Hardening
- [ ] Create hardening.ts
- [ ] Implement intrinsic freezing (Object, Array, Function, Promise)
- [ ] Remove eval/Function constructors
- [ ] Seal global scope
- [ ] Test frozen intrinsics
- [ ] Test banned API access fails
- [ ] Verify tests pass

---

## Week 2: Detection & Parsing

### Detection
- [ ] Create detector.ts
- [ ] Implement XML tag detection (<tool-calls> only, no fences)
- [ ] Implement balanced tag validation
- [ ] Handle multiple blocks (sequential)
- [ ] Preserve surrounding text/thinking
- [ ] Test detection with various inputs
- [ ] Verify tests pass

### Parsing
- [ ] Create parser.ts
- [ ] Implement input validation (UTF-8, size limits)
- [ ] Implement banned token scanning
- [ ] Extract script code
- [ ] Test parser edge cases
- [ ] Test malformed inputs
- [ ] Verify tests pass

---

## Week 3: Tool Facade & Promise Tracking

### Tool Facade
- [ ] Create tool-facade.ts
- [ ] Implement tools Proxy
- [ ] Bind applyPatch
- [ ] Bind exec
- [ ] Bind fileSearch
- [ ] Validate arguments against schemas
- [ ] Test tool binding
- [ ] Test validation
- [ ] Verify tests pass

### Promise Tracking
- [ ] Create runtime/promise-tracker.ts
- [ ] Implement PromiseTracker class
- [ ] Track promises with AbortController
- [ ] Implement ensureAllSettled()
- [ ] Implement abort logic (250ms grace)
- [ ] Test orphaned promise cleanup
- [ ] Test Promise.race cancellation
- [ ] Verify tests pass

---

## Week 4: Approval Integration

### Approval Bridge
- [ ] Create approvals-bridge.ts
- [ ] Integrate with ToolOrchestrator
- [ ] Implement Promise suspend (pending resolver)
- [ ] Implement resume on approval
- [ ] Implement rejection on denial
- [ ] Handle approval timeout
- [ ] Test approval flow (approved)
- [ ] Test approval flow (denied)
- [ ] Test approval timeout
- [ ] Verify tests pass

### Context
- [ ] Create context.ts
- [ ] Implement ScriptContext interface
- [ ] Inject conversationId, workingDirectory, etc.
- [ ] Freeze context object
- [ ] Implement telemetry.emitProgress
- [ ] Test context injection
- [ ] Verify tests pass

---

## Week 5: Orchestration & Integration

### Orchestrator
- [ ] Create orchestrator.ts
- [ ] Implement executeScript() main function
- [ ] Coordinate all components
- [ ] Handle worker lifecycle
- [ ] Implement error handling
- [ ] Test orchestrator
- [ ] Verify tests pass

### Serialization
- [ ] Create serializer.ts
- [ ] Add ScriptToolCall to protocol/models.ts
- [ ] Add ScriptToolCallOutput to protocol/models.ts
- [ ] Implement response serialization
- [ ] Preserve history ordering
- [ ] Test serialization
- [ ] Verify tests pass

### Errors
- [ ] Create errors.ts
- [ ] Define all error classes (Syntax, Timeout, Memory, etc.)
- [ ] Implement stack sanitization
- [ ] Test error reporting
- [ ] Verify tests pass

### Feature Flags
- [ ] Create feature-flags.ts
- [ ] Add ScriptHarnessConfig to core/config
- [ ] Implement disabled/dry-run/enabled modes
- [ ] Test each mode
- [ ] Verify tests pass

### Integration
- [ ] Update response-processing.ts
- [ ] Add script detection before ToolRouter
- [ ] Wire up across all 3 APIs
- [ ] Test with Responses API
- [ ] Test with Chat API
- [ ] Test with Messages API
- [ ] Verify tests pass

---

## Final Testing

- [ ] Run full test suite (40 tests minimum)
- [ ] Security tests S1-S15 passing
- [ ] Functional tests F1-F20 passing
- [ ] Integration tests I1-I5 passing
- [ ] Update logs
- [ ] Commit and push
- [ ] Phase 4.4 COMPLETE

---

## Test Count: 40

- Security: 15
- Functional: 20
- Integration: 5
