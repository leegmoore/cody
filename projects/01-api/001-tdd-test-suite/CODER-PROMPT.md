# Coder Prompt: tdd-api Test Suite

**Project:** 001-tdd-test-suite
**Role:** Implementation Coder
**Altitude:** 500ft (function/module level)

---

## 1. Role

You are implementing the tdd-api test suite for cody-fastify. This is a full integration test suite that validates the local development environment works end-to-end.

**CRITICAL PRINCIPLE:**
```
NO MOCKS. NO SHIMS. NO SPECIAL CONFIG OVERRIDES. NO TEST INJECTIONS.
```

This means:
- DO NOT mock Redis or any infrastructure
- DO NOT create test-specific configuration
- DO NOT inject fake adapters or services
- Tests hit real endpoints with real infrastructure

---

## 2. Application Overview

cody-fastify is a streaming-first LLM harness. The API accepts prompts and streams responses via SSE.

**Key endpoints:**
- `POST /api/v2/submit` - Submit prompt, get runId
- `GET /api/v2/stream/:runId` - SSE stream of events
- `GET /api/v2/threads/:id` - Retrieve thread with runs

**Tech stack:**
- Bun 1.3.3 runtime
- Fastify server on port 4010
- Redis for event streaming

---

## 3. Current State

- Core streaming pipeline works
- API endpoints functional
- No integration test suite exists yet
- Need to establish test infrastructure from scratch

---

## 4. Job Overview

Create the tdd-api test suite with:
1. Directory structure
2. README documenting the suite
3. Environment validation script
4. First integration test (simple prompt)

---

## 5. Directory Structure

**Create:**
```
cody-fastify/
  test-suites/
    tdd-api/
      README.md              # Suite documentation
      validate-env.ts        # Environment validation
      simple-prompt.test.ts  # First test
  package.json               # Add test:tdd-api script
```

**Existing (reference only):**
```
cody-fastify/
  src/
    api/routes/submit.ts     # POST /api/v2/submit
    api/routes/stream.ts     # GET /api/v2/stream/:runId
    api/routes/threads.ts    # GET /api/v2/threads/:id
    core/schema.ts           # StreamEvent, Response schemas
```

---

## 6. Detailed Job Breakdown

### Step 1: Create directory structure

```bash
mkdir -p test-suites/tdd-api
```

### Step 2: Write README.md

Create `test-suites/tdd-api/README.md` with:
- Purpose: TDD and integrity testing for full integration
- Principles: NO MOCKS, NO SHIMS, etc.
- Prerequisites (2 items, all validated by suite)
- Running instructions
- Environment validation table
- Test list (start with simple-prompt.test.ts)
- Instructions for adding tests

See SPEC.md Section 7 for exact content.

### Step 3: Write validate-env.ts

Create `test-suites/tdd-api/validate-env.ts`:

**Requirements:**
- Check 2 services: Redis, Fastify
- If ANY check fails, continue checking ALL services
- Report status of each service with ✓ or ✗
- Exit with code 1 if any failures
- Support standalone execution via `import.meta.main`

**Check implementations:**

1. **Redis (port 6379):**
   - Use ioredis with `lazyConnect: true, connectTimeout: 2000`
   - Call `connect()`, `ping()`, `quit()`
   - Success: PONG response

2. **Fastify Server:**
   - GET `http://localhost:4010/health`
   - 2000ms timeout
   - Success: status 200

**Output format:**
```
=== Environment Validation ===

✓ Redis: Running on port 6379
✓ Fastify Server: Running on port 4010

✅ All environment checks passed.
```

See SPEC.md Section 5.3 for full implementation.

### Step 4: Test validation script

Run standalone:
```bash
cd cody-fastify
bun run test-suites/tdd-api/validate-env.ts
```

Verify all 2 checks pass with services running.

### Step 5: CHECKPOINT - Stop and verify with user

**IMPORTANT: STOP HERE.**

Tell the user:
"Environment validation script is ready. Let's verify it correctly detects failures. Please:
1. Stop Redis and run the script
2. Stop the Fastify server and run the script

For each, confirm the output shows ALL checks (not just first failure) and reports the correct status."

Wait for user confirmation before proceeding.

### Step 6: Write simple-prompt.test.ts

Create `test-suites/tdd-api/simple-prompt.test.ts`:

**Structure:**
```typescript
import { describe, test, expect, beforeAll } from "bun:test";
import { validateEnvironment } from "./validate-env";

const BASE_URL = "http://localhost:4010";

describe("tdd-api: simple-prompt", () => {
  beforeAll(async () => {
    await validateEnvironment();
  });

  test("submit prompt, stream response, verify thread persistence", async () => {
    // PHASE 1: Submit
    // PHASE 2: Stream and collect events
    // PHASE 3: Pull thread and validate
  });
});
```

