# Core 2.0 E2E Test Plan

**Status:** Authoritative Test Specification for Phase 5
**Scope:** Validation of the new V2 API Endpoints (`/api/v2/submit`, `/api/v2/stream`) and the Core 2.0 Pipeline.

This document defines the **mandatory** test conditions that must be implemented in the new Playwright suite (`tests/e2e/v2-lifecycle.spec.ts`).

---

## 1. API Contract Tests (Sanity Checks)

These tests verify the HTTP surface area behaves exactly as specified.

*   **TC-V2-01: Submit - Valid Request**
    *   **Action:** POST `/api/v2/submit` with minimal valid payload (`{ prompt: "Hi", model: "gpt-4o" }`).
    *   **Assert:** Returns `202 Accepted`. Body contains `{ runId: "uuid..." }`.
    *   **Assert:** Headers contain `X-Trace-Id`.

*   **TC-V2-02: Submit - Invalid Payload**
    *   **Action:** POST `/api/v2/submit` with missing `prompt`.
    *   **Assert:** Returns `400 Bad Request`. Body contains readable Zod validation error.

*   **TC-V2-03: Stream - Unknown Run ID**
    *   **Action:** GET `/api/v2/stream/non-existent-uuid`.
    *   **Assert:** Returns `404 Not Found`.

*   **TC-V2-04: Stream - Content Type Headers**
    *   **Action:** GET `/api/v2/stream/{validRunId}`.
    *   **Assert:** Response headers include `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.

---

## 2. Streaming Protocol Tests (Mechanics)

These tests verify the transport layer reliability.

*   **TC-V2-05: Event Structure Compliance**
    *   **Action:** Submit run -> Connect Stream.
    *   **Assert:** Every received chunk matches the SSE format: `id: ... 
 event: ... 
 data: ... 

`.
    *   **Assert:** Every `data` payload parses as a valid JSON `StreamEvent` (matching Appendix A schema).

*   **TC-V2-06: Trace Context Propagation**
    *   **Action:** Submit run. Connect Stream.
    *   **Assert:** Every `StreamEvent` received contains a `trace_context` object.
    *   **Assert:** The `traceparent` ID matches the one generated during submission (or is a valid child).

*   **TC-V2-07: Keep-Alive Heartbeats**
    *   **Action:** Submit a "slow" request (or mock a delay).
    *   **Assert:** Receive `:keepalive` comments or `heartbeat` events within 15 seconds of idle time.

*   **TC-V2-08: Reconnection with Last-Event-ID**
    *   **Action:** Start stream. Read 5 events. Disconnect.
    *   **Action:** Reconnect sending `Last-Event-ID: {id-of-5th-event}`.
    *   **Assert:** Stream resumes at Event 6. No duplicate events (1-5) are re-sent.

---

## 3. Functional Lifecycle Tests (The Flows)

These simulate real user interactions.

*   **TC-V2-09: Simple Q&A Flow**
    *   **Action:** Submit "What is 2+2?".
    *   **Assert Sequence:**
        1.  `response_start`
        2.  `item_start` (type: `message`)
        3.  `item_delta` (chunks "4")
        4.  `item_done` (final content)
        5.  `response_done` (status: `complete`)

*   **TC-V2-10: Thinking/Reasoning Flow**
    *   **Action:** Submit a complex logic puzzle.
    *   **Assert Sequence:**
        1.  `item_start` (type: `reasoning`)
        2.  `item_delta` (content chunks)
        3.  `item_done`
        4.  `item_start` (type: `message`)
        5.  `response_done`

*   **TC-V2-11: Multi-Step Tool Execution**
    *   **Action:** Submit "Create a file named hello.txt with content 'world', then read it back."
    *   **Assert Sequence:**
        1.  `item_start` (`function_call`: `fs_write`)
        2.  `item_done` (`fs_write`)
        3.  **Worker Action:** Tool Worker executes write.
        4.  `item_start` (`function_call_output`: `success: true`)
        5.  `item_start` (`function_call`: `fs_read`)
        6.  **Worker Action:** Tool Worker executes read.
        7.  `item_start` (`function_call_output`: `content: "world"`)
        8.  `item_start` (`message`: "I read the file...")
        9.  `response_done`

---

## 4. Resilience & Error Tests (Unhappy Paths)

*   **TC-V2-12: Tool Execution Failure**
    *   **Action:** Submit "Read a file that definitely does not exist."
    *   **Assert:**
        1.  `item_start` (`function_call`: `fs_read`)
        2.  `item_start` (`function_call_output`) -> Payload contains `error` object or `success: false`.
        3.  `item_start` (`message`) -> Agent explains the error ("I couldn't find that file...").
    *   **Crucial:** The stream must NOT crash. It must continue to completion.

*   **TC-V2-13: Context Window Overflow (Large Output)**
    *   **Action:** Submit request that generates massive output (or use a tool that returns 50KB of text).
    *   **Assert:** Stream handles large payloads without disconnecting. `item_delta` chunks are sized reasonably.

*   **TC-V2-14: Concurrent Isolation**
    *   **Action:** Trigger Run A ("Count to 10000"). Trigger Run B ("Say hi").
    *   **Assert:** Stream A and Stream B receive only their own events. No cross-talk.

---

## 5. Persistence Verification

*   **TC-V2-15: Convex Hydration**
    *   **Action:** Run a full flow (Tool + Message). Wait for `response_done`.
    *   **Action:** Query Convex `messages` table by `runId`.
    *   **Assert:** The persisted record matches the stream output perfectly.
        *   `status`: `complete`
---

## 6. Tool Inventory Validation (Full Coverage)

These tests verify that every available tool is correctly wired and executable via the V2 pipeline.

*   **TC-V2-16: Tool - List Directory**
    *   **Action:** Submit "List files in the current directory".
    *   **Assert:** `item_start` (`function_call`: `listDir`) -> `item_done` (`function_call_output`).
    *   **Assert:** Output contains known files (e.g., `package.json`).

*   **TC-V2-17: Tool - Grep Files**
    *   **Action:** Submit "Search for 'version' in package.json".
    *   **Assert:** `item_start` (`function_call`: `grepFiles`) -> `item_done` (`function_call_output`).
    *   **Assert:** Output contains the grep matches.

*   **TC-V2-18: Tool - Apply Patch**
    *   **Action:** Submit "Create a temp file 'patch_test.txt' with 'hello', then patch it to say 'world'."
    *   **Assert:** Sequence of `fs_write` -> `applyPatch` -> `fs_read`.
    *   **Assert:** Final read returns "world".

*   **TC-V2-19: Tool - File Search**
    *   **Action:** Submit "Find the file named 'v2-test-plan.md'".
    *   **Assert:** `item_start` (`function_call`: `fileSearch`).
    *   **Assert:** Output contains the correct path `cody-fastify/docs/v2-test-plan.md`.
