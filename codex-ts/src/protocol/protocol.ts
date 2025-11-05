/**
 * Core protocol types for Codex sessions.
 *
 * Defines the SQ (Submission Queue) / EQ (Event Queue) pattern for
 * asynchronous communication between user and agent.
 *
 * Ported from: codex-rs/protocol/src/protocol.rs
 */

import type { UserInput } from './items.js';
import type { TurnItem } from './items.js';
import type { CustomPrompt } from './custom-prompts.js';
import type { UpdatePlanArgs } from './plan-tool.js';
import type { HistoryEntry } from './message-history.js';
import type { ReasoningEffort, ReasoningSummary } from './config-types.js';
import type { ResponseItem } from './models.js';

// ============================================================================
// Constants
// ============================================================================

/** Open tag for user instructions */
export const USER_INSTRUCTIONS_OPEN_TAG = '<user_instructions>';

/** Close tag for user instructions */
export const USER_INSTRUCTIONS_CLOSE_TAG = '</user_instructions>';

/** Open tag for environment context */
export const ENVIRONMENT_CONTEXT_OPEN_TAG = '<environment_context>';

/** Close tag for environment context */
export const ENVIRONMENT_CONTEXT_CLOSE_TAG = '</environment_context>';

/** Begin marker for user message */
export const USER_MESSAGE_BEGIN = '## My request for Codex:';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Submission Queue Entry - requests from user.
 */
export interface Submission {
  /** Unique id for this Submission to correlate with Events */
  id: string;
  /** Payload */
  op: Op;
}

/**
 * Event Queue Entry - responses from agent.
 */
export interface Event {
  /** Submission id that this event is correlated with */
  id: string;
  /** Payload */
  msg: EventMsg;
}

// ============================================================================
// Submission Operations (Op)
// ============================================================================

/**
 * Submission operation types.
 *
 * Operations that can be submitted to the agent.
 */
export type Op =
  | { type: 'interrupt' }
  | { type: 'user_input'; items: UserInput[] }
  | {
      type: 'user_turn';
      items: UserInput[];
      cwd: string;
      approval_policy: AskForApproval;
      sandbox_policy: SandboxPolicy;
      model: string;
      effort?: ReasoningEffort;
      summary: ReasoningSummary;
      final_output_json_schema?: unknown;
    }
  | {
      type: 'override_turn_context';
      cwd?: string;
      approval_policy?: AskForApproval;
      sandbox_policy?: SandboxPolicy;
      model?: string;
      effort?: ReasoningEffort | null;
      summary?: ReasoningSummary;
    }
  | { type: 'exec_approval'; id: string; decision: ReviewDecision }
  | { type: 'patch_approval'; id: string; decision: ReviewDecision }
  | { type: 'add_to_history'; text: string }
  | { type: 'get_history_entry_request'; offset: number; log_id: number }
  | { type: 'list_mcp_tools' }
  | { type: 'list_custom_prompts' }
  | { type: 'compact' }
  | { type: 'undo' }
  | { type: 'review'; review_request: ReviewRequest }
  | { type: 'shutdown' }
  | { type: 'run_user_shell_command'; command: string };

// ============================================================================
// Policy Enums
// ============================================================================

/**
 * Determines when the user is consulted to approve commands.
 */
export type AskForApproval =
  | 'untrusted' // Unless trusted (only safe read commands auto-approved)
  | 'on-failure' // Auto-approve all, escalate on failure
  | 'on-request' // Model decides (default)
  | 'never'; // Never ask user

/**
 * Execution restrictions for model shell commands.
 */
export type SandboxPolicy =
  | { mode: 'danger-full-access' }
  | { mode: 'read-only' }
  | {
      mode: 'workspace-write';
      writable_roots?: string[];
      network_access?: boolean;
      exclude_tmpdir_env_var?: boolean;
      exclude_slash_tmp?: boolean;
    };

export namespace SandboxPolicy {
  /** Create a read-only sandbox policy */
  export function newReadOnlyPolicy(): SandboxPolicy {
    return { mode: 'read-only' }
  }

  /** Create a workspace-write sandbox policy */
  export function newWorkspaceWritePolicy(): SandboxPolicy {
    return {
      mode: 'workspace-write',
      writable_roots: [],
      network_access: false,
      exclude_tmpdir_env_var: false,
      exclude_slash_tmp: false,
    }
  }

