/**
 * Message history types for the Codex protocol.
 *
 * Tracks conversation history entries with timestamps.
 *
 * Ported from: codex-rs/protocol/src/message_history.rs
 */

/**
 * A single entry in the conversation message history.
 *
 * Represents a message in a conversation with its identifier,
 * timestamp, and text content.
 */
export interface HistoryEntry {
  /** Unique identifier for the conversation */
  conversation_id: string;
  /** Unix timestamp (milliseconds) when the message was created */
  ts: number;
  /** The text content of the message */
  text: string;
}
