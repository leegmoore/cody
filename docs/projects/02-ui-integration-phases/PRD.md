# Project 02: UI Integration & Library Definition

**Project:** UI Integration & Library API
**Status:** Planning
**Start Date:** TBD
**Dependencies:** Phase 6 complete, Phase 5.2 complete

---

## 1. Overview

**What We're Building**

Project 02 integrates all ported Codex modules (Phases 1-6) into a working command-line interface and defines the library API surface for @openai/codex-core. This project validates the Rust → TypeScript port by wiring protocol, configuration, persistence, execution, client, tools, and orchestration layers into complete conversation flows.

**Why It Matters**

The port is functionally complete but untested as an integrated system. Individual modules have unit tests, but we haven't verified end-to-end workflows. This project proves the port works, exposes integration issues, and establishes the library interface that external developers will use.

**Deliverables**

Working CLI demonstrating all capabilities, documented library API defining @openai/codex-core public surface, and optionally a REST API specification. The CLI serves as both validation tool and reference implementation.

---

## 2. Success Criteria

### Functional Capabilities

1. **Basic operations work:** Create conversation, send messages, receive responses, maintain multi-turn history. Verify via CLI commands (`codex new`, `codex chat`, conversation history persists across turns).

2. **All providers functional:** OpenAI Responses API, OpenAI Chat Completions, and Anthropic Messages API all support conversation flows. Verify by running same conversation on each provider—all three work identically.

3. **Authentication methods work:** API keys (OpenAI + Anthropic) and OAuth flows (ChatGPT + Claude) all complete successfully and enable authenticated conversations. Verify by testing each auth method independently.

4. **Tool execution complete:** Model tool calls trigger approval UI, approved tools execute, results return to model. Verify with conversation that requires tool usage.

5. **Persistence functional:** Conversations save to JSONL, can list saved conversations, can resume with complete history. Verify by resume test (create → chat → exit → resume → history intact).

6. **MCP integration works:** Can connect to MCP servers, call MCP tools, access MCP resources (if server configured).

### Quality Gates

1. **Code quality baseline maintained:** Run `npx tsc --noEmit && npm run lint && npm test` in sequence. Result: 0 TypeScript errors, 0 ESLint errors (warnings acceptable), 1,876+ tests passing, 0 skipped tests.

2. **Mocked-service test coverage:** Integration-level tests at library API boundaries with external dependencies mocked. Minimum 15 tests in `tests/mocked-service/` covering workflows, providers, and auth methods. Created during phase planning as contracts are defined. See `docs/core/contract-testing-tdd-philosophy.md` for approach.

3. **Performance acceptable:** General responsiveness meets user expectations for CLI tool (command execution, API calls, tool execution feel snappy and responsive).

### Deliverables

1. **Working CLI** with commands (new, chat, list, resume, login), help text, version info—available as `codex` command globally.

2. **Library API specification** document (docs/LIBRARY-API.md, 200-400 lines) covering all public exports, TypeScript signatures, usage examples, primary entry point (ConversationManager).

3. **REST API specification** (optional, docs/REST-API.md) with endpoints and formats—design only, implementation deferred.

4. **Updated documentation:** PORT_LOG_MASTER.md has Project 02 summary, README.md has library usage instructions.

---

## 3. Scope

### 3.1 In Scope

**CLI Implementation:**
Commands for conversation lifecycle (new, chat, list, resume), authentication (login for OAuth flows), configuration (set provider, model, auth method), and basic display (text output to console, tool approval prompts, response rendering).

**Display Modes (Configurable):**
Streaming mode with SSE delta rendering for all three APIs (Responses, Chat, Messages)—tokens appear as they arrive for live feedback. Batch mode with complete response rendering—print full answer after completion for cleaner output. Default mode set in config file, override via CLI flag (`--stream` or `--batch`). Both modes work with all providers.

**Provider Integration:**
All three LLM APIs wired and functional (OpenAI Responses, OpenAI Chat Completions, Anthropic Messages). Provider switching supported via configuration. Same conversation code works across all providers.

**Authentication Methods:**
API key storage and usage (OpenAI + Anthropic), ChatGPT OAuth flow (login, token refresh, keyring storage), Claude OAuth flow if applicable. Auth method selection via configuration or CLI flags.

**Tool Execution:**
Structured tool calling (Rust-compatible harness), approval flow in CLI (prompt user for dangerous operations), tool execution with mocked external boundaries for testing, result display in console.

