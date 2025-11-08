/**
 * Turn state management helpers.
 * Port of state/turn.rs
 */

import type { ResponseInputItem } from "../../protocol/models.js";
import type { ReviewDecision } from "../../protocol/protocol.js";
import type { ActiveTurn, TurnState, RunningTask } from "./types.js";

/**
 * Create a new turn state.
 */
export function createTurnState(): TurnState {
  return {
    pendingApprovals: new Map(),
    pendingInput: [],
  };
}

/**
 * Create a new active turn.
 */
export function createActiveTurn(): ActiveTurn {
  return {
    tasks: new Map(),
    turnState: createTurnState(),
  };
}

/**
 * Insert a pending approval.
 */
export function insertPendingApproval(
  turnState: TurnState,
  key: string,
  callback: (decision: ReviewDecision) => void,
): void {
  turnState.pendingApprovals.set(key, callback);
}

/**
 * Remove and return a pending approval.
 */
export function removePendingApproval(
  turnState: TurnState,
  key: string,
): ((decision: ReviewDecision) => void) | null {
  const callback = turnState.pendingApprovals.get(key);
  if (callback) {
    turnState.pendingApprovals.delete(key);
    return callback;
  }
  return null;
}

/**
 * Clear all pending approvals and input.
 */
export function clearPending(turnState: TurnState): void {
  turnState.pendingApprovals.clear();
  turnState.pendingInput = [];
}

/**
 * Push pending input.
 */
export function pushPendingInput(
  turnState: TurnState,
  input: ResponseInputItem,
): void {
  turnState.pendingInput.push(input);
}

/**
 * Take all pending input (draining the buffer).
 */
export function takePendingInput(turnState: TurnState): ResponseInputItem[] {
  const input = turnState.pendingInput;
  turnState.pendingInput = [];
  return input;
}

/**
 * Add a task to the active turn.
 */
export function addTask(activeTurn: ActiveTurn, task: RunningTask): void {
  const subId = task.turnContext.subId;
  activeTurn.tasks.set(subId, task);
}

/**
 * Remove a task from the active turn.
 * Returns true if this was the last task.
 */
export function removeTask(activeTurn: ActiveTurn, subId: string): boolean {
  activeTurn.tasks.delete(subId);
  return activeTurn.tasks.size === 0;
}

/**
 * Drain all tasks from the active turn.
 */
export function drainTasks(activeTurn: ActiveTurn): RunningTask[] {
  const tasks = Array.from(activeTurn.tasks.values());
  activeTurn.tasks.clear();
  return tasks;
}
