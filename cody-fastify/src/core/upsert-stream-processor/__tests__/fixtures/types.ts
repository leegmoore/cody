/**
 * Test fixture types for UpsertStreamProcessor TDD tests.
 */

import type { StreamEvent } from "../../../schema.js";
import type { UITurnEvent, UIUpsert } from "../../types.js";

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

export interface ExpectedMessage {
  /** Payload type to verify */
  payloadType: "item_upsert" | "turn_event";

  /** Parsed payload to match against (partial matching supported) */
  payload: Partial<UIUpsert | UITurnEvent>;
}

// ---------------------------------------------------------------------------
// OnEmit Behavior Configuration
// ---------------------------------------------------------------------------

export type OnEmitBehavior =
  | { type: "success" } // Always succeed
  | { type: "fail_then_succeed"; failCount: number } // Fail N times then succeed
  | { type: "always_fail" }; // Always fail

// ---------------------------------------------------------------------------
// Test Fixture Interface
// ---------------------------------------------------------------------------

export interface TestFixture {
  /** Test case identifier (e.g., "TC-01") */
  id: string;

  /** Human-readable test name */
  name: string;

  /** Description of what this test verifies */
  description: string;

  /** Processor options overrides (optional) */
  options?: {
    batchGradient?: number[];
    batchTimeoutMs?: number;
    retryAttempts?: number;
    retryBaseMs?: number;
    retryMaxMs?: number;
  };

  /** Input: Array of StreamEvents to feed to processEvent() in order */
  input: StreamEvent[];

  /** Expected: Array of StreamBMessages that onEmit should receive */
  expected: ExpectedMessage[];

  /** For retry tests: configure onEmit behavior */
  onEmitBehavior?: OnEmitBehavior;

  /**
   * Special test handling flags.
   * Some tests require special execution handling (timing, early destroy, etc.)
   */
  special?: {
    /** If true, test involves timing delays between events */
    requiresTiming?: boolean;
    /** Delay in ms between specific events (array indices) */
    delayBetweenEvents?: { afterIndex: number; delayMs: number }[];
    /** If true, call destroy() without completing the sequence */
    earlyDestroy?: boolean;
    /** If set, expect this many errors from the test */
    expectedErrorCount?: number;
  };
}
