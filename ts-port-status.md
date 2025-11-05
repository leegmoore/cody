# TypeScript Port Status

This document tracks the status of porting Rust modules from `codex-rs` to TypeScript in `codex-ts`.

**Last Updated**: 2025-11-05

## Summary

- **Total Modules Ported**: 21
- **Test Files**: 19 passed
- **Tests**: 162 passed
- **Success Rate**: 100%

## Legend

- ✅ **Ported with tests** - Module fully ported with comprehensive test coverage
- 📝 **Type definitions only** - Types ported without runtime logic
- ⏸️ **Not portable** - Platform-specific or requires significant dependencies
- ⏳ **Not yet ported** - Portable module pending implementation

---

## Protocol Modules (`protocol/`)

### Ported

- [x] ✅ **types** - Core protocol type definitions (6 tests)
  - `AskForApproval`, `SandboxPolicy`, `ReasoningEffort` enums
- [x] ✅ **num-format** - Number formatting with locale support (9 tests)
  - `formatWithSeparators()`, `formatSiSuffix()`
- [x] ✅ **conversation-id** - UUIDv7-based conversation identifiers (8 tests)
  - `ConversationId` class with string parsing and equality
- [x] 📝 **user-input** - User input type definitions
  - `UserInput` tagged union for text, image, and local image inputs
- [x] 📝 **parse-command** - Parsed shell command types
  - `ParsedCommand` categorizing commands by intent
- [x] 📝 **approvals** - Approval request types
  - `SandboxRiskLevel`, `ExecApprovalRequestEvent`, `ApplyPatchApprovalRequestEvent`

### Not Yet Ported

- [ ] ⏳ **account** - Account and authentication types
- [ ] ⏳ **config-types** - Configuration type definitions
- [ ] ⏳ **custom-prompts** - Custom prompt handling
- [ ] ⏳ **items** - Turn item types (messages, reasoning, web search)
- [ ] ⏳ **message-history** - Message history management
- [ ] ⏳ **models** - Model request/response types
- [ ] ⏳ **plan-tool** - Planning tool types
- [ ] ⏳ **protocol** - Core protocol message types

---

## Utils Modules (`utils/`)

### Ported

- [x] ✅ **string** - UTF-8 safe string truncation (16 tests)
  - `takeBytesAtCharBoundary()`, `takeLastBytesAtCharBoundary()`
- [x] ✅ **cache** - LRU cache with SHA-1 hashing (13 tests)
  - `LruCache` class, `sha1Digest()`
- [x] ✅ **json-to-toml** - JSON to TOML conversion (9 tests)
  - `jsonToToml()` with type handling
- [x] ✅ **tokenizer** - Token counting with tiktoken (6 tests)
  - `Tokenizer` class with encode/decode/count methods
- [x] ✅ **readiness** - Async readiness synchronization (8 tests)
  - `ReadinessFlag` with token-based subscription

### Not Portable

- [ ] ⏸️ **git** - Git operations (platform-specific, uses libgit2)
- [ ] ⏸️ **image** - Image processing (platform-specific, uses image crate)
- [ ] ⏸️ **pty** - Pseudo-terminal handling (platform-specific)

---

## Common Modules (`common/`)

### Ported

- [x] ✅ **fuzzy-match** - Fuzzy string matching with Unicode (12 tests)
  - `fuzzyMatch()`, `fuzzyIndices()`
- [x] ✅ **elapsed** - Duration formatting (5 tests)
  - `formatDuration()`, `formatElapsed()`
- [x] ✅ **format-env-display** - Environment variable display (5 tests)
  - `formatEnvDisplay()` with masking
- [x] ✅ **sandbox-summary** - Sandbox policy summarization (8 tests)
  - `summarizeSandboxPolicy()`
- [x] ✅ **approval-presets** - Built-in approval/sandbox presets (5 tests)
  - `builtinApprovalPresets()`
- [x] ✅ **model-presets** - Built-in model configurations (7 tests)
  - `builtinModelPresets()`
- [x] ✅ **config-override** - CLI config override parsing (18 tests)
  - `CliConfigOverrides`, `parseTomlValue()`

### Not Yet Ported

- [ ] ⏳ **approval-mode-cli-arg** - CLI argument parsing for approval modes
- [ ] ⏳ **sandbox-mode-cli-arg** - CLI argument parsing for sandbox modes
- [ ] ⏳ **config-summary** - Configuration summary generation

---

## Async Utilities (`async-utils/`)

### Ported

- [x] ✅ **async-utils** - Promise cancellation utilities (5 tests)
  - `orCancel()` - Race promise against AbortSignal (Rust tokio::select! pattern)

---

## ANSI Processing (`ansi-escape/`)

### Ported

