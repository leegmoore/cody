# Phase 6 Checklist

**Status:** Not Started

---

## Prerequisites

- [x] Phase 5.1 complete (Conversation & history)
- [ ] Phase 5.2 complete (Code quality clean) - CRITICAL
- [ ] Verify clean baseline:
  - [ ] npx tsc --noEmit → 0 errors
  - [ ] npm run lint → 0 problems
  - [ ] npm test → 0 failures, 0 skipped
- [ ] Review Phase 6 documentation

---

## Module 1: core/codex (Port in Sections)

### Section 1: Core Types & Session

- [ ] Read codex-rs/core/src/codex.rs (first 500 lines)
- [ ] Create codex-ts/src/core/codex/types.ts
- [ ] Port Session struct
- [ ] Port TurnContext struct
- [ ] Port ActiveTurn state types
- [ ] Port ProcessedResponseItem type
- [ ] Create tests for types (10 tests)
- [ ] Verify tests pass

### Section 2: Event Loop

- [ ] Port event loop structure
- [ ] Port Op handling (interrupt, user_input, user_turn, etc.)
- [ ] Port Event emission logic
- [ ] Port message passing (async channels → EventEmitter or similar)
- [ ] Create tests for event loop (15 tests)
- [ ] Test Op → Event flows
- [ ] Verify tests pass

### Section 3: Tool Integration

- [ ] Port tool call detection
- [ ] Integrate ToolRouter (Phase 3)
- [ ] Port tool execution coordination
- [ ] Port tool result handling
- [ ] Port approval request generation
- [ ] Create tests for tool integration (20 tests)
- [ ] Test tool call → execution → result flow
- [ ] Verify tests pass

### Section 4: Turn Processing

- [ ] Port turn initiation logic
- [ ] Port response item processing
- [ ] Integrate response_processing (Phase 5.1)
- [ ] Integrate conversation_history (Phase 5.1)
- [ ] Port turn completion handling
- [ ] Create tests for turn processing (20 tests)
- [ ] Test full turn lifecycle
- [ ] Verify tests pass

### Section 5: MCP & Advanced Features

- [ ] Port MCP tool call handling
- [ ] Integrate MCP connection manager (Phase 4.3)
- [ ] Port web search integration (if present)
- [ ] Port special feature handling
- [ ] Create tests for MCP integration (15 tests)
- [ ] Verify tests pass

### Section 6: Spawn/Resume

- [ ] Port conversation spawn logic
- [ ] Port resume from rollout
- [ ] Port fork conversation
- [ ] Integrate RolloutRecorder (Phase 2)
- [ ] Create tests for spawn/resume (20 tests)
- [ ] Test resume from JSONL
- [ ] Test fork operation
- [ ] Verify tests pass

### Integration & Polish

- [ ] Create codex-ts/src/core/codex/index.ts (main file)
- [ ] Wire all sections together
- [ ] Add comprehensive JSDoc
- [ ] Integration test: Create conversation
- [ ] Integration test: Send message
- [ ] Integration test: Execute tool
- [ ] Integration test: Persist and resume
- [ ] All codex tests passing

---

## Module 2: core/codex-conversation

- [ ] Read codex-rs/core/src/codex_conversation.rs
- [ ] Create codex-ts/src/core/codex-conversation/index.ts
- [ ] Port CodexConversation class
- [ ] Port submit() method
- [ ] Port next_event() method
- [ ] Port rollout_path() method
- [ ] Create tests (10 tests)
- [ ] Test delegation to core/codex
- [ ] Verify tests pass

---

## Module 3: core/conversation-manager

- [ ] Read codex-rs/core/src/conversation_manager.rs
- [ ] Create codex-ts/src/core/conversation-manager/index.ts
- [ ] Port ConversationManager class
- [ ] Port new_conversation() method
- [ ] Port get_conversation() method
- [ ] Port resume_conversation_from_rollout() method
- [ ] Port resume_conversation_with_history() method
- [ ] Port remove_conversation() method
- [ ] Port fork_conversation() method
- [ ] Create tests (30 tests)
- [ ] Test conversation lifecycle
- [ ] Test fork operation
- [ ] Verify tests pass

---

## Integration Tests (End-to-End)

- [ ] Create codex-ts/tests/integration/
- [ ] Test: Full conversation (create → message → tool → persist → resume)
- [ ] Test: Authentication flow (login → create conversation)
- [ ] Test: MCP tool execution
- [ ] Test: File operations workflow
- [ ] Test: Command execution with approval
- [ ] Test: Fork and parallel conversations
- [ ] Test: Error handling (network, API, tool failures)
- [ ] All integration tests passing

---

## Code Quality Gate

### TypeScript Check
- [ ] Run: npx tsc --noEmit
- [ ] Result: 0 errors
- [ ] If errors: Fix before proceeding
- [ ] Document: What was fixed

### Lint Check
- [ ] Run: npm run lint
- [ ] Result: 0 problems
- [ ] If errors: Fix before proceeding
- [ ] Document: What was fixed

### Test Check
- [ ] Run: npm test
- [ ] Result: All passing, 0 skipped
- [ ] If failures: Fix before proceeding
- [ ] Document: What was fixed

### Format Check
- [ ] Run: npm run format
- [ ] Result: No file changes
- [ ] If changes: Commit formatted code

### Combined Verification
- [ ] Run: npm run format && npm run lint && npx tsc --noEmit && npm test
- [ ] All commands succeed
- [ ] No errors, no warnings, no skips
- [ ] Screenshot or log output for verification

---

## Documentation

- [ ] Update codex-ts/PORT_LOG_MASTER.md (Phase 6 complete)
- [ ] Update codex-ts/README.md (library usage examples)
- [ ] Document core/codex architecture
- [ ] Document conversation-manager API
- [ ] Add examples (create, send, resume)

---

## Final Verification

### Functional
- [ ] Can create conversation: `const conv = await manager.createConversation()`
- [ ] Can send message: `const response = await conv.sendMessage("test")`
- [ ] Can execute tool: Message triggers tool, tool executes, result returned
- [ ] Can persist: Conversation saved to JSONL
- [ ] Can resume: Load from JSONL, continue conversation
- [ ] Can fork: Branch conversation at specific turn

### Quality (Entire Codebase)
- [ ] 0 TypeScript errors (verified)
- [ ] 0 ESLint problems (verified)
- [ ] 0 test failures (verified)
- [ ] 0 skipped tests (verified)
- [ ] All formatted (verified)

### Library Ready
- [ ] Can be imported: `import {ConversationManager} from '@openai/codex-core'`
- [ ] All exports documented
- [ ] Examples work
- [ ] README complete

---

## Final

- [ ] All modules ported and tested
- [ ] All integration tests passing
- [ ] All quality gates passed
- [ ] Documentation complete
- [ ] Update PORT_LOG_MASTER.md
- [ ] Update STATUS.md with completion summary
- [ ] Commit and push
- [ ] **Phase 6 COMPLETE - RUST PORT FINISHED**
