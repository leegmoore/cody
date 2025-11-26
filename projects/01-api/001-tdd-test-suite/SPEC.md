# Technical Specification: tdd-api Test Suite

**Project:** 001-tdd-test-suite
**Created:** 2025-11-26
**Status:** Draft

---

## 1. Overview

**Purpose:** TDD and integrity testing for full integration of the cody-fastify local development environment.

**Primary Function:** Validate that the complete local dev stack works end-to-end before development work begins. These tests serve as both TDD primitives and system integrity checks.

**Location:**
```
cody-fastify/
  test-suites/
    tdd-api/
      README.md              # Suite documentation
      validate-env.ts        # Environment validation function
      simple-prompt.test.ts  # First test
```

**Script:**
```json
"test:tdd-api": "bun test test-suites/tdd-api/ --timeout 20000"
```

---

## 2. Core Principles

```
NO MOCKS.
NO SHIMS.
NO SPECIAL CONFIG OVERRIDES.
NO TEST INJECTIONS.

Full integration of real infrastructure.
Changes require EXPLICIT user approval after discussion.
```

These tests exercise the complete system:
- Real Redis
- Real Convex
- Real LLM APIs (OpenAI)
- Real HTTP endpoints

---

## 3. Prerequisites

1. Assume Redis configured and running
2. Assume Convex configured and running
3. Assume OpenAI API accessible
4. Assume Fastify Server running on port 4010

**The test suite validates each of these before running.**

---

## 4. Technology Stack

| Component | Version | Notes |
|-----------|---------|-------|
| Bun | 1.3.3 | Runtime and test runner |
| bun:test | built-in | Jest-compatible API |
| ioredis | ^5.8.2 | Redis connectivity check |

**Test timeout:** 20 seconds (runner level)

---

## 5. Environment Validation

### 5.1 Purpose

Before any test runs, validate all infrastructure dependencies are available. If any check fails, continue checking ALL services, report status of each, then exit with code 1.

### 5.2 Checks Performed

| # | Service | Check Method | Success Criteria |
|---|---------|--------------|------------------|
| 1 | Redis | ioredis PING on port 6379 | PONG response |
| 2 | Convex | HTTP GET to CONVEX_URL | Status < 500 |
| 3 | OpenAI | GET /v1/models with API key | Status 200 |
| 4 | Fastify | GET /health on port 4010 | Status 200 |

### 5.3 Implementation: `validate-env.ts`

```typescript
// validate-env.ts

interface EnvCheckResult {
  name: string;
  status: "ok" | "fail";
  message: string;
}

export async function validateEnvironment(): Promise<void> {
  const results: EnvCheckResult[] = [];

  // 1. Check Redis on 6379
  results.push(await checkRedis());

  // 2. Check Convex connectivity
  results.push(await checkConvex());

  // 3. Check OpenAI API connectivity
  results.push(await checkOpenAI());

  // 4. Check Fastify Server on 4010
  results.push(await checkFastifyServer());

  // Report all results
  console.log("\n=== Environment Validation ===\n");
  for (const r of results) {
    const icon = r.status === "ok" ? "✓" : "✗";
    console.log(`${icon} ${r.name}: ${r.message}`);
  }
  console.log("");

  // Exit if any failed
  const failures = results.filter(r => r.status === "fail");
  if (failures.length > 0) {
    console.error(`❌ ${failures.length} environment check(s) failed. Cannot run tests.\n`);
    process.exit(1);
  }

  console.log("✅ All environment checks passed.\n");
}

async function checkRedis(): Promise<EnvCheckResult> {
  try {
    const Redis = (await import("ioredis")).default;
    const redis = new Redis({
      port: 6379,
      lazyConnect: true,
      connectTimeout: 2000
    });
    await redis.connect();
    await redis.ping();
    await redis.quit();
    return { name: "Redis", status: "ok", message: "Running on port 6379" };
  } catch (error) {
    return { name: "Redis", status: "fail", message: "Not reachable on port 6379" };
  }
}

async function checkConvex(): Promise<EnvCheckResult> {
  try {
    const convexUrl = process.env.CONVEX_URL ?? "";
    const healthUrl = convexUrl.replace(/\/$/, "");
    const res = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (res.status < 500) {
      return { name: "Convex", status: "ok", message: `Reachable at ${convexUrl}` };
    }
    return { name: "Convex", status: "fail", message: `Server error: ${res.status}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { name: "Convex", status: "fail", message: `Not reachable: ${msg}` };
  }
}

