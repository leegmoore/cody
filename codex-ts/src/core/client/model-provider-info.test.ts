/**
 * Tests for model-provider-info module
 *
 * Ported from: codex-rs/core/src/model_provider_info.rs (tests section)
 */

import { describe, it, expect } from "vitest";
import {
  WireApi,
  type ModelProviderInfo,
  builtInModelProviders,
  createOssProvider,
  createOssProviderWithBaseUrl,
  BUILT_IN_OSS_MODEL_PROVIDER_ID,
  DEFAULT_REQUEST_MAX_RETRIES,
  DEFAULT_STREAM_MAX_RETRIES,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
} from "./model-provider-info.js";

describe("model-provider-info", () => {
  describe("WireApi", () => {
    it("should have Responses variant", () => {
      expect(WireApi.Responses).toBe("responses");
    });

    it("should have Chat variant", () => {
      expect(WireApi.Chat).toBe("chat");
    });
  });

  describe("ModelProviderInfo", () => {
    it("should create a minimal provider", () => {
      const provider: ModelProviderInfo = {
        name: "Test Provider",
        wireApi: WireApi.Chat,
        requiresOpenaiAuth: false,
      };

      expect(provider.name).toBe("Test Provider");
      expect(provider.wireApi).toBe(WireApi.Chat);
      expect(provider.requiresOpenaiAuth).toBe(false);
    });

    it("should create a provider with base_url", () => {
      const provider: ModelProviderInfo = {
        name: "Custom",
        baseUrl: "https://example.com",
        wireApi: WireApi.Chat,
        requiresOpenaiAuth: false,
      };

      expect(provider.baseUrl).toBe("https://example.com");
    });

    it("should create a provider with env_key", () => {
      const provider: ModelProviderInfo = {
        name: "API Provider",
        envKey: "MY_API_KEY",
        envKeyInstructions: "Get your key from https://example.com",
        wireApi: WireApi.Chat,
        requiresOpenaiAuth: false,
      };

      expect(provider.envKey).toBe("MY_API_KEY");
      expect(provider.envKeyInstructions).toBe(
        "Get your key from https://example.com",
      );
    });

    it("should create a provider with experimental_bearer_token", () => {
      const provider: ModelProviderInfo = {
        name: "Bearer Auth",
        experimentalBearerToken: "sk-test123",
        wireApi: WireApi.Chat,
        requiresOpenaiAuth: false,
      };

      expect(provider.experimentalBearerToken).toBe("sk-test123");
    });

    it("should create a provider with query_params", () => {
      const provider: ModelProviderInfo = {
        name: "Azure",
        queryParams: {
          "api-version": "2025-04-01-preview",
        },
        wireApi: WireApi.Chat,
        requiresOpenaiAuth: false,
      };

      expect(provider.queryParams).toEqual({
        "api-version": "2025-04-01-preview",
      });
    });

    it("should create a provider with http_headers", () => {
      const provider: ModelProviderInfo = {
        name: "Custom Headers",
        httpHeaders: {
          "X-Custom-Header": "value",
        },
        wireApi: WireApi.Chat,
        requiresOpenaiAuth: false,
      };

      expect(provider.httpHeaders).toEqual({
        "X-Custom-Header": "value",
      });
    });

    it("should create a provider with env_http_headers", () => {
      const provider: ModelProviderInfo = {
        name: "Env Headers",
        envHttpHeaders: {
          "X-Org-Header": "MY_ORG_ENV_VAR",
        },
        wireApi: WireApi.Chat,
        requiresOpenaiAuth: false,
      };

      expect(provider.envHttpHeaders).toEqual({
        "X-Org-Header": "MY_ORG_ENV_VAR",
      });
    });

    it("should create a provider with retry configuration", () => {
      const provider: ModelProviderInfo = {
        name: "Retry Config",
        requestMaxRetries: 10,
        streamMaxRetries: 20,
        streamIdleTimeoutMs: 60000,
        wireApi: WireApi.Chat,
        requiresOpenaiAuth: false,
      };

      expect(provider.requestMaxRetries).toBe(10);
      expect(provider.streamMaxRetries).toBe(20);
      expect(provider.streamIdleTimeoutMs).toBe(60000);
    });

    it("should default wireApi to Chat", () => {
      const provider: ModelProviderInfo = {
        name: "Default",
        wireApi: WireApi.Chat,
        requiresOpenaiAuth: false,
      };

      expect(provider.wireApi).toBe(WireApi.Chat);
    });

    it("should support Responses wireApi", () => {
      const provider: ModelProviderInfo = {
        name: "OpenAI",
        wireApi: WireApi.Responses,
        requiresOpenaiAuth: true,
      };

      expect(provider.wireApi).toBe(WireApi.Responses);
    });
  });

  describe("builtInModelProviders", () => {
    it("should return a map of built-in providers", () => {
      const providers = builtInModelProviders();

      expect(providers).toBeDefined();
      expect(typeof providers).toBe("object");
    });

    it("should include openai provider", () => {
      const providers = builtInModelProviders();

      expect(providers["openai"]).toBeDefined();
      expect(providers["openai"].name).toBe("OpenAI");
      expect(providers["openai"].wireApi).toBe(WireApi.Responses);
      expect(providers["openai"].requiresOpenaiAuth).toBe(true);
    });

    it("should include oss provider", () => {
      const providers = builtInModelProviders();

      expect(providers[BUILT_IN_OSS_MODEL_PROVIDER_ID]).toBeDefined();
      expect(providers[BUILT_IN_OSS_MODEL_PROVIDER_ID].name).toBe("gpt-oss");
      expect(providers[BUILT_IN_OSS_MODEL_PROVIDER_ID].wireApi).toBe(
        WireApi.Chat,
      );
      expect(providers[BUILT_IN_OSS_MODEL_PROVIDER_ID].requiresOpenaiAuth).toBe(
        false,
      );
    });

    it("should have correct structure for openai provider", () => {
      const providers = builtInModelProviders();
      const openai = providers["openai"];

      expect(openai.envHttpHeaders).toBeDefined();
      expect(openai.envHttpHeaders?.["OpenAI-Organization"]).toBe(
        "OPENAI_ORGANIZATION",
      );
      expect(openai.envHttpHeaders?.["OpenAI-Project"]).toBe("OPENAI_PROJECT");
    });
  });

  describe("createOssProvider", () => {
    it("should create OSS provider with default port", () => {
      const provider = createOssProvider();

      expect(provider.name).toBe("gpt-oss");
      expect(provider.wireApi).toBe(WireApi.Chat);
      expect(provider.requiresOpenaiAuth).toBe(false);
      expect(provider.baseUrl).toMatch(/^http:\/\/localhost:\d+\/v1$/);
    });

    it("should create OSS provider with custom base URL", () => {
      const provider = createOssProviderWithBaseUrl(
        "https://custom.example.com/v1",
      );

      expect(provider.name).toBe("gpt-oss");
      expect(provider.baseUrl).toBe("https://custom.example.com/v1");
      expect(provider.wireApi).toBe(WireApi.Chat);
    });
  });

  describe("Helper constants", () => {
    it("should export BUILT_IN_OSS_MODEL_PROVIDER_ID", () => {
      expect(BUILT_IN_OSS_MODEL_PROVIDER_ID).toBe("oss");
    });

    it("should export DEFAULT_REQUEST_MAX_RETRIES", () => {
      expect(DEFAULT_REQUEST_MAX_RETRIES).toBe(4);
    });

    it("should export DEFAULT_STREAM_MAX_RETRIES", () => {
      expect(DEFAULT_STREAM_MAX_RETRIES).toBe(5);
    });

    it("should export DEFAULT_STREAM_IDLE_TIMEOUT_MS", () => {
      expect(DEFAULT_STREAM_IDLE_TIMEOUT_MS).toBe(300_000);
    });
  });
});
