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
      payloadType: "turn_event",
      payload: {
        type: "turn_started",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
      },
    },
    // 2. item_upsert created (from initial delta)
    {
      payloadType: "item_upsert",
      payload: {
        type: "item_upsert",
        changeType: "created",
        content: "This content is buffered but never completed...",
      },
    },
    // 3. item_upsert flushed on destroy (emitted as "updated" during flush)
    // Note: Depending on implementation, this might be "updated" or just not emitted
    // if nothing new was buffered. The key test is that destroy doesn't throw
    // and any pending content is handled.
    {
      payloadType: "item_upsert",
      payload: {
        type: "item_upsert",
        changeType: "updated",
        content: "This content is buffered but never completed...",
      },
    },
    // Note: No turn_completed because response_done never received
  ],
};
