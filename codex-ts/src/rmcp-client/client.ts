/**
 * RMCP (Remote MCP) Client - STUB IMPLEMENTATION
 *
 * This module provides OAuth-authenticated remote MCP server connections.
 * Full implementation deferred to Phase 5 when auth infrastructure is ready.
 *
 * Ported from: codex-rs/rmcp-client (~2000 LOC)
 *
 * Phase 5 TODO:
 * - Implement OAuth2 flow with webbrowser integration
 * - Add keyring storage for OAuth tokens
 * - Implement streamable HTTP transport
 * - Add child process transport
 * - Full RMCP protocol support
 * - Auth status determination
 * - Token refresh logic
 */

/**
 * OAuth credentials storage mode
 */
export enum OAuthCredentialsStoreMode {
  /** Store in system keyring */
  Keyring = "keyring",
  /** Store in file (insecure, for testing) */
  File = "file",
}

/**
 * Stored OAuth tokens
 */
export interface StoredOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  scope?: string;
}

/**
 * OAuth token response wrapper
 */
export interface WrappedOAuthTokenResponse {
  tokens: StoredOAuthTokens;
  server_name: string;
}

/**
 * RMCP client for connecting to remote MCP servers
 *
 * STUB: Full implementation deferred to Phase 5
 */
export class RmcpClient {
  private serverName: string;

  constructor(serverName: string) {
    this.serverName = serverName;
  }

  /**
   * Get the server name
   */
  getServerName(): string {
    return this.serverName;
  }

  /**
   * Connect to remote MCP server
   *
   * TODO(Phase 5): Implement OAuth flow and connection
   */
  async connect(): Promise<void> {
    throw new Error(
      "RmcpClient.connect() not implemented - deferred to Phase 5",
    );
  }

  /**
   * Disconnect from server
   *
   * TODO(Phase 5): Implement graceful disconnect
   */
  async disconnect(): Promise<void> {
    throw new Error(
      "RmcpClient.disconnect() not implemented - deferred to Phase 5",
    );
  }
}

/**
 * Determine authentication status for streamable HTTP transport
 *
 * TODO(Phase 5): Implement full auth status checking
 */
export async function determineStreamableHttpAuthStatus(
  _serverName: string,
  _url: string,
  _bearerTokenEnvVar?: string,
  _httpHeaders?: Record<string, string>,
  _envHttpHeaders?: Record<string, string>,
  _storeMode?: OAuthCredentialsStoreMode,
): Promise<string> {
  // Stub: return unsupported for now
  return "unsupported";
}

/**
 * Check if OAuth login is supported for a server
 *
 * TODO(Phase 5): Implement based on server config
 */
export function supportsOAuthLogin(_serverConfig: unknown): boolean {
  // Stub: return false for now
  return false;
}

/**
 * Perform OAuth login flow
 *
 * TODO(Phase 5): Implement full OAuth flow with browser
 */
export async function performOAuthLogin(
  _serverName: string,
  _authUrl: string,
  _tokenUrl: string,
  _clientId: string,
  _scopes: string[],
  _storeMode: OAuthCredentialsStoreMode,
): Promise<WrappedOAuthTokenResponse> {
  throw new Error("performOAuthLogin() not implemented - deferred to Phase 5");
}

/**
 * Save OAuth tokens to storage
 *
 * TODO(Phase 5): Implement keyring/file storage
 */
export async function saveOAuthTokens(
  _serverName: string,
  _tokens: StoredOAuthTokens,
  _storeMode: OAuthCredentialsStoreMode,
): Promise<void> {
  throw new Error("saveOAuthTokens() not implemented - deferred to Phase 5");
}

/**
 * Delete OAuth tokens from storage
 *
 * TODO(Phase 5): Implement keyring/file deletion
 */
export async function deleteOAuthTokens(
  _serverName: string,
  _storeMode: OAuthCredentialsStoreMode,
): Promise<void> {
  throw new Error("deleteOAuthTokens() not implemented - deferred to Phase 5");
}
