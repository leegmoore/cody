/**
 * Platform-specific sandbox command wrappers
 *
 * Note: These are stubs for Phase 3. Full implementations require platform-specific
 * sandbox policy files and templates which will be implemented when needed.
 */

import type { SandboxPolicy } from "../../protocol/protocol.js";

/**
 * Create macOS Seatbelt sandbox command arguments
 *
 * Wraps the command with sandbox-exec and a seatbelt profile.
 *
 * @param command - Original command to wrap
 * @param policy - Sandbox policy
 * @param policyBasePath - Base path for sandbox policy
 * @returns Arguments for sandbox-exec
 */
export function createSeatbeltCommandArgs(
  command: string[],
  policy: SandboxPolicy,
  policyBasePath: string,
): string[] {
  // Stub implementation - returns basic sandbox-exec invocation
  // Full implementation would generate/use a .sb (seatbelt) profile
  const args: string[] = [];

  // -p flag provides inline profile (simplified for now)
  args.push("-p", "(version 1)(allow default)");

  // Append the original command
  args.push(...command);

  return args;
}

/**
 * Create Linux Landlock/Seccomp sandbox command arguments
 *
 * Wraps the command with codex-linux-sandbox executable.
 *
 * @param command - Original command to wrap
 * @param policy - Sandbox policy
 * @param policyBasePath - Base path for sandbox policy
 * @returns Arguments for codex-linux-sandbox
 */
export function createLinuxSandboxCommandArgs(
  command: string[],
  policy: SandboxPolicy,
  policyBasePath: string,
): string[] {
  // Stub implementation - returns basic landlock invocation
  // Full implementation would pass detailed policy configuration
  const args: string[] = [];

  // Add policy configuration (simplified)
  args.push("--cwd", policyBasePath);

  // Add policy type
  if (policy.mode === "read-only") {
    args.push("--read-only");
  } else if (policy.mode === "workspace-write") {
    args.push("--workspace-write");
    if (policy.writable_roots) {
      for (const root of policy.writable_roots) {
        args.push("--writable-root", root);
      }
    }
  }

  // Separator before command
  args.push("--");

  // Append the original command
  args.push(...command);

  return args;
}
