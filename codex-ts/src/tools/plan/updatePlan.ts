/**
 * Plan (update_plan) tool - structured plan/todo management
 *
 * Ported from: codex-rs/core/src/tools/handlers/plan.rs
 */

import { ToolResult } from '../types.js'
import { UpdatePlanArgs, StepStatus, PlanItemArg } from '../../protocol/plan-tool.js'

export interface UpdatePlanParams {
  /** Optional explanation or context for the plan update */
  explanation?: string
  /** Array of plan items with their current statuses */
  plan: PlanItemArg[]
}

/**
 * Update the task plan with structured steps.
 *
 * This tool provides a structured way for the model to record its plan
 * that clients can read and render. The inputs (plan data) are what matter,
 * not the outputs. This forces the model to come up with and document a plan.
 *
 * Validation rules:
 * - At most one step can be in_progress at a time
 * - Each step must have a description and status
 *
 * @param params - Plan update parameters
 * @returns Tool result indicating plan was updated
 * @throws Error if validation fails (e.g., multiple in_progress steps)
 */
export async function updatePlan(params: UpdatePlanParams): Promise<ToolResult> {
  // Validate the arguments (throws on error)
  validateUpdatePlanArgs(params)

  // In a full implementation, this would emit a plan_update event
  // For now, we just validate and return success
  // The event emission happens at a higher level in the session/conversation

  return {
    content: 'Plan updated',
    success: true,
  }
}

/**
 * Validate update plan arguments.
 *
 * Ensures:
 * - Plan array exists
 * - At most one step is in_progress
 * - All steps have valid status values
 *
 * @param args - Arguments to validate
 * @returns Validated UpdatePlanArgs
 * @throws Error if validation fails
 */
function validateUpdatePlanArgs(args: UpdatePlanParams): UpdatePlanArgs {
  if (!args.plan) {
    throw new Error('failed to parse function arguments: missing plan field')
  }

  if (!Array.isArray(args.plan)) {
    throw new Error('failed to parse function arguments: plan must be an array')
  }

  // Count in_progress steps
  let inProgressCount = 0
  for (const item of args.plan) {
    if (!item.step) {
      throw new Error('failed to parse function arguments: plan item missing step field')
    }

    if (!item.status) {
      throw new Error(
        'failed to parse function arguments: plan item missing status field',
      )
    }

    // Validate status is a valid enum value
    if (!Object.values(StepStatus).includes(item.status)) {
      throw new Error(
        `failed to parse function arguments: invalid status "${item.status}"`,
      )
    }

    if (item.status === StepStatus.InProgress) {
      inProgressCount++
    }
  }

  // Validate at most one in_progress
  if (inProgressCount > 1) {
    throw new Error(
      `failed to validate plan: at most one step can be in_progress, found ${inProgressCount}`,
    )
  }

  return {
    explanation: args.explanation,
    plan: args.plan,
  }
}

/**
 * Tool specification for the update_plan tool.
 *
 * This defines the tool schema that can be sent to the model.
 */
export const PLAN_TOOL_SPEC = {
  name: 'update_plan',
  description: `Updates the task plan.
Provide an optional explanation and a list of plan items, each with a step and status.
At most one step can be in_progress at a time.`,
  parameters: {
    type: 'object',
    properties: {
      explanation: {
        type: 'string',
        description: 'Optional explanation or context for the plan update',
      },
      plan: {
        type: 'array',
        description: 'The list of steps',
        items: {
          type: 'object',
          properties: {
            step: {
              type: 'string',
              description: 'Description of the step to be performed',
            },
            status: {
              type: 'string',
              description: 'One of: pending, in_progress, completed',
              enum: ['pending', 'in_progress', 'completed'],
            },
          },
          required: ['step', 'status'],
          additionalProperties: false,
        },
      },
    },
    required: ['plan'],
    additionalProperties: false,
  },
}