**PHASE 1 - Submit prompt:**
- POST to `/api/v2/submit` with `{ prompt: "hi cody" }`
- Assert: status 202
- Assert: body has `runId` as valid UUID (matches `/^[0-9a-f-]{36}$/`)

**PHASE 2 - Stream response:**
- GET `/api/v2/stream/:runId`
- Assert: status ok, content-type contains "text/event-stream"
- Parse SSE events manually (data: lines)
- Collect until `response_done` or 15 second timeout
- Capture `threadId` from `response_start` payload

**PHASE 2 Assertions:**
- Event count: > 1 and < 200
- First event: `response_start` with all required fields
- Has `item_start` with `item_type: "message"`
- Has at least one `item_delta`
- Has `item_done` with `final_item.type: "message"`, non-empty content, origin "agent"
- Last event: `response_done` with status "complete"
- All events have: event_id, timestamp, run_id (matches), trace_context.traceparent

**PHASE 3 - Validate persistence:**
- Wait 500ms for persistence worker
- GET `/api/v2/threads/:threadId`
- Assert: status 200

**PHASE 3 Assertions on thread:**
- `thread.threadId` matches captured threadId
- `thread.modelProviderId` defined
- `thread.model` defined
- `thread.createdAt` and `thread.updatedAt` defined

**PHASE 3 Assertions on runs:**
- `runs` is array with length 1
- Run has: id, turn_id, thread_id (matches), model_id, provider_id
- Run status: "complete"
- Run error: null
- Run finish_reason: defined

**PHASE 3 Assertions on output_items:**
- `output_items` is array with length >= 1
- Has message item with origin "agent"
- Agent message has non-empty content string
- Agent message has id

**PHASE 3 Assertions on usage:**
- `usage.prompt_tokens` > 0
- `usage.completion_tokens` > 0
- `usage.total_tokens` > 0
- `total_tokens` equals `prompt_tokens + completion_tokens`

See SPEC.md Section 6.3 for full implementation.

### Step 7: Update package.json

Add to scripts:
```json
"test:tdd-api": "bun test test-suites/tdd-api/ --timeout 20000"
```

### Step 8: Run and verify

```bash
bun run test:tdd-api
```

**Must verify:**
- Test executes
- Test passes
- Test does NOT hang after completion
- Total time well under 20 seconds

---

## 7. Technical Standards

**TypeScript:**
- Use strict types where practical
- Import from "bun:test" for test utilities
- Use async/await consistently

**Error handling:**
- Let test failures propagate naturally
- Use descriptive error messages in manual throws

**SSE parsing:**
- Manual parsing with fetch + getReader()
- Handle buffer correctly for partial lines
- Timeout at 15 seconds for LLM response

**DO NOT:**
- Mock any infrastructure
- Add test-specific configuration
- Create abstractions or helpers beyond validate-env.ts
- Over-engineer - keep it simple and direct

---

## 8. Definition of Done

Run these checks in order. If any fails, fix and restart from beginning.

| # | Check | Command |
|---|-------|---------|
| 1 | Format | `bun run format` - no changes made |
| 2 | Lint | `bun run lint` - no errors |
| 3 | Typecheck | `bun run build` - no errors |
| 4 | Test runs | `bun run test:tdd-api` - passes |
| 5 | No hang | Test completes, doesn't wait for timeout |

**CRITICAL:** Checks 1-3 must pass sequentially with NO EDITS between runs. If format changes files, re-run all. If lint requires fixes, re-run all.

---

## 9. Output Format

When complete, report:

```
## Completed

- [x] Directory created: test-suites/tdd-api/
- [x] README.md written
- [x] validate-env.ts implemented
- [x] Validation tested with user (Step 5 checkpoint)
- [x] simple-prompt.test.ts implemented
- [x] package.json updated with test:tdd-api script

## Definition of Done

- [x] Format: no changes
- [x] Lint: no errors
- [x] Typecheck: no errors
- [x] Test: passes
- [x] No hang: completes promptly

## Issues Encountered

(List any issues and how they were resolved)

## Recommendations

(Any observations for the planner)
```

---

## 10. Reference

Full specification: `projects/01-api/001-tdd-test-suite/SPEC.md`

Key source files:
- `src/api/routes/submit.ts` - Submit endpoint
- `src/api/routes/stream.ts` - SSE streaming
- `src/api/routes/threads.ts` - Thread retrieval
- `src/api/schemas/thread.ts` - Thread/run schemas
- `src/core/schema.ts` - StreamEvent schema
