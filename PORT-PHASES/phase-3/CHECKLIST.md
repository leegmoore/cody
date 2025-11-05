# Phase 3 Checklist

**Status:** Not Started

---

## Standalone Modules (Can Work in Parallel)

### apply-patch
- [ ] Read codex-rs/apply-patch/src/lib.rs
- [ ] Read tests in codex-rs/apply-patch/tests/
- [ ] Create codex-ts/src/apply-patch/index.ts
- [ ] Port patch parsing logic
- [ ] Port patch application logic
- [ ] Port tree-sitter integration
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### file-search
- [ ] Read codex-rs/file-search/src/lib.rs
- [ ] Create codex-ts/src/file-search/index.ts
- [ ] Port fuzzy search logic
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### execpolicy
- [ ] Read codex-rs/execpolicy/src/lib.rs
- [ ] Create codex-ts/src/execpolicy/index.ts
- [ ] Port policy parsing
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

---

## Core Integration

### core/sandboxing
- [ ] Read codex-rs/core/src/sandboxing/
- [ ] Port sandboxing logic
- [ ] Create tests
- [ ] Update logs

### exec
- [ ] Read codex-rs/exec/src/
- [ ] Port execution module
- [ ] Create tests
- [ ] Update logs

### core/exec
- [ ] Read codex-rs/core/src/exec.rs
- [ ] Port execution engine
- [ ] Create tests
- [ ] Update logs

### core/tools
- [ ] Read codex-rs/core/src/tools/
- [ ] Port tool coordination
- [ ] Create tests
- [ ] Update logs

---

## Integration Tests

- [ ] Test: Execute command with sandbox policy
- [ ] Test: Apply file patch
- [ ] Test: Search files with fuzzy matching
- [ ] Test: Tool coordination with all tools

---

## Final

- [ ] All tests passing
- [ ] Update PORT_LOG_MASTER.md
- [ ] Commit and push
