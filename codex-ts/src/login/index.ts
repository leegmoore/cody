/**
 * Login flow utilities for OAuth authentication.
 *
 * This module provides PKCE (Proof Key for Code Exchange) generation for OAuth flows
 * and stub types for login server functionality.
 *
 * Note: Full login server implementation with HTTP server and browser integration
 * is CLI-specific and not included in this library port. This module provides
 * the essential cryptographic utilities and type definitions needed for core/auth.
 */

import { createHash, randomBytes } from 'node:crypto'

/**
 * PKCE (Proof Key for Code Exchange) codes for OAuth authorization code flow.
 *
 * PKCE enhances the security of OAuth by creating a cryptographically random
 * code verifier and a code challenge derived from it.
 */
export interface PkceCodes {
  /** The code verifier (URL-safe base64, 43-128 characters) */
  codeVerifier: string
  /** The code challenge (base64url-encoded SHA256 hash of verifier) */
  codeChallenge: string
}

/**
 * Generate PKCE codes for OAuth authorization code flow.
 *
 * Implements RFC 7636 - Proof Key for Code Exchange by OAuth Public Clients
 *
 * @returns PKCE codes containing verifier and challenge
 */
export function generatePkce(): PkceCodes {
  // Generate 64 random bytes for the verifier
  const bytes = randomBytes(64)

  // Verifier: URL-safe base64 without padding (43..128 chars per RFC 7636)
  const codeVerifier = bytes.toString('base64url')

  // Challenge (S256 method): BASE64URL-ENCODE(SHA256(verifier)) without padding
  const hash = createHash('sha256').update(codeVerifier).digest()
  const codeChallenge = hash.toString('base64url')

  return {
    codeVerifier,
    codeChallenge,
  }
}

/**
 * Authentication credentials store mode.
 *
 * Determines how authentication credentials are stored.
 */
export enum AuthCredentialsStoreMode {
  /** Store credentials in keyring only */
  KeyringOnly = 'KeyringOnly',
  /** Store credentials in file system only */
  FileSystemOnly = 'FileSystemOnly',
  /** Store credentials in both keyring and file system */
  Both = 'Both',
}

/**
 * Options for configuring the login server.
 *
 * Note: This is a stub interface for library compatibility.
 * Full HTTP server implementation is CLI-specific.
 */
export interface ServerOptions {
  /** Codex home directory path */
  codexHome: string
  /** OAuth client ID */
  clientId: string
  /** OAuth issuer URL (e.g., "https://auth.openai.com") */
  issuer: string
  /** Port for local callback server */
  port: number
  /** Whether to automatically open browser for authentication */
  openBrowser: boolean
  /** Forced state value for testing (optional) */
  forceState?: string
  /** Restrict login to specific ChatGPT workspace ID */
  forcedChatgptWorkspaceId?: string
  /** How to store authentication credentials */
  cliAuthCredentialsStoreMode: AuthCredentialsStoreMode
}

/**
 * Create default server options for OAuth flow.
 *
 * @param codexHome - Codex home directory path
 * @param clientId - OAuth client ID
 * @param forcedChatgptWorkspaceId - Optional workspace restriction
 * @param cliAuthCredentialsStoreMode - Credentials storage mode
 * @returns Server options with defaults
 */
export function createServerOptions(
  codexHome: string,
  clientId: string,
  forcedChatgptWorkspaceId: string | undefined,
  cliAuthCredentialsStoreMode: AuthCredentialsStoreMode,
): ServerOptions {
  return {
    codexHome,
    clientId,
    issuer: 'https://auth.openai.com',
    port: 1455,
    openBrowser: true,
    forcedChatgptWorkspaceId,
    cliAuthCredentialsStoreMode,
  }
}

/**
 * Handle to control running login server.
 *
 * Note: This is a stub interface. Full HTTP server implementation is CLI-specific.
 */
export interface ShutdownHandle {
  /** Cancel the login flow */
  shutdown(): void
}

/**
 * Login server for OAuth flows.
 *
 * Note: This is a stub interface. Full HTTP server implementation is CLI-specific.
 * For actual authentication in a library context, use the auth module which provides
 * API-key based authentication and token management.
 */
export interface LoginServer {
  /** The authorization URL to direct the user to */
  authUrl: string
  /** The actual port the server is listening on */
  actualPort: number
  /** Wait for the login flow to complete */
  blockUntilDone(): Promise<void>
  /** Cancel the login flow */
  cancel(): void
  /** Get a handle to cancel the login flow */
  cancelHandle(): ShutdownHandle
}

/**
 * Stub implementation note:
 *
 * The following functions from the Rust implementation are CLI-specific
 * and not included in this library port:
 *
 * - runLoginServer() - Starts HTTP server for OAuth callback
 * - runDeviceCodeLogin() - Device code authentication flow
 * - exchangeCodeForTokens() - Token exchange with OAuth provider
 * - obtainApiKey() - API key token exchange
 *
 * For library usage, authentication should be handled through:
 * 1. API key authentication (see core/auth module)
 * 2. Token-based authentication with existing credentials
 * 3. External authentication flows that provide tokens to the library
 */