**Persistence & Resume:**
Conversations save to JSONL (~/.codex/conversations/), rollout format matches Rust implementation, list saved conversations, resume with complete history reconstruction.

**Library API Definition:**
Document public exports (@openai/codex-core), define primary entry points (ConversationManager, Conversation, ModelClient), TypeScript signatures for all public methods, usage examples for common workflows, contract boundaries identified for testing.

**REST API Specification (Design Only):**
Document HTTP endpoints, request/response formats, authentication patterns, error responses. Implementation deferred to later project.

### 3.2 Non-Scope

**Script Harness:** Deferred to Project 03. This project uses structured tool calling only (Rust-compatible). QuickJS sandbox, Promise.all parallel execution, and script-based workflows not integrated in CLI yet.

**Memory Innovations:** Deferred to Projects 04-06. Compression gradient, offline processing, context preprocessing, announcement board, file cabinet—none implemented. Standard conversation history only.

**Rich TUI:** Deferred indefinitely. Simple text console output only. No ratatui/blessed/ink widgets, no markdown rendering, no syntax highlighting, no interactive chat interface.

**Additional Tools:** Web search, agent orchestration, prompt management tools (Phase 4.7 stubs) not integrated into CLI. Core file/exec tools only.

**Performance Optimization:** No profiling, no optimization work. Acceptable responsiveness sufficient. Detailed performance tuning deferred.

**Production Hardening:** No deployment scripts, no monitoring, no logging infrastructure, no error tracking. Development/testing tool only.

---

## 4. Dependencies & Prerequisites

### Code Dependencies

**Phase 6 complete:** Core orchestration modules ported (core/codex, core/codex-conversation, core/conversation-manager). All 75 modules from Phases 1-6 integrated and tested. 1,876 tests passing.

**Phase 5.2 complete:** Code quality baseline established. Zero TypeScript errors, zero ESLint errors (warnings acceptable), all tests passing, no skipped tests.

### External Requirements

**API Keys:**
- OpenAI API key (for Responses and Chat APIs)
- Anthropic API key (for Messages API)
- OpenRouter API key (for Chat Completions via OpenRouter)

**OAuth Tokens:**
- ChatGPT OAuth token (read from ~/.codex where ChatGPT Pro CLI stores it)
- Anthropic OAuth token (read from ~/.claude where Claude Code stores it)
- Tokens refreshed by user re-authenticating in respective apps when expired
- No OAuth flow implementation—just token retrieval from keyring/filesystem

**Development environment:** Node.js 18+, npm, TypeScript, Vitest operational.

### Agent Prerequisites

**Read before starting any phase:**
- This PRD (project context)
- docs/core/contract-testing-tdd-philosophy.md (testing approach)
- docs/core/dev-standards.md (code quality requirements)
- initial-plan.md (phase roadmap)

**For each phase, also read:**
- Phase-specific README.md, CHECKLIST.md, QUICK_START.txt

---

## 5. Quality Standards

### Code Quality

**TypeScript strictness:** Strict mode enabled, no `any` types (use `unknown` or proper types), no implicit returns, no unsafe member access. Verified via `npx tsc --noEmit` showing 0 errors.

**ESLint compliance:** Zero errors enforced. Warnings acceptable for pre-existing patterns (non-null assertions). Verified via `npm run lint`.

**Code formatting:** Prettier run before all commits via `npm run format`. No formatting changes in verification runs (already formatted).

**Naming and style:** Follow existing codebase conventions. Clear, descriptive names. JSDoc on public APIs. Consistent patterns with ported modules.

### Testing Requirements

**Test baseline maintained:** Existing 1,876 tests continue passing. No skipped tests (0 `.skip`, 0 `.todo` in suite). New functionality adds tests, doesn't break existing.

**Mocked-service test coverage (PRIMARY):** Integration-level tests in `tests/mocked-service/` exercise complete workflows with external dependencies mocked (ModelClient, RolloutRecorder, AuthManager, network calls, filesystem). These are our core tests for maintaining quality while moving fast. Tests written at library API boundaries as contracts are defined during phase planning. Minimum 15 mocked-service tests covering provider × auth × workflow combinations. See `docs/core/contract-testing-tdd-philosophy.md` for approach.

**Test organization:**
```
tests/
├── unit/              (existing port tests, optional going forward)
├── mocked-service/    (PRIMARY - integration with mocked externals)
└── mocks/             (shared mock implementations)
```

