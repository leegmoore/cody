import { promises as fs } from "fs";
import { join } from "path";
import os from "os";
import * as TOML from "smol-toml";
import {
  CONFIG_TOML_FILE,
  OPENAI_DEFAULT_MODEL,
  createDefaultConfig,
  type Config,
} from "../core/config.js";
import { ConfigurationError } from "../core/errors.js";
import { AuthManager, CodexAuth } from "../core/auth/index.js";

export type ProviderApi = "responses" | "chat" | "messages";

export interface CliProviderConfig {
  name: string;
  api: ProviderApi;
  model: string;
}

export interface CliAuthConfig {
  method: "api-key" | string;
  openai_key?: string;
}

export interface CliConfig {
  provider: CliProviderConfig;
  auth: CliAuthConfig;
}

export interface LoadedCliConfig {
  cli: CliConfig;
  core: Config;
  codexHome: string;
  cwd: string;
}

export interface LoadCliConfigOptions {
  codexHome?: string;
  cwd?: string;
  configPath?: string;
}

const DEFAULT_PROVIDER: CliProviderConfig = {
  name: "openai",
  api: "responses",
  model: OPENAI_DEFAULT_MODEL,
};

export async function loadCliConfig(
  options: LoadCliConfigOptions = {},
): Promise<LoadedCliConfig> {
  const codexHome = options.codexHome ?? defaultCodexHome();
  const cwd = options.cwd ?? process.cwd();
  const configPath = options.configPath ?? join(codexHome, CONFIG_TOML_FILE);

  const rawConfig = await readConfig(configPath);
  const provider = normalizeProvider(rawConfig?.provider);
  const auth = normalizeAuth(rawConfig?.auth);

  const cli: CliConfig = { provider, auth };
  const core = createDefaultConfig(codexHome, cwd);
  core.model = provider.model;
  core.modelProviderId = provider.name;

  return { cli, core, codexHome, cwd };
}

export function createAuthManagerFromCliConfig(
  cliConfig: CliConfig,
): AuthManager {
  if (cliConfig.auth.method !== "api-key") {
    throw new ConfigurationError(
      `Auth method ${cliConfig.auth.method} is not supported in Phase 1`,
    );
  }

  const apiKey = cliConfig.auth.openai_key;
  if (!apiKey) {
    throw new ConfigurationError(
      "OpenAI API key is required. Set auth.openai_key in ~/.codex/config.toml",
    );
  }

  const auth = CodexAuth.fromApiKey(apiKey);
  return AuthManager.fromAuthForTesting(auth);
}

function defaultCodexHome(): string {
  return process.env.CODEX_HOME ?? join(os.homedir(), ".codex");
}

async function readConfig(
  configPath: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    const contents = await fs.readFile(configPath, "utf-8");
    const parsed = TOML.parse(contents);
    if (typeof parsed !== "object" || parsed === null) {
      throw new ConfigurationError("config.toml must be a TOML table");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      throw new ConfigurationError(
        `Config file not found at ${configPath}. Create ~/.codex/config.toml first.`,
      );
    }
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(
      `Failed to read config: ${(error as Error).message}`,
    );
  }
}

function normalizeProvider(value: unknown): CliProviderConfig {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PROVIDER };
  }

  const name =
    getString((value as Record<string, unknown>).name) ?? DEFAULT_PROVIDER.name;
  const api =
    (getString((value as Record<string, unknown>).api) as ProviderApi | null) ??
    DEFAULT_PROVIDER.api;
  const model =
    getString((value as Record<string, unknown>).model) ??
    DEFAULT_PROVIDER.model;

  if (api !== "responses") {
    throw new ConfigurationError(
      `Provider API ${api} not supported in Phase 1. Use 'responses'.`,
    );
  }

  if (!model) {
    throw new ConfigurationError("Provider model must be specified");
  }

  return { name, api, model };
}

function normalizeAuth(value: unknown): CliAuthConfig {
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (!value || typeof value !== "object") {
    if (!envKey) {
      throw new ConfigurationError(
        "auth section missing and OPENAI_API_KEY not set",
      );
    }
    return { method: "api-key", openai_key: envKey };
  }

  const table = value as Record<string, unknown>;
  const method = getString(table.method) ?? "api-key";
  const configuredKey = getString(table.openai_key);
  const resolvedKey = (configuredKey ?? envKey)?.trim();

  if (method !== "api-key") {
    throw new ConfigurationError(
      `Auth method ${method} not supported in Phase 1`,
    );
  }

  if (!resolvedKey) {
    throw new ConfigurationError(
      "OpenAI API key missing. Set auth.openai_key or OPENAI_API_KEY env var.",
    );
  }

  return { method, openai_key: resolvedKey };
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}
