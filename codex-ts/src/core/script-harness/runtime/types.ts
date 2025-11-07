/**
 * Script runtime adapter interface for script harness
 *
 * Defines the contract for sandboxed JavaScript runtimes (QuickJS, isolated-vm)
 * that execute LLM-generated tool composition scripts.
 *
 * Phase 4.4 - Script Harness Core Implementation
 * Design reference: SCRIPT_HARNESS_DESIGN_FINAL.md Section 2.1
 */

/**
 * Result of script execution
 */
export interface ScriptExecutionResult {
  /** Whether execution succeeded */
  ok: boolean;

  /** Return value from script (if successful) */
  returnValue?: unknown;

  /** Error that occurred (if failed) */
  error?: ScriptError;

  /** Partial results if script failed mid-execution */
  partialResults?: unknown;

  /** Execution metadata */
  metadata: {
    /** Duration in milliseconds */
    duration_ms: number;

    /** Number of tool calls made */
    tool_calls_made: number;

    /** Peak memory usage in MB */
    memory_used_mb?: number;
  };
}

/**
 * Script execution error with sanitized stack trace
 */
export interface ScriptError {
  /** Error code (e.g., "ScriptTimeoutError", "ScriptSyntaxError") */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Phase where error occurred */
  phase: "parsing" | "executing" | "finalizing";

  /** Tool name if error occurred during specific tool call */
  toolName?: string;

  /** Sanitized stack trace (no host paths) */
  stack?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for script execution limits
 */
export interface ScriptExecutionLimits {
  /** Wall-clock timeout in milliseconds (default: 30000) */
  timeoutMs: number;

  /** Memory limit in megabytes (default: 96) */
  memoryMb: number;

  /** Maximum stack size in bytes (default: 524288 / 512KB) */
  maxStackBytes: number;

  /** Maximum script source length in bytes (default: 20000) */
  maxSourceBytes: number;

  /** Maximum return payload size in bytes (default: 131072 / 128KB) */
  maxReturnBytes: number;

  /** Maximum number of tool invocations per script (default: 32) */
  maxToolInvocations: number;

  /** Maximum concurrent tool calls (default: 4) */
  maxConcurrentToolCalls: number;
}

/**
 * Default execution limits from design spec
 */
export const DEFAULT_SCRIPT_LIMITS: ScriptExecutionLimits = {
  timeoutMs: 30000,
  memoryMb: 96,
  maxStackBytes: 524288,
  maxSourceBytes: 20000,
  maxReturnBytes: 131072,
  maxToolInvocations: 32,
  maxConcurrentToolCalls: 4,
};

/**
 * Context passed to executing scripts
 */
export interface ScriptContext {
  // Identity
  conversationId: string;
  sessionId: string;
  turnId: string;
  scriptId: string;

  // Environment
  workingDirectory: string;
  provider: string;
  model: string;

  // Sandbox limits
  sandbox: {
    timeoutMs: number;
    memoryMb: number;
    remainingToolBudget: number;
    maxConcurrentToolCalls: number;
    mode: "disabled" | "dry-run" | "enabled";
  };

  // Capabilities
  capabilities: {
    tools: string[];
  };

  // Approvals
  approvals: {
    required: boolean;
    lastRequestId?: string;
  };

  // Telemetry
  telemetry: {
    emitProgress(message: string, kind?: "info" | "warn"): void;
  };
}

/**
 * Runtime adapter interface for executing scripts in isolated sandboxes
 *
 * Implementations:
 * - QuickJSRuntime: WASM-based QuickJS runtime (default, portable)
 * - IsolatedVMRuntime: V8 isolate runtime (optional, high-security)
 */
export interface ScriptRuntimeAdapter {
  /**
   * Runtime identifier (e.g., "quickjs", "isolated-vm")
   */
  readonly name: string;

  /**
   * Initialize the runtime (e.g., spawn worker pool)
   */
  initialize(config: ScriptExecutionLimits): Promise<void>;

  /**
   * Execute a script with injected globals
   *
   * @param sourceCode - TypeScript/JavaScript source code
   * @param globals - Global objects to inject (tools, context, console)
   * @param limits - Execution limits (overrides defaults)
   * @param signal - Optional AbortSignal for cancellation
   * @returns Execution result with return value or error
   */
  execute(
    sourceCode: string,
    globals: Record<string, unknown>,
    limits: Partial<ScriptExecutionLimits>,
    signal?: AbortSignal,
  ): Promise<ScriptExecutionResult>;

  /**
   * Dispose runtime and cleanup resources (e.g., terminate workers)
   */
  dispose(): Promise<void>;

  /**
   * Get runtime health/status (for monitoring)
   */
  getStatus(): {
    healthy: boolean;
    workersActive: number;
    workersAvailable: number;
  };
}

/**
 * Factory function type for creating runtime adapters
 */
export type RuntimeAdapterFactory = (
  config: ScriptExecutionLimits,
) => Promise<ScriptRuntimeAdapter>;
