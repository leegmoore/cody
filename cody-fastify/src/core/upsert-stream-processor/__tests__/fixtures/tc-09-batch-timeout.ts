/**
 * TC-09: Batch Timeout Safety Fallback
 *
 * Scenario: Stream stalls, timeout forces emit of buffered content.
 *
 * Note: This test requires actual timing delays to verify timeout behavior.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc09BatchTimeout: TestFixture = {
  id: "TC-09",
  name: "Batch timeout safety fallback",
  description:
    "Verify batch timeout forces emission of buffered content when stream stalls",

  options: {
    batchTimeoutMs: 50, // Short timeout for testing
    batchGradient: [100], // High threshold so we don't hit it naturally
  },

  special: {
    requiresTiming: true,
    // After event index 2 (the first delta), wait 60ms to trigger timeout
    delayBetweenEvents: [{ afterIndex: 2, delayMs: 60 }],
  },

  input: [
    // 1. response_start
    {
      event_id: "evt-09-001",
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
      event_id: "evt-09-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-09-001",
        item_type: "message",
      },
    },
    // 3. item_delta #1 (13 chars = ~3 tokens, under 100 token threshold)
    {
      event_id: "evt-09-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-09-001",
        delta_content: "First chunk. ",
      },
    },
    // (wait 60ms here - timeout fires after 50ms, forcing emit)
    // 4. item_delta #2 (arrives after timeout fired)
    {
      event_id: "evt-09-004",
      timestamp: 1063,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-09-001",
        delta_content: "Second chunk after delay.",
      },
    },
    // 5. item_done
    {
      event_id: "evt-09-005",
      timestamp: 1064,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-09-001",
        final_item: {
          id: "msg-09-001",
          type: "message",
          content: "First chunk. Second chunk after delay.",
          origin: "agent",
        },
      },
    },
    // 6. response_done
    {
      event_id: "evt-09-006",
      timestamp: 1065,
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
    // 2. message create (emitted when timeout fires)
    {
      payload: {
        type: "message",
        status: "create",
        content: "First chunk. ",
      },
    },
    // 3. message update (emitted on second delta or timeout)
    {
      payload: {
        type: "message",
        status: "update",
        content: "First chunk. Second chunk after delay.",
      },
    },
    // 4. message complete
    {
      payload: {
        type: "message",
        status: "complete",
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
