/**
 * Error types for script harness
 *
 * Comprehensive error taxonomy for script execution failures.
 * Each error type includes context and metadata for debugging.
 *
 * Phase 4.4 - Script Harness: Error Handling
 * Design reference: SCRIPT_HARNESS_DESIGN_FINAL.md Section 5
 */

/**
 * Base class for all script harness errors
 */
export class ScriptHarnessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly phase: "parsing" | "executing" | "finalizing",
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Sanitize stack trace to remove host paths
   */
  getSanitizedStack(): string {
    if (!this.stack) return "";

    return this.stack
      .split("\n")
      .map((line) => {
        // Remove absolute paths
        line = line.replace(/\/[^\s:]+\//g, "");
        // Remove internal module names
        line = line.replace(/at\s+\w+\.<anonymous>/, "at <anonymous>");
        return line;
      })
      .slice(0, 10) // Cap at 10 frames
      .join("\n");
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      phase: this.phase,
      stack: this.getSanitizedStack(),
      metadata: this.metadata,
    };
  }
}

/**
 * Script syntax or compilation error
 *
 * Retryable: Yes (model can rewrite)
 * Reported: Error item with diagnostics (line/col), no host paths
 */
export class ScriptSyntaxError extends ScriptHarnessError {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly column?: number,
    public readonly snippet?: string,
  ) {
    super(
      message,
      "ScriptSyntaxError",
      "parsing",
      line !== undefined ? { line, column, snippet } : undefined,
    );
  }
}

/**
 * Script exceeded wall-clock timeout
 *
 * Retryable: Maybe (if optimizable)
 * Reported: Error item mentioning timeout, includes partial outputs emitted
 */
export class ScriptTimeoutError extends ScriptHarnessError {
  constructor(
    timeoutMs: number,
    public readonly elapsedMs: number,
    public readonly completedTools: number,
    public readonly pendingTools: number,
  ) {
    super(
      `Script exceeded ${timeoutMs}ms time limit`,
      "ScriptTimeoutError",
      "executing",
      { timeoutMs, elapsedMs, completedTools, pendingTools },
    );
  }
}

/**
 * Script exceeded memory limit
 *
 * Retryable: Maybe (model can simplify)
 * Reported: Error item encouraging task splitting
 */
export class ScriptMemoryError extends ScriptHarnessError {
  constructor(
    limitMb: number,
    public readonly usedMb?: number,
  ) {
    super(
      `Script exceeded ${limitMb}MB memory limit`,
      "ScriptMemoryError",
      "executing",
      { limitMb, usedMb },
    );
  }
}

/**
 * Script exceeded stack size limit
 *
 * Retryable: Maybe (model can reduce recursion)
 */
export class ScriptStackOverflowError extends ScriptHarnessError {
  constructor(
    limitBytes: number,
    public readonly depth?: number,
  ) {
    super(
      `Script exceeded ${limitBytes} bytes stack limit`,
      "ScriptStackOverflowError",
      "executing",
      { limitBytes, depth },
    );
  }
}

/**
 * User rejected tool approval
 *
 * Retryable: No (user decision)
 * Thrown into script; catchable; logged
 */
export class ApprovalDeniedError extends ScriptHarnessError {
  public readonly requestId?: string;

  constructor(
    public readonly toolName: string,
    reasonOrRequestId?: string,
  ) {
    // If reasonOrRequestId looks like an ID (starts with 'req_'), treat as requestId
    // Otherwise treat as reason (custom message)
    const isRequestId = reasonOrRequestId?.startsWith("req_");
    const reason = isRequestId ? undefined : reasonOrRequestId;
    const requestId = isRequestId ? reasonOrRequestId : undefined;

    super(
      reason || `User denied approval for tool: ${toolName}`,
      "ApprovalDeniedError",
      "executing",
      { toolName, requestId },
    );

    // Store requestId as instance property
    this.requestId = requestId;
  }
}

/**
 * No approval response within SLA
 *
 * Retryable: No
 * Thrown into script; catchable
 */
export class ApprovalTimeoutError extends ScriptHarnessError {
  constructor(
    public readonly toolName: string,
    public readonly timeoutMs: number,
  ) {
    super(
      `Approval timeout for tool: ${toolName} (${timeoutMs}ms)`,
      "ApprovalTimeoutError",
      "executing",
      { toolName, timeoutMs },
    );
  }
}

/**
 * Tool execution returned error/non-zero
 *
 * Retryable: Depends on tool
 * Bubbled with stderr (truncated to 2KB)
 */
export class ToolExecutionError extends ScriptHarnessError {
  public readonly stderr?: string;

  constructor(
    public readonly toolName: string,
    public readonly toolError: string,
    stderr?: string,
    public readonly exitCode?: number,
  ) {
    // Truncate stderr to 2KB for storage and display
    const truncatedStderr = stderr
      ? stderr.slice(0, 2048) + (stderr.length > 2048 ? "\n...<truncated>" : "")
      : undefined;

    super(
      `Tool execution failed: ${toolName} - ${toolError}`,
      "ToolExecutionError",
      "executing",
      { toolName, toolError, stderr: truncatedStderr, exitCode },
    );

    this.stderr = truncatedStderr;
  }
}

/**
 * Unknown tool name
 *
 * Retryable: Yes (model typo)
 * Immediate error with available tools list
 */
