/**
 * Test helpers for UpsertStreamProcessor TDD tests.
 */

import { expect } from "bun:test";
import { UpsertStreamProcessor } from "../processor.js";
import type {
  StreamBMessage,
  UITurnEvent,
  UIUpsert,
  UpsertStreamProcessorOptions,
} from "../types.js";
import { sleep } from "../utils.js";
import type {
  ExpectedMessage,
  OnEmitBehavior,
  TestFixture,
} from "./fixtures/types.js";

// ---------------------------------------------------------------------------
// Captured Emission Type
// ---------------------------------------------------------------------------

export interface CapturedEmission {
  message: StreamBMessage;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Test Result Type
// ---------------------------------------------------------------------------

export interface TestResult {
  emissions: CapturedEmission[];
  errors: Error[];
}

// ---------------------------------------------------------------------------
// Mock onEmit Factory
// ---------------------------------------------------------------------------

export interface MockOnEmitResult {
  onEmit: (message: StreamBMessage) => Promise<void>;
  getEmissions: () => CapturedEmission[];
  getCallCount: () => number;
}

/**
 * Creates a mock onEmit function that captures emissions.
 *
 * @param behavior - How the mock should behave (success, fail_then_succeed, always_fail)
 * @returns Object with onEmit function and accessors for captured data
 */
export function createMockOnEmit(
  behavior: OnEmitBehavior = { type: "success" },
): MockOnEmitResult {
  const emissions: CapturedEmission[] = [];
  let callCount = 0;
  let failuresRemaining =
    behavior.type === "fail_then_succeed" ? behavior.failCount : 0;

  const onEmit = async (message: StreamBMessage): Promise<void> => {
    callCount++;

    if (behavior.type === "always_fail") {
      throw new Error("Mock Redis failure");
    }

    if (behavior.type === "fail_then_succeed" && failuresRemaining > 0) {
      failuresRemaining--;
      throw new Error("Mock Redis failure");
    }

    emissions.push({
      message,
      timestamp: Date.now(),
    });
  };

  return {
    onEmit,
    getEmissions: () => emissions,
    getCallCount: () => callCount,
  };
}

// ---------------------------------------------------------------------------
// Fixture Runner
// ---------------------------------------------------------------------------

/**
 * Runs a test fixture and returns results.
 *
 * @param fixture - The test fixture to run
 * @returns TestResult with emissions and errors
 */
export async function runFixture(fixture: TestFixture): Promise<TestResult> {
  const mock = createMockOnEmit(fixture.onEmitBehavior ?? { type: "success" });
  const errors: Error[] = [];

  const options: UpsertStreamProcessorOptions = {
    turnId: "test-turn-00000000-0000-0000-0000-000000000001",
    threadId: "test-thread-0000-0000-0000-0000-000000000001",
    onEmit: mock.onEmit,
    ...fixture.options,
  };

  const processor = new UpsertStreamProcessor(options);

  try {
    for (let i = 0; i < fixture.input.length; i++) {
      const event = fixture.input[i];

      // Handle special timing delays between events
      if (fixture.special?.delayBetweenEvents) {
        const delaySpec = fixture.special.delayBetweenEvents.find(
          (d) => d.afterIndex === i - 1,
        );
        if (delaySpec) {
          await sleep(delaySpec.delayMs);
        }
      }

      try {
        await processor.processEvent(event);
      } catch (error) {
        errors.push(error as Error);
      }
    }
  } finally {
    // For early destroy tests, we skip calling flush.
    // When earlyDestroy is false, we let the processor handle its own flushing
    // during destroy() - there's no explicit flush call because the processor
    // internally flushes pending items on destroy.

    try {
      processor.destroy();
    } catch (error) {
      errors.push(error as Error);
    }
  }

  return {
    emissions: mock.getEmissions(),
    errors,
  };
}

// ---------------------------------------------------------------------------
// Payload Parsing
// ---------------------------------------------------------------------------

/**
 * Parses payload from StreamBMessage for assertion.
 *
 * @param message - The StreamBMessage to parse
 * @returns Parsed UIUpsert or UITurnEvent
 */
export function parsePayload(message: StreamBMessage): UIUpsert | UITurnEvent {
  return JSON.parse(message.payload) as UIUpsert | UITurnEvent;
}

// ---------------------------------------------------------------------------
// Assertion Helpers
// ---------------------------------------------------------------------------

/**
 * Asserts emissions match expected, ignoring dynamic fields (eventId, timestamp).
 *
 * @param actual - Captured emissions from test run
 * @param expected - Expected messages from fixture
 */
export function assertEmissionsMatch(
  actual: CapturedEmission[],
  expected: ExpectedMessage[],
): void {
  // Diagnostic output on length mismatch for debugging test failures
  if (actual.length !== expected.length) {
    console.error("Emission count mismatch!");
    console.error(
      "Actual:",
      actual.map((e) => ({
        payloadType: e.message.payloadType,
        payload: JSON.parse(e.message.payload),
      })),
    );
    console.error(
      "Expected:",
      expected.map((e) => ({
        payloadType: e.payloadType,
        payload: e.payload,
      })),
    );
  }

  expect(actual.length).toBe(expected.length);

  for (let i = 0; i < expected.length; i++) {
    const actualMsg = actual[i].message;
    const expectedMsg = expected[i];

    // Check payload type
    expect(actualMsg.payloadType).toBe(expectedMsg.payloadType);

    // Parse and check payload (partial matching)
    const actualPayload = parsePayload(actualMsg);
    expect(actualPayload).toMatchObject(expectedMsg.payload);
  }
}
