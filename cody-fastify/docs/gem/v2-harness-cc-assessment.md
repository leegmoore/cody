# V2 Harness Design Assessment: Claude vs. Gemini

**Date:** November 22, 2025
**Reviewer:** Gemini
**Subject:** Assessment of `docs/cc/v2-custom-harness-cc.md` vs `docs/gem/v2-custom-harness-gem.md`

---

## 1. Executive Summary

Both designs are highly aligned on the core philosophy: **"Real Infrastructure, Mocked Intelligence."** Both reject Docker Compose for now, both use local Redis/Convex/Fastify, and both aim for a fast TDD loop.

**The Verdict:**
We should **MERGE** the designs.
- **Adopt Claude's Test Scenarios & Fixture Management:** Detailed, comprehensive, and file-based.
- **Adopt Gemini's Injection Strategy:** Use Dependency Injection (Factory Pattern) instead of monkey-patching `globalThis.fetch`.
- **Adopt Claude's Hydration Design:** The `StreamHydrator` class is a necessary abstraction.

---

## 2. Agreement Points (The Core)

| Concept | Claude's Approach | Gemini's Approach | Verdict |
| :--- | :--- | :--- | :--- |
| **Topology** | Real Fastify/Redis/Convex, Mocked LLM | Same | **AGREED** |
| **Orchestrator** | `Core2TestHarness` class | `TestHarness` class | **AGREED** (Naming is trivial) |
| **Workers** | Programmatic start/stop | Programmatic start/stop | **AGREED** |
| **Testing** | Vitest + Supertest | Playwright/Vitest | **AGREED** (Vitest is faster) |

---

## 3. Divergence Points (The Implementation)

### 3.1. Mock Injection Strategy
*   **Claude:** Monkey-patch `globalThis.fetch` to intercept calls to `api.openai.com`.
*   **Gemini:** Use Dependency Injection (`ModelFactory` passed to Fastify app) to swap `OpenAIAdapter` for `MockAdapter`.

**Assessment:**
**Gemini's approach is safer.** Global patches can leak, cause side effects in other libraries (like Convex client), and are harder to debug. DI makes the seam explicit and typed.
**Recommendation:** Use **Dependency Injection**.

### 3.2. Fixture Management
*   **Claude:** Explicit JSON files (`tests/fixtures/openai/simple-message.json`) containing raw SSE chunks.
*   **Gemini:** Abstract `MockFixture` objects defined in code.

**Assessment:**
**Claude's approach is better.** Storing raw SSE chunks in JSON files allows us to capture *real* API output (via a recording script) and replay it exactly, preserving whitespace/formatting quirks that might break parsers.
**Recommendation:** Adopt **File-Based Fixtures**.

### 3.3. Hydration Layer
*   **Claude:** Defines `StreamHydrator` class wrapping `ResponseReducer`.
*   **Gemini:** Mentions `ResponseReducer` but less detail on the consumption side.

**Assessment:**
**Claude's design is more complete.** The `StreamHydrator` handling `EventSource` connection and timeout logic is a necessary piece of the harness.
**Recommendation:** Implement **StreamHydrator**.

---

## 4. Missing Pieces (Both Designs)

1.  **Redis Stream Cleanup:** Both mention unique RunIDs, but we need a strategy to aggressively expire/delete stream keys in Redis so local dev doesn't explode memory usage over time.
2.  **Convex Cleanup:** Claude suggests `deleteByRunId`. This is good but requires a dedicated mutation. We should ensure this mutation exists and is safe (dev-only).

---

## 5. Unified Architecture Proposal

The final harness should look like this:

1.  **Infrastructure:** `setupTestEnvironment()` starts Fastify (with DI) + Workers.
2.  **Injection:** Fastify receives `MockModelFactory`.
3.  **Fixtures:** `MockModelFactory` reads `tests/fixtures/**/*.json`.
4.  **Execution:** Test calls `harness.submit()`.
5.  **Pipeline:** Events flow through Real Redis -> Real Worker -> Real Convex.
6.  **Consumption:** `StreamHydrator` reads Real SSE endpoint.
7.  **Verification:** Assert on Hydrated Object + Convex State.

---

## 6. Action Plan

1.  **Create Fixtures:** Copy Claude's JSON structure.
2.  **Implement Factory:** Build `src/core/model-factory.ts`.
3.  **Implement Harness:** Build `tests/harness/core-harness.ts` using the Factory pattern.
4.  **Refactor Server:** Update `src/server.ts` to accept the Factory.
