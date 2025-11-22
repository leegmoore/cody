# Core 2.0 E2E Test Plan (Comprehensive)

**Status:** Authoritative Test Specification for Phase 5
**Scope:** 100% Feature Parity with V1 + Full Coverage of V2 Capabilities.

This document defines the **mandatory** test conditions. The implementer MUST write a Playwright test for every single condition listed below.

---

## 1. Threads (Conversations) Management

### 1.1. Create Threads (`POST /api/v2/threads`)

*   **TC-V2-1.1: Create Thread - Minimal Config**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:**
        ```json
        {
          "model": "codex-test-model",
          "provider": "openai"
        }
        ```
    *   **Expected HTTP Response:** `201 Created`
    *   **Expected Body (Schema & Content):**
        ```json
        {
          "threadId": "UUID",
          "createdAt": "ISOString",
          "updatedAt": "ISOString",
          "model": "codex-test-model",
          "provider": "openai",
          "title": null,
          "summary": null,
          "tags": [],
          "agentRole": null,
          "history": []
        }
        ```
        *   `threadId`: Must be a valid UUID.
        *   `updatedAt`: Must match `createdAt`.

*   **TC-V2-1.2: Create Thread - Full Metadata**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:**
        ```json
        {
          "model": "codex-test-model",
          "provider": "anthropic",
          "title": "My Test Thread",
          "summary": "A summary of the test",
          "tags": ["alpha", "beta"],
          "agentRole": "planner"
        }
        ```
    *   **Expected HTTP Response:** `201 Created`
    *   **Expected Body (Schema & Content):** Matches the submitted payload for `title`, `summary`, `tags`, `agentRole`. `provider` is "anthropic".

*   **TC-V2-1.3: Create Thread - Validation: Missing `model`**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:** `{ "provider": "openai" }`
    *   **Assert:** HTTP `400 Bad Request`. Error message contains `"model"` and `"required"`.

*   **TC-V2-1.4: Create Thread - Validation: Missing `provider`**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:** `{ "model": "codex-test-model" }`
    *   **Assert:** HTTP `400 Bad Request`. Error message contains `"provider"` and `"required"`.

*   **TC-V2-1.5: Create Thread - Validation: Invalid `provider`**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:** `{ "model": "codex-test-model", "provider": "invalid-provider" }`
    *   **Assert:** HTTP `400 Bad Request`. Error message contains `"Unsupported provider"` and lists valid providers (e.g., "openai", "anthropic", "openrouter").

*   **TC-V2-1.6: Create Thread - Validation: Invalid `model` for `provider`**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:** `{ "model": "model-for-anthropic", "provider": "openai" }` (Assume `model-for-anthropic` is only valid for `anthropic`).
    *   **Assert:** HTTP `400 Bad Request`. Error message contains `"model"` and indicates incompatibility.

### 1.2. List Threads (`GET /api/v2/threads`)

*   **TC-V2-2.1: List Threads - Empty State**
    *   **Setup:** Clear the database or create a unique tag not used by other tests.
    *   **Action:** `GET /api/v2/threads`
    *   **Assert:** HTTP `200 OK`. Body: `{ "threads": [], "nextCursor": null }`.

*   **TC-V2-2.2: List Threads - Multiple Threads & Sorting**
    *   **Setup:**
        1.  `POST /api/v2/threads` (Model A, `tags: ["test-list-multiple"]`) -> `threadId_A`.
        2.  `sleep(10ms)`.
        3.  `POST /api/v2/threads` (Model B, `tags: ["test-list-multiple"]`) -> `threadId_B`.
        4.  `sleep(10ms)`.
        5.  `POST /api/v2/threads` (Model C, `tags: ["test-list-multiple"]`) -> `threadId_C`.
    *   **Action:** `GET /api/v2/threads?tag=test-list-multiple`
    *   **Assert:** HTTP `200 OK`. `threads` array contains 3 items.
    *   **Assert:** Threads are sorted by `updatedAt` (or `createdAt`) in descending order (Thread C, Thread B, Thread A).

*   **TC-V2-2.3: List Threads - Pagination with `limit`**
    *   **Setup:** Create 3 threads (A, B, C) as in TC-V2-2.2.
    *   **Action:** `GET /api/v2/threads?tag=test-list-multiple&limit=1`
    *   **Assert:** HTTP `200 OK`. `threads` array contains 1 item (Thread C). `nextCursor` is a non-null string.

