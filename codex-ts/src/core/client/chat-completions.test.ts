/**
 * Tests for chat-completions module
 *
 * Ported from: codex-rs/core/src/chat_completions.rs
 *
 * Phase 4.1 Note: This is a simplified implementation focusing on
 * core types and message building logic. Full HTTP streaming will
 * be implemented in later phases when HTTP infrastructure is ready.
 */

import { describe, it, expect } from 'vitest'
import {
  buildChatMessages,
  type ChatMessage,
  type ChatCompletionRequest,
  type ChatCompletionChunk,
  type ChatCompletionChoice,
  type ChatCompletionDelta,
} from './chat-completions.js'
import type { ResponseItem } from '../../protocol/models.js'
import type { Prompt } from './client-common.js'

describe('chat-completions', () => {
  describe('ChatMessage types', () => {
    it('should create a system message', () => {
      const msg: ChatMessage = {
        role: 'system',
        content: 'You are a helpful assistant',
      }

      expect(msg.role).toBe('system')
      expect(msg.content).toBe('You are a helpful assistant')
    })

    it('should create a user message with text', () => {
      const msg: ChatMessage = {
        role: 'user',
        content: 'Hello',
      }

      expect(msg.role).toBe('user')
      expect(msg.content).toBe('Hello')
    })

    it('should create an assistant message', () => {
      const msg: ChatMessage = {
        role: 'assistant',
        content: 'Hi there!',
      }

      expect(msg.role).toBe('assistant')
      expect(msg.content).toBe('Hi there!')
    })

    it('should create a tool message', () => {
      const msg: ChatMessage = {
        role: 'tool',
        tool_call_id: 'call_123',
        content: 'Tool result',
      }

      expect(msg.role).toBe('tool')
      expect(msg.tool_call_id).toBe('call_123')
      expect(msg.content).toBe('Tool result')
    })

    it('should support tool_calls in assistant message', () => {
      const msg: ChatMessage = {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_abc',
            type: 'function',
            function: {
              name: 'search',
              arguments: '{"query":"test"}',
            },
          },
        ],
      }

      expect(msg.tool_calls).toHaveLength(1)
      expect(msg.tool_calls?.[0].function.name).toBe('search')
    })
  })

  describe('buildChatMessages', () => {
    it('should build messages with system instruction', () => {
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
        parallelToolCalls: false,
      }

      const messages = buildChatMessages(prompt, 'System instructions')

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toBe('System instructions')
      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('Hello')
    })

    it('should convert user messages', () => {
      const input: ResponseItem[] = [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: 'Part 1 ' },
            { type: 'input_text', text: 'Part 2' },
          ],
        },
      ]

      const prompt: Prompt = { input, tools: [], parallelToolCalls: false }
      const messages = buildChatMessages(prompt, 'System')

      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('Part 1 Part 2')
    })

    it('should convert assistant messages', () => {
      const input: ResponseItem[] = [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Response' }],
        },
      ]

      const prompt: Prompt = { input, tools: [], parallelToolCalls: false }
      const messages = buildChatMessages(prompt, 'System')

      expect(messages[1].role).toBe('assistant')
      expect(messages[1].content).toBe('Response')
    })

    it('should convert function calls', () => {
      const input: ResponseItem[] = [
        {
          type: 'function_call',
          id: undefined,
          name: 'search',
          arguments: '{"query":"test"}',
          call_id: 'call_123',
        },
      ]

      const prompt: Prompt = { input, tools: [], parallelToolCalls: false }
      const messages = buildChatMessages(prompt, 'System')

      expect(messages[1].role).toBe('assistant')
      expect(messages[1].content).toBeNull()
      expect(messages[1].tool_calls).toHaveLength(1)
      expect(messages[1].tool_calls?.[0].id).toBe('call_123')
      expect(messages[1].tool_calls?.[0].function.name).toBe('search')
    })

    it('should convert function call outputs', () => {
      const input: ResponseItem[] = [
        {
          type: 'function_call_output',
          call_id: 'call_123',
          output: {
            content: 'Result text',
          },
        },
      ]

      const prompt: Prompt = { input, tools: [], parallelToolCalls: false }
      const messages = buildChatMessages(prompt, 'System')

      expect(messages[1].role).toBe('tool')
      expect(messages[1].tool_call_id).toBe('call_123')
      expect(messages[1].content).toBe('Result text')
    })

    it('should skip duplicate assistant messages', () => {
      const input: ResponseItem[] = [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Same' }],
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Same' }],
        },
      ]

      const prompt: Prompt = { input, tools: [], parallelToolCalls: false }
      const messages = buildChatMessages(prompt, 'System')

      // System + first message only (second is skipped as duplicate)
      expect(messages).toHaveLength(2)
      expect(messages[1].content).toBe('Same')
    })

    it('should skip ghost snapshots', () => {
      const input: ResponseItem[] = [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello' }],
        },
        {
          type: 'ghost_snapshot',
          sha: 'abc123',
        },
      ]

      const prompt: Prompt = { input, tools: [], parallelToolCalls: false }
      const messages = buildChatMessages(prompt, 'System')

      // System + user only (ghost skipped)
      expect(messages).toHaveLength(2)
    })

    it('should handle empty input', () => {
      const prompt: Prompt = { input: [], tools: [], parallelToolCalls: false }
      const messages = buildChatMessages(prompt, 'System')

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe('system')
    })
  })

  describe('ChatCompletionRequest', () => {
    it('should create a valid request', () => {
      const req: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'System' },
          { role: 'user', content: 'Hello' },
        ],
        stream: true,
      }

      expect(req.model).toBe('gpt-4')
      expect(req.messages).toHaveLength(2)
      expect(req.stream).toBe(true)
    })

    it('should support tools in request', () => {
      const req: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [],
        stream: true,
        tools: [
          {
            type: 'function',
            function: {
              name: 'search',
              description: 'Search for information',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
      }

      expect(req.tools).toHaveLength(1)
      expect(req.tools?.[0].function.name).toBe('search')
    })
  })

  describe('ChatCompletionChunk', () => {
    it('should parse a delta chunk', () => {
      const chunk: ChatCompletionChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Hello',
            },
            finish_reason: null,
          },
        ],
      }

      expect(chunk.choices[0].delta.content).toBe('Hello')
      expect(chunk.choices[0].finish_reason).toBeNull()
    })

    it('should handle finish_reason', () => {
      const chunk: ChatCompletionChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      }

      expect(chunk.choices[0].finish_reason).toBe('stop')
    })

    it('should handle tool_calls in delta', () => {
      const chunk: ChatCompletionChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_abc',
                  type: 'function',
                  function: {
                    name: 'search',
                    arguments: '{"query":',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      }

      expect(chunk.choices[0].delta.tool_calls).toHaveLength(1)
      expect(chunk.choices[0].delta.tool_calls?.[0].function?.name).toBe('search')
    })
  })
})
