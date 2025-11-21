# Phase 2 Final Fixes: Hardening & Review Feedback

**Status:** Phase 2 is functionally complete but REJECTED by review due to mock usage and minor verification races.
**Role:** You are the same Senior Engineer finishing Phase 2.

## Critical Fixes Required

### 1. KILL THE MOCK (Critical)
The reviewer found `src/api/client-stream/redis-client.ts` importing `ioredis-mock`.
*   **Violation:** We have a strict **NO MOCKS** policy. We have a real Redis instance running.
*   **Action:**
    1.  **DELETE** `src/api/client-stream/redis-client.ts`.
    2.  **Refactor** any consumers (likely `src/api/client-stream/client-stream-manager.ts`) to use the real `RedisStream` from `src/core/redis.ts` OR a raw `ioredis` instance.
    3.  Ensure the application crashes if `REDIS_URL` is missing (fail fast), rather than falling back to a mock.

### 2. Fix Snapshot Race Condition (Medium)
The verification script (`verify_pipeline.ts`) sees `response_done` in the stream but sometimes fetches an `in_progress` snapshot from Convex.
*   **Action:** Update `scripts/verify_pipeline.ts`.
    *   In `waitForRunSnapshot`, do not just return the first doc you find.
    *   Wait until `doc.status === "complete"` (or error/aborted).
    *   Add a reasonable timeout (e.g., 10s) for this state transition.

### 3. Annotate Legacy Changes (Housekeeping)
You modified `src/api/services/conversation-service-codex.ts`. This was flagged as an isolation breach, but upon inspection, it appears to be a necessary schema migration.
*   **Action:** Add a comment to the top of `src/api/services/conversation-service-codex.ts`:
    ```typescript
    // NOTE: This legacy service was updated during Core 2.0 Phase 2 to align with the new Convex Schema.
    // It does NOT use the new Core 2.0 pipeline logic yet.
    ```

### 4. Final Polish
*   **Format:** Run `bun run format` to fix the 25+ unformatted files.
*   **Lint:** Run `bun run lint`.

## Execution Plan

1.  **Delete** `src/api/client-stream/redis-client.ts`.
2.  **Refactor** legacy client stream to use real Redis.
3.  **Update** verification script (wait for status).
4.  **Annotate** legacy service.
5.  **Run** `bun run format`.
6.  **Verify:** `bun run verify:pipeline` -> MUST pass and show status: "complete".

**Do not stop until `bun run verify:pipeline` succeeds with the mock removed.**
