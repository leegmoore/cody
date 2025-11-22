# Core 2.0 Test Harness: Final Unified Strategy

**Date:** November 22, 2025
**Status:** Approved for Implementation
**Consensus:** Merged Gemini + Claude Architecture

---

## 1. The Core Philosophy
**"Pipeline Integration with Mocked Intelligence"**
- **Infrastructure:** REAL (Redis, Convex, Fastify, Workers) - Running locally.
- **Intelligence:** MOCKED (LLM API Responses) - Injected via Factory.
- **Harness:** Custom TypeScript harness (no Docker required yet).

---

## 2. Architecture Decision Record

### 2.1. Mock Injection: Dependency Injection (Winner: Gemini)
**Decision:** We will NOT monkey-patch `globalThis.fetch`.
**Mechanism:**
- Define `ModelFactory` interface in `src/core/model-factory.ts`.
- Update `src/server.ts` to accept `ModelFactory` in `AppOptions`.
- **Prod:** `DefaultModelFactory` returns `OpenAIStreamAdapter`.
- **Test:** `MockModelFactory` returns `MockStreamAdapter`.
**Why:** Safer, cleaner, typesafe, no side effects on other fetch calls (Convex, etc.).

### 2.2. Fixture Management: File-Based JSON (Winner: Claude)
**Decision:** We will store raw SSE chunks in JSON files.
**Location:** `tests/fixtures/{provider}/{scenario}.json`.
**Why:** Allows exact replay of whitespace quirks, easier to read/edit than inline strings, enables "Record/Replay" scripts later.

### 2.3. Hydration: StreamHydrator Class (Winner: Claude)
**Decision:** We will build a dedicated client-side hydration utility.
**Location:** `src/client/hydration.ts`.
**Why:** Encapsulates `EventSource` connection logic, timeout handling, and reducer application. Critical for testing the "Client Experience."

### 2.4. Test Runner: Vitest (Winner: Claude)
**Decision:** Use Vitest + Supertest.
**Why:** Faster than Playwright (no browser overhead), native TypeScript support, sufficient for API testing.

---

## 3. Implementation Roadmap

### Step 1: Scaffold Directories
- `tests/harness/`
- `tests/fixtures/openai/`
- `tests/fixtures/anthropic/`
- `src/client/` (if missing)

### Step 2: The Fixtures
- Create `tests/fixtures/openai/simple-message.json` (Standard happy path).
- Create `tests/fixtures/anthropic/thinking-message.json` (Thinking block test).

### Step 3: The Factory Pattern
- Create `src/core/model-factory.ts`.
- Implement `DefaultModelFactory` (Production).
- Implement `MockStreamAdapter` (Test) - Reads from fixture.

### Step 4: Server Refactor
- Modify `src/server.ts` `createServer` function to accept `{ modelFactory?: ModelFactory }`.
- Update `src/api/routes/submit.ts` to use the factory.

### Step 5: The Harness
- Implement `tests/harness/core-harness.ts`.
- `setup()`: Start Fastify (injected), start Workers.
- `teardown()`: Stop Fastify, stop Workers, clear Redis keys.

### Step 6: The First Test
- Write `tests/e2e/core-2.0/basic-turn.spec.ts`.
- Test `TC-BT-1`: Simple Message Turn.

---

## 4. Final Constraints
- **Strict Models:** The `MockModelFactory` must enforce the "Valid Models" list from `GEMINI.md`.
- **No Mocks (Infra):** Redis and Convex connections must be real.
- **Cleanup:** Harness must ensure unique RunIDs and aggressively expire streams to prevent local state pollution.
