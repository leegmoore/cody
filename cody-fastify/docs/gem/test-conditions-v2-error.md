# V2 Core Test Harness: Error Handling Test Conditions

**Date:** November 22, 2025
**Status:** Draft
**Objective:** Define the "Unhappy Path" scenarios for the V2 Core. These tests verify the resilience of the pipeline (Adapters, Redis, Workers, Hydration) when things go wrong.

---

## 1. Tool Execution Failures

### TC-ER-01: Tool Execution Error (Known Failure)
**Functional Description:**
The LLM calls a tool with valid arguments, but the tool itself fails during execution (e.g., reading a non-existent file). The system should capture the error, emit a `function_call_output` with `success: false`, and the conversation should continue (the LLM sees the error).

**Request:**
*   **Endpoint:** `POST /api/v2/submit`
*   **Prompt:** "Read missing.txt"
*   **Fixture:** `tests/fixtures/openai/tool-error.json` (Simulates LLM calling `readFile` on `missing.txt`).

**System Behavior:**
1.  LLM emits `function_call`.
2.  ToolWorker picks it up.
3.  Tool Handler executes (Mocked to throw or return error).
4.  ToolWorker catches error.
5.  ToolWorker emits `function_call_output` with `success: false` and error details.
6.  (Optional) LLM responds to the error (simulated by fixture or mock adapter logic).

**Assertions:**
*   Hydrated Response contains `function_call_output`.
*   `function_call_output.success` is `false`.
*   `function_call_output.output` contains the error message.
*   Pipeline does not crash.

### TC-ER-02: Tool Timeout (Worker Latency)
**Functional Description:**
The tool takes longer than the configured timeout to execute. The Worker should abort the execution and report a timeout error.

**Request:**
*   **Endpoint:** `POST /api/v2/submit`
*   **Prompt:** "Run slow task"
*   **Fixture:** `tests/fixtures/openai/tool-slow.json`.

**System Behavior:**
1.  Tool Handler (Mocked) sleeps for longer than `ToolWorker` timeout config.
2.  ToolWorker detects timeout.
3.  ToolWorker emits `function_call_output` with `success: false` and `error: "Timeout"`.

**Assertions:**
*   Response contains failed output.
*   Error indicates timeout.

---

## 2. Stream Integrity Failures

### TC-ER-03: Malformed SSE Chunk
**Functional Description:**
The Provider Adapter receives a corrupted chunk from the LLM API (e.g., invalid JSON). The Adapter should not crash the entire stream; it should log the error, skip the bad chunk, and continue processing subsequent valid chunks.

**Request:**
*   **Fixture:** `tests/fixtures/openai/malformed-chunk.json` (Contains one unparseable line in the middle of valid lines).

**System Behavior:**
1.  MockStreamAdapter (simulating Provider Adapter logic) encounters bad JSON.
2.  Adapter catches parse error.
3.  Adapter emits `item_error` or effectively skips.
4.  Stream continues to `response_done`.

**Assertions:**
*   Hydrated Response status is `complete` (not stuck).
*   Valid items before/after the bad chunk are present.
*   (Optional) `error` item present in stream for the bad chunk.

### TC-ER-04: Stream Disconnect (Network Failure)
**Functional Description:**
The connection to the LLM provider drops mid-stream. The Adapter should detect this and mark the Response as `error` or `incomplete`.

**Request:**
*   **Fixture:** `tests/fixtures/openai/stream-abort.json` (Stream ends without `response_done` or `[DONE]`).

**System Behavior:**
1.  Adapter stream loop terminates unexpectedly.
2.  Adapter emits `response_error` event to Redis.

**Assertions:**
*   Hydrated Response status is `error`.
*   `response.error` contains "Stream interrupted" or similar.

---

## 3. Infrastructure Failures

### TC-ER-05: Persistence Retry (Transient DB Error)
**Functional Description:**
The Persistence Worker fails to write to Convex (simulated transient error). It should NOT Ack the message in Redis. It should retry on the next loop or via auto-claim.

**Setup:**
*   Mock the Convex Client in the test harness to throw once, then succeed.

**Assertions:**
*   Data eventually appears in Convex (eventual consistency).
*   Redis stream has no pending messages (eventually Acked).

