# CODER PROMPT: Core 2.0 Test Harness - Phase 3 Implementation

**Generated:** November 22, 2025
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`

---

## ROLE

You are a senior TypeScript/Node.js developer responsible for implementing the **10 happy path integration tests** for the Core 2.0 streaming architecture. You will use the recently built test harness infrastructure to validate the full pipeline (Fastify → Redis → Workers → Convex → SSE → Hydration).

---

## PROJECT CONTEXT

**Cody Core 2.0** is a streaming-native agent architecture processing LLM turns through a Redis Streams pipeline. The test harness infrastructure (ModelFactory, MockStreamAdapter, Core2TestHarness, StreamHydrator) has been implemented and wired. We now need to leverage this harness to create our initial suite of happy path tests.

**Current State:**
- Test harness infrastructure (Factory Pattern, MockStreamAdapter, Core2TestHarness, StreamHydrator) is **implemented and compiles**.
- The `createServer` in `src/server.ts` and `registerSubmitRoutes` in `src/api/routes/submit.ts` have been refactored to use the `ModelFactory`.
- The `PersistenceWorker` is started by the `Core2TestHarness`.
- The `StreamHydrator` is implemented in `src/client/hydration.ts`.
- `eventsource` polyfill is installed.

**Expected Test Outcomes:**
- Tests are expected to **FAIL** initially. This is the primary goal of this phase: to expose bugs and integration issues in the existing V2 Core implementation.

---

## CURRENT PHASE

**Phase:** Core 2.0 Test Harness - Phase 3: Test Implementation
**Objective:** Implement 10 happy path test conditions from the test plan.

**FUNCTIONAL OUTCOME:**
After this phase, we will have a comprehensive set of 10 happy path integration tests that validate the full V2 Core pipeline. These tests will be executable, and their failures will clearly document the current integration gaps and bugs in the V2 Core implementation.

---

## PREREQUISITES

✅ **Test Harness Infrastructure:**
- `src/core/model-factory.ts` (ModelFactory interface, DefaultModelFactory, MockModelFactory)
- `tests/mocks/mock-stream-adapter.ts` (MockStreamAdapter, createMockStreamAdapter)
- `tests/harness/core-harness.ts` (Core2TestHarness class)
- `src/client/hydration.ts` (StreamHydrator class)
- `src/server.ts` and `src/api/routes/submit.ts` updated for ModelFactory injection.

✅ **Test Conditions Defined:**
- `docs/gem/test-conditions-v2-happy-path.md` (Contains 10 detailed test conditions).

✅ **Local Environment:**
- Redis running on localhost:6379
- Convex dev server running (`npx convex dev`)
- `eventsource` and `@types/eventsource` installed.

---

## STATE LOADING (READ THESE FIRST)

### FIRST: Load Test Plan and Harness Design

**Mandatory reading order:**

1.  **Test Conditions:** `docs/gem/test-conditions-v2-happy-path.md`
    -   Read ALL **10 test scenarios** (TC-HP-01 through TC-HP-10).
    -   Pay close attention to the functional descriptions, expected results, and verification points.
    -   Note the `Fixture Structure Example` in Appendix A.
    -   Understand what each test validates at an end-to-end level.

2.  **Harness Design:** `docs/gem/v2-harness-final-strategy.md`
    -   Review the `Core2TestHarness` API and its usage.
    -   Understand how `MockModelFactory` and `MockStreamAdapter` are used to replay fixtures.
    -   Review the test workflow steps (Setup, Execute, Stream, Hydrate, Verify, Cleanup).

3.  **Core 2.0 Architecture:** `docs/codex-core-2.0-tech-design.md`
    -   Understand the `StreamEvent` schema and `Response` object structure.
    -   Review provider adapter contracts and their role in normalizing events.

### THEN: Review Existing Harness Implementation

4.  **Model Factory:** `src/core/model-factory.ts`
    -   Review `MockModelFactory`'s `registerFixture` and `createAdapter` methods.
    -   Understand `VALID_PROVIDER_MODELS` and model validation.

5.  **Mock Stream Adapter:** `tests/mocks/mock-stream-adapter.ts`
    -   Understand how it reads fixture JSON and publishes `StreamEvent`s to Redis.
    -   Note how `{{runId}}` and other placeholders are handled.

6.  **Core Test Harness:** `tests/harness/core-harness.ts`
    -   Review `setup()`, `cleanup()`, `reset()`.
    -   Understand `submit()`, `consumeSSE()`, `hydrate()`, `getPersistedResponse()`.

7.  **Stream Hydrator:** `src/client/hydration.ts`
    -   Understand `StreamHydrator`'s `hydrateFromSSE` and `hydrateFromEvents` methods.
    -   Note how it uses `ResponseReducer`.

---

## TASK SPECIFICATION

Implement the **10 happy path integration tests** as specified in `docs/gem/test-conditions-v2-happy-path.md`.

### **Phase 3: Test Implementation (10 Happy Path Tests)**

**Deliverables:**

1.  **Fixture Files** (`tests/fixtures/`) - **Minimum 12 JSON files**
    -   Create all required fixture files (`openai/simple-message.json`, `anthropic/thinking-message.json`, `openai/simple-tool-call.json`, etc.) as defined by the test conditions document.
    -   Each fixture file MUST contain `description`, `provider`, `model`, `chunks` (raw SSE event strings), and `expected_response` (the final hydrated `Response` object).
    -   Ensure placeholders like `{{runId}}`, `{{turnId}}`, `{{threadId}}` are used in `chunks` and `expected_response` where appropriate.
    -   Capture realistic SSE chunks that accurately reflect the `StreamEvent` schema.

2.  **Test Suite** (`tests/e2e/core-2.0/happy-path.spec.ts`) - **~800 lines**
    -   Implement **10 test cases** corresponding to `TC-HP-01` through `TC-HP-10`.
    -   Use **Vitest** for the test runner (installed in `cody-fastify`).
    -   Utilize the `Core2TestHarness` for `setup()`, `cleanup()`, `reset()`, `submit()`, `consumeSSE()`, `hydrate()`, and `getPersistedResponse()`.
    -   Follow the implementation pattern provided in `v2-harness-final-strategy.md` and `CODER-PROMPT-PHASE3.md` (this document).
    -   Ensure assertions cover:
        *   Hydrated `Response` status, `output_items` content, `usage` (if applicable).
        *   Persisted `Response` in Convex matching the hydrated `Response`.
        *   Specific event flow details for streaming-related tests (TC-HP-09, TC-HP-10).

**Effort Estimate:** ~1000 lines total (fixtures + tests)

---

## WORKFLOW STEPS

### **Step-by-Step Process:**

1.  **Review Test Conditions:** Carefully re-read `docs/gem/test-conditions-v2-happy-path.md` to understand each test scenario.
2.  **Create Fixtures:**
    *   Start with `openai/simple-message.json`.
    *   Use the `Fixture Structure Example` in the test conditions document.
    *   Ensure `chunks` are correctly formatted with `event: type\ndata: {JSON}\n\n`.
    *   Fill in `expected_response` accurately, using `expect.any(String)`/`expect.any(Number)` for dynamic IDs/timestamps.
    *   Create `MockFixtureFile` types if necessary for `mock-stream-adapter.ts` to consume these.
    *   Load this fixture into `Core2TestHarness`'s `modelFactory` during `setup()`.
3.  **Implement `TC-HP-01` Test Case:**
    *   Write the test case in `tests/e2e/core-2.0/happy-path.spec.ts`.
    *   Use `Core2TestHarness` methods.
    *   Run only this test (`npm test tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"`).
    *   **Expect it to fail.** Document the failure.
