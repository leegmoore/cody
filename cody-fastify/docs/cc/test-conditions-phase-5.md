# Core 2.0 Phase 5: Error & Edge Case Test Conditions

**Version:** 1.0
**Status:** Ready for Implementation
**Purpose:** Validate error handling and edge cases across LLM, tool, and streaming components
**Scope:** 12 critical tests split into 2 implementation phases

---

## Phase 5.1: Critical Error Handling (6 Tests)

Focus on errors that will definitely occur in production: LLM errors, tool failures, and basic streaming issues.

### **TC-ER-01: LLM Returns Error Response**

**Given:**
- User prompt: "Trigger error"
- Model: gpt-5-mini
- Provider: openai

**Mock Response:**
- response_start
- response_error event
```json
{
  "type": "response_error",
  "error": {
    "type": "invalid_request_error",
    "code": "invalid_prompt",
    "message": "Prompt violates content policy"
  }
}
```

**Expected Result:**
```json
{
  "status": "error",
  "output_items": [],
  "error": {
    "code": "invalid_prompt",
    "message": "Prompt violates content policy"
  }
}
```

**Verification Points:**
- ✅ Response.status = "error"
- ✅ Response.error populated from response_error event
- ✅ Response.output_items is empty array
- ✅ SSE stream terminates cleanly (no hang)
- ✅ Convex persists error state
- ✅ No uncaught exceptions

**Mock Fixture:** `tests/fixtures/openai/error-response.json`

---

### **TC-ER-02: Tool Execution Fails**

**Given:**
- LLM requests: readFile("nonexistent.txt")
- Tool handler returns error

**Tool Mock:**
```typescript
toolRegistry.register('readFile', async (args) => {
  if (args.path === 'nonexistent.txt') {
    return {
      success: false,
      output: 'Error: ENOENT - File not found',
      error: {code: 'ENOENT', message: 'File does not exist'}
    };
  }
  return {success: true, output: 'file content'};
});
```

