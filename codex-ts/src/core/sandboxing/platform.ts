/**
 * Platform detection and sandbox capability checking
 */

import { SandboxType } from "./types.js";

/**
 * Global flag to enable experimental Windows sandbox
 * (Default: false since Windows sandbox is experimental)
 */
let windowsSandboxEnabled = false;

/**
 * Set whether Windows sandbox is enabled
 */
export function setWindowsSandboxEnabled(enabled: boolean): void {
  windowsSandboxEnabled = enabled;
}

/**
 * Get whether Windows sandbox is enabled
 */
export function isWindowsSandboxEnabled(): boolean {
  return windowsSandboxEnabled;
}

/**
 * Get the platform-appropriate sandbox type, or None if unavailable
 */
export function getPlatformSandbox(): SandboxType | undefined {
  const platform = process.platform;

  switch (platform) {
    case "darwin":
      return SandboxType.MacosSeatbelt;

    case "linux":
      return SandboxType.LinuxSeccomp;

    case "win32":
      // Windows sandbox is experimental and opt-in
      return windowsSandboxEnabled
        ? SandboxType.WindowsRestrictedToken
        : undefined;

    default:
      return undefined;
  }
}

/**
 * Path to macOS seatbelt executable
 */
export const MACOS_PATH_TO_SEATBELT_EXECUTABLE = "/usr/bin/sandbox-exec";

/**
 * Check if a sandbox type is available on the current platform
 */
export function isSandboxAvailable(sandboxType: SandboxType): boolean {
  switch (sandboxType) {
    case SandboxType.None:
      return true;

    case SandboxType.MacosSeatbelt:
      return process.platform === "darwin";

    case SandboxType.LinuxSeccomp:
      return process.platform === "linux";

    case SandboxType.WindowsRestrictedToken:
      return process.platform === "win32" && windowsSandboxEnabled;

    default:
      return false;
  }
}
