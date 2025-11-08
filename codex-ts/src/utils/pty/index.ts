/**
 * PTY (pseudo-terminal) utilities for Codex.
 *
 * This module provides interfaces for spawning processes with PTY support.
 * The actual PTY implementation is intentionally stubbed, as it requires
 * native dependencies like `node-pty` which would add platform-specific
 * complexity to the library.
 *
 * Library consumers should provide their own implementation if needed.
 */

/**
 * PTY (pseudo-terminal) size configuration.
 */
export interface PtySize {
  /** Number of rows (lines) */
  rows: number;
  /** Number of columns (characters per line) */
  cols: number;
  /** Pixel width (optional, may be 0) */
  pixelWidth: number;
  /** Pixel height (optional, may be 0) */
  pixelHeight: number;
}

/**
 * A session for managing a PTY-spawned command.
 *
 * Provides methods to:
 * - Send input to the process
 * - Subscribe to output
 * - Check if the process has exited
 * - Get the exit code
 */
export interface ExecCommandSession {
  /**
   * Get a sender for writing input to the PTY process.
   * @returns Channel for sending input bytes
   */
  writerSender(): WriterSender;

  /**
   * Subscribe to output from the PTY process.
   * @returns Receiver for output bytes
   */
  outputReceiver(): OutputReceiver;

  /**
   * Check if the process has exited.
   * @returns true if the process has exited
   */
  hasExited(): boolean;

  /**
   * Get the exit code of the process.
   * @returns Exit code if available, undefined if still running
   */
  exitCode(): number | undefined;
}

/**
 * Channel for sending input to a PTY process.
 */
export interface WriterSender {
  /** Send bytes to the PTY stdin */
  send(bytes: Buffer): Promise<void>;
}

/**
 * Channel for receiving output from a PTY process.
 */
export interface OutputReceiver {
  /** Receive next chunk of output bytes */
  recv(): Promise<Buffer | null>;
}

/**
 * Channel for receiving the exit code when process terminates.
 */
export interface ExitReceiver {
  /** Wait for and receive the exit code */
  recv(): Promise<number>;
}

/**
 * Result of spawning a PTY process.
 */
export interface SpawnedPty {
  /** Session for managing the process */
  session: ExecCommandSession;
  /** Receiver for output bytes */
  outputRx: OutputReceiver;
  /** Receiver for exit code */
  exitRx: ExitReceiver;
}

/**
 * Spawn a process with PTY support.
 *
 * **Note:** This function is intentionally left unimplemented as a stub.
 * PTY operations require native dependencies which would add significant
 * complexity to the library. Library consumers should provide their own
 * implementation using libraries like `node-pty`.
 *
 * @param program - Program to execute
 * @param args - Command-line arguments
 * @param cwd - Working directory
 * @param env - Environment variables
 * @returns Promise resolving to spawned PTY
 * @throws Error if program is empty or PTY cannot be created
 *
 * @example
 * ```typescript
 * // Example implementation using 'node-pty' (not included):
 * import * as pty from 'node-pty'
 *
 * async function spawnPtyProcess(
 *   program: string,
 *   args: string[],
 *   cwd: string,
 *   env: Record<string, string>,
 * ): Promise<SpawnedPty> {
 *   if (!program) {
 *     throw new Error('missing program for PTY spawn')
 *   }
 *
 *   const ptyProcess = pty.spawn(program, args, {
 *     name: 'xterm-color',
 *     cols: 80,
 *     rows: 24,
 *     cwd,
 *     env,
 *   })
 *
 *   // Implement session, readers, writers, etc.
 *   return createSpawnedPty(ptyProcess)
 * }
 * ```
 */
export const spawnPtyProcess: undefined = undefined;