export class ToolNotFoundError extends ScriptHarnessError {
  constructor(
    public readonly toolName: string,
    public readonly availableTools: string[],
  ) {
    super(
      `Tool not found: ${toolName}. Available tools: ${availableTools.join(", ")}`,
      "ToolNotFoundError",
      "executing",
      { toolName, availableTools },
    );
  }
}

/**
 * Invalid tool arguments
 *
 * Retryable: Yes (model can fix)
 * Schema validation failure details
 */
export class ToolValidationError extends ScriptHarnessError {
  constructor(
    public readonly toolName: string,
    public readonly validationErrors: string[],
  ) {
    super(
      `Tool argument validation failed for ${toolName}: ${validationErrors.join(", ")}`,
      "ToolValidationError",
      "executing",
      { toolName, validationErrors },
    );
  }
}

/**
 * Unresolved promises when script ends
 *
 * Retryable: Maybe (model should await)
 * Lists pending tool calls
 */
export class DetachedPromiseError extends ScriptHarnessError {
  constructor(public readonly orphanedPromises: string[]) {
    super(
      `Orphaned promises detected: ${orphanedPromises.join(", ")}`,
      "DetachedPromiseError",
      "finalizing",
      { orphanedPromises },
    );
  }
}

/**
 * Worker crash, unexpected failure
 *
 * Retryable: Yes (auto-retry once)
 * Generic error, retry attempted
 */
export class HarnessInternalError extends ScriptHarnessError {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(
      `Internal harness error: ${message}`,
      "HarnessInternalError",
      "executing",
      {
        originalError:
          originalError instanceof Error
            ? originalError.message
            : String(originalError),
      },
    );
  }
}

/**
 * Return value cannot be serialized
 *
 * Retryable: Yes (model can simplify)
 * Reason (e.g., BigInt/Symbol unsupported)
 */
export class SerializationError extends ScriptHarnessError {
  constructor(
    message: string,
    public readonly valueType?: string,
  ) {
    super(
      `Cannot serialize return value: ${message}`,
      "SerializationError",
      "finalizing",
      { valueType },
    );
  }
}

/**
 * Script source exceeds size limit
 *
 * Retryable: Yes (model can simplify)
 */
export class ScriptTooLargeError extends ScriptHarnessError {
  constructor(
    public readonly sizeBytes: number,
    public readonly limitBytes: number,
  ) {
    super(
      `Script source too large: ${sizeBytes} bytes (limit: ${limitBytes})`,
      "ScriptTooLargeError",
      "parsing",
      { sizeBytes, limitBytes },
    );
  }
}

/**
 * Return payload exceeds size limit
 *
 * Retryable: Yes (model can reduce output)
 */
export class ReturnValueTooLargeError extends ScriptHarnessError {
  constructor(
    public readonly sizeBytes: number,
    public readonly limitBytes: number,
  ) {
    super(
      `Return value too large: ${sizeBytes} bytes (limit: ${limitBytes})`,
      "ReturnValueTooLargeError",
      "finalizing",
      { sizeBytes, limitBytes },
    );
  }
}

/**
 * Tool invocation budget exceeded
 *
 * Retryable: No
 */
export class ToolBudgetExceededError extends ScriptHarnessError {
  constructor(
    public readonly limit: number,
    public readonly attempted: number,
  ) {
    super(
      `Tool budget exceeded: ${attempted} calls (limit: ${limit})`,
      "ToolBudgetExceededError",
      "executing",
      { limit, attempted },
    );
  }
}

/**
 * Concurrent tool call limit exceeded
 *
 * Retryable: Maybe (model can serialize)
 */
export class ConcurrencyLimitError extends ScriptHarnessError {
  constructor(
    public readonly limit: number,
    public readonly pending: number,
  ) {
    super(
      `Concurrent tool limit exceeded: ${pending} pending (limit: ${limit})`,
      "ConcurrencyLimitError",
      "executing",
      { limit, pending },
    );
  }
}

/**
 * Banned identifier detected in source code
 *
 * Retryable: No (security violation)
 */
export class BannedIdentifierError extends ScriptHarnessError {
  constructor(public readonly identifiers: string[]) {
    super(
      `Banned identifiers detected in script: ${identifiers.join(", ")}`,
      "BannedIdentifierError",
      "parsing",
      { identifiers },
    );
  }
}

/**
 * Script execution cancelled by user or system
 *
 * Retryable: No
 */
export class ScriptCancelledError extends ScriptHarnessError {
  constructor(reason?: string) {
    super(
      `Script execution cancelled${reason ? `: ${reason}` : ""}`,
      "ScriptCancelledError",
      "executing",
      reason ? { reason } : undefined,
    );
  }
}

/**
 * Utility: Extract error information from unknown error
 */
export function extractErrorInfo(error: unknown): {
  message: string;
  code: string;
  stack?: string;
} {
  if (error instanceof ScriptHarnessError) {
    return {
      message: error.message,
      code: error.code,
      stack: error.getSanitizedStack(),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
    code: "UnknownError",
  };
}

/**
 * Utility: Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ScriptHarnessError)) {
    return false;
  }

  // Retryable error types
  const retryableErrors = new Set([
    "ScriptSyntaxError",
    "ScriptTimeoutError",
    "ScriptMemoryError",
    "ScriptStackOverflowError",
    "ToolExecutionError",
    "ToolNotFoundError",
    "ToolValidationError",
    "DetachedPromiseError",
    "HarnessInternalError",
    "SerializationError",
    "ScriptTooLargeError",
    "ReturnValueTooLargeError",
    "ConcurrencyLimitError",
  ]);

  return retryableErrors.has(error.code);
}
