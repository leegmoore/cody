/**
 * Tests for model family detection and capabilities.
 * Ported from codex-rs/core/src/model_family.rs
 */

import { describe, it, expect } from "vitest";
import {
  findFamilyForModel,
  deriveDefaultModelFamily,
  ReasoningSummaryFormat,
  ApplyPatchToolType,
} from "./index";

describe("model_family", () => {
  describe("findFamilyForModel", () => {
    it("should return o3 family for o3 models", () => {
      const family = findFamilyForModel("o3");
      expect(family).toBeDefined();
      expect(family?.family).toBe("o3");
      expect(family?.slug).toBe("o3");
      expect(family?.supportsReasoningSummaries).toBe(true);
      expect(family?.needsSpecialApplyPatchInstructions).toBe(true);
    });

    it("should return o4-mini family for o4-mini models", () => {
      const family = findFamilyForModel("o4-mini");
      expect(family).toBeDefined();
      expect(family?.family).toBe("o4-mini");
      expect(family?.supportsReasoningSummaries).toBe(true);
      expect(family?.needsSpecialApplyPatchInstructions).toBe(true);
    });

    it("should return codex-mini-latest family", () => {
      const family = findFamilyForModel("codex-mini-latest");
      expect(family).toBeDefined();
      expect(family?.family).toBe("codex-mini-latest");
      expect(family?.supportsReasoningSummaries).toBe(true);
      expect(family?.usesLocalShellTool).toBe(true);
      expect(family?.needsSpecialApplyPatchInstructions).toBe(true);
    });

    it("should return gpt-4.1 family for gpt-4.1 models", () => {
      const family = findFamilyForModel("gpt-4.1");
      expect(family).toBeDefined();
      expect(family?.family).toBe("gpt-4.1");
      expect(family?.needsSpecialApplyPatchInstructions).toBe(true);
    });

    it("should return gpt-4.1 family for versioned gpt-4.1", () => {
      const family = findFamilyForModel("gpt-4.1-2025-04-14");
      expect(family).toBeDefined();
      expect(family?.family).toBe("gpt-4.1");
      expect(family?.slug).toBe("gpt-4.1-2025-04-14");
    });

    it("should return gpt-oss family for gpt-oss models", () => {
      const family = findFamilyForModel("gpt-oss-20b");
      expect(family).toBeDefined();
      expect(family?.family).toBe("gpt-oss");
      expect(family?.applyPatchToolType).toBe(ApplyPatchToolType.Function);
    });

    it("should return gpt-oss family for openai/ prefixed models", () => {
      const family = findFamilyForModel("openai/gpt-oss-120b");
      expect(family).toBeDefined();
      expect(family?.family).toBe("gpt-oss");
    });

    it("should return gpt-4o family for gpt-4o models", () => {
      const family = findFamilyForModel("gpt-4o");
      expect(family).toBeDefined();
      expect(family?.family).toBe("gpt-4o");
      expect(family?.needsSpecialApplyPatchInstructions).toBe(true);
    });

    it("should return gpt-4o family for versioned gpt-4o", () => {
      const family = findFamilyForModel("gpt-4o-2024-08-06");
      expect(family).toBeDefined();
      expect(family?.family).toBe("gpt-4o");
    });

    it("should return gpt-3.5 family for gpt-3.5 models", () => {
      const family = findFamilyForModel("gpt-3.5-turbo");
      expect(family).toBeDefined();
      expect(family?.family).toBe("gpt-3.5");
      expect(family?.needsSpecialApplyPatchInstructions).toBe(true);
    });

    it("should return test-gpt-5-codex family with experimental features", () => {
      const family = findFamilyForModel("test-gpt-5-codex-preview");
      expect(family).toBeDefined();
      expect(family?.family).toBe("test-gpt-5-codex-preview");
      expect(family?.slug).toBe("test-gpt-5-codex-preview");
      expect(family?.supportsReasoningSummaries).toBe(true);
      expect(family?.reasoningSummaryFormat).toBe(
        ReasoningSummaryFormat.Experimental,
      );
      expect(family?.experimentalSupportedTools).toContain("grep_files");
      expect(family?.experimentalSupportedTools).toContain("list_dir");
      expect(family?.experimentalSupportedTools).toContain("read_file");
      expect(family?.experimentalSupportedTools).toContain("test_sync_tool");
      expect(family?.supportsParallelToolCalls).toBe(true);
      expect(family?.supportVerbosity).toBe(true);
    });

    it("should return codex-exp- family for internal experimental models", () => {
      const family = findFamilyForModel("codex-exp-2025");
      expect(family).toBeDefined();
      expect(family?.family).toBe("codex-exp-2025");
      expect(family?.supportsReasoningSummaries).toBe(true);
      expect(family?.reasoningSummaryFormat).toBe(
        ReasoningSummaryFormat.Experimental,
      );
      expect(family?.applyPatchToolType).toBe(ApplyPatchToolType.Freeform);
      expect(family?.experimentalSupportedTools).toContain("grep_files");
      expect(family?.supportsParallelToolCalls).toBe(true);
      expect(family?.supportVerbosity).toBe(true);
    });

    it("should return gpt-5-codex family for production codex models", () => {
      const family = findFamilyForModel("gpt-5-codex-preview");
      expect(family).toBeDefined();
      expect(family?.family).toBe("gpt-5-codex-preview");
      expect(family?.supportsReasoningSummaries).toBe(true);
      expect(family?.reasoningSummaryFormat).toBe(
        ReasoningSummaryFormat.Experimental,
      );
      expect(family?.applyPatchToolType).toBe(ApplyPatchToolType.Freeform);
      expect(family?.supportVerbosity).toBe(false);
    });

    it("should return codex- family for codex models", () => {
      const family = findFamilyForModel("codex-preview-2025");
      expect(family).toBeDefined();
      expect(family?.family).toBe("codex-preview-2025");
      expect(family?.supportsReasoningSummaries).toBe(true);
      expect(family?.applyPatchToolType).toBe(ApplyPatchToolType.Freeform);
    });

    it("should return gpt-5 family for gpt-5 models", () => {
      const family = findFamilyForModel("gpt-5-turbo");
      expect(family).toBeDefined();
      expect(family?.family).toBe("gpt-5");
      expect(family?.supportsReasoningSummaries).toBe(true);
      expect(family?.needsSpecialApplyPatchInstructions).toBe(true);
      expect(family?.supportVerbosity).toBe(true);
    });

    it("should return undefined for unknown models", () => {
      const family = findFamilyForModel("unknown-model");
      expect(family).toBeUndefined();
    });

    it("should return undefined for gpt-4 (not in known families)", () => {
      const family = findFamilyForModel("gpt-4");
      expect(family).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      const family = findFamilyForModel("");
      expect(family).toBeUndefined();
    });
  });

  describe("deriveDefaultModelFamily", () => {
    it("should create default family for unknown model", () => {
      const family = deriveDefaultModelFamily("custom-model");
      expect(family.slug).toBe("custom-model");
      expect(family.family).toBe("custom-model");
      expect(family.needsSpecialApplyPatchInstructions).toBe(false);
      expect(family.supportsReasoningSummaries).toBe(false);
      expect(family.reasoningSummaryFormat).toBe(ReasoningSummaryFormat.None);
      expect(family.usesLocalShellTool).toBe(false);
      expect(family.supportsParallelToolCalls).toBe(false);
      expect(family.applyPatchToolType).toBeUndefined();
      expect(family.experimentalSupportedTools).toEqual([]);
      expect(family.effectiveContextWindowPercent).toBe(95);
      expect(family.supportVerbosity).toBe(false);
    });

    it("should have base instructions", () => {
      const family = deriveDefaultModelFamily("test-model");
      expect(family.baseInstructions).toBeDefined();
      expect(family.baseInstructions.length).toBeGreaterThan(0);
    });
  });

  describe("model family capabilities", () => {
    it("should set effective context window percent to 95 by default", () => {
      const family = findFamilyForModel("gpt-4o");
      expect(family?.effectiveContextWindowPercent).toBe(95);
    });

    it("should have correct experimental tools for test models", () => {
      const family = findFamilyForModel("test-gpt-5-codex-test");
      expect(family?.experimentalSupportedTools).toHaveLength(4);
    });

    it("should have fewer experimental tools for codex-exp models", () => {
      const family = findFamilyForModel("codex-exp-test");
      expect(family?.experimentalSupportedTools).toHaveLength(3);
      expect(family?.experimentalSupportedTools).not.toContain(
        "test_sync_tool",
      );
    });
  });

  describe("pattern matching precedence", () => {
    it("should match gpt-5-codex before gpt-5", () => {
      const family = findFamilyForModel("gpt-5-codex-test");
      expect(family?.applyPatchToolType).toBe(ApplyPatchToolType.Freeform);
      expect(family?.supportVerbosity).toBe(false);
    });

    it("should match codex- prefix for non-mini models", () => {
      const family = findFamilyForModel("codex-test");
      expect(family?.applyPatchToolType).toBe(ApplyPatchToolType.Freeform);
    });

    it("should distinguish between test-gpt-5-codex and gpt-5-codex", () => {
      const testFamily = findFamilyForModel("test-gpt-5-codex-model");
      const prodFamily = findFamilyForModel("gpt-5-codex-model");

      expect(testFamily?.experimentalSupportedTools).toContain(
        "test_sync_tool",
      );
      expect(prodFamily?.experimentalSupportedTools).not.toContain(
        "test_sync_tool",
      );
    });
  });
});
