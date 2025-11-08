/**
 * Events emitted while pulling a model from Ollama.
 */
export type PullEvent =
  | { type: "status"; status: string }
  | {
      type: "chunk_progress";
      digest: string;
      total: number | undefined;
      completed: number | undefined;
    }
  | { type: "success" }
  | { type: "error"; message: string };

/**
 * Convert a single JSON object representing a pull update into one or more events.
 *
 * This parser handles the streaming JSON responses from Ollama's pull API,
 * extracting status updates and progress information.
 *
 * @param value - JSON object from Ollama pull stream
 * @returns Array of pull events extracted from the JSON
 *
 * @example
 * ```typescript
 * pullEventsFromValue({ status: 'verifying' });
 * // [{ type: 'status', status: 'verifying' }]
 *
 * pullEventsFromValue({ status: 'success' });
 * // [{ type: 'status', status: 'success' }, { type: 'success' }]
 *
 * pullEventsFromValue({ digest: 'sha256:abc', total: 100, completed: 50 });
 * // [{ type: 'chunk_progress', digest: 'sha256:abc', total: 100, completed: 50 }]
 * ```
 */
export function pullEventsFromValue(
  value: Record<string, unknown>,
): PullEvent[] {
  const events: PullEvent[] = [];

  // Parse status field
  if (typeof value.status === "string") {
    events.push({ type: "status", status: value.status });

    // Success status also emits a Success event
    if (value.status === "success") {
      events.push({ type: "success" });
    }
  }

  // Parse progress fields
  const digest = typeof value.digest === "string" ? value.digest : "";
  const total = typeof value.total === "number" ? value.total : undefined;
  const completed =
    typeof value.completed === "number" ? value.completed : undefined;

  // Only emit progress event if we have total or completed
  if (total !== undefined || completed !== undefined) {
    events.push({
      type: "chunk_progress",
      digest,
      total,
      completed,
    });
  }

  return events;
}
