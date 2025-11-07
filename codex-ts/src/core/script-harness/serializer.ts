/**
 * Script result serializer
 *
 * Converts ExecutionResult from orchestrator into serialized format
 * for response processing pipeline.
 *
 * Phase 4.4 - Script Harness: Serialization
 */

import type { ExecutionResult, ScriptResult } from "./orchestrator.js";

/**
 * Serialized output for a single script
 */
export interface SerializedOutput {
  /** Output type */
  type: "result" | "error";

  /** Return value (if successful) */
  value?: unknown;

  /** Error (if failed) */
  error?: {
    code: string;
    message: string;
    phase: string;
  };

  /** Script index */
  index: number;

  /** Execution metadata */
  metadata: {
    duration_ms: number;
    tool_calls_made: number;
  };
}

/**
 * Serialized execution result
 */
export interface SerializedResult {
  /** Overall success */
  success: boolean;

  /** Script outputs */
  outputs: SerializedOutput[];

  /** Error (if overall execution failed) */
  error?: {
    code: string;
    message: string;
    phase: string;
    scriptIndex?: number;
  };

  /** Execution metadata */
  metadata: {
    totalDuration: number;
    scriptsExecuted: number;
    scriptsDetected: number;
  };
}

/**
 * Serialize execution result for response pipeline
 *
 * @param result - Execution result from orchestrator
 * @returns Serialized result
 */
export function serializeExecutionResult(
  result: ExecutionResult
): SerializedResult {
  // Serialize individual script outputs
  const outputs: SerializedOutput[] = result.scripts.map((script) =>
    serializeScriptResult(script)
  );

  return {
    success: result.ok,
    outputs,
    error: result.error,
    metadata: result.metadata,
  };
}

/**
 * Serialize a single script result
 */
function serializeScriptResult(script: ScriptResult): SerializedOutput {
  if (script.ok) {
    return {
      type: "result",
      value: script.returnValue,
      index: script.index,
      metadata: script.metadata,
    };
  } else {
    return {
      type: "error",
      error: script.error,
      index: script.index,
      metadata: script.metadata,
    };
  }
}
