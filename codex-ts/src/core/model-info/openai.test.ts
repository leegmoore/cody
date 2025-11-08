/**
 * Tests for OpenAI model information lookup.
 * Ported from codex-rs/core/src/openai_model_info.rs
 */

import { describe, it, expect } from "vitest";
import {
  getModelInfo,
  CONTEXT_WINDOW_272K,
  MAX_OUTPUT_TOKENS_128K,
} from "./openai";

describe("openai_model_info", () => {
  describe("getModelInfo - exact model slugs", () => {
    it("should return correct info for gpt-oss-20b", () => {
      const info = getModelInfo("gpt-oss-20b");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(96_000);
      expect(info?.maxOutputTokens).toBe(32_000);
      expect(info?.autoCompactTokenLimit).toBe(86_400); // 90% of 96_000
    });

    it("should return correct info for gpt-oss-120b", () => {
      const info = getModelInfo("gpt-oss-120b");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(96_000);
      expect(info?.maxOutputTokens).toBe(32_000);
    });

    it("should return correct info for o3", () => {
      const info = getModelInfo("o3");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(200_000);
      expect(info?.maxOutputTokens).toBe(100_000);
    });

    it("should return correct info for o4-mini", () => {
      const info = getModelInfo("o4-mini");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(200_000);
      expect(info?.maxOutputTokens).toBe(100_000);
    });

    it("should return correct info for codex-mini-latest", () => {
      const info = getModelInfo("codex-mini-latest");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(200_000);
      expect(info?.maxOutputTokens).toBe(100_000);
    });

    it("should return correct info for gpt-4.1", () => {
      const info = getModelInfo("gpt-4.1");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(1_047_576);
      expect(info?.maxOutputTokens).toBe(32_768);
    });

    it("should return correct info for gpt-4.1-2025-04-14", () => {
      const info = getModelInfo("gpt-4.1-2025-04-14");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(1_047_576);
      expect(info?.maxOutputTokens).toBe(32_768);
    });

    it("should return correct info for gpt-4o", () => {
      const info = getModelInfo("gpt-4o");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(128_000);
      expect(info?.maxOutputTokens).toBe(16_384);
    });

    it("should return correct info for gpt-4o-2024-08-06", () => {
      const info = getModelInfo("gpt-4o-2024-08-06");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(128_000);
      expect(info?.maxOutputTokens).toBe(16_384);
    });

    it("should return correct info for gpt-4o-2024-05-13", () => {
      const info = getModelInfo("gpt-4o-2024-05-13");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(128_000);
      expect(info?.maxOutputTokens).toBe(4_096);
    });

    it("should return correct info for gpt-4o-2024-11-20", () => {
      const info = getModelInfo("gpt-4o-2024-11-20");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(128_000);
      expect(info?.maxOutputTokens).toBe(16_384);
    });

    it("should return correct info for gpt-3.5-turbo", () => {
      const info = getModelInfo("gpt-3.5-turbo");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(16_385);
      expect(info?.maxOutputTokens).toBe(4_096);
    });
  });

  describe("getModelInfo - pattern matching", () => {
    it("should match gpt-5-codex prefix", () => {
      const info = getModelInfo("gpt-5-codex-preview");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(CONTEXT_WINDOW_272K);
      expect(info?.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS_128K);
    });

    it("should match gpt-5 prefix (but not gpt-5-codex)", () => {
      const info = getModelInfo("gpt-5-turbo");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(CONTEXT_WINDOW_272K);
      expect(info?.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS_128K);
    });

    it("should match codex- prefix", () => {
      const info = getModelInfo("codex-preview-2025");
      expect(info).toBeDefined();
      expect(info?.contextWindow).toBe(CONTEXT_WINDOW_272K);
      expect(info?.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS_128K);
    });
  });

  describe("getModelInfo - unknown models", () => {
    it("should return undefined for unknown model slug", () => {
      const info = getModelInfo("unknown-model");
      expect(info).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      const info = getModelInfo("");
      expect(info).toBeUndefined();
    });

    it("should return undefined for gpt-4 (not in table)", () => {
      const info = getModelInfo("gpt-4");
      expect(info).toBeUndefined();
    });
  });

  describe("auto_compact_token_limit calculation", () => {
    it("should calculate auto_compact_token_limit as 90% of context window", () => {
      const info = getModelInfo("gpt-4o");
      expect(info?.autoCompactTokenLimit).toBe(115_200); // 90% of 128_000
    });

    it("should round down when calculating 90%", () => {
      const info = getModelInfo("gpt-3.5-turbo");
      // 16_385 * 0.9 = 14746.5 -> rounds down to 14746
      expect(info?.autoCompactTokenLimit).toBe(14_746);
    });
  });
});
