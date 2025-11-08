/**
 * Core execution engine for running sandboxed commands
 */

import { spawn } from "child_process";
import type { SandboxPolicy } from "../../protocol/protocol.js";
import {
  SandboxManager,
  type CommandSpec,
  type ExecEnv,
  SandboxType,
} from "../sandboxing/index.js";
import {
  DEFAULT_TIMEOUT_MS,
  EXEC_TIMEOUT_EXIT_CODE,
  SandboxDeniedError,
  SandboxTimeoutError,
  type ExecParams,
  type ExecToolCallOutput,
  type StreamOutput,
} from "./types.js";

/**
 * Check if execution output likely indicates sandbox denial
 *
 * @param sandboxType - Type of sandbox used
 * @param output - Execution output
 * @returns true if output suggests sandbox denial
 */
export function isLikelySandboxDenied(
  sandboxType: SandboxType,
  output: ExecToolCallOutput,
): boolean {
  if (sandboxType === SandboxType.None || output.exitCode === 0) {
    return false;
  }

  // Keywords that suggest sandbox denial
  const SANDBOX_DENIED_KEYWORDS = [
    "operation not permitted",
    "permission denied",
    "read-only file system",
    "seccomp",
    "sandbox",
    "landlock",
    "failed to write file",
  ];

  // Check all output streams for sandbox keywords
  const outputs = [
    output.stderr.text,
    output.stdout.text,
    output.aggregatedOutput.text,
  ];

  const hasSandboxKeyword = outputs.some((text) => {
    const lower = text.toLowerCase();
    return SANDBOX_DENIED_KEYWORDS.some((keyword) => lower.includes(keyword));
  });

  if (hasSandboxKeyword) {
    return true;
  }

  // Quick reject: common non-sandbox exit codes
  const QUICK_REJECT_EXIT_CODES = [2, 126, 127];
  if (QUICK_REJECT_EXIT_CODES.includes(output.exitCode)) {
    return false;
  }

  // Check for SIGSYS signal on Linux seccomp (signal base 128 + 31 = 159)
  if (sandboxType === SandboxType.LinuxSeccomp && output.exitCode === 159) {
    return true;
  }

  return false;
}

/**
 * Execute a command with proper sandboxing
 *
 * @param params - Execution parameters
 * @param sandboxType - Type of sandbox to use
 * @param sandboxPolicy - Sandbox policy
 * @param sandboxCwd - Base directory for sandbox policy
 * @param codexLinuxSandboxExe - Path to Linux sandbox executable
 * @returns Execution output
 */
export async function processExecToolCall(
  params: ExecParams,
  sandboxType: SandboxType,
  sandboxPolicy: SandboxPolicy,
  sandboxCwd: string,
  codexLinuxSandboxExe?: string,
): Promise<ExecToolCallOutput> {
  const {
    command,
    cwd,
    timeoutMs,
    env,
    withEscalatedPermissions,
    justification,
  } = params;

  if (command.length === 0) {
    throw new Error("command args are empty");
  }

  const [program, ...args] = command;

  // Create command spec
  const spec: CommandSpec = {
    program,
    args,
    cwd,
    env,
    timeoutMs,
    withEscalatedPermissions,
    justification,
  };

  // Transform through sandbox manager
  const manager = new SandboxManager();
  const execEnv = manager.transform(
    spec,
    sandboxPolicy,
    sandboxType,
    sandboxCwd,
    codexLinuxSandboxExe,
  );

  // Execute the environment
  return executeExecEnv(execEnv, sandboxPolicy);
}

/**
 * Execute an ExecEnv
 *
 * @param env - Execution environment
 * @param sandboxPolicy - Sandbox policy
 * @returns Execution output
 */
export async function executeExecEnv(
  env: ExecEnv,
  _sandboxPolicy: SandboxPolicy,
): Promise<ExecToolCallOutput> {
  const startTime = Date.now();

  const rawOutput = await executeCommand(env);
  const duration = Date.now() - startTime;

  return finalizeExecResult(rawOutput, env.sandbox, duration);
}

/**
 * Execute a command using Node.js spawn
 */
