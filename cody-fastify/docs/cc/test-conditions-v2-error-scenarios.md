# Core 2.0 Error Scenario Test Conditions

**Version:** 1.0
**Status:** Ready for Implementation
**Purpose:** Expand test coverage beyond happy paths to validate error handling, edge cases, and system resilience

---

## Test Philosophy

**Happy paths are validated (10/10 passing).** Now we stress-test the system:

1. **Error Handling** - What happens when components fail?
2. **Edge Cases** - Boundary conditions, unusual inputs
3. **Resilience** - Recovery from transient failures
4. **Load** - Behavior under concurrent stress

**For each test:**
- Describe the failure condition
- Define expected error handling behavior
- Verify graceful degradation (no crashes)
- Verify error information is surfaced correctly

---

## Test Conditions

### **Category 1: LLM Error Responses**

---

### **TC-ERR-01: LLM Returns Error Response**

**Given:**
- User prompt: "Trigger error"
- Model: gpt-5-mini
- Provider: openai

**Mock Response:**
- response_start
- response_error event with error details
- No items, no response_done

**Expected Result:**
```json
{
  "status": "error",
  "output_items": [],
  "error": {
    "code": "invalid_request_error",
    "message": "Invalid prompt format"
  }
}
```

**Verification Points:**
- ✅ Response.status = "error"
- ✅ Response.error populated with code and message
- ✅ Response.output_items is empty array (not undefined)
- ✅ Convex persistence includes error details
- ✅ SSE stream terminates cleanly (no hanging connection)

**Mock Fixture:** `tests/fixtures/openai/error-response.json`

---

### **TC-ERR-02: LLM Timeout (No Response)**

**Given:**
- User submits prompt
- MockAdapter delays indefinitely (simulates timeout)

**Mock Response:**
- response_start
- (nothing else - hangs)

**Expected Result:**
- SSE connection times out after 30 seconds
- HydrationError thrown with timeout message
- Response status unknown or partial

**Verification Points:**
- ✅ StreamHydrator.hydrateFromSSE() throws HydrationError
- ✅ Error type is "StreamTimeout"
- ✅ Test doesn't hang indefinitely
- ✅ Resources cleaned up (EventSource closed)

**Mock Fixture:** `tests/fixtures/openai/timeout.json` (minimal fixture, test controls delay)

---

### **TC-ERR-03: Malformed SSE Event**

**Given:**
- User submits prompt
- MockAdapter emits invalid JSON in SSE chunk

**Mock Response:**
```
data: {valid event}\n\n
data: {MALFORMED JSON HERE\n\n
data: {valid event}\n\n
```

**Expected Result:**
- Error logged or thrown
- Stream terminates or skips malformed event
- System doesn't crash

**Verification Points:**
- ✅ Malformed event doesn't crash reducer
- ✅ Error is logged or surfaced
- ✅ Valid events before/after are processed
- ✅ Response.status indicates partial failure or error

**Mock Fixture:** `tests/fixtures/openai/malformed-event.json`

---

### **TC-ERR-04: Item Without Content**

**Given:**
- LLM returns message item with empty content

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
- ✅ Empty string content is valid (not treated as error)
- ✅ Item still appears in output_items
- ✅ Response status is "completed"

**Mock Fixture:** `tests/fixtures/openai/empty-content.json`

---

### **Category 2: Tool Execution Errors**

---

### **TC-ERR-05: Tool Execution Fails**

**Given:**
- LLM requests tool call: readFile("nonexistent.txt")
- Tool handler returns error (mocked failure)

**Tool Mock:**
```typescript
toolRegistry.register('readFile', async (args) => {
  return {
    success: false,
    output: 'Error: File not found',
    error: {code: 'ENOENT', message: 'File does not exist'}
  };
});
```

