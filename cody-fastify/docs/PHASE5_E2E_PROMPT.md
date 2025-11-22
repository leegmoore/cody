# Phase 5: The Switchover - API Implementation & E2E Verification

**High-Level Objective:** Build the V2 API endpoints (`/submit`, `/stream`) and verify the entire Core 2.0 pipeline with a comprehensive Playwright E2E test suite.

# Key Documentation (Source of Truth)
1.  **Test Plan:** `cody-fastify/docs/v2-test-plan.md` (The absolute law for testing).
2.  **Blueprint:** `cody-fastify/docs/codex-core-2.0-tech-design.md`.

# Work Plan

**Constraint:** Implement new endpoints side-by-side with legacy ones. Do NOT delete legacy routes yet.

## Step 1: Implement V2 API Routes
*   **Submission Endpoint (`src/api/routes/v2/submit.ts`):**
    *   Route: `POST /api/v2/submit`
    *   Logic: Instantiate `OpenAIStreamAdapter`, call `.stream()`, return `{ runId }`.
    *   Validation: Use Zod to validate request body.
*   **Stream Endpoint (`src/api/routes/v2/stream.ts`):**
    *   Route: `GET /api/v2/stream/:runId`
    *   Logic: Use `RedisStream` (from `src/core/redis.ts`) to tail events. Convert to SSE format (`data: JSON`).
    *   **Requirement:** Support `Last-Event-ID` header for resumption.
    *   **Observability:** Extract `trace_context` from Redis events and propagate it.

## Step 2: Implement E2E Test Suite
*   **File:** `tests/e2e/v2-lifecycle.spec.ts`
*   **Requirement:** Implement **ALL 15 Test Cases** defined in `cody-fastify/docs/v2-test-plan.md`.
    *   API Contract Tests
    *   Streaming Protocol Tests (Resumption, Keepalives)
    *   Functional Flows (Thinking, Tools)
    *   Resilience (Errors)
    *   Persistence Verification (Check Convex)

## Step 3: Verification
*   Run `bun run test:e2e` (or specifically targeting the new spec).
*   Ensure all V2 tests PASS.
*   Ensure legacy tests STILL PASS.

# Developer Log
Maintain `DEVLOG.md`.
