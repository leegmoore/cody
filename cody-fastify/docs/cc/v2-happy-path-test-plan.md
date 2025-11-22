# Core 2.0 Happy Path Test Plan

**Version:** 1.0
**Status:** Ready for Implementation
**Purpose:** Scaffold test harness and validate Core 2.0 streaming pipeline
**Target:** 6-12 happy path scenarios covering critical functionality

---

## Test Philosophy

**Functional test conditions** describing expected behavior, not implementation details.

**For each test:**
1. **Given:** User input and configuration
2. **Mock Response:** Pre-defined LLM response (based on real API shape)
3. **Expected Result:** What the hydrated Response object should contain
4. **Verification Points:** What to assert (events, persistence, streaming)

**Mock fixtures** based on REAL OpenAI/Anthropic API responses, adapted for test data.

---

## Test Conditions

### **TC-1: Simple Message Turn (OpenAI)**

**Given:**
- User prompt: "Say hello"
- Model: gpt-5-mini
- Provider: openai
- No prior thread history

**Mock Response:**
- Single message item
- Content: "Hello! How can I help you today?"
- No thinking, no tool calls

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": [
    {
      "item_type": "message",
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    }
  ]
}
```

**Verification Points:**
- ✅ POST /api/v2/submit returns 202 with runId and streamUrl
- ✅ SSE stream emits: response_start → item_start → item.content.delta (N times) → item_done → response_done
- ✅ Hydrated Response has 1 output_item of type "message"
- ✅ Convex persistence matches hydrated Response (exact equality)
- ✅ Response.usage has prompt_tokens, completion_tokens

**Mock Fixture:** `tests/fixtures/openai/simple-message.json`

---

### **TC-2: Thinking + Message Turn (OpenAI)**

**Given:**
- User prompt: "What is 6 * 7?"
- Model: gpt-5-mini
- Provider: openai

**Mock Response:**
- First item: reasoning ("Let me calculate: 6 * 7 = 42")
- Second item: message ("The answer is 42.")

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": [
    {
      "item_type": "reasoning",
      "content": "Let me calculate: 6 * 7 = 42"
    },
    {
      "item_type": "message",
      "role": "assistant",
      "content": "The answer is 42."
    }
  ]
}
```

**Verification Points:**
- ✅ SSE stream includes item_start for BOTH reasoning and message items
- ✅ Hydrated Response has 2 output_items in correct order
- ✅ First item has item_type="reasoning"
- ✅ Second item has item_type="message"
- ✅ Both items persisted to Convex

**Mock Fixture:** `tests/fixtures/openai/thinking-message.json`

---

### **TC-3: Simple Message Turn (Anthropic)**

**Given:**
- User prompt: "Say hello"
- Model: claude-haiku-4.5
- Provider: anthropic

**Mock Response:**
- Anthropic Messages API format (content_block_delta events)
- Normalized to canonical StreamEvents
- Single message: "Hello! I'm Claude."

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": [
    {
      "item_type": "message",
      "role": "assistant",
      "content": "Hello! I'm Claude."
    }
  ]
}
```

**Verification Points:**
- ✅ Anthropic adapter correctly normalizes content_block_delta → item.content.delta
- ✅ Same StreamEvent shape as OpenAI (canonical format)
- ✅ Hydration works identically (provider-agnostic)
- ✅ Persistence works identically

**Mock Fixture:** `tests/fixtures/anthropic/simple-message.json`

---

### **TC-4: Thinking + Message Turn (Anthropic)**

**Given:**
- User prompt: "Explain why sky is blue"
- Model: claude-haiku-4.5
- Provider: anthropic

**Mock Response:**
- Anthropic thinking block (if supported)
- Message with explanation

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": [
    {
      "item_type": "reasoning",
      "content": "I should explain Rayleigh scattering..."
    },
    {
      "item_type": "message",
      "role": "assistant",
      "content": "The sky appears blue because..."
    }
  ]
}
```

**Verification Points:**
- ✅ Anthropic thinking blocks normalize to reasoning items
- ✅ Multi-item response works for Anthropic provider
- ✅ Order preserved (thinking before message)

**Mock Fixture:** `tests/fixtures/anthropic/thinking-message.json`

---

