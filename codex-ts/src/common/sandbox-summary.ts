import { SandboxPolicy } from "../protocol/types.js";

/**
 * Create a human-readable summary of a sandbox policy.
 *
 * This generates a concise string representation of the sandbox policy
 * for display in UIs and logs.
 *
 * @param sandboxPolicy - The sandbox policy to summarize
 * @returns Human-readable summary string
 *
 * @example
 * ```typescript
 * summarizeSandboxPolicy({ type: 'read-only' });
 * // 'read-only'
 *
 * summarizeSandboxPolicy(newWorkspaceWritePolicy());
 * // 'workspace-write [workdir, /tmp, $TMPDIR]'
 *
 * summarizeSandboxPolicy(newWorkspaceWritePolicy({ networkAccess: true }));
 * // 'workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)'
 * ```
 */
export function summarizeSandboxPolicy(sandboxPolicy: SandboxPolicy): string {
  switch (sandboxPolicy.type) {
    case "danger-full-access":
      return "danger-full-access";

    case "read-only":
      return "read-only";

    case "workspace-write": {
      let summary = "workspace-write";

      // Build list of writable entries
      const writableEntries: string[] = ["workdir"];

      if (!sandboxPolicy.excludeSlashTmp) {
        writableEntries.push("/tmp");
      }

      if (!sandboxPolicy.excludeTmpdirEnvVar) {
        writableEntries.push("$TMPDIR");
      }

      writableEntries.push(...sandboxPolicy.writableRoots);

      summary += ` [${writableEntries.join(", ")}]`;

      if (sandboxPolicy.networkAccess) {
        summary += " (network access enabled)";
      }

      return summary;
    }
  }
}
