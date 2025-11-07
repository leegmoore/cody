import { describe, it, expect } from 'vitest'
import { updatePlan, type UpdatePlanParams, PLAN_TOOL_SPEC } from './updatePlan.js'
import { StepStatus } from '../../protocol/plan-tool.js'

describe('updatePlan', () => {
  it('should accept a valid plan with pending steps', async () => {
    const params: UpdatePlanParams = {
      plan: [
        { step: 'Read codebase', status: StepStatus.Pending },
        { step: 'Write tests', status: StepStatus.Pending },
        { step: 'Implement feature', status: StepStatus.Pending },
      ],
    }

    const result = await updatePlan(params)

    expect(result.success).toBe(true)
    expect(result.content).toBe('Plan updated')
  })

  it('should accept a plan with one in_progress step', async () => {
    const params: UpdatePlanParams = {
      plan: [
        { step: 'Read codebase', status: StepStatus.Completed },
        { step: 'Write tests', status: StepStatus.InProgress },
        { step: 'Implement feature', status: StepStatus.Pending },
      ],
    }

    const result = await updatePlan(params)

    expect(result.success).toBe(true)
    expect(result.content).toBe('Plan updated')
  })

  it('should accept a plan with all completed steps', async () => {
    const params: UpdatePlanParams = {
      plan: [
        { step: 'Read codebase', status: StepStatus.Completed },
        { step: 'Write tests', status: StepStatus.Completed },
        { step: 'Implement feature', status: StepStatus.Completed },
      ],
    }

    const result = await updatePlan(params)

    expect(result.success).toBe(true)
  })

  it('should accept a plan with optional explanation', async () => {
    const params: UpdatePlanParams = {
      explanation: 'Starting implementation phase',
      plan: [
        { step: 'Setup environment', status: StepStatus.InProgress },
        { step: 'Write code', status: StepStatus.Pending },
      ],
    }

    const result = await updatePlan(params)

    expect(result.success).toBe(true)
  })

  it('should reject plan with multiple in_progress steps', async () => {
    const params: UpdatePlanParams = {
      plan: [
        { step: 'Step 1', status: StepStatus.InProgress },
        { step: 'Step 2', status: StepStatus.InProgress },
      ],
    }

    await expect(updatePlan(params)).rejects.toThrow(
      'at most one step can be in_progress',
    )
  })

  it('should reject plan with three in_progress steps', async () => {
    const params: UpdatePlanParams = {
      plan: [
        { step: 'Step 1', status: StepStatus.InProgress },
        { step: 'Step 2', status: StepStatus.InProgress },
        { step: 'Step 3', status: StepStatus.InProgress },
      ],
    }

    await expect(updatePlan(params)).rejects.toThrow('found 3')
  })

  it('should reject missing plan field', async () => {
    const params = {} as UpdatePlanParams

    await expect(updatePlan(params)).rejects.toThrow('missing plan field')
  })

  it('should reject plan that is not an array', async () => {
    const params = {
      plan: 'not an array',
    } as any

    await expect(updatePlan(params)).rejects.toThrow('plan must be an array')
  })

  it('should reject plan item missing step field', async () => {
    const params: UpdatePlanParams = {
      plan: [{ status: StepStatus.Pending } as any],
    }

    await expect(updatePlan(params)).rejects.toThrow('missing step field')
  })

  it('should reject plan item missing status field', async () => {
    const params: UpdatePlanParams = {
      plan: [{ step: 'Do something' } as any],
    }

    await expect(updatePlan(params)).rejects.toThrow('missing status field')
  })

  it('should reject invalid status value', async () => {
    const params: UpdatePlanParams = {
      plan: [{ step: 'Step 1', status: 'invalid' as any }],
    }

    await expect(updatePlan(params)).rejects.toThrow('invalid status')
  })

  it('should accept empty plan array', async () => {
    const params: UpdatePlanParams = {
      plan: [],
    }

    const result = await updatePlan(params)

    expect(result.success).toBe(true)
  })

  it('should accept plan with single step', async () => {
    const params: UpdatePlanParams = {
      plan: [{ step: 'Single task', status: StepStatus.Pending }],
    }

    const result = await updatePlan(params)

    expect(result.success).toBe(true)
  })

  it('should accept plan with long step descriptions', async () => {
    const params: UpdatePlanParams = {
      plan: [
        {
          step:
            'This is a very long step description that goes into detail about what needs to be done including multiple sub-tasks and considerations',
          status: StepStatus.Pending,
        },
      ],
    }

    const result = await updatePlan(params)

    expect(result.success).toBe(true)
  })

  it('should accept mixed status plan', async () => {
    const params: UpdatePlanParams = {
      plan: [
        { step: 'Step 1', status: StepStatus.Completed },
        { step: 'Step 2', status: StepStatus.Completed },
        { step: 'Step 3', status: StepStatus.InProgress },
        { step: 'Step 4', status: StepStatus.Pending },
        { step: 'Step 5', status: StepStatus.Pending },
      ],
    }

    const result = await updatePlan(params)

    expect(result.success).toBe(true)
  })
})

describe('PLAN_TOOL_SPEC', () => {
  it('should have correct tool name', () => {
    expect(PLAN_TOOL_SPEC.name).toBe('update_plan')
  })

  it('should have description', () => {
    expect(PLAN_TOOL_SPEC.description).toContain('Updates the task plan')
    expect(PLAN_TOOL_SPEC.description).toContain('in_progress')
  })

  it('should have parameters schema', () => {
    expect(PLAN_TOOL_SPEC.parameters).toBeDefined()
    expect(PLAN_TOOL_SPEC.parameters.type).toBe('object')
  })

  it('should require plan field', () => {
    expect(PLAN_TOOL_SPEC.parameters.required).toContain('plan')
  })

  it('should have plan array schema', () => {
    const planProp = PLAN_TOOL_SPEC.parameters.properties.plan
    expect(planProp.type).toBe('array')
    expect(planProp.items).toBeDefined()
  })

  it('should have plan item properties', () => {
    const planProp = PLAN_TOOL_SPEC.parameters.properties.plan
    const itemSchema = planProp.items as any

    expect(itemSchema.properties.step).toBeDefined()
    expect(itemSchema.properties.status).toBeDefined()
  })

  it('should have status enum values', () => {
    const planProp = PLAN_TOOL_SPEC.parameters.properties.plan
    const itemSchema = planProp.items as any
    const statusSchema = itemSchema.properties.status

    expect(statusSchema.enum).toEqual(['pending', 'in_progress', 'completed'])
  })

  it('should mark plan item fields as required', () => {
    const planProp = PLAN_TOOL_SPEC.parameters.properties.plan
    const itemSchema = planProp.items as any

    expect(itemSchema.required).toContain('step')
    expect(itemSchema.required).toContain('status')
  })

  it('should have explanation field as optional', () => {
    expect(PLAN_TOOL_SPEC.parameters.properties.explanation).toBeDefined()
    expect(PLAN_TOOL_SPEC.parameters.required).not.toContain('explanation')
  })

  it('should not allow additional properties', () => {
    expect(PLAN_TOOL_SPEC.parameters.additionalProperties).toBe(false)
  })
})
