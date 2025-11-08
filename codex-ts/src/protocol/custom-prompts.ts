/**
 * Custom prompt types for the Codex protocol.
 *
 * Supports user-defined slash commands backed by prompt files.
 *
 * Ported from: codex-rs/protocol/src/custom_prompts.rs
 */

/**
 * Base namespace for custom prompt slash commands (without trailing colon).
 *
 * Example usage forms constructed in code:
 * - Command token after '/': `"{PROMPTS_CMD_PREFIX}:name"`
 * - Full slash prefix: `"/{PROMPTS_CMD_PREFIX}:"`
 */
export const PROMPTS_CMD_PREFIX = "prompts";

/**
 * Represents a custom prompt defined by the user.
 *
 * Custom prompts allow users to create reusable slash commands
 * backed by prompt template files.
 */
export interface CustomPrompt {
  /** Name of the custom prompt (used in slash command) */
  name: string;
  /** File system path to the prompt template file */
  path: string;
  /** Content of the prompt template */
  content: string;
  /** Optional description of what this prompt does */
  description?: string;
  /** Optional hint about arguments this prompt accepts */
  argument_hint?: string;
}
