/**
 * TC-01: Simple Agent Message
 *
 * Scenario: Agent responds with a short message under one batch threshold.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc01SimpleMessage: TestFixture = {
  id: "TC-01",
  name: "Simple agent message",
  description:
    "Verify basic flow - response starts, agent sends short message, response completes",

  input: [
    // 1. response_start
    {
      event_id: "evt-01-001",
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
      event_id: "evt-01-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-01-001",
        item_type: "message",
      },
    },
    // 3. item_delta with content (12 chars = ~3 tokens, under 10 token threshold)
    {
      event_id: "evt-01-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-01-001",
        delta_content: "Hello there!",
      },
    },
    // 4. item_done
    {
      event_id: "evt-01-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-01-001",
        final_item: {
          id: "msg-01-001",
          type: "message",
          content: "Hello there!",
          origin: "agent",
        },
      },
    },
    // 5. response_done
    {
      event_id: "evt-01-005",
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
          completion_tokens: 3,
          total_tokens: 13,
        },
        finish_reason: "end_turn",
      },
    },
  ] as StreamEvent[],

  expected: [
    {
      payload: {
        type: "turn_started",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
        modelId: "claude-sonnet-4-20250514",
        providerId: "anthropic",
      },
    },
    {
      payload: {
        type: "message",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
        itemId: "msg-01-001",
        status: "create",
        content: "Hello there!",
        origin: "agent",
      },
    },
    {
      payload: {
        type: "message",
        itemId: "msg-01-001",
        status: "complete",
        content: "Hello there!",
        origin: "agent",
      },
    },
    {
      payload: {
        type: "turn_complete",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
        status: "complete",
        usage: {
          promptTokens: 10,
          completionTokens: 3,
          totalTokens: 13,
        },
      },
    },
  ],
};
