/**
 * TC-13: Redis Emit Retry Success
 *
 * Scenario: First emit attempt fails, retry succeeds.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc13RetrySuccess: TestFixture = {
  id: "TC-13",
  name: "Redis emit retry succeeds",
  description: "Verify retry logic recovers from transient failures",

  options: {
    retryAttempts: 3,
    retryBaseMs: 10, // Short for testing
    retryMaxMs: 100,
  },

  onEmitBehavior: {
    type: "fail_then_succeed",
    failCount: 2, // Fail on calls 1 and 2, succeed on call 3+
  },

  input: [
    // 1. response_start
    {
      event_id: "evt-13-001",
      timestamp: 1000,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "response_start",
      payload: {
        type: "response_start",
        response_id: TEST_TURN_ID,
        turn_id: TEST_TURN_ID,
        thread_id: TEST_THREAD_ID,
        model_id: "claude-sonnet-4-20250514",
        provider_id: "anthropic",
        created_at: 1000,
      },
    },
    // 2. item_start for message
    {
      event_id: "evt-13-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-13-001",
        item_type: "message",
      },
    },
    // 3. item_delta
    {
      event_id: "evt-13-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-13-001",
        delta_content: "Test message",
      },
    },
    // 4. item_done
    {
      event_id: "evt-13-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-13-001",
        final_item: {
          id: "msg-13-001",
          type: "message",
          content: "Test message",
          origin: "agent",
        },
      },
    },
    // 5. response_done
    {
      event_id: "evt-13-005",
      timestamp: 1004,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "response_done",
      payload: {
        type: "response_done",
        response_id: TEST_TURN_ID,
        status: "complete",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 3,
          total_tokens: 13,
        },
        finish_reason: "end_turn",
      },
    },
  ] as StreamEvent[],

  expected: [
    // All eventually succeed after retries
    // 1. turn_started (after 2 retries)
    {
      payloadType: "turn_event",
      payload: {
        type: "turn_started",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
      },
    },
    // 2. item_upsert created
    {
      payloadType: "item_upsert",
      payload: {
        type: "item_upsert",
        changeType: "created",
      },
    },
    // 3. item_upsert completed
    {
      payloadType: "item_upsert",
      payload: {
        type: "item_upsert",
        changeType: "completed",
      },
    },
    // 4. turn_completed
    {
      payloadType: "turn_event",
      payload: {
        type: "turn_completed",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
        status: "complete",
      },
    },
  ],
};
