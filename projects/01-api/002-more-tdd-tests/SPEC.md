# Technical Specification: Tool Call Integration Test

**Project:** 002-more-tdd-tests
**Created:** 2025-11-26
**Status:** Draft

---

## 1. Overview

**Purpose:** Add a tool call integration test to the existing tdd-api test suite, validating the complete tool execution flow.

**Primary Function:** Submit a prompt that triggers multiple tool calls, verify streaming events include tool calls and outputs, validate persistence matches hydrated response.

**Location:**
```
cody-fastify/
  test-suites/
    tdd-api/
      README.md                 # Suite documentation (update)
      validate-env.ts           # Environment validation (no change)
      openai-prompts.test.ts    # Renamed from simple-prompt.test.ts
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

*Already in place from 001-tdd-test-suite:*

1. Redis configured and running
2. Convex configured and running
3. OpenAI API accessible
4. Fastify Server running on port 4010

**The test suite validates each of these before running via `validate-env.ts`.**

---

## 4. Technology Stack

| Component | Version | Notes |
|-----------|---------|-------|
| Bun | 1.3.3 | Runtime and test runner |
| bun:test | built-in | Jest-compatible API |
| ioredis | ^5.8.2 | Redis connectivity check |

**Test timeout:** 20 seconds (runner level)

---

## 5. Test Structure

### 5.1 File Rename

Rename `simple-prompt.test.ts` → `openai-prompts.test.ts`

### 5.2 Test Execution Order

```
beforeAll: validateEnvironment()
    ↓
test: "simple prompt" ──────────────┐
                                    ├── run in PARALLEL
test: "tool calls" ─────────────────┘
```

Both tests are multi-stage internally (submit → stream → persist → verify), but the two tests run concurrently with each other.

---

## 6. New Test: Tool Calls

### 6.1 Test Case

Submit a prompt requesting 2 shell tool calls (pwd and ls), verify tool call streaming, validate tool outputs, compare hydrated response to persisted.

### 6.2 Prompt

```
"please run a shell pwd in 1 tool call and a shell ls in another tool call then in your next response to me tell me what the working directory is and the first 10 files and directories in that working directory"
```

### 6.3 Test Flow

```
PHASE 1: Submit prompt
  POST /api/v2/submit { prompt: "<tool call prompt>" }
  → Assert 202 response with valid UUID runId

PHASE 2: Stream response
  GET /api/v2/stream/:runId (SSE)
  → Collect events until response_done
  → Hydrate events using ResponseReducer
  → Assert event sequence and shapes
  → Save hydrated Response for comparison