async function executeCommand(env: ExecEnv): Promise<RawExecOutput> {
  const { command, cwd, env: envVars, timeoutMs, arg0: _arg0 } = env;

  if (command.length === 0) {
    throw new Error("command is empty");
  }

  const [program, ...args] = command;
  const timeout = timeoutMs || DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const aggregatedChunks: Buffer[] = [];

    let timedOut = false;
    let exitCode: number | null = null;

    const child = spawn(program, args, {
      cwd,
      env: envVars,
      stdio: ["ignore", "pipe", "pipe"],
      // arg0 override not directly supported in Node.js spawn
    });

    // Timeout handler
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      // Give it a moment, then force kill
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 1000);
    }, timeout);

    // Collect stdout
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      aggregatedChunks.push(chunk);
    });

    // Collect stderr
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      aggregatedChunks.push(chunk);
    });

    // Handle process exit
    child.on("close", (code, signal) => {
      clearTimeout(timeoutHandle);

      if (signal) {
        // Process was killed by signal
        exitCode = 128 + getSignalNumber(signal);
      } else if (code !== null) {
        exitCode = code;
      } else {
        exitCode = -1;
      }

      const stdout: StreamOutput<Buffer> = {
        text: Buffer.concat(stdoutChunks),
      };

      const stderr: StreamOutput<Buffer> = {
        text: Buffer.concat(stderrChunks),
      };

      const aggregatedOutput: StreamOutput<Buffer> = {
        text: Buffer.concat(aggregatedChunks),
      };

      resolve({
        exitCode: exitCode!,
        stdout,
        stderr,
        aggregatedOutput,
        timedOut,
      });
    });

    // Handle spawn errors
    child.on("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
}

/**
 * Get numeric value for signal name
 */
function getSignalNumber(signal: NodeJS.Signals): number {
  const signals: Record<string, number> = {
    SIGHUP: 1,
    SIGINT: 2,
    SIGQUIT: 3,
    SIGILL: 4,
    SIGTRAP: 5,
    SIGABRT: 6,
    SIGBUS: 7,
    SIGFPE: 8,
    SIGKILL: 9,
    SIGUSR1: 10,
    SIGSEGV: 11,
    SIGUSR2: 12,
    SIGPIPE: 13,
    SIGALRM: 14,
    SIGTERM: 15,
  };
  return signals[signal] || 15;
}

/**
 * Raw execution output (before finalization)
 */
interface RawExecOutput {
  exitCode: number;
  stdout: StreamOutput<Buffer>;
  stderr: StreamOutput<Buffer>;
  aggregatedOutput: StreamOutput<Buffer>;
  timedOut: boolean;
}

/**
 * Finalize execution result by converting to strings and checking for errors
 */
function finalizeExecResult(
  rawOutput: RawExecOutput,
  sandboxType: SandboxType,
  durationMs: number,
): ExecToolCallOutput {
  let { exitCode } = rawOutput;
  const { timedOut } = rawOutput;

  // Override exit code if timed out
  if (timedOut) {
    exitCode = EXEC_TIMEOUT_EXIT_CODE;
  }

  // Convert buffers to strings
  const stdout: StreamOutput<string> = {
    text: rawOutput.stdout.text.toString("utf8"),
    truncatedAfterLines: rawOutput.stdout.truncatedAfterLines,
  };

  const stderr: StreamOutput<string> = {
    text: rawOutput.stderr.text.toString("utf8"),
    truncatedAfterLines: rawOutput.stderr.truncatedAfterLines,
  };

  const aggregatedOutput: StreamOutput<string> = {
    text: rawOutput.aggregatedOutput.text.toString("utf8"),
    truncatedAfterLines: rawOutput.aggregatedOutput.truncatedAfterLines,
  };

  const output: ExecToolCallOutput = {
    exitCode,
    stdout,
    stderr,
    aggregatedOutput,
    durationMs,
    timedOut,
  };

  // Check for timeout error
  if (timedOut) {
    throw new SandboxTimeoutError(
      `Command timed out after ${durationMs}ms`,
      output,
    );
  }

  // Check for sandbox denial
  if (isLikelySandboxDenied(sandboxType, output)) {
    throw new SandboxDeniedError(
      "Command was likely denied by sandbox",
      output,
    );
  }

  return output;
}
