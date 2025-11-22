# V2 Core Test Harness: Happy Path Test Conditions

**Date:** November 22, 2025
**Status:** Approved - Ready for Implementation
**Objective:** Define the core "Happy Path" functional scenarios for the V2 Core streaming pipeline. These conditions will drive the initial TDD efforts, ensuring the fundamental integration of Fastify, Redis, Workers, Convex, SSE, and the Hydration Library.

---

## 1. Methodology

Each test condition is functionally described, focusing on the expected end-to-end behavior of the pipeline. These conditions will be implemented as Playwright/Vitest tests that:
1.  Submit a prompt via the Fastify `/api/v2/submit` endpoint.
2.  Trigger a specific mocked LLM response (fixture) from the `MockStreamAdapter`.
3.  Consume the resulting SSE stream from `/api/v2/stream/:runId`.
4.  Hydrate the stream into a `Response` object using the `StreamHydrator`.
5.  Assert the final hydrated `Response` matches the expected structure.
6.  Assert the persisted `Response` in Convex matches the hydrated `Response`.

**Mocks:** Only the LLM Provider API calls are mocked. All local infrastructure (Fastify, Redis, Convex, Workers) runs in a real, local environment.

---

## 2. Test Scenarios

### TC-HP-01: Simple Message Turn (OpenAI)

**Functional Description:**
A user submits a simple prompt to an OpenAI model. The model responds with a single, short message containing no thinking or tool calls. The pipeline should correctly process this, stream it to the client, persist it to Convex, and the client should hydrate it into a complete `Response` object.

**Request:**
*   **Endpoint:** `POST /api/v2/submit`
*   **Body:** `{"prompt": "Tell me a fun fact.", "model": "gpt-5-mini", "providerId": "openai"}`
*   **Mocked LLM Response (OpenAI Adapter):** A response containing a single `message` item (e.g., "The shortest war in history lasted 38 minutes."). No `reasoning` or `function_call` events.

**Expected Pipeline Flow:**
1.  `submit` endpoint receives request.
2.  `OpenAIStreamAdapter` is invoked with `gpt-5-mini`.
3.  `MockStreamAdapter` publishes `response_start`, `item_start (message)`, `item_delta (message)`, `item_done (message)`, `response_done` to Redis.
4.  `PersistenceWorker` consumes, builds `Response`, persists to Convex.
5.  SSE endpoint streams events to test harness.
6.  `StreamHydrator` in test harness consumes, builds `Response`.

**Assertions:**
*   Hydrated `Response` has `status: "completed"`.
*   Hydrated `Response` `output_items` contains exactly one `message` item with the expected content.
*   Persisted `Response` in Convex matches the hydrated `Response`.

**Fixture:** `tests/fixtures/openai/simple-message.json`

---

### TC-HP-02: Simple Message Turn (Anthropic)

**Functional Description:**
Identical to TC-HP-01, but using an Anthropic model. This verifies the `AnthropicStreamAdapter` correctly normalizes Anthropic's message chunks into the canonical `StreamEvent` format.

**Request:**
*   **Endpoint:** `POST /api/v2/submit`
*   **Body:** `{"prompt": "Tell me a fun fact.", "model": "claude-haiku-4.5", "providerId": "anthropic"}`
*   **Mocked LLM Response (Anthropic Adapter):** A response containing a single `message` item.

**Assertions:**
*   Identical to TC-HP-01, but confirming the `provider_id` is "anthropic".

**Fixture:** `tests/fixtures/anthropic/simple-message.json`

---

### TC-HP-03: Thinking Block + Message Turn (OpenAI)

**Functional Description:**
A user submits a prompt that prompts the model to generate internal reasoning before a final message. The pipeline should correctly process a `reasoning` item followed by a `message` item.

**Request:**
*   **Endpoint:** `POST /api/v2/submit`
*   **Body:** `{"prompt": "Explain the concept of monads step-by-step.", "model": "gpt-5-codex", "providerId": "openai"}`
*   **Mocked LLM Response (OpenAI Adapter):** A response containing a `reasoning` item followed by a `message` item.

**Assertions:**
*   Hydrated `Response` has `status: "completed"`.
*   Hydrated `Response` `output_items` contains two items: a `reasoning` item and a `message` item, in correct order.
*   Content of both items matches expected.
*   Persisted `Response` in Convex matches the hydrated `Response`.

**Fixture:** `tests/fixtures/openai/thinking-message.json`

---

### TC-HP-04: Thinking Block + Message Turn (Anthropic)

**Functional Description:**
Identical to TC-HP-03, but using an Anthropic model. This verifies the `AnthropicStreamAdapter` correctly maps Anthropic's "thinking blocks" to our canonical `reasoning` item type.

**Request:**
*   **Endpoint:** `POST /api/v2/submit`
*   **Body:** `{"prompt": "Explain the concept of monads step-by-step.", "model": "claude-sonnet-4.5", "providerId": "anthropic"}`
*   **Mocked LLM Response (Anthropic Adapter):** A response containing a "thinking block" followed by a "text block".

