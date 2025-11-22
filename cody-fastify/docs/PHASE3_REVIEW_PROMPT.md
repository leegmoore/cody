# Phase 3 Review: Client Integration & API Audit

**Role:** Senior QA/Reviewer.
**Context:** Phase 3 exposed the Core 2.0 pipeline via new Fastify endpoints (`/api/v2/...`). This is the bridge between the backend engine and the frontend client.

# Review Standards

## 1. API Contract & Isolation
*   **Strict Separation:** New logic MUST reside in `src/api/routes/v2/`.
*   **Legacy Preservation:** Verify `src/api/routes/v1/` (or root routes) were NOT touched. `POST /messages` must remain identical.
*   **Route Schema:** `POST /api/v2/submit` must use Zod validation for the request body. No `any` payloads.

## 2. SSE Implementation Quality
*   **Stream Protocol:**
    *   Does `GET /api/v2/stream` emit valid SSE (`Content-Type: text/event-stream`)?
    *   Does it send `:keepalive` comments?
    *   Does it handle `Last-Event-ID` header correctly for resumption (passing `fromId` to Redis)?
*   **Resource Management:**
    *   **Critical:** When the client disconnects (`req.raw.on("close")`), does the server STOP reading from Redis? Check for loop termination conditions. Infinite loops here are memory leaks.

## 3. Observability
*   **Trace Continuity:**
    *   Check `src/api/routes/v2/submit.ts`: Does it inject trace context into the Redis event?
    *   Check `src/api/routes/v2/stream.ts`: Does it extract trace context from Redis events and link it?

## 4. Verification Depth
*   **Script:** `scripts/verify_sse.ts`
*   **Requirement:** The script must simulate a real client.
    *   It should make a HTTP POST.
    *   It should consume the HTTP GET stream.
    *   **Assertion:** It must parse at least one full event JSON and verify the `trace_context` is present.

# Execution Tasks

1.  `bun run format:check`
2.  `bun run lint`
3.  `bun run build`
4.  `bun run scripts/verify_sse.ts`

# Review Report Format

```markdown
# Phase 3 Review Report

## Execution Results
| Check | Status | Notes |
| :--- | :--- | :--- |
| Format | ✅/❌ | |
| Lint | ✅/❌ | |
| Build | ✅/❌ | |
| Verify SSE | ✅/❌ | Did it parse events? |

## Code Quality Audit
| Check | Status | Notes |
| :--- | :--- | :--- |
| No Legacy Touches | ✅/❌ | |
| SSE Cleanup on Close | ✅/❌ | |
| Trace Propagation | ✅/❌ | |

## Findings Log
(Sort by Severity)

### 1. [Issue Title]
...

## Final Verdict
**Status:** [ACCEPTED / REJECTED]
```