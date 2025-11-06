/**
 * Request builder for Anthropic Messages API.
 *
 * Converts Codex Prompt objects into MessagesApiRequest payloads.
 *
 * Reference: MESSAGES_API_INTEGRATION_DESIGN_CODEX.md
 * - Section 2.1: Messages API Request Model
 * - Section 2.8: System Prompt Handling
 *
 * Phase 4.2 - Stage 3: Request Builder
 */

import type { Prompt } from '../client-common.js'
import type { ResponseItem, ContentItem } from '../../../protocol/models.js'
import type {
  MessagesApiRequest,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicProviderConfig,
  AnthropicToolChoice,
} from './types.js'
import { createToolsJsonForMessagesApi } from './tool-bridge.js'

// ============================================================================
// Request Builder
// ============================================================================

/**
 * Build a MessagesApiRequest from a Codex Prompt.
 *
 * Handles:
 * - Message array construction from ResponseItem[]
 * - System instructions via system field
 * - Tool conversion via tool-bridge
 * - Parameter mapping (temperature, max_tokens, etc.)
 * - Tool choice configuration
 * - Metadata injection
 *
 * @param prompt - Codex prompt with conversation history
 * @param config - Anthropic provider configuration
 * @param model - Model identifier
 * @param metadata - Optional request metadata (trace IDs, etc.)
 * @returns MessagesApiRequest ready to send
 *
 * Reference: Design Section 2.1
 */
export function buildMessagesRequest(
  prompt: Prompt,
  config: AnthropicProviderConfig,
  model: string,
  metadata?: Record<string, unknown>,
): MessagesApiRequest {
  // Convert input items to messages
  const messages = convertInputToMessages(prompt.input)

  // Convert tools (if any)
  const tools =
    prompt.tools.length > 0 ? createToolsJsonForMessagesApi(prompt.tools) : undefined

  // Determine tool choice
  const toolChoice = determineToolChoice(tools, prompt.parallelToolCalls)

  // Build base request
  const request: MessagesApiRequest = {
    model,
    messages,
    stream: true, // Always stream for now
    system: prompt.baseInstructionsOverride,
    tools,
    tool_choice: toolChoice,
    max_output_tokens: config.maxOutputTokens,
    metadata,
  }

  return request
}

// ============================================================================
// Message Conversion
// ============================================================================

/**
 * Convert ResponseItem[] to AnthropicMessage[].
 *
 * Groups consecutive items by role and converts content.
 * Handles:
 * - Regular messages (user/assistant)
 * - Tool calls → tool_use blocks
 * - Tool call outputs → tool_result blocks
 *
 * @param items - Array of response items
 * @returns Array of Anthropic messages
 */
function convertInputToMessages(items: ResponseItem[]): AnthropicMessage[] {
  const messages: AnthropicMessage[] = []
  let currentRole: 'user' | 'assistant' | null = null
  let currentContent: AnthropicContentBlock[] = []

  for (const item of items) {
    switch (item.type) {
      case 'message': {
        const role = normalizeRole(item.role)

        // If role changes, flush current message
        if (currentRole !== null && currentRole !== role) {
          messages.push({ role: currentRole, content: currentContent })
          currentContent = []
        }

        currentRole = role

        // Convert content items
        for (const contentItem of item.content) {
          currentContent.push(convertContentItem(contentItem))
        }
        break
      }

      case 'custom_tool_call': {
        // Tool calls go in assistant messages
        if (currentRole !== 'assistant') {
          if (currentRole !== null) {
            messages.push({ role: currentRole, content: currentContent })
          }
          currentRole = 'assistant'
          currentContent = []
        }

        // Add tool_use block
        currentContent.push({
          type: 'tool_use',
          id: item.call_id,
          name: item.name,
          input: JSON.parse(item.input),
        })
        break
      }

      case 'custom_tool_call_output': {
        // Tool results go in user messages
        if (currentRole !== 'user') {
          if (currentRole !== null) {
            messages.push({ role: currentRole, content: currentContent })
          }
          currentRole = 'user'
          currentContent = []
        }

        // Add tool_result block
        currentContent.push({
          type: 'tool_result',
          tool_use_id: item.call_id,
          content: item.output,
          is_error: false, // Codex doesn't track this in ResponseItem yet
        })
        break
      }

      // Other item types (function_call, mcp_tool_call, etc.) not handled yet
      // Will add as needed in later stages
    }
  }

  // Flush final message
  if (currentRole !== null && currentContent.length > 0) {
    messages.push({ role: currentRole, content: currentContent })
  }

  return messages
}

/**
 * Normalize role to Anthropic's user/assistant format.
 */
function normalizeRole(role: string): 'user' | 'assistant' {
  if (role === 'assistant') {
    return 'assistant'
  }
  // Everything else (user, system, tool) maps to user
  return 'user'
}

/**
 * Convert Codex ContentItem to Anthropic ContentBlock.
 */
function convertContentItem(item: ContentItem): AnthropicContentBlock {
  switch (item.type) {
    case 'input_text':
      return { type: 'text', text: item.text }

    case 'output_text':
      return { type: 'text', text: item.text }

    case 'input_image':
      // Image conversion - for now, simple URL-based
      return {
        type: 'image',
        source: {
          type: 'url',
          media_type: 'image/jpeg', // Default, should be detected
          url: item.image_url,
        },
      }

    default:
      // Fallback for unknown types
      return { type: 'text', text: '[unsupported content]' }
  }
}

// ============================================================================
// Tool Choice Logic
// ============================================================================

/**
 * Determine tool_choice value based on tools and parallel setting.
 *
 * Rules:
 * - No tools: undefined
 * - Has tools: 'auto' (let model decide)
 *
 * @param tools - Converted tools array
 * @param parallelToolCalls - Whether parallel calls are enabled
 * @returns Tool choice value or undefined
 */
function determineToolChoice(
  tools: ReturnType<typeof createToolsJsonForMessagesApi> | undefined,
  parallelToolCalls: boolean,
): AnthropicToolChoice | undefined {
  if (!tools || tools.length === 0) {
    return undefined
  }

  // Anthropic doesn't have explicit parallel control
  // Use 'auto' to let the model decide
  return 'auto'
}
