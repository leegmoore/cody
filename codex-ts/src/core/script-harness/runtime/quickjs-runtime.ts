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
          // Set up interrupt handler for timeout and cancellation
          vm.runtime.setInterruptHandler(() => {
            // Check timeout
            const elapsed = Date.now() - startTime;
            if (elapsed > mergedLimits.timeoutMs) {
              return true; // Interrupt execution
            }

            // Check abort signal
            if (signal?.aborted) {
              return true; // Interrupt execution
            }

            return false; // Continue execution
          });

          // Inject globals into VM
          for (const [key, value] of Object.entries(globals)) {
            if (typeof value === "function") {
              // Inject function as native QuickJS function
              // Note: Only synchronous functions are fully supported
              // Async functions cannot be bridged because:
              // 1. vm.newFunction() callback must return synchronously
              // 2. Promise .then() callbacks are queued as microtasks (async)
              // 3. No way to synchronously extract a Promise's resolved value
              const fnHandle = vm.newFunction(key, (...argHandles) => {
                // Convert QuickJS handles to JS values
                const args = argHandles.map((h) => vm.dump(h));

                // Call the original function
                const result = value(...args);

                // Sync result - convert back to QuickJS handle
                try {
                  return vm.unwrapResult(
                    vm.evalCode(`(${JSON.stringify(result)})`),
                  );
                } catch {
                  // If result can't be serialized, return undefined
                  return vm.undefined;
                }
              });

              vm.setProp(vm.global, key, fnHandle);
              fnHandle.dispose();
            } else {
              // Handle non-function values
              try {
                const handle = vm.unwrapResult(
                  vm.evalCode(`(${JSON.stringify(value)})`),
                );
                vm.setProp(vm.global, key, handle);
                handle.dispose();
              } catch (e) {
                // Skip values that can't be serialized
                continue;
              }
            }
          }

          // Detect if code has return statement or await
          const hasReturn = /\breturn\b/.test(sourceCode);
          const hasAwait = /\bawait\b/.test(sourceCode);

          // Wrap code appropriately
          let wrappedCode: string;
          let evalOptions: { type?: 'global' | 'module' } = {};

          if (hasAwait) {
            // Async code - wrap in async IIFE (newline prevents comment consumption)
            wrappedCode = `(async function() {\n${sourceCode}\n})()`;
          } else if (hasReturn) {
            // Sync code with return (newline prevents comment consumption)
            wrappedCode = `(function() {\n${sourceCode}\n})()`;
          } else {
            // Expression or statement
            wrappedCode = sourceCode;
          }

          // Execute the script
          const resultHandle = vm.evalCode(wrappedCode, undefined, evalOptions);

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

          // Check if result is a promise (only if we wrapped in async IIFE)
          let returnValue: any;

          if (hasAwait) {
            // We wrapped the code in async IIFE, so result is a promise
            const promiseState = vm.getPromiseState(resultHandle.value);

            if (promiseState.type === "pending") {
              // Execute pending jobs until promise resolves
              while (vm.runtime.hasPendingJob()) {
                const jobResult = vm.runtime.executePendingJobs();
                if (jobResult.error) {
                  jobResult.error.dispose();
                  break;
                }
                // Note: jobResult.value is a number (count), not a handle to dispose
              }

              // Check promise state again
              const finalState = vm.getPromiseState(resultHandle.value);
              if (finalState.error) {
                const errorObj = vm.dump(finalState.error);
                finalState.error.dispose();
                throw new Error(String(errorObj));
              }

              if (finalState.type === "fulfilled" && finalState.value) {
                returnValue = vm.dump(finalState.value);
                finalState.value.dispose();
              } else {
                // Promise still pending or rejected without explicit error
                throw new Error(`Promise in unexpected state: ${finalState.type}`);
              }
            } else if (promiseState.error) {
              const errorObj = vm.dump(promiseState.error);
              promiseState.error.dispose();
              throw new Error(String(errorObj));
            } else {
              // Promise already resolved
              returnValue = vm.dump(promiseState.value);
              promiseState.value.dispose();
            }
          } else {
            // Not async, just get the value directly
            returnValue = vm.dump(resultHandle.value);
          }

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
          // Clean up interrupt handler
          vm.runtime.removeInterruptHandler();

          // Release worker back to pool (or dispose if pool disabled)
          if (worker && this.workerPool) {
            await this.workerPool.release(worker);
          } else if (!this.workerPool) {
            vm.dispose();
          }
        }
      };

      // Execute (interrupt handler will handle timeout/cancellation)
      const result = await executeWithTimeout();

      return result;
    } catch (error: any) {
      // Handle execution errors
      const errorCode = error.name || error.constructor?.name || "Error";
      const errorMessage = error.message || String(error);

      // Detect interrupt errors and classify them
      let finalCode = errorCode;
      let finalMessage = errorMessage;

      // Check if this was an interrupt due to timeout or cancellation
      if (errorCode === "InternalError" && errorMessage.includes("interrupted")) {
        const elapsed = Date.now() - startTime;
        if (signal?.aborted) {
          finalCode = "ScriptCancelledError";
          finalMessage = "Script execution was cancelled";
        } else if (elapsed >= mergedLimits.timeoutMs) {
          finalCode = "ScriptTimeoutError";
          finalMessage = `Script exceeded timeout of ${mergedLimits.timeoutMs}ms`;
        }
      }

      return {
        ok: false,
        error: {
          code: finalCode,
          message: finalMessage,
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
