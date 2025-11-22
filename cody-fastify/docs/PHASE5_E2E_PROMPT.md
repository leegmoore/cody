# Phase 5: The Switchover - V2 API Implementation & E2E Verification

**High-Level Objective:** Build the missing V2 CRUD endpoints (`threads`, `runs`, `openrouter`) and verify the entire system with a comprehensive Playwright suite.

# Key Documentation
1.  **Test Plan:** `cody-fastify/docs/v2-test-plan.md` (The **Absolute Law**. This document contains the complete specification for all tests).
2.  **Design:** `cody-fastify/docs/codex-core-2.0-tech-design.md`.

# Work Plan

## Step 1: Build Missing V2 API Routes
To pass the Test Plan, you must implement the full CRUD surface area for V2:

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
*   **OpenRouter:** Implement `OpenRouterStreamAdapter` (Chat Completions) in `src/core/adapters/openrouter-adapter.ts` to satisfy the Provider Variety tests.

## Step 3: Implement E2E Test Suite
*   **File:** `tests/e2e/v2-lifecycle.spec.ts`
*   **Requirement:** Implement **ALL 50+ Test Cases** exactly as defined in `v2-test-plan.md`.
    *   **Granularity:** Each `TC-V2-...` entry in the `v2-test-plan.md` corresponds to a **separate `test()` block**.
    *   **Structure:** Use `test.describe` blocks matching the Test Plan sections.
    *   **Naming:** Use the exact TC IDs (e.g., `test("TC-V2-1.1: Create Thread - Minimal Config", ...)`) for clear auditing.
    *   **Dependencies:** Use `fixtures/api-client.ts` (extended for V2 routes) to keep tests clean. Do NOT look at legacy test files for requirements; `v2-test-plan.md` is the only source of truth.

## Step 4: Verification
*   Run `bun run test:e2e`.
*   **Success Criteria:** All tests in `v2-lifecycle.spec.ts` MUST pass.
*   **Regression Check:** Legacy tests (e.g. `lifecycle.spec.ts`) must NOT be broken by your changes (i.e., do not modify V1 routes).

# Coding Standards
*   **Strict TypeScript.**
*   **NO MOCKS (Absolutely Critical):**
    *   **Requirement:** All tests and infrastructure interactions MUST use **real Redis** and **real LLM APIs**.
    *   Explicitly ban `ioredis-mock`, `vi.mock`, `jest.mock`, or any other mocking/stubbing framework for infrastructure.
    *   If `REDIS_URL` is unset, the system MUST fail fast, NOT fall back to a mock.
*   **Isolation:** Do not break V1 routes.
