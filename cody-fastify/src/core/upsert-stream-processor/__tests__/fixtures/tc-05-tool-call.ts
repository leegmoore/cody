/**
 * TC-05: Tool Call and Output
 *
 * Scenario: Agent calls a tool and receives output.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc05ToolCall: TestFixture = {
  id: "TC-05",
  name: "Tool call and output",
  description:
    "Verify function_call and function_call_output are transformed to tool_call with create and complete status",

  input: [
    // 1. response_start
    {
      event_id: "evt-05-001",
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
    // 2. item_start for function_call
    {
      event_id: "evt-05-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "fc-05-001",
        item_type: "function_call",
        name: "read_file",
      },
    },
    // 3. item_done for function_call
    {
      event_id: "evt-05-003",
      timestamp: 1002,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "fc-05-001",
        final_item: {
          id: "fc-05-001",
          type: "function_call",
          name: "read_file",
          arguments: '{"path": "/tmp/test.txt", "encoding": "utf-8"}',
          call_id: "call-05-001",
          origin: "agent",
        },
      },
    },
    // 4. item_start for function_call_output
    {
      event_id: "evt-05-004",
      timestamp: 1003,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "fco-05-001",
        item_type: "function_call_output",
      },
    },
    // 5. item_done for function_call_output
    {
      event_id: "evt-05-005",
      timestamp: 1004,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "fco-05-001",
        final_item: {
          id: "fco-05-001",
          type: "function_call_output",
          call_id: "call-05-001",
          output: '{"content": "Hello from file!", "bytes": 17}',
          success: true,
          origin: "system",
        },
      },
    },
    // 6. item_start for message
    {
      event_id: "evt-05-006",
      timestamp: 1005,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: "msg-05-001",
        item_type: "message",
      },
    },
    // 7. item_delta for message
    {
      event_id: "evt-05-007",
      timestamp: 1006,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: "msg-05-001",
        delta_content: "The file contains: Hello from file!",
      },
    },
    // 8. item_done for message
    {
      event_id: "evt-05-008",
      timestamp: 1007,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: "msg-05-001",
        final_item: {
          id: "msg-05-001",
          type: "message",
          content: "The file contains: Hello from file!",
          origin: "agent",
        },
      },
    },
    // 9. response_done
    {
      event_id: "evt-05-009",
      timestamp: 1008,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "response_done",
      payload: {
        type: "response_done",
        response_id: TEST_TURN_ID,
        status: "complete",
        usage: {
          prompt_tokens: 20,
          completion_tokens: 15,
          total_tokens: 35,
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
    // 2. tool_call create (on function_call item_done)
    {
      payload: {
        type: "tool_call",
        itemId: "fc-05-001",
        status: "create",
        content: "",
        toolName: "read_file",
        toolArguments: { path: "/tmp/test.txt", encoding: "utf-8" },
        callId: "call-05-001",
      },
    },
    // 3. tool_call complete (on function_call_output item_done)
    {
      payload: {
        type: "tool_call",
        itemId: "fc-05-001",
        status: "complete",
        content: "",
        toolName: "read_file",
        toolArguments: { path: "/tmp/test.txt", encoding: "utf-8" },
        callId: "call-05-001",
        toolOutput: { content: "Hello from file!", bytes: 17 },
        success: true,
      },
    },
    // 4. message complete only (35 chars = 9 tokens, under threshold)
    {
      payload: {
        type: "message",
        itemId: "msg-05-001",
        status: "complete",
        content: "The file contains: Hello from file!",
        origin: "agent",
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
