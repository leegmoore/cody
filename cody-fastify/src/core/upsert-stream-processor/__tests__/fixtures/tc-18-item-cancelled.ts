/**
 * TC-18: Item Cancelled
 *
 * Scenario: An item is cancelled mid-stream before completion.
 * The cancelled item should be discarded without emitting any content.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc18ItemCancelled: TestFixture = {
  id: "TC-18",
  name: "Item cancelled mid-stream",
  description:
    "Verify that cancelled items are discarded without emitting any content emissions",

  input: [
    // 1. response_start
    {
      event_id: "evt-18-001",
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
      event_id: "evt-18-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-18-001",
        item_type: "message",
      },
    },
    // 3. item_delta with some content (under threshold so not emitted yet)
    {
      event_id: "evt-18-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-18-001",
        delta_content: "This content will be cancelled...",
      },
    },
    // 4. item_cancelled - item is cancelled before completion
    {
      event_id: "evt-18-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_cancelled",
      payload: {
        type: "item_cancelled",
        item_id: "msg-18-001",
        reason: "user_cancelled",
      },
    },
    // 5. response_done
    {
      event_id: "evt-18-005",
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
          completion_tokens: 0,
          total_tokens: 10,
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
        modelId: "claude-sonnet-4-20250514",
        providerId: "anthropic",
      },
    },
    // NO message emissions - cancelled items are discarded
    // 2. turn_complete
    {
      payload: {
        type: "turn_complete",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
        status: "complete",
        usage: {
          promptTokens: 10,
          completionTokens: 0,
          totalTokens: 10,
        },
      },
    },
  ],
};
