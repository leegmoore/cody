# Phase 5: V2 API Implementation & E2E Baseline

**High-Level Objective:** Implement the V2 API endpoints and the comprehensive Test Suite. Establish the baseline pass/fail state.

# Key Documentation
1.  **Test Plan:** `cody-fastify/docs/v2-test-plan.md` (The Absolute Law).
2.  **Design:** `cody-fastify/docs/codex-core-2.0-tech-design.md`.

# Work Plan

## Step 1: Build Missing V2 API Routes
Implement the code required to support the tests.
*   **Threads (`src/api/routes/v2/threads.ts`):** Full CRUD.
*   **Runs (`src/api/routes/v2/runs.ts`):** Status endpoint.
*   **Adapters:** `OpenRouterStreamAdapter`.

## Step 2: Implement E2E Test Suite
*   **File:** `tests/e2e/v2-lifecycle.spec.ts`
*   **Requirement:** Implement **ALL 50+ Test Cases** defined in `v2-test-plan.md`.
*   **Constraint:** Each TC must be a separate test block. Use strict assertions matching the plan.

## Step 3: Execution & Reporting (CRITICAL)
*   **Action:** Run `bun run test:e2e`.
*   **Stop Condition:**
    *   If tests pass: Great. Report success.
    *   **If tests fail:** **DO NOT ATTEMPT TO FIX DEEP SYSTEM ISSUES.**
    *   **Your Goal:** Deliver the *Tests* and the *Initial Implementation*.
    *   **Output:** Provide a detailed list of which tests failed and the error messages.
    *   **Reasoning:** We will use a separate "Debugging Agent" to investigate failures. Your job is to establish the test harness and the code surface area.

# Coding Standards
*   **Strict TypeScript.**
*   **NO MOCKS.**
*   **Isolation:** Do not modify V1 files.