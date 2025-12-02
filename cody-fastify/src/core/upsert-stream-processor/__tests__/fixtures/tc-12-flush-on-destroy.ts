/**
 * TC-12: Flush on Destroy
 *
 * Scenario: Processor destroyed with content still buffered.
 *
 * Note: This test has an incomplete event sequence - destroy() is called
 * without item_done or response_done.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc12FlushOnDestroy: TestFixture = {
  id: "TC-12",
  name: "Flush on destroy",
  description:
    "Verify buffered content is flushed when destroy() is called without response_done",

  special: {
    earlyDestroy: true, // Signal to test runner that sequence is incomplete
  },

  input: [
    // 1. response_start
    {
      event_id: "evt-12-001",
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
      event_id: "evt-12-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-12-001",
        item_type: "message",
      },
    },
    // 3. item_delta with content
    {
      event_id: "evt-12-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-12-001",
        delta_content: "This content is buffered but never completed...",
      },
    },
    // (No item_done, no response_done - destroy() called after this)
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
    // 2. message create (emitted on delta, before destroy)
    {
      payload: {
        type: "message",
        itemId: "msg-12-001",
        status: "create",
        content: "This content is buffered but never completed...",
      },
    },
    // NO THIRD EMISSION - destroy emits nothing if no new content
    // Note: No turn_complete because response_done never received
  ],
};