**Expected Result:**
```json
{
  "output_items": [
    {
      "type": "function_call",
      "name": "readFile"
    },
    {
      "type": "function_call_output",
      "success": false,
      "output": "Error: File not found"
    }
  ]
}
```

**Verification Points:**
- ✅ function_call_output.success = false
- ✅ Error message in output field
- ✅ ToolWorker doesn't crash on tool failure
- ✅ Pipeline continues (no deadlock)

**Mock Fixture:** `tests/fixtures/openai/tool-error.json`

---

### **TC-ERR-06: Unknown Tool Requested**

**Given:**
- LLM requests tool that doesn't exist: unknownTool()
- Tool registry has no handler for this tool

**Mock Response:**
- function_call with name="unknownTool"

**Expected Result:**
- ToolWorker emits function_call_output with error
- OR ToolWorker logs error and skips
- System doesn't crash

**Verification Points:**
- ✅ ToolWorker handles unknown tool gracefully
- ✅ Error is surfaced (in output or logs)
- ✅ No crash or deadlock

**Mock Fixture:** `tests/fixtures/openai/unknown-tool.json`

---

### **Category 3: Infrastructure Failures**

---

### **TC-ERR-07: Redis Connection Lost Mid-Stream**

**Given:**
- Submit prompt, stream starts
- Redis connection drops during streaming
- (Simulate by stopping Redis mid-test)

**Expected Result:**
- Adapter fails to publish events
- Error logged or thrown
- Submit endpoint returns 500 or 503
- No data corruption

**Verification Points:**
- ✅ Graceful error handling (no uncaught exceptions)
- ✅ HTTP error status returned to client
- ✅ Partial data in Redis (if any) doesn't corrupt system
- ✅ System can recover when Redis comes back

**Setup:** Test harness stops Redis after submit, verifies error, restarts Redis

**Note:** This is a HARD test (requires controlling Redis lifecycle). May defer to manual testing.

---

### **TC-ERR-08: Convex Write Failure**

**Given:**
- Stream completes successfully
- PersistenceWorker tries to write to Convex
- Convex mutation fails (network error, schema mismatch, etc.)

**Mock Strategy:**
- Mock ConvexClient.mutation() to throw error
- OR use Convex test utilities to simulate failure

**Expected Result:**
- Worker logs error
- Retry logic kicks in (if exists)
- OR worker moves on to next stream
- Doesn't crash or deadlock

**Verification Points:**
- ✅ Worker handles Convex failures gracefully
- ✅ Error is logged
- ✅ Worker continues processing other streams
- ✅ No memory leaks from retries

**Note:** May require mocking Convex client, which violates "no mocks" rule. Discuss approach.

---

### **Category 4: Streaming Edge Cases**

---

### **TC-ERR-09: Very Large Response (>1MB)**

**Given:**
- LLM returns message with 1MB+ content
- Streamed as thousands of small deltas

**Mock Response:**
- response_start
- item_start (message)
- 1000+ item.content.delta events
- item_done
- response_done

**Expected Result:**
- All deltas accumulated correctly
- No truncation or memory issues
- Response.output_items[0].content contains full 1MB string

**Verification Points:**
- ✅ Reducer handles large content accumulation
- ✅ Redis can store large streams
- ✅ SSE doesn't timeout or buffer overflow
- ✅ Convex can store large Response objects

**Mock Fixture:** `tests/fixtures/openai/large-response.json`

---

### **TC-ERR-10: Rapid Deltas (Streaming Stress)**

**Given:**
- LLM streams content very rapidly (1000 deltas in 1 second)

**Mock Response:**
- Standard message with 1000 tiny deltas
- event_delay_ms: 1 (1ms between chunks)

**Expected Result:**
- All deltas processed correctly
- No dropped events
- Correct final content

**Verification Points:**
- ✅ Reducer doesn't drop events under load
- ✅ Redis handles burst writes
- ✅ SSE keeps up with rapid events
- ✅ No race conditions in delta accumulation

