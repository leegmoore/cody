/**
 * Shell detection module.
 * Ported from codex-rs/core/src/shell.rs
 *
 * NOTE: This is a STUB implementation for Phase 5.1.
 * Returns default bash shell. Full shell detection will be implemented later.
 */

export interface ZshShell {
  type: "zsh";
  shellPath: string;
  zshrcPath: string;
}

export interface BashShell {
  type: "bash";
  shellPath: string;
  bashrcPath: string;
}

export interface PowerShellConfig {
  type: "powershell";
  exe: string;
  bashExeFallback?: string;
}

export interface UnknownShell {
  type: "unknown";
}

export type Shell = ZshShell | BashShell | PowerShellConfig | UnknownShell;

/**
 * Get shell name from Shell object.
 */
export function getShellName(shell: Shell): string | undefined {
  switch (shell.type) {
    case "zsh":
      return "zsh";
    case "bash":
      return "bash";
    case "powershell":
      return shell.exe;
    case "unknown":
      return undefined;
  }
}

/**
 * Get the default user shell.
 *
 * STUB: Currently returns bash as default.
 * TODO: Implement full shell detection (getpwuid on Unix, registry on Windows)
 */
export async function defaultUserShell(): Promise<Shell> {
  // Stub implementation - always return bash
  return {
    type: "bash",
    shellPath: "/bin/bash",
    bashrcPath: "~/.bashrc",
  };
}
