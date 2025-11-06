# Phase 3 Checklist

**Status:** Not Started

---

## Standalone Modules (Can Work in Parallel)

### apply-patch
- [x] Read codex-rs/apply-patch/src/lib.rs
- [x] Read tests in codex-rs/apply-patch/tests/
- [x] Create codex-ts/src/apply-patch/index.ts
- [x] Port patch parsing logic
- [x] Port patch application logic
- [x] Port tree-sitter integration (stub for now - TODO)
- [x] Create tests (49 tests)
- [x] Verify tests pass (49/49 ✅)
- [ ] Update logs

### file-search
- [x] Read codex-rs/file-search/src/lib.rs
- [x] Create codex-ts/src/file-search/index.ts
- [x] Port fuzzy search logic (using fuzzysort + globby)
- [x] Create tests (11 tests)
- [x] Verify tests pass (11/11 ✅)
- [ ] Update logs

### execpolicy
- [x] Read codex-rs/execpolicy/src/lib.rs
- [x] Create codex-ts/src/execpolicy/index.ts
- [x] Port policy parsing (JSON-based, simplified from Starlark)
- [x] Create tests (32 tests)
- [x] Verify tests pass (32/32 ✅)
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