  /** Create a danger-full-access sandbox policy */
  export function newDangerFullAccessPolicy(): SandboxPolicy {
    return { mode: 'danger-full-access' }
  }
}

/**
 * User's decision in response to an approval request.
 */
export type ReviewDecision =
  | 'approved' // Approve this command
  | 'approved_for_session' // Approve and auto-approve future identical
  | 'denied' // Deny but continue session (default)
  | 'abort'; // Deny and stop until next user command

// ============================================================================
// Event Messages (EventMsg)
// ============================================================================

/**
 * Response event messages from the agent.
 *
 * Large union type with 40+ event variants.
 */
export type EventMsg =
  | { type: 'error'; message: string; details?: string }
  | { type: 'warning'; message: string; details?: string }
  | { type: 'task_started'; model_context_window?: number }
  | { type: 'task_complete'; last_agent_message?: string }
  | { type: 'token_count'; info?: TokenUsageInfo; rate_limits?: RateLimitSnapshot }
  | { type: 'agent_message'; message: string }
  | { type: 'user_message'; message: string; images?: string[] }
  | { type: 'agent_message_delta'; delta: string }
  | { type: 'agent_reasoning'; text: string }
  | { type: 'agent_reasoning_delta'; delta: string }
  | { type: 'agent_reasoning_raw_content'; text: string }
  | { type: 'agent_reasoning_raw_content_delta'; delta: string }
  | { type: 'agent_reasoning_section_break' }
  | {
      type: 'session_configured';
      session_id: string;
      model: string;
      reasoning_effort?: ReasoningEffort;
      history_log_id: number;
      history_entry_count: number;
      initial_messages?: EventMsg[];
      rollout_path: string;
    }
  | { type: 'mcp_tool_call_begin'; invocation: McpInvocation }
  | { type: 'mcp_tool_call_end'; invocation: McpInvocation; result?: unknown; error?: string }
  | { type: 'web_search_begin'; call_id: string }
  | { type: 'web_search_end'; call_id: string }
  | {
      type: 'exec_command_begin';
      call_id: string;
      command: string[];
      cwd?: string;
      stdin?: string;
      env?: Record<string, string>;
    }
  | {
      type: 'exec_command_output_delta';
      call_id: string;
      stream: ExecOutputStream;
      data: string;
    }
  | {
      type: 'exec_command_end';
      call_id: string;
      stdout: string;
      stderr: string;
      exit_code?: number;
      signal?: string;
      timed_out: boolean;
    }
  | { type: 'view_image_tool_call'; path: string; image_data: string }
  | {
      type: 'exec_approval_request';
      id: string;
      command: string[];
      cwd: string;
      risk_level: SandboxRiskLevel;
      assessment: SandboxCommandAssessment;
    }
  | {
      type: 'apply_patch_approval_request';
      id: string;
      file_changes: Record<string, FileChange>;
    }
  | { type: 'deprecation_notice'; message: string }
  | { type: 'background_event'; message: string }
  | { type: 'undo_started' }
  | { type: 'undo_completed'; success: boolean }
  | { type: 'stream_error'; error: string }
  | { type: 'stream_info'; message: string }
  | { type: 'patch_apply_begin'; file_path: string }
  | { type: 'patch_apply_end'; file_path: string; success: boolean; error?: string }
  | { type: 'turn_diff'; added_items: TurnItem[]; removed_items: TurnItem[] }
  | { type: 'get_history_entry_response'; entry?: HistoryEntry }
  | {
      type: 'mcp_list_tools_response';
      tools_by_server: Record<string, McpToolInfo[]>;
    }
  | { type: 'list_custom_prompts_response'; prompts: CustomPrompt[] }
  | { type: 'plan_update' } & UpdatePlanArgs
  | { type: 'turn_aborted'; reason: TurnAbortReason }
  | { type: 'shutdown_complete' }
  | { type: 'entered_review_mode'; review_request: ReviewRequest }
  | { type: 'exited_review_mode'; output?: ReviewOutputEvent }
  | { type: 'raw_response_item'; item: ResponseItem }
  | { type: 'item_started'; thread_id: string; turn_id: string; item: TurnItem }
  | { type: 'item_completed'; thread_id: string; turn_id: string; item: TurnItem }
  | {
      type: 'agent_message_content_delta';
      thread_id: string;
      turn_id: string;
      item_id: string;
      delta: string;
    }
  | {
      type: 'reasoning_content_delta';
      thread_id: string;
      turn_id: string;
      item_id: string;
      delta: string;
    }
  | {
      type: 'reasoning_raw_content_delta';
      thread_id: string;
      turn_id: string;
      item_id: string;
      delta: string;
    };

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Token usage statistics.
 */
