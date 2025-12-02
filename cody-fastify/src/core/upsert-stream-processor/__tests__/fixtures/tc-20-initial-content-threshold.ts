/**
 * TC-20: Initial Content Counts Toward Threshold
 *
 * Scenario: item_start includes initial_content with ~15 tokens worth of text.
 * A subsequent item_delta adds a few more tokens, pushing total over the
 * default threshold (10 tokens). This should trigger a "create" emission
 * because the combined tokens (initial + delta) exceeded the threshold.
 *
 * This tests that the ContentBuffer constructor properly calculates tokens
 * from initialContent rather than starting at 0.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

// 60 chars = 15 tokens (at default threshold of 10, already over)
// But the "create" emission only happens when NEW content arrives after threshold is met
const INITIAL_CONTENT =
  "This is the initial content that comes with item_start.."; // 60 chars = 15 tokens

// 8 chars = 2 tokens - this should trigger "create" since we're already over threshold
const DELTA_CONTENT = " Hello!"; // 8 chars including space = 2 tokens

export const tc20InitialContentThreshold: TestFixture = {
  id: "TC-20",
  name: "Initial content counts toward threshold",
  description:
    "Verify that initial_content from item_start is counted toward token threshold",

  input: [
    // 1. response_start
    {
      event_id: "evt-20-001",
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
    // 2. item_start for message WITH initial_content (15 tokens)
    {
      event_id: "evt-20-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-20-001",
        item_type: "message",
        initial_content: INITIAL_CONTENT, // 60 chars = 15 tokens
      },
    },
    // 3. item_delta with 2 more tokens - should trigger "create" since we're over threshold
    {
      event_id: "evt-20-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-20-001",
        delta_content: DELTA_CONTENT, // 8 chars = 2 tokens
      },
    },
    // 4. item_done
    {
      event_id: "evt-20-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-20-001",
        final_item: {
          id: "msg-20-001",
          type: "message",
          content: INITIAL_CONTENT + DELTA_CONTENT,
          origin: "agent",
        },
      },
    },
    // 5. response_done
    {
      event_id: "evt-20-005",
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
          completion_tokens: 17,
          total_tokens: 27,
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
    // 2. message create - triggered because initial_content (15 tokens) exceeded
    //    threshold (10), and delta arrived with more content
    {
      payload: {
        type: "message",
        itemId: "msg-20-001",
        status: "create",
        content: INITIAL_CONTENT + DELTA_CONTENT,
        origin: "agent",
      },
    },
    // 3. message complete - on item_done
    {
      payload: {
        type: "message",
        itemId: "msg-20-001",
        status: "complete",
        content: INITIAL_CONTENT + DELTA_CONTENT,
        origin: "agent",
      },
    },
    // 4. turn_complete
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
