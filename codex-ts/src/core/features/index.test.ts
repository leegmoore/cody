/**
 * Tests for feature flags module.
 * NOTE: These are stub tests for Phase 5.1.
 */

import { describe, it, expect } from "vitest";
import { Features, Feature } from "./index";

describe("features (stub)", () => {
  describe("Features.withDefaults", () => {
    it("should create instance with no features enabled", () => {
      const features = Features.withDefaults();
      expect(features).toBeDefined();
      expect(features.getEnabled()).toHaveLength(0);
    });
  });

  describe("enabled", () => {
    it("should return false for all features by default", () => {
      const features = Features.withDefaults();

      expect(features.enabled(Feature.UnifiedExec)).toBe(false);
      expect(features.enabled(Feature.StreamableShell)).toBe(false);
      expect(features.enabled(Feature.RmcpClient)).toBe(false);
      expect(features.enabled(Feature.ApplyPatchFreeform)).toBe(false);
      expect(features.enabled(Feature.ViewImageTool)).toBe(false);
      expect(features.enabled(Feature.WebSearchRequest)).toBe(false);
      expect(features.enabled(Feature.SandboxCommandAssessment)).toBe(false);
      expect(features.enabled(Feature.GhostCommit)).toBe(false);
      expect(features.enabled(Feature.WindowsSandbox)).toBe(false);
    });

    it("should return true after enabling a feature", () => {
      const features = Features.withDefaults();
      features.enable(Feature.WebSearchRequest);
      expect(features.enabled(Feature.WebSearchRequest)).toBe(true);
    });

    it("should return false after disabling a feature", () => {
      const features = Features.withDefaults();
      features.enable(Feature.ViewImageTool);
      expect(features.enabled(Feature.ViewImageTool)).toBe(true);
      features.disable(Feature.ViewImageTool);
      expect(features.enabled(Feature.ViewImageTool)).toBe(false);
    });
  });

  describe("enable/disable", () => {
    it("should enable multiple features", () => {
      const features = Features.withDefaults();
      features.enable(Feature.UnifiedExec);
      features.enable(Feature.StreamableShell);

      expect(features.getEnabled()).toHaveLength(2);
      expect(features.enabled(Feature.UnifiedExec)).toBe(true);
      expect(features.enabled(Feature.StreamableShell)).toBe(true);
    });

    it("should disable an enabled feature", () => {
      const features = Features.withDefaults();
      features.enable(Feature.GhostCommit);
      expect(features.enabled(Feature.GhostCommit)).toBe(true);
      features.disable(Feature.GhostCommit);
      expect(features.enabled(Feature.GhostCommit)).toBe(false);
    });
  });

  describe("getEnabled", () => {
    it("should return empty array when no features enabled", () => {
      const features = Features.withDefaults();
      expect(features.getEnabled()).toEqual([]);
    });

    it("should return list of enabled features", () => {
      const features = Features.withDefaults();
      features.enable(Feature.WebSearchRequest);
      features.enable(Feature.ViewImageTool);

      const enabled = features.getEnabled();
      expect(enabled).toHaveLength(2);
      expect(enabled).toContain(Feature.WebSearchRequest);
      expect(enabled).toContain(Feature.ViewImageTool);
    });
  });
});
