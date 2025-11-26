# Verifier Prompt: tdd-api Test Suite

**Project:** 001-tdd-test-suite
**Role:** Implementation Verifier
**Task:** Verify the tdd-api test suite implementation

---

## 1. Role

You are verifying that the tdd-api test suite was implemented correctly according to specification. Your job is to:

1. Check all deliverables exist
2. Verify implementation matches spec
3. Run validation checks
4. Provide recommendation (Recommended / Not Recommended)

---

## 2. Critical Principle

The test suite MUST follow:

```
NO MOCKS. NO SHIMS. NO SPECIAL CONFIG OVERRIDES. NO TEST INJECTIONS.
```

**Red flags to look for:**
- Any use of `jest.mock()`, `vi.mock()`, or similar
- Imports from `ioredis-mock` in test files
- Test-specific environment variables or config
- Fake adapters or service stubs
- Any file that intercepts or replaces real infrastructure

If ANY of these are found, the implementation is **Not Recommended**.

---

## 3. Verification Checklist

### 3.1 Files Exist

Check these files exist:

| File | Required |
|------|----------|
| `test-suites/tdd-api/README.md` | Yes |
| `test-suites/tdd-api/validate-env.ts` | Yes |
| `test-suites/tdd-api/simple-prompt.test.ts` | Yes |

### 3.2 Package.json Updated

Verify `package.json` contains:
```json
"test:tdd-api": "bun test test-suites/tdd-api/ --timeout 20000"
```

### 3.3 README.md Content

Verify README includes:
- [ ] Purpose statement (TDD and integrity testing)
- [ ] NO MOCKS principle stated clearly
- [ ] Prerequisites list (4 items)
- [ ] Statement that suite validates prerequisites
- [ ] Running instructions (`bun run dev` then `bun run test:tdd-api`)
- [ ] Environment validation table (4 services)
- [ ] Test list with simple-prompt.test.ts
- [ ] Instructions for adding new tests

### 3.4 validate-env.ts Implementation

Verify:
- [ ] Checks Redis on port 6379 using ioredis
- [ ] Checks Convex by HTTP GET to CONVEX_URL
- [ ] Checks OpenAI by calling GET /v1/models with API key
- [ ] Checks Fastify by calling GET /health on port 4010
- [ ] Reports ALL check results (not just first failure)
- [ ] Uses ✓ and ✗ symbols in output
- [ ] Exits with code 1 if any check fails
- [ ] Supports standalone execution (`if (import.meta.main)`)
- [ ] Does NOT mock anything
- [ ] Does NOT do preliminary env var "is set" checks - just attempts connections

### 3.5 simple-prompt.test.ts Implementation

**Structure:**
- [ ] Imports from "bun:test" (describe, test, expect, beforeAll)
- [ ] Imports validateEnvironment from "./validate-env"
- [ ] Calls validateEnvironment() in beforeAll
- [ ] Has single test case for submit → stream → verify

**Phase 1 (Submit):**
- [ ] POST to /api/v2/submit with { prompt: "hi cody" }
- [ ] Asserts status 202
- [ ] Asserts runId is valid UUID

**Phase 2 (Stream):**
- [ ] GET /api/v2/stream/:runId
- [ ] Asserts SSE content-type
- [ ] Parses events from data: lines
- [ ] Types events as `StreamEvent[]` (not `any[]`)
- [ ] Uses `ResponseReducer` to hydrate events
- [ ] Has timeout (around 15 seconds)
- [ ] Captures threadId from response_start
- [ ] Collects until response_done
- [ ] Saves hydrated response with comment about Phase 3 comparison
- [ ] Asserts event count > 1 and < 200
- [ ] Asserts first event is response_start with required fields
- [ ] Asserts has item_start with item_type "message"
- [ ] Asserts has item_delta events
- [ ] Asserts has item_done with message content
- [ ] Asserts last event is response_done with status "complete"
- [ ] Asserts all events have envelope fields (event_id, timestamp, run_id, trace_context)

**Phase 3 (Thread validation):**
- [ ] Waits briefly for persistence (around 200ms)
- [ ] GET /api/v2/threads/:threadId
- [ ] Asserts status 200
- [ ] Asserts thread structure (thread object, runs array)
- [ ] Asserts thread.threadId matches
- [ ] Asserts runs.length === 1
- [ ] Asserts run status "complete"
- [ ] Asserts run.error is null
- [ ] Asserts output_items has agent message
- [ ] Asserts usage tokens present and valid

**Phase 3 (Hydrated vs Persisted comparison):**
- [ ] Compares hydrated response to persisted run
- [ ] Asserts matching: id, turn_id, thread_id, model_id, provider_id
- [ ] Asserts matching: status, finish_reason
- [ ] Asserts matching: output_items.length
- [ ] Compares each output item: id, type, content, origin
- [ ] Asserts matching: usage tokens (prompt, completion, total)

**Critical - NO MOCKS:**
- [ ] No mock imports
- [ ] No jest.mock/vi.mock calls
- [ ] No fake data injection
- [ ] All fetches go to real localhost:4010
- [ ] No `any` types (use strong types throughout)

---

## 4. Runtime Verification

With all services running (Redis, Convex, OpenAI accessible, Fastify with `bun run dev`):

### 4.1 Validation Script

```bash
cd cody-fastify
bun run test-suites/tdd-api/validate-env.ts
```

Expected: All 4 checks pass with ✓

### 4.2 Test Suite

```bash
cd cody-fastify
bun run test:tdd-api
```

Verify:
- [ ] Test executes without error
- [ ] Test passes
- [ ] Test completes promptly (doesn't hang)
- [ ] Total time well under 20 seconds

### 4.3 Code Quality

```bash
cd cody-fastify
bun run format --check  # or check if files changed
bun run lint
bun run build
```

All must pass with no errors and no changes needed.

---

## 5. Output Format

Provide your assessment:

```
## Verification Results

### Files
- [x] README.md exists
- [x] validate-env.ts exists
- [x] simple-prompt.test.ts exists
- [x] package.json has test:tdd-api script

### README.md
- [x] All required sections present
- [x] Principles clearly stated

### validate-env.ts
- [x] All 4 checks implemented (Redis, Convex, OpenAI, Fastify)
- [x] Reports all results
- [x] Exits on failure
- [x] No mocks
- [x] No preliminary env var "is set" checks

### simple-prompt.test.ts
- [x] All 3 phases implemented
- [x] Uses ResponseReducer for hydration
- [x] Compares hydrated to persisted
- [x] All assertions present
- [x] No mocks
- [x] No `any` types
- [x] Proper timeout handling

### Runtime
- [x] Validation script passes
- [x] Test passes
- [x] No hang after completion
- [x] Format clean
- [x] Lint clean
- [x] Typecheck clean

## Recommendation

**Recommended** / **Not Recommended**

## Reasoning

(Explain your recommendation)

## Risks (if Not Recommended but approved anyway)

(List risks of proceeding despite issues)
```

---

## 6. Reference

- Specification: `projects/01-api/001-tdd-test-suite/SPEC.md`
- Coder prompt: `projects/01-api/001-tdd-test-suite/CODER-PROMPT.md`
