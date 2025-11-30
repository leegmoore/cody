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
    "Verify batch gradient triggers 'updated' emissions when token thresholds are crossed",

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
      payloadType: "turn_event",
      payload: {
        type: "turn_started",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
      },
    },
    // 2. item_upsert created - after first delta crosses threshold
    {
      payloadType: "item_upsert",
      payload: {
        type: "item_upsert",
        itemId: "msg-02-001",
        itemType: "message",
        changeType: "created",
        content: "This is the first part of a longer message. ",
      },
    },
    // 3. item_upsert updated - after second delta crosses next threshold
    {
      payloadType: "item_upsert",
      payload: {
        type: "item_upsert",
        itemId: "msg-02-001",
        itemType: "message",
        changeType: "updated",
        content:
          "This is the first part of a longer message. Here is some more content that continues. ",
      },
    },
    // 4. item_upsert completed - on item_done
    {
      payloadType: "item_upsert",
      payload: {
        type: "item_upsert",
        itemId: "msg-02-001",
        itemType: "message",
        changeType: "completed",
        content:
          "This is the first part of a longer message. Here is some more content that continues. And finally the conclusion of this message.",
      },
    },
    // 5. turn_completed
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
