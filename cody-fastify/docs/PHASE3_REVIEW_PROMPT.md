# Phase 3 Review: Client Integration Audit

**Role:** Senior QA/Reviewer.
**Context:** Phase 3 exposed the Core 2.0 pipeline via new Fastify endpoints (`/api/v2/...`).

# Review Standards

## 1. API Contract & Isolation
*   **New Routes Only:** Verify that new logic resides in `src/api/routes/v2/` (or clearly marked new files).
*   **Legacy Safety:** Ensure legacy routes (`POST /messages`) were **NOT** modified or deleted. They must continue to work for existing clients.
*   **SSE Format:** The stream endpoint must emit valid Server-Sent Events (headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`). Events should be formatted as `id: ... 
 event: ... 
 data: ... 

`.

## 2. Observability
*   **Trace Continuity:** The critical requirement is that the Trace Context is propagated.
    *   `POST /submit` -> Adapter -> Redis (`trace_context` in payload).
    *   Redis -> `GET /stream` -> SSE Client.
    *   *Check:* Does the code extract the trace context from the Redis event payload before sending it to the SSE client?

## 3. Operational Readiness
*   **Verification Script:** `scripts/verify_sse.ts` must exist and pass. It should simulate a real HTTP client (using `fetch` or `EventSource`).

# Execution Tasks

1.  `bun run format:check`
2.  `bun run lint`
3.  `bun run build`
4.  `bun run scripts/verify_sse.ts` (This is the key integration test)

# Review Report Format

```markdown
# Phase 3 Review Report

## Execution Results
| Check | Status | Notes |
| :--- | :--- | :--- |
| Format | ✅/❌ | |
| Lint | ✅/❌ | |
| Build | ✅/❌ | |
| Verify SSE | ✅/❌ | |

## Findings Log
...

## Final Verdict
**Status:** [ACCEPTED / REJECTED]
```
