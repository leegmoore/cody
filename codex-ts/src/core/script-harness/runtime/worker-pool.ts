/**
 * Worker pool for QuickJS runtime
 *
 * Maintains a pool of reusable QuickJS workers to avoid the overhead of
 * creating/destroying VMs for each script execution.
 *
 * Phase 4.5 - Performance Optimizations: Worker Pool
 *
 * Design:
 * - Pool size = min(2, CPU cores)
 * - Workers are borrowed/released
 * - Workers recycled after 100 scripts to prevent contamination
 * - Failed workers are replaced automatically
 */

import os from 'node:os';
import { getQuickJS, type QuickJSContext } from 'quickjs-emscripten';
import { HarnessInternalError } from '../errors.js';

/**
 * Worker state
 */
interface Worker {
  /** Unique worker ID */
  id: string;

  /** QuickJS context */
  context: QuickJSContext;

  /** Number of scripts executed by this worker */
  executionCount: number;

  /** When the worker was created */
  createdAt: number;

  /** Whether worker is currently in use */
  inUse: boolean;

  /** Whether worker is healthy */
  healthy: boolean;
}

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Pool size (default: min(2, cpuCount)) */
  size?: number;

  /** Maximum scripts per worker before recycling (default: 100) */
  maxScriptsPerWorker?: number;

  /** Enable worker reuse (default: true) */
  enableReuse?: boolean;
}

/**
 * Worker pool for QuickJS execution
 *
 * Manages a pool of reusable workers to reduce VM creation overhead.
 *
 * @example
 * ```typescript
 * const pool = new WorkerPool({ size: 2 });
 * await pool.initialize();
 *
 * const worker = await pool.borrow();
 * try {
 *   // Use worker...
 * } finally {
 *   await pool.release(worker);
 * }
 * ```
 */
export class WorkerPool {
  private config: Required<WorkerPoolConfig>;
  private workers: Worker[] = [];
  private nextWorkerId = 0;
  private initialized = false;
  private quickJS: Awaited<ReturnType<typeof getQuickJS>> | null = null;

  constructor(config: WorkerPoolConfig = {}) {
    const cpuCount = os.cpus().length;
    this.config = {
      size: config.size ?? Math.min(2, cpuCount),
      maxScriptsPerWorker: config.maxScriptsPerWorker ?? 100,
      enableReuse: config.enableReuse ?? true,
    };
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Get QuickJS instance once for all workers
    this.quickJS = await getQuickJS();

    // Create initial workers
    for (let i = 0; i < this.config.size; i++) {
      const worker = await this.createWorker();
      this.workers.push(worker);
    }

    this.initialized = true;
  }

  /**
   * Create a new worker
   */
  private async createWorker(): Promise<Worker> {
    if (!this.quickJS) {
      throw new HarnessInternalError('Worker pool not initialized');
    }

    const id = `worker_${this.nextWorkerId++}`;
    const context = this.quickJS.newContext();

    return {
      id,
      context,
      executionCount: 0,
      createdAt: Date.now(),
      inUse: false,
      healthy: true,
    };
  }

  /**
   * Borrow a worker from the pool
   *
   * If reuse is disabled, creates a fresh worker each time.
   * If all workers are busy, waits for one to become available.
   *
   * @param timeoutMs - Maximum time to wait for a worker (default: 5000ms)
   * @returns Worker context
   */
  async borrow(timeoutMs = 5000): Promise<Worker> {
    if (!this.initialized) {
      throw new HarnessInternalError('Worker pool not initialized - call initialize() first');
    }

    // If reuse disabled, create fresh worker
    if (!this.config.enableReuse) {
      return await this.createWorker();
    }

    const startTime = Date.now();

    // Wait for available worker
    while (true) {
      // Find available worker
      const available = this.workers.find((w) => !w.inUse && w.healthy);

      if (available) {
        // Check if worker needs recycling
        if (available.executionCount >= this.config.maxScriptsPerWorker) {
          // Recycle worker
          available.context.dispose();
          const replacement = await this.createWorker();
          const index = this.workers.indexOf(available);
          this.workers[index] = replacement;
          replacement.inUse = true;
          return replacement;
        }

        available.inUse = true;
        return available;
      }

      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new HarnessInternalError(`Worker pool exhausted - no workers available after ${timeoutMs}ms`);
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Release a worker back to the pool
   *
   * @param worker - Worker to release
   */
  async release(worker: Worker): Promise<void> {
    // If reuse disabled, dispose worker immediately
    if (!this.config.enableReuse) {
      worker.context.dispose();
      return;
    }

    // Increment execution count
    worker.executionCount++;
    worker.inUse = false;
  }

  /**
   * Mark a worker as unhealthy (will be replaced on next recycle)
   *
   * @param worker - Worker to mark
   */
  markUnhealthy(worker: Worker): void {
    worker.healthy = false;
    worker.inUse = false;

    // Try to replace immediately
    this.createWorker()
      .then((replacement) => {
        const index = this.workers.findIndex((w) => w.id === worker.id);
        if (index !== -1) {
          this.workers[index].context.dispose();
          this.workers[index] = replacement;
        }
      })
      .catch((error) => {
        console.error(`Failed to replace unhealthy worker ${worker.id}:`, error);
      });
  }

  /**
   * Get pool status
   */
  getStatus(): {
    size: number;
    available: number;
    busy: number;
    healthy: number;
    totalExecutions: number;
  } {
    const available = this.workers.filter((w) => !w.inUse && w.healthy).length;
    const busy = this.workers.filter((w) => w.inUse).length;
    const healthy = this.workers.filter((w) => w.healthy).length;
    const totalExecutions = this.workers.reduce((sum, w) => sum + w.executionCount, 0);

    return {
      size: this.workers.length,
      available,
      busy,
      healthy,
      totalExecutions,
    };
  }

  /**
   * Dispose the worker pool and cleanup all workers
   */
  async dispose(): Promise<void> {
    for (const worker of this.workers) {
      worker.context.dispose();
    }
    this.workers = [];
    this.initialized = false;
    this.quickJS = null;
  }
}
