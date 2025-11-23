# Test Results Summary

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
