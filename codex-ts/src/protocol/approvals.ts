/**
 * Approval request types for sandbox and file operations.
 *
 * This module defines types for approval requests that are sent to users
 * when the agent needs permission to perform potentially risky operations.
 */

import type { ParsedCommand } from './parse-command.js';

/**
 * Sandbox risk level for command execution.
 */
export enum SandboxRiskLevel {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

/**
 * Sandbox command assessment with risk level.
 */
export interface SandboxCommandAssessment {
  /** Human-readable description of the command */
  description: string;
  /** Risk level of the command */
  risk_level: SandboxRiskLevel;
}

/**
 * File change operation for apply patch approval.
 */
export type FileChange =
  | { type: 'create'; content: string }
  | { type: 'modify'; content: string }
  | { type: 'delete' };

/**
 * Exec approval request event.
 *
 * Sent when the agent wants to execute a command that requires user approval.
 */
export interface ExecApprovalRequestEvent {
  /** Identifier for the associated exec call, if available */
  call_id: string;
  /** The command to be executed */
  command: string[];
  /** The command's working directory */
  cwd: string;
  /** Optional human-readable reason for the approval (e.g. retry without sandbox) */
  reason?: string;
  /** Optional model-provided risk assessment describing the blocked command */
  risk?: SandboxCommandAssessment;
  /** Parsed command information */
  parsed_cmd: ParsedCommand[];
}

/**
 * Apply patch approval request event.
 *
 * Sent when the agent wants to apply file changes that require user approval.
 */
export interface ApplyPatchApprovalRequestEvent {
  /** Responses API call id for the associated patch apply call, if available */
  call_id: string;
  /** Map of file paths to their changes */
  changes: Record<string, FileChange>;
  /** Optional explanatory reason (e.g. request for extra write access) */
  reason?: string;
  /**
   * When set, the agent is asking the user to allow writes under this root
   * for the remainder of the session.
   */
  grant_root?: string;
}

/**
 * Helper to get the string representation of a risk level.
 *
 * @param level - The risk level
 * @returns String representation
 */
export function riskLevelToString(level: SandboxRiskLevel): string {
  return level;
}

/**
 * Create an exec approval request.
 *
 * @param params - Approval request parameters
 * @returns An ExecApprovalRequestEvent
 */
export function createExecApprovalRequest(params: {
  callId: string;
  command: string[];
  cwd: string;
  reason?: string;
  risk?: SandboxCommandAssessment;
  parsedCmd: ParsedCommand[];
}): ExecApprovalRequestEvent {
  return {
    call_id: params.callId,
    command: params.command,
    cwd: params.cwd,
    reason: params.reason,
    risk: params.risk,
    parsed_cmd: params.parsedCmd,
  };
}

/**
 * Create an apply patch approval request.
 *
 * @param params - Approval request parameters
 * @returns An ApplyPatchApprovalRequestEvent
 */
export function createApplyPatchApprovalRequest(params: {
  callId: string;
  changes: Record<string, FileChange>;
  reason?: string;
  grantRoot?: string;
}): ApplyPatchApprovalRequestEvent {
  return {
    call_id: params.callId,
    changes: params.changes,
    reason: params.reason,
    grant_root: params.grantRoot,
  };
}
