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
