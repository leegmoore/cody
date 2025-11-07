import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AuthCredentialsStoreMode,
  AuthDotJson,
  AuthMode,
  CodexAuth,
  AuthManager,
  loginWithApiKey,
  logout,
  loadAuthDotJson,
  saveAuth,
  readOpenaiApiKeyFromEnv,
  readCodexApiKeyFromEnv,
  OPENAI_API_KEY_ENV_VAR,
  CODEX_API_KEY_ENV_VAR,
} from './index'
import { TokenData, IdTokenInfo } from '../../token-data'

describe('AuthCredentialsStoreMode', () => {
  it('should have correct enum values', () => {
    expect(AuthCredentialsStoreMode.File).toBe('file')
    expect(AuthCredentialsStoreMode.Keyring).toBe('keyring')
    expect(AuthCredentialsStoreMode.Auto).toBe('auto')
  })
})

describe('AuthDotJson', () => {
  it('should create valid auth data structure', () => {
    const authData: AuthDotJson = {
      OPENAI_API_KEY: 'sk-test-key',
      tokens: undefined,
      last_refresh: undefined,
    }

    expect(authData.OPENAI_API_KEY).toBe('sk-test-key')
    expect(authData.tokens).toBeUndefined()
  })

  it('should support token data', () => {
    const tokenData: TokenData = {
      id_token: {
        email: 'test@example.com',
        chatgpt_plan_type: undefined,
        chatgpt_account_id: undefined,
        raw_jwt: 'fake.jwt.token',
      },
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      account_id: 'account-123',
    }

    const authData: AuthDotJson = {
      OPENAI_API_KEY: undefined,
      tokens: tokenData,
      last_refresh: new Date(),
    }

    expect(authData.tokens).toBeDefined()
    expect(authData.tokens?.access_token).toBe('access-token')
  })
})

describe('File Storage Operations', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'codex-auth-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('saveAuth', () => {
    it('should save auth data to file', async () => {
      const authData: AuthDotJson = {
        OPENAI_API_KEY: 'sk-test-key',
        tokens: undefined,
        last_refresh: undefined,
      }

      await saveAuth(tempDir, authData, AuthCredentialsStoreMode.File)

      const authFile = join(tempDir, 'auth.json')
      const content = await readFile(authFile, 'utf-8')
      const parsed = JSON.parse(content)

      expect(parsed.OPENAI_API_KEY).toBe('sk-test-key')
    })

    it('should create directory if it does not exist', async () => {
      const nestedDir = join(tempDir, 'nested', 'path')
      const authData: AuthDotJson = {
        OPENAI_API_KEY: 'sk-test-key',
        tokens: undefined,
        last_refresh: undefined,
      }

      await saveAuth(nestedDir, authData, AuthCredentialsStoreMode.File)

      const authFile = join(nestedDir, 'auth.json')
      const content = await readFile(authFile, 'utf-8')
      expect(content).toContain('sk-test-key')
    })
  })

  describe('loadAuthDotJson', () => {
    it('should load auth data from file', async () => {
      const authData: AuthDotJson = {
        OPENAI_API_KEY: 'sk-loaded-key',
        tokens: undefined,
        last_refresh: undefined,
      }

      await saveAuth(tempDir, authData, AuthCredentialsStoreMode.File)
      const loaded = await loadAuthDotJson(tempDir, AuthCredentialsStoreMode.File)

      expect(loaded).toBeDefined()
      expect(loaded?.OPENAI_API_KEY).toBe('sk-loaded-key')
    })

    it('should return undefined for non-existent file', async () => {
      const loaded = await loadAuthDotJson(tempDir, AuthCredentialsStoreMode.File)
      expect(loaded).toBeUndefined()
    })
  })

  describe('loginWithApiKey', () => {
    it('should save API key to auth file', async () => {
      await loginWithApiKey(tempDir, 'sk-new-key', AuthCredentialsStoreMode.File)

      const loaded = await loadAuthDotJson(tempDir, AuthCredentialsStoreMode.File)
      expect(loaded?.OPENAI_API_KEY).toBe('sk-new-key')
      expect(loaded?.tokens).toBeUndefined()
    })

    it('should overwrite existing auth data', async () => {
      const oldAuth: AuthDotJson = {
        OPENAI_API_KEY: 'sk-old-key',
        tokens: {
          id_token: {} as IdTokenInfo,
          access_token: 'old-access',
          refresh_token: 'old-refresh',
          account_id: 'old-account',
        },
        last_refresh: new Date(),
      }

      await saveAuth(tempDir, oldAuth, AuthCredentialsStoreMode.File)
      await loginWithApiKey(tempDir, 'sk-new-key', AuthCredentialsStoreMode.File)

      const loaded = await loadAuthDotJson(tempDir, AuthCredentialsStoreMode.File)
      expect(loaded?.OPENAI_API_KEY).toBe('sk-new-key')
      expect(loaded?.tokens).toBeUndefined()
    })
  })

  describe('logout', () => {
    it('should remove auth file and return true', async () => {
      await loginWithApiKey(tempDir, 'sk-test', AuthCredentialsStoreMode.File)

      const removed = await logout(tempDir, AuthCredentialsStoreMode.File)
      expect(removed).toBe(true)

      const loaded = await loadAuthDotJson(tempDir, AuthCredentialsStoreMode.File)
      expect(loaded).toBeUndefined()
    })

    it('should return false if no auth file exists', async () => {
      const removed = await logout(tempDir, AuthCredentialsStoreMode.File)
      expect(removed).toBe(false)
    })
  })
})

