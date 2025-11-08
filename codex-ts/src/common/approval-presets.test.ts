import { describe, it, expect } from "vitest";
import { builtinApprovalPresets, ApprovalPreset } from "./approval-presets.js";
import { AskForApproval } from "../protocol/types.js";

describe("builtinApprovalPresets", () => {
  it("returns an array of presets", () => {
    const presets = builtinApprovalPresets();
    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBeGreaterThan(0);
  });

  it("has read-only preset", () => {
    const presets = builtinApprovalPresets();
    const readOnly = presets.find((p) => p.id === "read-only");

    expect(readOnly).toBeDefined();
    expect(readOnly?.label).toBe("Read Only");
    expect(readOnly?.approval).toBe(AskForApproval.OnRequest);
    expect(readOnly?.sandbox.type).toBe("read-only");
  });

  it("has auto preset", () => {
    const presets = builtinApprovalPresets();
    const auto = presets.find((p) => p.id === "auto");

    expect(auto).toBeDefined();
    expect(auto?.label).toBe("Auto");
    expect(auto?.approval).toBe(AskForApproval.OnRequest);
    expect(auto?.sandbox.type).toBe("workspace-write");
  });

  it("has full-access preset", () => {
    const presets = builtinApprovalPresets();
    const fullAccess = presets.find((p) => p.id === "full-access");

    expect(fullAccess).toBeDefined();
    expect(fullAccess?.label).toBe("Full Access");
    expect(fullAccess?.approval).toBe(AskForApproval.Never);
    expect(fullAccess?.sandbox.type).toBe("danger-full-access");
  });

  it("all presets have required fields", () => {
    const presets = builtinApprovalPresets();

    for (const preset of presets) {
      expect(preset.id).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.approval).toBeDefined();
      expect(preset.sandbox).toBeDefined();
    }
  });
});
