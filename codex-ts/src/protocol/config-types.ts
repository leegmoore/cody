/**
 * Configuration types for the Codex protocol.
 *
 * These types define enums for various configuration options including
 * reasoning behavior, sandbox modes, and authentication methods.
 *
 * Ported from: codex-rs/protocol/src/config_types.rs
 */

/**
 * Reasoning effort level for AI models.
 *
 * Controls how much computational effort the model invests in reasoning.
 * See https://platform.openai.com/docs/guides/reasoning?api-mode=responses#get-started-with-reasoning
 */
export enum ReasoningEffort {
  /** Minimal reasoning effort */
  Minimal = "minimal",
  /** Low reasoning effort */
  Low = "low",
  /** Medium reasoning effort (default) */
  Medium = "medium",
  /** High reasoning effort */
  High = "high",
}

/**
 * Reasoning summary format.
 *
 * Controls the format and detail level of reasoning summaries provided by the model.
 * See https://platform.openai.com/docs/guides/reasoning?api-mode=responses#reasoning-summaries
 */
export enum ReasoningSummary {
  /** Automatic summary format (default) */
  Auto = "auto",
  /** Concise reasoning summary */
  Concise = "concise",
  /** Detailed reasoning summary */
  Detailed = "detailed",
  /** Disable reasoning summaries */
  None = "none",
}

/**
 * Output verbosity level for GPT-5 models.
 *
 * Controls output length and detail via the Responses API.
 */
export enum Verbosity {
  /** Low verbosity - shorter outputs */
  Low = "low",
  /** Medium verbosity (default) - balanced outputs */
  Medium = "medium",
  /** High verbosity - more detailed outputs */
  High = "high",
}

/**
 * Sandbox filesystem access mode.
 *
 * Controls what filesystem operations the sandbox environment allows.
 */
export enum SandboxMode {
  /** Read-only access to filesystem (default, safest) */
  ReadOnly = "read-only",
  /** Write access limited to workspace directory */
  WorkspaceWrite = "workspace-write",
  /** Full filesystem access (dangerous, use with caution) */
  DangerFullAccess = "danger-full-access",
}

/**
 * Forced login method for authentication.
 *
 * Specifies which authentication method must be used.
 */
export enum ForcedLoginMethod {
  /** Use ChatGPT authentication */
  Chatgpt = "chatgpt",
  /** Use API key authentication */
  Api = "api",
}
