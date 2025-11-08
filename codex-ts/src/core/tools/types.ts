/**
 * Tool system types and interfaces
 *
 * This is a simplified implementation for Phase 3.
 * Full orchestration, routing, and event handling will be
 * implemented in later phases when needed.
 */

/**
 * Tool preference for sandboxing
 */
export enum SandboxablePreference {
  /** Automatically choose based on tool */
  Auto = "auto",
  /** Require sandbox for this tool */
  Require = "require",
  /** Forbid sandbox for this tool */
  Forbid = "forbid",
}

/**
 * Telemetry preview limits
 */
export const TELEMETRY_PREVIEW_MAX_BYTES = 2 * 1024; // 2 KiB
export const TELEMETRY_PREVIEW_MAX_LINES = 64; // lines
export const TELEMETRY_PREVIEW_TRUNCATION_NOTICE =
  "[... telemetry preview truncated ...]";