**Test execution:** All tests run in-process with mocked externals. Fast (<5 seconds total), deterministic (no flaky network tests), runnable offline. Run via `npm test`.

**Model integration testing (validation layer):** Additional testing with real LLM providers using cheap models. Validates actual provider behavior, config parameters (thinking, temperature), and live API compatibility. Located in `scripts/integration-tests/` as standalone Node scripts. Tests OpenAI (Responses, Chat), Anthropic (Messages), and OpenRouter with fast non-thinking models (gpt-4o-mini, haiku-4.5, gemini-2.0-flash-001). Requires real API keys, nominal cost. Run manually or via `npm run test:integration`. Later formalized as proper test suite when library/REST API established. Mock server creation for REST API testing deferred to REST API implementation phase.

**Two integration test layers:**
- **Mocked-service:** Wiring correctness, fast, deterministic, primary development tests
- **Model integration:** Real provider validation, slower, costs nominal amount, validation gate

**Formalization note:** Model integration tests start as home-grown Node scripts in `scripts/integration-tests/` during this project. After library API and REST API established, these will be formalized into proper test suites. Mock server for REST API testing created during REST API implementation phase (separate from this project or Phase 7).

### Performance Requirements

**General responsiveness:** CLI commands feel snappy. API overhead minimal. Tool execution doesn't lag. User (project owner) subjective assessment is acceptance gate—no specific latency targets.

### Code Review Requirements

**Per-phase review (after phase completion):** Full code review run before marking phase complete. Multi-stage review process using GPT-5-Codex with two specialized review agents.

**Review Stage 1 - Traditional Code Review:**
Standards compliance, code quality, security issues, error handling, edge cases, maintainability, test coverage. Uses standard code review practices and Codex's built-in review capabilities. Template prompt defined in phase planning.

**Review Stage 2 - Port Validation Review:**
Validation against original Rust implementation. Checks for missed functionality, behavior parity, integration points correctly wired, error handling matches Rust patterns, edge cases from Rust covered. Ensures fast-ported code didn't skip crucial details. Template prompt defined in phase planning.

**Review execution:** Two separate agents with distinct prompts run in parallel. Results compiled. Issues categorized (critical/major/minor). Critical issues block phase completion. Major/minor issues documented for sub-phase or noted for future work.

**Review prompt templates:** Defined collaboratively (planning agent + user) after base documentation complete. Templates reference this PRD, dev standards, contract testing philosophy, and port-specific validation criteria. Stored in phase documentation for agent use.

**Purpose:** Deep quality pass on integration work. Catch issues missed during fast execution. Validate ported code maintains Rust functionality. Maintain high standards even when iterating quickly.

### Verification Process

**Per-phase verification:** After each phase, run `npm run format && npm run lint && npx tsc --noEmit && npm test` in sequence. All must succeed before phase marked complete.

**Project completion verification:** All success criteria from Section 2 verified. Working CLI demonstrates all capabilities. Library and REST API specs documented. Mocked-service tests cover all defined boundaries.

---

## 6. Technical Constraints

### Architecture Boundaries

**Ported module stability:** Core modules from Phases 1-6 provide the foundation. Integration code adapts to existing APIs. Changes to ported modules allowed only when integration reveals genuine issues (broken interfaces, missing functionality). Most ported code remains unchanged. Refactoring decisions made during planning, not during execution.

**Provider abstraction preserved:** WireApi enum and adapter pattern from port maintained. CLI layer provider-agnostic—same conversation code works with Responses, Chat, Messages. Provider-specific logic isolated in adapters.

**Tool system unchanged:** ToolRegistry, ToolRouter, and tool handlers from Phase 3-4 used as-is. CLI adds display layer, not tool execution changes. Approval system integrated but not modified.

### Technology Choices

**CLI framework:** Commander.js for command parsing. Simple, proven, minimal dependencies.

**Display:** Core foundation uses plain console output via stdout/stderr. Dual-mode CLI (interactive REPL + one-shot commands) with JSON output flag (`--json`) for agent accessibility. This testable core remains stable. Rich features (Tables, Panels, Markdown rendering) layered on top incrementally as Rich-TS port progresses. Fancy UI extensions don't modify core—they extend presentation layer.

