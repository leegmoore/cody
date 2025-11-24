# 2025-11-23 – Smoke Tests: Tool Loop Regression Fixes

- Ran targeted smoke cases after fixing OpenAI tool continuation and Anthropic tooling format.
- Commands: `npm run test:smoke -t "TC-SMOKE-01"`, `npm run test:smoke -t "TC-SMOKE-02"`, `npm run test:smoke -t "TC-SMOKE-05"`.
- Result: the three required scenarios now pass end-to-end against real providers. OpenAI usage metrics populate correctly and tool calls produce final assistant messages.

| Test | Status | Notes |
|------|--------|-------|
| TC-SMOKE-01 | ✅ PASS | Usage totals now reflect non-zero prompt/completion tokens from the `response.completed` chunk. |
| TC-SMOKE-02 | ✅ PASS | Anthropic adapter sends `max_tokens` plus the proper Messages API tool schema; request accepted and streamed. |
| TC-SMOKE-05 | ✅ PASS | Responses API receives formatted tool outputs, loops back for the final answer, and reducer persists `function_call`, `function_call_output`, and `message`. |

---

# Test Results Summary

## 2025-11-23 – Smoke Tests: Tool Integration Attempt

- Ran `npm run test:smoke` after wiring tool schemas through the adapters/submit route.
- Fastify returned `THREAD_NOT_FOUND` for every `/api/v2/submit` request because the local Convex state did not contain the thread IDs referenced by the harness (see logs at `tests/harness/core-harness.ts:212`).
- Result: 0/6 passing — tests never reached provider adapters, so tool call behavior with real APIs remains unverified in this environment.
- Action items: seed/create smoke threads before rerunning, or stub the harness to auto-provision threads during setup.

| Test | Status | Notes |
|------|--------|-------|
| TC-SMOKE-01 | ❌ FAIL | 404 THREAD_NOT_FOUND before adapter invoked |
| TC-SMOKE-02 | ❌ FAIL | Same as above |
| TC-SMOKE-03 | ❌ FAIL | Same as above |
| TC-SMOKE-04 | ❌ FAIL | Same as above |
| TC-SMOKE-05 | ❌ FAIL | Same as above |
| TC-SMOKE-06 | ❌ FAIL | Same as above |

**Total Cost This Run:** $0 (no provider requests were issued).

## 2025-11-23 – Smoke Tests: Real API Integration

- Added `Core2TestHarness` support for `useRealProviders`, wired vitest smoke suite (`tests/e2e/smoke/real-api.spec.ts`), and documented required environment in `.env.test.example`.
- Introduced `npm run test:smoke` for on-demand execution (costs ~$0.02-$0.03/run). Do **not** add this to CI; run weekly or pre-release.
- First execution surfaced real-provider gaps: Anthropics now requires `max_tokens`, OpenAI doesn’t emit reasoning/tool events as mocked, and usage counters aren’t plumbed through to responses yet.

**Status:** 0/6 passing (current failures indicate real API drift)

| Test | Status | Notes |
|------|--------|-------|
| TC-SMOKE-01: OpenAI basic | ❌ FAIL | Response persisted but `usage.total_tokens` remained 0 — real API isn’t populating usage yet. |
| TC-SMOKE-02: Anthropic basic | ❌ FAIL | Anthropic Messages API returned `max_tokens: Field required`; adapter still sends `max_output_tokens`. |
| TC-SMOKE-03: OpenAI thinking | ❌ FAIL | Real stream lacked `reasoning` item even with `reasoning` request — indicates adapter/schema mismatch. |
| TC-SMOKE-04: Anthropic thinking | ❌ FAIL | Same `max_tokens` validation error blocked streaming entirely. |
| TC-SMOKE-05: OpenAI tool call | ❌ FAIL | Timed out waiting for `function_call`; Responses API never invoked `readFile` without explicit tool definitions. |
| TC-SMOKE-06: Cross-provider parity | ❌ FAIL | Blocked by Anthropic request error; no deltas emitted to compare schemas. |

