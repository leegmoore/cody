/**
 * TC-03: User Message (Held Until Complete)
 *
 * Scenario: User message should not emit until item_done to ensure correct origin.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc03UserMessage: TestFixture = {
  id: "TC-03",
  name: "User message held until complete",
  description:
    "Verify user messages are held and only emitted once on item_done with correct origin",

  input: [
    // 1. response_start
    {
      event_id: "evt-03-001",
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
    // 2. item_start for user message (note: item_id contains "user-prompt" pattern)
    {
      event_id: "evt-03-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-03-001-user-prompt",
        item_type: "message",
      },
    },
    // 3. item_done for user message
    {
      event_id: "evt-03-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-03-001-user-prompt",
        final_item: {
          id: "msg-03-001-user-prompt",
          type: "message",
          content: "What is the weather like today?",
          origin: "user",
        },
      },
    },
    // 4. item_start for agent message
    {
      event_id: "evt-03-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-03-002",
        item_type: "message",
      },
    },
    // 5. item_delta for agent
    {
      event_id: "evt-03-005",
      timestamp: 1004,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-03-002",
        delta_content: "I don't have access to weather data.",
      },
    },
    // 6. item_done for agent
    {
      event_id: "evt-03-006",
      timestamp: 1005,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-03-002",
        final_item: {
          id: "msg-03-002",
          type: "message",
          content: "I don't have access to weather data.",
          origin: "agent",
        },
      },
    },
    // 7. response_done
    {
      event_id: "evt-03-007",
      timestamp: 1006,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "response_done",
      payload: {
        type: "response_done",
        response_id: TEST_TURN_ID,
        status: "complete",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18,
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
    // 2. message for user (complete only - no create/update)
    {
      payload: {
        type: "message",
        itemId: "msg-03-001-user-prompt",
        status: "complete",
        content: "What is the weather like today?",
        origin: "user",
      },
    },
    // 3. message for agent (complete only - 10 tokens at threshold, not exceeding)
    {
      payload: {
        type: "message",
        itemId: "msg-03-002",
        status: "complete",
        content: "I don't have access to weather data.",
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
