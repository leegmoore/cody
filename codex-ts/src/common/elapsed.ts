/**
 * Convert a duration in milliseconds into a human-readable, compact string.
 *
 * Formatting rules:
 * - < 1 s  ->  "{milli}ms"
 * - < 60 s ->  "{sec:.2}s" (two decimal places)
 * - >= 60 s ->  "{min}m {sec:02}s"
 *
 * @param millis - Duration in milliseconds
 * @returns Formatted duration string
 *
 * @example
 * ```typescript
 * formatDuration(250)    // "250ms"
 * formatDuration(1500)   // "1.50s"
 * formatDuration(75000)  // "1m 15s"
 * ```
 */
export function formatDuration(millis: number): string {
  if (millis < 1000) {
    return `${millis}ms`;
  } else if (millis < 60_000) {
    const seconds = millis / 1000;
    return `${seconds.toFixed(2)}s`;
  } else {
    const minutes = Math.floor(millis / 60_000);
    const seconds = Math.floor((millis % 60_000) / 1000);
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
}

/**
 * Format elapsed time from a start timestamp.
 *
 * @param startTime - Start time in milliseconds (e.g., from Date.now())
 * @returns Formatted elapsed time string
 *
 * @example
 * ```typescript
 * const start = Date.now();
 * // ... do work ...
 * console.log(formatElapsed(start)); // "1.23s"
 * ```
 */
export function formatElapsed(startTime: number): string {
  const elapsed = Date.now() - startTime;
  return formatDuration(elapsed);
}
