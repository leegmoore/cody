import { describe, it, expect, vi } from "vitest";
import { createDefaultConfig } from "../config.js";
import { AuthManager, AuthError } from "./index.js";

function baseConfig() {
  return createDefaultConfig("/tmp/cody", process.cwd());
}

describe("AuthManager", () => {
  it("returns OpenAI API key", async () => {
    const config = baseConfig();
    config.auth.openaiApiKey = "sk-openai";
    config.auth.method = "openai-api-key";
    const manager = new AuthManager(config);
    await expect(manager.getToken("openai")).resolves.toBe("sk-openai");
  });

  it("throws when OpenAI API key missing", async () => {
    const config = baseConfig();
    config.auth.openaiApiKey = undefined;
    config.auth.method = "openai-api-key";
    const manager = new AuthManager(config);
    await expect(manager.getToken("openai")).rejects.toThrow(AuthError);
  });

  it("returns Anthropic API key", async () => {
    const config = baseConfig();
    config.auth.anthropicApiKey = "sk-ant";
    config.auth.method = "anthropic-api-key";
    const manager = new AuthManager(config);
    await expect(manager.getToken("anthropic")).resolves.toBe("sk-ant");
  });

  it("reads ChatGPT OAuth token via injected reader", async () => {
    const config = baseConfig();
    config.auth.method = "oauth-chatgpt";
    const manager = new AuthManager(config, {
      readChatGptToken: async () => "chatgpt-token",
    });
    await expect(manager.getToken("openai")).resolves.toBe("chatgpt-token");
  });

  it("reads Claude OAuth token via injected reader", async () => {
    const config = baseConfig();
    config.auth.method = "oauth-claude";
    const manager = new AuthManager(config, {
      readClaudeToken: async () => "claude-token",
    });
    await expect(manager.getToken("anthropic")).resolves.toBe("claude-token");
  });

  it("throws provider mismatch for ChatGPT OAuth", async () => {
    const config = baseConfig();
    config.auth.method = "oauth-chatgpt";
    const manager = new AuthManager(config, {
      readChatGptToken: async () => "token",
    });
    await expect(manager.getToken("anthropic")).rejects.toThrow(
      /ChatGPT OAuth can only be used with OpenAI providers/i,
    );
  });

  it("throws provider mismatch for Claude OAuth", async () => {
    const config = baseConfig();
    config.auth.method = "oauth-claude";
    const manager = new AuthManager(config, {
      readClaudeToken: async () => "token",
    });
    await expect(manager.getToken("openai")).rejects.toThrow(
      /Claude OAuth can only be used with Anthropic providers/i,
    );
  });

  it("setMethod updates config and invokes saver", async () => {
    const config = baseConfig();
    config.auth.method = "openai-api-key";
    const save = vi.fn().mockResolvedValue(undefined);
    const manager = new AuthManager(config, { saveAuthConfig: save });
    await manager.setMethod("anthropic-api-key");
    expect(config.auth.method).toBe("anthropic-api-key");
    expect(save).toHaveBeenCalledWith(config.auth);
  });

  it("produces CodexAuth for provider", async () => {
    const config = baseConfig();
    config.auth.method = "openai-api-key";
    config.auth.openaiApiKey = "sk-openai";
    const manager = new AuthManager(config);
    const codexAuth = await manager.getCodexAuthForProvider("openai");
    await expect(codexAuth.getToken()).resolves.toBe("sk-openai");
  });
});
