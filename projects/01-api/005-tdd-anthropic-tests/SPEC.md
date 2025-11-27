# Technical Specification: Anthropic Test Suite

**Project:** 005-anthropic-tests
**Created:** 2025-11-26
**Status:** Draft

---

## 1. Overview

**Purpose:** Add Anthropic API connectivity check and create a parallel test suite for Anthropic provider, validating simple prompts and tool calls.

**Primary Function:**
1. Add Anthropic API check to `validate-env.ts` (5th check)
2. Verify existing OpenAI tests still pass with new env check
3. Create `anthropic-prompts.test.ts` with simple prompt and tool call tests

**Location:**
```
cody-fastify/
  test-suites/
    tdd-api/
      validate-env.ts              # Add Anthropic check (5th)
      README.md                    # Update documentation
      openai-prompts.test.ts       # Existing (no changes)
      anthropic-prompts.test.ts    # NEW - Anthropic tests
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
- Real LLM APIs (OpenAI AND Anthropic)
- Real HTTP endpoints

---

## 3. Prerequisites

*Already in place:*

1. Redis configured and running
2. Convex configured and running
3. OpenAI API accessible
4. Fastify Server running on port 4010
5. `openai-prompts.test.ts` with 4 tests (simple-prompt, tool-calls, multi-turn, reasoning)
6. `ANTHROPIC_API_KEY` environment variable set

---

## 4. Technology Stack

| Component | Version | Notes |
|-----------|---------|-------|
| Bun | 1.3.3 | Runtime and test runner |
| bun:test | built-in | Jest-compatible API |
| ioredis | ^5.8.2 | Redis connectivity check |

**Test timeout:** 20 seconds (runner level)

**Anthropic Models Allowed:**
- `claude-haiku-4-5` (recommended for tests - faster/cheaper)
- `claude-sonnet-4-5`

---

## 5. Phased Implementation

### PHASE 1: Add Anthropic Environment Check

**Objective:** Add a 5th connectivity check to `validate-env.ts` for Anthropic API.

**Implementation:**

Add `checkAnthropic()` function following the existing pattern:

```typescript
async function checkAnthropic(): Promise<EnvCheckResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    const res = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 200) {
      return {
        name: "Anthropic",
        status: "ok",
        message: "API reachable, key valid",
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        name: "Anthropic",
        status: "fail",
        message: "API key invalid or missing",
      };
    }
    return {
      name: "Anthropic",
      status: "fail",
      message: `Unexpected status: ${res.status}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      name: "Anthropic",
      status: "fail",
      message: `Not reachable: ${msg}`,
    };
  }
}
```

Add to `validateEnvironment()`:
```typescript
// 5. Check Anthropic API connectivity
results.push(await checkAnthropic());
```

---

### GATE 1: Verify OpenAI Tests Still Pass

**STOP. Do not proceed to Phase 2 until this gate passes.**

After adding the Anthropic check to `validate-env.ts`:

```bash
cd cody-fastify && bun run test:tdd-api
```

**Required outcomes:**
- [ ] Environment validation shows 5 checks (Redis, Convex, OpenAI, Fastify, Anthropic)
- [ ] All 5 environment checks pass
- [ ] All 4 OpenAI tests pass (simple-prompt, tool-calls, multi-turn, reasoning)
- [ ] No regressions introduced

**If this gate fails:**
- Fix the issue before proceeding
- Do NOT proceed to Phase 2

---

### PHASE 2: Create Anthropic Test File

**Objective:** Create `anthropic-prompts.test.ts` with 2 tests that mirror the OpenAI tests.

**File structure:**
```typescript
import { describe, test, expect, beforeAll } from "bun:test";
import { validateEnvironment } from "./validate-env";
import { StreamEvent } from "../../src/core/schema";
import { ResponseReducer } from "../../src/core/reducer";

const BASE_URL = "http://localhost:4010";

describe("tdd-api: anthropic-prompts", () => {
  beforeAll(async () => {
    await validateEnvironment();
  });

  test.concurrent("simple prompt", async () => {
    // Test implementation
  });

  test.concurrent("tool calls: pwd and ls", async () => {
    // Test implementation
  });
});
```

---

## 6. Test Specifications

### 6.1 Test 1: Simple Prompt

**Request:**
```json
{
  "prompt": "hi cody",
  "providerId": "anthropic",
  "model": "claude-haiku-4-5"
}
```

**Assertions - Streaming:**
| Assertion | Criteria |
|-----------|----------|
| Submit response | 202 status |
| runId | Valid UUID |
| response_start | Event received |
| response_start.provider_id | "anthropic" |
| response_start.model_id | "claude-haiku-4-5" |
| item_start (message) | At least 1 |
| item_done (message) | At least 1 |
| response_done | Event received, status "complete" |

**Assertions - Persistence:**
| Assertion | Criteria |
|-----------|----------|
| Thread exists | Valid threadId |
| Run count | 1 |
| Run status | "complete" |
| provider_id | "anthropic" |
| model_id | "claude-haiku-4-5" |
| output_items | At least 1 message |

**Hydrated vs Persisted Comparison:**

Same as OpenAI tests - compare Response-level fields, OutputItem fields (message: id, type, content, origin), Usage fields. Exclude timestamps.

---

### 6.2 Test 2: Tool Calls (pwd and ls)

**Request:**
```json
{
  "prompt": "please run a shell pwd in 1 tool call and a shell ls in another tool call then in your next response to me tell me what the working directory is and the first 10 files and directories in that working directory",
  "providerId": "anthropic",
  "model": "claude-haiku-4-5"
}
```

**Assertions - Streaming:**
| Assertion | Criteria |
|-----------|----------|
| Submit response | 202 status |
| runId | Valid UUID |
| response_start | Event received |
| response_start.provider_id | "anthropic" |
| item_start (function_call) | count >= 2 |
| item_done (function_call) | count >= 2 |
| item_done (function_call_output) | count >= 2 |
| item_done (message) | At least 1 (final response) |
| response_done | Event received, status "complete" |

**Assertions - Persistence:**
| Assertion | Criteria |
|-----------|----------|
| Thread exists | Valid threadId |
| Run count | 1 |
| Run status | "complete" |
| provider_id | "anthropic" |
| output_items function_call | count >= 2 |
| output_items function_call_output | count >= 2 |
| call_id matching | Each function_call has matching output |

**Hydrated vs Persisted Comparison:**

Compare all fields by type:
- Response-level: id, turn_id, thread_id, model_id, provider_id, status, finish_reason, output_items.length
- message items: id, type, content, origin
- function_call items: id, type, name, arguments, call_id, origin
- function_call_output items: id, type, call_id, output, success, origin
- Usage: prompt_tokens, completion_tokens, total_tokens
- Exclude: created_at, updated_at

---

## 7. Hydrated vs Persisted Comparison (Detailed)

For both tests, compare field-by-field. Exclude timestamps.

**Response-level fields:**
```typescript
expect(hydratedResponse.id).toBe(persistedRun.id);
expect(hydratedResponse.turn_id).toBe(persistedRun.turn_id);
expect(hydratedResponse.thread_id).toBe(persistedRun.thread_id);
expect(hydratedResponse.model_id).toBe(persistedRun.model_id);
expect(hydratedResponse.provider_id).toBe(persistedRun.provider_id);
expect(hydratedResponse.status).toBe(persistedRun.status);
expect(hydratedResponse.finish_reason).toBe(persistedRun.finish_reason);
expect(hydratedResponse.output_items.length).toBe(persistedRun.output_items.length);
```

**For each output_item by type:**
```typescript
for (let i = 0; i < hydratedResponse.output_items.length; i++) {
  const hydratedItem = hydratedResponse.output_items[i];
  const persistedItem = persistedRun.output_items[i];

  expect(hydratedItem.id).toBe(persistedItem.id);
  expect(hydratedItem.type).toBe(persistedItem.type);

  if (hydratedItem.type === "message") {
    expect(hydratedItem.content).toBe(persistedItem.content);
    expect(hydratedItem.origin).toBe(persistedItem.origin);
  }

  if (hydratedItem.type === "function_call") {
    expect(hydratedItem.name).toBe(persistedItem.name);
    expect(hydratedItem.arguments).toBe(persistedItem.arguments);
    expect(hydratedItem.call_id).toBe(persistedItem.call_id);
    expect(hydratedItem.origin).toBe(persistedItem.origin);
  }

  if (hydratedItem.type === "function_call_output") {
    expect(hydratedItem.call_id).toBe(persistedItem.call_id);
    expect(hydratedItem.output).toBe(persistedItem.output);
    expect(hydratedItem.success).toBe(persistedItem.success);
    expect(hydratedItem.origin).toBe(persistedItem.origin);
  }
}
```

**Usage sub-object:**
```typescript
expect(hydratedResponse.usage?.prompt_tokens).toBe(persistedRun.usage.prompt_tokens);
expect(hydratedResponse.usage?.completion_tokens).toBe(persistedRun.usage.completion_tokens);
expect(hydratedResponse.usage?.total_tokens).toBe(persistedRun.usage.total_tokens);
```

---

## 8. Coder Workflow

### Step 1: Add Anthropic check to validate-env.ts

- Add `checkAnthropic()` function
- Add call in `validateEnvironment()` as 5th check
- Use endpoint: `https://api.anthropic.com/v1/models`
- Use headers: `x-api-key`, `anthropic-version: 2023-06-01`

### GATE 1: Run existing tests

```bash
cd cody-fastify && bun run test:tdd-api
```

**STOP if any of these fail:**
- All 5 environment checks pass
- All 4 OpenAI tests pass

**If gate passes, proceed to Step 2.**

### Step 2: Create anthropic-prompts.test.ts

- Create new file following openai-prompts.test.ts pattern
- Add simple prompt test with `providerId: "anthropic"`, `model: "claude-haiku-4-5"`
- Add tool calls test with same provider/model
- Include full hydrated vs persisted comparison for both tests

### Step 3: Update README.md

Add Anthropic test file and tests to documentation.

### Step 4: Run full test suite

```bash
cd cody-fastify && bun run test:tdd-api
```

- All 5 environment checks pass
- All 4 OpenAI tests pass
- Both Anthropic tests pass
- Tests complete within timeout
- Tests do NOT hang

---

## 9. Definition of Done

| # | Criteria | |
|---|----------|---|
| 1 | `checkAnthropic()` added to `validate-env.ts` | |
| 2 | Environment validation shows 5 checks | |
| 3 | **GATE 1 PASSED: All 4 OpenAI tests pass after env change** | |
| 4 | `anthropic-prompts.test.ts` created | |
| 5 | Simple prompt test implemented with hydrated vs persisted comparison | |
| 6 | Tool calls test implemented with hydrated vs persisted comparison | |
| 7 | Both Anthropic tests verify `provider_id: "anthropic"` | |
| 8 | Both Anthropic tests verify `model_id: "claude-haiku-4-5"` | |
| 9 | README.md updated | |
| 10 | `bun run test:tdd-api` executes | |
| 11 | All 6 tests pass (4 OpenAI + 2 Anthropic) | |
| 12 | Tests complete within 20 second timeout | |
| 13 | Tests do NOT hang after pass/fail | |
| 14 | `bun run format` - no changes | |
| 15 | `bun run lint` - no errors | |
| 16 | `bun run typecheck` - no errors | |
| 17 | **Checks 14-16 run sequentially with NO changes or errors between runs** | |

---

## 10. File Deliverables

| File | Action |
|------|--------|
| `test-suites/tdd-api/validate-env.ts` | Add `checkAnthropic()` |
| `test-suites/tdd-api/anthropic-prompts.test.ts` | NEW - 2 tests |
| `test-suites/tdd-api/README.md` | Update with Anthropic tests |

---

## 11. API Reference

### Simple Prompt Request (Anthropic)

```json
{
  "prompt": "hi cody",
  "providerId": "anthropic",
  "model": "claude-haiku-4-5"
}
```

### Tool Calls Request (Anthropic)

```json
{
  "prompt": "please run a shell pwd in 1 tool call and a shell ls in another tool call then in your next response to me tell me what the working directory is and the first 10 files and directories in that working directory",
  "providerId": "anthropic",
  "model": "claude-haiku-4-5"
}
```

### Anthropic API Check

```bash
curl https://api.anthropic.com/v1/models \
  --header "x-api-key: $ANTHROPIC_API_KEY" \
  --header "anthropic-version: 2023-06-01"
```

**Expected:** 200 OK with list of models

---

## 12. Key Differences from OpenAI Tests

| Aspect | OpenAI | Anthropic |
|--------|--------|-----------|
| Request field | (default) | `providerId: "anthropic"` |
| Model | gpt-5-mini | claude-haiku-4-5 |
| API check endpoint | /v1/models | /v1/models |
| Auth header | Authorization: Bearer | x-api-key |
| Version header | (none) | anthropic-version: 2023-06-01 |

The test structure, assertions, and hydrated vs persisted comparisons are identical - only the provider/model and expected provider_id/model_id values change.

---

## 13. Scope Limitations

**In scope:**
- Anthropic environment check
- Simple prompt test
- Tool calls test

**Out of scope (future work):**
- Multi-turn conversation test for Anthropic
- Reasoning/thinking test for Anthropic
- Other Anthropic models (claude-sonnet-4-5)