**Mock Response (LLM):**
- function_call for readFile
- (ToolWorker emits function_call_output with success=false)
- message acknowledging error

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": [
    {
      "type": "function_call",
      "name": "readFile",
      "arguments": "{\"path\":\"nonexistent.txt\"}"
    },
    {
      "type": "function_call_output",
      "success": false,
      "output": "Error: ENOENT - File not found"
    },
    {
      "type": "message",
      "content": "I couldn't read that file - it doesn't exist."
    }
  ]
}
```

**Verification Points:**
- ✅ function_call_output.success = false
- ✅ Error details in output field
- ✅ ToolWorker doesn't crash on tool failure
- ✅ Pipeline continues (LLM sees error, responds)
- ✅ Full flow persisted to Convex

**Mock Fixture:** `tests/fixtures/openai/tool-error.json`

---

### **TC-ER-03: Tool Execution Timeout**

**Given:**
- LLM requests tool that takes too long
- Tool handler sleeps for 10 seconds
- ToolWorker has 2-second timeout

**Tool Mock:**
```typescript
toolRegistry.register('slowTool', async (args) => {
  await sleep(10000); // Exceeds timeout
  return {success: true, output: 'done'};
});
```

**Expected Result:**
```json
{
  "output_items": [
    {
      "type": "function_call",
      "name": "slowTool"
    },
    {
      "type": "function_call_output",
      "success": false,
      "output": "Tool execution timeout after 2000ms"
    }
  ]
}
```

**Verification Points:**
- ✅ ToolWorker enforces timeout
- ✅ function_call_output indicates timeout
- ✅ Worker doesn't hang indefinitely
- ✅ Other tool calls still process

**Mock Fixture:** `tests/fixtures/openai/tool-timeout.json`

**Note:** Requires ToolWorker to have timeout configuration. Verify this exists or implement.

---

### **TC-ER-04: Malformed SSE Chunk**

**Given:**
- LLM stream contains invalid JSON chunk

**Mock Response:**
```
data: {"type":"response_start",...}\n\n
data: {"type":"item_start",...}\n\n
data: {INVALID JSON HERE\n\n
data: {"type":"item_delta",...}\n\n
data: {"type":"response_done",...}\n\n
```

**Expected Result:**
- Invalid chunk is skipped or logged
- Valid events before/after are processed
- Response completes with available data
- System doesn't crash

**Verification Points:**
- ✅ Malformed event doesn't crash MockAdapter
- ✅ Error logged (check console or error tracking)
- ✅ Valid events still processed
- ✅ Response.status = "completed" (or "error" depending on handling)

**Mock Fixture:** `tests/fixtures/openai/malformed-chunk.json`

---

### **TC-ER-05: Empty Message Content**

**Given:**
- LLM returns message with empty string content

**Mock Response:**
- response_start
- item_start (message)
- item_done (no deltas, content = "")
- response_done

**Expected Result:**
```json
{
  "status": "completed",
  "output_items": [
    {
      "type": "message",
      "content": ""
    }
  ]
}
```

**Verification Points:**
- ✅ Empty content is valid (not error)
- ✅ Message item still created
- ✅ Response completes normally
- ✅ Persisted correctly

**Mock Fixture:** `tests/fixtures/openai/empty-message.json`

---

### **TC-ER-06: Invalid Provider/Model Combination**

**Given:**
- Submit with providerId: "openai"
- But model: "claude-haiku-4.5" (Anthropic model)

**Expected Result:**
- ModelFactory throws InvalidModelError
- Submit returns 400 Bad Request
- Error message lists valid models for provider

**Verification Points:**
- ✅ Factory validation catches mismatch before adapter creation
- ✅ HTTP 400 status
- ✅ Error response body contains:
  - Error code
  - Explanation of mismatch
  - List of allowed models for provider
- ✅ No Redis stream created
- ✅ No worker processing

**Mock Fixture:** N/A (validation happens before fixture lookup)

---

## Phase 5.2: Streaming Edge Cases (6 Tests)

Focus on streaming mechanics, concurrency, and data integrity under stress.

### **TC-ER-07: Very Large Response (1MB+ Content)**

**Given:**
- LLM returns message with 1MB content
- Delivered as 500+ small deltas

**Mock Response:**
- response_start
- item_start (message)
- 500 x item.content.delta (2KB each)
- item_done
- response_done

**Expected Result:**
- All deltas accumulated correctly
- Final content.length ≈ 1MB
- No truncation or memory issues

**Verification Points:**
- ✅ Reducer handles large accumulation
- ✅ Redis stores large stream (check MAXLEN doesn't truncate)
- ✅ SSE doesn't timeout during long stream
- ✅ Convex accepts large document
- ✅ Hydration completes (no memory errors)

**Mock Fixture:** `tests/fixtures/openai/large-response.json`

---

### **TC-ER-08: Rapid Event Stream (Burst)**

**Given:**
- LLM streams 1000 tiny deltas very rapidly
- event_delay_ms: 0 (no artificial delays)

**Mock Response:**
- response_start
- item_start (message)
- 1000 x item.content.delta ("a", "b", "c", ...)
- item_done
- response_done

**Expected Result:**
- All 1000 deltas processed
- No dropped events
- Final content has all characters

**Verification Points:**
- ✅ No race conditions in reducer
- ✅ Redis handles burst writes (1000 XADD in <1 second)
- ✅ Worker keeps up (no backlog)
- ✅ SSE streams all events
- ✅ Hydration doesn't drop events

**Mock Fixture:** `tests/fixtures/openai/rapid-stream.json`

---

### **TC-ER-09: Out-of-Order Events**

**Given:**
- MockAdapter intentionally emits events out of sequence
- item_delta BEFORE item_start

**Mock Response:**
```
response_start
item_delta (no prior item_start) ← WRONG ORDER
item_start
item_done
response_done
```

**Expected Result:**
- Reducer detects ordering violation
- Throws error or rejects event
- Response.status = "error"

**Verification Points:**
- ✅ Reducer validates event sequence
- ✅ Error thrown with clear message
- ✅ Invalid state not persisted to Convex
- ✅ No silent corruption

**Mock Fixture:** `tests/fixtures/openai/out-of-order.json`

---

### **TC-ER-10: High Concurrency (50 Simultaneous Turns)**

**Given:**
- Submit 50 prompts simultaneously
- All use same provider/model
- All use different threadIds

**Expected Result:**
- All 50 complete successfully
- No crosstalk between streams
- All 50 persisted correctly

**Verification Points:**
- ✅ 50 unique runIds generated
- ✅ 50 separate Redis streams created
- ✅ No event mixing between streams
- ✅ All 50 in Convex with correct data
- ✅ Reasonable performance (< 60 seconds total)
- ✅ Workers handle concurrent load

**Mock Fixture:** Reuse `simple-message.json` (same fixture for all 50)

---

### **TC-ER-11: Thread Collision (Concurrent Turns, Same Thread)**

**Given:**
- Submit 2 prompts with SAME threadId simultaneously
- Both should append to same thread

**Expected Result:**
- Both complete
- Both have same thread_id
- Different turn_ids
- Both persisted
- No lost updates or race conditions

**Verification Points:**
- ✅ Convex has 2 documents with same thread_id
- ✅ Both complete (no deadlock)
- ✅ No race in thread updates

**Mock Fixture:** Reuse `simple-message.json`

---

### **TC-ER-12: Invalid Event Schema**

**Given:**
- MockAdapter emits event missing required field
- item_start without item_id

**Mock Response:**
```json
{
  "type": "item_start",
  "item_type": "message"
  // Missing: item_id (required)
}
```

**Expected Result:**
- StreamEventSchema validation fails
- Event rejected before Redis publish
- OR published but reducer rejects
- Clear error with field name

**Verification Points:**
- ✅ Schema validation catches missing field
- ✅ ZodError thrown with path to missing field
- ✅ Invalid event doesn't corrupt state
- ✅ Error logged with details

**Mock Fixture:** `tests/fixtures/openai/invalid-schema.json`

---

## Implementation Strategy

### **Phase 5.1: Critical Errors (6 tests)**

**Implement in order:**
1. TC-ER-01: Tool execution fails (easiest - just return error from mock)
2. TC-ER-05: Empty message content (simple edge case)
3. TC-ER-06: Provider mismatch (factory validation)
4. TC-ER-04: Malformed SSE chunk (tests error recovery)
5. TC-ER-02: Tool timeout (requires timeout config)
6. TC-ER-03: LLM error response (tests error surfacing)

**Effort:** 1-2 days
**Value:** Validates all critical error paths

**Success Criteria:**
- 6/6 new tests passing
- All errors handled gracefully
- No uncaught exceptions

---

### **Phase 5.2: Edge Cases & Stress (6 tests)**

**Implement in order:**
1. TC-ER-12: Invalid schema (schema validation)
2. TC-ER-09: Out-of-order events (sequence validation)
3. TC-ER-07: Large response (data integrity)
4. TC-ER-08: Rapid stream (race conditions)
5. TC-ER-10: High concurrency (load test)
6. TC-ER-11: Thread collision (concurrent writes)

**Effort:** 2 days
**Value:** Stress tests reveal race conditions and scale issues

**Success Criteria:**
- 6/6 tests passing
- System stable under load
- No race conditions or data corruption

---

## Total Coverage After Phase 5

**Happy Path Tests:** 10 (passing)
**Error Tests:** 12 (6 per phase)
**Total:** 22 comprehensive tests

**Coverage:**
- ✅ LLM errors (error response, malformed chunks)
- ✅ Tool errors (execution failure, timeout)
- ✅ Schema validation (invalid events, empty content)
- ✅ Factory validation (provider mismatch)
- ✅ Streaming integrity (large, rapid, out-of-order)
- ✅ Concurrency (high load, thread collision)

---

## Notes on Implementation

### **Tool Timeout (TC-ER-02):**

Check if ToolWorker has timeout config:
```typescript
// src/workers/tool-worker.ts
const DEFAULT_TOOL_TIMEOUT_MS = 30000; // 30 seconds

async executeTool(call) {
  return Promise.race([
    toolHandler.execute(call.arguments),
    sleep(this.timeoutMs).then(() => {
      throw new Error('Tool timeout');
    })
  ]);
}
```

If timeout doesn't exist, implement it as part of this test.

---

### **Malformed Chunk (TC-ER-04):**

MockAdapter should handle parse errors:
```typescript
try {
  const event = JSON.parse(chunk.replace(/^data: /, ''));
  await redis.publish(event);
} catch (err) {
  console.error('[mock-adapter] Malformed chunk:', err);
  // Continue to next chunk (don't crash)
}
```

---

### **High Concurrency (TC-ER-10):**

Run 50 submits in parallel:
```typescript
const promises = Array.from({length: 50}, (_, i) =>
  harness.submit({
    prompt: `Test ${i}`,
    model: 'gpt-5-mini',
    providerId: 'openai'
  })
);

const results = await Promise.all(promises);
expect(results).toHaveLength(50);

// Verify all persisted
for (const {runId} of results) {
  const persisted = await harness.getPersistedResponse(runId);
  expect(persisted).toBeDefined();
}
```

---

## Fixtures Required

### **Phase 5.1 Fixtures (6 files):**
1. `openai/error-response.json` - LLM error
2. `openai/tool-error.json` - Tool failure
3. `openai/tool-timeout.json` - Slow tool
4. `openai/malformed-chunk.json` - Invalid JSON
5. `openai/empty-message.json` - Empty content
6. N/A (provider mismatch - no fixture needed)

### **Phase 5.2 Fixtures (4 files):**
1. `openai/invalid-schema.json` - Missing required field
2. `openai/out-of-order.json` - Wrong event sequence
3. `openai/large-response.json` - 1MB+ content
4. `openai/rapid-stream.json` - 1000 deltas
5. Reuse `simple-message.json` for concurrency tests

**Total new fixtures:** 10

---

## Success Criteria

### **Phase 5.1 Complete When:**
- ✅ 6 error tests implemented and passing
- ✅ All error conditions handled gracefully
- ✅ No uncaught exceptions in any test
- ✅ Error messages are clear and actionable

### **Phase 5.2 Complete When:**
- ✅ 6 edge case tests implemented and passing
- ✅ System stable under concurrent load (50 turns)
- ✅ Large payloads handled without errors
- ✅ Schema validation prevents invalid data

### **Overall Phase 5 Complete When:**
- ✅ 22 total tests (10 happy + 12 error/edge)
- ✅ All passing consistently
- ✅ Full suite runs in < 2 minutes
- ✅ Confidence to handle production errors
