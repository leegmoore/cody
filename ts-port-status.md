# TypeScript Port Status

This document tracks the status of porting Rust modules from `codex-rs` to TypeScript in `codex-ts`.

**Last Updated**: 2025-11-05

## Summary

- **Total Modules**: 43
- **Ported**: 21
- **Not Yet Ported**: 22
- **Test Files**: 19 passed
- **Tests**: 162 passed
- **Success Rate**: 100%

---

## All Modules

### ansi-escape
- [x] **ansi-escape** - ANSI escape sequence processing (9 tests)

### app-server
- [ ] **app-server** - Application server

### app-server-protocol
- [ ] **app-server-protocol** - Server protocol types

### apply-patch
- [ ] **apply-patch** - Patch application

### arg0
- [ ] **arg0** - Process argument handling

### async-utils
- [x] **async-utils** - Promise cancellation utilities (5 tests)

### backend-client
- [ ] **backend-client** - Backend HTTP client

### chatgpt
- [ ] **chatgpt** - ChatGPT integration

### cli
- [ ] **cli** - CLI entry point

### cloud-tasks
- [ ] **cloud-tasks** - Cloud task queue

### cloud-tasks-client
- [ ] **cloud-tasks-client** - Cloud task client

### codex-backend-openapi-models
- [ ] **codex-backend-openapi-models** - Backend OpenAPI models

### common
- [x] **common/approval-presets** - Built-in approval/sandbox presets (5 tests)
- [x] **common/config-override** - CLI config override parsing (18 tests)
- [x] **common/elapsed** - Duration formatting (5 tests)
- [x] **common/format-env-display** - Environment variable display (5 tests)
- [x] **common/fuzzy-match** - Fuzzy string matching (12 tests)
- [x] **common/model-presets** - Built-in model configurations (7 tests)
- [x] **common/sandbox-summary** - Sandbox policy summarization (8 tests)
- [ ] **common/approval-mode-cli-arg** - CLI argument parsing for approval modes
- [ ] **common/config-summary** - Configuration summary generation
- [ ] **common/sandbox-mode-cli-arg** - CLI argument parsing for sandbox modes

### core
- [ ] **core** - Core application logic

### exec
- [ ] **exec** - Command execution

### execpolicy
- [ ] **execpolicy** - Execution policy

### feedback
- [ ] **feedback** - Feedback collection

### file-search
- [ ] **file-search** - File searching

### keyring-store
- [ ] **keyring-store** - Credential storage

### linux-sandbox
- [ ] **linux-sandbox** - Linux sandboxing

### login
- [ ] **login** - Login flow

### mcp-server
- [ ] **mcp-server** - MCP server implementation

### mcp-types
- [ ] **mcp-types** - MCP type definitions

### ollama
- [x] **ollama/parser** - Ollama pull stream parsing (8 tests)
- [x] **ollama/url** - Ollama URL utilities (5 tests)
- [ ] **ollama/client** - Ollama HTTP client
- [ ] **ollama/pull** - Ollama model pulling logic

### otel
- [ ] **otel** - OpenTelemetry integration

### process-hardening
- [ ] **process-hardening** - Process security

### protocol
- [x] **protocol/approvals** - Approval request types (type definitions)
- [x] **protocol/conversation-id** - UUIDv7-based conversation identifiers (8 tests)
- [x] **protocol/num-format** - Number formatting (9 tests)
- [x] **protocol/parse-command** - Parsed shell command types (type definitions)
- [x] **protocol/types** - Core protocol type definitions (6 tests)
- [x] **protocol/user-input** - User input types (type definitions)
- [ ] **protocol/account** - Account and authentication types
- [ ] **protocol/config-types** - Configuration type definitions
- [ ] **protocol/custom-prompts** - Custom prompt handling
- [ ] **protocol/items** - Turn item types
- [ ] **protocol/message-history** - Message history management
- [ ] **protocol/models** - Model request/response types
- [ ] **protocol/plan-tool** - Planning tool types
- [ ] **protocol/protocol** - Core protocol message types

### protocol-ts
- [ ] **protocol-ts** - TypeScript protocol generation

### responses-api-proxy
- [ ] **responses-api-proxy** - API proxy

### rmcp-client
- [ ] **rmcp-client** - RMCP client

### stdio-to-uds
- [ ] **stdio-to-uds** - STDIO to Unix domain socket

### tui
- [ ] **tui** - Terminal UI

### utils/cache
- [x] **utils/cache** - LRU cache with SHA-1 hashing (13 tests)

### utils/git
- [ ] **utils/git** - Git operations

### utils/image
- [ ] **utils/image** - Image processing

### utils/json-to-toml
- [x] **utils/json-to-toml** - JSON to TOML conversion (9 tests)

### utils/pty
- [ ] **utils/pty** - Pseudo-terminal handling

### utils/readiness
- [x] **utils/readiness** - Async readiness synchronization (8 tests)

### utils/string
- [x] **utils/string** - UTF-8 safe string truncation (16 tests)

### utils/tokenizer
- [x] **utils/tokenizer** - Token counting with tiktoken (6 tests)

### windows-sandbox-rs
- [ ] **windows-sandbox-rs** - Windows sandboxing

---

## Test Coverage

```
Test Files:  19 passed (19)
Tests:       162 passed (162)
Success Rate: 100%
```
