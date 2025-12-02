/**
 * TC-15: Exactly At Threshold
 *
 * Scenario: Content accumulates to exactly the threshold (10 tokens),
 * then item_done arrives. Since threshold was met but not exceeded,
 * there should be only one emission (complete).
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc15ExactlyAtThreshold: TestFixture = {
  id: "TC-15",
  name: "Exactly at threshold",
  description:
    "Verify content exactly at threshold (not exceeded) results in single complete emission",

  input: [
    // 1. response_start
    {
      event_id: "evt-15-001",
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
      event_id: "evt-15-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-15-001",
        item_type: "message",
      },
    },
    // 3. item_delta with exactly 40 chars = 10 tokens (exactly at threshold)
    {
      event_id: "evt-15-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-15-001",
        delta_content: "This is exactly forty characters long..", // 40 chars = 10 tokens
      },
    },
    // 4. item_done (no more content)
    {
      event_id: "evt-15-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-15-001",
        final_item: {
          id: "msg-15-001",
          type: "message",
          content: "This is exactly forty characters long..",
          origin: "agent",
        },
      },
    },
    // 5. response_done
    {
      event_id: "evt-15-005",
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
          completion_tokens: 10,
          total_tokens: 20,
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
    // 2. message complete - only emission (threshold met but not exceeded)
    {
      payload: {
        type: "message",
        itemId: "msg-15-001",
        status: "complete",
        content: "This is exactly forty characters long..",
        origin: "agent",
      },
    },
    // 3. turn_complete
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