**Mock Fixture:** `tests/fixtures/openai/rapid-deltas.json`

---

### **TC-ERR-11: SSE Client Disconnect Mid-Stream**

**Given:**
- Stream starts
- Client disconnects after receiving 5 events
- Client reconnects with Last-Event-ID

**Expected Result:**
- Client receives remaining events (not duplicates)
- Final Response is complete
- No data loss

**Verification Points:**
- ✅ Last-Event-ID header honored
- ✅ Events after ID are returned
- ✅ No event duplication
- ✅ Reconnection works multiple times

**Note:** TC-HP-09 already tests this for happy path. This tests reconnection under partial failure.

---

### **TC-ERR-12: Out-of-Order Events**

**Given:**
- MockAdapter emits events in wrong order
- item_delta before item_start
- OR item_done before item_start

**Mock Response:**
- Intentionally misordered events

**Expected Result:**
- Reducer detects ordering violation
- Error thrown or event rejected
- System doesn't crash with corrupt state

**Verification Points:**
- ✅ Reducer validates event sequence
- ✅ Out-of-order events cause clear error
- ✅ Response.status = "error" or exception thrown
- ✅ No silent corruption

**Mock Fixture:** `tests/fixtures/openai/out-of-order.json`

---

### **Category 5: Concurrency & Race Conditions**

---

### **TC-ERR-13: High Concurrency (50 Simultaneous Turns)**

**Given:**
- Submit 50 prompts simultaneously
- All to same provider/model

**Expected Result:**
- All 50 complete successfully
- No crosstalk between streams
- No Redis key conflicts
- No worker deadlocks

**Verification Points:**
- ✅ 50 unique runIds assigned
- ✅ 50 separate Redis streams created
- ✅ All 50 persisted to Convex correctly
- ✅ No shared state corruption
- ✅ Reasonable performance (< 30 seconds total)

**Mock Fixture:** Reuse `simple-message.json`

---

### **TC-ERR-14: Thread Collision (Same threadId, Concurrent Turns)**

**Given:**
- Submit 2 prompts with SAME threadId simultaneously
- Both should add to same thread

**Expected Result:**
- Both turns complete
- Both have same thread_id
- Different turn_ids
- Both persisted
- No lost updates

**Verification Points:**
- ✅ Convex has 2 documents with same thread_id
- ✅ Both turns complete (no deadlock)
- ✅ No race condition in thread update

**Mock Fixture:** Reuse `simple-message.json`

---

### **TC-ERR-15: Worker Processing Lag**

**Given:**
- Submit 10 prompts rapidly
- PersistenceWorker configured with slow polling (5s intervals)

**Expected Result:**
- All 10 eventually persist (with delay)
- No events lost
- SSE streams complete before persistence

**Verification Points:**
- ✅ SSE streaming not blocked by slow persistence
- ✅ All 10 eventually appear in Convex (within timeout)
- ✅ No events dropped
- ✅ No deadlocks

**Setup:** Configure worker with slow timings for this test only

---

### **Category 6: Schema Validation**

---

### **TC-ERR-16: Invalid Event Schema**

**Given:**
- MockAdapter emits event missing required fields
- (e.g., item_start without item_id)

**Mock Response:**
- Intentionally invalid StreamEvent

**Expected Result:**
- Schema validation catches error
- Event rejected or error logged
- System doesn't crash

**Verification Points:**
- ✅ StreamEventSchema.parse() throws ZodError
- ✅ Invalid event doesn't reach reducer
- ✅ Error is logged with details
- ✅ Stream can continue or terminates cleanly

**Mock Fixture:** `tests/fixtures/openai/invalid-schema.json`

---

### **TC-ERR-17: Response Schema Violation**

**Given:**
- Events produce a Response that violates ResponseSchema
- (e.g., status field has invalid value)

**Expected Result:**
- Validation catches error before Convex write
- OR Convex rejects invalid document
- Clear error message