**UI Update Pattern:** Batch text display (complete model responses printed at once, no token-by-token streaming). Tool execution visibility (print tool calls and results as execution loop processes them, providing progress feedback without waiting for all tools to complete). Simple async/await pattern with console output, no EventEmitter, no subscriptions.

**Configuration:** Use existing Config system from Phase 2. CLI reads from ~/.codex/config.toml.

**Persistence:** Use existing RolloutRecorder from Phase 2. JSONL format only. No database or alternative storage backends.

### Integration Points

**ModelClient interface:** CLI uses existing ModelClient from Phase 4. No modifications to client layer. Streaming handled by existing SSE parsers.

**ConversationManager:** Primary library entry point. CLI is thin wrapper around ConversationManager. Business logic stays in core, CLI handles I/O only.

**AuthManager:** Use existing auth from Phase 5. Token retrieval from keyring/filesystem. No OAuth flow implementation (read tokens only).

### Future Compatibility Constraints

**Library API must support REST:** Design library interface assuming HTTP wrapper will be added later. Stateless operations preferred. Async/Promise-based (maps to HTTP request/response).

**Conversation isolation:** Each conversation independent. No shared state between conversations. Enables multi-conversation support in future REST API scenarios.

---

## 7. Phases Overview

### Phase Sequence

**Phase 1: Basic Chat Flow**
Wire ConversationManager, implement single provider (Responses API), single auth method (API key), basic CLI commands (new, chat). Prove end-to-end conversation works. Define initial library API contracts. Create mocked-service tests for conversation flow.

**Enables:** User can start a conversation with an AI model, send messages, receive responses, have basic back-and-forth chat. Can create new conversations and switch between them.

**Phase 2: Tool Integration**
Add tool execution to CLI, implement approval prompts, display tool calls and results. Wire ToolRouter integration. Test with conversations requiring tools. Add mocked-service tests for tool workflows.

**Enables:** User can have the model perform real work—reading files, running commands, applying code patches. User maintains control through approval prompts for dangerous operations, sees what tools are being executed and their results. Conversations shift from just discussion to actual task completion.

**Phase 3: Multi-Provider Support**
Add Chat Completions and Messages API support. Implement provider switching. Verify same conversation works across all three providers. Test provider parity with mocked clients.

**Enables:** User can switch between OpenAI and Anthropic models, choose different APIs for different use cases, compare model behavior across providers. Same CLI works with any supported LLM.

**Phase 4: Authentication Expansion**
Add OAuth token retrieval (ChatGPT, Claude), implement auth method switching. Test all auth × provider combinations. Verify token refresh and keyring integration. Mock OAuth token sources for testing.

**Enables:** User can authenticate with existing ChatGPT Pro or Claude subscriptions, switch between API keys and OAuth, use whichever auth method they already have set up. No new account setup needed if they already have ChatGPT/Claude access.

**Phase 5: Persistence & Resume**
Wire RolloutRecorder, implement save/load/list commands. Test conversation persistence and resume flows. Verify JSONL format compatibility. Add mocked-service tests for persistence scenarios.

**Enables:** User can save work-in-progress conversations, return to them later, review conversation history, resume multi-session projects. Work persists across CLI restarts and system reboots.

**Phase 6: Library API Finalization**
Document complete library API surface. Define TypeScript signatures for all exports. Create usage examples. Identify all contract boundaries. Ensure mocked-service test coverage complete.

**Enables:** Developers can build applications on top of @openai/codex-core library. Clear API documentation guides integration. Usage examples demonstrate common patterns.

**Phase 7: REST API Design** (Optional)
Design HTTP wrapper endpoints. Document request/response formats. Map library API to REST operations. Implementation deferred to later project.

**Enables:** Future HTTP wrapper implementation has clear specification. Developers understand how library will map to REST endpoints.

**Phase 8: Integration Polish**
Bug fixes, edge case handling, UX refinements discovered during phases 1-7. Sub-phases created as needed based on findings and inspiration.

**Enables:** User experiences smooth, predictable CLI behavior. Commands work consistently, error messages are clear and actionable, edge cases don't cause confusion or crashes. The tool feels polished and professional, not just functional.

### Sub-Phase Pattern

Phases may spawn sub-phases (1.1, 1.2, etc.) when exploration reveals opportunities for enhancement or when scope adjustment needed. Sub-phases documented as created. Original phase structure maintained.

### Detailed Breakdown

See `initial-plan.md` for complete phase specifications, technical approaches, and task breakdowns.

---

