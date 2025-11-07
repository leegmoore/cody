# Phase 5 Checklist

**Status:** Not Started

---

## Setup

- [x] Phase 4 complete
- [ ] Review Phase 5 documentation

---

## Authentication Modules

### keyring-store
- [x] Read codex-rs/keyring-store/src/
- [x] Port credential storage
- [x] Create tests
- [x] Verify tests pass
- [x] Update logs

### login
- [x] Read codex-rs/login/src/
- [x] Port login flows (PKCE + stub types)
- [x] Create tests
- [x] Verify tests pass
- [x] Update logs

### core/auth
- [x] Read codex-rs/core/src/auth/
- [x] Port auth manager (CodexAuth + AuthManager + storage backends)
- [x] Create tests (27 tests)
- [x] Verify tests pass
- [x] Update logs

---

## CLI & Integration

### cli
- [x] Read codex-rs/cli/src/
- [x] Port CLI utilities (library-focused: safeFormatKey)
- [x] Create tests
- [x] Verify tests pass
- [x] Update logs

### app-server-protocol
- [x] Read codex-rs/app-server-protocol/src/
- [x] Port JSON-RPC protocol types (library-focused)
- [x] Create tests
- [x] Verify tests pass
- [x] Update logs

### app-server
- [ ] Read codex-rs/app-server/src/
- [ ] Port IDE server
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

---

## Utilities

### utils/git
- [x] Read codex-rs/utils/git/src/ (1,814 lines!)
- [x] Port git operations (spawn-based git commands)
- [x] Create tests (22 comprehensive tests)
- [x] Verify tests pass
- [x] Update logs

### utils/image
- [ ] Read codex-rs/utils/image/src/
- [ ] Port image processing
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### utils/pty
- [ ] Read codex-rs/utils/pty/src/
- [ ] Port PTY handling
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

---

## Integration Tests

- [ ] Test: Login flow (ChatGPT)
- [ ] Test: Login flow (API key)
- [ ] Test: Credential storage
- [ ] Test: CLI execution
- [ ] Test: App server communication

---

## Final

- [ ] All tests passing
- [ ] Update PORT_LOG_MASTER.md
- [ ] Commit and push
