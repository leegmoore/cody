/**
 * Formatting utilities for tool outputs
 */

import type { ExecToolCallOutput } from '../exec/types.js';

/**
 * Metadata included with exec output
 */
export interface ExecMetadata {
  exitCode: number;
  durationSeconds: number;
}

/**
 * Formatted exec output for model
 */
export interface FormattedExecOutput {
  output: string;
  metadata: ExecMetadata;
}

/**
 * Format exec output string for display
 *
 * @param execOutput - Execution output
 * @returns Formatted output string
 */
export function formatExecOutputStr(execOutput: ExecToolCallOutput): string {
  const { aggregatedOutput, timedOut, durationMs } = execOutput;
  const content = aggregatedOutput.text;

  if (timedOut) {
    return `command timed out after ${durationMs} milliseconds\n${content}`;
  }

  return content;
}

/**
 * Format exec output for sending to the model
 *
 * Includes exit code and duration metadata
 *
 * @param execOutput - Execution output
 * @returns JSON string formatted for model
 */
export function formatExecOutputForModel(execOutput: ExecToolCallOutput): string {
  const { exitCode, durationMs } = execOutput;

  // Round to 1 decimal place
  const durationSeconds = Math.round((durationMs / 1000) * 10) / 10;

  const formattedOutput = formatExecOutputStr(execOutput);

  const payload: FormattedExecOutput = {
    output: formattedOutput,
    metadata: {
      exitCode,
      durationSeconds,
    },
  };

  return JSON.stringify(payload);
}

/**
 * Truncate output for telemetry previews
 *
 * @param text - Text to truncate
 * @param maxBytes - Maximum bytes
 * @param maxLines - Maximum lines
 * @param truncationNotice - Notice to append if truncated
 * @returns Truncated text
 */
export function truncateForPreview(
  text: string,
  maxBytes: number = 2048,
  maxLines: number = 64,
  truncationNotice: string = '[... truncated ...]',
): string {
  let result = text;

  // Truncate by lines
  const lines = result.split('\n');
  if (lines.length > maxLines) {
    result = lines.slice(0, maxLines).join('\n') + '\n' + truncationNotice;
  }

  // Truncate by bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(result);
  if (bytes.length > maxBytes) {
    const suffix = '...\n' + truncationNotice;
    const suffixBytes = encoder.encode(suffix).length;

    // Binary search for the right length
    let low = 0;
    let high = result.length;
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      const testStr = result.substring(0, mid) + suffix;
      const testBytes = encoder.encode(testStr);
      if (testBytes.length <= maxBytes) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    result = result.substring(0, low) + suffix;
  }

  return result;
}
