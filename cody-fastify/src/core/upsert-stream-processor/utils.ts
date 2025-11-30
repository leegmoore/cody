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
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Estimates token count from text using chars/4 heuristic.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(_text: string): number {
  throw new NotImplementedError("estimateTokenCount");
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
  _attempt: number,
  _baseMs: number,
  _maxMs: number,
): number {
  throw new NotImplementedError("calculateRetryDelay");
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
export function parseJsonSafe<T>(_json: string): T | string {
  throw new NotImplementedError("parseJsonSafe");
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
