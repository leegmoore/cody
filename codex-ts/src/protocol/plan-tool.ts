/**
 * TODO tool types for plan tracking in the Codex protocol.
 *
 * These types match the TODO tool arguments from codex-vscode/todo-mcp/src/main.rs
 * and are used for managing step-by-step plan execution.
 *
 * Ported from: codex-rs/protocol/src/plan_tool.rs
 */

/**
 * Status of a step in a plan.
 *
 * Tracks the execution state of individual plan items.
 */
export enum StepStatus {
  /** Step has not been started yet */
  Pending = 'pending',
  /** Step is currently being executed */
  InProgress = 'in_progress',
  /** Step has been completed */
  Completed = 'completed',
}

/**
 * A single item in a plan with its current status.
 *
 * Represents one step in a multi-step plan.
 */
export interface PlanItemArg {
  /** Description of the step to be performed */
  step: string;
  /** Current execution status of this step */
  status: StepStatus;
}

/**
 * Arguments for updating a plan with multiple steps.
 *
 * Used to provide the complete plan state to the TODO tool.
 */
export interface UpdatePlanArgs {
  /** Optional explanation or context for the plan update */
  explanation?: string;
  /** Array of plan items with their current statuses */
  plan: PlanItemArg[];
}
