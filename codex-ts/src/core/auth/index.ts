/**
 * Authentication module for Codex.
 *
 * Provides centralized authentication management, credential storage,
 * and token refresh for both API key and ChatGPT OAuth authentication.
 */

import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { TokenData } from '../../token-data'

/**
 * Determine where Codex should store CLI auth credentials.
 */
export enum AuthCredentialsStoreMode {
  /** Persist credentials in CODEX_HOME/auth.json */
  File = 'file',
  /** Persist credentials in the system keyring */
  Keyring = 'keyring',
  /** Use keyring when available; otherwise fall back to file */
  Auto = 'auto',
}

/**
 * Authentication mode.
 */
export enum AuthMode {
  /** API key authentication */
  ApiKey = 'ApiKey',
  /** ChatGPT OAuth authentication */
  ChatGPT = 'ChatGPT',
}

/**
 * Expected structure for $CODEX_HOME/auth.json.
 */
export interface AuthDotJson {
  /** OpenAI API key */
  OPENAI_API_KEY?: string
  /** OAuth token data */
  tokens?: TokenData
  /** Last token refresh timestamp */
  last_refresh?: Date
}

/**
 * Environment variable names for API keys.
 */
export const OPENAI_API_KEY_ENV_VAR = 'OPENAI_API_KEY'
export const CODEX_API_KEY_ENV_VAR = 'CODEX_API_KEY'

/**
 * OAuth client ID for token refresh.
 */
export const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'

/**
 * Read OpenAI API key from environment variable.
 *
 * @returns API key if set, undefined otherwise
 */
export function readOpenaiApiKeyFromEnv(): string | undefined {
  const value = process.env[OPENAI_API_KEY_ENV_VAR]
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Read Codex API key from environment variable.
 *
 * @returns API key if set, undefined otherwise
 */
export function readCodexApiKeyFromEnv(): string | undefined {
  const value = process.env[CODEX_API_KEY_ENV_VAR]
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Get the auth.json file path.
 */
function getAuthFile(codexHome: string): string {
  return join(codexHome, 'auth.json')
}

/**
 * Storage backend interface for auth credentials.
 */
interface AuthStorageBackend {
  load(): Promise<AuthDotJson | undefined>
  save(auth: AuthDotJson): Promise<void>
  delete(): Promise<boolean>
}

/**
 * File-based auth storage backend.
 */
class FileAuthStorage implements AuthStorageBackend {
  constructor(private codexHome: string) {}

  async load(): Promise<AuthDotJson | undefined> {
    const authFile = getAuthFile(this.codexHome)
    try {
      const content = await readFile(authFile, 'utf-8')
      const data = JSON.parse(content)

      // Parse date if present
      if (data.last_refresh) {
        data.last_refresh = new Date(data.last_refresh)
      }

      return data
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return undefined
      }
      throw error
    }
  }

  async save(auth: AuthDotJson): Promise<void> {
    const authFile = getAuthFile(this.codexHome)

    // Ensure directory exists
    const dir = this.codexHome
    try {
      await access(dir)
    } catch {
      await mkdir(dir, { recursive: true, mode: 0o700 })
    }

    // Write with restrictive permissions (0600 on Unix)
    const json = JSON.stringify(auth, null, 2)
    await writeFile(authFile, json, { mode: 0o600 })
  }

  async delete(): Promise<boolean> {
    const authFile = getAuthFile(this.codexHome)
    try {
      await unlink(authFile)
      return true
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false
      }
      throw error
    }
  }
}

/**
 * Create auth storage backend based on mode.
 *
 * Note: For library port, only File mode is fully implemented.
 * Keyring and Auto modes fall back to File storage.
 */
function createAuthStorage(
  codexHome: string,
  _mode: AuthCredentialsStoreMode,
): AuthStorageBackend {
  // For library port, always use file storage
  // Full keyring integration can be added later using keyring-store module
  return new FileAuthStorage(codexHome)
}

/**
 * Core authentication object.
 *
 * Manages authentication state and provides access to tokens/API keys.
 */
