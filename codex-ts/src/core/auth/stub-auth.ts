/**
 * Stub authentication for Phase 4.1 testing.
 *
 * This is a temporary implementation to support testing the OpenAI client
 * modules without requiring full authentication infrastructure.
 *
 * TODO(Phase 5): Replace with full authentication implementation from codex-rs/core/src/auth.rs
 * - Token refresh logic
 * - Auth storage backend
 * - Keyring integration
 * - Token expiration handling
 * - ChatGPT OAuth flow
 */

/**
 * Authentication mode.
 *
 * Matches the AuthMode enum from codex-rs/app-server-protocol.
 */
export enum AuthMode {
  /** API key-based authentication */
  ApiKey = "apikey",
  /** ChatGPT OAuth authentication */
  ChatGPT = "chatgpt",
}

/**
 * Stub authentication for testing.
 *
 * This is a minimal implementation that supports:
 * - API key authentication
 * - ChatGPT token authentication
 * - Basic token retrieval
 *
 * Full implementation in Phase 5 will add:
 * - Token refresh
 * - Auth storage
 * - Token expiration
 * - Account management
 */
export class CodexAuth {
  /** Authentication mode */
  public readonly mode: AuthMode;

  /** Stored token/key */
  private readonly token: string;

  private constructor(mode: AuthMode, token: string) {
    this.mode = mode;
    this.token = token;
  }

  /**
   * Create authentication from API key.
   *
   * @param apiKey - OpenAI API key (e.g., "sk-...")
   * @returns CodexAuth instance with ApiKey mode
   */
  static fromApiKey(apiKey: string): CodexAuth {
    return new CodexAuth(AuthMode.ApiKey, apiKey);
  }

  /**
   * Create authentication from ChatGPT token.
   *
   * @param token - ChatGPT access token
   * @returns CodexAuth instance with ChatGPT mode
   */
  static fromChatGPT(token: string): CodexAuth {
    return new CodexAuth(AuthMode.ChatGPT, token);
  }

  /**
   * Get the authentication token.
   *
   * In the full implementation (Phase 5), this will:
   * - Check token expiration
   * - Refresh if needed
   * - Handle different auth modes appropriately
   *
   * @returns The authentication token
   */
  async getToken(): Promise<string> {
    // TODO(Phase 5): Add token refresh logic
    // TODO(Phase 5): Check expiration
    return this.token;
  }

  /**
   * Get the account ID if available.
   *
   * In the full implementation (Phase 5), this will parse
   * the ID token and extract account information.
   *
   * @returns Account ID or undefined
   */
  getAccountId(): string | undefined {
    // TODO(Phase 5): Parse token and extract account_id
    return undefined;
  }
}

/**
 * Environment variable for OpenAI API key.
 */
export const OPENAI_API_KEY_ENV_VAR = "OPENAI_API_KEY";

/**
 * Environment variable for Codex API key.
 */
export const CODEX_API_KEY_ENV_VAR = "CODEX_API_KEY";

/**
 * Read OpenAI API key from environment variables.
 *
 * Checks both OPENAI_API_KEY and CODEX_API_KEY.
 *
 * @returns API key if found, undefined otherwise
 */
export function readOpenaiApiKeyFromEnv(): string | undefined {
  const openaiKey = process.env[OPENAI_API_KEY_ENV_VAR]?.trim();
  if (openaiKey) {
    return openaiKey;
  }

  const codexKey = process.env[CODEX_API_KEY_ENV_VAR]?.trim();
  if (codexKey) {
    return codexKey;
  }

  return undefined;
}
