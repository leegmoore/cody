# STATE.md - Ground Truth

**Last Updated:** 2025-11-27

---

## System Health: GREEN

Core pipeline works. TDD test suite provides reliable baseline. UI functional (vanilla JS).

**Process Health: STABLE**
- [x] STATE.md - Ground truth
- [x] PROCESS.md - Workflow/checkpoints
- [x] CURRENT.md - Active focus tracking
- [x] TOOLS.md - Extension tools documented
- [x] NEXT.md - Work queue
- [x] Prompt assembly skill - supports `--output` for custom paths
- [x] /core-doc-review command
- [x] Projects structure - 01-api with spec/prompt workflow
- [x] tdd-api test suite - 8 integration tests passing

---

## What's Working (Confidence: HIGH)

### Core Streaming Pipeline
- **Adapters → Redis → Workers → Convex** flow is solid
- OpenAI Responses API adapter: streaming, tool continuation loop, reasoning support
- Anthropic Messages API adapter: streaming, serial tool calling (fixed), extended thinking
- Redis Streams: fanout to multiple consumers, backpressure handled
- PersistenceWorker: reduces streams to Response snapshots, writes to Convex
- ToolWorker: executes function_calls, writes results back to stream

### API Surface (v2)
- `POST /api/v2/submit` - starts runs, accepts `reasoningEffort` (OpenAI) and `thinkingBudget` (Anthropic)
- `GET /api/v2/stream/:runId` - SSE streaming works
- `GET /api/v2/runs/:id` - persisted run retrieval
- Thread CRUD via `/api/v2/threads/*`
- Health probe at `/health`

### Canonical Schema
- Response, OutputItem, StreamEvent types stable
- Same shape at all hydration levels (streaming, dehydrated, hydrated)
- Reducer logic working for event → Response accumulation

### UI
- Vanilla JS/HTML frontend renders streams
- Tool calls display
- Basic conversation flow works
- Connected to v2 API

### TDD-API Test Suite
Full integration test suite at `test-suites/tdd-api/`:

| Provider  | Tests                                          |
|-----------|------------------------------------------------|
| OpenAI    | simple, tool-calls, multi-turn, reasoning      |
| Anthropic | simple, tool-calls, multi-turn, extended-thinking |

**Test Infrastructure:**
- 5 environment checks: Redis, Convex, OpenAI, Anthropic, Fastify
- No mocks - real infrastructure only
- ResponseReducer hydration with persisted data comparison
- Polling for persistence (not fixed wait)
- Strong types throughout (no `any`)
- 20 second timeout
- Legacy tests moved to `tests-old-notused/` (gitignored)

---

## What's Broken (Confidence: HIGH)

### Legacy Test Infrastructure
**Status:** Deprecated. New tdd-api suite replaces it.

- Service-level mocks were corrupted by agents who snuck in scaffolds
- Legacy tests in `tests/` folder moved to `tests-old-notused/`
- Not worth auditing - use tdd-api as baseline

### Model/Provider Configuration
- No clean system for specifying model at runtime from UI
- Defaults hardcoded (`gpt-5-mini`, `openai`)
- API accepts model but no UI for it
- No provider switching UI

---

## What's Incomplete (Confidence: MEDIUM)

### Thinking/Reasoning Display
- `reasoning` OutputItems exist in schema
- Adapters produce them (verified by tests)
- UI has partial support (thinking blocks exist but need work)

### Provider Coverage
- OpenRouter/Chat provider: adapter exists, no tests
- Google/GenAI provider: not started

### Tool Testing
- Tools work (verified by tool-call tests)
- No per-tool tests yet
- No scriptable tool harness

### Client Library Evaluation (Future)
- Consider extending hydration lib to contain UI complexity
- Keep vanilla JS manageable as features grow

---

## Technical Debt

| Item | Impact | Notes |
|------|--------|-------|
| codex-ts package | Low | Deprecated, utilities being migrated out |
| v1 route code | Low | Unmounted, can delete or wire up |
| Legacy tests | None | Moved to tests-old-notused/, gitignored |

---

## Infrastructure Dependencies

| Service | Status | Required |
|---------|--------|----------|
| Redis | Running locally | Yes - streaming |
| Convex | Running locally | Yes - persistence |
| OpenAI API | Key in .env | For OpenAI tests |
| Anthropic API | Key in .env | For Anthropic tests |

---

## Recent Progress

**2025-11-27:**
- Fixed Anthropic serial tool calling (inline execution, conversation continuation)
- All 8 tdd-api tests passing (4 OpenAI + 4 Anthropic)
- Added gpt-5.1-codex-mini model support
- Created system review prompt for TDD framework assessment
- System health upgraded to GREEN

**2025-11-26:**
- Built tdd-api test suite from scratch (specs 001-006)
- Added reasoningEffort to OpenAI submit API
- Added thinkingBudget to Anthropic submit API
- Established spec → approve → prompt workflow
- Enhanced prompt-assembly skill with --output flag

---

## Files to Know

- `src/core/schema.ts` - Canonical shapes (source of truth)
- `src/core/reducer.ts` - Event → Response accumulation
- `src/core/adapters/openai-adapter.ts` - OpenAI with reasoning support
- `src/core/adapters/anthropic-adapter.ts` - Anthropic with serial tool calling
- `test-suites/tdd-api/` - Integration test suite (trustworthy)
- `projects/01-api/` - Specs and prompts for API work
- `docs/codex-core-2.0-tech-design.md` - Architecture spec
