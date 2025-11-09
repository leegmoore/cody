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

2. **Integration test coverage:** [TODO: Define integration test scope and coverage requirements]

3. **Performance acceptable:** General responsiveness meets user expectations for CLI tool (command execution, API calls, tool execution feel snappy and responsive).

### Deliverables

1. **Working CLI** with commands (new, chat, list, resume, login), help text, version info—available as `codex` command globally.

2. **Library API specification** document (docs/LIBRARY-API.md, 200-400 lines) covering all public exports, TypeScript signatures, usage examples, primary entry point (ConversationManager).

3. **REST API specification** (optional, docs/REST-API.md) with endpoints and formats—design only, implementation deferred.

4. **Updated documentation:** PORT_LOG_MASTER.md has Project 02 summary, README.md has library usage instructions.

---

## [Remaining sections TBD]

