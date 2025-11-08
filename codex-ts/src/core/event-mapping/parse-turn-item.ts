/**
 * Parse ResponseItem to TurnItem conversion.
 * Ported from codex-rs/core/src/event_mapping.rs
 *
 * Converts protocol-level ResponseItems into TurnItems suitable for
 * conversation history tracking.
 */

import type { ResponseItem, ContentItem } from '../../protocol/models'
import type { TurnItem, UserMessageItem, AgentMessageItem, UserInput, AgentMessageContent, ReasoningItem, WebSearchItem } from '../../protocol/items'

// Session prefix marker (filters out internal messages)
const SESSION_PREFIX_MARKER = '<!-- session -->'

/**
 * Checks if text contains session prefix marker.
 */
function isSessionPrefix(text: string): boolean {
  return text.includes(SESSION_PREFIX_MARKER)
}

/**
 * Parse user message from content items.
 * Returns undefined if the message should be filtered out.
 */
function parseUserMessage(content: ContentItem[]): UserMessageItem | undefined {
  const userContent: UserInput[] = []

  for (const item of content) {
    if (item.type === 'input_text') {
      if (isSessionPrefix(item.text)) {
        return undefined
      }
      userContent.push({ type: 'text', text: item.text })
    } else if (item.type === 'input_image') {
      userContent.push({ type: 'image', image_url: item.image_url })
    } else if (item.type === 'output_text') {
      if (isSessionPrefix(item.text)) {
        return undefined
      }
      // Log warning for output text in user message (shouldn't happen)
      console.warn('Output text in user message:', item.text)
    }
  }

  if (userContent.length === 0) {
    return undefined
  }

  return {
    id: crypto.randomUUID(),
    content: userContent,
  }
}

/**
 * Parse agent message from content items.
 */
function parseAgentMessage(id: string | undefined, content: ContentItem[]): AgentMessageItem {
  const agentContent: AgentMessageContent[] = []

  for (const item of content) {
    if (item.type === 'output_text') {
      agentContent.push({ type: 'text', text: item.text })
    } else {
      console.warn('Unexpected content item in agent message:', item)
    }
  }

  return {
    id: id ?? crypto.randomUUID(),
    content: agentContent,
  }
}

/**
 * Parse ResponseItem into TurnItem.
 * Returns undefined if the item should be filtered out.
 *
 * @param item - The ResponseItem to parse
 * @returns TurnItem or undefined if filtered
 */
export function parseTurnItem(item: ResponseItem): TurnItem | undefined {
  switch (item.type) {
    case 'message': {
      if (item.role === 'user') {
        const userMessage = parseUserMessage(item.content)
        if (!userMessage) return undefined
        return { type: 'user_message', item: userMessage }
      } else if (item.role === 'assistant') {
        const agentMessage = parseAgentMessage(item.id, item.content)
        return { type: 'agent_message', item: agentMessage }
      } else if (item.role === 'system') {
        return undefined
      } else {
        return undefined
      }
    }

    case 'reasoning': {
      const summaryText = item.summary.map((entry) => {
        if ('text' in entry) {
          return entry.text
        }
        return ''
      })

      const rawContent = (item.content ?? []).map((entry) => {
        if ('text' in entry) {
          return entry.text
        }
        return ''
      })

      const reasoningItem: ReasoningItem = {
        id: item.id ?? crypto.randomUUID(),
        summary_text: summaryText,
        raw_content: rawContent,
      }

      return { type: 'reasoning', item: reasoningItem }
    }

    case 'web_search_call': {
      if (item.action.type === 'search') {
        const webSearchItem: WebSearchItem = {
          id: item.id ?? '',
          query: item.action.query,
        }
        return { type: 'web_search', item: webSearchItem }
      }
      return undefined
    }

    default:
      return undefined
  }
}
