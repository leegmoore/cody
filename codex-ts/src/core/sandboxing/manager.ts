/**
 * Sandbox manager for selecting and transforming commands
 */

import type { SandboxPolicy } from "../../protocol/protocol.js";
import {
  CODEX_SANDBOX_ENV_VAR,
  CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR,
  type CommandSpec,
  type ExecEnv,
  SandboxPreference,
  SandboxTransformError,
  SandboxType,
} from "./types.js";
import {
  getPlatformSandbox,
  MACOS_PATH_TO_SEATBELT_EXECUTABLE,
} from "./platform.js";
import {
  createLinuxSandboxCommandArgs,
  createSeatbeltCommandArgs,
} from "./wrappers.js";

/**
 * Helper to check if policy has full network access
 */
function hasFullNetworkAccess(policy: SandboxPolicy): boolean {
  if (policy.mode === "danger-full-access") {
    return true;
  }
  if (policy.mode === "workspace-write") {
    return policy.network_access === true;
  }
  return false;
}

/**
 * Manages sandbox selection and command transformation
 */
export class SandboxManager {
  constructor() {}

  /**
   * Select initial sandbox type based on policy and preference
   *
   * @param policy - Sandbox policy
   * @param preference - Sandbox preference (Auto/Require/Forbid)
   * @returns Selected sandbox type
   */
  selectInitial(
    policy: SandboxPolicy,
    preference: SandboxPreference,
  ): SandboxType {
    switch (preference) {
      case SandboxPreference.Forbid:
        return SandboxType.None;

      case SandboxPreference.Require:
        // Require a platform sandbox when available
        return getPlatformSandbox() ?? SandboxType.None;

      case SandboxPreference.Auto:
        // Use sandbox for all policies except danger-full-access
        if (policy.mode === "danger-full-access") {
          return SandboxType.None;
        }
        return getPlatformSandbox() ?? SandboxType.None;

      default:
        return SandboxType.None;
    }
  }

  /**
   * Transform a CommandSpec into an ExecEnv by applying sandbox wrapping
   *
   * @param spec - Portable command specification
   * @param policy - Sandbox policy
   * @param sandbox - Sandbox type to use
   * @param sandboxPolicyCwd - Base path for sandbox policy
   * @param codexLinuxSandboxExe - Path to codex-linux-sandbox executable (required for Linux)
   * @returns Execution environment ready for spawning
   * @throws {SandboxTransformError} If required sandbox executable is missing
   */
  transform(
    spec: CommandSpec,
    policy: SandboxPolicy,
    sandbox: SandboxType,
    sandboxPolicyCwd: string,
    codexLinuxSandboxExe?: string,
  ): ExecEnv {
    // Clone and augment environment variables
    const env = { ...spec.env };

    // Add network disabled flag if policy doesn't allow network
    if (!hasFullNetworkAccess(policy)) {
      env[CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR] = "1";
    }

    // Build initial command array
    const command: string[] = [spec.program, ...spec.args];

    // Apply sandbox wrapping based on type
    let finalCommand: string[];
    const sandboxEnv: Record<string, string> = {};
    let arg0Override: string | undefined;

    switch (sandbox) {
      case SandboxType.None:
        finalCommand = command;
        break;

      case SandboxType.MacosSeatbelt: {
        sandboxEnv[CODEX_SANDBOX_ENV_VAR] = "seatbelt";
        const seatbeltArgs = createSeatbeltCommandArgs(
          command,
          policy,
          sandboxPolicyCwd,
        );
        finalCommand = [MACOS_PATH_TO_SEATBELT_EXECUTABLE, ...seatbeltArgs];
        break;
      }

      case SandboxType.LinuxSeccomp: {
        if (!codexLinuxSandboxExe) {
          throw new SandboxTransformError(
            "missing codex-linux-sandbox executable path",
          );
        }
        const linuxArgs = createLinuxSandboxCommandArgs(
          command,
          policy,
          sandboxPolicyCwd,
        );
        finalCommand = [codexLinuxSandboxExe, ...linuxArgs];
        arg0Override = "codex-linux-sandbox";
        break;
      }

      case SandboxType.WindowsRestrictedToken:
        // On Windows, the restricted token sandbox executes in-process.
        // We leave the command unchanged here and branch during execution.
        finalCommand = command;
        break;

      default:
        finalCommand = command;
        break;
    }

    // Merge sandbox-specific environment variables
    Object.assign(env, sandboxEnv);

    return {
      command: finalCommand,
      cwd: spec.cwd,
      env,
      timeoutMs: spec.timeoutMs,
      sandbox,
      withEscalatedPermissions: spec.withEscalatedPermissions,
      justification: spec.justification,
      arg0: arg0Override,
    };
  }
}
