import {
  AskForApproval,
  SandboxPolicy,
  newWorkspaceWritePolicy,
} from "../protocol/types.js";

/**
 * A simple preset pairing an approval policy with a sandbox policy.
 */
export interface ApprovalPreset {
  /** Stable identifier for the preset */
  id: string;
  /** Display label shown in UIs */
  label: string;
  /** Short human description shown next to the label in UIs */
  description: string;
  /** Approval policy to apply */
  approval: AskForApproval;
  /** Sandbox policy to apply */
  sandbox: SandboxPolicy;
}

/**
 * Built-in list of approval presets that pair approval and sandbox policy.
 *
 * Keep this UI-agnostic so it can be reused by both TUI and MCP server.
 *
 * @returns Array of approval presets
 *
 * @example
 * ```typescript
 * const presets = builtinApprovalPresets();
 * const readOnly = presets.find(p => p.id === 'read-only');
 * console.log(readOnly.description);
 * // "Codex can read files and answer questions..."
 * ```
 */
export function builtinApprovalPresets(): ApprovalPreset[] {
  return [
    {
      id: "read-only",
      label: "Read Only",
      description:
        "Codex can read files and answer questions. Codex requires approval to make edits, run commands, or access network.",
      approval: AskForApproval.OnRequest,
      sandbox: { type: "read-only" },
    },
    {
      id: "auto",
      label: "Auto",
      description:
        "Codex can read files, make edits, and run commands in the workspace. Codex requires approval to work outside the workspace or access network.",
      approval: AskForApproval.OnRequest,
      sandbox: newWorkspaceWritePolicy(),
    },
    {
      id: "full-access",
      label: "Full Access",
      description:
        "Codex can read files, make edits, and run commands with network access, without approval. Exercise caution.",
      approval: AskForApproval.Never,
      sandbox: { type: "danger-full-access" },
    },
  ];
}