export class CodexAuth {
  constructor(
    public readonly mode: AuthMode,
    private apiKey: string | undefined,
    private authDotJson: AuthDotJson | undefined,
    private storage: AuthStorageBackend,
  ) {}

  /**
   * Create CodexAuth from an API key.
   */
  static fromApiKey(apiKey: string): CodexAuth {
    return new CodexAuth(
      AuthMode.ApiKey,
      apiKey,
      undefined,
      createAuthStorage('', AuthCredentialsStoreMode.File),
    )
  }

  /**
   * Create dummy ChatGPT auth for testing.
   */
  static createDummyChatGptAuthForTesting(tokenData?: TokenData): CodexAuth {
    const authData: AuthDotJson = {
      OPENAI_API_KEY: undefined,
      tokens: tokenData || {
        id_token: {
          email: 'test@example.com',
          raw_jwt: 'fake.jwt.token',
        },
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        account_id: 'test-account',
      },
      last_refresh: new Date(),
    }

    return new CodexAuth(
      AuthMode.ChatGPT,
      undefined,
      authData,
      createAuthStorage('', AuthCredentialsStoreMode.File),
    )
  }

  /**
   * Load auth from storage.
   */
  static async fromAuthStorage(
    codexHome: string,
    authCredentialsStoreMode: AuthCredentialsStoreMode,
  ): Promise<CodexAuth | undefined> {
    const storage = createAuthStorage(codexHome, authCredentialsStoreMode)
    const authData = await storage.load()

    if (!authData) {
      return undefined
    }

    // Prefer API key if set
    if (authData.OPENAI_API_KEY) {
      return new CodexAuth(AuthMode.ApiKey, authData.OPENAI_API_KEY, authData, storage)
    }

    // Otherwise use ChatGPT tokens
    if (authData.tokens) {
      return new CodexAuth(AuthMode.ChatGPT, undefined, authData, storage)
    }

    return undefined
  }

  /**
   * Get the API key (for API key auth mode).
   */
  getApiKey(): string | undefined {
    return this.apiKey
  }

  /**
   * Get the account ID from token data.
   */
  getAccountId(): string | undefined {
    return this.authDotJson?.tokens?.account_id
  }

  /**
   * Get the account email from token data.
   */
  getAccountEmail(): string | undefined {
    return this.authDotJson?.tokens?.id_token.email
  }

  /**
   * Get current token data.
   */
  getTokenData(): TokenData | undefined {
    return this.authDotJson?.tokens
  }

  /**
   * Get access token (for ChatGPT mode).
   */
  async getToken(): Promise<string> {
    if (this.mode === AuthMode.ApiKey) {
      return this.apiKey || ''
    }

    const tokenData = this.getTokenData()
    if (!tokenData) {
      throw new Error('Token data is not available')
    }

    return tokenData.access_token
  }
}

/**
 * Save auth data to storage.
 */
export async function saveAuth(
  codexHome: string,
  auth: AuthDotJson,
  authCredentialsStoreMode: AuthCredentialsStoreMode,
): Promise<void> {
  const storage = createAuthStorage(codexHome, authCredentialsStoreMode)
  await storage.save(auth)
}

/**
 * Load auth data from storage.
 */
export async function loadAuthDotJson(
  codexHome: string,
  authCredentialsStoreMode: AuthCredentialsStoreMode,
): Promise<AuthDotJson | undefined> {
  const storage = createAuthStorage(codexHome, authCredentialsStoreMode)
  return await storage.load()
}

/**
 * Login with API key.
 *
 * Creates an auth.json file containing only the API key.
 */
export async function loginWithApiKey(
  codexHome: string,
  apiKey: string,
  authCredentialsStoreMode: AuthCredentialsStoreMode,
): Promise<void> {
  const authData: AuthDotJson = {
    OPENAI_API_KEY: apiKey,
    tokens: undefined,
    last_refresh: undefined,
  }
  await saveAuth(codexHome, authData, authCredentialsStoreMode)
}

