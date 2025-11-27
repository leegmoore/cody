# STATE.md - Ground Truth

**Last Updated:** 2025-11-26

---

## System Health: YELLOW

Core pipeline works. Tests are unreliable. UI functional and staying vanilla JS.

**Process Health: IN PROGRESS** - Foundation docs established, tools building:
- [x] STATE.md - Ground truth (stable)
- [x] PROCESS.md - Workflow/checkpoints (stable, working modes defined)
- [x] CURRENT.md - Active focus tracking
- [x] TOOLS.md - Extension tools documented
- [x] NEXT.md - Work queue established
- [x] Prompt assembly skill - wired up with YAML frontmatter, tested, supports `--output` for custom paths
- [x] /core-doc-review command - created and tested
- [x] Projects structure - 01-api, 02-ui with prompts directories
- [x] tdd-api test suite - implemented and passing
- [ ] Beads initialization - deferred

---

## What's Working (Confidence: HIGH)

### Core Streaming Pipeline
- **Adapters → Redis → Workers → Convex** flow is solid
- OpenAI Responses API adapter: streaming, normalizing to canonical events
- Anthropic Messages API adapter: streaming, tool schemas, max_tokens fixed
- Redis Streams: fanout to multiple consumers, backpressure handled
- PersistenceWorker: reduces streams to Response snapshots, writes to Convex
- ToolWorker: executes function_calls, writes results back to stream

### API Surface (v2)
- `POST /api/v2/submit` - starts runs, returns runId
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
- Full integration test suite at `test-suites/tdd-api/`
- Environment validation: Redis, Convex, OpenAI, Fastify connectivity checks
- Tests: simple-prompt, tool-calls (pwd/ls with hydrated vs persisted comparison)
- Uses ResponseReducer for hydration, compares to persisted data
- Polling for persistence (not fixed wait)
- Strong types throughout (no `any`)
- No mocks - real infrastructure only
- Legacy tests moved to `tests-old-notused/` (gitignored)

---

## What's Broken (Confidence: HIGH)

### Legacy Test Infrastructure
**Status:** Legacy tests unreliable, but new tdd-api suite provides reliable baseline.

- Service-level mocks were corrupted by agents who snuck in scaffolds that changed behavior
- Test harness (`tests/harness/core-harness.ts`) resets app state in ways that don't reflect production
- Tool mocks were added where real tools should run

**Mitigation:** New `test-suites/tdd-api/` suite uses full integration with no mocks. Legacy tests in `tests/` are suspect until audited.

### Specific Test Failures (from live run)
- `TC-HP-08: Tool call (simple)` - `response.output_items.map is not a function` (undefined)
- Worker lifecycle issues - timeout in afterEach hooks
- Some tests passing in isolation but failing in suite runs

### Model/Provider Configuration
- No clean system for specifying model at runtime
- Defaults hardcoded (`gpt-5-mini`, `openai`)
- No per-request model override
- No provider switching UI

---

## What's Incomplete (Confidence: MEDIUM)

### Multi-Turn History (Critical - Blocking)
- **Current:** Each turn is independent, no conversation context
- **OpenAI Responses:** Needs conversation history loading from Convex + sending in `input`
  - Should include reasoning from previous turns
  - codex-ts reference implementation available
- **Anthropic Messages:** Needs history with reasoning filtered out
  - Always required (stateless API)
  - codex-ts filters reasoning in `convertMessages()`
- **See:** `docs/response-messages-api-details.md` for format details

### Thinking/Reasoning Display
- `reasoning` OutputItems exist in schema
- Adapters produce them
- UI has partial support (thinking blocks exist but buggy)
- Need to complete implementation and verify full flow

### Test Infrastructure
- Current harness may be corrupted (agents snuck in mocks)
- Need to baseline with 2 simple tests (with/without tools)
- Then build out: history tests, thinking tests, provider coverage

### Client Library Evaluation (Future)
- Consider extending hydration lib to contain UI complexity
- Evaluate after implementing thought bubbles (see pain points first)
- Keep vanilla JS manageable as features grow

### Legacy v1 Routes
- Code exists in `src/api/routes/` (conversations, messages, turns)
- Routes not mounted in `src/server.ts`
- Some Playwright tests reference v1 paths that don't exist

### Tool Scoping
- All tools sent to every request regardless of context
- No agent/thread-level tool policies
- Risk of exposing high-risk tools unnecessarily

---

## Technical Debt

| Item | Impact | Notes |
|------|--------|-------|
| codex-ts package | Low | Deprecated, utilities being migrated out |
| v1 route code | Low | Unmounted, can delete or wire up |
| Client-stream manager | Low | Legacy Redis turn store, may not be needed |
| Mixed test strategies | High | E2E, smoke, unit, service mocks - unclear which to trust |

---

## Infrastructure Dependencies

| Service | Status | Required |
|---------|--------|----------|
| Redis | Running locally | Yes - streaming |
| Convex | Running locally | Yes - persistence |
| OpenAI API | Key in .env | For real provider tests |
| Anthropic API | Key in .env | For real provider tests |

---

## Recent Progress (Nov 2025)

**Code:**
- Core 2.0 happy path tests: 10/10 passing
- Error handling tests: 6/6 passing
- Edge case/stress tests: 6/6 passing
- Smoke tests with real APIs: 3/3 passing (after OpenAI tool continuation + Anthropic max_tokens fixes)
- UI wired to v2 API, basic flows working

**Process (2025-11-25 session):**
- Established process foundation docs (STATE, CURRENT, NEXT, PROCESS, TOOLS)
- Defined working modes (informal vs formal) in PROCESS.md
- Built prompt assembly skill (.claude/skills/prompt-assembly/)
  - Templates for coder and verifier prompts
  - Assembly script with handlebars
  - Tested successfully, needs more real-world use
- Created /core-doc-review command (needs testing)
- Established projects structure (projects/01-api/, projects/02-ui/)
- Defined context checkpoints (75k/100k/125k/150k/160k/170k)
- Documented beads (bd) for work tracking/orchestration

**Decisions (2025-11-26 session):**
- **UI evaluation:** Staying vanilla JS (manageable at ~1600 lines, not hitting complexity ceiling)
  - Possibly exploring iframe approach for better modularity
  - Tauri desktop app remains viable distribution path
  - New features (file tree, file viewer) won't push vanilla JS limits
- **Test strategy:** Need to baseline with 2 simple tests before building out full suite
- **API research:** Documented Responses vs Messages API history handling differences

**2025-11-26 (afternoon session):**
- Implemented tdd-api test suite (full integration, no mocks)
- 4 connectivity checks: Redis, Convex, OpenAI, Fastify
- First test validates submit → stream → persist pipeline
- ResponseReducer hydration with persisted data comparison
- Wired up prompt-assembly skill (YAML frontmatter for discovery)
- Tracked .claude/ directory in git
- Phase 1 (Test Foundation) complete

---

## Key Unknowns

1. **How much of the passing tests are real?** Need to audit test harness for mocking that changes behavior.
2. **What's the right testing strategy going forward?** E2E only? Re-scaffold service mocks? Both?
3. **Tool scoping design?** How to limit tools per agent/thread?
4. **Client library scope?** How much UI complexity should live in an extended hydration lib?

---

## Files to Know

- `src/core/schema.ts` - Canonical shapes (source of truth)
- `src/core/reducer.ts` - Event → Response accumulation
- `test-suites/tdd-api/` - New integration test suite (trustworthy)
- `tests/harness/core-harness.ts` - **Compromised** - needs audit
- `TEST_RESULTS.md` - Detailed test history
- `docs/codex-core-2.0-tech-design.md` - Architecture spec
