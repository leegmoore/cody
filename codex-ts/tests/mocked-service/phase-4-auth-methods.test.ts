import { describe, it, expect, beforeEach, vi } from "vitest";
import { Command } from "commander";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONFIG_TOML_FILE } from "../../src/core/config.js";
import { ConversationManager } from "../../src/core/conversation-manager.js";
import { SessionSource } from "../../src/core/rollout.js";
import type { ModelClient } from "../../src/core/client/client.js";
import type { ModelClientFactory } from "../../src/core/client/model-client-factory.js";
import { ConfigurationError } from "../../src/core/errors.js";
import { createMockConfig } from "../mocks/config.js";
import { createMockAuthManager } from "../mocks/auth-manager.js";
import {
  createMockResponsesClient,
  createMockChatClient,
  createMockMessagesClient,
} from "../mocks/provider-clients.js";
import {
  loadCliConfig,
  type CliConfig,
  type CliAuthConfig,
  createAuthManagerFromCliConfig,
} from "../../src/cli/config.js";
import { registerLoginCommand } from "../../src/cli/commands/login.js";
import { registerSetAuthCommand } from "../../src/cli/commands/set-auth.js";

// NOTE: This file follows the high-level test conditions from
// docs/projects/02-ui-integration-phases/phase-4/source/checklist.md.
// It focuses on CLI auth method handling and OAuth × provider validation
// at the mocked-service boundary.

function buildAuthConfig(
  overrides: Partial<CliAuthConfig> = {},
): CliAuthConfig {
  return {
    method: overrides.method ?? "api-key",
    openai_key: overrides.openai_key,
    anthropic_key: overrides.anthropic_key,
    openrouter_key: overrides.openrouter_key,
  };
}

function buildCliConfig(overrides: Partial<CliConfig> = {}): CliConfig {
  return {
    provider:
      overrides.provider ??
      ({
        name: "openai",
        api: "responses",
        model: "gpt-4o-mini",
      } as CliConfig["provider"]),
    auth: overrides.auth ?? buildAuthConfig(overrides.auth),
  };
}

function createFactory(
  mapping: Record<string, ModelClient>,
): ModelClientFactory {
  return async ({ config }) => {
    const key = `${config.modelProviderId}:${config.modelProviderApi}`;
    const client = mapping[key];
    if (!client) {
      throw new ConfigurationError(
        `Unsupported provider/api combination: ${key}`,
      );
    }
    return client;
  };
}

