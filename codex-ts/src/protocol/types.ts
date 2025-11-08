/**
 * Minimal protocol types for codex-ts.
 *
 * These types are simplified versions of the Rust protocol types,
 * containing only what's needed for the ported utility modules.
 */

/**
 * Approval policy for tool execution.
 */
export enum AskForApproval {
  /** All commands require user approval */
  OnRequest = "on-request",
  /** Auto-approve safe commands, ask for risky ones */
  UnlessTrusted = "untrusted",
  /** Never ask for approval (dangerous!) */
  Never = "never",
}

/**
 * Sandbox policy for restricting tool access.
 */
export type SandboxPolicy =
  | { type: "danger-full-access" }
  | { type: "read-only" }
  | {
      type: "workspace-write";
      writableRoots: string[];
      networkAccess: boolean;
      excludeTmpdirEnvVar: boolean;
      excludeSlashTmp: boolean;
    };

/**
 * Helper to create a workspace-write policy with defaults.
 */
export function newWorkspaceWritePolicy(
  options: {
    writableRoots?: string[];
    networkAccess?: boolean;
    excludeTmpdirEnvVar?: boolean;
    excludeSlashTmp?: boolean;
  } = {},
): SandboxPolicy {
  return {
    type: "workspace-write",
    writableRoots: options.writableRoots || [],
    networkAccess: options.networkAccess || false,
    excludeTmpdirEnvVar: options.excludeTmpdirEnvVar || false,
    excludeSlashTmp: options.excludeSlashTmp || false,
  };
}

/**
 * Reasoning effort level for models that support reasoning.
 */
export enum ReasoningEffort {
  Minimal = "minimal",
  Low = "low",
  Medium = "medium",
  High = "high",
}
