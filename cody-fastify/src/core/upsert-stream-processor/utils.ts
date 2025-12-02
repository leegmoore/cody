/**
 * Utility functions for UpsertStreamProcessor module.
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// NotImplementedError
// ---------------------------------------------------------------------------

/**
 * Error thrown by skeleton methods that are not yet implemented.
 */
export class NotImplementedError extends Error {
  constructor(methodName: string) {
    super(`${methodName} is not yet implemented`);
    this.name = "NotImplementedError";
  }
}

// ---------------------------------------------------------------------------
// RetryExhaustedError
// ---------------------------------------------------------------------------

/**
 * Error thrown when all retry attempts have been exhausted.
 */
export class RetryExhaustedError extends Error {
  constructor(attempts: number, lastError: Error) {
    super(
      `All ${attempts} retry attempts exhausted. Last error: ${lastError.message}`,
    );
    this.name = "RetryExhaustedError";
  }
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Estimates token count from text using chars/4 heuristic.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Sleep utility
// ---------------------------------------------------------------------------

/**
 * Promise-based sleep utility for retry delays.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after specified delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Retry delay calculation
// ---------------------------------------------------------------------------

/**
 * Calculates exponential backoff delay for retry attempt.
 *
 * @param attempt - Which attempt (0-indexed)
 * @param baseMs - Base delay in milliseconds
 * @param maxMs - Maximum delay cap
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attempt: number,
  baseMs: number,
  maxMs: number,
): number {
  // Exponential backoff: baseMs * 2^attempt
  const exponentialDelay = baseMs * Math.pow(2, attempt);
  // Add jitter (0-100% of delay) to prevent thundering herd
  const jitter = Math.random() * exponentialDelay;
  const delayWithJitter = exponentialDelay + jitter;
  // Cap at maxMs
  return Math.min(delayWithJitter, maxMs);
}

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

/**
 * Safely parses JSON, returns original string if parsing fails.
 *
 * @param json - JSON string to parse
 * @returns Parsed object or original string if parsing fails
 */
export function parseJsonSafe<T>(json: string): T | string {
  try {
    return JSON.parse(json) as T;
  } catch {
    return json;
  }
}

// ---------------------------------------------------------------------------
// Event ID generation
// ---------------------------------------------------------------------------

/**
 * Generates a UUID for event IDs.
 *
 * @returns UUID string
 */
export function generateEventId(): string {
  return randomUUID();
}
