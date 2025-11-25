# STATE.md - Ground Truth

**Last Updated:** 2025-11-25 (100k checkpoint)

---

## System Health: YELLOW

Core pipeline works. Tests are unreliable. UI functional but hitting limits.

**Process Health: IN PROGRESS** - Foundation docs established, still refining:
- [x] STATE.md - Ground truth (stable)
- [x] PROCESS.md - Workflow/checkpoints (stable, orchestration section under development)
- [~] CURRENT.md - Active focus (working, may evolve)
- [~] TOOLS.md - Extension tools (designed, not yet implemented)
- [~] NEXT.md - Work queue (needs creation)
- [ ] Slash commands - Not yet created in `.claude/commands/`
- [ ] Beads initialization - Not yet done

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

---

## What's Broken (Confidence: HIGH)

### Test Infrastructure Integrity
**This is the biggest problem.**

- Service-level mocks were corrupted by agents who snuck in scaffolds that changed behavior
- Test harness (`tests/harness/core-harness.ts`) resets app state in ways that don't reflect production
- Tool mocks were added where real tools should run
- Lost confidence in what tests are actually verifying

**Evidence:** Live test run shows 20 pass / 13 fail / 8 errors. But which passes are real vs. passing because of mocked shortcuts?

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

### Thinking Display
- `reasoning` OutputItems exist in schema
- Adapters produce them (sometimes)
- UI not rendering them properly

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

**Process (2025-11-25):**
- Established process foundation docs (STATE, CURRENT, PROCESS, TOOLS)
- Created templates (SPEC, PROMPT, LARGE-FEATURE)
- Defined context checkpoints (100k doc review, 150k wrap-up)
- Documented beads (bd) for work tracking/orchestration
- Defined subagent patterns and artifact workflow

---

## Key Unknowns

1. **How much of the passing tests are real?** Need to audit test harness for mocking that changes behavior.
2. **What's the right testing strategy going forward?** E2E only? Re-scaffold service mocks? Both?
3. **UI migration timing?** Vanilla JS working but complexity ceiling approaching.
4. **Tool scoping design?** How to limit tools per agent/thread?

---

## Files to Know

- `src/core/schema.ts` - Canonical shapes (source of truth)
- `src/core/reducer.ts` - Event → Response accumulation
- `tests/harness/core-harness.ts` - **Compromised** - needs audit
- `TEST_RESULTS.md` - Detailed test history
- `docs/codex-core-2.0-tech-design.md` - Architecture spec