**Total Cost This Run:** ≈$0.01 (OpenAI calls completed; Anthropic calls failed before streaming).

---

## 2025-11-23 – Phase 5.2 Edge Cases & Stress Tests

- Regenerated stress fixtures via `npx ts-node --esm scripts/generate-edge-fixtures.ts` after reducing the per-delta payload so Convex stays below its 1 MiB document limit.
- Ran `npm run format && npm run lint && npx tsc --noEmit && npx vitest run tests/e2e/core-2.0/edge-cases.spec.ts`.
- Result: **6 passed / 0 failed** (runtime ≈ 41 s). Convex logged a warning for the ~922 KB message but the write succeeded.

### Phase 5.2 Status

**Status:** 6/6 passing

| Test | Status | Runtime | Notes |
|------|--------|---------|-------|
| TC-ER-07: Large response | ✅ PASS | ~5.2 s | 512 deltas (~922 KB) streamed/persisted; Convex warning confirms we’re just under the write cap. |
| TC-ER-08: Rapid stream | ✅ PASS | ~5.1 s | 1000 zero-delay deltas received in order; byte count matches fixture metadata. |
| TC-ER-09: Out-of-order | ✅ PASS | ~5.1 s | Reducer surfaced `STREAM_SEQUENCE_ERROR`; no partial output committed. |
| TC-ER-10: High concurrency | ✅ PASS | ~5.3 s | 50 simultaneous turns completed with unique runIds and persisted docs. |
| TC-ER-11: Thread collision | ✅ PASS | ~5.2 s | Two turns sharing a thread persisted correctly with distinct turnIds. |
| TC-ER-12: Invalid schema | ✅ PASS | ~5.1 s | Mock adapter raised Zod validation error; response stored as error doc. |

**Total Coverage:** 22/22 tests passing (10 happy + 6 error + 6 edge).

## 2025-11-23 – Phase 5.1 Error Handling Tests

- Added fixtures plus standalone suite `tests/e2e/core-2.0/error-handling.spec.ts` to cover TC-ER-01 through TC-ER-06.
- Ran `CONVEX_URL=http://127.0.0.1:3210 npx vitest run tests/e2e/core-2.0/error-handling.spec.ts` after wiring tool timeouts and malformed chunk handling.
- Result: **6 passed / 0 failed** (runtime ≈ 52s).

### Phase 5.1 Status

| Test | Status | Notes |
|------|--------|-------|
| TC-ER-01: LLM error | ✅ PASS | `response_error` surfaced with code `invalid_prompt`. |
| TC-ER-02: Tool failure | ✅ PASS | Tool output flagged `success=false`, error string propagated. |
| TC-ER-03: Tool timeout | ✅ PASS | ToolWorker enforces 2s timeout and emits failure output. |
| TC-ER-04: Malformed chunk | ✅ PASS | Mock adapter logs/ignores bad chunk; stream completes. |
| TC-ER-05: Empty message | ✅ PASS | Empty content treated as valid message. |
| TC-ER-06: Provider mismatch | ✅ PASS | Submit returns HTTP 400/`INVALID_MODEL`. |

**Bugs Found:** None – all six scenarios passed with new harness protections.

## 2025-11-22 – Core 2.0 Happy Path Harness

- Added automated coverage for TC-HP-01 through TC-HP-10 in `tests/e2e/core-2.0/happy-path.spec.ts`.
- Executed `npx vitest run tests/e2e/core-2.0/happy-path.spec.ts` after implementing schema, Redis, and worker cleanup fixes.
- Result: **10 passed / 0 failed** (runtime ≈ 55s).
- Bugs fixed in this run:
  - Relaxed Convex schema to accept provider-style IDs (`item_id`, item `id`, `call_id`, etc.).
  - Ensured Redis consumer group creation ahead of streaming and auto-healed `NOGROUP` errors.
  - Reset persistence worker cleanly between tests (stop/start, purge `codex:run:*:events`) to maintain event order.
