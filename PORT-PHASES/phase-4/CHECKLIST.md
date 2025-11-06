# Phase 4 Checklist

**Status:** Not Started

---

## Setup

- [x] Phase 3 complete
- [ ] Review Phase 4 documentation

---

## Modules

### mcp-types
- [ ] Read codex-rs/mcp-types/src/
- [ ] Port MCP type definitions
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

### ollama/client
- [ ] Read codex-rs/ollama/src/
- [ ] Complete ollama module (parser and url already done)
- [ ] Create tests
- [ ] Verify tests pass
- [ ] Update logs

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
