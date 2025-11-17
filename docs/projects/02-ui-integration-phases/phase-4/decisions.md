# Phase 4: Authentication Expansion – Decisions

## Claude OAuth token source

- For this phase we introduced `readClaudeOAuthToken` in `codex-ts/src/core/auth/claude-oauth.ts`.
- The helper looks for credentials in the following locations under the current home directory:
  - `~/.claude/credentials.json`
  - `~/.claude/config/auth.json`
  - `~/.config/claude/credentials.json`
- The first file that exists and contains a non-empty `access_token` (or `token`) field is considered the active Claude OAuth token. We also accept a `CLAUDE_OAUTH_ACCESS_TOKEN` environment variable so macOS users can export the keychain value without duplicating files.
- AuthManager consumes this helper directly, so both the CLI runtime and mocked-service tests rely on the same file-reading path (tests stub the reader through `AuthManagerOptions`).

## CLI auth methods representation

- We extended the CLI auth configuration in `codex-ts/src/cli/config.ts` with an explicit `AuthMethod` union:
  - `"api-key"`
  - `"openai-api-key"`
  - `"anthropic-api-key"`
  - `"oauth-chatgpt"`
  - `"oauth-claude"`
- `CliAuthConfig.method` now uses `AuthMethod`, and `normalizeAuthMethod()` validates values from `config.toml`, failing fast with a clear `ConfigurationError` for unknown methods.
- For backward compatibility, `"api-key"` continues to work and is mapped to `"openai-api-key"` or `"anthropic-api-key"` based on the active provider, so users don’t need to hand-edit the config when switching providers.

## CLI commands: login and set-auth

- New commands were added and registered in `codex-ts/src/cli/index.ts`:
  - `login` → `registerLoginCommand` in `src/cli/commands/login.ts`
  - `set-auth` → `registerSetAuthCommand` in `src/cli/commands/set-auth.ts`
- The `login` command:
  - Prints the current auth method from the CLI config.
  - Shows a simple status table for `openai-api-key`, `anthropic-api-key`, `oauth-chatgpt`, and `oauth-claude`.
  - Marks methods as available only when `AuthManager.getToken()` succeeds for that provider, ensuring the display reflects the same logic used at runtime.
- The `set-auth` command:
  - Validates the requested method using `normalizeAuthMethod`.
  - Updates the `[auth]` section in `config.toml` via `writeRawCliConfig`.
  - Prompts for missing API keys when switching to `api-key` / `openai-api-key` or `anthropic-api-key` to keep UX simple in this phase.

## Token sourcing strategy (Phase 4 scope)

- All model requests still flow through a single bearer token provided to `CodexAuth` and ultimately to `ModelClient`.
- `createAuthManagerFromCliConfig` (optionally) builds a fresh core config and wires CLI auth settings into it before instantiating `AuthManager`.
- `AuthManager.getToken()` now sources credentials as follows:
  - OpenAI:
    - `"api-key"` / `"openai-api-key"` → `auth.openai_key` in `config.toml`.
    - `"oauth-chatgpt"` → keyring files (`~/.cody/oauth/chatgpt.json`, `~/.codex/auth.json`, etc.) via the injected `readChatGptToken` helper.
  - Anthropic:
    - `"api-key"` / `"anthropic-api-key"` → `auth.anthropic_key` in `config.toml`.
    - `"oauth-claude"` → the Claude credential paths described above via `readClaudeOAuthToken`.
- If no suitable token is found we throw `AuthError` with actionable instructions (configure `[auth]` keys or re-authenticate in the source app).

## OAuth × provider validation

- We enforce the key constraint that OAuth methods can only be used with compatible providers when `AuthManager.getToken()` is invoked:
  - `"oauth-chatgpt"` is only valid with OpenAI providers.
  - `"oauth-claude"` is only valid with Anthropic providers.
- The resulting errors explicitly include the conflicting provider and the corrective CLI command (`cody set-provider …`).
- Mocked-service tests in `codex-ts/tests/mocked-service/phase-4-auth-methods.test.ts` cover:
  - Valid ChatGPT OAuth + OpenAI Responses path (happy path placeholder).
  - Valid Claude OAuth + Anthropic Messages path.
  - Provider mismatch rejections by calling `getToken()` with the wrong provider.
