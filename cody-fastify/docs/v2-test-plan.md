# Core 2.0 E2E Test Plan (Comprehensive)

**Status:** Authoritative Test Specification for Phase 5
**Scope:** 100% Feature Parity with V1 + Full Coverage of V2 Capabilities.

This document defines the **mandatory** test conditions. The implementer MUST write a Playwright test for every single condition listed below.

---

## 1. Threads (Conversations) CRUD

### 1.1. Creation & Validation
*   **TC-V2-1.1: Create Thread - Minimal Payload**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:** `{ model: "gpt-4o", provider: "openai" }`
    *   **Assert:** HTTP 201. Body contains `threadId` (UUID), `createdAt` (ISO string).
*   **TC-V2-1.2: Create Thread - Full Metadata**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:** `{ model: "gpt-4o", provider: "openai", title: "My Thread", tags: ["test", "v2"] }`
    *   **Assert:** HTTP 201. Body matches payload.
*   **TC-V2-1.3: Validation - Missing Model**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:** `{ provider: "openai" }`
    *   **Assert:** HTTP 400. Error message contains "model".
*   **TC-V2-1.4: Validation - Missing Provider**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:** `{ model: "gpt-4o" }`
    *   **Assert:** HTTP 400. Error message contains "provider".
*   **TC-V2-1.5: Validation - Invalid Provider**
    *   **Action:** `POST /api/v2/threads`
    *   **Payload:** `{ model: "gpt-4o", provider: "invalid-provider" }`
    *   **Assert:** HTTP 400. Error message lists supported providers.

### 1.2. Retrieval & Listing
*   **TC-V2-2.1: List Threads - Empty State**
    *   **Setup:** Ensure DB is empty (or filter by unique tag).
    *   **Action:** `GET /api/v2/threads`
    *   **Assert:** HTTP 200. Body: `{ threads: [], nextCursor: null }`.
*   **TC-V2-2.2: List Threads - Sorting**
    *   **Setup:** Create Thread A, sleep 1s, Create Thread B.
    *   **Action:** `GET /api/v2/threads`
    *   **Assert:** HTTP 200. Order is [Thread B, Thread A] (Newest first).
*   **TC-V2-2.3: List Threads - Pagination**
    *   **Setup:** Create 3 threads.
    *   **Action:** `GET /api/v2/threads?limit=1`
    *   **Assert:** Returns 1 thread. Returns `nextCursor`.
    *   **Action:** `GET /api/v2/threads?limit=1&cursor={nextCursor}`
    *   **Assert:** Returns next thread.
*   **TC-V2-3.1: Get Thread - Exists**
    *   **Setup:** Create Thread A.
    *   **Action:** `GET /api/v2/threads/{threadId}`
    *   **Assert:** HTTP 200. Returns full thread object with `history` array (initially empty).
*   **TC-V2-3.2: Get Thread - Not Found**
    *   **Action:** `GET /api/v2/threads/non-existent-uuid`
    *   **Assert:** HTTP 404.

### 1.3. Updates & Deletion
*   **TC-V2-4.1: Update Thread - Title/Tags**
    *   **Setup:** Create Thread A.
    *   **Action:** `PATCH /api/v2/threads/{threadId}`
    *   **Payload:** `{ title: "Updated", tags: ["new"] }`
    *   **Assert:** HTTP 200. Response reflects changes. `updatedAt` increased.
*   **TC-V2-4.2: Update Thread - Immutable Fields**
    *   **Action:** `PATCH /api/v2/threads/{threadId}`
    *   **Payload:** `{ id: "different-id" }`
    *   **Assert:** HTTP 400 (Validation error on unknown/immutable field).
*   **TC-V2-5.1: Delete Thread**
    *   **Setup:** Create Thread A.
    *   **Action:** `DELETE /api/v2/threads/{threadId}`
    *   **Assert:** HTTP 204.
    *   **Verify:** `GET /api/v2/threads/{threadId}` returns 404.

---

## 2. Submission & Runs (The Engine)

### 2.1. Submission Contract
*   **TC-V2-6.1: Submit Run - Success**
    *   **Action:** `POST /api/v2/submit`
    *   **Payload:** `{ threadId: "{validId}", prompt: "Hello" }`
    *   **Assert:** HTTP 202 Accepted. Body: `{ runId: "uuid", streamUrl: "..." }`.
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
    *   **Assert:** HTTP 200. `status` is "queued" or "in_progress".
*   **TC-V2-7.2: Get Run Status - Completed**
    *   **Setup:** Submit run, wait for completion (poll).
    *   **Action:** `GET /api/v2/runs/{runId}`
    *   **Assert:** HTTP 200. `status` is "complete". `usage` field is populated (token counts).

---

## 3. Streaming Mechanics (SSE)

