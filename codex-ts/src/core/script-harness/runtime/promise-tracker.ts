/**
 * Promise lifecycle tracker for script execution
 *
 * Tracks all tool promises to ensure proper cleanup and prevent orphaned tasks.
 * Implements the promise tracking strategy from the design spec with AbortController
 * integration for graceful cancellation.
 *
 * Phase 4.4 - Script Harness: Promise Lifecycle Management
 * Design reference: SCRIPT_HARNESS_DESIGN_FINAL.md Section 3.2
 */

/**
 * Information about a tracked promise
 */
interface TrackedPromise {
  /** The promise being tracked */
  promise: Promise<any>;

  /** AbortController to cancel the promise */
  abort: AbortController;

  /** Name of the tool that created this promise */
  toolName: string;

  /** When the promise was created (timestamp) */
  startTime: number;

  /** Current status */
  status: "pending" | "resolved" | "rejected" | "aborted";

  /** Result value (if resolved) */
  result?: any;

  /** Error (if rejected) */
  error?: any;
}

/**
 * Error thrown when orphaned promises are detected
 */
export class DetachedPromiseError extends Error {
  constructor(
    message: string,
    public readonly orphanedPromises: string[],
  ) {
    super(message);
    this.name = "DetachedPromiseError";
  }
}

/**
 * Promise lifecycle tracker
 *
 * Core responsibilities:
 * 1. Register all tool promises with unique IDs
 * 2. Track promise resolution/rejection
 * 3. Detect orphaned promises when script completes
 * 4. Abort pending promises with grace period
 * 5. Collect completed tool results for partial output
 *
 * Design patterns:
 * - Scenario 1 (Orphaned): Non-awaited promise → aborted after 250ms grace
 * - Scenario 2 (Promise.race): Loser aborted immediately when winner resolves
 * - Scenario 3 (Timeout): Mid-flight promises aborted when timeout fires
 */
export class PromiseTracker {
  private pending = new Map<string, TrackedPromise>();
  private completed = new Map<string, TrackedPromise>();
  private nextId = 0;
  private startTime = Date.now();
  private toolCallCount = 0;
  private peakMemory = 0;

  constructor(
    public readonly scriptId: string,
    private readonly maxConcurrent: number = 4,
  ) {}

  /**
   * Register a new promise for tracking
   *
   * @param toolName - Name of the tool creating this promise
   * @param promise - The promise to track
   * @param abort - AbortController to cancel the promise
   * @returns Unique identifier for this promise
   */
  register(
    toolName: string,
    promise: Promise<any>,
    abort: AbortController,
  ): string {
    const id = `tool_${this.nextId++}`;
    this.toolCallCount++;

    const tracked: TrackedPromise = {
      promise,
      abort,
      toolName,
      startTime: Date.now(),
      status: "pending",
    };

    this.pending.set(id, tracked);

    // Automatically update status when promise settles
    promise
      .then((result) => {
        if (this.pending.has(id)) {
          tracked.status = "resolved";
          tracked.result = result;
          this.pending.delete(id);
          this.completed.set(id, tracked);
        }
      })
      .catch((error) => {
        if (this.pending.has(id)) {
          tracked.status = "rejected";
          tracked.error = error;
          this.pending.delete(id);
          this.completed.set(id, tracked);
        }
      });

    return id;
  }

  /**
   * Mark a promise as completed (called by tool facade)
   *
   * @param id - Promise identifier
   */
  markComplete(id: string): void {
    const tracked = this.pending.get(id);
    if (tracked) {
      tracked.status = "resolved";
      this.pending.delete(id);
      this.completed.set(id, tracked);
    }
  }

  /**
   * Mark a promise as failed (called by tool facade)
   *
   * @param id - Promise identifier
   * @param error - Error that occurred
   */
  markFailed(id: string, error: any): void {
    const tracked = this.pending.get(id);
    if (tracked) {
      tracked.status = "rejected";
      tracked.error = error;
      this.pending.delete(id);
      this.completed.set(id, tracked);
    }
  }

  /**
   * Abort a specific promise
   *
   * @param id - Promise identifier
   * @param reason - Abort reason
   */
  abort(id: string, reason: string = "Aborted by tracker"): void {
    const tracked = this.pending.get(id);
    if (tracked && tracked.status === "pending") {
      tracked.status = "aborted";
      tracked.abort.abort(new Error(reason));
      this.pending.delete(id);
      this.completed.set(id, tracked);
    }
  }

