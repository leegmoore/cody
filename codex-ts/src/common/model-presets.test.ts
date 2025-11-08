import { describe, it, expect } from "vitest";
import { builtinModelPresets, ModelPreset } from "./model-presets.js";
import { ReasoningEffort } from "../protocol/types.js";

describe("builtinModelPresets", () => {
  it("returns an array of model presets", () => {
    const presets = builtinModelPresets();
    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBeGreaterThan(0);
  });

  it("has exactly one default model", () => {
    const presets = builtinModelPresets();
    const defaultModels = presets.filter((p) => p.isDefault);
    expect(defaultModels.length).toBe(1);
  });

  it("has gpt-5-codex preset as default", () => {
    const presets = builtinModelPresets();
    const codex = presets.find((p) => p.id === "gpt-5-codex");

    expect(codex).toBeDefined();
    expect(codex?.isDefault).toBe(true);
    expect(codex?.model).toBe("gpt-5-codex");
    expect(codex?.displayName).toBe("gpt-5-codex");
    expect(codex?.defaultReasoningEffort).toBe(ReasoningEffort.Medium);
  });

  it("has gpt-5 preset", () => {
    const presets = builtinModelPresets();
    const gpt5 = presets.find((p) => p.id === "gpt-5");

    expect(gpt5).toBeDefined();
    expect(gpt5?.isDefault).toBe(false);
    expect(gpt5?.model).toBe("gpt-5");
    expect(gpt5?.displayName).toBe("gpt-5");
  });

  it("all presets have required fields", () => {
    const presets = builtinModelPresets();

    for (const preset of presets) {
      expect(preset.id).toBeTruthy();
      expect(preset.model).toBeTruthy();
      expect(preset.displayName).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.defaultReasoningEffort).toBeDefined();
      expect(Array.isArray(preset.supportedReasoningEfforts)).toBe(true);
      expect(preset.isDefault).toBeDefined();
    }
  });

  it("gpt-5-codex has expected reasoning efforts", () => {
    const presets = builtinModelPresets();
    const codex = presets.find((p) => p.id === "gpt-5-codex");

    expect(codex?.supportedReasoningEfforts).toHaveLength(3);
    expect(codex?.supportedReasoningEfforts.map((e) => e.effort)).toEqual([
      ReasoningEffort.Low,
      ReasoningEffort.Medium,
      ReasoningEffort.High,
    ]);
  });

  it("gpt-5 has all reasoning effort levels", () => {
    const presets = builtinModelPresets();
    const gpt5 = presets.find((p) => p.id === "gpt-5");

    expect(gpt5?.supportedReasoningEfforts).toHaveLength(4);
    expect(gpt5?.supportedReasoningEfforts.map((e) => e.effort)).toEqual([
      ReasoningEffort.Minimal,
      ReasoningEffort.Low,
      ReasoningEffort.Medium,
      ReasoningEffort.High,
    ]);
  });
});
