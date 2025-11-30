/**
 * TC-11: Empty Content Item
 *
 * Scenario: Item starts and completes with no content.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc11EmptyContent: TestFixture = {
  id: "TC-11",
  name: "Empty content item",
  description: "Verify items with no content are handled gracefully",

  input: [
    // 1. response_start
    {
      event_id: "evt-11-001",
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
    // 2. item_start for message (no initial_content)
    {
      event_id: "evt-11-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-11-001",
        item_type: "message",
      },
    },
    // 3. item_done (no deltas received)
    {
      event_id: "evt-11-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-11-001",
        final_item: {
          id: "msg-11-001",
          type: "message",
          content: "",
          origin: "agent",
        },
      },
    },
    // 4. response_done
    {
      event_id: "evt-11-004",
      timestamp: 1003,
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
      payloadType: "turn_event",
      payload: {
        type: "turn_started",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
      },
    },
    // 2. item_upsert completed only (no created since no content)
    {
      payloadType: "item_upsert",
      payload: {
        type: "item_upsert",
        itemType: "message",
        changeType: "completed",
        content: "",
        origin: "agent",
      },
    },
    // 3. turn_completed
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