**Assertions:**
*   Identical to TC-HP-03, but confirming the `provider_id` is "anthropic".

**Fixture:** `tests/fixtures/anthropic/thinking-message.json`

---

### TC-HP-05: Tool Call, Output, and Message Turn (OpenAI)

**Functional Description:**
A turn where the model decides to call a tool, the tool executes (mocked in the test runner), and the model then provides a message based on the tool's output. This verifies `function_call` and `function_call_output` events flow correctly.

**Request:**
*   **Endpoint:** `POST /api/v2/submit`
*   **Body:** `{"prompt": "Summarize the content of README.md.", "model": "gpt-5-codex", "providerId": "openai"}`
*   **Mocked LLM Response (OpenAI Adapter):**
    1.  A `function_call` item (e.g., `readFile` tool with `path: "README.md"`).
    2.  *(Note: The `function_call_output` is generated by the **Tool Worker**, not the LLM API. The `MockAdapter` only provides the `function_call` event. The harness must simulate the Tool Worker's output or the Tool Worker itself must be run locally and mocked.)*
    3.  A subsequent `message` item based on the (mocked) tool output.

**Assumptions for Mocking:**
*   The `MockAdapter` will only emit the `function_call` event.
*   The `ToolWorker` (which processes `function_call` events from Redis and pushes `function_call_output`) will need its own mocking for actual tool execution (e.g., `fs.readFile` mocked). For this happy path, we assume the `ToolWorker` is running and its *tool handlers* are mocked.
*   The `MockAdapter` will need to emit a second stream of events representing the model's response *after* seeing the tool output. This implies a more complex mock fixture or a multi-stage `MockAdapter`.

**Simplified Fixture Strategy for TC-HP-05 (Initial):**
For the *first* iteration of this test, the `MockAdapter` will emit `function_call`, `function_call_output`, and `message` events *as if the model itself generated them sequentially*, bypassing the actual Tool Worker logic. This simplifies the mock and verifies the event types. The actual Tool Worker integration will be a separate test later.

**Assertions:**
*   Hydrated `Response` has `status: "completed"`.
*   Hydrated `Response` `output_items` contains three items: `function_call`, `function_call_output`, and `message`.
*   Content matches expected.
*   Persisted `Response` in Convex matches hydrated.

**Fixture:** `tests/fixtures/openai/tool-call-output-message.json`

---

### TC-HP-06: Multi-Turn Conversation & Context Preservation

**Functional Description:**
The system should correctly manage conversation context across multiple turns within the same `threadId`. The response from a second turn should implicitly reference the first turn.

**Request (Turn 1):**
*   **Endpoint:** `POST /api/v2/submit`
*   **Body:** `{"prompt": "What is the capital of France?", "model": "gpt-5-mini", "providerId": "openai", "threadId": "test_thread_1"}`
*   **Mocked LLM Response (OpenAI Adapter):** `message: "Paris."`

**Request (Turn 2):**
*   **Endpoint:** `POST /api/v2/submit`
*   **Body:** `{"prompt": "And what is its most famous landmark?", "model": "gpt-5-mini", "providerId": "openai", "threadId": "test_thread_1", "turnId": "new_turn_id_for_turn_2"}`
*   **Mocked LLM Response (OpenAI Adapter):** `message: "The Eiffel Tower."`
    *   *(Note: The MockAdapter for Turn 2 needs to understand that it received the full history of Turn 1. This implies the MockAdapter gets the full prompt sent to the LLM, including history.)*

**Assertions:**
*   Two `Response` objects are persisted for `test_thread_1`, one for each turn.
*   Each `Response` `output_items` contains the expected message.
*   The system correctly passes the full history to the LLM in the second turn (verified by inspecting the mock adapter's received prompt, or by having the mock intelligently return responses based on history).

**Fixtures:**
*   `tests/fixtures/openai/turn1-message.json`
*   `tests/fixtures/openai/turn2-message.json`

---


### TC-HP-07: Usage Metrics Capture (OpenAI)

**Functional Description:**
The pipeline should correctly capture and persist token usage metrics provided by the LLM API.

**Request:**
*   **Endpoint:** `POST /api/v2/submit`
*   **Body:** `{"prompt": "Short summary.", "model": "gpt-5-mini", "providerId": "openai"}`
*   **Mocked LLM Response (OpenAI Adapter):** A simple message with `usage` data (`prompt_tokens`, `completion_tokens`, `total_tokens`).

**Assertions:**
*   Hydrated `Response` has `status: "completed"`.
*   Hydrated `Response` `usage` field contains expected `prompt_tokens`, `completion_tokens`, `total_tokens`.
*   Persisted `Response` in Convex matches, including usage data.

**Fixture:** `tests/fixtures/openai/usage-message.json`

---


### TC-HP-08: Tool Call (Simple)

**Functional Description:**
Verify the pipeline correctly handles a turn involving a simple `function_call` that does *not* result in a `function_call_output` from the LLM directly, but rather signals the need for a tool execution. For this happy path, we simplify by having the mock adapter emit the `function_call` event and then a `response_done` event, assuming the tool execution (by the Worker) would happen subsequently and generate its own `function_call_output` event. This primarily validates the `function_call` event type's propagation.

**Request:**
*   **Endpoint:** `POST /api/v2/submit`
*   **Body:** `{"prompt": "Run 'ls -l'.", "model": "gpt-5-codex", "providerId": "openai"}`
*   **Mocked LLM Response (OpenAI Adapter):** A response containing a single `function_call` item (e.g., `exec` tool with `command: "ls -l"`).

**Assertions:**
*   Hydrated `Response` has `status: "completed"`.
*   Hydrated `Response` `output_items` contains exactly one `function_call` item with the expected `name` and `arguments`.
*   Persisted `Response` in Convex matches the hydrated `Response`.

**Fixture:** `tests/fixtures/openai/simple-tool-call.json`

---

### TC-HP-09: SSE Reconnection

**Functional Description:**
Validate streaming reliability by simulating a client disconnect and reconnect. The client should be able to resume the stream from the `Last-Event-ID` and receive only the subsequent events, ensuring no data loss or duplication.

**Request:**
*   **Endpoint:** `POST /api/v2/submit` (Standard Simple Message)
*   **Action:** Client connects to SSE, receives 50% of events, disconnects.
*   **Reconnect:** Client connects again with `Last-Event-ID` set to the ID of the last received event.

**Assertions:**
*   The reconnected stream delivers the remaining 50% of events.
*   The final hydrated `Response` is complete and identical to a single-session run.
*   No duplicate events are received.

**Fixture:** `tests/fixtures/openai/simple-message.json` (Reused)

---

### TC-HP-10: Concurrent Turns

**Functional Description:**
Validate that the system can handle multiple independent turns executing simultaneously without crosstalk or state leakage.

**Request:**
*   **Endpoint:** `POST /api/v2/submit` (Called twice, concurrently)
*   **Run A:** `prompt: "Turn A"`, `model: "gpt-5-mini"`
*   **Run B:** `prompt: "Turn B"`, `model: "gpt-5-mini"`

**Assertions:**
*   Two distinct `runId`s are generated.
*   Two distinct Redis streams are created.
*   Two distinct `Response` objects are persisted in Convex.
*   Stream A contains only events for Turn A.
*   Stream B contains only events for Turn B.
*   Hydration of Stream A yields "Turn A" response; Stream B yields "Turn B".

**Fixture:** `tests/fixtures/openai/simple-message.json` (Reused, or slightly modified for distinct content)

---

## 3. Implementation Roadmap for Test Conditions

1.  **Create Fixture JSON Files:** For each `Fixture` listed above, create the JSON file containing the `chunks` (raw SSE event strings) and `expected_response` (the final hydrated `Response` object).
2.  **Update `mockLLMFetch`:** Enhance the `mockLLMFetch` (or `MockModelFactory`) to map provider/fixture combinations to these new JSON files.
3.  **Implement Tests:** Write Playwright/Vitest tests that use the `Core2TestHarness` to drive these scenarios.

---

## Appendix A: Fixture Structure Example

```json
// tests/fixtures/openai/simple-message.json
{
  "description": "Basic message turn with no thinking or tools",
  "provider": "openai",
  "model": "gpt-5-mini",
  "chunks": [
    "data: {\"type\":\"response.start\",\"response_id\":\"resp_abc123\"}\n\n",
    "data: {\"type\":\"item.start\",\"item_id\":\"msg_001\",\"item_type\":\"message\"}\n\n",
    "data: {\"type\":\"item.content.delta\",\"item_id\":\"msg_001\",\"delta\":\"Hello\"}\n\n",
    "data: {\"type\":\"item.content.delta\",\"item_id\":\"msg_001\",\"delta\":\" world\"}\n\n",
    "data: {\"type\":\"item.done\",\"item_id\":\"msg_001\",\"final_item\":{\"id\":\"msg_001\",\"type\":\"message\",\"content\":\"Hello world\",\"origin\":\"agent\"}}\n\n",
    "data: {\"type\":\"response.done\",\"response_id\":\"resp_abc123\",\"status\":\"complete\",\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":3,\"total_tokens\":13},\"finish_reason\":null}\n\n"
  ],
  "expected_response": {
    "id": "resp_abc123",
    "turn_id": "any",
    "thread_id": "any",
    "agent_id": null,
    "model_id": "gpt-5-mini",
    "provider_id": "openai",
    "created_at": "any",
    "updated_at": "any",
    "status": "completed",
    "output_items": [
      {
        "id": "msg_001",
        "type": "message",
        "content": "Hello world",
        "origin": "agent",
        "correlation_id": null
      }
    ],
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 3,
      "total_tokens": 13
    },
    "finish_reason": null,
    "error": null
  }
}
```
*(Note: `any` placeholders in expected_response are for dynamic IDs/timestamps that will be ignored or asserted with `expect.any(String)`/`expect.any(Number)`.)*