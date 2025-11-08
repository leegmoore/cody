/**
 * Environment context for conversation turns.
 * Ported from codex-rs/core/src/environment_context.rs
 *
 * NOTE: This is a SIMPLIFIED implementation for Phase 5.1.
 * Includes basic fields: cwd, sandbox_mode, network_access, shell.
 * Omits complex writable_roots logic and approval_policy for MVP.
 */

import type { Shell } from '../shell'

/**
 * Network access level.
 */
export enum NetworkAccess {
  Restricted = 'restricted',
  Enabled = 'enabled',
}

/**
 * Sandbox mode setting.
 */
export enum SandboxMode {
  DangerFullAccess = 'danger-full-access',
  ReadOnly = 'read-only',
  WorkspaceWrite = 'workspace-write',
}

/**
 * Environment context provided to the model for each turn.
 * Describes the execution environment available to the assistant.
 */
export interface EnvironmentContext {
  /** Current working directory */
  cwd?: string
  /** Sandbox mode setting */
  sandboxMode?: SandboxMode
  /** Network access level */
  networkAccess?: NetworkAccess
  /** Shell configuration */
  shell?: Shell
}

/**
 * Creates an environment context from basic parameters.
 *
 * @param cwd - Current working directory
 * @param sandboxMode - Sandbox mode
 * @param networkAccess - Network access level
 * @param shell - Shell configuration
 */
export function createEnvironmentContext(
  cwd?: string,
  sandboxMode?: SandboxMode,
  networkAccess?: NetworkAccess,
  shell?: Shell
): EnvironmentContext {
  return {
    cwd,
    sandboxMode,
    networkAccess,
    shell,
  }
}

/**
 * Compares two environment contexts, ignoring the shell.
 * Useful when comparing turn to turn, since the initial environment_context will
 * include the shell, and then it is not configurable from turn to turn.
 */
export function equalsExceptShell(
  a: EnvironmentContext,
  b: EnvironmentContext
): boolean {
  return (
    a.cwd === b.cwd &&
    a.sandboxMode === b.sandboxMode &&
    a.networkAccess === b.networkAccess
  )
}

/**
 * Serializes environment context to a format suitable for model context.
 *
 * SIMPLIFIED: Returns basic JSON representation.
 * TODO: Add proper XML/markdown formatting when needed.
 */
export function serializeEnvironmentContext(ctx: EnvironmentContext): string {
  const parts: string[] = []

  if (ctx.cwd !== undefined) {
    parts.push(`cwd: ${ctx.cwd}`)
  }

  if (ctx.sandboxMode !== undefined) {
    parts.push(`sandbox_mode: ${ctx.sandboxMode}`)
  }

  if (ctx.networkAccess !== undefined) {
    parts.push(`network_access: ${ctx.networkAccess}`)
  }

  if (ctx.shell !== undefined) {
    parts.push(`shell: ${ctx.shell.type}`)
  }

  return `<environment_context>\n${parts.join('\n')}\n</environment_context>`
}
