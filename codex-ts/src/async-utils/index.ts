/**
 * Error type representing cancellation of an async operation.
 */
export enum CancelErr {
  Cancelled = 'Cancelled',
}

/**
 * Result type for operations that can be cancelled.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: CancelErr };

/**
 * Races a promise against an AbortSignal, returning an error if the signal
 * is aborted before the promise resolves.
 *
 * This is similar to Rust's tokio::select! macro pattern for cancellation.
 *
 * @param promise - The promise to race
 * @param signal - The AbortSignal to check for cancellation
 * @returns A Result containing either the promise's value or a cancellation error
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 * const result = await orCancel(
 *   fetch('https://example.com'),
 *   controller.signal
 * );
 * if (result.ok) {
 *   console.log('Success:', result.value);
 * } else {
 *   console.log('Cancelled');
 * }
 * ```
 */
export async function orCancel<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<Result<T>> {
  // If already aborted, return immediately
  if (signal.aborted) {
    return { ok: false, error: CancelErr.Cancelled };
  }

  // Create a promise that rejects when the signal is aborted
  let abortHandler: (() => void) | null = null;
  const abortPromise = new Promise<never>((_, reject) => {
    abortHandler = () => {
      reject({ ok: false, error: CancelErr.Cancelled });
    };
    signal.addEventListener('abort', abortHandler);
  });

  try {
    // Race the original promise against the abort promise
    const value = await Promise.race([promise, abortPromise]);
    // Clean up the abort listener if the promise won first
    if (abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
    return { ok: true, value };
  } catch (error) {
    // Clean up the abort listener
    if (abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
    // If it's our cancellation error, return it
    if (
      typeof error === 'object' &&
      error !== null &&
      'ok' in error &&
      error.ok === false &&
      'error' in error &&
      error.error === CancelErr.Cancelled
    ) {
      return error as Result<T>;
    }
    // Otherwise, re-throw the original error
    throw error;
  }
}