async function checkOpenAI(): Promise<EnvCheckResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY ?? "";
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 200) {
      return { name: "OpenAI", status: "ok", message: "API reachable, key valid" };
    }
    if (res.status === 401 || res.status === 403) {
      return { name: "OpenAI", status: "fail", message: "API key invalid or missing" };
    }
    return { name: "OpenAI", status: "fail", message: `Unexpected status: ${res.status}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { name: "OpenAI", status: "fail", message: `Not reachable: ${msg}` };
  }
}

async function checkFastifyServer(): Promise<EnvCheckResult> {
  try {
    const res = await fetch("http://localhost:4010/health", {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return { name: "Fastify Server", status: "ok", message: "Running on port 4010" };
    }
    return { name: "Fastify Server", status: "fail", message: `Health check returned ${res.status}` };
  } catch (error) {
    return { name: "Fastify Server", status: "fail", message: "Not running on port 4010" };
  }
}

// Allow running standalone for testing
if (import.meta.main) {
  await validateEnvironment();
}
```

### 5.4 Expected Output

**All passing:**
```
=== Environment Validation ===

✓ Redis: Running on port 6379
✓ Convex: Reachable at https://...
✓ OpenAI: API reachable, key valid
✓ Fastify Server: Running on port 4010

✅ All environment checks passed.
```

**With failures:**
```
=== Environment Validation ===

✓ Redis: Running on port 6379
✗ Convex: Not reachable: fetch failed
✗ OpenAI: API key invalid or missing
✓ Fastify Server: Running on port 4010

❌ 2 environment check(s) failed. Cannot run tests.
```

---

## 6. First Test: `simple-prompt.test.ts`

### 6.1 Test Case

Submit "hi cody", verify streamed response, pull thread, validate persistence.

### 6.2 Test Flow

```
PHASE 1: Submit prompt
  POST /api/v2/submit { prompt: "hi cody" }
  → Assert 202 response with valid UUID runId

PHASE 2: Stream response
  GET /api/v2/stream/:runId (SSE)
  → Collect events until response_done
  → Hydrate events using ResponseReducer
  → Assert event sequence and shapes
  → Save hydrated Response for comparison

PHASE 3: Validate persistence
  Wait 200ms for persistence worker
  GET /api/v2/threads/:threadId
  → Assert thread structure
  → Assert run persisted correctly
  → Assert output items present
  → Compare hydrated Response to persisted run
```

### 6.3 Implementation

```typescript
import { describe, test, expect, beforeAll } from "bun:test";
import { validateEnvironment } from "./validate-env";
import { StreamEvent, Response } from "../../src/core/schema";
import { ResponseReducer } from "../../src/core/reducer";

const BASE_URL = "http://localhost:4010";

describe("tdd-api: simple-prompt", () => {

  beforeAll(async () => {
    await validateEnvironment();
  });

  test("submit prompt, stream response, verify thread persistence", async () => {
    // ========================================
    // PHASE 1: Submit prompt
    // ========================================
    const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hi cody" }),
    });

    // Assert: Submit response
    expect(submitRes.status).toBe(202);
    const submitBody = await submitRes.json() as { runId: string };
    expect(submitBody.runId).toBeDefined();
    expect(typeof submitBody.runId).toBe("string");
    expect(submitBody.runId).toMatch(/^[0-9a-f-]{36}$/); // UUID format

    const runId = submitBody.runId;

    // ========================================
    // PHASE 2: Stream response
    // ========================================
    const events: StreamEvent[] = [];
    let threadId: string | undefined;
    const reducer = new ResponseReducer();

    const streamRes = await fetch(`${BASE_URL}/api/v2/stream/${runId}`);
    expect(streamRes.ok).toBe(true);
    expect(streamRes.headers.get("content-type")).toContain("text/event-stream");

    // Collect events
    const reader = streamRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const streamStart = Date.now();
    const STREAM_TIMEOUT = 15000; // 15 seconds for LLM response

    while (true) {
      if (Date.now() - streamStart > STREAM_TIMEOUT) {
        throw new Error("Stream timeout waiting for response_done");
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const event = JSON.parse(line.slice(6)) as StreamEvent;
          events.push(event);
          reducer.apply(event);

          // Capture threadId from response_start
          if (event.payload?.type === "response_start") {
            threadId = event.payload.thread_id;
          }

          // Stop when response_done received
          if (event.payload?.type === "response_done") {
            await reader.cancel();
            break;
          }
        }
      }

      // Check if we got response_done
      if (events.some(e => e.payload?.type === "response_done")) {
        break;
      }
    }

    // ========================================
    // PHASE 2 ASSERTIONS: Stream events
    // ========================================

    // Assert: Event count in valid range
    expect(events.length).toBeGreaterThan(1);
    expect(events.length).toBeLessThan(200);

    // Assert: First event is response_start
    const firstEvent = events[0];
    expect(firstEvent.payload.type).toBe("response_start");
    expect(firstEvent.payload.response_id).toBeDefined();
    expect(firstEvent.payload.turn_id).toBeDefined();
    expect(firstEvent.payload.thread_id).toBeDefined();
    expect(firstEvent.payload.model_id).toBeDefined();
    expect(firstEvent.payload.provider_id).toBeDefined();
    expect(firstEvent.payload.created_at).toBeDefined();
    expect(typeof firstEvent.payload.created_at).toBe("number");

    // Assert: threadId captured
    expect(threadId).toBeDefined();
    expect(threadId).toMatch(/^[0-9a-f-]{36}$/);

    // Assert: Has item_start for message
    const itemStarts = events.filter(e => e.payload?.type === "item_start");
    expect(itemStarts.length).toBeGreaterThanOrEqual(1);
    const messageStart = itemStarts.find(e => e.payload?.item_type === "message");
    expect(messageStart).toBeDefined();
    expect(messageStart.payload.item_id).toBeDefined();

    // Assert: Has item_delta events (streaming happened)
    const itemDeltas = events.filter(e => e.payload?.type === "item_delta");
    expect(itemDeltas.length).toBeGreaterThanOrEqual(1);

    // Assert: Has item_done with final message
    const itemDones = events.filter(e => e.payload?.type === "item_done");
    expect(itemDones.length).toBeGreaterThanOrEqual(1);
    const messageDone = itemDones.find(e => e.payload?.final_item?.type === "message");
    expect(messageDone).toBeDefined();
    expect(messageDone.payload.final_item.content).toBeDefined();
    expect(typeof messageDone.payload.final_item.content).toBe("string");
    expect(messageDone.payload.final_item.content.length).toBeGreaterThan(0);
    expect(messageDone.payload.final_item.origin).toBe("agent");

    // Assert: Last event is response_done
    const lastEvent = events[events.length - 1];
    expect(lastEvent.payload.type).toBe("response_done");
    expect(lastEvent.payload.status).toBe("complete");
    expect(lastEvent.payload.response_id).toBeDefined();

    // Assert: All events have required envelope fields
    for (const event of events) {
      expect(event.event_id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.run_id).toBe(runId);
      expect(event.trace_context).toBeDefined();
      expect(event.trace_context.traceparent).toBeDefined();
    }

    // Hydrated response - will be compared to persisted object in Phase 3
    const hydratedResponse = reducer.snapshot();
    expect(hydratedResponse).toBeDefined();

    // ========================================
    // PHASE 3: Pull thread and validate persistence
    // ========================================

    // Wait for persistence worker to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    const threadRes = await fetch(`${BASE_URL}/api/v2/threads/${threadId}`);
    expect(threadRes.status).toBe(200);

    const threadBody = await threadRes.json();

    // Assert: Thread structure
    expect(threadBody.thread).toBeDefined();
    expect(threadBody.runs).toBeDefined();
    expect(Array.isArray(threadBody.runs)).toBe(true);

    // Assert: Thread fields
    expect(threadBody.thread.threadId).toBe(threadId);
    expect(threadBody.thread.modelProviderId).toBeDefined();
    expect(threadBody.thread.model).toBeDefined();
    expect(threadBody.thread.createdAt).toBeDefined();
    expect(threadBody.thread.updatedAt).toBeDefined();

    // Assert: Exactly 1 run (we submitted 1 prompt)
    expect(threadBody.runs.length).toBe(1);

    const run = threadBody.runs[0];

    // Assert: Run fields
    expect(run.id).toBeDefined();
    expect(run.turn_id).toBeDefined();
    expect(run.thread_id).toBe(threadId);
    expect(run.model_id).toBeDefined();
    expect(run.provider_id).toBeDefined();
    expect(run.status).toBe("complete");
    expect(run.created_at).toBeDefined();
    expect(run.updated_at).toBeDefined();
    expect(run.finish_reason).toBeDefined();
    expect(run.error).toBeNull();

    // Assert: Output items
    expect(run.output_items).toBeDefined();
    expect(Array.isArray(run.output_items)).toBe(true);
    expect(run.output_items.length).toBeGreaterThanOrEqual(1);

    // Assert: Has at least one message output item
    const messageItems = run.output_items.filter((i: { type: string }) => i.type === "message");
    expect(messageItems.length).toBeGreaterThanOrEqual(1);

    const agentMessage = messageItems.find((i) => i.origin === "agent");
    expect(agentMessage).toBeDefined();
    expect(agentMessage!.content).toBeDefined();
    expect(typeof agentMessage!.content).toBe("string");
    expect(agentMessage!.content.length).toBeGreaterThan(0);
    expect(agentMessage!.id).toBeDefined();

    // Assert: Usage present
    expect(run.usage).toBeDefined();
    expect(run.usage.prompt_tokens).toBeGreaterThan(0);
    expect(run.usage.completion_tokens).toBeGreaterThan(0);
    expect(run.usage.total_tokens).toBeGreaterThan(0);
    expect(run.usage.total_tokens).toBe(run.usage.prompt_tokens + run.usage.completion_tokens);

    // ========================================
    // PHASE 3: Compare hydrated response to persisted run
    // ========================================
    expect(hydratedResponse!.id).toBe(run.id);
    expect(hydratedResponse!.turn_id).toBe(run.turn_id);
    expect(hydratedResponse!.thread_id).toBe(run.thread_id);
    expect(hydratedResponse!.model_id).toBe(run.model_id);
    expect(hydratedResponse!.provider_id).toBe(run.provider_id);
    expect(hydratedResponse!.status).toBe(run.status);
    expect(hydratedResponse!.finish_reason).toBe(run.finish_reason);
    expect(hydratedResponse!.output_items.length).toBe(run.output_items.length);

    // Compare each output item
    for (let i = 0; i < hydratedResponse!.output_items.length; i++) {
      const hydratedItem = hydratedResponse!.output_items[i];
      const persistedItem = run.output_items[i];
      expect(hydratedItem.id).toBe(persistedItem.id);
      expect(hydratedItem.type).toBe(persistedItem.type);
      if (hydratedItem.type === "message" && persistedItem.type === "message") {
        expect(hydratedItem.content).toBe(persistedItem.content);
        expect(hydratedItem.origin).toBe(persistedItem.origin);
      }
    }

    // Compare usage
    expect(hydratedResponse!.usage?.prompt_tokens).toBe(run.usage.prompt_tokens);
    expect(hydratedResponse!.usage?.completion_tokens).toBe(run.usage.completion_tokens);
    expect(hydratedResponse!.usage?.total_tokens).toBe(run.usage.total_tokens);
  });
});
```

---

## 7. Suite README

### 7.1 Content: `test-suites/tdd-api/README.md`

```markdown
# tdd-api Test Suite

## Purpose

TDD and integrity testing for full integration of the cody-fastify
local development environment.

## Principles

**NO MOCKS. NO SHIMS. NO SPECIAL CONFIG OVERRIDES. NO TEST INJECTIONS.**

These tests exercise the complete system with real infrastructure.
Changes to these principles require EXPLICIT user approval after discussion.

## Prerequisites

1. Assume Redis configured and running
2. Assume Convex configured and running
3. Assume OpenAI API accessible
4. Assume Fastify Server running on port 4010

**The test suite validates each of these before running.**

## Running

```bash
# Start server first
bun run dev

# Run tests (separate terminal)
bun run test:tdd-api
```

## Environment Validation

Before tests execute, the suite validates:

| Service | Check | Success |
|---------|-------|---------|
| Redis | PING on port 6379 | PONG response |
| Convex | HTTP GET to CONVEX_URL | Status < 500 |
| OpenAI | GET /v1/models | Status 200 |
| Fastify | GET /health on 4010 | Status 200 |

If any check fails, all checks complete, status is reported, then tests exit.

## Tests

| Test File | Description |
|-----------|-------------|
| simple-prompt.test.ts | Submit "hi cody", verify SSE stream, validate thread persistence |

## Adding Tests

1. Create `<name>.test.ts` in this directory
2. Import `validateEnvironment` and call in `beforeAll`
3. Test real endpoints with real infrastructure
4. Verify protocol/shape, not exact content
5. Update this README with test description
```

---

## 8. Package.json Update

Add to `cody-fastify/package.json` scripts:

```json
"test:tdd-api": "bun test test-suites/tdd-api/ --timeout 20000"
```

---

## 9. Coder Workflow

### Step 1: Setup directory
```bash
mkdir -p cody-fastify/test-suites/tdd-api
```

### Step 2: Write README.md
Write the suite README first to clarify how it should work.

### Step 3: Write `validate-env.ts`
Implement environment validation function.

### Step 4: Test validation script
```bash
cd cody-fastify
bun run test-suites/tdd-api/validate-env.ts
```
Assume all services running. Verify output shows all checks passing.

### Step 5: CHECKPOINT - Verify validation with user
**STOP HERE.** Work with user to:
- Turn off Redis → verify correct failure output
- Use invalid OpenAI key → verify correct failure output
- Turn off Fastify server → verify correct failure output
- Confirm all failures report status for ALL checks, not just first failure

### Step 6: Write `simple-prompt.test.ts`
Once validation confirmed working, implement the test file.

### Step 7: Add script to `package.json`
```json
"test:tdd-api": "bun test test-suites/tdd-api/ --timeout 20000"
```

### Step 8: Run and verify
```bash
bun run test:tdd-api
```
- Test must pass
- Test must NOT hang after completion
- Total time should be well under 20 second timeout

---

## 10. Definition of Done

| # | Criteria | ✓ |
|---|----------|---|
| 1 | `test-suites/tdd-api/` directory created | |
| 2 | `README.md` written | |
| 3 | `validate-env.ts` implemented | |
| 4 | Environment validation tested with user (services on/off) | |
| 5 | `simple-prompt.test.ts` implemented | |
| 6 | `package.json` has `test:tdd-api` script | |
| 7 | `bun run test:tdd-api` executes | |
| 8 | Test completes within 20 second timeout | |
| 9 | Test does NOT hang after pass/fail | |
| 10 | `bun run format` at cody-fastify - no changes | |
| 11 | `bun run lint` at cody-fastify - no errors | |
| 12 | `bun run build` (typecheck) at cody-fastify - no errors | |
| 13 | **Checks 10-12 run sequentially with NO EDITS between runs** | |

**Criterion 13 is critical:** If format changes code, must re-run lint and typecheck. If lint fixes applied, must re-run format and typecheck. Final verification is all three passing with zero modifications.

---

## 11. File Deliverables

| File | Purpose |
|------|---------|
| `test-suites/tdd-api/README.md` | Suite documentation |
| `test-suites/tdd-api/validate-env.ts` | Environment validation |
| `test-suites/tdd-api/simple-prompt.test.ts` | First test |
| `package.json` | Add `test:tdd-api` script |

---

## 12. API Reference

### POST /api/v2/submit

**Request:**
```json
{
  "prompt": "hi cody",
  "model": "gpt-5-mini",      // optional
  "providerId": "openai"       // optional
}
```

**Response (202):**
```json
{
  "runId": "uuid"
}
```

### GET /api/v2/stream/:runId

**Response:** SSE stream

Each event:
```
id: <redis-record-id>
event: <event-type>
data: <StreamEvent JSON>
```

**StreamEvent envelope:**
```json
{
  "event_id": "uuid",
  "timestamp": 1234567890,
  "trace_context": { "traceparent": "..." },
  "run_id": "uuid",
  "type": "response_start|item_start|item_delta|item_done|response_done|...",
  "payload": { ... }
}
```

### GET /api/v2/threads/:id

**Response (200):**
```json
{
  "thread": {
    "threadId": "uuid",
    "title": null,
    "summary": null,
    "tags": [],
    "agentRole": null,
    "modelProviderId": "openai",
    "modelProviderApi": "responses",
    "model": "gpt-5-mini",
    "createdAt": "2025-11-26T...",
    "updatedAt": "2025-11-26T..."
  },
  "runs": [
    {
      "id": "uuid",
      "turn_id": "uuid",
      "thread_id": "uuid",
      "model_id": "gpt-5-mini",
      "provider_id": "openai",
      "created_at": 1234567890,
      "updated_at": 1234567890,
      "status": "complete",
      "output_items": [
        {
          "id": "uuid",
          "type": "message",
          "content": "Hello! I'm doing well...",
          "origin": "agent"
        }
      ],
      "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 25,
        "total_tokens": 35
      },
      "finish_reason": "stop",
      "error": null
    }
  ]
}
```
