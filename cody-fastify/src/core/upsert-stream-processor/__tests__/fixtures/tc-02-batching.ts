/**
 * TC-02: Agent Message With Batching
 *
 * Scenario: Agent responds with content that exceeds first batch threshold (10 tokens).
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc02Batching: TestFixture = {
  id: "TC-02",
  name: "Agent message with batching",
  description:
    "Verify batch gradient triggers 'update' emissions when token thresholds are crossed",

  options: {
    // Simplified gradient for test - thresholds at 10, 20, 40 cumulative tokens
    batchGradient: [10, 10, 20],
  },

  input: [
    // 1. response_start
    {
      event_id: "evt-02-001",
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
      event_id: "evt-02-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-02-001",
        item_type: "message",
      },
    },
    // 3. item_delta #1 - 45 chars = ~11 tokens, crosses first threshold (10)
    {
      event_id: "evt-02-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-02-001",
        delta_content: "This is the first part of a longer message. ",
      },
    },
    // 4. item_delta #2 - 42 chars = ~10 tokens, cumulative ~21, crosses second threshold (20)
    {
      event_id: "evt-02-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-02-001",
        delta_content: "Here is some more content that continues. ",
      },
    },
    // 5. item_delta #3 - 43 chars = ~11 tokens, cumulative ~32, under third threshold (40)
    {
      event_id: "evt-02-005",
      timestamp: 1004,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-02-001",
        delta_content: "And finally the conclusion of this message.",
      },
    },
    // 6. item_done
    {
      event_id: "evt-02-006",
      timestamp: 1005,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-02-001",
        final_item: {
          id: "msg-02-001",
          type: "message",
          content:
            "This is the first part of a longer message. Here is some more content that continues. And finally the conclusion of this message.",
          origin: "agent",
        },
      },
    },
    // 7. response_done
    {
      event_id: "evt-02-007",
      timestamp: 1006,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "response_done",
      payload: {
        type: "response_done",
        response_id: TEST_TURN_ID,
        status: "complete",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 32,
          total_tokens: 42,
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
    // 2. message create - after first delta crosses threshold
    {
      payload: {
        type: "message",
        itemId: "msg-02-001",
        status: "create",
        content: "This is the first part of a longer message. ",
      },
    },
    // 3. message update - after second delta crosses next threshold
    {
      payload: {
        type: "message",
        itemId: "msg-02-001",
        status: "update",
        content:
          "This is the first part of a longer message. Here is some more content that continues. ",
      },
    },
    // 4. message complete - on item_done
    {
      payload: {
        type: "message",
        itemId: "msg-02-001",
        status: "complete",
        content:
          "This is the first part of a longer message. Here is some more content that continues. And finally the conclusion of this message.",
      },
    },
    // 5. turn_complete
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