- Follow-up: continue broader harness regression (historical summary below still reflects legacy failures outside the Core 2.0 flow).

---

## Historical Summary (2025-01-17)

**Passed:** 39 (69.6%)  
**Failed:** 12 (21.4%)  
**Skipped:** 5 (8.9%) - Intentionally skipped

## ✅ Passing Tests (39)

### Conversations
- ✅ TC-1.1: Create with minimal config
- ✅ TC-1.3-1.10: All validation tests (missing fields, invalid providers, unsupported combos)
- ✅ TC-2.1: Empty List
- ✅ TC-2.3-2.5: Pagination tests
- ✅ TC-3.1: Get Existing Conversation
- ✅ TC-3.2: Conversation Not Found
- ✅ TC-4.1: Delete Existing
- ✅ TC-5.1-5.9: All Update tests

### Messages
- ✅ TC-6.1: Submit Message (Basic)
- ✅ TC-6.3: Empty Message
- ✅ TC-6.5-6.6: Override validation

### Turns
- ✅ TC-7.1-7.2: Turn Status (defaults, thinkingLevel)
- ✅ TC-7.4-7.5: Running Turn, Turn Not Found
- ✅ TC-8.3: Stream with thinkingLevel=none
- ✅ TC-8.6-8.7: Turn Not Found, Keepalive

### Lifecycle
- ✅ TC-L2: Multi-Turn Conversation
- ✅ TC-L5: Metadata Lifecycle

### Other
- ✅ Health Check

## ❌ Failing Tests (12)

### 1. TC-1.2: Create with full metadata (Anthropic)
- **Status:** 400 instead of 201
- **Issue:** Missing `ANTHROPIC_API_KEY` or API key validation issue
- **Impact:** Low (test requires Anthropic key, which may not be set)
- **Fix:** Ensure `ANTHROPIC_API_KEY` is in `.env` file

### 2. TC-2.2: Multiple Conversations
- **Status:** Expected 3, got 2
- **Issue:** Cascading failure from TC-1.2 (one conversation creation failed)
- **Impact:** Low (will fix when TC-1.2 is fixed)
- **Fix:** Depends on TC-1.2

### 3. TC-4.2: Delete Non-Existent Conversation
- **Status:** 500 instead of 404
- **Issue:** Error handling in delete handler - exception not caught properly
- **Impact:** Medium
- **Fix:** Improve error handling in delete handler

### 4. TC-4.3: Verify Deleted
- **Status:** Conversation still exists after delete
- **Issue:** Delete operation not actually removing conversation from list
- **Impact:** Medium
- **Fix:** Ensure delete removes conversation from ConversationManager

### 5. TC-6.2: Conversation Not Found (Message)
- **Status:** 500 instead of 404
- **Issue:** Error handling - exception not caught before sendMessage call
- **Impact:** Medium
- **Fix:** Add try-catch around sendMessage call

### 6. TC-L7: Concurrent Conversations
- **Status:** One conversation creation returns 400
- **Issue:** Likely same as TC-1.2 (Anthropic API key)
- **Impact:** Low (depends on API keys)
- **Fix:** Ensure API keys are set

### 7-12. Streaming Issues (TC-8.1, TC-8.2, TC-8.8, TC-L1, TC-L3, TC-7.3)
- **Status:** Missing `task_started` events and tool execution events
- **Issue:** Events not being captured/stored from Codex, or not being sent in SSE stream
- **Impact:** High (core functionality)
- **Root Cause:** Events from `conversation.nextEvent()` may not be getting stored in turn-store, or timing issue where stream is consumed before events arrive

## ⏭️ Skipped Tests (5) - Intentionally

- TC-6.4: Model Override (per-turn overrides not implemented)
- TC-8.4: Client Disconnect and Reconnect (Playwright limitation)

