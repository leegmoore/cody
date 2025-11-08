import { describe, it, expect } from "vitest";
import {
  ReasoningEffort,
  ReasoningSummary,
  Verbosity,
  SandboxMode,
  ForcedLoginMethod,
} from "./config-types.js";

describe("Config Types Protocol", () => {
  describe("ReasoningEffort", () => {
    it("has correct enum values", () => {
      expect(ReasoningEffort.Minimal).toBe("minimal");
      expect(ReasoningEffort.Low).toBe("low");
      expect(ReasoningEffort.Medium).toBe("medium");
      expect(ReasoningEffort.High).toBe("high");
    });

    it("includes all expected reasoning effort levels", () => {
      const efforts = Object.values(ReasoningEffort);
      expect(efforts).toContain("minimal");
      expect(efforts).toContain("low");
      expect(efforts).toContain("medium");
      expect(efforts).toContain("high");
    });

    it("has exactly 4 reasoning effort levels", () => {
      const effortTypes = Object.keys(ReasoningEffort).filter((k) =>
        isNaN(Number(k)),
      );
      expect(effortTypes).toHaveLength(4);
    });

    it("serializes to lowercase strings", () => {
      const effort: ReasoningEffort = ReasoningEffort.High;
      expect(effort).toBe("high");
      expect(typeof effort).toBe("string");
    });

    it("can be used in JSON serialization", () => {
      const config = { reasoning_effort: ReasoningEffort.Medium };
      const json = JSON.stringify(config);
      expect(json).toBe('{"reasoning_effort":"medium"}');
    });

    it("can be deserialized from JSON", () => {
      const json = '{"reasoning_effort":"high"}';
      const config = JSON.parse(json);
      expect(config.reasoning_effort).toBe(ReasoningEffort.High);
    });

    it("supports Medium as default effort level", () => {
      const defaultEffort: ReasoningEffort = ReasoningEffort.Medium;
      expect(defaultEffort).toBe("medium");
    });

    it("can be used in switch statements", () => {
      const getEffortDescription = (effort: ReasoningEffort): string => {
        switch (effort) {
          case ReasoningEffort.Minimal:
            return "Fastest, least thorough";
          case ReasoningEffort.Low:
            return "Quick reasoning";
          case ReasoningEffort.Medium:
            return "Balanced reasoning";
          case ReasoningEffort.High:
            return "Most thorough reasoning";
          default:
            return "Unknown";
        }
      };

      expect(getEffortDescription(ReasoningEffort.Minimal)).toBe(
        "Fastest, least thorough",
      );
      expect(getEffortDescription(ReasoningEffort.High)).toBe(
        "Most thorough reasoning",
      );
    });
  });

  describe("ReasoningSummary", () => {
    it("has correct enum values", () => {
      expect(ReasoningSummary.Auto).toBe("auto");
      expect(ReasoningSummary.Concise).toBe("concise");
      expect(ReasoningSummary.Detailed).toBe("detailed");
      expect(ReasoningSummary.None).toBe("none");
    });

    it("includes all expected reasoning summary formats", () => {
      const summaries = Object.values(ReasoningSummary);
      expect(summaries).toContain("auto");
      expect(summaries).toContain("concise");
      expect(summaries).toContain("detailed");
      expect(summaries).toContain("none");
    });

    it("has exactly 4 reasoning summary formats", () => {
      const summaryTypes = Object.keys(ReasoningSummary).filter((k) =>
        isNaN(Number(k)),
      );
      expect(summaryTypes).toHaveLength(4);
    });

    it("serializes to lowercase strings", () => {
      const summary: ReasoningSummary = ReasoningSummary.Concise;
      expect(summary).toBe("concise");
      expect(typeof summary).toBe("string");
    });

    it("can be used in JSON serialization", () => {
      const config = { reasoning_summary: ReasoningSummary.Detailed };
      const json = JSON.stringify(config);
      expect(json).toBe('{"reasoning_summary":"detailed"}');
    });

    it("can be deserialized from JSON", () => {
      const json = '{"reasoning_summary":"concise"}';
      const config = JSON.parse(json);
      expect(config.reasoning_summary).toBe(ReasoningSummary.Concise);
    });

    it("supports Auto as default summary format", () => {
      const defaultSummary: ReasoningSummary = ReasoningSummary.Auto;
      expect(defaultSummary).toBe("auto");
    });

    it("supports None to disable summaries", () => {
      const noSummary: ReasoningSummary = ReasoningSummary.None;
      expect(noSummary).toBe("none");
    });
  });

  describe("Verbosity", () => {
    it("has correct enum values", () => {
      expect(Verbosity.Low).toBe("low");
      expect(Verbosity.Medium).toBe("medium");
      expect(Verbosity.High).toBe("high");
    });

    it("includes all expected verbosity levels", () => {
      const levels = Object.values(Verbosity);
      expect(levels).toContain("low");
      expect(levels).toContain("medium");
      expect(levels).toContain("high");
    });

    it("has exactly 3 verbosity levels", () => {
      const verbosityTypes = Object.keys(Verbosity).filter((k) =>
        isNaN(Number(k)),
      );
      expect(verbosityTypes).toHaveLength(3);
    });

    it("serializes to lowercase strings", () => {
      const verbosity: Verbosity = Verbosity.High;
      expect(verbosity).toBe("high");
      expect(typeof verbosity).toBe("string");
    });

    it("can be used in JSON serialization", () => {
      const config = { verbosity: Verbosity.Low };
      const json = JSON.stringify(config);
      expect(json).toBe('{"verbosity":"low"}');
    });

    it("can be deserialized from JSON", () => {
      const json = '{"verbosity":"high"}';
      const config = JSON.parse(json);
      expect(config.verbosity).toBe(Verbosity.High);
    });

    it("supports Medium as default verbosity level", () => {
      const defaultVerbosity: Verbosity = Verbosity.Medium;
      expect(defaultVerbosity).toBe("medium");
    });
  });

  describe("SandboxMode", () => {
    it("has correct enum values", () => {
      expect(SandboxMode.ReadOnly).toBe("read-only");
      expect(SandboxMode.WorkspaceWrite).toBe("workspace-write");
      expect(SandboxMode.DangerFullAccess).toBe("danger-full-access");
    });

    it("includes all expected sandbox modes", () => {
      const modes = Object.values(SandboxMode);
      expect(modes).toContain("read-only");
      expect(modes).toContain("workspace-write");
      expect(modes).toContain("danger-full-access");
    });

    it("has exactly 3 sandbox modes", () => {
      const modeTypes = Object.keys(SandboxMode).filter((k) =>
        isNaN(Number(k)),
      );
      expect(modeTypes).toHaveLength(3);
    });

    it("serializes to kebab-case strings", () => {
      const mode: SandboxMode = SandboxMode.WorkspaceWrite;
      expect(mode).toBe("workspace-write");
      expect(typeof mode).toBe("string");
    });

    it("can be used in JSON serialization", () => {
      const config = { sandbox_mode: SandboxMode.ReadOnly };
      const json = JSON.stringify(config);
      expect(json).toBe('{"sandbox_mode":"read-only"}');
    });

    it("can be deserialized from JSON", () => {
      const json = '{"sandbox_mode":"workspace-write"}';
      const config = JSON.parse(json);
      expect(config.sandbox_mode).toBe(SandboxMode.WorkspaceWrite);
    });

    it("supports ReadOnly as default (safest) mode", () => {
      const defaultMode: SandboxMode = SandboxMode.ReadOnly;
      expect(defaultMode).toBe("read-only");
    });

    it("clearly labels dangerous full access mode", () => {
      const dangerMode: SandboxMode = SandboxMode.DangerFullAccess;
      expect(dangerMode).toBe("danger-full-access");
      expect(dangerMode).toContain("danger");
    });

    it("can be used in switch statements for permission checks", () => {
      const canWrite = (mode: SandboxMode): boolean => {
        switch (mode) {
          case SandboxMode.ReadOnly:
            return false;
          case SandboxMode.WorkspaceWrite:
          case SandboxMode.DangerFullAccess:
            return true;
          default:
            return false;
        }
      };

      expect(canWrite(SandboxMode.ReadOnly)).toBe(false);
      expect(canWrite(SandboxMode.WorkspaceWrite)).toBe(true);
      expect(canWrite(SandboxMode.DangerFullAccess)).toBe(true);
    });
  });

  describe("ForcedLoginMethod", () => {
    it("has correct enum values", () => {
      expect(ForcedLoginMethod.Chatgpt).toBe("chatgpt");
      expect(ForcedLoginMethod.Api).toBe("api");
    });

    it("includes all expected login methods", () => {
      const methods = Object.values(ForcedLoginMethod);
      expect(methods).toContain("chatgpt");
      expect(methods).toContain("api");
    });

    it("has exactly 2 login methods", () => {
      const methodTypes = Object.keys(ForcedLoginMethod).filter((k) =>
        isNaN(Number(k)),
      );
      expect(methodTypes).toHaveLength(2);
    });

    it("serializes to lowercase strings", () => {
      const method: ForcedLoginMethod = ForcedLoginMethod.Chatgpt;
      expect(method).toBe("chatgpt");
      expect(typeof method).toBe("string");
    });

    it("can be used in JSON serialization", () => {
      const config = { forced_login: ForcedLoginMethod.Api };
      const json = JSON.stringify(config);
      expect(json).toBe('{"forced_login":"api"}');
    });

    it("can be deserialized from JSON", () => {
      const json = '{"forced_login":"chatgpt"}';
      const config = JSON.parse(json);
      expect(config.forced_login).toBe(ForcedLoginMethod.Chatgpt);
    });

    it("can be compared for equality", () => {
      const method1: ForcedLoginMethod = ForcedLoginMethod.Api;
      const method2: ForcedLoginMethod = ForcedLoginMethod.Api;
      const method3: ForcedLoginMethod = ForcedLoginMethod.Chatgpt;

      expect(method1).toBe(method2);
      expect(method1).not.toBe(method3);
    });
  });

  describe("Config Integration", () => {
    it("can combine multiple config enums in a single config object", () => {
      const config = {
        reasoning_effort: ReasoningEffort.High,
        reasoning_summary: ReasoningSummary.Detailed,
        verbosity: Verbosity.High,
        sandbox_mode: SandboxMode.ReadOnly,
        forced_login: ForcedLoginMethod.Api,
      };

      const json = JSON.stringify(config);
      const parsed = JSON.parse(json);

      expect(parsed.reasoning_effort).toBe("high");
      expect(parsed.reasoning_summary).toBe("detailed");
      expect(parsed.verbosity).toBe("high");
      expect(parsed.sandbox_mode).toBe("read-only");
      expect(parsed.forced_login).toBe("api");
    });

    it("handles default config values", () => {
      const defaultConfig = {
        reasoning_effort: ReasoningEffort.Medium,
        reasoning_summary: ReasoningSummary.Auto,
        verbosity: Verbosity.Medium,
        sandbox_mode: SandboxMode.ReadOnly,
      };

      expect(defaultConfig.reasoning_effort).toBe("medium");
      expect(defaultConfig.reasoning_summary).toBe("auto");
      expect(defaultConfig.verbosity).toBe("medium");
      expect(defaultConfig.sandbox_mode).toBe("read-only");
    });

    it("supports partial config objects", () => {
      const partialConfig: {
        sandbox_mode?: SandboxMode;
        verbosity?: Verbosity;
      } = {
        sandbox_mode: SandboxMode.WorkspaceWrite,
      };

      expect(partialConfig.sandbox_mode).toBe("workspace-write");
      expect(partialConfig.verbosity).toBeUndefined();
    });
  });
});
