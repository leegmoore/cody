/**
 * TC-04: Anthropic Thinking Block
 *
 * Scenario: Anthropic model emits thinking/reasoning before response.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc04Reasoning: TestFixture = {
  id: "TC-04",
  name: "Anthropic thinking block",
  description:
    "Verify thinking blocks are emitted with providerId for UI filtering",

  input: [
    // 1. response_start
    {
      event_id: "evt-04-001",
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
    // 2. item_start for reasoning
    {
      event_id: "evt-04-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "reasoning-04-001",
        item_type: "reasoning",
      },
    },
    // 3. item_delta for reasoning #1 (33 chars = ~8 tokens)
    {
      event_id: "evt-04-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "reasoning-04-001",
        delta_content: "Let me think about this problem. ",
      },
    },
    // 4. item_delta for reasoning #2 (41 chars = ~10 tokens, cumulative ~18)
    {
      event_id: "evt-04-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "reasoning-04-001",
        delta_content: "I should consider multiple factors here.",
      },
    },
    // 5. item_done for reasoning
    {
      event_id: "evt-04-005",
      timestamp: 1004,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "reasoning-04-001",
        final_item: {
          id: "reasoning-04-001",
          type: "reasoning",
          content:
            "Let me think about this problem. I should consider multiple factors here.",
          origin: "agent",
        },
      },
    },
    // 6. item_start for message
    {
      event_id: "evt-04-006",
      timestamp: 1005,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-04-001",
        item_type: "message",
      },
    },
    // 7. item_delta for message
    {
      event_id: "evt-04-007",
      timestamp: 1006,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-04-001",
        delta_content: "Based on my analysis, the answer is 42.",
      },
    },
    // 8. item_done for message
    {
      event_id: "evt-04-008",
      timestamp: 1007,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-04-001",
        final_item: {
          id: "msg-04-001",
          type: "message",
          content: "Based on my analysis, the answer is 42.",
          origin: "agent",
        },
      },
    },
    // 9. response_done
    {
      event_id: "evt-04-009",
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
          completion_tokens: 28,
          total_tokens: 38,
        },
        finish_reason: "end_turn",
      },
    },
  ] as StreamEvent[],

  expected: [
    // 1. turn_started with providerId
    {
      payload: {
        type: "turn_started",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
        providerId: "anthropic",
      },
    },
    // 2. thinking create
    {
      payload: {
        type: "thinking",
        status: "create",
        content: "Let me think about this problem. ",
        providerId: "anthropic",
      },
    },
    // 3. thinking update (after second delta crosses threshold)
    {
      payload: {
        type: "thinking",
        status: "update",
        content:
          "Let me think about this problem. I should consider multiple factors here.",
        providerId: "anthropic",
      },
    },
    // 4. thinking complete
    {
      payload: {
        type: "thinking",
        status: "complete",
        providerId: "anthropic",
      },
    },
    // 5. message create
    {
      payload: {
        type: "message",
        status: "create",
        origin: "agent",
      },
    },
    // 6. message complete
    {
      payload: {
        type: "message",
        status: "complete",
        origin: "agent",
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
