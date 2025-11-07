/**
 * Retry logic with exponential backoff for Anthropic Messages API
 *
 * Handles transient errors (429, 529, 503) with configurable retry strategy.
 *
 * Design reference: MESSAGES_API_INTEGRATION_DESIGN_CODEX.md Section 2.10
 */

/**
 * Retry configuration parameters
 */
export interface RetryConfig {
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Backoff multiplier (default: 2x) */
  factor?: number;
  /** Jitter percentage (0.0 - 1.0, default: 0.2 for ±20%) */
  jitter?: number;
  /** Maximum delay cap in milliseconds */
  maxDelay?: number;
  /** Maximum number of retry attempts */
  maxAttempts?: number;
}

/**
 * Default retry configuration from design doc
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  initialDelay: 250, // 250ms
  factor: 2, // 2x exponential backoff
  jitter: 0.2, // ±20%
  maxDelay: 4000, // 4s cap
  maxAttempts: 6, // Up to 6 total attempts
};

/**
 * Error types that should trigger retry
 */
export const RETRYABLE_ERROR_TYPES = new Set([
  "rate_limit_error", // 429
  "overloaded_error", // 529
  "api_error", // 5xx
]);

/**
 * HTTP status codes that should trigger retry
 */
export const RETRYABLE_STATUS_CODES = new Set([
  429, // Rate limit
  500, // Internal server error
  502, // Bad gateway
  503, // Service unavailable
  504, // Gateway timeout
  529, // Overloaded (Anthropic-specific)
]);

/**
 * Calculate delay for a given retry attempt with exponential backoff and jitter.
 *
 * Formula: delay = min(initialDelay * (factor ^ attempt), maxDelay) * (1 ± jitter)
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = {},
): number {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };

  // Exponential backoff: initialDelay * (factor ^ attempt)
  const exponentialDelay = cfg.initialDelay * Math.pow(cfg.factor, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, cfg.maxDelay);

  // Apply jitter: ±jitter%
  const jitterRange = cappedDelay * cfg.jitter;
  const jitterOffset = (Math.random() * 2 - 1) * jitterRange;
  const finalDelay = cappedDelay + jitterOffset;

  return Math.max(0, Math.round(finalDelay));
}

/**
 * Determine if an error should trigger a retry.
 *
 * Retryable errors:
 * - HTTP 429 (rate limit)
 * - HTTP 503/529 (overloaded)
 * - Anthropic error types: rate_limit_error, overloaded_error, api_error
 *
 * Non-retryable errors:
 * - HTTP 400 (invalid request)
 * - HTTP 401 (auth error)
 * - HTTP 403 (permission error)
 * - HTTP 404 (not found)
 *
 * @param error - Error object or response
 * @returns True if error should be retried
 */
export function shouldRetry(error: any): boolean {
  // Check HTTP status code
  if (error.statusCode !== undefined) {
    return RETRYABLE_STATUS_CODES.has(error.statusCode);
  }

  // Check Anthropic error type
  if (error.errorType !== undefined) {
    return RETRYABLE_ERROR_TYPES.has(error.errorType);
  }

  // Check for network errors (no response received)
  if (error.message?.includes("fetch") || error.message?.includes("network")) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds with optional abort signal.
 *
 * @param ms - Milliseconds to sleep
 * @param signal - Optional AbortSignal to cancel sleep
 * @returns Promise that resolves after delay or rejects if aborted
 */
export async function sleep(
  ms: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    if (signal) {
      const abortHandler = () => {
        clearTimeout(timeout);
        reject(new Error("Aborted"));
      };
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  });
}

/**
 * Retry a function with exponential backoff.
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration
 * @param signal - Optional AbortSignal to cancel retries
 * @returns Promise with function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
  signal?: AbortSignal,
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;

  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new Error("Request aborted");
      }

      // Attempt the operation
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if not a retryable error
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === cfg.maxAttempts - 1) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateRetryDelay(attempt, cfg);
      console.error(
        `[retry] Attempt ${attempt + 1}/${cfg.maxAttempts} failed. Retrying in ${delay}ms...`,
        error.message || error,
      );

      await sleep(delay, signal);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}
