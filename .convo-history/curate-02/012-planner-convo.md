

## USER

we should decide if we are doing streaming or not to the console? if so then we'll need different SSE renderers as part of the chat, repsonses, and messages api support


## ASSISTANT


## ASSISTANT

**Good question - this affects scope.**

**Options:**

**Option A: Streaming (to console)**
- Responses appear token-by-token as they arrive
- Need delta renderers for each API (Responses, Chat, Messages already have parsers in client code)
- Console output: `process.stdout.write(delta.text)` 
- Better UX (feels responsive)
- More code: render layer for each API's SSE format

**Option B: Batch (complete responses)**
- Wait for full response, then print
- Much simpler: just `console.log(response.content)`
- No delta handling needed
- Feels less responsive (wait, then see whole answer)
- Less code: single print after completion

**What's already built:**
- Client layer streams SSE and parses deltas (Phase 4.1, 4.2)
- We have the parsers, just need console rendering

**Complexity delta:**
- Streaming adds: ~200 lines (render deltas for 3 APIs)
- Batch: ~50 lines (print complete)

**UX difference:**
- Streaming: Typing effect, live feedback
- Batch: Clean but static

**What do you want for Project 02? Stream or batch?**


## USER

let's support both and be able to flip with config and console param


## ASSISTANT


## ASSISTANT

**Perfect - maximum flexibility.**

**Scope addition:**

**Display Modes (Configurable):**
- **Streaming mode:** SSE delta rendering for all three APIs (Responses, Chat, Messages), tokens appear as they arrive, live feedback in console
- **Batch mode:** Complete response rendering, print full answer after completion, cleaner output
- **Configuration:** Default mode in config file, override via CLI flag (`--stream` or `--batch`)
- **Both modes work:** All providers support both display modes

