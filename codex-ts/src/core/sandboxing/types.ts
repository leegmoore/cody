/**
 * Types for sandbox execution environment management
 */

/**
 * Sandbox implementation type for different platforms
 */
export enum SandboxType {
  /** No sandboxing */
  None = "none",
  /** macOS Seatbelt sandbox */
  MacosSeatbelt = "macos-seatbelt",
  /** Linux Seccomp/Landlock sandbox */
  LinuxSeccomp = "linux-seccomp",
  /** Windows Restricted Token sandbox */
  WindowsRestrictedToken = "windows-restricted-token",
}

/**
 * Preference for sandbox usage
 */
export enum SandboxPreference {
  /** Automatically choose based on policy */
  Auto = "auto",
  /** Require sandbox if available */
  Require = "require",
  /** Forbid sandbox usage */
  Forbid = "forbid",
}

/**
 * Portable command specification before sandbox transformation
 */
export interface CommandSpec {
  /** Program to execute */
  program: string;
  /** Command arguments */
  args: string[];
  /** Working directory */
  cwd: string;
  /** Environment variables */
  env: Record<string, string>;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to run with elevated permissions */
  withEscalatedPermissions?: boolean;
  /** Justification for the command */
  justification?: string;
}

/**
 * Execution environment after sandbox transformation
 */
export interface ExecEnv {
  /** Full command including sandbox wrapper */
  command: string[];
  /** Working directory */
  cwd: string;
  /** Environment variables (includes sandbox-specific vars) */
  env: Record<string, string>;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Sandbox type being used */
  sandbox: SandboxType;
  /** Whether to run with elevated permissions */
  withEscalatedPermissions?: boolean;
  /** Justification for the command */
  justification?: string;
  /** Override for argv[0] (process name) */
  arg0?: string;
}

/**
 * Error during sandbox transformation
 */
export class SandboxTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxTransformError";
  }
}

/**
 * Environment variable indicating sandbox is active
 */
export const CODEX_SANDBOX_ENV_VAR = "CODEX_SANDBOX";

/**
 * Environment variable indicating network is disabled
 */
export const CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR =
  "CODEX_SANDBOX_NETWORK_DISABLED";