**Verification Points:**
- ✅ Invalid Response doesn't reach Convex
- ✅ Error logged with schema violation details
- ✅ System doesn't crash

---

### **Category 7: Provider-Specific Edge Cases**

---

### **TC-ERR-18: Anthropic Thinking Block Truncation**

**Given:**
- Anthropic returns very long thinking block
- Exceeds some internal limit

**Mock Response:**
- reasoning item with 50KB+ content
- Multiple thinking items in sequence

**Expected Result:**
- All thinking content captured
- No truncation
- Multiple reasoning items preserved

**Verification Points:**
- ✅ Large reasoning blocks persist fully
- ✅ Multiple reasoning items supported
- ✅ No content truncation

**Mock Fixture:** `tests/fixtures/anthropic/long-thinking.json`

---

### **TC-ERR-19: OpenAI Function Call with Complex Arguments**

**Given:**
- Function call with deeply nested JSON arguments
- Special characters, unicode, escaped quotes

**Mock Response:**
- function_call with complex args:
```json
{
  "nested": {
    "array": [1, 2, {"key": "value with \"quotes\""}],
    "unicode": "🔥 emoji",
    "escaped": "Line 1\nLine 2\tTabbed"
  }
}
```

**Expected Result:**
- Arguments string preserved exactly
- No JSON corruption
- ToolWorker can parse arguments

**Verification Points:**
- ✅ function_call.arguments contains full JSON string
- ✅ Special characters preserved
- ✅ ToolWorker successfully parses arguments
- ✅ No truncation or corruption

**Mock Fixture:** `tests/fixtures/openai/complex-args.json`

---

### **TC-ERR-20: Provider Mismatch**

**Given:**
- Submit with providerId: "openai"
- But model is Anthropic model: "claude-haiku-4.5"

**Expected Result:**
- Factory throws InvalidModelError
- Submit returns 400 Bad Request
- Clear error message explaining mismatch

**Verification Points:**
- ✅ Factory validation catches mismatch
- ✅ HTTP 400 status returned
- ✅ Error message explains allowed models for provider
- ✅ No Redis stream created

**Mock Fixture:** N/A (validation happens before adapter creation)

---

### **Category 8: Multi-Turn Edge Cases**

---

### **TC-ERR-21: Missing Thread History**

**Given:**
- Submit turn 2 with threadId
- But thread doesn't exist in Convex (no prior turns)

**Expected Result:**
- Turn processes anyway (creates new thread)
- OR returns 404 Not Found
- Clear behavior documented

**Verification Points:**
- ✅ Defined behavior (accept or reject)
- ✅ No crash
- ✅ Error message if rejected

**Note:** Depends on how thread loading is implemented (currently unknown in v2)

---

### **TC-ERR-22: Very Long Conversation (Context Window)**

**Given:**
- Thread has 100 prior turns
- Submit turn 101
- Total context exceeds model window

**Expected Result:**
- System handles gracefully
- Either: Truncates history, returns error, or compresses context
- Defined behavior

**Verification Points:**
- ✅ No crash from oversized context
- ✅ Behavior is deterministic
- ✅ Error or truncation is logged

**Note:** May be out of scope until context management is implemented

---

### **Category 9: Cleanup & Resource Management**

---

### **TC-ERR-23: Abandoned Stream (Client Never Consumes)**

**Given:**
- Submit creates stream
- SSE endpoint never called (client abandons)

**Expected Result:**
- Redis stream exists but unconsumed
- Stream expires after TTL (if configured)
- No memory leak

**Verification Points:**
- ✅ Redis MAXLEN or TTL prevents infinite growth
- ✅ Worker doesn't deadlock waiting for consumer
- ✅ Old streams get cleaned up

**Setup:** Configure Redis stream with MAXLEN, verify trimming

---

### **TC-ERR-24: Persistence Worker Crash & Recovery**