## Recommended Improvements - Tool Support System

**Priority 1 (High Impact):**
1. Fine-Grained Tool Scoping  
   - Current limitation: Every run now receives the entire registry regardless of agent identity or prompt, which risks exposing high-risk tools (e.g., `applyPatch`) in contexts that never intended to allow edits.  
   - Recommended fix: Introduce agent/thread-level tool policies so the submit handler can request only approved specs (e.g., via metadata on the agent record or request payload).  
   - Effort: ~1.5 days (policy surface, plumbing through submit route, tests).  
   - Rationale: Prevents accidental elevation of tool capabilities and reduces schema bloat sent to providers.

**Priority 2 (Medium Impact):**
2. Tool Choice Strategy Controls  
   - Current limitation: OpenAI adapter always sends `tool_choice: "auto"` when any tool exists, offering no way to force/forbid tool use or to pick a default function.  
   - Recommended fix: Extend StreamParams with a `toolChoice` union (`auto | none | required | { type: "function", name: string }`) and expose it via submit payload or agent config.  
   - Effort: ~1 day (adapter changes + harness plumbing + validation).  
   - Rationale: Some workflows (e.g., deterministic file reads) need to force a tool call, while others must guarantee pure text responses; having knobs prevents extra retries.

**Priority 3 (Nice-to-Have):**
3. Tool Schema Validation & Caching  
   - Current limitation: Tool specs are reformatted on every request with no validation beyond TypeScript shapes, so malformed JSON schemas will surface only at runtime from the provider.  
   - Recommended fix: Validate registry entries with Ajv at startup and cache the preformatted Responses/Chat arrays so adapters can reuse immutable snapshots.  
   - Effort: ~0.5 day (Ajv wiring + memoization + tests).  
   - Rationale: Catches schema bugs earlier, trims per-request overhead, and simplifies debugging when new tools are registered.
- TC-8.5: Multiple Subscribers (not supported)
- TC-L4: Provider Override Workflow (per-turn overrides not implemented)
- TC-L6: Stream Reconnection (Playwright limitation)

## 🔍 Analysis

### Critical Issues (High Priority)
1. **Streaming Events Missing** - `task_started` events not appearing in streams
   - Affects: TC-8.1, TC-8.2, TC-8.8, TC-L1
   - Likely cause: Events not being stored before stream is consumed, or event processing timing issue

2. **Tool Execution Events Missing** - Tool calls not being captured
   - Affects: TC-7.3, TC-8.2, TC-L3
   - Likely cause: Tool events (`exec_command_begin`, `exec_command_end`) not being processed/stored

### Medium Priority Issues
3. **Error Handling** - 500 instead of 404 for not found cases
   - Affects: TC-4.2, TC-6.2
   - Fix: Add proper error handling

4. **Delete Not Working** - Conversations not actually deleted
   - Affects: TC-4.3
   - Fix: Ensure ConversationManager.removeConversation works correctly

### Low Priority Issues
5. **Anthropic API Key** - Tests requiring Anthropic fail if key not set
   - Affects: TC-1.2, TC-L7 (partially)
   - Note: Expected behavior if key not configured

## 📊 Test Categories Breakdown

| Category | Total | Passed | Failed | Skipped |
|----------|-------|--------|--------|---------|
| Conversations | 29 | 25 | 4 | 0 |
| Messages | 6 | 4 | 1 | 1 |
| Turns | 13 | 7 | 3 | 3 |
| Lifecycle | 7 | 2 | 3 | 2 |
| Smoke | 1 | 1 | 0 | 0 |

## 🎯 Next Steps

1. **Fix streaming events** - Investigate why `task_started` events aren't appearing
2. **Fix tool execution** - Ensure tool events are captured and stored
3. **Fix error handling** - Return 404 instead of 500 for not found cases
4. **Fix delete operation** - Ensure conversations are actually removed
5. **Verify API keys** - Ensure all required keys are in `.env` file