*   **TC-V2-2.4: List Threads - Pagination with `cursor`**
    *   **Setup:** (Continues from TC-V2-2.3). Obtain `nextCursor` from the first call.
    *   **Action:** `GET /api/v2/threads?tag=test-list-multiple&limit=1&cursor={nextCursor}`
    *   **Assert:** HTTP `200 OK`. `threads` array contains 1 item (Thread B).
    *   **Assert:** `nextCursor` is a non-null string.

*   **TC-V2-2.5: List Threads - Pagination End**
    *   **Setup:** (Continues from TC-V2-2.4). Obtain `nextCursor` from the second call.
    *   **Action:** `GET /api/v2/threads?tag=test-list-multiple&limit=1&cursor={nextCursor}`
    *   **Assert:** HTTP `200 OK`. `threads` array contains 1 item (Thread A).
    *   **Assert:** `nextCursor` is `null`.

### 1.3. Get Thread (`GET /api/v2/threads/:id`)

*   **TC-V2-3.1: Get Thread - Existing, Empty History**
    *   **Setup:** `POST /api/v2/threads` (Minimal config) -> `threadId`.
    *   **Action:** `GET /api/v2/threads/{threadId}`
    *   **Assert:** HTTP `200 OK`. Body matches thread creation data. `history` array is empty.

*   **TC-V2-3.2: Get Thread - Not Found**
    *   **Action:** `GET /api/v2/threads/non-existent-uuid`
    *   **Assert:** HTTP `404 Not Found`.

*   **TC-V2-3.3: Get Thread - With History**
    *   **Setup:**
        1.  `POST /api/v2/threads` -> `threadId`.
        2.  `POST /api/v2/submit` with `threadId`, `prompt: "Hello"` -> `runId`.
        3.  Wait for run to complete via `GET /api/v2/runs/{runId}`.
    *   **Action:** `GET /api/v2/threads/{threadId}`
    *   **Assert:** HTTP `200 OK`. `history` array contains at least 2 items (`user_message`, `agent_response`).
    *   **Assert:** `history` items are structured according to `Response.output_items` schema (i.e., contain `id`, `type`, `content`, etc.).

### 1.4. Update Threads (`PATCH /api/v2/threads/:id`)

*   **TC-V2-4.1: Update Thread - Title Only**
    *   **Setup:** `POST /api/v2/threads` (Full metadata) -> `threadId`. Note `updatedAt`.
    *   **Action:** `PATCH /api/v2/threads/{threadId}`
    *   **Payload:** `{ "title": "Updated Title" }`
    *   **Assert:** HTTP `200 OK`. `title` is "Updated Title". `updatedAt` is greater than previous `updatedAt`. Other fields unchanged.

*   **TC-V2-4.2: Update Thread - Multiple Fields**
    *   **Setup:** `POST /api/v2/threads` (Minimal) -> `threadId`.
    *   **Action:** `PATCH /api/v2/threads/{threadId}`
    *   **Payload:** `{ "title": "New", "tags": ["tag1"], "agentRole": "debug" }`
    *   **Assert:** HTTP `200 OK`. Response reflects all changes. `updatedAt` increased.

*   **TC-V2-4.3: Update Thread - Model Config Change (Valid)**
    *   **Setup:** `POST /api/v2/threads` (OpenAI).
    *   **Action:** `PATCH /api/v2/threads/{threadId}`
    *   **Payload:** `{ "model": "another-openai-model", "provider": "openai" }` (Valid model within same provider).
    *   **Assert:** HTTP `200 OK`. Response reflects new model config.

*   **TC-V2-4.4: Update Thread - Model Config Change (Invalid Combo)**
    *   **Action:** `PATCH /api/v2/threads/{threadId}`
    *   **Payload:** `{ "model": "some-anthropic-model", "provider": "openai" }` (Invalid model for provider).
    *   **Assert:** HTTP `400 Bad Request`. Error message indicates invalid model/provider combo.

*   **TC-V2-4.5: Update Thread - Immutable Fields (e.g., `threadId`)**
    *   **Action:** `PATCH /api/v2/threads/{threadId}`
    *   **Payload:** `{ "threadId": "new-uuid" }`
    *   **Assert:** HTTP `400 Bad Request`. Error message indicates immutable field.

*   **TC-V2-4.6: Update Thread - Empty Body**
    *   **Action:** `PATCH /api/v2/threads/{threadId}`
    *   **Payload:** `{}`
    *   **Assert:** HTTP `400 Bad Request`.

*   **TC-V2-4.7: Update Thread - Not Found**
    *   **Action:** `PATCH /api/v2/threads/non-existent-uuid`
    *   **Payload:** `{ "title": "New" }`
    *   **Assert:** HTTP `404 Not Found`.

