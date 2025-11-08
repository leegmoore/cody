/**
 * Tests for retry logic and error handling
 *
 * Phase 4.2 - Stage 10: Error Handling
 * Test IDs: EH-01 through EH-15, plus retry and cancellation tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateRetryDelay,
  shouldRetry,
  sleep,
  withRetry,
  DEFAULT_RETRY_CONFIG,
  RETRYABLE_STATUS_CODES,
  RETRYABLE_ERROR_TYPES,
} from "./retry.js";

describe("Retry Logic - Stage 10", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Retry Delay Calculation", () => {
    it("should calculate exponential backoff correctly", () => {
      const config = {
        initialDelay: 250,
        factor: 2,
        jitter: 0,
        maxDelay: 4000,
      };

      expect(calculateRetryDelay(0, config)).toBe(250); // 250 * 2^0
      expect(calculateRetryDelay(1, config)).toBe(500); // 250 * 2^1
      expect(calculateRetryDelay(2, config)).toBe(1000); // 250 * 2^2
      expect(calculateRetryDelay(3, config)).toBe(2000); // 250 * 2^3
      expect(calculateRetryDelay(4, config)).toBe(4000); // Capped at maxDelay
      expect(calculateRetryDelay(5, config)).toBe(4000); // Still capped
    });

    it("should apply jitter to delay", () => {
      const config = {
        initialDelay: 1000,
        factor: 1,
        jitter: 0.2,
        maxDelay: 10000,
      };

      // With 20% jitter, delay should be between 800-1200ms
      const delay = calculateRetryDelay(0, config);
      expect(delay).toBeGreaterThanOrEqual(800);
      expect(delay).toBeLessThanOrEqual(1200);
    });

    it("should use default config when not provided", () => {
      const delay = calculateRetryDelay(0);
      // Default: 250ms ± 20% = 200-300ms
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThanOrEqual(300);
    });

    it("should respect maxDelay cap", () => {
      const config = {
        initialDelay: 1000,
        factor: 10,
        jitter: 0,
        maxDelay: 2000,
      };

      // Even with factor of 10, should be capped at 2000ms
      expect(calculateRetryDelay(5, config)).toBe(2000);
    });
  });

  describe("Retryable Error Detection", () => {
    // EH-02: HTTP 429 should retry
    it("EH-02: should retry on 429 rate limit error", () => {
      const error = { statusCode: 429, errorType: "rate_limit_error" };
      expect(shouldRetry(error)).toBe(true);
    });

    // EH-03: HTTP 500 should retry
    it("EH-03: should retry on 500 server error", () => {
      const error = { statusCode: 500, errorType: "api_error" };
      expect(shouldRetry(error)).toBe(true);
    });

    it("should retry on 503 service unavailable", () => {
      const error = { statusCode: 503 };
      expect(shouldRetry(error)).toBe(true);
    });

    it("should retry on 529 overloaded error", () => {
      const error = { statusCode: 529, errorType: "overloaded_error" };
      expect(shouldRetry(error)).toBe(true);
    });

    // EH-01: HTTP 401 should NOT retry
    it("EH-01: should not retry on 401 auth error", () => {
      const error = { statusCode: 401, errorType: "authentication_error" };
      expect(shouldRetry(error)).toBe(false);
    });

    it("should not retry on 400 invalid request", () => {
      const error = { statusCode: 400, errorType: "invalid_request_error" };
      expect(shouldRetry(error)).toBe(false);
    });

    it("should not retry on 403 permission error", () => {
      const error = { statusCode: 403, errorType: "permission_error" };
      expect(shouldRetry(error)).toBe(false);
    });

    it("should not retry on 404 not found", () => {
      const error = { statusCode: 404, errorType: "not_found_error" };
      expect(shouldRetry(error)).toBe(false);
    });

    // EH-06: Network errors should retry
    it("EH-06: should retry on network errors", () => {
      const error = { message: "fetch failed: network error" };
      expect(shouldRetry(error)).toBe(true);
    });

    it("should retry based on error type alone", () => {
      expect(shouldRetry({ errorType: "rate_limit_error" })).toBe(true);
      expect(shouldRetry({ errorType: "overloaded_error" })).toBe(true);
      expect(shouldRetry({ errorType: "api_error" })).toBe(true);
    });
  });

  describe("Sleep with Cancellation", () => {
    // EH-05: Cancellation tests
    it("EH-05: should sleep for specified duration", async () => {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });

    it("should cancel sleep when signal aborted", async () => {
      const controller = new AbortController();
      const promise = sleep(5000, controller.signal);

      // Abort after 100ms
      setTimeout(() => controller.abort(), 100);
      vi.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow("Aborted");
    });

    it("should reject immediately if signal already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = sleep(1000, controller.signal);
      await expect(promise).rejects.toThrow("Aborted");
    });
  });

  describe("Retry with Backoff", () => {
    it("should succeed on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const result = await withRetry(fn, { maxAttempts: 3 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ statusCode: 429 })
        .mockRejectedValueOnce({ statusCode: 503 })
        .mockResolvedValue("success");

      const promise = withRetry(fn, {
        initialDelay: 100,
        factor: 2,
        jitter: 0,
        maxAttempts: 3,
      });

      // Advance through retries
      await vi.advanceTimersByTimeAsync(100); // First retry delay
      await vi.advanceTimersByTimeAsync(200); // Second retry delay

      await expect(promise).resolves.toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue({ statusCode: 401 });

      await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toMatchObject({
        statusCode: 401,
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should exhaust retries and throw last error", async () => {
      const error = { statusCode: 429, message: "Rate limited" };
      const fn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(fn, {
        initialDelay: 100,
        factor: 1,
        jitter: 0,
        maxAttempts: 3,
      });

      // Attach rejection handler immediately to prevent unhandled rejection
      const resultPromise = promise.catch((e) => e);

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);

      const result = await resultPromise;
      expect(result).toMatchObject({
        statusCode: 429,
        message: "Rate limited",
      });

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should respect abort signal", async () => {
      const controller = new AbortController();
      const fn = vi.fn().mockRejectedValue({ statusCode: 429 });

      const promise = withRetry(
        fn,
        { initialDelay: 1000, maxAttempts: 5 },
        controller.signal,
      );

      // Attach rejection handler immediately to prevent unhandled rejection
      const resultPromise = promise.catch((e) => e);

      // Abort after first attempt
      setTimeout(() => controller.abort(), 500);
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("Aborted");
    });

    it("should throw immediately if signal already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const fn = vi.fn().mockResolvedValue("success");

      await expect(
        withRetry(fn, { maxAttempts: 3 }, controller.signal),
      ).rejects.toThrow("Request aborted");

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("Configuration", () => {
    it("should use default retry config", () => {
      expect(DEFAULT_RETRY_CONFIG.initialDelay).toBe(250);
      expect(DEFAULT_RETRY_CONFIG.factor).toBe(2);
      expect(DEFAULT_RETRY_CONFIG.jitter).toBe(0.2);
      expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(4000);
      expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(6);
    });

    it("should define retryable status codes", () => {
      expect(RETRYABLE_STATUS_CODES.has(429)).toBe(true);
      expect(RETRYABLE_STATUS_CODES.has(503)).toBe(true);
      expect(RETRYABLE_STATUS_CODES.has(529)).toBe(true);
      expect(RETRYABLE_STATUS_CODES.has(401)).toBe(false);
    });

    it("should define retryable error types", () => {
      expect(RETRYABLE_ERROR_TYPES.has("rate_limit_error")).toBe(true);
      expect(RETRYABLE_ERROR_TYPES.has("overloaded_error")).toBe(true);
      expect(RETRYABLE_ERROR_TYPES.has("api_error")).toBe(true);
      expect(RETRYABLE_ERROR_TYPES.has("authentication_error")).toBe(false);
    });
  });
});