### **TC-5: Function Call Turn (OpenAI)**

**Given:**
- User prompt: "Read the README.md file"
- Model: gpt-5-mini
- Provider: openai

**Mock Response:**
- Function call: `readFile({path: "README.md"})`
- (Note: Tool execution is separate test, this just verifies function_call item)

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": [
    {
      "item_type": "function_call",
      "name": "readFile",
      "arguments": "{\"path\":\"README.md\"}"
    }
  ]
}
```

**Verification Points:**
- ✅ Function call item emitted correctly
- ✅ Arguments accumulated from deltas (multi-chunk function args)
- ✅ item_done includes full function_call object
- ✅ Tool worker can detect and process this item (separate worker test)

**Mock Fixture:** `tests/fixtures/openai/function-call.json`

---

### **TC-6: Multi-Message Turn (OpenAI)**

**Given:**
- User prompt: "Count to three"
- Model: gpt-5-mini

**Mock Response:**
- Three separate message items:
  - "One"
  - "Two"
  - "Three"

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": [
    {"item_type": "message", "content": "One"},
    {"item_type": "message", "content": "Two"},
    {"item_type": "message", "content": "Three"}
  ]
}
```

**Verification Points:**
- ✅ Multiple items of same type handled correctly
- ✅ Order preserved
- ✅ Each item has unique item_id
- ✅ All items persisted

**Mock Fixture:** `tests/fixtures/openai/multi-message.json`

---

### **TC-7: Empty Response (Edge Case)**

**Given:**
- User prompt: "(empty string or whitespace)"
- Model: gpt-5-mini

**Mock Response:**
- response_start → response_done (no items)

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": []
}
```

**Verification Points:**
- ✅ Empty output_items array is valid
- ✅ Status still "completed"
- ✅ No crash or validation errors
- ✅ Persistence handles empty responses

**Mock Fixture:** `tests/fixtures/openai/empty-response.json`

---

### **TC-8: Response with Usage Metrics**

**Given:**
- User prompt: "Test"
- Model: gpt-5-mini

**Mock Response:**
- Simple message
- response_done includes usage: {prompt_tokens: 5, completion_tokens: 3}

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": [
    {"item_type": "message", "content": "Test response"}
  ],
  "usage": {
    "prompt_tokens": 5,
    "completion_tokens": 3,
    "total_tokens": 8
  }
}
```

**Verification Points:**
- ✅ Usage metrics captured from response_done event
- ✅ Metrics persisted to Convex
- ✅ Total calculated correctly

**Mock Fixture:** `tests/fixtures/openai/with-usage.json`

---

### **TC-9: SSE Reconnection (Streaming Reliability)**

**Given:**
- User submits prompt
- SSE stream starts
- Client disconnects mid-stream
- Client reconnects with Last-Event-ID

**Mock Response:**
- Standard simple message (10 events)

**Expected Result:**
- Client receives events 6-10 on reconnect (not 1-10)

**Verification Points:**
- ✅ SSE endpoint supports Last-Event-ID header
- ✅ Returns only events AFTER the provided ID
- ✅ Client can resume without re-receiving processed events
- ✅ Hydration continues from partial state

**Mock Fixture:** `tests/fixtures/openai/simple-message.json` (reuse)

**Special Setup:**
- Test harness needs to disconnect/reconnect SSE client mid-stream
- May require custom EventSource handling or curl-based test

---

### **TC-10: Streaming Deltas (Content Accumulation)**

**Given:**
- User prompt: "Count to five slowly"
- Model: gpt-5-mini