### 3.1. Event Sequence
*   **TC-V2-8.1: Standard Message Flow**
    *   **Action:** Submit "Say hello". Connect to Stream.
    *   **Assert Sequence:**
        1.  `response_start` (contains `runId`, `model`)
        2.  `item_start` (`type: "message"`)
        3.  `item_delta` (content: "Hel")
        4.  `item_delta` (content: "lo")
        5.  `item_done` (`final_item` contains full "Hello")
        6.  `response_done` (`status: "complete"`)
*   **TC-V2-8.2: Trace Context Propagation**
    *   **Assert:** Every event in TC-V2-8.1 contains a `trace_context` object.
    *   **Assert:** `trace_context.traceparent` is present and valid.

### 3.2. Reliability
*   **TC-V2-8.3: Reconnection (Last-Event-ID)**
    *   **Setup:** Submit run. Read first 3 events. Disconnect.
    *   **Action:** Reconnect using `Last-Event-ID: {id-of-event-3}` header.
    *   **Assert:** Stream resumes at Event 4. No duplicates. Stream completes successfully.
*   **TC-V2-8.4: Keep-Alive**
    *   **Setup:** Force a delay in the stream (mock or slow tool).
    *   **Assert:** Receive comment `: keep-alive` within 15-30s of idle time.

---

## 4. Tool Execution (The Hands)

### 4.1. File Operations
*   **TC-V2-9.1: Tool - listDir**
    *   **Action:** Submit "List files in the current directory".
    *   **Stream Assert:**
        1.  `item_start` (`type: "function_call", name: "listDir"`)
        2.  `item_done` (`type: "function_call"`)
        3.  `item_start` (`type: "function_call_output"`)
        4.  `item_done` (`type: "function_call_output"`) -> `final_item.output` contains "package.json".
*   **TC-V2-9.2: Tool - grepFiles**
    *   **Action:** Submit "Search for 'dependencies' in package.json".
    *   **Stream Assert:** `function_call` (grepFiles) -> `function_call_output` (success: true, content matches).
*   **TC-V2-9.3: Tool - fileSearch (Fuzzy)**
    *   **Action:** Submit "Find the readme file".
    *   **Stream Assert:** `function_call` (fileSearch) -> `function_call_output` (returns "README.md").

### 4.2. Editing
*   **TC-V2-9.4: Tool - applyPatch**
    *   **Action:** Submit "Create 'test.txt' with 'foo', then change 'foo' to 'bar' using patch."
    *   **Stream Assert:**
        1.  `function_call` (write) -> `output` (success)
        2.  `function_call` (applyPatch) -> `output` (success)
        3.  `function_call` (read) -> `output` ("bar")

### 4.3. Error Handling
*   **TC-V2-9.5: Tool Failure (Graceful)**
    *   **Action:** Submit "Read file 'ghost.txt'".
    *   **Stream Assert:**
        1.  `item_start` (`function_call`)
        2.  `item_start` (`function_call_output`)
        3.  `item_done` (`final_item.success: false`, `final_item.output` contains "ENOENT" or "not found").
    *   **Assert:** Stream continues. Model receives error and explains it (`item_start: message`). `response_done` is reached.

---

## 5. Provider & Capability Variety

### 5.1. Thinking Models (Reasoning)
*   **TC-V2-10.1: OpenAI o1/o3 Reasoning**
    *   **Action:** Submit "Solve this logic puzzle..." with `model: "o1-preview"`.
    *   **Assert:** Stream contains `item_start` (`type: "reasoning"`) OR `item_delta` with reasoning content (depending on provider mapping).
*   **TC-V2-10.2: Anthropic Thinking**
    *   **Action:** Submit with `provider: "anthropic"`, `model: "claude-3-7-sonnet"`, config `{ thinking: { budget_tokens: 1024 } }`.
    *   **Assert:** Stream contains `item_start` (`type: "reasoning"`) -> `item_delta` (thinking text) -> `item_done` -> `item_start` (`type: "message"`).

### 5.2. Provider Adapters
*   **TC-V2-11.1: Anthropic Messages API**
    *   **Action:** Submit with `provider: "anthropic"`.
    *   **Assert:** Full successful flow (start -> message -> done).
*   **TC-V2-11.2: OpenRouter Chat API**
    *   **Action:** Submit with `provider: "openrouter"`, `model: "google/gemini-flash-1.5"`.
    *   **Assert:** Full successful flow.

---

## 6. Persistence Verification

*   **TC-V2-12.1: Convex Hydration**
    *   **Action:** Complete a flow with Tools and Thinking.
    *   **Action:** Query `GET /api/v2/threads/{threadId}`.
    *   **Assert:** The `history` array in the response matches the event stream.
        *   Item 1: User Message
        *   Item 2: Reasoning (if applicable)
        *   Item 3: Tool Call
        *   Item 4: Tool Output
        *   Item 5: Assistant Message
