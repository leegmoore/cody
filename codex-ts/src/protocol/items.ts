/**
 * Item types for the Codex protocol.
 *
 * Defines the structure of user and agent messages, reasoning outputs,
 * and web search requests within conversation turns.
 *
 * Ported from: codex-rs/protocol/src/items.rs and codex-rs/protocol/src/user_input.rs
 */

/**
 * User input content types.
 *
 * Supports text and image inputs from users.
 */
export type UserInput =
  | { type: 'text'; text: string }
  | { type: 'image'; image_url: string }
  | { type: 'local_image'; path: string };

/**
 * Content within an agent message.
 *
 * Currently supports text content only.
 */
export type AgentMessageContent = { type: 'text'; text: string };

/**
 * A user message in a conversation turn.
 *
 * Contains user input which can be text, images, or local image paths.
 */
export interface UserMessageItem {
  /** Unique identifier for this message */
  id: string;
  /** Array of user input content (text, images, etc.) */
  content: UserInput[];
}

/**
 * An agent message in a conversation turn.
 *
 * Contains the agent's response text.
 */
export interface AgentMessageItem {
  /** Unique identifier for this message */
  id: string;
  /** Array of agent message content */
  content: AgentMessageContent[];
}

/**
 * Agent reasoning output.
 *
 * Contains summaries and optionally raw reasoning content.
 */
export interface ReasoningItem {
  /** Unique identifier for this reasoning */
  id: string;
  /** Summary of reasoning in text form */
  summary_text: string[];
  /** Raw reasoning content (optional, for debugging) */
  raw_content?: string[];
}

/**
 * A web search query issued by the agent.
 *
 * Represents a search operation performed during execution.
 */
export interface WebSearchItem {
  /** Unique identifier for this search */
  id: string;
  /** The search query string */
  query: string;
}

/**
 * Union type representing all possible turn items.
 *
 * A turn can contain user messages, agent messages, reasoning, or web searches.
 */
export type TurnItem =
  | { type: 'user_message'; item: UserMessageItem }
  | { type: 'agent_message'; item: AgentMessageItem }
  | { type: 'reasoning'; item: ReasoningItem }
  | { type: 'web_search'; item: WebSearchItem };

/**
 * Helper functions for working with TurnItems
 */

/**
 * Get the ID from any TurnItem.
 */
export function getTurnItemId(turnItem: TurnItem): string {
  return turnItem.item.id;
}

/**
 * Create a UserMessageItem with a generated UUID.
 */
export function createUserMessageItem(content: UserInput[]): UserMessageItem {
  return {
    id: crypto.randomUUID(),
    content,
  };
}

/**
 * Create an AgentMessageItem with a generated UUID.
 */
export function createAgentMessageItem(content: AgentMessageContent[]): AgentMessageItem {
  return {
    id: crypto.randomUUID(),
    content,
  };
}

/**
 * Extract text content from a UserMessageItem.
 */
export function extractUserMessageText(item: UserMessageItem): string {
  return item.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('');
}

/**
 * Extract image URLs from a UserMessageItem.
 */
export function extractUserMessageImages(item: UserMessageItem): string[] {
  return item.content
    .filter((c): c is { type: 'image'; image_url: string } => c.type === 'image')
    .map((c) => c.image_url);
}

/**
 * Extract text content from an AgentMessageItem.
 */
export function extractAgentMessageText(item: AgentMessageItem): string[] {
  return item.content.map((c) => c.text);
}
