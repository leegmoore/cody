# Phase 3: The Client Integration

**High-Level Objective:** Connect the Core 2.0 "Engine" (Redis Stream + Persistence) to the "Wheels" (Fastify API & SSE). This phase bridges the internal event bus to the frontend client.

# Key Documentation (Source of Truth)
1.  **Blueprint:** `cody-fastify/docs/codex-core-2.0-tech-design.md` (Especially Phase 3 section and Appendix A).
2.  **Legacy Context:** `cody-fastify/docs/codex-core-as-is.md`.

# Coding Standards & Habits
*   **Strict TypeScript:** No `any`. Use Zod for validation.
*   **No Mocks:** Real infrastructure only.
*   **Observability:** OpenLLMetry must be instrumented. Trace context MUST be propagated from Fastify Request -> Redis -> SSE.
*   **Redis Driver:** Use `ioredis` (or the existing `src/core/redis.ts` wrapper).

# Work Plan (Phase 3)

**Constraint:** Implement new endpoints side-by-side with legacy ones. Do NOT delete legacy routes yet.

1.  **SSE Endpoint (`src/api/routes/stream.ts`):**
    *   Create a new Fastify route `GET /api/v2/stream/:runId`.
    *   This handler should:
        *   Accept `runId` as a parameter.
        *   Accept `Last-Event-ID` header for reconnection.
        *   Use `RedisStream.read` (via `XREAD`) to tail the stream `codex:run:<runId>:events`.
        *   Serialize `StreamEvent` objects to SSE format (`data: ...`).
        *   **Crucial:** Extract Trace Context from the Redis event and link it to the current request span if possible (or just pass it through).

2.  **Submission Endpoint (`src/api/routes/submit.ts`):**
    *   Create a new Fastify route `POST /api/v2/submit`.
    *   This handler should:
        *   Accept user prompt/configuration.
        *   Instantiate the `OpenAIStreamAdapter`.
        *   Call `adapter.stream()` to kick off the process.
        *   Return `{ runId }` to the client.

3.  **Client Bridge Utility (`src/core/client-bridge.ts`):**
    *   Create a helper class/function to manage the SSE subscription lifecycle (keep-alives, error handling, closing the connection when `response_done` is seen).

4.  **Verification:**
    *   Create `cody-fastify/scripts/verify_sse.ts`.
    *   This script should:
        1.  Call `POST /api/v2/submit` to start a run.
        2.  Connect to `GET /api/v2/stream/<runId>` (using `eventsource` or `fetch`).
        3.  Assert that it receives the stream of events ending in `response_done`.

# Developer Log
Maintain `DEVLOG.md`.
