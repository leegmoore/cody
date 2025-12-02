/**
 * TC-16: Threshold Plus One
 *
 * Scenario: Content accumulates to threshold (10 tokens), then one more
 * token arrives in a second delta. This exceeds the threshold, triggering
 * a "create" emission. Then item_done triggers "complete".
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc16ThresholdPlusOne: TestFixture = {
  id: "TC-16",
  name: "Threshold plus one",
  description:
    "Verify threshold exceeded by one token triggers create emission",

  input: [
    // 1. response_start
    {
      event_id: "evt-16-001",
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
      event_id: "evt-16-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-16-001",
        item_type: "message",
      },
    },
    // 3. item_delta #1 with exactly 40 chars = 10 tokens (at threshold)
    {
      event_id: "evt-16-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-16-001",
        delta_content: "This is exactly forty characters long..", // 40 chars = 10 tokens
      },
    },
    // 4. item_delta #2 with 4 chars = 1 token (exceeds threshold!)
    {
      event_id: "evt-16-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-16-001",
        delta_content: " Hi!", // 4 chars = 1 token
      },
    },
    // 5. item_done
    {
      event_id: "evt-16-005",
      timestamp: 1004,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-16-001",
        final_item: {
          id: "msg-16-001",
          type: "message",
          content: "This is exactly forty characters long.. Hi!",
          origin: "agent",
        },
      },
    },
    // 6. response_done
    {
      event_id: "evt-16-006",
      timestamp: 1005,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "response_done",
      payload: {
        type: "response_done",
        response_id: TEST_TURN_ID,
        status: "complete",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 11,
          total_tokens: 21,
        },
        finish_reason: "end_turn",
      },
    },
  ] as StreamEvent[],

  expected: [
    // 1. turn_started
    {
      payload: {
        type: "turn_started",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
      },
    },
    // 2. message create - triggered when delta #2 exceeds threshold
    {
      payload: {
        type: "message",
        itemId: "msg-16-001",
        status: "create",
        content: "This is exactly forty characters long.. Hi!",
        origin: "agent",
      },
    },
    // 3. message complete - on item_done
    {
      payload: {
        type: "message",
        itemId: "msg-16-001",
        status: "complete",
        content: "This is exactly forty characters long.. Hi!",
        origin: "agent",
      },
    },
    // 4. turn_complete
    {
      payload: {
        type: "turn_complete",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
        status: "complete",
      },
    },
  ],
};
