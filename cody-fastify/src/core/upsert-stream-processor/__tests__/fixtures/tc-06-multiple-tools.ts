/**
 * TC-06: Multiple Tool Calls in Sequence
 *
 * Scenario: Agent calls multiple tools before responding.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc06MultipleTools: TestFixture = {
  id: "TC-06",
  name: "Multiple tool calls in sequence",
  description: "Verify multiple tool calls are processed correctly in sequence",

  input: [
    // 1. response_start
    {
      event_id: "evt-06-001",
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
    // 2. item_start for function_call #1
    {
      event_id: "evt-06-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "fc-06-001",
        item_type: "function_call",
        name: "read_file",
      },
    },
    // 3. item_done for function_call #1
    {
      event_id: "evt-06-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "fc-06-001",
        final_item: {
          id: "fc-06-001",
          type: "function_call",
          name: "read_file",
          arguments: '{"path": "/tmp/input.txt"}',
          call_id: "call-06-001",
          origin: "agent",
        },
      },
    },
    // 4. item_start for function_call_output #1
    {
      event_id: "evt-06-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "fco-06-001",
        item_type: "function_call_output",
      },
    },
    // 5. item_done for function_call_output #1
    {
      event_id: "evt-06-005",
      timestamp: 1004,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "fco-06-001",
        final_item: {
          id: "fco-06-001",
          type: "function_call_output",
          call_id: "call-06-001",
          output: '{"content": "input data"}',
          success: true,
          origin: "system",
        },
      },
    },
    // 6. item_start for function_call #2
    {
      event_id: "evt-06-006",
      timestamp: 1005,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "fc-06-002",
        item_type: "function_call",
        name: "write_file",
      },
    },
    // 7. item_done for function_call #2
    {
      event_id: "evt-06-007",
      timestamp: 1006,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "fc-06-002",
        final_item: {
          id: "fc-06-002",
          type: "function_call",
          name: "write_file",
          arguments: '{"path": "/tmp/output.txt", "content": "processed"}',
          call_id: "call-06-002",
          origin: "agent",
        },
      },
    },
    // 8. item_start for function_call_output #2
    {
      event_id: "evt-06-008",
      timestamp: 1007,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "fco-06-002",
        item_type: "function_call_output",
      },
    },
    // 9. item_done for function_call_output #2
    {
      event_id: "evt-06-009",
      timestamp: 1008,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "fco-06-002",
        final_item: {
          id: "fco-06-002",
          type: "function_call_output",
          call_id: "call-06-002",
          output: '{"bytesWritten": 9}',
          success: true,
          origin: "system",
        },
      },
    },
    // 10. item_start for message
    {
      event_id: "evt-06-010",
      timestamp: 1009,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-06-001",
        item_type: "message",
      },
    },
    // 11. item_delta for message
    {
      event_id: "evt-06-011",
      timestamp: 1010,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-06-001",
        delta_content: "I found 2 files and read doc.txt for you.",
      },
    },
    // 12. item_done for message
    {
      event_id: "evt-06-012",
      timestamp: 1011,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-06-001",
        final_item: {
          id: "msg-06-001",
          type: "message",
          content: "I found 2 files and read doc.txt for you.",
          origin: "agent",
        },
      },
    },
    // 13. response_done
    {
      event_id: "evt-06-013",
      timestamp: 1012,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "response_done",
      payload: {
        type: "response_done",
        response_id: TEST_TURN_ID,
        status: "complete",
        usage: {
          prompt_tokens: 30,
          completion_tokens: 25,
          total_tokens: 55,
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
    // 2. tool_call #1 create
    {
      payload: {
        type: "tool_call",
        itemId: "fc-06-001",
        status: "create",
        toolName: "read_file",
        toolArguments: { path: "/tmp/input.txt" },
        callId: "call-06-001",
      },
    },
    // 3. tool_call #1 complete
    {
      payload: {
        type: "tool_call",
        itemId: "fc-06-001",
        status: "complete",
        toolName: "read_file",
        callId: "call-06-001",
        toolOutput: { content: "input data" },
        success: true,
      },
    },
    // 4. tool_call #2 create
    {
      payload: {
        type: "tool_call",
        itemId: "fc-06-002",
        status: "create",
        toolName: "write_file",
        toolArguments: { path: "/tmp/output.txt", content: "processed" },
        callId: "call-06-002",
      },
    },
    // 5. tool_call #2 complete
    {
      payload: {
        type: "tool_call",
        itemId: "fc-06-002",
        status: "complete",
        toolName: "write_file",
        callId: "call-06-002",
        toolOutput: { bytesWritten: 9 },
        success: true,
      },
    },
    // 6. message create
    {
      payload: {
        type: "message",
        itemId: "msg-06-001",
        status: "create",
        origin: "agent",
      },
    },
    // 7. message complete
    {
      payload: {
        type: "message",
        itemId: "msg-06-001",
        status: "complete",
        origin: "agent",
      },
    },
    // 8. turn_complete
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
