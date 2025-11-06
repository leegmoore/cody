/**
 * ChatGPT token management.
 *
 * Simplified implementation for Phase 4.3. Full authentication
 * integration will be added in Phase 5 when core/auth is complete.
 *
 * Ported from: codex-rs/chatgpt/src/chatgpt_token.rs
 *
 * TODO(Phase 5): Integrate with full authentication system
 * TODO(Phase 5): Add token refresh logic
 * TODO(Phase 5): Add auth storage loading
 */

/**
 * ChatGPT token data
 */
export interface ChatGptTokenData {
  /** Access token for ChatGPT API */
  accessToken: string;
  /** Account ID for ChatGPT */
  accountId?: string;
}

/**
 * Global token storage (simplified for Phase 4.3)
 * In Rust, this uses LazyLock<RwLock<Option<TokenData>>>
 */
let chatgptToken: ChatGptTokenData | undefined = undefined;

/**
 * Get the current ChatGPT token data.
 *
 * @returns The token data if set, undefined otherwise
 */
export function getChatGptTokenData(): ChatGptTokenData | undefined {
  return chatgptToken;
}

/**
 * Set the ChatGPT token data.
 *
 * @param tokenData - The token data to store
 */
export function setChatGptTokenData(tokenData: ChatGptTokenData): void {
  chatgptToken = tokenData;
}

/**
 * Clear the ChatGPT token data.
 */
export function clearChatGptTokenData(): void {
  chatgptToken = undefined;
}

/**
 * Initialize ChatGPT token from authentication storage.
 *
 * TODO(Phase 5): Implement full auth loading from storage
 * This is a stub for Phase 4.3 - full implementation requires
 * auth storage from Phase 5.
 *
 * @param codexHome - Codex home directory
 * @returns Promise that resolves when token is initialized
 */
export async function initChatGptTokenFromAuth(
  _codexHome: string,
): Promise<void> {
  // TODO(Phase 5): Load auth from storage
  // For now, this is a no-op
  // The full implementation will:
  // 1. Load CodexAuth from auth storage
  // 2. Get token data from auth
  // 3. Call setChatGptTokenData()
}
