/**
 * Shared error types for Codex.
 */

/** Configuration file or option issue. */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/** Raised when the CLI expects an active conversation but none exists. */
export class NoActiveConversationError extends Error {
  constructor(message = "No active conversation. Run `cody new` first.") {
    super(message);
    this.name = "NoActiveConversationError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConversationNotFoundError extends Error {
  constructor(id: string) {
    super(
      `Conversation '${id}' not found. Run 'cody list' to see available IDs.`,
    );
    this.name = "ConversationNotFoundError";
  }
}

export class CorruptedRolloutError extends Error {
  constructor(id: string) {
    super(`Conversation '${id}' has corrupted rollout data.`);
    this.name = "CorruptedRolloutError";
  }
}

export class EmptyRolloutError extends Error {
  constructor(id: string) {
    super(`Conversation '${id}' has no turns to resume.`);
    this.name = "EmptyRolloutError";
  }
}
