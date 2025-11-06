/**
 * Core execution types and interfaces
 */

/**
 * Parameters for executing a command
 */
export interface ExecParams {
  /** Command and arguments (first element is program, rest are args) */
  command: string[];
  /** Working directory */
  cwd: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Environment variables */
  env: Record<string, string>;
  /** Whether to run with elevated permissions */
  withEscalatedPermissions?: boolean;
  /** Justification for the command */
  justification?: string;
  /** Override for argv[0] (process name) */
  arg0?: string;
}

/**
 * Stream output with optional truncation info
 */
export interface StreamOutput<T> {
  /** The output text or bytes */
  text: T;
  /** Number of lines after which output was truncated (if truncated) */
  truncatedAfterLines?: number;
}

/**
 * Result of executing a command
 */
export interface ExecToolCallOutput {
  /** Exit code of the process */
  exitCode: number;
  /** Standard output */
  stdout: StreamOutput<string>;
  /** Standard error */
  stderr: StreamOutput<string>;
  /** Aggregated output (stdout + stderr interleaved) */
  aggregatedOutput: StreamOutput<string>;
  /** Duration of execution in milliseconds */
  durationMs: number;
  /** Whether the process timed out */
  timedOut: boolean;
}

/**
 * Default timeout for exec calls (10 seconds)
 */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Exit code used when a process times out
 */
export const EXEC_TIMEOUT_EXIT_CODE = 124;

/**
 * Maximum number of output delta events per exec call
 */
export const MAX_EXEC_OUTPUT_DELTAS_PER_CALL = 10_000;

/**
 * Error types for sandbox execution
 */
export class SandboxDeniedError extends Error {
  constructor(
    message: string,
    public output: ExecToolCallOutput,
  ) {
    super(message);
    this.name = 'SandboxDeniedError';
  }
}

export class SandboxTimeoutError extends Error {
  constructor(
    message: string,
    public output: ExecToolCallOutput,
  ) {
    super(message);
    this.name = 'SandboxTimeoutError';
  }
}

export class SandboxSignalError extends Error {
  constructor(
    message: string,
    public signal: number,
  ) {
    super(message);
    this.name = 'SandboxSignalError';
  }
}
