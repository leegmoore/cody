# Phase 5: The Switchover - Feature Parity & E2E Verification

**High-Level Objective:** Achieve 100% Feature Parity with V1 by building the missing V2 CRUD endpoints and verifying the entire system with a comprehensive Playwright suite based on the new Test Plan.

# Key Documentation
1.  **Test Plan:** `cody-fastify/docs/v2-test-plan.md` (The absolute law. Every TC must have a corresponding test).
2.  **Design:** `cody-fastify/docs/codex-core-2.0-tech-design.md`.

# Work Plan

## Step 1: Build Missing V2 API Routes
To support the Test Plan, you must implement the full CRUD surface area for V2:

*   **Threads (`src/api/routes/v2/threads.ts`):**
    *   `POST /threads` (Create)
    *   `GET /threads` (List)
    *   `GET /threads/:id` (Get - hydrates history from `messages` table)
    *   `PATCH /threads/:id` (Update)
    *   `DELETE /threads/:id` (Delete)
*   **Runs (`src/api/routes/v2/runs.ts`):**
    *   `GET /runs/:id` (Get Status/Result)
*   **Submit/Stream:** Ensure `src/api/routes/v2/submit.ts` and `stream.ts` are registered and working.

## Step 2: Build Missing Adapters
*   **OpenRouter:** Implement `OpenRouterStreamAdapter` (Chat Completions) in `src/core/adapters/openrouter-adapter.ts`.

## Step 3: Implement E2E Test Suite
*   **File:** `tests/e2e/v2-lifecycle.spec.ts`
*   **Requirement:** Implement **ALL Test Cases** defined in `v2-test-plan.md`.
    *   **Granularity:** Do NOT group tests. For "TC-V2-1.3 - 1.6 Validation", implement **4 separate test blocks**, one for each error condition.
    *   **Structure:** Use `test.describe` blocks matching the Test Plan sections.
    *   **Naming:** Use the exact TC IDs (e.g., `test("TC-V2-1.1: Create Thread", ...)`) to allow easy auditing.
    *   **Scope:** This includes V1 parity tests (CRUD, Pagination, Metadata) AND V2 specific tests (Streaming, Tools, Providers).
    *   **Fixtures:** Use/extend `fixtures/api-client.ts` to keep tests clean.

## Step 4: Verification
*   Run `bun run test:e2e`.
*   **Constraint:** All V2 tests MUST pass. All V1 tests MUST still pass.

# Coding Standards
*   **Strict TypeScript.**
*   **NO MOCKS (Absolutely Critical):**
    *   **Requirement:** All tests and infrastructure interactions MUST use **real Redis** and **real LLM APIs**.
    *   Explicitly ban `ioredis-mock`, `vi.mock`, `jest.mock`, or any other mocking/stubbing framework for infrastructure.
    *   If `REDIS_URL` is unset, the system MUST fail fast, NOT fall back to a mock.
*   **Isolation:** Do not break V1 routes.