**Mock Response:**
- Single message item
- Content delivered as 5 separate deltas: "One ", "Two ", "Three ", "Four ", "Five"

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": [
    {
      "item_type": "message",
      "content": "One Two Three Four Five"
    }
  ]
}
```

**Verification Points:**
- ✅ Deltas accumulated correctly (concatenation)
- ✅ No extra whitespace or mangling
- ✅ Reducer handles incremental updates
- ✅ Final content matches concatenated deltas

**Mock Fixture:** `tests/fixtures/openai/multi-delta.json`

---

### **TC-11: Provider Agnostic (Same Behavior)**

**Given:**
- Same prompt: "Hello"
- Test with BOTH providers: openai (gpt-5-mini) and anthropic (claude-haiku-4.5)

**Mock Responses:**
- OpenAI fixture: Simple message
- Anthropic fixture: Simple message (different wire format, same canonical output)

**Expected Result:**
- Both produce identical Response structure:
```json
{
  "status": "completed",
  "output_items": [
    {"item_type": "message", "content": "Hello!"}
  ]
}
```

**Verification Points:**
- ✅ Different wire formats (OpenAI SSE vs Anthropic SSE) both normalize correctly
- ✅ Canonical StreamEvents are identical
- ✅ Hydrated Response is identical
- ✅ Persistence is identical

**Mock Fixtures:**
- `tests/fixtures/openai/simple-message.json`
- `tests/fixtures/anthropic/simple-message.json`

---

### **TC-12: Concurrent Turns (Isolation)**

**Given:**
- Submit 2 prompts simultaneously
- Prompt A: "Say A"
- Prompt B: "Say B"

**Mock Responses:**
- Response A: Message "A"
- Response B: Message "B"

**Expected Result:**
- 2 independent Response objects
- No crosstalk between streams

**Verification Points:**
- ✅ Different runIds assigned
- ✅ Different Redis stream keys (codex:run:{runId}:events)
- ✅ SSE streams are independent
- ✅ Response A contains only "A" content
- ✅ Response B contains only "B" content
- ✅ Both persisted correctly to Convex

**Mock Fixtures:**
- `tests/fixtures/openai/message-a.json`
- `tests/fixtures/openai/message-b.json`

---

## Mock Fixture Format

All fixtures follow this structure:

```json
{
  "description": "Human-readable description of what this fixture tests",
  "provider": "openai" | "anthropic" | "openrouter",
  "scenario": "simple-message" | "thinking-message" | "function-call" | etc.,

  "request": {
    "prompt": "The user prompt",
    "model": "gpt-5-mini",
    "temperature": 0.7
  },

  "response_chunks": [
    "data: {SSE event 1}\n\n",
    "data: {SSE event 2}\n\n",
    "..."
  ],

  "expected_output": {
    "status": "completed",
    "output_items": [
      {"item_type": "message", "content": "..."}
    ],
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 5
    }
  }
}
```

**Source:** Captured from real API calls, sanitized for test data.

---

## Harness Requirements (Functional)

The test harness MUST:

1. **Start Infrastructure**
   - Start Fastify server on available port
   - Start persistence worker
   - Connect to local Redis (localhost:6379)
   - Connect to local Convex dev server

2. **Mock LLM Responses**
   - Intercept fetch calls to api.openai.com, api.anthropic.com, openrouter.ai
   - Return pre-defined SSE chunks from fixtures
   - Support multiple fixtures per test run

3. **Submit Turns**
   - POST to /api/v2/submit with prompt, model, provider
   - Return runId and streamUrl

4. **Consume SSE Streams**
   - Connect to SSE endpoint (GET /api/v2/stream/:runId)
   - Collect all events until response_done
   - Support reconnection with Last-Event-ID

5. **Hydrate Responses**
   - Apply StreamEvents to ResponseReducer
   - Build complete Response object
   - Validate schema compliance

6. **Verify Persistence**
   - Query Convex messages table by runId
   - Assert persisted Response matches hydrated Response

7. **Cleanup Between Tests**
   - Delete Redis stream keys
   - Delete Convex test documents
   - Reset worker state

---

## Implementation Approach

### **Phase 1: Harness Scaffold (Get 1 Test Working)**

**Deliverables:**
1. `tests/harness/setup.ts` - Start/stop infrastructure
2. `tests/harness/mock-llm.ts` - Intercept fetch, return fixtures
3. `tests/fixtures/openai/simple-message.json` - First fixture
4. `tests/e2e/core-2.0/happy-path.spec.ts` - First test (TC-1)

**Goal:** Get TC-1 passing end-to-end

**Success Criteria:**
- Submit → Adapter → Redis → Worker → Convex → SSE → Hydration all work
- 1 test passes consistently

---

### **Phase 2: Expand Coverage (Get 6 Tests Working)**

**Add tests:**
- TC-2: Thinking + message
- TC-3: Anthropic simple message
- TC-4: Multi-delta accumulation
- TC-5: Usage metrics
- TC-6: Empty response

**Success Criteria:**
- 6/6 happy path tests passing
- Core pipeline validated for multiple scenarios

---

### **Phase 3: Edge Cases (Get to 12 Tests)**

**Add tests:**
- TC-7: Anthropic thinking
- TC-8: Function call item
- TC-9: SSE reconnection
- TC-10: Multi-message turn
- TC-11: Provider agnostic (same test, different providers)
- TC-12: Concurrent turns

**Success Criteria:**
- 12/12 tests passing
- Streaming reliability validated
- Provider normalization validated
- Concurrency validated

---

### **Phase 4: Find and Fix Bugs**

**Process:**
1. Run all 12 tests
2. Document failures (which test, what failed, why)
3. Fix v2 implementation issues
4. Re-run tests
5. Iterate until all pass

**Output:** Bug report + fixes applied to Core 2.0 implementation

---

## Test Execution Flow (Per Test)

```
1. SETUP
   - Load fixture (JSON file)
   - Configure mock to return fixture chunks
   - Clear Redis/Convex state