export interface TokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
}

/**
 * Token usage information for session and last turn.
 */
export interface TokenUsageInfo {
  total_token_usage: TokenUsage;
  last_token_usage: TokenUsage;
  model_context_window?: number;
}

/**
 * Rate limit snapshot.
 */
export interface RateLimitSnapshot {
  requests?: RateLimitWindow;
  tokens?: RateLimitWindow;
}

/**
 * Rate limit window information.
 */
export interface RateLimitWindow {
  limit: number;
  remaining: number;
  reset_at?: string;
}

/**
 * MCP tool invocation information.
 */
export interface McpInvocation {
  server_name: string;
  tool_name: string;
  call_id: string;
  arguments: string;
}

/**
 * MCP tool information.
 */
export interface McpToolInfo {
  name: string;
  description?: string;
  input_schema: unknown;
}

/**
 * Execution output stream type.
 */
export type ExecOutputStream = 'stdout' | 'stderr';

/**
 * Sandbox risk level.
 */
export type SandboxRiskLevel = 'low' | 'medium' | 'high';

/**
 * Sandbox command assessment.
 */
export interface SandboxCommandAssessment {
  is_safe: boolean;
  reason?: string;
}

/**
 * File change types.
 */
export type FileChange =
  | { type: 'add'; content: string }
  | { type: 'delete'; content: string }
  | { type: 'update'; unified_diff: string };

/**
 * Review request.
 */
export interface ReviewRequest {
  mode: 'full' | 'quick';
  focus_areas?: string[];
}

/**
 * Review output event.
 */
export interface ReviewOutputEvent {
  findings: ReviewFinding[];
  summary?: string;
}

/**
 * Review finding.
 */
export interface ReviewFinding {
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: ReviewCodeLocation;
}

/**
 * Review code location.
 */
export interface ReviewCodeLocation {
  file_path: string;
  line_range?: ReviewLineRange;
}

/**
 * Review line range.
 */
export interface ReviewLineRange {
  start: number;
  end: number;
}

/**
 * Turn abort reason.
 */
export type TurnAbortReason =
  | 'user_requested'
  | 'max_turns_reached'
  | 'error'
  | 'context_overflow';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a submission with the given op.
 */
export function createSubmission(id: string, op: Op): Submission {
  return { id, op };
}

/**
 * Create an event with the given message.
 */
export function createEvent(id: string, msg: EventMsg): Event {
  return { id, msg };
}

/**
 * Check if a sandbox policy allows full write access.
 */
export function hasFullDiskWriteAccess(policy: SandboxPolicy): boolean {
  return policy.mode === 'danger-full-access';
}

/**
 * Check if a sandbox policy allows network access.
 */
export function hasNetworkAccess(policy: SandboxPolicy): boolean {
  if (policy.mode === 'danger-full-access') return true;
  if (policy.mode === 'workspace-write') {
    return policy.network_access === true;
  }
  return false;
}

/**
 * Create a read-only sandbox policy.
 */
export function createReadOnlyPolicy(): SandboxPolicy {
  return { mode: 'read-only' };
}

/**
 * Create a workspace-write sandbox policy.
 */
export function createWorkspaceWritePolicy(): SandboxPolicy {
  return {
    mode: 'workspace-write',
    writable_roots: [],
    network_access: false,
    exclude_tmpdir_env_var: false,
    exclude_slash_tmp: false,
  };
}

/**
 * Check if an event is an error.
 */
export function isErrorEvent(msg: EventMsg): msg is Extract<EventMsg, { type: 'error' }> {
  return msg.type === 'error';
}

/**
 * Check if an event is task complete.
 */
export function isTaskCompleteEvent(
  msg: EventMsg
): msg is Extract<EventMsg, { type: 'task_complete' }> {
  return msg.type === 'task_complete';
}

/**
 * Check if an event is an agent message.
 */
export function isAgentMessageEvent(
  msg: EventMsg
): msg is Extract<EventMsg, { type: 'agent_message' }> {
  return msg.type === 'agent_message';
}