**Given:**
- PersistenceWorker processes 5 streams successfully
- Worker crashes (throw error in processRecord)
- Worker restarts

**Expected Result:**
- Worker resumes from last processed event
- No duplicate processing (idempotent)
- No lost events

**Verification Points:**
- ✅ Consumer group maintains position
- ✅ Events not re-processed after restart
- ✅ Remaining events are processed
- ✅ No data corruption

**Note:** Requires simulating crash in test (inject error, then restart worker)

---

## Summary of Test Coverage

**Total Additional Tests:** 24 error/edge case scenarios

**Breakdown:**
- LLM Errors: 4 tests (error response, timeout, malformed, empty content)
- Tool Errors: 2 tests (execution failure, unknown tool)
- Infrastructure: 2 tests (Redis failure, Convex failure)
- Streaming Edge Cases: 5 tests (large response, rapid deltas, disconnect, out-of-order, invalid schema)
- Concurrency: 3 tests (high load, thread collision, worker lag)
- Provider Edge Cases: 3 tests (long thinking, complex args, provider mismatch)
- Multi-Turn: 2 tests (missing history, long conversation)
- Cleanup: 2 tests (abandoned stream, worker crash)

---

## Implementation Phases

### **Phase 1: LLM & Tool Errors (High Priority)**
- TC-ERR-01 through TC-ERR-06
- **Effort:** 1 day
- **Value:** Validates error surfacing and tool resilience

### **Phase 2: Streaming Edge Cases (High Priority)**
- TC-ERR-09, TC-ERR-10, TC-ERR-12, TC-ERR-16, TC-ERR-17
- **Effort:** 1 day
- **Value:** Validates schema enforcement and edge case handling

### **Phase 3: Concurrency & Load (Medium Priority)**
- TC-ERR-13, TC-ERR-14, TC-ERR-15
- **Effort:** 1 day
- **Value:** Validates system under stress

### **Phase 4: Infrastructure Failures (Low Priority)**
- TC-ERR-07, TC-ERR-08, TC-ERR-23, TC-ERR-24
- **Effort:** 2 days
- **Value:** Validates resilience, but harder to test

### **Phase 5: Provider Edge Cases (Low Priority)**
- TC-ERR-18, TC-ERR-19, TC-ERR-20
- **Effort:** 0.5 days
- **Value:** Nice-to-have, catches provider quirks

---

## Success Criteria

**After implementing all error scenarios:**
- ✅ 34 total tests (10 happy path + 24 error scenarios)
- ✅ No uncaught exceptions under any error condition
- ✅ All errors surfaced with clear messages
- ✅ System demonstrates resilience and recovery
- ✅ Confidence to deploy to production

---

## Testing Strategy Notes

### **For Infrastructure Failures (TC-ERR-07, TC-ERR-08):**

These violate the "no mocks" rule if we mock Redis/Convex. Options:

**Option A:** Manual testing only (don't automate)
**Option B:** Integration test with real failure injection
- Stop Redis mid-test (requires test harness control)
- Use Convex test mode with failure injection

**Option C:** Defer to chaos engineering / production monitoring

**Recommendation:** Start with Option A (manual), consider automation later.

---

### **For Timeout Tests (TC-ERR-02):**

MockAdapter should support:
```json
{
  "stream_config": {
    "simulate_timeout": true,
    "hang_after_event": 2
  }
}
```

This makes timeout testing explicit in fixtures.

---

### **For Out-of-Order Tests (TC-ERR-12):**

Create special MockAdapter mode that intentionally scrambles events. Use sparingly (tests the test infrastructure as much as the system).

---

## Next Steps

1. Review and approve these test conditions
2. Prioritize which categories to implement first
3. Create fixtures for Phase 1 (LLM & Tool errors)
4. Implement 6 tests from Phase 1
5. Run and document results
6. Iterate to Phase 2-5 based on findings