### 1.5. Delete Threads (`DELETE /api/v2/threads/:id`)

*   **TC-V2-5.1: Delete Thread - Existing**
    *   **Setup:** Create Thread A.
    *   **Action:** `DELETE /api/v2/threads/{threadId}`
    *   **Assert:** HTTP `204 No Content`.
    *   **Verify:** `GET /api/v2/threads/{threadId}` returns 404. `GET /api/v2/runs/{runId}` returns 404 for runs associated with this thread. (Requires creating a run and deleting thread).

*   **TC-V2-5.2: Delete Thread - Not Found**
    *   **Action:** `DELETE /api/v2/threads/non-existent-uuid`
    *   **Assert:** HTTP `404 Not Found`.

---

## 2. Submission & Runs (The Engine)

### 2.1. Submission Contract
*   **TC-V2-6.1: Submit Run - Success**
    *   **Action:** `POST /api/v2/submit`
    *   **Payload:** `{ threadId: "{validId}", prompt: "Hello" }`
    *   **Assert:** HTTP `202 Accepted`. Body: `{ runId: "uuid", streamUrl: "..." }`.
*   **TC-V2-6.2: Submit Run - Invalid Thread**
    *   **Action:** `POST /api/v2/submit`
    *   **Payload:** `{ threadId: "invalid-uuid", prompt: "Hello" }`
    *   **Assert:** HTTP 404 (Thread not found).
*   **TC-V2-6.3: Submit Run - Empty Prompt**
    *   **Action:** `POST /api/v2/submit`
    *   **Payload:** `{ threadId: "{validId}", prompt: "" }`
    *   **Assert:** HTTP 400 (Validation error).

### 2.2. Run Status
*   **TC-V2-7.1: Get Run Status - Queued/Running**
    *   **Setup:** Submit a run with a long/slow prompt (or mocked delay).
    *   **Action:** `GET /api/v2/runs/{runId}` immediately.
    *   **Assert:** HTTP 200. `status` is "queued" or "in_progress". `completedAt` is `null`. `outputItems` is empty or partial.
*   **TC-V2-7.2: Get Run Status - Completed (Success)**
    *   **Setup:** Submit run, wait for completion (poll).
    *   **Action:** `GET /api/v2/runs/{runId}`.
    *   **Assert:** HTTP 200. `status` is "complete". `completedAt` is not null. `outputItems` contains all final items. `usage` is populated. `finishReason` is `null` or valid.
*   **TC-V2-7.3: Get Run Status - Completed (Error)**
    *   **Setup:** Submit run that causes `response_error`. Wait for completion.
    *   **Action:** `GET /api/v2/runs/{runId}`.
    *   **Assert:** HTTP 200. `status` is "error". `error` object is present.
*   **TC-V2-7.4: Get Run Status - Not Found**
    *   **Action:** `GET /api/v2/runs/non-existent-uuid`
    *   **Assert:** HTTP `404 Not Found`.

---

## 3. Streaming Mechanics (SSE)

### 3.1. Event Sequence
*   **TC-V2-8.1: Basic Stream - Standard Message Flow**
    *   **Setup:** `POST /api/v2/submit` -> `runId`.
    *   **Action:** `GET /api/v2/stream/{runId}`.
    *   **Assert Stream Sequence & Content:** (From `ResponseSchema`)
        1.  `response_start` (`type`, `response_id`, `thread_id`, `model_id`, `provider_id`)
        2.  `item_start` (`type: "message"`, `item_id`)
        3.  `item_delta` (`delta_content: "..."`)
        4.  `item_done` (`final_item.content: "Full message"`)
        5.  `response_done` (`status: "complete"`, `usage`)
*   **TC-V2-8.2: Trace Context Propagation**
    *   **Assert (from TC-V2-8.1):** Every `StreamEvent` contains `trace_context.traceparent` (valid format).
*   **TC-V2-8.3: No Stream Found**
    *   **Action:** `GET /api/v2/stream/non-existent-uuid`.
    *   **Assert:** HTTP `404 Not Found`.

### 3.2. Stream Reliability
*   **TC-V2-8.4: Reconnection with `Last-Event-ID`**
    *   **Setup:** `POST /api/v2/submit` -> `runId`. Start stream, consume 3 events, save `event_id` of 3rd event.
    *   **Action:** `GET /api/v2/stream/{runId}` with `Last-Event-ID: {saved-event-id}`.
    *   **Assert:** Stream resumes from 4th event. No duplicate events. Stream completes.
