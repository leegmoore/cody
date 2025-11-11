/**
 * RMCP Client - Remote MCP server connections with OAuth
 *
 * STUB IMPLEMENTATION - Full implementation deferred to Phase 5
 *
 * Ported from: codex-rs/rmcp-client
 */

export {
  RmcpClient,
  OAuthCredentialsStoreMode,
  determineStreamableHttpAuthStatus,
  supportsOAuthLogin,
  performOAuthLogin,
  saveOAuthTokens,
  deleteOAuthTokens,
} from "./client.js";

export type { StoredOAuthTokens, WrappedOAuthTokenResponse } from "./client.js";