- [x] ✅ **ansi-escape** - ANSI escape sequence processing (9 tests)
  - `expandTabs()`, `processAnsiEscape()`, `processAnsiEscapeLine()`

---

## Ollama Integration (`ollama/`)

### Ported

- [x] ✅ **url** - Ollama URL utilities (5 tests)
  - `isOpenAiCompatibleBaseUrl()`, `baseUrlToHostRoot()`
- [x] ✅ **parser** - Ollama pull stream parsing (8 tests)
  - `PullEvent` types, `pullEventsFromValue()`

### Not Yet Ported

- [ ] ⏳ **client** - Ollama HTTP client
- [ ] ⏳ **pull** - Ollama model pulling logic

---

## Platform-Specific Modules (Not Portable)

The following modules are intentionally not ported due to platform-specific dependencies:

- `linux-sandbox` - Linux sandboxing (Linux-specific syscalls)
- `windows-sandbox-rs` - Windows sandboxing (Windows-specific APIs)
- `process-hardening` - Process security (platform-specific)
- `pty` - Pseudo-terminal handling (platform-specific)
- `git` - Git operations (requires libgit2)
- `image` - Image processing (requires image crate)
- `exec` - Command execution (platform-specific)
- `execpolicy` - Execution policy (platform-specific)
- `keyring-store` - Credential storage (platform-specific)
- `otel` - OpenTelemetry integration (complex dependencies)
- `backend-client` - Backend HTTP client (complex dependencies)
- `mcp-server` - MCP server implementation (requires full protocol)
- `mcp-types` - MCP type definitions (complex protocol types)
- `chatgpt` - ChatGPT integration (complex dependencies)
- `cloud-tasks` - Cloud task queue (GCP-specific)
- `cloud-tasks-client` - Cloud task client (GCP-specific)
- `core` - Core application logic (ties together multiple components)
- `cli` - CLI entry point (platform-specific)
- `tui` - Terminal UI (complex dependencies)
- `app-server` - Application server (complex dependencies)
- `app-server-protocol` - Server protocol (complex dependencies)
- `responses-api-proxy` - API proxy (complex dependencies)
- `rmcp-client` - RMCP client (complex dependencies)
- `code` - Code application logic (ties together multiple components)
- `apply-patch` - Patch application (file system operations)
- `file-search` - File searching (platform-specific)
- `feedback` - Feedback collection (complex dependencies)
- `login` - Login flow (complex dependencies)
- `arg0` - Process argument handling (platform-specific)
- `stdio-to-uds` - STDIO to Unix domain socket (platform-specific)
- `protocol-ts` - TypeScript protocol generation (build tool)

---

## Design Principles

The TypeScript port follows these principles:

1. **Idiomatic TypeScript** - Use modern TypeScript patterns, not literal Rust translations
2. **Comprehensive Tests** - Port all Rust tests and maintain coverage
3. **Unicode Correctness** - Preserve Rust's careful Unicode handling
4. **Type Safety** - Leverage TypeScript's type system fully
5. **Minimal Dependencies** - Use existing libraries where appropriate (e.g., lru-cache, tiktoken)
6. **Portability Focus** - Only port modules that are algorithmic and platform-independent

---

## Test Coverage

```
Test Files:  19 passed (19)
Tests:       162 passed (162)
Success Rate: 100%
```

All ported modules maintain 100% test pass rate with comprehensive test coverage ported from the Rust implementation.

---

## Next Steps

### High Priority (Pure Types/Algorithms)

These modules are good candidates for porting as they have minimal dependencies:

1. **protocol/config-types** - Configuration type definitions
2. **protocol/custom-prompts** - Custom prompt handling
3. **common/approval-mode-cli-arg** - Approval mode CLI args
4. **common/sandbox-mode-cli-arg** - Sandbox mode CLI args
5. **common/config-summary** - Config summary generation

### Medium Priority (May Have Dependencies)

These modules may require additional type definitions or have moderate complexity:

1. **protocol/items** - Turn item types
2. **protocol/message-history** - Message history
3. **protocol/plan-tool** - Planning tool types
4. **ollama/client** - Ollama HTTP client (if keeping HTTP logic simple)
5. **ollama/pull** - Ollama model pulling

### Lower Priority (Complex Dependencies)

These modules depend on many other modules or have complex protocol handling:

1. **protocol/models** - Complex model types with many dependencies
2. **protocol/protocol** - Core protocol types tying everything together
3. **protocol/account** - Account types with authentication

---

## Notes

- Modules marked ⏸️ **Not portable** are intentionally excluded due to platform-specific requirements
- Type-only modules (📝) don't have runtime logic but provide TypeScript definitions for protocol messages
- All ported modules are in `codex-ts/src/` following the same directory structure as `codex-rs/`
- Tests are co-located with implementation files using `.test.ts` suffix