describe('Environment Variable Reading', () => {
  const originalOpenAI = process.env[OPENAI_API_KEY_ENV_VAR]
  const originalCodex = process.env[CODEX_API_KEY_ENV_VAR]

  afterEach(() => {
    // Restore original values
    if (originalOpenAI !== undefined) {
      process.env[OPENAI_API_KEY_ENV_VAR] = originalOpenAI
    } else {
      delete process.env[OPENAI_API_KEY_ENV_VAR]
    }

    if (originalCodex !== undefined) {
      process.env[CODEX_API_KEY_ENV_VAR] = originalCodex
    } else {
      delete process.env[CODEX_API_KEY_ENV_VAR]
    }
  })

  describe('readOpenaiApiKeyFromEnv', () => {
    it('should read OPENAI_API_KEY from environment', () => {
      process.env[OPENAI_API_KEY_ENV_VAR] = 'sk-env-key'
      expect(readOpenaiApiKeyFromEnv()).toBe('sk-env-key')
    })

    it('should return undefined if not set', () => {
      delete process.env[OPENAI_API_KEY_ENV_VAR]
      expect(readOpenaiApiKeyFromEnv()).toBeUndefined()
    })

    it('should trim whitespace', () => {
      process.env[OPENAI_API_KEY_ENV_VAR] = '  sk-trimmed  '
      expect(readOpenaiApiKeyFromEnv()).toBe('sk-trimmed')
    })

    it('should return undefined for empty string', () => {
      process.env[OPENAI_API_KEY_ENV_VAR] = '   '
      expect(readOpenaiApiKeyFromEnv()).toBeUndefined()
    })
  })

  describe('readCodexApiKeyFromEnv', () => {
    it('should read CODEX_API_KEY from environment', () => {
      process.env[CODEX_API_KEY_ENV_VAR] = 'sk-codex-key'
      expect(readCodexApiKeyFromEnv()).toBe('sk-codex-key')
    })

    it('should return undefined if not set', () => {
      delete process.env[CODEX_API_KEY_ENV_VAR]
      expect(readCodexApiKeyFromEnv()).toBeUndefined()
    })
  })
})

describe('CodexAuth', () => {
  it('should create auth from API key', () => {
    const auth = CodexAuth.fromApiKey('sk-test-key')

    expect(auth.mode).toBe(AuthMode.ApiKey)
    expect(auth.getApiKey()).toBe('sk-test-key')
  })

  it('should get account ID from token data', async () => {
    const tokenData: TokenData = {
      id_token: {
        email: 'test@example.com',
        chatgpt_plan_type: undefined,
        chatgpt_account_id: 'acc-123',
        raw_jwt: 'fake.jwt.token',
      },
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      account_id: 'acc-123',
    }

    const auth = CodexAuth.createDummyChatGptAuthForTesting(tokenData)
    expect(auth.getAccountId()).toBe('acc-123')
  })

  it('should get account email from token data', async () => {
    const tokenData: TokenData = {
      id_token: {
        email: 'user@example.com',
        chatgpt_plan_type: undefined,
        chatgpt_account_id: undefined,
        raw_jwt: 'fake.jwt.token',
      },
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      account_id: undefined,
    }

    const auth = CodexAuth.createDummyChatGptAuthForTesting(tokenData)
    expect(auth.getAccountEmail()).toBe('user@example.com')
  })
})

describe('AuthManager', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'codex-auth-manager-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should create manager with no auth', () => {
    const manager = new AuthManager(tempDir, false, AuthCredentialsStoreMode.File)
    expect(manager.auth()).toBeUndefined()
  })

  it('should load existing auth on creation', async () => {
    await loginWithApiKey(tempDir, 'sk-initial-key', AuthCredentialsStoreMode.File)

    const manager = new AuthManager(tempDir, false, AuthCredentialsStoreMode.File)
    const auth = manager.auth()

    expect(auth).toBeDefined()
    expect(auth?.mode).toBe(AuthMode.ApiKey)
    expect(auth?.getApiKey()).toBe('sk-initial-key')
  })

  it('should reload auth after external changes', async () => {
    const manager = new AuthManager(tempDir, false, AuthCredentialsStoreMode.File)
    expect(manager.auth()).toBeUndefined()

    // External change
    await loginWithApiKey(tempDir, 'sk-new-key', AuthCredentialsStoreMode.File)

    const changed = manager.reload()
    expect(changed).toBe(true)

    const auth = manager.auth()
    expect(auth?.getApiKey()).toBe('sk-new-key')
  })

  it('should detect no change on reload', async () => {
    await loginWithApiKey(tempDir, 'sk-same-key', AuthCredentialsStoreMode.File)

    const manager = new AuthManager(tempDir, false, AuthCredentialsStoreMode.File)
    const changed = manager.reload()

    expect(changed).toBe(false)
  })

  it('should logout and clear cached auth', async () => {
    await loginWithApiKey(tempDir, 'sk-logout-test', AuthCredentialsStoreMode.File)

    const manager = new AuthManager(tempDir, false, AuthCredentialsStoreMode.File)
    expect(manager.auth()).toBeDefined()

    const removed = await manager.logout()
    expect(removed).toBe(true)
    expect(manager.auth()).toBeUndefined()
  })

  it('should create shared manager with Arc-like pattern', () => {
    const manager = AuthManager.shared(tempDir, false, AuthCredentialsStoreMode.File)
    expect(manager).toBeDefined()
    expect(manager.auth()).toBeUndefined()
  })

  it('should create test manager with specific auth', () => {
    const auth = CodexAuth.fromApiKey('sk-test-override')
    const manager = AuthManager.fromAuthForTesting(auth)

    expect(manager.auth()?.getApiKey()).toBe('sk-test-override')
  })
})