/**
 * Logout by deleting the auth.json file.
 *
 * @returns true if a file was removed, false if no auth file existed
 */
export async function logout(
  codexHome: string,
  authCredentialsStoreMode: AuthCredentialsStoreMode,
): Promise<boolean> {
  const storage = createAuthStorage(codexHome, authCredentialsStoreMode)
  return await storage.delete()
}

/**
 * Central manager providing a single source of truth for auth.json derived
 * authentication data.
 *
 * Loads once (or on preference change) and then hands out cloned CodexAuth
 * values so the rest of the program has a consistent snapshot.
 *
 * External modifications to auth.json will NOT be observed until reload()
 * is called explicitly.
 */
export class AuthManager {
  private cachedAuth: CodexAuth | undefined

  /**
   * Create auth manager (loads auth synchronously from environment and storage).
   */
  constructor(
    private codexHome: string,
    private enableCodexApiKeyEnv: boolean,
    private authCredentialsStoreMode: AuthCredentialsStoreMode,
  ) {
    // Load auth synchronously from environment and storage
    this.cachedAuth = this.loadAuthSync()
  }

  /**
   * Create shared auth manager (factory method).
   */
  static shared(
    codexHome: string,
    enableCodexApiKeyEnv: boolean,
    authCredentialsStoreMode: AuthCredentialsStoreMode,
  ): AuthManager {
    return new AuthManager(codexHome, enableCodexApiKeyEnv, authCredentialsStoreMode)
  }

  /**
   * Create test manager with specific auth.
   */
  static fromAuthForTesting(auth: CodexAuth): AuthManager {
    const manager = new AuthManager('', false, AuthCredentialsStoreMode.File)
    manager.cachedAuth = auth
    return manager
  }

  /**
   * Get current cached auth (may be undefined if not logged in).
   */
  auth(): CodexAuth | undefined {
    return this.cachedAuth
  }

  /**
   * Force reload of auth from storage.
   *
   * @returns true if the auth value changed
   */
  reload(): boolean {
    const newAuth = this.loadAuthSync()
    const changed = !this.authsEqual(this.cachedAuth, newAuth)
    this.cachedAuth = newAuth
    return changed
  }

  /**
   * Logout by deleting auth file and clearing cache.
   *
   * @returns true if a file was removed
   */
  async logout(): Promise<boolean> {
    const removed = await logout(this.codexHome, this.authCredentialsStoreMode)
    this.reload() // Clear cache
    return removed
  }

  /**
   * Load auth synchronously from environment and storage.
   */
  private loadAuthSync(): CodexAuth | undefined {
    // Check environment first
    if (this.enableCodexApiKeyEnv) {
      const envApiKey = readCodexApiKeyFromEnv()
      if (envApiKey) {
        return CodexAuth.fromApiKey(envApiKey)
      }
    }

    // Load from storage (sync)
    const authFile = getAuthFile(this.codexHome)
    if (!existsSync(authFile)) {
      return undefined
    }

    try {
      const content = readFileSync(authFile, 'utf-8')
      const authData = JSON.parse(content)

      // Parse date if present
      if (authData.last_refresh) {
        authData.last_refresh = new Date(authData.last_refresh)
      }

      const storage = createAuthStorage(this.codexHome, this.authCredentialsStoreMode)

      // Prefer API key if set
      if (authData.OPENAI_API_KEY) {
        return new CodexAuth(AuthMode.ApiKey, authData.OPENAI_API_KEY, authData, storage)
      }

      // Otherwise use ChatGPT tokens
      if (authData.tokens) {
        return new CodexAuth(AuthMode.ChatGPT, undefined, authData, storage)
      }

      return undefined
    } catch (error) {
      return undefined
    }
  }

  /**
   * Compare two auth objects for equality.
   */
  private authsEqual(a: CodexAuth | undefined, b: CodexAuth | undefined): boolean {
    if (a === undefined && b === undefined) return true
    if (a === undefined || b === undefined) return false
    return a.mode === b.mode
  }
}
