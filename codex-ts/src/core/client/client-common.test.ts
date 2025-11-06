/**
 * Tests for client-common module
 *
 * Ported from: codex-rs/core/src/client_common.rs (tests section)
 */

import { describe, it, expect } from 'vitest'
import type {
  Prompt,
  ResponseEvent,
  ResponsesApiRequest,
  ToolSpec,
  ResponsesApiTool,
  FreeformTool,
  FreeformToolFormat,
  Reasoning,
  TextControls,
  TextFormat,
  OpenAiVerbosity,
} from './client-common.js'
import {
  createReasoningParamForRequest,
  createTextParamForRequest,
} from './client-common.js'
import type { ResponseItem } from '../../protocol/models.js'
import { ReasoningSummary } from '../../protocol/config-types.js'

// Minimal ModelFamily stub for testing (will be expanded in later phases)
interface ModelFamily {
  baseInstructions: string
  needsSpecialApplyPatchInstructions: boolean
  supportsReasoningSummaries: boolean
}

const APPLY_PATCH_TOOL_INSTRUCTIONS = `
## When modifying files

When you need to modify files, use the apply_patch tool instead of other editing methods.
`.trim()

describe('client-common', () => {
  describe('Prompt', () => {
    it('should create a default prompt', () => {
      const prompt: Prompt = {
        input: [],
        tools: [],
        parallelToolCalls: false,
      }

      expect(prompt.input).toEqual([])
      expect(prompt.tools).toEqual([])
      expect(prompt.parallelToolCalls).toBe(false)
      expect(prompt.baseInstructionsOverride).toBeUndefined()
      expect(prompt.outputSchema).toBeUndefined()
    })

    it('should create a prompt with input', () => {
      const input: ResponseItem[] = [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
      ]

      const prompt: Prompt = {
        input,
        tools: [],
        parallelToolCalls: true,
      }

      expect(prompt.input).toEqual(input)
      expect(prompt.parallelToolCalls).toBe(true)
    })

    it('should create a prompt with tools', () => {
      const tool: ToolSpec = {
        type: 'function',
        name: 'test_tool',
        description: 'A test tool',
        strict: false,
        parameters: {
          type: 'object',
          properties: {},
        },
      }

      const prompt: Prompt = {
        input: [],
        tools: [tool],
        parallelToolCalls: false,
      }

      expect(prompt.tools).toHaveLength(1)
      expect(prompt.tools[0]).toEqual(tool)
    })

    it('should support base instructions override', () => {
      const prompt: Prompt = {
        input: [],
        tools: [],
        parallelToolCalls: false,
        baseInstructionsOverride: 'Custom instructions',
      }

      expect(prompt.baseInstructionsOverride).toBe('Custom instructions')
    })

    it('should support output schema', () => {
      const schema = {
        type: 'object',
        properties: {
          answer: { type: 'string' },
        },
      }

      const prompt: Prompt = {
        input: [],
        tools: [],
        parallelToolCalls: false,
        outputSchema: schema,
      }

      expect(prompt.outputSchema).toEqual(schema)
    })
  })

  describe('ResponseEvent', () => {
    it('should create Created event', () => {
      const event: ResponseEvent = { type: 'created' }
      expect(event.type).toBe('created')
    })

    it('should create OutputItemDone event', () => {
      const item: ResponseItem = {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Done' }],
      }
      const event: ResponseEvent = { type: 'output_item_done', item }
      expect(event.type).toBe('output_item_done')
      expect(event.item).toEqual(item)
    })

    it('should create OutputItemAdded event', () => {
      const item: ResponseItem = {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Added' }],
      }
      const event: ResponseEvent = { type: 'output_item_added', item }
      expect(event.type).toBe('output_item_added')
      expect(event.item).toEqual(item)
    })

    it('should create Completed event without token usage', () => {
      const event: ResponseEvent = {
        type: 'completed',
        responseId: 'resp_123',
      }
      expect(event.type).toBe('completed')
      expect(event.responseId).toBe('resp_123')
      expect(event.tokenUsage).toBeUndefined()
    })

    it('should create Completed event with token usage', () => {
      const event: ResponseEvent = {
        type: 'completed',
        responseId: 'resp_123',
        tokenUsage: {
          input_tokens: 100,
          cached_input_tokens: 50,
          output_tokens: 75,
          reasoning_tokens: 25,
        },
      }
      expect(event.type).toBe('completed')
      expect(event.tokenUsage).toBeDefined()
      expect(event.tokenUsage?.input_tokens).toBe(100)
    })

    it('should create OutputTextDelta event', () => {
      const event: ResponseEvent = {
        type: 'output_text_delta',
        delta: 'Hello ',
      }
      expect(event.type).toBe('output_text_delta')
      expect(event.delta).toBe('Hello ')
    })

    it('should create ReasoningSummaryDelta event', () => {
      const event: ResponseEvent = {
        type: 'reasoning_summary_delta',
        delta: 'Thinking about...',
      }
      expect(event.type).toBe('reasoning_summary_delta')
      expect(event.delta).toBe('Thinking about...')
    })

    it('should create ReasoningContentDelta event', () => {
      const event: ResponseEvent = {
        type: 'reasoning_content_delta',
        delta: 'I need to consider...',
      }
      expect(event.type).toBe('reasoning_content_delta')
      expect(event.delta).toBe('I need to consider...')
    })

    it('should create ReasoningSummaryPartAdded event', () => {
      const event: ResponseEvent = {
        type: 'reasoning_summary_part_added',
      }
      expect(event.type).toBe('reasoning_summary_part_added')
    })

    it('should create RateLimits event', () => {
      const event: ResponseEvent = {
        type: 'rate_limits',
        snapshot: {
          requests: {
            limit: 100,
            remaining: 95,
            reset: '2025-11-06T12:00:00Z',
          },
          tokens: {
            limit: 10000,
            remaining: 9500,
            reset: '2025-11-06T12:00:00Z',
          },
        },
      }
      expect(event.type).toBe('rate_limits')
      expect(event.snapshot.requests?.limit).toBe(100)
      expect(event.snapshot.tokens?.limit).toBe(10000)
    })
  })

  describe('ToolSpec', () => {
    it('should create a Function tool', () => {
      const tool: ToolSpec = {
        type: 'function',
        name: 'search',
        description: 'Search for information',
        strict: true,
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query' },
          },
        },
      }

      expect(tool.type).toBe('function')
      expect(tool.name).toBe('search')
      expect(tool.strict).toBe(true)
    })

    it('should create a LocalShell tool', () => {
      const tool: ToolSpec = {
        type: 'local_shell',
      }

      expect(tool.type).toBe('local_shell')
    })

    it('should create a WebSearch tool', () => {
      const tool: ToolSpec = {
        type: 'web_search',
      }

      expect(tool.type).toBe('web_search')
    })

    it('should create a Freeform tool', () => {
      const tool: ToolSpec = {
        type: 'custom',
        name: 'apply_patch',
        description: 'Apply a patch to a file',
        format: {
          type: 'bash_command',
          syntax: 'bash',
          definition: '<<HEREDOC\ncommand\nHEREDOC',
        },
      }

      expect(tool.type).toBe('custom')
      expect(tool.name).toBe('apply_patch')
      expect(tool.format.type).toBe('bash_command')
    })
  })

  describe('ResponsesApiRequest serialization', () => {
    it('should serialize text verbosity when set', () => {
      const req: ResponsesApiRequest = {
        model: 'gpt-5',
        instructions: 'i',
        input: [],
        tools: [],
        toolChoice: 'auto',
        parallelToolCalls: true,
        store: false,
        stream: true,
        include: [],
        text: {
          verbosity: 'low',
        },
      }

      expect(req.text?.verbosity).toBe('low')
    })

    it('should serialize text schema with strict format', () => {
      const schema = {
        type: 'object',
        properties: {
          answer: { type: 'string' },
        },
        required: ['answer'],
      }
      const textControls = createTextParamForRequest(undefined, schema)

      const req: ResponsesApiRequest = {
        model: 'gpt-5',
        instructions: 'i',
        input: [],
        tools: [],
        toolChoice: 'auto',
        parallelToolCalls: true,
        store: false,
        stream: true,
        include: [],
        text: textControls,
      }

      expect(req.text).toBeDefined()
      expect(req.text?.verbosity).toBeUndefined()
      expect(req.text?.format).toBeDefined()
      expect(req.text?.format?.name).toBe('codex_output_schema')
      expect(req.text?.format?.type).toBe('json_schema')
      expect(req.text?.format?.strict).toBe(true)
      expect(req.text?.format?.schema).toEqual(schema)
    })

    it('should omit text when not set', () => {
      const req: ResponsesApiRequest = {
        model: 'gpt-5',
        instructions: 'i',
        input: [],
        tools: [],
        toolChoice: 'auto',
        parallelToolCalls: true,
        store: false,
        stream: true,
        include: [],
      }

      expect(req.text).toBeUndefined()
    })

    it('should include prompt_cache_key when set', () => {
      const req: ResponsesApiRequest = {
        model: 'gpt-5',
        instructions: 'i',
        input: [],
        tools: [],
        toolChoice: 'auto',
        parallelToolCalls: true,
        store: false,
        stream: true,
        include: [],
        promptCacheKey: 'cache_123',
      }

      expect(req.promptCacheKey).toBe('cache_123')
    })

    it('should include reasoning when set', () => {
      const reasoning: Reasoning = {
        effort: 'medium',
        summary: 'auto',
      }

      const req: ResponsesApiRequest = {
        model: 'gpt-5',
        instructions: 'i',
        input: [],
        tools: [],
        toolChoice: 'auto',
        parallelToolCalls: true,
        reasoning,
        store: false,
        stream: true,
        include: [],
      }

      expect(req.reasoning).toBeDefined()
      expect(req.reasoning?.effort).toBe('medium')
      expect(req.reasoning?.summary).toBe('auto')
    })
  })

  describe('createReasoningParamForRequest', () => {
    it('should return None when model does not support reasoning summaries', () => {
      const modelFamily: ModelFamily = {
        baseInstructions: 'Base instructions',
        needsSpecialApplyPatchInstructions: false,
        supportsReasoningSummaries: false,
      }

      const result = createReasoningParamForRequest(
        modelFamily,
        'medium',
        ReasoningSummary.Auto,
      )

      expect(result).toBeUndefined()
    })

    it('should return reasoning param when model supports it', () => {
      const modelFamily: ModelFamily = {
        baseInstructions: 'Base instructions',
        needsSpecialApplyPatchInstructions: false,
        supportsReasoningSummaries: true,
      }

      const result = createReasoningParamForRequest(
        modelFamily,
        'medium',
        ReasoningSummary.Auto,
      )

      expect(result).toBeDefined()
      expect(result?.effort).toBe('medium')
      expect(result?.summary).toBe('auto')
    })

    it('should work without effort param', () => {
      const modelFamily: ModelFamily = {
        baseInstructions: 'Base instructions',
        needsSpecialApplyPatchInstructions: false,
        supportsReasoningSummaries: true,
      }

      const result = createReasoningParamForRequest(
        modelFamily,
        undefined,
        ReasoningSummary.Auto,
      )

      expect(result).toBeDefined()
      expect(result?.effort).toBeUndefined()
      expect(result?.summary).toBe('auto')
    })
  })

  describe('createTextParamForRequest', () => {
    it('should return undefined when no params provided', () => {
      const result = createTextParamForRequest(undefined, undefined)
      expect(result).toBeUndefined()
    })

    it('should create text controls with verbosity only', () => {
      const result = createTextParamForRequest('low', undefined)

      expect(result).toBeDefined()
      expect(result?.verbosity).toBe('low')
      expect(result?.format).toBeUndefined()
    })

    it('should create text controls with schema only', () => {
      const schema = {
        type: 'object',
        properties: {
          answer: { type: 'string' },
        },
      }

      const result = createTextParamForRequest(undefined, schema)

      expect(result).toBeDefined()
      expect(result?.verbosity).toBeUndefined()
      expect(result?.format).toBeDefined()
      expect(result?.format?.schema).toEqual(schema)
      expect(result?.format?.strict).toBe(true)
      expect(result?.format?.name).toBe('codex_output_schema')
    })

    it('should create text controls with both verbosity and schema', () => {
      const schema = {
        type: 'object',
        properties: {
          answer: { type: 'string' },
        },
      }

      const result = createTextParamForRequest('high', schema)

      expect(result).toBeDefined()
      expect(result?.verbosity).toBe('high')
      expect(result?.format).toBeDefined()
      expect(result?.format?.schema).toEqual(schema)
    })

    it('should convert VerbosityConfig to OpenAiVerbosity', () => {
      const result = createTextParamForRequest('medium', undefined)
      expect(result?.verbosity).toBe('medium')
    })
  })
})
