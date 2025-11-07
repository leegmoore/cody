/**
 * QuickJS runtime adapter for script execution
 *
 * Implements ScriptRuntimeAdapter using quickjs-emscripten for portable
 * WASM-based script execution with security isolation.
 *
 * NOTE: This is a simplified implementation for Phase 4.4.
 * Full worker pool, advanced timeout handling, and memory limits
 * will be added in future iterations.
 */

import { getQuickJS } from "quickjs-emscripten";
import type {
  ScriptRuntimeAdapter,
  ScriptExecutionResult,
  ScriptExecutionLimits,
} from "./types.js";
import { HarnessInternalError } from "../errors.js";

/**
 * QuickJS runtime configuration
 */
export interface QuickJSRuntimeConfig {
  /** Placeholder for future config */
  _placeholder?: never;
}

/**
 * QuickJS runtime adapter
 *
 * SIMPLIFIED IMPLEMENTATION: Creates fresh QuickJS VMs for each execution.
 * This version focuses on correct execution and global injection.
 * Timeouts, memory limits, and worker pools will be added later.
 *
 * @example
 * ```typescript
 * const runtime = new QuickJSRuntime();
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

  constructor(_config: QuickJSRuntimeConfig = {}) {
    // Reserved for future use
  }

  /**
   * Initialize the runtime
   */
  async initialize(config: ScriptExecutionLimits): Promise<void> {
    this.defaultLimits = config;
    this.initialized = true;
  }

  /**
   * Execute a script with injected globals
   *
   * LIMITATIONS in this version:
   * - Async/await not yet supported (TODO for next iteration)
   * - Timeouts not fully enforced (basic timeout wrapper only)
   * - Memory limits not enforced
   * - AbortSignal support is basic
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
        // Get QuickJS instance
        const QuickJS = await getQuickJS();
        const vm = QuickJS.newContext();

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
          vm.dispose();
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
    return {
      healthy: this.initialized,
      workersActive: 0,
      workersAvailable: 1,
    };
  }
}
