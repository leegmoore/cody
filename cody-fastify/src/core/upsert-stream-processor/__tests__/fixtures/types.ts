/**
 * Test fixture types for StreamProcessor TDD tests.
 */

import type { StreamEvent } from "../../../schema.js";
import type { Content, TurnEvent } from "../../types.js";

// ---------------------------------------------------------------------------
// Test Constants
// ---------------------------------------------------------------------------

export const TEST_TURN_ID = "test-turn-00000000-0000-0000-0000-000000000001";
export const TEST_THREAD_ID = "test-thread-0000-0000-0000-0000-000000000001";
export const TEST_TRACE_CONTEXT = {
  traceparent: "00-test-trace-id-000000000000000000-span-id-00000000-01",
};

// ---------------------------------------------------------------------------
// Expected Message Type
// ---------------------------------------------------------------------------

export interface ExpectedOutput {
  /** Partial matching against the emitted Content or TurnEvent */
  payload: Partial<Content | TurnEvent>;
}

// ---------------------------------------------------------------------------
// OnEmit Behavior Configuration
// ---------------------------------------------------------------------------

export type OnEmitBehavior =
  | { type: "success" }
  | { type: "fail_then_succeed"; failCount: number }
  | { type: "always_fail" };

// ---------------------------------------------------------------------------
// Test Fixture Interface
// ---------------------------------------------------------------------------

export interface TestFixture {
  id: string;
  name: string;
  description: string;
  options?: {
    batchGradient?: number[];
    batchTimeoutMs?: number;
    retryAttempts?: number;
    retryBaseMs?: number;
    retryMaxMs?: number;
  };
  input: StreamEvent[];
  expected: ExpectedOutput[];
  onEmitBehavior?: OnEmitBehavior;
  special?: {
    requiresTiming?: boolean;
    delayBetweenEvents?: { afterIndex: number; delayMs: number }[];
    earlyDestroy?: boolean;
    expectedErrorCount?: number;
  };
}