**Implementation:**
- Delta renderers: ~200 lines (handle each API's SSE format)
- Batch renderer: ~50 lines (print complete)
- Mode switching: ~30 lines (check config/flag, route to renderer)

**Total addition: ~280 lines, but gives us both UX options and tests both code paths.**

Should I update Section 3.1 to include this?


## USER

yup. other than that the in scope out of scope looks good. next section


## ASSISTANT


## ASSISTANT

```json
// TOOL: Edit (id: toolu_01PT2Vq3AxB5ADS68DHCn4wL)
{
  "file_path": "/Users/leemoore/code/codex-port-02/docs/projects/02-ui-integration-phases/PRD.md",
  "old_string": "---\n\n## [Remaining sections TBD]\n\n",
  "new_string": "---\n\n## 3. Scope\n\n### 3.1 In Scope\n\n**CLI Implementation:**\nCommands for conversation lifecycle (new, chat, list, resume), authentication (login for OAuth flows), configuration (set provider, model, auth method), and basic display (text output to console, tool approval prompts, response rendering).\n\n**Display Modes (Configurable):**\nStreaming mode with SSE delta rendering for all three APIs (Responses, Chat, Messages)—tokens appear as they arrive for live feedback. Batch mode with complete response rendering—print full answer after completion for cleaner output. Default mode set in config file, override via CLI flag (`--stream` or `--batch`). Both modes work with all providers.\n\n**Provider Integration:**\nAll three LLM APIs wired and functional (OpenAI Responses, OpenAI Chat Completions, Anthropic Messages). Provider switching supported via configuration. Same conversation code works across all providers.\n\n**Authentication Methods:**\nAPI key storage and usage (OpenAI + Anthropic), ChatGPT OAuth flow (login, token refresh, keyring storage), Claude OAuth flow if applicable. Auth method selection via configuration or CLI flags.\n\n**Tool Execution:**\nStructured tool calling (Rust-compatible harness), approval flow in CLI (prompt user for dangerous operations), tool execution with mocked external boundaries for testing, result display in console.\n\n**Persistence & Resume:**\nConversations save to JSONL (~/.codex/conversations/), rollout format matches Rust implementation, list saved conversations, resume with complete history reconstruction.\n\n**Library API Definition:**\nDocument public exports (@openai/codex-core), define primary entry points (ConversationManager, Conversation, ModelClient), TypeScript signatures for all public methods, usage examples for common workflows, contract boundaries identified for testing.\n\n**REST API Specification (Design Only):**\nDocument HTTP endpoints, request/response formats, authentication patterns, error responses. Implementation deferred to later project.\n\n### 3.2 Non-Scope\n\n**Script Harness:** Deferred to Project 03. This project uses structured tool calling only (Rust-compatible). QuickJS sandbox, Promise.all parallel execution, and script-based workflows not integrated in CLI yet.\n\n**Memory Innovations:** Deferred to Projects 04-06. Compression gradient, offline processing, context preprocessing, announcement board, file cabinet—none implemented. Standard conversation history only.\n\n**Rich TUI:** Deferred indefinitely. Simple text console output only. No ratatui/blessed/ink widgets, no markdown rendering, no syntax highlighting, no interactive chat interface.\n\n**Additional Tools:** Web search, agent orchestration, prompt management tools (Phase 4.7 stubs) not integrated into CLI. Core file/exec tools only.\n\n**Performance Optimization:** No profiling, no optimization work. Acceptable responsiveness sufficient. Detailed performance tuning deferred.\n\n**Production Hardening:** No deployment scripts, no monitoring, no logging infrastructure, no error tracking. Development/testing tool only.\n\n---\n\n## [Remaining sections TBD]\n\n"
}
```


## USER

[
  {
    "tool_use_id": "toolu_01PT2Vq3AxB5ADS68DHCn4wL",
    "type": "tool_result",
    "content": "The file /Users/leemoore/code/codex-port-02/docs/projects/02-ui-integration-phases/PRD.md has been updated. Here's the result of running `cat -n` on a snippet of the edited file:\n    56→3. **REST API specification** (optional, docs/REST-API.md) with endpoints and formats—design only, implementation deferred.\n    57→\n    58→4. **Updated documentation:** PORT_LOG_MASTER.md has Project 02 summary, README.md has library usage instructions.\n    59→\n    60→---\n    61→\n    62→## 3. Scope\n    63→\n    64→### 3.1 In Scope\n    65→\n    66→**CLI Implementation:**\n    67→Commands for conversation lifecycle (new, chat, list, resume), authentication (login for OAuth flows), configuration (set provider, model, auth method), and basic display (text output to console, tool approval prompts, response rendering).\n    68→\n    69→**Display Modes (Configurable):**\n    70→Streaming mode with SSE delta rendering for all three APIs (Responses, Chat, Messages)—tokens appear as they arrive for live feedback. Batch mode with complete response rendering—print full answer after completion for cleaner output. Default mode set in config file, override via CLI flag (`--stream` or `--batch`). Both modes work with all providers.\n    71→\n    72→**Provider Integration:**\n    73→All three LLM APIs wired and functional (OpenAI Responses, OpenAI Chat Completions, Anthropic Messages). Provider switching supported via configuration. Same conversation code works across all providers.\n    74→\n    75→**Authentication Methods:**\n    76→API key storage and usage (OpenAI + Anthropic), ChatGPT OAuth flow (login, token refresh, keyring storage), Claude OAuth flow if applicable. Auth method selection via configuration or CLI flags.\n    77→\n    78→**Tool Execution:**\n    79→Structured tool calling (Rust-compatible harness), approval flow in CLI (prompt user for dangerous operations), tool execution with mocked external boundaries for testing, result display in console.\n    80→\n    81→**Persistence & Resume:**\n    82→Conversations save to JSONL (~/.codex/conversations/), rollout format matches Rust implementation, list saved conversations, resume with complete history reconstruction.\n    83→\n    84→**Library API Definition:**\n    85→Document public exports (@openai/codex-core), define primary entry points (ConversationManager, Conversation, ModelClient), TypeScript signatures for all public methods, usage examples for common workflows, contract boundaries identified for testing.\n    86→\n    87→**REST API Specification (Design Only):**\n    88→Document HTTP endpoints, request/response formats, authentication patterns, error responses. Implementation deferred to later project.\n    89→\n    90→### 3.2 Non-Scope\n    91→\n    92→**Script Harness:** Deferred to Project 03. This project uses structured tool calling only (Rust-compatible). QuickJS sandbox, Promise.all parallel execution, and script-based workflows not integrated in CLI yet.\n    93→\n    94→**Memory Innovations:** Deferred to Projects 04-06. Compression gradient, offline processing, context preprocessing, announcement board, file cabinet—none implemented. Standard conversation history only.\n    95→\n    96→**Rich TUI:** Deferred indefinitely. Simple text console output only. No ratatui/blessed/ink widgets, no markdown rendering, no syntax highlighting, no interactive chat interface.\n    97→\n    98→**Additional Tools:** Web search, agent orchestration, prompt management tools (Phase 4.7 stubs) not integrated into CLI. Core file/exec tools only.\n    99→\n   100→**Performance Optimization:** No profiling, no optimization work. Acceptable responsiveness sufficient. Detailed performance tuning deferred.\n   101→\n   102→**Production Hardening:** No deployment scripts, no monitoring, no logging infrastructure, no error tracking. Development/testing tool only.\n   103→\n   104→---\n   105→\n   106→## [Remaining sections TBD]\n   107→\n   108→"
  }
]


## ASSISTANT


## ASSISTANT

**Section 4: Dependencies & Prerequisites**

Here's my draft:

---

## 4. Dependencies & Prerequisites

### Code Dependencies

**Phase 6 complete:** Core orchestration modules ported (core/codex, core/codex-conversation, core/conversation-manager). All 75 modules from Phases 1-6 integrated and tested. 1,876 tests passing.

**Phase 5.2 complete:** Code quality baseline established. Zero TypeScript errors, zero ESLint errors (warnings acceptable), all tests passing, no skipped tests. Clean starting point for new development.

### External Requirements

**API Keys configured:** OpenAI API key for Responses and Chat APIs. Anthropic API key for Messages API. Keys available in environment or config file.

**OAuth Applications registered (for OAuth testing):** ChatGPT OAuth app with client ID and secret. Claude OAuth app with client credentials if implementing Claude OAuth. Redirect URIs configured for localhost testing.

**Development environment:** Node.js 18+ installed, npm available, TypeScript compiler working, test framework operational (Vitest).

### Knowledge Prerequisites

**Planning documents read:** This PRD, TECH-APPROACH.md (architecture decisions), initial-plan.md (phase roadmap), docs/core/contract-testing-tdd-philosophy.md (testing approach).

**Port understanding:** Familiarity with ported modules (where things live, how they connect), understanding of provider abstraction (WireApi enum, adapter pattern), awareness of tool system structure (registry, router, handlers).

---

**Section 4. Adjust anything?**


## USER

we can add openrouter key for chat completions. no client id and secret. basically i need access to a valid anthropic oauth token and an open ai oauth token. when they expire I re-login using claude code or codex cli using their claude max plan or chatgpt pro plan. this refreshes the token stored in the configured place in ~/.claude and in ~/.codex not sure of exact location of each oauth token but generally we'll pull them as we need them from there and if they expire I'll just have to re-authenticate in the respective app. Who needs knowledge priorities. ultimatley who is the primary audience for this?


## ASSISTANT


## ASSISTANT

**Primary audience: Coding agents executing phases.**

The PRD gives agents project-level context before they read phase-specific docs.

Let me revise Section 4:

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

**Better? Audience is agents, OAuth is just reading tokens, not implementing flows.**


## USER

that all sounds good. put it in the document. next section


## ASSISTANT


## ASSISTANT

```json
// TOOL: Edit (id: toolu_01JSB3DPejZcD4GVBywa17WK)
{
  "file_path": "/Users/leemoore/code/codex-port-02/docs/projects/02-ui-integration-phases/PRD.md",
  "old_string": "---\n\n## [Remaining sections TBD]\n\n",
  "new_string": "---\n\n## 4. Dependencies & Prerequisites\n\n### Code Dependencies\n\n**Phase 6 complete:** Core orchestration modules ported (core/codex, core/codex-conversation, core/conversation-manager). All 75 modules from Phases 1-6 integrated and tested. 1,876 tests passing.\n\n**Phase 5.2 complete:** Code quality baseline established. Zero TypeScript errors, zero ESLint errors (warnings acceptable), all tests passing, no skipped tests.\n\n### External Requirements\n\n**API Keys:**\n- OpenAI API key (for Responses and Chat APIs)\n- Anthropic API key (for Messages API)\n- OpenRouter API key (for Chat Completions via OpenRouter)\n\n**OAuth Tokens:**\n- ChatGPT OAuth token (read from ~/.codex where ChatGPT Pro CLI stores it)\n- Anthropic OAuth token (read from ~/.claude where Claude Code stores it)\n- Tokens refreshed by user re-authenticating in respective apps when expired\n- No OAuth flow implementation—just token retrieval from keyring/filesystem\n\n**Development environment:** Node.js 18+, npm, TypeScript, Vitest operational.\n\n### Agent Prerequisites\n\n**Read before starting any phase:**\n- This PRD (project context)\n- docs/core/contract-testing-tdd-philosophy.md (testing approach)\n- docs/core/dev-standards.md (code quality requirements)\n- initial-plan.md (phase roadmap)\n\n**For each phase, also read:**\n- Phase-specific README.md, CHECKLIST.md, QUICK_START.txt\n\n---\n\n## [Remaining sections TBD]\n\n"
}
```


## USER

[
  {
    "tool_use_id": "toolu_01JSB3DPejZcD4GVBywa17WK",
    "type": "tool_result",
    "content": "The file /Users/leemoore/code/codex-port-02/docs/projects/02-ui-integration-phases/PRD.md has been updated. Here's the result of running `cat -n` on a snippet of the edited file:\n   100→**Performance Optimization:** No profiling, no optimization work. Acceptable responsiveness sufficient. Detailed performance tuning deferred.\n   101→\n   102→**Production Hardening:** No deployment scripts, no monitoring, no logging infrastructure, no error tracking. Development/testing tool only.\n   103→\n   104→---\n   105→\n   106→## 4. Dependencies & Prerequisites\n   107→\n   108→### Code Dependencies\n   109→\n   110→**Phase 6 complete:** Core orchestration modules ported (core/codex, core/codex-conversation, core/conversation-manager). All 75 modules from Phases 1-6 integrated and tested. 1,876 tests passing.\n   111→\n   112→**Phase 5.2 complete:** Code quality baseline established. Zero TypeScript errors, zero ESLint errors (warnings acceptable), all tests passing, no skipped tests.\n   113→\n   114→### External Requirements\n   115→\n   116→**API Keys:**\n   117→- OpenAI API key (for Responses and Chat APIs)\n   118→- Anthropic API key (for Messages API)\n   119→- OpenRouter API key (for Chat Completions via OpenRouter)\n   120→\n   121→**OAuth Tokens:**\n   122→- ChatGPT OAuth token (read from ~/.codex where ChatGPT Pro CLI stores it)\n   123→- Anthropic OAuth token (read from ~/.claude where Claude Code stores it)\n   124→- Tokens refreshed by user re-authenticating in respective apps when expired\n   125→- No OAuth flow implementation—just token retrieval from keyring/filesystem\n   126→\n   127→**Development environment:** Node.js 18+, npm, TypeScript, Vitest operational.\n   128→\n   129→### Agent Prerequisites\n   130→\n   131→**Read before starting any phase:**\n   132→- This PRD (project context)\n   133→- docs/core/contract-testing-tdd-philosophy.md (testing approach)\n   134→- docs/core/dev-standards.md (code quality requirements)\n   135→- initial-plan.md (phase roadmap)\n   136→\n   137→**For each phase, also read:**\n   138→- Phase-specific README.md, CHECKLIST.md, QUICK_START.txt\n   139→\n   140→---\n   141→\n   142→## [Remaining sections TBD]\n   143→\n   144→"
  }
]


## ASSISTANT


## ASSISTANT

**Section 5: Quality Standards**

Here's my draft:

---

## 5. Quality Standards

### Code Quality

**TypeScript strictness:** Strict mode enabled, no `any` types (use `unknown` or proper types), no implicit returns, no unsafe member access. Verified via `npx tsc --noEmit` showing 0 errors.

**ESLint compliance:** Zero errors enforced. Warnings acceptable for pre-existing patterns (non-null assertions). Verified via `npm run lint`. Code formatted via Prettier before commits.

**Naming and style:** Follow existing codebase conventions. Clear, descriptive names. JSDoc on public APIs. Consistent patterns with ported modules.

### Testing Requirements

**Test baseline maintained:** Existing 1,876 tests continue passing. No skipped tests (0 `.skip`, 0 `.todo` in suite). New functionality adds tests, doesn't break existing.

**Contract test coverage:** All library API contracts tested at boundaries with external dependencies mocked. Tests written during phase execution as contracts are defined. Minimum 15 contract tests covering provider × auth × workflow combinations.

**Test execution:** All tests run in-process with mocked externals. Fast (<5 seconds total), deterministic (no flaky network tests), runnable offline.

### Performance Requirements

**General responsiveness:** CLI commands feel snappy. API overhead minimal. Tool execution doesn't lag. User (project owner) subjective assessment is acceptance gate—no specific latency targets.

### Verification Process

**Per-phase verification:** After each phase, run `npm run format && npm run lint && npx tsc --noEmit && npm test` in sequence. All must succeed before phase marked complete.

**Project completion verification:** All success criteria from Section 2 verified. Working CLI demonstrates all capabilities. Library and REST API specs documented. Contract tests cover all defined boundaries.

---

**Section 5. Thoughts?**


## USER

let's add that a prettier format is run. for the contract tests do we want to create a different test stage for that? stickign with vitest for unit tests and our contract tests?


## ASSISTANT


## ASSISTANT

**On prettier:** Yes, should add that format runs before commits.

**On contract tests:** Do you want:

**Option A: Same vitest suite, organized by folder**
```
tests/
├── unit/           (existing tests from port)
├── contracts/      (new contract tests)
└── mocks/          (shared mock implementations)

npm test  → runs both
```

**Option B: Separate npm scripts**
```
npm run test:unit       → runs unit tests
npm run test:contract   → runs contract tests  
npm test                → runs both

package.json:
"test:unit": "vitest run tests/unit",
"test:contract": "vitest run tests/contracts",
"test": "vitest run"
```

**Option C: No distinction**
```
All tests in tests/ directory
npm test runs everything
Don't separate contract vs unit
```

**Given your philosophy ("don't care about more unit tests, contract tests are primary"), I'd lean Option A or C—keep it simple, one test command, maybe just organize folders for clarity.**

What do you want?


## USER

so let's decide on name. Contract tests? mocked service tests? mocked-integration teests? probably mocked-service tests is the most self documenting? and yeah it needs a different folder. my fear is if we say contract tests, that usually causes assumption that it's just testing data format and it's very few. for me these mocked integration tests are our core ability to move fast and maintain quality


## ASSISTANT


## ASSISTANT

**You're right - "contract tests" undersells what they are.**

These are **integration-level tests with mocked external services**—exercising full workflows, not just schema validation.

**Naming: `mocked-service`** is most self-documenting.

**Structure:**
```
tests/
├── unit/                  (existing port tests, optional going forward)
├── mocked-service/        (PRIMARY - integration tests, mocked externals)
│   ├── conversation-flows.test.ts
│   ├── provider-integration.test.ts
│   ├── auth-flows.test.ts
│   ├── tool-execution.test.ts
│   └── persistence-resume.test.ts
└── mocks/                 (shared mocks for external services)
    ├── model-client.ts
    ├── rollout-recorder.ts
    └── auth-manager.ts

npm test  → runs both unit + mocked-service
```

**For PRD, update Section 5 to say:**
- "Mocked-service test coverage" instead of "Contract test coverage"
- "Tests in `tests/mocked-service/` exercise complete workflows with external dependencies mocked"
- These are primary tests, not supplementary

**Should I update Section 5 with this language?**


## USER

yes


## ASSISTANT


## ASSISTANT

```json
// TOOL: Edit (id: toolu_01UwHfc5csyWK4pBFSrkoijF)
{
  "file_path": "/Users/leemoore/code/codex-port-02/docs/projects/02-ui-integration-phases/PRD.md",
  "old_string": "## [Remaining sections TBD]\n\n",
  "new_string": "## 5. Quality Standards\n\n### Code Quality\n\n**TypeScript strictness:** Strict mode enabled, no `any` types (use `unknown` or proper types), no implicit returns, no unsafe member access. Verified via `npx tsc --noEmit` showing 0 errors.\n\n**ESLint compliance:** Zero errors enforced. Warnings acceptable for pre-existing patterns (non-null assertions). Verified via `npm run lint`.\n\n**Code formatting:** Prettier run before all commits via `npm run format`. No formatting changes in verification runs (already formatted).\n\n**Naming and style:** Follow existing codebase conventions. Clear, descriptive names. JSDoc on public APIs. Consistent patterns with ported modules.\n\n### Testing Requirements\n\n**Test baseline maintained:** Existing 1,876 tests continue passing. No skipped tests (0 `.skip`, 0 `.todo` in suite). New functionality adds tests, doesn't break existing.\n\n**Mocked-service test coverage (PRIMARY):** Integration-level tests in `tests/mocked-service/` exercise complete workflows with external dependencies mocked (ModelClient, RolloutRecorder, AuthManager, network calls, filesystem). These are our core tests for maintaining quality while moving fast. Tests written at library API boundaries as contracts are defined during phase planning. Minimum 15 mocked-service tests covering provider × auth × workflow combinations. See `docs/core/contract-testing-tdd-philosophy.md` for approach.\n\n**Test organization:**\n```\ntests/\n├── unit/              (existing port tests, optional going forward)\n├── mocked-service/    (PRIMARY - integration with mocked externals)\n└── mocks/             (shared mock implementations)\n```\n\n**Test execution:** All tests run in-process with mocked externals. Fast (<5 seconds total), deterministic (no flaky network tests), runnable offline. Run via `npm test`.\n\n### Performance Requirements\n\n**General responsiveness:** CLI commands feel snappy. API overhead minimal. Tool execution doesn't lag. User (project owner) subjective assessment is acceptance gate—no specific latency targets.\n\n### Verification Process\n\n**Per-phase verification:** After each phase, run `npm run format && npm run lint && npx tsc --noEmit && npm test` in sequence. All must succeed before phase marked complete.\n\n**Project completion verification:** All success criteria from Section 2 verified. Working CLI demonstrates all capabilities. Library and REST API specs documented. Mocked-service tests cover all defined boundaries.\n\n---\n\n## [Remaining sections TBD]\n\n"
}
```


## USER

[
  {
    "tool_use_id": "toolu_01UwHfc5csyWK4pBFSrkoijF",
    "type": "tool_result",
    "content": "The file /Users/leemoore/code/codex-port-02/docs/projects/02-ui-integration-phases/PRD.md has been updated. Here's the result of running `cat -n` on a snippet of the edited file:\n   138→- Phase-specific README.md, CHECKLIST.md, QUICK_START.txt\n   139→\n   140→---\n   141→\n   142→## 5. Quality Standards\n   143→\n   144→### Code Quality\n   145→\n   146→**TypeScript strictness:** Strict mode enabled, no `any` types (use `unknown` or proper types), no implicit returns, no unsafe member access. Verified via `npx tsc --noEmit` showing 0 errors.\n   147→\n   148→**ESLint compliance:** Zero errors enforced. Warnings acceptable for pre-existing patterns (non-null assertions). Verified via `npm run lint`.\n   149→\n   150→**Code formatting:** Prettier run before all commits via `npm run format`. No formatting changes in verification runs (already formatted).\n   151→\n   152→**Naming and style:** Follow existing codebase conventions. Clear, descriptive names. JSDoc on public APIs. Consistent patterns with ported modules.\n   153→\n   154→### Testing Requirements\n   155→\n   156→**Test baseline maintained:** Existing 1,876 tests continue passing. No skipped tests (0 `.skip`, 0 `.todo` in suite). New functionality adds tests, doesn't break existing.\n   157→\n   158→**Mocked-service test coverage (PRIMARY):** Integration-level tests in `tests/mocked-service/` exercise complete workflows with external dependencies mocked (ModelClient, RolloutRecorder, AuthManager, network calls, filesystem). These are our core tests for maintaining quality while moving fast. Tests written at library API boundaries as contracts are defined during phase planning. Minimum 15 mocked-service tests covering provider × auth × workflow combinations. See `docs/core/contract-testing-tdd-philosophy.md` for approach.\n   159→\n   160→**Test organization:**\n   161→```\n   162→tests/\n   163→├── unit/              (existing port tests, optional going forward)\n   164→├── mocked-service/    (PRIMARY - integration with mocked externals)\n   165→└── mocks/             (shared mock implementations)\n   166→```\n   167→\n   168→**Test execution:** All tests run in-process with mocked externals. Fast (<5 seconds total), deterministic (no flaky network tests), runnable offline. Run via `npm test`.\n   169→\n   170→### Performance Requirements\n   171→\n   172→**General responsiveness:** CLI commands feel snappy. API overhead minimal. Tool execution doesn't lag. User (project owner) subjective assessment is acceptance gate—no specific latency targets.\n   173→\n   174→### Verification Process\n   175→\n   176→**Per-phase verification:** After each phase, run `npm run format && npm run lint && npx tsc --noEmit && npm test` in sequence. All must succeed before phase marked complete.\n   177→\n   178→**Project completion verification:** All success criteria from Section 2 verified. Working CLI demonstrates all capabilities. Library and REST API specs documented. Mocked-service tests cover all defined boundaries.\n   179→\n   180→---\n   181→\n   182→## [Remaining sections TBD]\n   183→\n   184→"
  }
]


## ASSISTANT


## ASSISTANT

**Section 6: Technical Constraints**

Here's my draft:

---

## 6. Technical Constraints

### Architecture Boundaries

**No breaking changes to ported modules:** Core modules (Phases 1-6) remain as-is. Integration code adapts to existing APIs, not vice versa. Don't refactor core to fit CLI—wire CLI to existing core.

**Provider abstraction preserved:** WireApi enum and adapter pattern from port maintained. CLI layer provider-agnostic—same conversation code works with Responses, Chat, Messages. Provider-specific logic isolated in adapters.

**Tool system unchanged:** ToolRegistry, ToolRouter, and tool handlers from Phase 3-4 used as-is. CLI adds display layer, not tool execution changes. Approval system integrated but not modified.

### Technology Choices

**CLI framework:** Commander.js for command parsing. Simple, proven, minimal dependencies. No custom argument parsing.

**Display:** Console output via stdout/stderr. Streaming via `process.stdout.write()`, batch via `console.log()`. No terminal UI libraries (blessed, ink, etc.). Text-only rendering.

**Configuration:** Use existing Config system from Phase 2. CLI reads from ~/.codex/config.toml. No new config format or storage mechanism.

**Persistence:** Use existing RolloutRecorder from Phase 2. JSONL format unchanged. No database, no alternative storage backends.

### Integration Points

**ModelClient interface:** CLI uses existing ModelClient from Phase 4. No modifications to client layer. Streaming handled by existing SSE parsers.

**ConversationManager:** Primary library entry point. CLI is thin wrapper around ConversationManager. Business logic stays in core, CLI handles I/O only.

**AuthManager:** Use existing auth from Phase 5. Token retrieval from keyring/filesystem. No OAuth flow implementation (read tokens only).

### Constraints for Future Compatibility

**Library API must support REST:** Design library interface assuming HTTP wrapper will be added later. Stateless operations preferred. Async/Promise-based (maps to HTTP request/response).

**Conversation isolation:** Each conversation independent. No shared state between conversations. Enables multi-conversation support in future (REST API with multiple clients).

**Event-driven architecture:** ConversationManager emits events. CLI subscribes to events. Supports future UIs subscribing to same events (web UI, desktop app).

---

**Section 6. Adjust anything?**


## USER

backing up to quality, let's add anothe rpoint that at teh end of each phase, a full code review is run. this code review will be multi-stage involving normal code review standards as well as a final review of the sections involved against the original rust to determine if anything crucial was missed in the port. we'll be using gpt-5-codex in the prot and iwll like run 2 different agents with 2 different prompts for the in depth code reviews. you and i will work together to define the tempaltes for these code review prompts. after we get our base docs together and have dfined the contents of the coder prompt, then we can assemble 2 code review prompts. 1 traditional by codex factoring in the stuff you normally do to verify as well as the code review built into codex. the other one will be more specific to validatign against the port and other standards for all ported code that we didn't go deep into on th einital port. This gives us a deep quality pass on all fast ported items


## ASSISTANT


## ASSISTANT

**Adding to Section 5:**

---

### Code Review Requirements

**Per-phase review (after phase completion):** Full code review run before marking phase complete. Multi-stage review process using GPT-5-Codex with two specialized review agents.

**Review Stage 1 - Traditional Code Review:**
Standards compliance, code quality, security issues, error handling, edge cases, maintainability, test coverage. Uses standard code review practices and Codex's built-in review capabilities. Template prompt defined in phase planning.

**Review Stage 2 - Port Validation Review:**
Validation against original Rust implementation. Checks for missed functionality, behavior parity, integration points correctly wired, error handling matches Rust patterns, edge cases from Rust covered. Ensures fast-ported code didn't skip crucial details. Template prompt defined in phase planning.

**Review execution:** Two separate agents with distinct prompts run in parallel. Results compiled. Issues categorized (critical/major/minor). Critical issues block phase completion. Major/minor issues documented for sub-phase or noted for future work.

**Review prompt templates:** Defined collaboratively (planning agent + user) after base documentation complete. Templates reference this PRD, dev standards, contract testing philosophy, and port-specific validation criteria. Stored in phase documentation for agent use.

**Purpose:** Deep quality pass on integration work. Catch issues missed during fast execution. Validate ported code maintains Rust functionality. Maintain high standards even when iterating quickly.

---

**Add this to Section 5? Or make it Section 6 and bump Technical Constraints to Section 7?**


## USER

add it to the quality section


## ASSISTANT

