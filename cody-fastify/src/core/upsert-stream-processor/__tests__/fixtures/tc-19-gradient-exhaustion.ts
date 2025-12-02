/**
 * TC-19: Gradient Exhaustion
 *
 * Scenario: Content generation exceeds the gradient array length.
 * After gradient is exhausted, threshold should continue incrementing
 * by the last gradient value.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

// Helper to generate strings of exact character lengths
// 4 chars = 1 token (approximately)
function generateContent(tokens: number): string {
  const chars = tokens * 4;
  return "X".repeat(chars);
}

// Short gradient: [10, 20] - cumulative thresholds: 10, 30
// After exhaustion, should continue with +20 each time: 50, 70, 90...
//
// Content plan:
// Delta 1: 11 tokens -> crosses threshold 1 (10), emit create
// Delta 2: 20 tokens -> cumulative 31, crosses threshold 2 (30), emit update
// Delta 3: 20 tokens -> cumulative 51, crosses threshold 3 (50 = 30 + 20), emit update
// Delta 4: 20 tokens -> cumulative 71, crosses threshold 4 (70 = 50 + 20), emit update
// Delta 5: 10 tokens -> cumulative 81, under threshold 5 (90 = 70 + 20), no emit until complete

const CONTENT_1 = generateContent(11); // 44 chars = ~11 tokens, crosses threshold 1 (10)
const CONTENT_2 = generateContent(20); // 80 chars = ~20 tokens, cumulative ~31, crosses threshold 2 (30)
const CONTENT_3 = generateContent(20); // 80 chars = ~20 tokens, cumulative ~51, crosses threshold 3 (50)
const CONTENT_4 = generateContent(20); // 80 chars = ~20 tokens, cumulative ~71, crosses threshold 4 (70)
const CONTENT_5 = generateContent(10); // 40 chars = ~10 tokens, cumulative ~81, under threshold 5 (90)

export const tc19GradientExhaustion: TestFixture = {
  id: "TC-19",
  name: "Gradient exhaustion - continues with last value",
  description:
    "Verify that after gradient array is exhausted, threshold continues incrementing by the last gradient value",

  options: {
    // Very short gradient that will be exhausted quickly
    // Cumulative thresholds: 10, 30, then +20 for each subsequent: 50, 70, 90...
    batchGradient: [10, 20],
  },

  input: [
    // 1. response_start
    {
      event_id: "evt-19-001",
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
      event_id: "evt-19-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-19-001",
        item_type: "message",
      },
    },
    // 3. item_delta #1 - ~11 tokens, crosses threshold 1 (10)
    {
      event_id: "evt-19-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-19-001",
        delta_content: CONTENT_1,
      },
    },
    // 4. item_delta #2 - ~20 tokens, cumulative ~31, crosses threshold 2 (30)
    {
      event_id: "evt-19-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-19-001",
        delta_content: CONTENT_2,
      },
    },
    // 5. item_delta #3 - ~20 tokens, cumulative ~51, crosses threshold 3 (50 = 30 + 20 from last gradient value)
    {
      event_id: "evt-19-005",
      timestamp: 1004,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-19-001",
        delta_content: CONTENT_3,
      },
    },
    // 6. item_delta #4 - ~20 tokens, cumulative ~71, crosses threshold 4 (70 = 50 + 20)
    {
      event_id: "evt-19-006",
      timestamp: 1005,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-19-001",
        delta_content: CONTENT_4,
      },
    },
    // 7. item_delta #5 - ~10 tokens, cumulative ~81, under threshold 5 (90 = 70 + 20)
    {
      event_id: "evt-19-007",
      timestamp: 1006,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-19-001",
        delta_content: CONTENT_5,
      },
    },
    // 8. item_done
    {
      event_id: "evt-19-008",
      timestamp: 1007,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-19-001",
        final_item: {
          id: "msg-19-001",
          type: "message",
          content: CONTENT_1 + CONTENT_2 + CONTENT_3 + CONTENT_4 + CONTENT_5,
          origin: "agent",
        },
      },
    },
    // 9. response_done
    {
      event_id: "evt-19-009",
      timestamp: 1008,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "response_done",
      payload: {
        type: "response_done",
        response_id: TEST_TURN_ID,
        status: "complete",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 81,
          total_tokens: 91,
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
    // 2. message create - at ~11 tokens (crossed 10)
    {
      payload: {
        type: "message",
        status: "create",
        content: CONTENT_1,
      },
    },
    // 3. message update - at ~31 tokens (crossed 30)
    {
      payload: {
        type: "message",
        status: "update",
        content: CONTENT_1 + CONTENT_2,
      },
    },
    // 4. message update - at ~51 tokens (crossed 50 = 30 + 20 from exhausted gradient)
    {
      payload: {
        type: "message",
        status: "update",
        content: CONTENT_1 + CONTENT_2 + CONTENT_3,
      },
    },
    // 5. message update - at ~71 tokens (crossed 70 = 50 + 20)
    {
      payload: {
        type: "message",
        status: "update",
        content: CONTENT_1 + CONTENT_2 + CONTENT_3 + CONTENT_4,
      },
    },
    // 6. message complete - on item_done (includes delta #5, under threshold 90)
    {
      payload: {
        type: "message",
        status: "complete",
        content: CONTENT_1 + CONTENT_2 + CONTENT_3 + CONTENT_4 + CONTENT_5,
      },
    },
    // 7. turn_complete
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
