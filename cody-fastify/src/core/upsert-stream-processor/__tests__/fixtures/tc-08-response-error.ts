/**
 * TC-08: Response Error
 *
 * Scenario: Turn-level error occurs.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc08ResponseError: TestFixture = {
  id: "TC-08",
  name: "Response error",
  description:
    "Verify response_error events produce turn_error and no turn_complete",

  input: [
    // 1. response_start
    {
      event_id: "evt-08-001",
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
    // 2. response_error
    {
      event_id: "evt-08-002",
      timestamp: 1001,
      trace_context: TEST_TRACE_CONTEXT,
      run_id: TEST_TURN_ID,
      type: "response_error",
      payload: {
        type: "response_error",
        response_id: TEST_TURN_ID,
        error: {
          code: "PROVIDER_ERROR",
          message: "Provider returned 500 error",
        },
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
    // 2. turn_error (NOT turn_complete)
    {
      payload: {
        type: "turn_error",
        turnId: TEST_TURN_ID,
        threadId: TEST_THREAD_ID,
        error: {
          code: "PROVIDER_ERROR",
          message: "Provider returned 500 error",
        },
      },
    },
  ],
};