*   **TC-V2-8.5: Keep-Alives During Long Gaps**
    *   **Setup:** `POST /api/v2/submit` with a prompt that causes a long delay (e.g., mock a slow tool, or use a model with a slow response).
    *   **Action:** `GET /api/v2/stream/{runId}`.
    *   **Assert:** Receive `: keep-alive` comments within expected intervals (e.g., every 15s).
    *   **Assert:** Stream still completes successfully.
*   **TC-V2-8.6: Error Event in Stream (Tool Failure)**
    *   **Setup:** `POST /api/v2/submit` with prompt "Read missing-file.txt".
    *   **Action:** `GET /api/v2/stream/{runId}`.
    *   **Assert Sequence:**
        1.  `item_start` (`function_call`)
        2.  `item_done` (`final_item.success: false`)
        3.  `response_error` (`error.code`, `error.message`).
    *   **Assert:** Stream ends gracefully.

---

## 4. Lifecycle Flows (Multi-Step Scenarios)

### 4.1. Full Conversation Flow
*   **TC-V2-L1: Basic Full Flow**
    *   **Setup:** `POST /api/v2/threads` -> `threadId`.
    *   **Action:** `POST /api/v2/submit` (`threadId`, `prompt: "Hello"`) -> `runId_1`.
    *   **Action:** `GET /api/v2/stream/{runId_1}`. Assert completion.
    *   **Verify DB:** `GET /api/v2/threads/{threadId}`. Assert `history` contains user prompt and assistant response.

*   **TC-V2-L2: Multi-Turn Conversation**
    *   **Setup:** Complete TC-V2-L1.
    *   **Action:** `POST /api/v2/submit` (`threadId`, `prompt: "Tell me more"`) -> `runId_2`.
    *   **Action:** `GET /api/v2/stream/{runId_2}`. Assert completion.
    *   **Verify DB:** `GET /api/v2/threads/{threadId}`. Assert `history` contains 4 items (user, agent, user, agent). Order is chronological.

### 4.2. Concurrent Isolation
*   **TC-V2-L3: Concurrent Runs Isolation**
    *   **Setup:** `POST /api/v2/threads` -> `threadId_A`. `POST /api/v2/threads` -> `threadId_B`.
    *   **Action:** `POST /api/v2/submit` (`threadId_A`, `prompt: "Count to 100"`) -> `runId_A`.
    *   **Action:** `POST /api/v2/submit` (`threadId_B`, `prompt: "Say hi"`) -> `runId_B`.
    *   **Action:** `GET /api/v2/stream/{runId_A}` and `GET /api/v2/stream/{runId_B}` simultaneously.
    *   **Assert:** Both streams complete successfully. No cross-talk of events or `runId`s.

---

## 5. Tool Execution (The Hands)

### 5.1. Basic Tooling
*   **TC-V2-T1: Tool - `listDir`**
    *   **Action:** Submit "List files in the current directory (`.`)".
    *   **Assert Stream Sequence:** `function_call` (`name: "listDir"`) -> `function_call_output` (`success: true`, `output` contains `package.json`).
*   **TC-V2-T2: Tool - `grepFiles`**
    *   **Action:** Submit "Search for 'scripts' in `package.json`".
    *   **Assert Stream Sequence:** `function_call` (`name: "grepFiles"`) -> `function_call_output` (`success: true`, `output` contains `"scripts":`).
*   **TC-V2-T3: Tool - `fileSearch`**
    *   **Action:** Submit "Find the test plan file".
    *   **Assert Stream Sequence:** `function_call` (`name: "fileSearch"`) -> `function_call_output` (`success: true`, `output` contains `v2-test-plan.md`).

### 5.2. Advanced Tooling
*   **TC-V2-T4: Tool - `applyPatch` (Simple Edit)**
    *   **Setup:** Create a temporary `test_patch.txt` with content "original".
    *   **Action:** Submit "Change 'original' to 'updated' in `test_patch.txt`".
    *   **Assert Stream Sequence:** `function_call` (`name: "applyPatch"`) -> `function_call_output` (`success: true`).
    *   **Verify Filesystem:** Read `test_patch.txt` directly. Assert content is "updated".
*   **TC-V2-T5: Tool - `applyPatch` (Creation)**
    *   **Action:** Submit "Create file 'new.txt' with content 'hello'".
    *   **Assert Stream Sequence:** `function_call` (create file) -> `function_call_output` (`success: true`).
    *   **Verify Filesystem:** Read `new.txt` directly. Assert content is "hello".
