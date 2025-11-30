/**
 * TC-14: Redis Emit Retry Exhausted
 *
 * Scenario: All retry attempts fail.
 */

import type { StreamEvent } from "../../../schema.js";
import type { TestFixture } from "./types.js";
import { TEST_THREAD_ID, TEST_TRACE_CONTEXT, TEST_TURN_ID } from "./types.js";

export const tc14RetryExhausted: TestFixture = {
  id: "TC-14",
  name: "Redis emit retry exhausted",
  description: "Verify error is thrown when all retry attempts fail",

  options: {
    retryAttempts: 3,
    retryBaseMs: 10, // Short for testing
    retryMaxMs: 100,
  },

  onEmitBehavior: {
    type: "always_fail", // Always throw error
  },

  special: {
    expectedErrorCount: 1, // Expect error after retries exhausted
  },

  input: [
    // 1. response_start (processing should fail during this emit)
    {
      event_id: "evt-14-001",
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
  ] as StreamEvent[],

  expected: [
    // No emissions succeed - all fail
  ],
};