2. EXECUTE
   - POST /api/v2/submit {prompt, model, provider}
   - Get {runId, streamUrl}

3. STREAM
   - Connect to SSE endpoint
   - Collect events until response_done
   - Handle timeouts (max 10 seconds)

4. HYDRATE
   - Apply events to ResponseReducer
   - Build Response object

5. VERIFY
   - Assert Response structure matches expected
   - Query Convex, assert persisted Response matches
   - Verify event sequence in Redis (optional)

6. CLEANUP
   - Delete Redis stream key
   - Delete Convex document
```

---

## Success Criteria (Overall)

**Harness is ready when:**
- ✅ Can start/stop infrastructure programmatically
- ✅ Can mock LLM responses with fixtures
- ✅ Can submit turns via Playwright request
- ✅ Can consume SSE streams
- ✅ Can hydrate StreamEvents → Response
- ✅ Can verify Convex persistence

**Pipeline is validated when:**
- ✅ 6 core happy path tests passing (TC-1 through TC-6)
- ✅ Tests run in < 10 seconds total
- ✅ Tests are deterministic (10 consecutive clean runs)

**Integration is complete when:**
- ✅ All 12 tests passing
- ✅ Bugs found and fixed
- ✅ Confidence to add new features

---

## Non-Goals (Out of Scope)

**This test plan does NOT cover:**
- ❌ Error scenarios (LLM errors, Redis crashes) - Phase 5
- ❌ Tool execution (function_call_output, tool worker) - Phase 6
- ❌ Multi-turn conversations (thread history loading) - Phase 7
- ❌ Real LLM integration tests - Layer 2 (separate suite)
- ❌ UI testing - Future
- ❌ Performance testing - Future

**Focus:** Happy path validation of the streaming pipeline only.

---

## Appendix: Fixture Requirements

### **OpenAI Fixtures Needed**

| Fixture Name | Scenario | Items | Purpose |
|--------------|----------|-------|---------|
| simple-message.json | Basic response | 1 message | Validate basic flow |
| thinking-message.json | Reasoning | 1 reasoning + 1 message | Validate thinking |
| function-call.json | Tool request | 1 function_call | Validate tool call emission |
| multi-delta.json | Streaming | 1 message (5 deltas) | Validate delta accumulation |
| multi-message.json | Multiple outputs | 3 messages | Validate multiple items |
| empty-response.json | Edge case | 0 items | Validate empty handling |
| with-usage.json | Metrics | 1 message + usage | Validate usage capture |

### **Anthropic Fixtures Needed**

| Fixture Name | Scenario | Items | Purpose |
|--------------|----------|-------|---------|
| simple-message.json | Basic response | 1 message | Validate Anthropic adapter |
| thinking-message.json | Reasoning | 1 reasoning + 1 message | Validate thinking blocks |

**Total:** 9 fixture files to create.

---

## Next Steps

1. Create fixture directory structure
2. Create first fixture (openai/simple-message.json) from REAL API call
3. Build harness scaffold (setup.ts, mock-llm.ts)
4. Write TC-1 test
5. Get TC-1 passing
6. Iterate through remaining tests