*   **TC-V2-T6: Tool - `applyPatch` (Deletion)**
    *   **Setup:** Create `temp_delete.txt`.
    *   **Action:** Submit "Delete file 'temp_delete.txt'".
    *   **Assert Stream Sequence:** `function_call` (delete file) -> `function_call_output` (`success: true`).
    *   **Verify Filesystem:** Assert `temp_delete.txt` does not exist.

### 5.3. Tool Error Handling
*   **TC-V2-T7: Tool Error - Non-existent file**
    *   **Action:** Submit "Read file 'nonexistent.txt'".
    *   **Assert Stream Sequence:** `function_call` (`name: "readFile"`) -> `function_call_output` (`success: false`, `output` contains "ENOENT").
*   **TC-V2-T8: Tool Error - Invalid Arguments**
    *   **Action:** Submit "Grep for nothing". (Assume `grepFiles` requires a pattern).
    *   **Assert Stream Sequence:** `function_call` (`name: "grepFiles"`) -> `function_call_output` (`success: false`, `output` contains "invalid arguments").

---

## 6. Provider & Capability Variety

### 6.1. Basic Adapter Functionality
*   **TC-V2-P1: Provider - Anthropic Messages API**
    *   **Action:** Submit "Hello Anthropic!" with `provider: "anthropic"`, `model: "claude-test-model"`.
    *   **Assert Stream Sequence:** `response_start` (`provider_id: "anthropic"`) -> `item_start` (`message`) -> `response_done`.
*   **TC-V2-P2: Provider - OpenRouter Chat API**
    *   **Action:** Submit "Hello OpenRouter!" with `provider: "openrouter"`, `model: "openrouter-test-model"`.
    *   **Assert Stream Sequence:** `response_start` (`provider_id: "openrouter"`) -> `item_start` (`message`) -> `response_done`.

### 6.2. Thinking/Reasoning Capabilities
*   **TC-V2-P3: OpenAI Reasoning Flow**
    *   **Action:** Submit "Solve complex problem." with `provider: "openai"`, `model: "o1-reasoning-model"`.
    *   **Assert Stream Sequence:** `response_start` -> `item_start` (`type: "reasoning"`) -> `item_delta` (thinking text) -> `item_done` -> `item_start` (`type: "message"`) -> `response_done`.
*   **TC-V2-P4: Anthropic Thinking Flow**
    *   **Action:** Submit "Solve complex problem." with `provider: "anthropic"`, `model: "claude-reasoning-model"`.
    *   **Payload Config:** `config: { thinking: { budget_tokens: 1024 } }`.
    *   **Assert Stream Sequence:** `response_start` -> `item_start` (`type: "reasoning"`) -> `item_delta` (thinking text) -> `item_done` -> `item_start` (`type: "message"`) -> `response_done`.
*   **TC-V2-P5: OpenRouter Thinking Flow**
    *   **Action:** Submit "Solve complex problem." with `provider: "openrouter"`, `model: "openrouter-reasoning-model"`.
    *   **Payload Config:** `config: { thinking: { max_tokens: 500 } }`.
    *   **Assert Stream Sequence:** `response_start` -> `item_start` (`type: "reasoning"`) -> `item_delta` (thinking text) -> `item_done` -> `item_start` (`type: "message"`) -> `response_done`.

### 6.3. Provider-Specific Invalid Config
*   **TC-V2-P6: Invalid Config - OpenAI (no budget_tokens)**
    *   **Action:** `POST /api/v2/submit` with `provider: "openai"`, `config: { budget_tokens: 100 }`.
    *   **Assert:** HTTP `400 Bad Request`. Error indicates unknown config field.

---

## 7. Persistence Verification

*   **TC-V2-12.1: Convex Hydration - Full Flow**
    *   **Setup:** Complete a full flow with Tools and Thinking (e.g., submit prompt for TC-V2-T1). Wait for `response_done`.
    *   **Action:** `GET /api/v2/threads/{threadId}`.
    *   **Assert:** HTTP `200 OK`. The `history` array in the response matches the event stream.
        *   `history[0]`: User message.
        *   `history[1]`: Reasoning (if applicable).
        *   `history[2]`: Tool Call.
        *   `history[3]`: Tool Output.
        *   `history[4]`: Assistant Message.
    *   **Assert:** All fields in the `history` items conform to `OutputItem` schema.

*   **TC-V2-12.2: Convex Hydration - Error State**
    *   **Setup:** Complete a flow that results in a `response_error` (e.g., TC-V2-8.6).
    *   **Action:** `GET /api/v2/runs/{runId}`.
    *   **Assert:** `status` is "error". `error` object is populated.
    *   **Verify DB:** `GET /api/v2/threads/{threadId}`. `history` should reflect the error message.
