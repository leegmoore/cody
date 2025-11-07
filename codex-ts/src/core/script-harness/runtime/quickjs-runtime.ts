/**
 * QuickJS runtime adapter for script execution
 *
 * Implements ScriptRuntimeAdapter using quickjs-emscripten for portable
 * WASM-based script execution with security isolation.
 *
 * Phase 4.5: Enhanced with worker pool for performance optimization.
 */

import { getQuickJS } from "quickjs-emscripten";
import type {
  ScriptRuntimeAdapter,
  ScriptExecutionResult,
  ScriptExecutionLimits,
} from "./types.js";
import { HarnessInternalError } from "../errors.js";
import { WorkerPool, type WorkerPoolConfig } from "./worker-pool.js";

/**
 * QuickJS runtime configuration
 */
export interface QuickJSRuntimeConfig {
  /** Worker pool configuration */
  workerPool?: WorkerPoolConfig;

  /** Enable worker pool (default: true) */
  useWorkerPool?: boolean;
}

/**
 * QuickJS runtime adapter
 *
 * Phase 4.5: Enhanced with worker pool for reusable workers.
 * Provides significant performance improvement by avoiding VM creation overhead.
 *
 * @example
 * ```typescript
 * const runtime = new QuickJSRuntime({ useWorkerPool: true });
 * await runtime.initialize({ timeoutMs: 5000 });
 *
 * const result = await runtime.execute(
 *   'return myValue * 2',
 *   { myValue: 21 },
 *   {}
 * );
 * // result.returnValue === 42
 * ```
 */
export class QuickJSRuntime implements ScriptRuntimeAdapter {
  readonly name = "quickjs";

  private defaultLimits?: ScriptExecutionLimits;
  private initialized = false;
  private workerPool?: WorkerPool;
  private useWorkerPool: boolean;

  constructor(config: QuickJSRuntimeConfig = {}) {
    this.useWorkerPool = config.useWorkerPool ?? true;
    if (this.useWorkerPool) {
      this.workerPool = new WorkerPool(config.workerPool);
    }
  }

  /**
   * Initialize the runtime
   */
  async initialize(config: ScriptExecutionLimits): Promise<void> {
    this.defaultLimits = config;

    // Initialize worker pool if enabled
    if (this.workerPool) {
      await this.workerPool.initialize();
    }

    this.initialized = true;
  }

  /**
   * Execute a script with injected globals
   *
   * Phase 4.5: Now uses worker pool for better performance.
   */
  async execute(
    sourceCode: string,
    globals: Record<string, unknown>,
    limits: Partial<ScriptExecutionLimits>,
    signal?: AbortSignal,
  ): Promise<ScriptExecutionResult> {
    if (!this.initialized) {
      throw new HarnessInternalError(
        "Runtime not initialized - call initialize() first",
      );
    }

    // Check if already aborted
    if (signal?.aborted) {
      return {
        ok: false,
        error: {
          code: "ScriptCancelledError",
          message: "Script execution cancelled before start",
          phase: "executing",
        },
        metadata: {
          duration_ms: 0,
          tool_calls_made: 0,
        },
      };
    }

    const mergedLimits = {
      ...this.defaultLimits!,
      ...limits,
    };

    const startTime = Date.now();

    try {
      // Create timeout wrapper
      const executeWithTimeout = async (): Promise<ScriptExecutionResult> => {
        // Borrow worker from pool (or create new if pool disabled)
        let vm;
        let worker;

        if (this.workerPool) {
          worker = await this.workerPool.borrow();
          vm = worker.context;
        } else {
          const QuickJS = await getQuickJS();
          vm = QuickJS.newContext();
        }

        try {
          // Set up cancellation handler
          if (signal) {
            signal.addEventListener(
              "abort",
              () => {
                vm.dispose();
              },
              { once: true },
            );
          }

          // Inject globals into VM
          for (const [key, value] of Object.entries(globals)) {
            try {
              // Convert JS value to QuickJS handle
              const handle = vm.unwrapResult(vm.evalCode(`(${JSON.stringify(value)})`));
              vm.setProp(vm.global, key, handle);
              handle.dispose();
            } catch (e) {
              // If JSON.stringify fails, try as function or skip
              if (typeof value === "function") {
                // For functions, we need to wrap them as native functions
                // This is complex in QuickJS, so for now we skip them
                // TODO: Implement proper function marshalling
                continue;
              }
            }
          }

          // Detect if code has return statement
          // If yes, wrap in IIFE. If no, eval directly for expression semantics.
          const hasReturn = /\breturn\b/.test(sourceCode);
          const wrappedCode = hasReturn
            ? `(function() { ${sourceCode} })()`
            : sourceCode;

          // Execute the script
          const resultHandle = vm.evalCode(wrappedCode);

          // Check if execution failed
          if (resultHandle.error) {
            const errorObj = vm.dump(resultHandle.error);
            resultHandle.error.dispose();

            // Extract error message and name
            let errorMessage: string;
            let errorName: string = "Error";

            if (typeof errorObj === "string") {
              errorMessage = errorObj;
            } else if (errorObj && typeof errorObj === "object") {
              if ("name" in errorObj && typeof errorObj.name === "string") {
                errorName = errorObj.name;
              }
              if ("message" in errorObj) {
                errorMessage = String(errorObj.message);
              } else {
                errorMessage = JSON.stringify(errorObj);
              }
            } else {
              errorMessage = JSON.stringify(errorObj);
            }

            // Create error with proper name
            const error = new Error(errorMessage);
            error.name = errorName;
            throw error;
          }

          // Get the return value
          const returnValue = vm.dump(resultHandle.value);
          resultHandle.value.dispose();

          return {
            ok: true,
            returnValue,
            metadata: {
              duration_ms: Date.now() - startTime,
              tool_calls_made: 0,
            },
          };
        } finally {
          // Release worker back to pool (or dispose if pool disabled)
          if (worker && this.workerPool) {
            await this.workerPool.release(worker);
          } else if (!this.workerPool) {
            vm.dispose();
          }
        }
      };

      // Execute with timeout
      const timeoutPromise = new Promise<ScriptExecutionResult>((resolve) => {
        setTimeout(() => {
          resolve({
            ok: false,
            error: {
              code: "ScriptTimeoutError",
              message: `Script exceeded timeout of ${mergedLimits.timeoutMs}ms`,
              phase: "executing",
            },
            metadata: {
              duration_ms: Date.now() - startTime,
              tool_calls_made: 0,
            },
          });
        }, mergedLimits.timeoutMs);
      });

      const result = await Promise.race([executeWithTimeout(), timeoutPromise]);

      return result;
    } catch (error: any) {
      // Handle execution errors
      const errorCode = error.name || error.constructor?.name || "Error";
      const errorMessage = error.message || String(error);

      return {
        ok: false,
        error: {
          code: errorCode,
          message: errorMessage,
          phase: "executing",
          stack: error.stack,
        },
        metadata: {
          duration_ms: Date.now() - startTime,
          tool_calls_made: 0,
        },
      };
    }
  }

  /**
   * Dispose runtime and cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.workerPool) {
      await this.workerPool.dispose();
    }
    this.initialized = false;
  }

  /**
   * Get runtime status
   */
  getStatus(): {
    healthy: boolean;
    workersActive: number;
    workersAvailable: number;
  } {
    if (this.workerPool) {
      const poolStatus = this.workerPool.getStatus();
      return {
        healthy: this.initialized,
        workersActive: poolStatus.busy,
        workersAvailable: poolStatus.available,
      };
    }

    return {
      healthy: this.initialized,
      workersActive: 0,
      workersAvailable: 1,
    };
  }
}
