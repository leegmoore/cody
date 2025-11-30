/**
 * TC-07: Item Error Mid-Stream
 *
 * Scenario: An item encounters an error during processing.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc07ItemError: TestFixture = {
  id: "TC-07",
  name: "Item error mid-stream",
  description:
    "Verify item_error events produce error upserts and don't prevent turn completion",

  input: [
    // 1. response_start
    {
      event_id: "evt-07-001",
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
      event_id: "evt-07-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-07-001",
        item_type: "message",
      },
    },
    // 3. item_delta with partial content
    {
      event_id: "evt-07-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-07-001",
        delta_content: "I was starting to respond but",
      },
    },
    // 4. item_error
    {
      event_id: "evt-07-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_error",
      payload: {
        type: "item_error",
        item_id: "msg-07-001",
        error: {
          code: "CONTENT_FILTER",
          message: "Response blocked by content filter",
        },
      },
    },
    // 5. response_done with error status
    {
      event_id: "evt-07-005",
      timestamp: 1004,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "response_done",
      payload: {
        type: "response_done",
        response_id: TEST_TURN_ID,
        status: "error",
        finish_reason: "content_filter",
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
    // 2. item_upsert created with partial content
    {
      payloadType: "item_upsert",
      payload: {
        type: "item_upsert",
        itemType: "message",
        changeType: "created",
        content: "I was starting to respond but",
      },
    },
    // 3. item_upsert error
    {
      payloadType: "item_upsert",
      payload: {
        type: "item_upsert",
        itemType: "error",
        changeType: "completed",
        content: "",
        errorCode: "CONTENT_FILTER",
        errorMessage: "Response blocked by content filter",
      },
    },
    // 4. turn_completed with error status
    {
      payloadType: "turn_event",
      payload: {
        type: "turn_completed",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
        status: "error",
      },
    },
  ],
};