  /**
   * Ensure all pending promises are settled before script completion
   *
   * This is the critical cleanup method that implements the promise lifecycle rules:
   * 1. Abort all pending promises
   * 2. Wait up to gracePeriodMs for cleanup
   * 3. Throw if any promises are still orphaned
   *
   * @param gracePeriodMs - How long to wait for cleanup (default: 250ms)
   * @throws DetachedPromiseError if promises remain orphaned after grace period
   */
  async ensureAllSettled(gracePeriodMs = 250): Promise<void> {
    // If no pending promises, we're done
    if (this.pending.size === 0) {
      return;
    }

    // Abort all pending promises
    const orphanedIds = Array.from(this.pending.keys());
    for (const [id, entry] of this.pending) {
      entry.abort.abort(
        new Error(`Script completed with pending promise: ${entry.toolName}`),
      );
    }

    // Wait for grace period with timeout
    const graceTimer = new Promise<void>((resolve) =>
      setTimeout(resolve, gracePeriodMs),
    );

    // Collect all pending promises
    const pendingPromises = Array.from(this.pending.values()).map((entry) =>
      entry.promise.catch(() => {
        /* ignore errors during cleanup */
      }),
    );

    // Race between cleanup completion and grace period timeout
    await Promise.race([Promise.allSettled(pendingPromises), graceTimer]);

    // If any promises are still pending, throw error
    if (this.pending.size > 0) {
      const stillOrphaned = Array.from(this.pending.entries()).map(
        ([id, entry]) => `${id} (${entry.toolName})`,
      );

      throw new DetachedPromiseError(
        `Orphaned promises detected: ${stillOrphaned.join(", ")}`,
        stillOrphaned,
      );
    }
  }

  /**
   * Get all pending promise IDs
   */
  getPendingIds(): string[] {
    return Array.from(this.pending.keys());
  }

  /**
   * Get all completed promise IDs
   */
  getCompletedIds(): string[] {
    return Array.from(this.completed.keys());
  }

  /**
   * Get total number of tool calls made
   */
  getToolCallCount(): number {
    return this.toolCallCount;
  }

  /**
   * Get elapsed time since tracker creation
   */
  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get peak memory usage (MB)
   *
   * Note: This is updated externally by the runtime
   */
  getPeakMemoryMb(): number {
    return this.peakMemory;
  }

  /**
   * Update peak memory usage
   *
   * @param memoryMb - Current memory usage in MB
   */
  updatePeakMemory(memoryMb: number): void {
    if (memoryMb > this.peakMemory) {
      this.peakMemory = memoryMb;
    }
  }

  /**
   * Get completed tool results for partial output
   *
   * Returns results from successfully completed tool calls,
   * useful when script fails mid-execution.
   */
  getCompletedResults(): Array<{ id: string; toolName: string; result: any }> {
    const results: Array<{ id: string; toolName: string; result: any }> = [];

    for (const [id, entry] of this.completed) {
      if (entry.status === "resolved" && entry.result !== undefined) {
        results.push({
          id,
          toolName: entry.toolName,
          result: entry.result,
        });
      }
    }

    return results;
  }

  /**
   * Get status summary for debugging
   */
  getStatus(): {
    pending: number;
    completed: number;
    total: number;
    elapsedMs: number;
  } {
    return {
      pending: this.pending.size,
      completed: this.completed.size,
      total: this.toolCallCount,
      elapsedMs: this.getElapsedMs(),
    };
  }

  /**
   * Abort all pending promises immediately
   *
   * Used when script execution is cancelled or times out.
   *
   * @param reason - Abort reason
   */
  abortAll(reason: string = "Script execution cancelled"): void {
    for (const [id, entry] of this.pending) {
      entry.status = "aborted";
      entry.abort.abort(new Error(reason));
    }
    // Move all to completed
    for (const [id, entry] of this.pending) {
      this.completed.set(id, entry);
    }
    this.pending.clear();
  }

  /**
   * Check if we've hit the concurrent promise limit
   */
  isAtConcurrencyLimit(): boolean {
    return this.pending.size >= this.maxConcurrent;
  }

  /**
   * Get details about a specific tracked promise
   */
  getPromiseInfo(id: string): TrackedPromise | undefined {
    return this.pending.get(id) || this.completed.get(id);
  }

  /**
   * Clear all tracking data (for cleanup)
   */
  clear(): void {
    this.abortAll("Tracker cleared");
    this.pending.clear();
    this.completed.clear();
    this.nextId = 0;
    this.toolCallCount = 0;
  }
}
