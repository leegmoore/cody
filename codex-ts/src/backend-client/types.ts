/**
 * Hand-rolled models for the Cloud Tasks task-details response.
 * The generated OpenAPI models are pretty bad. This is a half-step
 * towards hand-rolling them.
 */

// Re-export OpenAPI models
export type {
  PaginatedListTaskListItem,
  TaskListItem,
  RateLimitStatusPayload,
  RateLimitStatusDetails,
  RateLimitWindowSnapshot,
} from "../backend-openapi-models/index.js";
export { PlanType } from "../backend-openapi-models/index.js";

/**
 * Content fragment - can be structured or plain text
 */
export type ContentFragment = { content_type?: string; text?: string } | string;

/**
 * Diff payload for PR output
 */
export interface DiffPayload {
  diff?: string;
}

/**
 * Turn item with type, role, content, and optional diff
 */
export interface TurnItem {
  type: string;
  role?: string;
  content: ContentFragment[];
  diff?: string;
  output_diff?: DiffPayload;
}

/**
 * Author information
 */
export interface Author {
  role?: string;
}

/**
 * Worklog content with parts
 */
export interface WorklogContent {
  parts: ContentFragment[];
}

/**
 * Worklog message
 */
export interface WorklogMessage {
  author?: Author;
  content?: WorklogContent;
}

/**
 * Worklog with messages
 */
export interface Worklog {
  messages: WorklogMessage[];
}

/**
 * Turn error with code and message
 */
export interface TurnError {
  code?: string;
  message?: string;
}

/**
 * Turn with input/output items, worklog, and optional error
 */
export interface Turn {
  id?: string;
  attempt_placement?: number;
  turn_status?: string;
  sibling_turn_ids: string[];
  input_items: TurnItem[];
  output_items: TurnItem[];
  worklog?: Worklog;
  error?: TurnError;
}

/**
 * Code task details response
 */
export interface CodeTaskDetailsResponse {
  current_user_turn?: Turn;
  current_assistant_turn?: Turn;
  current_diff_task_turn?: Turn;
}

/**
 * Turn attempts sibling turns response
 */
export interface TurnAttemptsSiblingTurnsResponse {
  sibling_turns: Record<string, unknown>[];
}

// Helper functions

/**
 * Extract text from a content fragment
 */
function fragmentText(fragment: ContentFragment): string | undefined {
  if (typeof fragment === "string") {
    return fragment.trim() || undefined;
  }

  // Structured content
  if (
    fragment.content_type &&
    fragment.content_type.toLowerCase() === "text" &&
    fragment.text &&
    fragment.text.trim()
  ) {
    return fragment.text;
  }

  return undefined;
}

/**
 * Extract text values from a turn item
 */
function turnItemTextValues(item: TurnItem): string[] {
  return item.content
    .map(fragmentText)
    .filter((t): t is string => t !== undefined);
}

/**
 * Extract diff text from a turn item
 */
function turnItemDiffText(item: TurnItem): string | undefined {
  if (item.type === "output_diff" && item.diff && item.diff.trim()) {
    return item.diff;
  }

  if (
    item.type === "pr" &&
    item.output_diff?.diff &&
    item.output_diff.diff.trim()
  ) {
    return item.output_diff.diff;
  }

  return undefined;
}

/**
 * Extract unified diff from a turn
 */
function turnUnifiedDiff(turn: Turn): string | undefined {
  for (const item of turn.output_items) {
    const diff = turnItemDiffText(item);
    if (diff) return diff;
  }
  return undefined;
}

/**
 * Extract message texts from a turn
 */
function turnMessageTexts(turn: Turn): string[] {
  const out: string[] = [];

  // Extract from output items
  for (const item of turn.output_items) {
    if (item.type === "message") {
      out.push(...turnItemTextValues(item));
    }
  }

  // Extract from worklog
  if (turn.worklog) {
    for (const message of turn.worklog.messages) {
      if (worklogMessageIsAssistant(message)) {
        out.push(...worklogMessageTextValues(message));
      }
    }
  }

  return out;
}

/**
 * Extract user prompt from a turn
 */
function turnUserPrompt(turn: Turn): string | undefined {
  const parts: string[] = [];

  for (const item of turn.input_items) {
    if (item.type === "message") {
      const isUser = !item.role || item.role.toLowerCase() === "user";
      if (isUser) {
        parts.push(...turnItemTextValues(item));
      }
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

/**
 * Extract error summary from a turn
 */
function turnErrorSummary(turn: Turn): string | undefined {
  return turn.error ? turnErrorSummaryText(turn.error) : undefined;
}

/**
 * Check if worklog message is from assistant
 */
function worklogMessageIsAssistant(message: WorklogMessage): boolean {
  return message.author?.role?.toLowerCase() === "assistant";
}

/**
 * Extract text values from worklog message
 */
function worklogMessageTextValues(message: WorklogMessage): string[] {
  if (!message.content) return [];
  return message.content.parts
    .map(fragmentText)
    .filter((t): t is string => t !== undefined);
}

/**
 * Get error summary text
 */
function turnErrorSummaryText(error: TurnError): string | undefined {
  const code = error.code || "";
  const message = error.message || "";

  if (!code && !message) return undefined;
  if (!code) return message;
  if (!message) return code;
  return `${code}: ${message}`;
}

/**
 * Attempt to extract a unified diff string from the assistant or diff turn.
 */
export function unifiedDiff(
  response: CodeTaskDetailsResponse,
): string | undefined {
  const turns = [
    response.current_diff_task_turn,
    response.current_assistant_turn,
  ];

  for (const turn of turns) {
    if (turn) {
      const diff = turnUnifiedDiff(turn);
      if (diff) return diff;
    }
  }

  return undefined;
}

/**
 * Extract assistant text output messages (no diff) from current turns.
 */
export function assistantTextMessages(
  response: CodeTaskDetailsResponse,
): string[] {
  const out: string[] = [];
  const turns = [
    response.current_diff_task_turn,
    response.current_assistant_turn,
  ];

  for (const turn of turns) {
    if (turn) {
      out.push(...turnMessageTexts(turn));
    }
  }

  return out;
}

/**
 * Extract the user's prompt text from the current user turn, when present.
 */
export function userTextPrompt(
  response: CodeTaskDetailsResponse,
): string | undefined {
  return response.current_user_turn
    ? turnUserPrompt(response.current_user_turn)
    : undefined;
}

/**
 * Extract an assistant error message (if the turn failed and provided one).
 */
export function assistantErrorMessage(
  response: CodeTaskDetailsResponse,
): string | undefined {
  return response.current_assistant_turn
    ? turnErrorSummary(response.current_assistant_turn)
    : undefined;
}
