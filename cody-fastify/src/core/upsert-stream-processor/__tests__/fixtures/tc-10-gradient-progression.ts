/**
 * TC-10: Batch Gradient Progression
 *
 * Scenario: Long response exercises multiple batch gradient levels.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

// Helper to generate strings of exact character lengths
// 4 chars = 1 token (approximately)
function generateContent(tokens: number): string {
  // Using 4 chars per token
  const chars = tokens * 4;
  return "X".repeat(chars);
}

// Pre-generate content strings for clarity
// Gradient: [10, 10, 20, 20, 50] - cumulative thresholds: 10, 20, 40, 60, 110
const CONTENT_1 = generateContent(11); // 44 chars = ~11 tokens, crosses threshold 1 (10)
const CONTENT_2 = generateContent(10); // 40 chars = ~10 tokens, cumulative ~21, crosses threshold 2 (20)
const CONTENT_3 = generateContent(20); // 80 chars = ~20 tokens, cumulative ~41, crosses threshold 3 (40)
const CONTENT_4 = generateContent(20); // 80 chars = ~20 tokens, cumulative ~61, crosses threshold 4 (60)
const CONTENT_5 = generateContent(10); // 40 chars = ~10 tokens, cumulative ~71, under threshold 5 (110)

export const tc10GradientProgression: TestFixture = {
  id: "TC-10",
  name: "Batch gradient progression",
  description:
    "Verify emissions occur at correct cumulative token thresholds following the gradient",

  options: {
    // cumulative thresholds: 10, 20, 40, 60, 110
    batchGradient: [10, 10, 20, 20, 50],
  },

  input: [
    // 1. response_start
    {
      event_id: "evt-10-001",
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
      event_id: "evt-10-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-10-001",
        item_type: "message",
      },
    },
    // 3. item_delta #1 - ~11 tokens, crosses threshold 1 (10)
    {
      event_id: "evt-10-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-10-001",
        delta_content: CONTENT_1,
      },
    },
    // 4. item_delta #2 - ~10 tokens, cumulative ~21, crosses threshold 2 (20)
    {
      event_id: "evt-10-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-10-001",
        delta_content: CONTENT_2,
      },
    },
    // 5. item_delta #3 - ~20 tokens, cumulative ~41, crosses threshold 3 (40)
    {
      event_id: "evt-10-005",
      timestamp: 1004,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-10-001",
        delta_content: CONTENT_3,
      },
    },
    // 6. item_delta #4 - ~20 tokens, cumulative ~61, crosses threshold 4 (60)
    {
      event_id: "evt-10-006",
      timestamp: 1005,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-10-001",
        delta_content: CONTENT_4,
      },
    },
    // 7. item_delta #5 - ~10 tokens, cumulative ~71, under threshold 5 (110)
    {
      event_id: "evt-10-007",
      timestamp: 1006,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-10-001",
        delta_content: CONTENT_5,
      },
    },
    // 8. item_done
    {
      event_id: "evt-10-008",
      timestamp: 1007,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-10-001",
        final_item: {
          id: "msg-10-001",
          type: "message",
          content: CONTENT_1 + CONTENT_2 + CONTENT_3 + CONTENT_4 + CONTENT_5,
          origin: "agent",
        },
      },
    },
    // 9. response_done
    {
      event_id: "evt-10-009",
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
          completion_tokens: 71,
          total_tokens: 81,
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
    // 3. message update - at ~21 tokens (crossed 20)
    {
      payload: {
        type: "message",
        status: "update",
        content: CONTENT_1 + CONTENT_2,
      },
    },
    // 4. message update - at ~41 tokens (crossed 40)
    {
      payload: {
        type: "message",
        status: "update",
        content: CONTENT_1 + CONTENT_2 + CONTENT_3,
      },
    },
    // 5. message update - at ~61 tokens (crossed 60)
    {
      payload: {
        type: "message",
        status: "update",
        content: CONTENT_1 + CONTENT_2 + CONTENT_3 + CONTENT_4,
      },
    },
    // 6. message complete - on item_done (includes delta #5)
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
