/**
 * Chat Completions API implementation.
 *
 * This module provides support for the classic OpenAI Chat Completions API,
 * including message building, SSE parsing, and delta aggregation.
 *
 * Ported from: codex-rs/core/src/chat_completions.rs
 *
 * Phase 4.1 Note: This is a simplified implementation focusing on core types
 * and message building logic. Full HTTP streaming will be implemented in later
 * phases when HTTP client infrastructure is ready.
 *
 * TODO(Phase 4.5+): Add full streaming implementation
 * TODO(Phase 4.5+): Add retry logic with exponential backoff
 * TODO(Phase 4.5+): Add rate limit handling
 * TODO(Phase 4.5+): Add SSE parsing
 * TODO(Phase 4.5+): Add delta aggregation stream adapter
 */

import type { ResponseItem, ContentItem } from '../../protocol/models.js'
import type { Prompt } from './client-common.js'

// ============================================================================
// Chat Completions API Types
// ============================================================================

/**
 * Chat message role.
 */
export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool'

/**
 * Tool call in a chat message.
 */
export interface ChatMessageToolCall {
  /** Unique identifier for the tool call */
  id: string
  /** Type of tool call */
  type: 'function' | 'local_shell_call' | 'custom'
  /** Function details (for type: 'function') */
  function?: {
    name: string
    arguments: string
  }
  /** Local shell action (for type: 'local_shell_call') */
  action?: unknown
  /** Custom tool details (for type: 'custom') */
  custom?: {
    name: string
    input: string
  }
}

/**
 * A message in the Chat Completions API format.
 */
export interface ChatMessage {
  /** Role of the message sender */
  role: ChatMessageRole
  /** Message content (text or structured content) */
  content: string | unknown[] | null
  /** Tool call ID (for role: 'tool') */
  tool_call_id?: string
  /** Tool calls made by the assistant */
  tool_calls?: ChatMessageToolCall[]
  /** Reasoning content (for models that support it) */
  reasoning?: string
}

/**
 * Chat Completions API request.
 */
export interface ChatCompletionRequest {
  /** Model to use */
  model: string
  /** Array of messages */
  messages: ChatMessage[]
  /** Whether to stream the response */
  stream: boolean
  /** Available tools */
  tools?: unknown[]
  /** Maximum tokens to generate */
  max_tokens?: number
  /** Temperature for sampling */
  temperature?: number
}

/**
 * Delta in a streaming chunk.
 */
export interface ChatCompletionDelta {
  /** Role delta */
  role?: ChatMessageRole
  /** Content delta */
  content?: string
  /** Tool calls delta */
  tool_calls?: Array<{
    index: number
    id?: string
    type?: string
    function?: {
      name?: string
      arguments?: string
    }
  }>
}

/**
 * A choice in a Chat Completion chunk.
 */
export interface ChatCompletionChoice {
  /** Choice index */
  index: number
  /** Delta for this chunk */
  delta: ChatCompletionDelta
  /** Finish reason (if any) */
  finish_reason: string | null
}

/**
 * Chat Completion streaming chunk.
 */
export interface ChatCompletionChunk {
  /** Unique identifier */
  id: string
  /** Object type */
  object: string
  /** Creation timestamp */
  created: number
  /** Model used */
  model: string
  /** Choices array */
  choices: ChatCompletionChoice[]
}

// ============================================================================
// Message Building
// ============================================================================

/**
 * Build Chat Completions API messages from Codex ResponseItems.
 *
 * This function converts the internal Codex representation to the format
 * expected by the Chat Completions API.
 *
 * @param prompt - The prompt containing input items
 * @param systemInstructions - System instructions to prepend
 * @returns Array of chat messages
 */
export function buildChatMessages(prompt: Prompt, systemInstructions: string): ChatMessage[] {
  const messages: ChatMessage[] = []

  // Always start with system message
  messages.push({
    role: 'system',
    content: systemInstructions,
  })

  // Track last assistant text to avoid duplicates
  let lastAssistantText: string | undefined

  for (const item of prompt.input) {
    switch (item.type) {
      case 'message': {
        // Build message content
        let text = ''
        const contentItems: unknown[] = []
        let sawImage = false

        for (const c of item.content) {
          switch (c.type) {
            case 'input_text':
            case 'output_text':
              text += c.text
              contentItems.push({ type: 'text', text: c.text })
              break
            case 'input_image':
              sawImage = true
              contentItems.push({
                type: 'image_url',
                image_url: { url: c.image_url },
              })
              break
          }
        }

        // Skip duplicate assistant messages
        if (item.role === 'assistant') {
          if (lastAssistantText === text) {
            continue
          }
          lastAssistantText = text
        }

        // For assistant, always use plain string
        // For user with images, use content items array
        const content = item.role === 'assistant' ? text : sawImage ? contentItems : text

        messages.push({
          role: item.role as ChatMessageRole,
          content,
        })
        break
      }

      case 'function_call': {
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: item.call_id,
              type: 'function',
              function: {
                name: item.name,
                arguments: item.arguments,
              },
            },
          ],
        })
        break
      }

      case 'local_shell_call': {
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: item.id ?? '',
              type: 'local_shell_call',
              action: item.action,
            },
          ],
        })
        break
      }

      case 'function_call_output': {
        // Prefer structured content items when available
        let content: string | unknown[]
        if (item.output.content_items) {
          content = item.output.content_items.map((it) => {
            switch (it.type) {
              case 'input_text':
                return { type: 'text', text: it.text }
              case 'input_image':
                return {
                  type: 'image_url',
                  image_url: { url: it.image_url },
                }
            }
          })
        } else {
          content = item.output.content
        }

        messages.push({
          role: 'tool',
          tool_call_id: item.call_id,
          content,
        })
        break
      }

      case 'custom_tool_call': {
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: item.id,
              type: 'custom',
              custom: {
                name: item.name,
                input: item.input,
              },
            },
          ],
        })
        break
      }

      case 'custom_tool_call_output': {
        messages.push({
          role: 'tool',
          tool_call_id: item.call_id,
          content: item.output,
        })
        break
      }

      case 'ghost_snapshot':
      case 'reasoning':
      case 'web_search_call':
        // Skip these - not sent to the model
        continue
    }
  }

  return messages
}

/**
 * Create a Chat Completions API request payload.
 *
 * @param prompt - The prompt to convert
 * @param modelSlug - Model identifier
 * @param systemInstructions - System instructions
 * @param tools - Tools to include in the request
 * @returns Request payload
 */
export function createChatCompletionRequest(
  prompt: Prompt,
  modelSlug: string,
  systemInstructions: string,
  tools?: unknown[],
): ChatCompletionRequest {
  const messages = buildChatMessages(prompt, systemInstructions)

  return {
    model: modelSlug,
    messages,
    stream: true,
    tools,
  }
}
