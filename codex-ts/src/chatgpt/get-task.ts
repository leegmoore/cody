/**
 * Types and functions for getting task details from ChatGPT backend.
 *
 * Ported from: codex-rs/chatgpt/src/get_task.rs
 */

/**
 * Output diff structure
 */
export interface OutputDiff {
  type?: string;
  repo_id?: string;
  base_commit_sha?: string;
  diff: string;
  external_storage_diff?: {
    file_id: string;
    ttl: number | null;
  };
  files_modified?: number;
  lines_added?: number;
  lines_removed?: number;
  commit_message?: string;
}

/**
 * Output item - can be PR, message, or other types
 */
export type OutputItem =
  | {
      type: "pr";
      pr_title?: string;
      pr_message?: string;
      output_diff?: OutputDiff;
      [key: string]: unknown;
    }
  | {
      type: "message";
      role?: string;
      content?: Array<{
        content_type?: string;
        text?: string;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

/**
 * Assistant turn with output items
 */
export interface AssistantTurn {
  output_items: OutputItem[];
}

/**
 * Response from getting a task
 */
export interface GetTaskResponse {
  current_diff_task_turn?: AssistantTurn;
}

/**
 * Extract diff from a GetTaskResponse
 *
 * @param response - The task response
 * @returns The diff string if found, undefined otherwise
 */
export function extractDiffFromTask(
  response: GetTaskResponse,
): string | undefined {
  const diffTurn = response.current_diff_task_turn;
  if (!diffTurn) return undefined;

  for (const item of diffTurn.output_items) {
    if (item.type === "pr" && item.output_diff) {
      const outputDiff = item.output_diff as OutputDiff;
      return outputDiff.diff;
    }
  }

  return undefined;
}
