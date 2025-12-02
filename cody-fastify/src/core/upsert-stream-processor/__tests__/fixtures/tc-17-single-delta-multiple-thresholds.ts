/**
 * TC-17: Single Delta Crosses Multiple Thresholds
 *
 * Scenario: A single large delta arrives that would cross multiple
 * threshold boundaries. The processor should emit once (not multiple
 * times) since we only check threshold after each delta.
 *
 * With gradient [10, 10, 20], thresholds are at 10, 20, 40 cumulative.
 * A single delta with 100 chars (~25 tokens) crosses all three thresholds
 * but should only emit once.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc17SingleDeltaMultipleThresholds: TestFixture = {
  id: "TC-17",
  name: "Single delta crosses multiple thresholds",
  description:
    "Verify single large delta only triggers one emission regardless of thresholds crossed",

  options: {
    // Gradient with thresholds at 10, 20, 40 cumulative
    batchGradient: [10, 10, 20],
  },

  input: [
    // 1. response_start
    {
      event_id: "evt-17-001",
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
      event_id: "evt-17-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-17-001",
        item_type: "message",
      },
    },
    // 3. item_delta with 100 chars = 25 tokens (crosses thresholds at 10, 20, and almost 40)
    {
      event_id: "evt-17-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-17-001",
        delta_content:
          "This is a much longer message that contains approximately one hundred characters in total here.",
        // 100 chars = 25 tokens, crosses multiple thresholds in one delta
      },
    },
    // 4. item_done
    {
      event_id: "evt-17-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-17-001",
        final_item: {
          id: "msg-17-001",
          type: "message",
          content:
            "This is a much longer message that contains approximately one hundred characters in total here.",
          origin: "agent",
        },
      },
    },
    // 5. response_done
    {
      event_id: "evt-17-005",
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
          completion_tokens: 25,
          total_tokens: 35,
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
    // 2. message create - single emission even though multiple thresholds crossed
    //    Batch index advances to match where we are (index 2, threshold 40)
    {
      payload: {
        type: "message",
        itemId: "msg-17-001",
        status: "create",
        content:
          "This is a much longer message that contains approximately one hundred characters in total here.",
        origin: "agent",
      },
    },
    // 3. message complete - on item_done
    {
      payload: {
        type: "message",
        itemId: "msg-17-001",
        status: "complete",
        content:
          "This is a much longer message that contains approximately one hundred characters in total here.",
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