PHASE 2 ASSERTIONS - Tool Call Specific:
  → Assert item_start events with item_type: "function_call" - count >= 2
  → Assert item_done events with final_item.type: "function_call" - count >= 2
  → Assert item_done events with final_item.type: "function_call_output" - count >= 2
  → Assert each function_call has name, call_id populated
  → Assert final message exists (model's summary response)

PHASE 3: Validate persistence
  Poll GET /api/v2/threads/:threadId until run status is terminal
  → Assert thread structure
  → Assert run persisted correctly
  → Assert output_items contains >= 2 function_call items
  → Assert output_items contains >= 2 function_call_output items
  → Assert each function_call has matching function_call_output (by call_id)
  → Compare hydrated Response to persisted run
  → Compare tool call items match (type, id, call_id, name)
```

### 6.4 Assertions Summary

**Streaming Phase:**
| Assertion | Criteria |
|-----------|----------|
| function_call item_start | count >= 2 |
| function_call item_done | count >= 2 |
| function_call_output item_done | count >= 2 |
| function_call has name | all function_calls |
| function_call has call_id | all function_calls |
| final message exists | exactly 1 agent message at end |

**Persistence Phase:**
| Assertion | Criteria |
|-----------|----------|
| output_items function_call | count >= 2 |
| output_items function_call_output | count >= 2 |
| call_id matching | each function_call has matching output |

### 6.5 Hydrated vs Persisted Comparison (Detailed)

Compare field-by-field, excluding timestamp fields (created_at, updated_at).

**Response-level fields:**
- id, turn_id, thread_id, model_id, provider_id, status, finish_reason
- output_items.length

**For each output_item, compare by type:**

| Type | Fields to Compare |
|------|-------------------|
| All types | id, type |
| message | content, origin |
| function_call | name, arguments, call_id, origin |
| function_call_output | call_id, output, success, origin |

**Usage sub-object:**
- prompt_tokens, completion_tokens, total_tokens

**call_id Matching:**
Verify each function_call has a corresponding function_call_output with matching call_id and success: true.

---

## 7. Coder Workflow

### Step 1: Ensure package.json has typecheck script
If not present, add:
```json
"typecheck": "tsc --noEmit"
```

### Step 2: Rename test file
```bash
mv test-suites/tdd-api/simple-prompt.test.ts test-suites/tdd-api/openai-prompts.test.ts
```

### Step 3: Update describe block
Change describe name from `"tdd-api: simple-prompt"` to `"tdd-api: openai-prompts"`.

### Step 4: Add tool call test
Add new test in `openai-prompts.test.ts` that runs parallel with existing test:

```typescript
test("tool calls: pwd and ls", async () => {
  // PHASE 1: Submit prompt
  // PHASE 2: Stream response with tool call assertions
  // PHASE 3: Validate persistence with tool call matching
});
```

The new test follows the same structure as the simple prompt test but adds tool-call-specific assertions.

### Step 5: Update README.md
Update test table to reflect:
- File rename
- New test case

### Step 6: Run and verify
- Both tests must pass
- Tests must NOT hang after completion
- Total time should be under 20 second timeout

---

## 8. Definition of Done

| # | Criteria | |
|---|----------|---|
| 1 | README.md updated with new test | |
| 2 | `simple-prompt.test.ts` renamed to `openai-prompts.test.ts` | |
| 3 | package.json has `typecheck` script | |
| 4 | `bun run test:tdd-api` executes | |
| 5 | Both tests pass | |
| 6 | Tests complete within 20 second timeout | |
| 7 | Tests do NOT hang after pass/fail | |
| 8 | `bun run format` - no changes | |
| 9 | `bun run lint` - no errors | |
| 10 | `bun run typecheck` - no errors | |
| 11 | **Checks 8-10 run sequentially with NO changes or errors between runs** | |

**Criterion 11 is critical:** Run format, lint, typecheck in order. If any produces changes or errors, fix and re-run ALL from the beginning. Final verification is all three passing sequentially with zero modifications.

---

## 9. File Deliverables

| File | Action |
|------|--------|
| `test-suites/tdd-api/README.md` | Update |
| `test-suites/tdd-api/simple-prompt.test.ts` | Rename to `openai-prompts.test.ts` |
| `test-suites/tdd-api/openai-prompts.test.ts` | Add tool call test |
| `package.json` | Add `typecheck` script if not present |

---

## 10. API Reference

### Tool Call Scenario

**Request:**
```json
{
  "prompt": "please run a shell pwd in 1 tool call and a shell ls in another tool call then in your next response to me tell me what the working directory is and the first 10 files and directories in that working directory"
}
```

**Expected Stream Events (tool call specific):**

```
item_start (item_type: "function_call", name: "shell")
item_delta (arguments streaming)
item_done (final_item: { type: "function_call", name: "shell", call_id: "...", arguments: "{\"command\":\"pwd\"}" })

item_start (item_type: "function_call", name: "shell")
item_delta (arguments streaming)
item_done (final_item: { type: "function_call", name: "shell", call_id: "...", arguments: "{\"command\":\"ls\"}" })

item_start (item_type: "function_call_output")
item_done (final_item: { type: "function_call_output", call_id: "...", output: "/path/to/dir", success: true })

item_start (item_type: "function_call_output")
item_done (final_item: { type: "function_call_output", call_id: "...", output: "file1\nfile2\n...", success: true })

item_start (item_type: "message")
item_delta (content streaming)
item_done (final_item: { type: "message", content: "The working directory is...", origin: "agent" })

response_done
```

**Persisted Run output_items:**
```json
{
  "output_items": [
    { "type": "function_call", "name": "shell", "call_id": "call_1", "arguments": "{\"command\":\"pwd\"}" },
    { "type": "function_call", "name": "shell", "call_id": "call_2", "arguments": "{\"command\":\"ls\"}" },
    { "type": "function_call_output", "call_id": "call_1", "output": "/path/to/dir", "success": true },
    { "type": "function_call_output", "call_id": "call_2", "output": "file1\nfile2\n...", "success": true },
    { "type": "message", "content": "The working directory is...", "origin": "agent" }
  ]
}
```
