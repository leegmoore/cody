# Phase 6 Checklist

**Status:** Not Started

---

## Setup

- [x] Phase 5 complete
- [ ] Review Phase 6 documentation
- [ ] Verify all previous phase modules working

---

## Modules

### core/codex
- [ ] Read codex-rs/core/src/codex.rs
- [ ] Port main orchestrator
- [ ] Port event loop
- [ ] Port spawn logic
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### core/codex-conversation
- [ ] Read codex-rs/core/src/codex_conversation.rs
- [ ] Port conversation wrapper
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### core/conversation-manager
- [ ] Read codex-rs/core/src/conversation_manager.rs
- [ ] Port conversation manager
- [ ] Port create/resume/fork operations
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

---

## Integration Tests

- [ ] Test: Full conversation flow (create → send message → execute tool → persist → resume)
- [ ] Test: Authentication flow
- [ ] Test: MCP tool execution
- [ ] Test: File operations
- [ ] Test: Command execution with sandbox

---

## Final

- [ ] All tests passing
- [ ] Update PORT_LOG_MASTER.md
- [ ] Port COMPLETE
- [ ] Commit and push
