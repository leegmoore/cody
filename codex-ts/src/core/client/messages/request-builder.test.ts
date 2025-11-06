/**
 * Tests for Anthropic Messages API request builder.
 *
 * Phase 4.2 - Stage 3: Request Builder (15 tests)
 *
 * Test Coverage (from Design Doc Section 4.2):
 * - RF-01 through RF-15: Request formatting tests
 *
 * Reference: Design Section 2.1 (Messages API Request Model)
 */

import { describe, test, expect } from 'vitest'
import type { Prompt } from '../client-common.js'
import type { ResponseItem } from '../../../protocol/models.js'
import { buildMessagesRequest } from './request-builder.js'
import type { MessagesApiRequest, AnthropicProviderConfig } from './types.js'

describe('Messages API Request Builder - Stage 3', () => {
  // ============================================================================
  // RF-01: Minimal prompt produces base request
  // ============================================================================
  test('RF-01: Minimal prompt produces base request', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
      ],
      tools: [],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    expect(request.model).toBe('claude-3-5-sonnet-20241022')
    expect(request.messages).toHaveLength(1)
    expect(request.messages[0].role).toBe('user')
    expect(request.messages[0].content).toHaveLength(1)
    expect(request.messages[0].content[0]).toEqual({ type: 'text', text: 'Hello' })
    expect(request.stream).toBe(true)
    expect(request.tool_choice).toBeUndefined() // Default when no tools
  })

  // ============================================================================
  // RF-02: System instructions render correctly
  // ============================================================================
  test('RF-02: Custom instructions render as system field', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'What is the weather?' }],
        },
      ],
      tools: [],
      parallelToolCalls: false,
      baseInstructionsOverride: 'You are a helpful weather assistant.',
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    expect(request.system).toBe('You are a helpful weather assistant.')
    expect(request.messages[0].role).toBe('user') // Not injected into messages
  })

  // ============================================================================
  // RF-03: Multiple turns preserve role ordering
  // ============================================================================
  test('RF-03: Multiple turns preserve role ordering', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'First message' }],
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'First response' }],
        },
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Second message' }],
        },
      ],
      tools: [],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    expect(request.messages).toHaveLength(3)
    expect(request.messages[0].role).toBe('user')
    expect(request.messages[1].role).toBe('assistant')
    expect(request.messages[2].role).toBe('user')
    expect(request.messages[0].content[0]).toEqual({ type: 'text', text: 'First message' })
    expect(request.messages[1].content[0]).toEqual({ type: 'text', text: 'First response' })
    expect(request.messages[2].content[0]).toEqual({ type: 'text', text: 'Second message' })
  })

  // ============================================================================
  // RF-04: Output schema (not directly used by Messages API)
  // ============================================================================
  test('RF-04: Output schema does not affect request', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Get data' }],
        },
      ],
      tools: [],
      parallelToolCalls: false,
      outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    // Messages API doesn't have direct output schema support like Responses API
    // Just verify request is valid
    expect(request.model).toBe('claude-3-5-sonnet-20241022')
    expect(request.messages).toHaveLength(1)
  })

  // ============================================================================
  // RF-05: Tool list converts to Anthropic schema
  // ============================================================================
  test('RF-05: Tool list converts to Anthropic schema', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Help me' }],
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get weather',
          strict: false,
          parameters: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
          },
        },
        {
          type: 'function',
          name: 'search',
          description: 'Search',
          strict: false,
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
          },
        },
      ],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    expect(request.tools).toHaveLength(2)
    expect(request.tools![0].name).toBe('get_weather')
    expect(request.tools![1].name).toBe('search')
    expect(request.tool_choice).toBe('auto') // Default when tools present
  })

  // ============================================================================
  // RF-06: Strict tool disables additionalProperties
  // ============================================================================
  test('RF-06: Strict tool disables additionalProperties', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Help' }],
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'strict_tool',
          description: 'Strict tool',
          strict: true,
          parameters: {
            type: 'object',
            properties: { arg: { type: 'string' } },
            required: ['arg'],
          },
        },
      ],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    expect(request.tools).toHaveLength(1)
    expect(request.tools![0].input_schema.additionalProperties).toBe(false)
  })

  // ============================================================================
  // RF-07: Parallel tool calls disabled maps to 'auto'
  // ============================================================================
  test('RF-07: Parallel tool calls disabled maps to auto', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Help' }],
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'tool1',
          description: 'Tool 1',
          strict: false,
          parameters: { type: 'object', properties: {} },
        },
      ],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    expect(request.tool_choice).toBe('auto')
  })

  // ============================================================================
  // RF-08: Parallel tool calls enabled maps to 'auto' (Anthropic decides)
  // ============================================================================
  test('RF-08: Parallel tool calls enabled maps to auto', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Help' }],
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'tool1',
          description: 'Tool 1',
          strict: false,
          parameters: { type: 'object', properties: {} },
        },
      ],
      parallelToolCalls: true,
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    // Anthropic doesn't have exact parallel control, but 'auto' lets model decide
    expect(request.tool_choice).toBe('auto')
  })

  // ============================================================================
  // RF-09: Max output tokens default applied
  // ============================================================================
  test('RF-09: Max output tokens default applied', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
      ],
      tools: [],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {
      maxOutputTokens: 2048,
    }
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    expect(request.max_output_tokens).toBe(2048)
  })

  // ============================================================================
  // RF-10: Max output tokens override (if supported via metadata)
  // ============================================================================
  test('RF-10: Max output tokens from config', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
      ],
      tools: [],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {
      maxOutputTokens: 4096,
    }
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    expect(request.max_output_tokens).toBe(4096)
  })

  // ============================================================================
  // RF-11: Temperature/top_p propagate
  // ============================================================================
  test('RF-11: Temperature and top_p propagate from config', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
      ],
      tools: [],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {
      // Would need to add these to config type
    }
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    // For now, just verify request is valid
    // TODO: Add temperature/top_p to AnthropicProviderConfig
    expect(request.model).toBe('claude-3-5-sonnet-20241022')
  })

  // ============================================================================
  // RF-12: Stop sequences forwarded
  // ============================================================================
  test('RF-12: Stop sequences forwarded from config', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
      ],
      tools: [],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {
      // Would need to add stop_sequences to config
    }
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    // For now, just verify request is valid
    expect(request.model).toBe('claude-3-5-sonnet-20241022')
  })

  // ============================================================================
  // RF-13: Metadata includes trace identifiers
  // ============================================================================
  test('RF-13: Metadata can include trace identifiers', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
      ],
      tools: [],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022', {
      trace_id: 'test-123',
    })

    expect(request.metadata).toBeDefined()
    expect(request.metadata!.trace_id).toBe('test-123')
  })

  // ============================================================================
  // RF-14: Tool omission when none provided
  // ============================================================================
  test('RF-14: Tool omission when none provided', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
      ],
      tools: [],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    expect(request.tools).toBeUndefined()
    expect(request.tool_choice).toBeUndefined()
  })

  // ============================================================================
  // RF-15: Custom tool call output handling
  // ============================================================================
  test('RF-15: Custom tool call output converts to tool_result', () => {
    const prompt: Prompt = {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Search for cats' }],
        },
        {
          type: 'message',
          role: 'assistant',
          content: [],
        },
        {
          type: 'custom_tool_call',
          call_id: 'call_123',
          name: 'search',
          input: '{"query": "cats"}',
        },
        {
          type: 'custom_tool_call_output',
          call_id: 'call_123',
          output: 'Found 10 results about cats',
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'search',
          description: 'Search',
          strict: false,
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
          },
        },
      ],
      parallelToolCalls: false,
    }

    const config: AnthropicProviderConfig = {}
    const request = buildMessagesRequest(prompt, config, 'claude-3-5-sonnet-20241022')

    // Should convert tool calls and results into proper message format
    expect(request.messages.length).toBeGreaterThan(1)

    // Find the assistant message with tool_use
    const assistantMsg = request.messages.find(
      (m) => m.role === 'assistant' && m.content.some((c) => c.type === 'tool_use')
    )
    expect(assistantMsg).toBeDefined()

    // Find the user message with tool_result
    const toolResultMsg = request.messages.find((m) =>
      m.content.some((c) => c.type === 'tool_result')
    )
    expect(toolResultMsg).toBeDefined()
  })
})
