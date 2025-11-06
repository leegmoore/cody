# Phase 4 Checklist

**Status:** Not Started

---

## Setup

- [x] Phase 3 complete
- [x] Review Phase 4 documentation

---

## Modules

### mcp-types
- [x] Read codex-rs/mcp-types/src/
- [x] Port MCP type definitions
- [x] Create tests
- [x] Verify tests pass (12/12 passing)
- [x] Update logs

### ollama/client
- [x] Read codex-rs/ollama/src/
- [x] Complete ollama module (parser and url already done)
- [x] Create tests
- [x] Verify tests pass (45/45 passing)
- [x] Update logs

### core/client
- [ ] Read codex-rs/core/src/client.rs
- [ ] Port model client interface
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### core/chat_completions
- [ ] Read codex-rs/core/src/chat_completions.rs
- [ ] Port streaming handler
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### backend-client
- [ ] Read codex-rs/backend-client/src/
- [ ] Port API client
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### chatgpt
- [ ] Read codex-rs/chatgpt/src/
- [ ] Port ChatGPT integration
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### rmcp-client
- [ ] Read codex-rs/rmcp-client/src/
- [ ] Port RMCP client
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### mcp-server
- [ ] Read codex-rs/mcp-server/src/
- [ ] Port MCP server management
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### core/mcp
- [ ] Read codex-rs/core/src/mcp/
- [ ] Port MCP integration
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

---

## Integration Tests

- [ ] Test: Call OpenAI API
- [ ] Test: Call Anthropic API
- [ ] Test: Call Ollama locally
- [ ] Test: Connect to MCP server
- [ ] Test: Stream responses

---

## Final

- [ ] All tests passing
- [ ] Update PORT_LOG_MASTER.md
- [ ] Commit and push
