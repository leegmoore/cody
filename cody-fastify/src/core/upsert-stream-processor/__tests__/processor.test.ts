/**
 * StreamProcessor TDD Tests
 *
 * These tests verify the StreamProcessor transforms StreamEvents to Content/TurnEvents.
 * All tests are expected to FAIL in the "Red" phase of TDD because the skeleton
 * methods throw NotImplementedError.
 */

import { describe, expect, test } from "bun:test";
import { assertEmissionsMatch, runFixture } from "./helpers.js";

// Import all fixtures
import { tc01SimpleMessage } from "./fixtures/tc-01-simple-message.js";
import { tc02Batching } from "./fixtures/tc-02-batching.js";
import { tc03UserMessage } from "./fixtures/tc-03-user-message.js";
import { tc04Reasoning } from "./fixtures/tc-04-reasoning.js";
import { tc05ToolCall } from "./fixtures/tc-05-tool-call.js";
import { tc06MultipleTools } from "./fixtures/tc-06-multiple-tools.js";
import { tc07ItemError } from "./fixtures/tc-07-item-error.js";
import { tc08ResponseError } from "./fixtures/tc-08-response-error.js";
import { tc09BatchTimeout } from "./fixtures/tc-09-batch-timeout.js";
import { tc10GradientProgression } from "./fixtures/tc-10-gradient-progression.js";
import { tc11EmptyContent } from "./fixtures/tc-11-empty-content.js";
import { tc12FlushOnDestroy } from "./fixtures/tc-12-flush-on-destroy.js";
import { tc13RetrySuccess } from "./fixtures/tc-13-retry-success.js";
import { tc14RetryExhausted } from "./fixtures/tc-14-retry-exhausted.js";
import { tc15ExactlyAtThreshold } from "./fixtures/tc-15-exactly-at-threshold.js";
import { tc16ThresholdPlusOne } from "./fixtures/tc-16-threshold-plus-one.js";
import { tc17SingleDeltaMultipleThresholds } from "./fixtures/tc-17-single-delta-multiple-thresholds.js";
import { tc18ItemCancelled } from "./fixtures/tc-18-item-cancelled.js";
import { tc19GradientExhaustion } from "./fixtures/tc-19-gradient-exhaustion.js";

describe("StreamProcessor", () => {
  describe("Happy Path Tests", () => {
    test("TC-01: Simple agent message", async () => {
      const fixture = tc01SimpleMessage;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-02: Agent message with batching", async () => {
      const fixture = tc02Batching;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-03: User message held until complete", async () => {
      const fixture = tc03UserMessage;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-04: Anthropic thinking block", async () => {
      const fixture = tc04Reasoning;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-05: Tool call and output", async () => {
      const fixture = tc05ToolCall;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-06: Multiple tool calls in sequence", async () => {
      const fixture = tc06MultipleTools;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });
  });

  describe("Error Handling Tests", () => {
    test("TC-07: Item error mid-stream", async () => {
      const fixture = tc07ItemError;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-08: Response error", async () => {
      const fixture = tc08ResponseError;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });
  });

  describe("Batching Behavior Tests", () => {
    test("TC-09: Batch timeout safety fallback", async () => {
      const fixture = tc09BatchTimeout;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-10: Batch gradient progression", async () => {
      const fixture = tc10GradientProgression;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-15: Exactly at threshold", async () => {
      const fixture = tc15ExactlyAtThreshold;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-16: Threshold plus one", async () => {
      const fixture = tc16ThresholdPlusOne;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-17: Single delta crosses multiple thresholds", async () => {
      const fixture = tc17SingleDeltaMultipleThresholds;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-19: Gradient exhaustion - continues with last value", async () => {
      const fixture = tc19GradientExhaustion;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });
  });

  describe("Edge Cases", () => {
    test("TC-11: Empty content item", async () => {
      const fixture = tc11EmptyContent;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-12: Flush on destroy", async () => {
      const fixture = tc12FlushOnDestroy;
      const result = await runFixture(fixture);

      // This test has incomplete sequence - destroy() called without response_done.
      // We do NOT check result.errors because early destroy may have incomplete state
      // and the processor may emit warnings or errors during cleanup. The important
      // assertion is that buffered content was properly flushed to emissions.
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-18: Item cancelled mid-stream", async () => {
      const fixture = tc18ItemCancelled;
      const result = await runFixture(fixture);

      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });
  });

  describe("Retry Logic Tests", () => {
    test("TC-13: Redis emit retry succeeds", async () => {
      const fixture = tc13RetrySuccess;
      const result = await runFixture(fixture);

      // Retries should succeed - no errors propagated
      expect(result.errors).toHaveLength(0);
      assertEmissionsMatch(result.emissions, fixture.expected);
    });

    test("TC-14: Redis emit retry exhausted", async () => {
      const fixture = tc14RetryExhausted;
      const result = await runFixture(fixture);

      // Should have error after retries exhausted
      expect(result.errors.length).toBeGreaterThan(0);

      // Error must NOT be NotImplementedError - that would mean skeleton, not retry logic
      const error = result.errors[0];
      expect(error.name).not.toBe("NotImplementedError");

      // Error should indicate retry exhaustion
      expect(error.name).toBe("RetryExhaustedError");

      // No emissions should succeed
      expect(result.emissions).toHaveLength(0);
    });
  });
});