describe("Phase 4: Authentication methods", () => {
  const originalCodexHome = process.env.CODY_HOME;
  const originalChatGptToken = process.env.CHATGPT_ACCESS_TOKEN;
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  let tempHome: string;

  beforeEach(async () => {
    tempHome = await mkdtemp(join(tmpdir(), "cody-phase4-auth-"));
    process.env.CODY_HOME = tempHome;
  });

  afterEach(async () => {
    process.env.CODY_HOME = originalCodexHome;
    if (originalChatGptToken !== undefined) {
      process.env.CHATGPT_ACCESS_TOKEN = originalChatGptToken;
    } else {
      delete process.env.CHATGPT_ACCESS_TOKEN;
    }
    if (originalAnthropicKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    if (tempHome) {
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  describe("CLI auth config parsing", () => {
    it("loads api-key auth with OpenAI key", async () => {
      const toml = `
[provider]
name = "openai"
api = "responses"
model = "gpt-4o-mini"

[auth]
method = "api-key"
openai_key = "sk-openai-test"
`;
      const configPath = join(tempHome, CONFIG_TOML_FILE);
      await writeFile(configPath, toml, "utf-8");

      const loaded = await loadCliConfig({
        codexHome: tempHome,
        cwd: tempHome,
      });
      expect(loaded.cli.auth.method).toBe("api-key");
      expect(loaded.cli.auth.openai_key).toBe("sk-openai-test");
    });

    it("creates AuthManager with OpenAI API key", async () => {
      const cli = buildCliConfig({
        provider: {
          name: "openai",
          api: "responses",
          model: "gpt-4o-mini",
        } as CliConfig["provider"],
        auth: buildAuthConfig({
          method: "openai-api-key",
          openai_key: "sk-openai-123",
        }),
      });

      const authManager = createAuthManagerFromCliConfig(cli);
      await expect(authManager.getToken("openai")).resolves.toBe(
        "sk-openai-123",
      );
    });

    it("creates AuthManager with Anthropic API key", async () => {
      const cli = buildCliConfig({
        provider: {
          name: "anthropic",
          api: "messages",
          model: "claude-3-haiku",
        } as CliConfig["provider"],
        auth: buildAuthConfig({
          method: "anthropic-api-key",
          anthropic_key: "sk-anthropic-456",
        }),
      });

      const authManager = createAuthManagerFromCliConfig(cli);
      await expect(authManager.getToken("anthropic")).resolves.toBe(
        "sk-anthropic-456",
      );
    });

    it("maps api-key alias to provider-specific core method", async () => {
      const cli = buildCliConfig({
        provider: {
          name: "anthropic",
          api: "messages",
          model: "claude-3-haiku",
        } as CliConfig["provider"],
        auth: buildAuthConfig({
          method: "api-key",
          anthropic_key: "sk-anthropic-generic",
        }),
      });

      const authManager = createAuthManagerFromCliConfig(cli);
      await expect(authManager.getToken("anthropic")).resolves.toBe(
        "sk-anthropic-generic",
      );
    });

    it("creates AuthManager with ChatGPT OAuth token from env", async () => {
      const cli = buildCliConfig({
        provider: {
          name: "openai",
          api: "responses",
          model: "gpt-4o-mini",
        } as CliConfig["provider"],
        auth: buildAuthConfig({
          method: "oauth-chatgpt",
        }),
      });

      const authManager = createAuthManagerFromCliConfig(cli, undefined, {
        readChatGptToken: async () => "chatgpt-oauth-token",
      });
      await expect(authManager.getToken("openai")).resolves.toBe(
        "chatgpt-oauth-token",
      );
    });

    it("creates AuthManager with Claude OAuth token from env", async () => {
      const cli = buildCliConfig({
        provider: {
          name: "anthropic",
          api: "messages",
          model: "claude-3-haiku",
        } as CliConfig["provider"],
        auth: buildAuthConfig({
          method: "oauth-claude",
        }),
      });

      const authManager = createAuthManagerFromCliConfig(cli, undefined, {
        readClaudeToken: async () => "claude-oauth-token",
      });
      await expect(authManager.getToken("anthropic")).resolves.toBe(
        "claude-oauth-token",
      );
    });
  });

  describe("CLI set-auth and login commands (skeleton)", () => {
    function buildProgram() {
      const program = new Command();
      registerLoginCommand(program);
      registerSetAuthCommand(program);
      program.exitOverride();
      return program;
    }

    it("set-auth updates auth.method in config.toml", async () => {
      const configPath = join(tempHome, CONFIG_TOML_FILE);
      const toml = `
[provider]
name = "openai"
api = "responses"
model = "gpt-4o-mini"

[auth]
method = "api-key"
openai_key = "sk-openai-test"
anthropic_key = "sk-anthropic-existing"
`;
      await writeFile(configPath, toml, "utf-8");

      const program = buildProgram();
      await program.parseAsync([
        "node",
        "cody",
        "set-auth",
        "anthropic-api-key",
      ]);

      const contents = await readFile(configPath, "utf-8");
      expect(contents).toContain('method = "anthropic-api-key"');
      expect(contents).toContain('openai_key = "sk-openai-test"');
    });

    it("set-auth rejects invalid auth method", async () => {
      const configPath = join(tempHome, CONFIG_TOML_FILE);
      const toml = `
[provider]
name = "openai"
api = "responses"
model = "gpt-4o-mini"

[auth]
method = "api-key"
openai_key = "sk-openai-test"
`;
      await writeFile(configPath, toml, "utf-8");

      const program = buildProgram();
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await program.parseAsync(["node", "cody", "set-auth", "invalid-method"]);

      const joined = errorSpy.mock.calls
        .map((args) => args.join(" "))
        .join("\n");
      expect(joined).toMatch(/Auth method .* is not supported/i);

      errorSpy.mockRestore();
    });

    it("login displays auth methods and marks current", async () => {
      process.env.CHATGPT_ACCESS_TOKEN = "chatgpt-token";
      const configPath = join(tempHome, CONFIG_TOML_FILE);
      const toml = `
[provider]
name = "openai"
api = "responses"
model = "gpt-4o-mini"

[auth]
method = "openai-api-key"
openai_key = "sk-openai-test"
`;
      await writeFile(configPath, toml, "utf-8");

      const program = buildProgram();
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await program.parseAsync(["node", "cody", "login"]);

      const output = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(output).toContain("Authentication Status");
      expect(output).toContain("Current method: openai-api-key");
      expect(output).toContain("openai-api-key");
      expect(output).toContain("anthropic-api-key");
      expect(output).toContain("oauth-chatgpt");
      expect(output).toContain("oauth-claude");

      logSpy.mockRestore();
    });
  });

  describe("OAuth × provider validation (mocked)", () => {
    it("routes ChatGPT OAuth + OpenAI Responses API (happy path placeholder)", async () => {
      const responses = createMockResponsesClient([]);
      const chat = createMockChatClient([]);
      const messages = createMockMessagesClient([]);
      const factory = createFactory({
        "openai:responses": responses.client,
        "openai:chat": chat.client,
        "anthropic:messages": messages.client,
      });

      const config = createMockConfig({
        modelProviderId: "openai",
        modelProviderApi: "responses",
      });

      const manager = new ConversationManager(
        createMockAuthManager(),
        SessionSource.CLI,
        factory,
      );
      const { conversation } = await manager.newConversation(config);
      await conversation.sendMessage("test");
      await conversation.nextEvent();
      expect(responses.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("rejects ChatGPT OAuth with Anthropic provider via CLI config", async () => {
      const cli = buildCliConfig({
        provider: {
          name: "anthropic",
          api: "messages",
          model: "claude-3-haiku",
        } as CliConfig["provider"],
        auth: buildAuthConfig({
          method: "oauth-chatgpt",
          anthropic_key: "sk-anthropic-placeholder",
        }),
      });

      const authManager = createAuthManagerFromCliConfig(cli, undefined, {
        readChatGptToken: async () => "chatgpt-token-123",
      });

      await expect(authManager.getToken("anthropic")).rejects.toThrow(
        /ChatGPT OAuth can only be used with OpenAI providers/i,
      );
    });

    it("rejects Claude OAuth with OpenAI provider via CLI config", async () => {
      const cli = buildCliConfig({
        provider: {
          name: "openai",
          api: "responses",
          model: "gpt-4o-mini",
        } as CliConfig["provider"],
        auth: buildAuthConfig({
          method: "oauth-claude",
        }),
      });

      const authManager = createAuthManagerFromCliConfig(cli, undefined, {
        readClaudeToken: async () => "claude-token",
      });

      await expect(authManager.getToken("openai")).rejects.toThrow(
        /Claude OAuth can only be used with Anthropic providers/i,
      );
    });

    it("throws missing API key error for OpenAI when method=openai-api-key and key is missing", async () => {
      const cli = buildCliConfig({
        provider: {
          name: "openai",
          api: "responses",
          model: "gpt-4o-mini",
        } as CliConfig["provider"],
        auth: buildAuthConfig({
          method: "openai-api-key",
        }),
      });

      const authManager = createAuthManagerFromCliConfig(cli);

      await expect(authManager.getToken("openai")).rejects.toThrow(
        /Missing API key for openai/i,
      );
    });

    it("throws missing ChatGPT OAuth token error when provider is openai and token reader returns nothing", async () => {
      const cli = buildCliConfig({
        provider: {
          name: "openai",
          api: "responses",
          model: "gpt-4o-mini",
        } as CliConfig["provider"],
        auth: buildAuthConfig({
          method: "oauth-chatgpt",
        }),
      });

      const authManager = createAuthManagerFromCliConfig(cli, undefined, {
        readChatGptToken: async () => undefined,
      });

      await expect(authManager.getToken("openai")).rejects.toThrow(
        /ChatGPT OAuth token not found/i,
      );
    });

    it("throws missing Claude OAuth token error when provider is anthropic and token reader returns nothing", async () => {
      const cli = buildCliConfig({
        provider: {
          name: "anthropic",
          api: "messages",
          model: "claude-3-haiku",
        } as CliConfig["provider"],
        auth: buildAuthConfig({
          method: "oauth-claude",
        }),
      });

      const authManager = createAuthManagerFromCliConfig(cli, undefined, {
        readClaudeToken: async () => undefined,
      });

      await expect(authManager.getToken("anthropic")).rejects.toThrow(
        /Claude OAuth token not found/i,
      );
    });
  });
});