4.  **Implement Remaining Tests (TC-HP-02 through TC-HP-10):**
    *   Repeat the fixture creation and test implementation process for each remaining test condition.
    *   **Focus on getting tests to run and fail for the *right reasons* (i.e., V2 Core implementation bugs), not for test harness bugs.**
5.  **Document Results:** Update `TEST_RESULTS.md` as you go, showing progress and encountered bugs.

---

## WORKFLOW RULES

### **Mandatory Rules:**

1.  **Use ONLY valid models from `GEMINI.md` / `CLAUDE.md`**
    -   When creating fixtures, use: `gpt-5-mini`, `gpt-5-codex`, `claude-haiku-4.5`, `claude-sonnet-4.5`.
    -   NEVER use `gpt-4`, `claude-3-*`, or other deprecated models.
2.  **Follow fixture structure exactly**
    -   Use the JSON structure from test conditions Appendix A.
    -   Include `description`, `provider`, `model`, `chunks`, `expected_response`.
    -   Use real SSE chunk format (research OpenAI/Anthropic API docs if needed for accurate `chunks`).
3.  **Tests will fail initially - this is OK**
    -   Document failures clearly.
    -   Don't try to "fix" V2 implementation in this phase.
    -   Focus on building correct test infrastructure and accurate test cases that highlight V2 Core issues.
    -   **The goal is to get tests to _run_ and _document the failures_.**
4.  **Keep `Core2TestHarness` and `MockModelFactory` generic.**
    -   They should not contain hardcoded fixture paths or assumptions about specific test cases. Fixtures should be registered dynamically.

### **INTERRUPT PROTOCOL**

