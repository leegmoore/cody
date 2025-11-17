import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  createDefaultConfig,
  type AuthConfig,
  type AuthMethod,
  type Config,
} from "../config.js";
import { CodexAuth } from "./stub-auth.js";
import { readClaudeOAuthToken, CLAUDE_OAUTH_PATHS } from "./claude-oauth.js";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export { CodexAuth, AuthMode } from "./stub-auth.js";

const DEFAULT_CHATGPT_TOKEN_PATHS = [
  join(homedir(), ".cody", "oauth", "chatgpt.json"),
  join(homedir(), ".codex", "auth.json"),
];

export interface AuthManagerOptions {
  saveAuthConfig?: (auth: AuthConfig) => Promise<void>;
  readChatGptToken?: () => Promise<string | undefined>;
  readClaudeToken?: () => Promise<string | undefined>;
  fixedCodexAuth?: CodexAuth;
}

export class AuthManager {
  private readonly readChatGptTokenFn: () => Promise<string | undefined>;
  private readonly readClaudeTokenFn: () => Promise<string | undefined>;
  private readonly fixedCodexAuth?: CodexAuth;

  constructor(
    private readonly config: Config,
    private readonly options: AuthManagerOptions = {},
  ) {
    this.readChatGptTokenFn =
      options.readChatGptToken ?? (() => readChatGptOAuthToken());
    this.readClaudeTokenFn =
      options.readClaudeToken ?? (() => readClaudeOAuthToken());
    this.fixedCodexAuth = options.fixedCodexAuth;
  }

  static fromAuthForTesting(auth: CodexAuth): AuthManager {
    const config = createDefaultConfig(process.cwd(), process.cwd());
    config.auth.method = "openai-api-key";
    return new AuthManager(config, { fixedCodexAuth: auth });
  }

  getSelectedMethod(): AuthMethod {
    return this.config.auth?.method ?? "openai-api-key";
  }

  async setMethod(method: AuthMethod): Promise<void> {
    ensureAuthConfig(this.config).method = method;
    if (this.options.saveAuthConfig) {
      await this.options.saveAuthConfig(this.config.auth);
    }
  }

  async getToken(provider: "openai" | "anthropic"): Promise<string> {
    const method = this.getSelectedMethod();
    switch (method) {
      case "openai-api-key":
        this.assertProvider("openai", provider, method);
        return this.getApiKey("openai");
      case "anthropic-api-key":
        this.assertProvider("anthropic", provider, method);
        return this.getApiKey("anthropic");
      case "oauth-chatgpt":
        this.assertProvider("openai", provider, method);
        return await this.getChatGptOAuthToken();
      case "oauth-claude":
        this.assertProvider("anthropic", provider, method);
        return await this.getClaudeOAuthToken();
      default:
        throw new AuthError(`Unknown auth method: ${method}`);
    }
  }

  async getCodexAuthForProvider(
    provider: "openai" | "anthropic",
  ): Promise<CodexAuth> {
    if (this.fixedCodexAuth) {
      return this.fixedCodexAuth;
    }
    const method = this.getSelectedMethod();
    const token = await this.getToken(provider);
    if (method === "oauth-chatgpt") {
      return CodexAuth.fromChatGPT(token);
    }
    return CodexAuth.fromApiKey(token);
  }

  private getApiKey(provider: "openai" | "anthropic"): string {
    const auth = ensureAuthConfig(this.config);
    const key =
      provider === "openai" ? auth.openaiApiKey : auth.anthropicApiKey;
    if (key && key.trim()) {
      return key.trim();
    }

    const field =
      provider === "openai" ? "openai_api_key" : "anthropic_api_key";
    const command =
      provider === "openai"
        ? "cody set-auth openai-api-key"
        : "cody set-auth anthropic-api-key";
    throw new AuthError(
      `Missing API key for ${provider}. Set in config: [auth]\n${field} = "sk-..."\nOr run: ${command}`,
    );
  }

  private assertProvider(
    expected: "openai" | "anthropic",
    actual: "openai" | "anthropic",
    method: AuthMethod,
  ): void {
    if (expected === actual) {
      return;
    }
    const message = getProviderMismatchMessage(method);
    const suggestion =
      expected === "openai"
        ? "Switch to OpenAI: cody set-provider openai"
        : "Switch to Anthropic: cody set-provider anthropic";
    throw new AuthError(
      `${message} Current provider: ${actual}. ${suggestion}`,
    );
  }

  private async getChatGptOAuthToken(): Promise<string> {
    const token = await this.readChatGptTokenFn();
    if (token && token.trim()) {
      return token.trim();
    }
    const searched = DEFAULT_CHATGPT_TOKEN_PATHS.map(renderPath)
      .map((p) => `  - ${p}`)
      .join("\n");
    throw new AuthError(
      `ChatGPT OAuth token not found. Log in via ChatGPT Pro CLI to refresh token.\nSearched:\n${searched}\nOr switch to API key: cody set-auth openai-api-key`,
    );
  }

  private async getClaudeOAuthToken(): Promise<string> {
    const token = await this.readClaudeTokenFn();
    if (token && token.trim()) {
      return token.trim();
    }
    const searched = CLAUDE_OAUTH_PATHS.map(renderPath)
      .map((p) => `  - ${p}`)
      .join("\n");
    throw new AuthError(
      `Claude OAuth token not found. Log in via Claude Code to refresh token.\nSearched:\n${searched}\nOr switch to API key: cody set-auth anthropic-api-key`,
    );
  }
}

function getProviderMismatchMessage(method: AuthMethod): string {
  switch (method) {
    case "openai-api-key":
      return "OpenAI API key can only be used with OpenAI providers.";
    case "anthropic-api-key":
      return "Anthropic API key can only be used with Anthropic providers.";
    case "oauth-chatgpt":
      return "ChatGPT OAuth can only be used with OpenAI providers.";
    case "oauth-claude":
      return "Claude OAuth can only be used with Anthropic providers.";
    default:
      return "Authentication method does not match the selected provider.";
  }
}

function ensureAuthConfig(config: Config): AuthConfig {
  if (!config.auth) {
    config.auth = {
      method: "openai-api-key",
    };
  }
  return config.auth;
}

function renderPath(path: string): string {
  const home = homedir();
  if (path.startsWith(home)) {
    return path.replace(home, "~");
  }
  return path;
}

async function readChatGptOAuthToken(): Promise<string | undefined> {
  for (const path of DEFAULT_CHATGPT_TOKEN_PATHS) {
    try {
      const contents = await fs.readFile(path, "utf-8");
      const parsed = JSON.parse(contents) as Record<string, unknown>;
      const token = extractChatGptToken(parsed);
      if (token) {
        return token;
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        continue;
      }
      // Ignore malformed files and continue searching
      continue;
    }
  }
  return undefined;
}

function extractChatGptToken(
  data: Record<string, unknown>,
): string | undefined {
  const fromRoot = pickToken(data);
  if (fromRoot) {
    return fromRoot;
  }
  const nested = data.tokens;
  if (nested && typeof nested === "object") {
    return pickToken(nested as Record<string, unknown>);
  }
  return undefined;
}

function pickToken(data: Record<string, unknown>): string | undefined {
  const candidates = [
    data.access_token,
    data.accessToken,
    (data as { token?: string }).token,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}
