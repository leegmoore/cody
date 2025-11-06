/**
 * Apply command for applying diffs from ChatGPT tasks.
 *
 * Simplified implementation for Phase 4.3. Full git integration
 * will be added in Phase 5 when git utilities are ported.
 *
 * Ported from: codex-rs/chatgpt/src/apply_command.rs
 *
 * TODO(Phase 5): Add git patch application
 * TODO(Phase 5): Add conflict detection
 * TODO(Phase 5): Add CLI integration
 */

import type { GetTaskResponse } from "./get-task";
import { extractDiffFromTask } from "./get-task";

/**
 * Apply diff from a task response.
 *
 * Phase 4.3 Note: This is a simplified implementation that extracts
 * the diff but doesn't apply it. Full git integration will be added
 * in Phase 5.
 *
 * @param taskResponse - The task response containing the diff
 * @param cwd - Optional working directory (defaults to current dir)
 * @returns Promise that resolves when diff is applied
 * @throws Error if no diff is found or git apply fails
 */
export async function applyDiffFromTask(
  taskResponse: GetTaskResponse,
  _cwd?: string,
): Promise<void> {
  const diff = extractDiffFromTask(taskResponse);

  if (!diff) {
    throw new Error("No diff found in task response");
  }

  // TODO(Phase 5): Apply diff using git
  // For now, just validate that we have a diff
  if (!diff.includes("diff --git")) {
    throw new Error("Invalid diff format");
  }

  // TODO(Phase 5): Call git apply with proper error handling
  // The full implementation will:
  // 1. Set working directory to cwd (or current dir)
  // 2. Call git apply with the diff
  // 3. Handle conflicts and errors
  // 4. Return applied/skipped/conflicted paths

  throw new Error(
    "applyDiffFromTask not yet implemented - deferred to Phase 5",
  );
}

/**
 * Extract diff from task for inspection.
 *
 * @param taskResponse - The task response
 * @returns The diff string if found
 * @throws Error if no diff is found
 */
export function getDiffFromTask(taskResponse: GetTaskResponse): string {
  const diff = extractDiffFromTask(taskResponse);
  if (!diff) {
    throw new Error("No diff found in task response");
  }
  return diff;
}