**STOP and ask for clarification if:**
-   OpenAI/Anthropic SSE chunk format is unclear for fixture creation.
-   `Core2TestHarness` or `MockModelFactory` API is unclear.
-   Vitest test utilities are unfamiliar.
-   The expected `Response` schema for a complex test is ambiguous.

**DO NOT:**
-   Invent SSE chunk formats (use real API docs if needed).
-   Modify `src/core` or `src/api` code (except where explicitly directed by previous prompts, which should be complete).
-   Simplify the `Response` schema in `expected_response` (use complete schema from the test conditions document).

---

## CODE QUALITY STANDARDS

### **Mandatory Quality Gates:**

-   ✅ TypeScript: Zero errors (`npx tsc --noEmit`)
-   ✅ ESLint: Zero errors (`npm run lint`)
-   ✅ Prettier: Formatted (`npm run format`)
-   ✅ Fixtures: Valid JSON (parseable and schema-compliant with `StreamEvent` and `Response` types).
-   ✅ Tests: Runnable (may fail, but must execute without test runner errors).

### **Verification Command:** 
```bash
npm run format && npm run lint && npx tsc --noEmit
```

**Note:** `npm test tests/e2e/core-2.0/happy-path.spec.ts` will likely show initial failures due to V2 Core bugs. This is expected. The goal is to get tests RUNNING and DOCUMENTING failures, not necessarily passing.

---

## IMPLEMENTATION GUIDANCE

### **Fixture Creation**

-   Refer to `Appendix A: Fixture Structure Example` in `docs/gem/test-conditions-v2-happy-path.md`.
-   Use `fs.readFileSync` to load fixture JSON files within `MockModelFactory.registerFixture` or similar.
-   Use template placeholders (`{{runId}}`, `{{turnId}}`, etc.) where dynamic IDs are needed, and ensure `MockStreamAdapter` handles their replacement before publishing to Redis.

### **Test Implementation**

-   Refer to the `Test Implementation Pattern` example.
-   Ensure `beforeAll`, `afterAll`, `afterEach` are correctly used for harness lifecycle and data cleanup.
-   Use Vitest's `expect` API for assertions.
-   Remember `expect.any(String)`, `expect.any(Number)`, `expect.objectContaining` for dynamic fields.

---

## SESSION COMPLETION CHECKLIST

### **Before ending session:**

1.  ✅ **Run verification command** (format, lint, type-check)
2.  ✅ **Document test results:**
    -   Create or update `TEST_RESULTS.md`
    -   List which tests pass/fail (e.g., "TC-HP-01: FAIL - V2 Core did not persist message to Convex")
    -   Document any V2 Core bugs discovered (e.g., "Bug: Redis keys not expiring, or PersistenceWorker not starting")
    -   Note any incomplete work or blockers.
3.  ✅ **Commit work:**
    ```bash
    git add -A
    git commit -m "feat(test): implement 10 Core 2.0 happy path tests

    - Implemented TC-HP-01 through TC-HP-10 as per test plan.
    - Created all required JSON fixture files.
    - Tests are currently X/10 passing (see TEST_RESULTS.md for details on failures).
    - Identified X bugs in Core 2.0 implementation (details in TEST_RESULTS.md).

    🤖 Generated with [Gemini Code](https://gemini.google.com/gemini-code)

    Co-Authored-By: Gemini <noreply@google.com>"
    ```
4.  ✅ **Report summary to user:**
    -   Number of fixture files created.
    -   Number of test cases implemented.
    -   Test pass/fail count (e.g., "X/10 tests are currently passing").
    -   List of V2 Core bugs discovered.
    -   Next steps (e.g., "Ready to begin fixing V2 Core bugs identified by the harness").

---

## STARTING POINT

**BEGIN by:**

1.  Thoroughly reading `docs/gem/test-conditions-v2-happy-path.md`.
2.  Creating the directory structure for fixtures (`tests/fixtures/openai`, `tests/fixtures/anthropic`).
3.  Creating the first fixture file: `tests/fixtures/openai/simple-message.json`.
4.  Implementing the test case for `TC-HP-01` in `tests/e2e/core-2.0/happy-path.spec.ts`.
5.  Getting `TC-HP-01` to RUN (even if it fails).

**Focus on getting tests to run and expose bugs, not on fixing V2 Core bugs in this phase.**

---

## EXPECTED OUTCOME

After this session:
-   ✅ All 10 happy path test cases (TC-HP-01 through TC-HP-10) are implemented and executable.
-   ✅ All required JSON fixture files are created.
-   ✅ `TEST_RESULTS.md` is updated with pass/fail status for all 10 tests and a summary of V2 Core bugs identified.
-   ✅ Foundation for iterative bug fixing is established.
