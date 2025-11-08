/**
 * Tests for stub-auth module
 *
 * Temporary authentication stubs for Phase 4.1 testing.
 * Will be replaced with full authentication in Phase 5.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  AuthMode,
  CodexAuth,
  readOpenaiApiKeyFromEnv,
  OPENAI_API_KEY_ENV_VAR,
  CODEX_API_KEY_ENV_VAR,
} from "./stub-auth.js";

describe("stub-auth", () => {
  describe("AuthMode", () => {
    it("should have ApiKey mode", () => {
      expect(AuthMode.ApiKey).toBe("apikey");
    });

    it("should have ChatGPT mode", () => {
      expect(AuthMode.ChatGPT).toBe("chatgpt");
    });
  });

  describe("CodexAuth", () => {
    describe("fromApiKey", () => {
      it("should create auth with ApiKey mode", () => {
        const auth = CodexAuth.fromApiKey("sk-test123");

        expect(auth.mode).toBe(AuthMode.ApiKey);
      });

      it("should store the API key", async () => {
        const auth = CodexAuth.fromApiKey("sk-test123");

        const token = await auth.getToken();
        expect(token).toBe("sk-test123");
      });

      it("should work with empty API key", async () => {
        const auth = CodexAuth.fromApiKey("");

        const token = await auth.getToken();
        expect(token).toBe("");
      });
    });

    describe("fromChatGPT", () => {
      it("should create auth with ChatGPT mode", () => {
        const auth = CodexAuth.fromChatGPT("chatgpt-token");

        expect(auth.mode).toBe(AuthMode.ChatGPT);
      });

      it("should return ChatGPT token", async () => {
        const auth = CodexAuth.fromChatGPT("chatgpt-token");

        const token = await auth.getToken();
        expect(token).toBe("chatgpt-token");
      });
    });

    describe("getToken", () => {
      it("should return ApiKey for ApiKey mode", async () => {
        const auth = CodexAuth.fromApiKey("sk-my-key");

        const token = await auth.getToken();
        expect(token).toBe("sk-my-key");
      });

      it("should return ChatGPT token for ChatGPT mode", async () => {
        const auth = CodexAuth.fromChatGPT("gpt-token");

        const token = await auth.getToken();
        expect(token).toBe("gpt-token");
      });

      it("should handle multiple calls correctly", async () => {
        const auth = CodexAuth.fromApiKey("sk-stable");

        const token1 = await auth.getToken();
        const token2 = await auth.getToken();

        expect(token1).toBe("sk-stable");
        expect(token2).toBe("sk-stable");
      });
    });

    describe("getAccountId", () => {
      it("should return undefined for ApiKey mode", () => {
        const auth = CodexAuth.fromApiKey("sk-test");

        const accountId = auth.getAccountId();
        expect(accountId).toBeUndefined();
      });

      it("should return undefined for ChatGPT mode in stub", () => {
        const auth = CodexAuth.fromChatGPT("token");

        const accountId = auth.getAccountId();
        expect(accountId).toBeUndefined();
      });
    });
  });

  describe("readOpenaiApiKeyFromEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset process.env to a clean state
      process.env = { ...originalEnv };
      delete process.env[OPENAI_API_KEY_ENV_VAR];
      delete process.env[CODEX_API_KEY_ENV_VAR];
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it("should return undefined when no env vars are set", () => {
      const apiKey = readOpenaiApiKeyFromEnv();
      expect(apiKey).toBeUndefined();
    });

    it("should read from OPENAI_API_KEY", () => {
      process.env[OPENAI_API_KEY_ENV_VAR] = "sk-from-openai-var";

      const apiKey = readOpenaiApiKeyFromEnv();
      expect(apiKey).toBe("sk-from-openai-var");
    });

    it("should read from CODEX_API_KEY", () => {
      process.env[CODEX_API_KEY_ENV_VAR] = "sk-from-codex-var";

      const apiKey = readOpenaiApiKeyFromEnv();
      expect(apiKey).toBe("sk-from-codex-var");
    });

    it("should prefer OPENAI_API_KEY over CODEX_API_KEY", () => {
      process.env[OPENAI_API_KEY_ENV_VAR] = "sk-openai";
      process.env[CODEX_API_KEY_ENV_VAR] = "sk-codex";

      const apiKey = readOpenaiApiKeyFromEnv();
      expect(apiKey).toBe("sk-openai");
    });

    it("should trim whitespace from keys", () => {
      process.env[OPENAI_API_KEY_ENV_VAR] = "  sk-with-spaces  ";

      const apiKey = readOpenaiApiKeyFromEnv();
      expect(apiKey).toBe("sk-with-spaces");
    });

    it("should return undefined for empty string", () => {
      process.env[OPENAI_API_KEY_ENV_VAR] = "";

      const apiKey = readOpenaiApiKeyFromEnv();
      expect(apiKey).toBeUndefined();
    });

    it("should return undefined for whitespace-only string", () => {
      process.env[OPENAI_API_KEY_ENV_VAR] = "   ";

      const apiKey = readOpenaiApiKeyFromEnv();
      expect(apiKey).toBeUndefined();
    });
  });

  describe("Environment variable constants", () => {
    it("should export OPENAI_API_KEY_ENV_VAR", () => {
      expect(OPENAI_API_KEY_ENV_VAR).toBe("OPENAI_API_KEY");
    });

    it("should export CODEX_API_KEY_ENV_VAR", () => {
      expect(CODEX_API_KEY_ENV_VAR).toBe("CODEX_API_KEY");
    });
  });
});
