import { describe, it, expect } from "vitest";
import {
  AskForApproval,
  SandboxPolicy,
  newWorkspaceWritePolicy,
  ReasoningEffort,
} from "./types.js";

describe("Protocol Types", () => {
  describe("AskForApproval", () => {
    it("has expected values", () => {
      expect(AskForApproval.OnRequest).toBe("on-request");
      expect(AskForApproval.UnlessTrusted).toBe("untrusted");
      expect(AskForApproval.Never).toBe("never");
    });
  });

  describe("SandboxPolicy", () => {
    it("supports danger-full-access", () => {
      const policy: SandboxPolicy = { type: "danger-full-access" };
      expect(policy.type).toBe("danger-full-access");
    });

    it("supports read-only", () => {
      const policy: SandboxPolicy = { type: "read-only" };
      expect(policy.type).toBe("read-only");
    });

    it("supports workspace-write with defaults", () => {
      const policy = newWorkspaceWritePolicy();
      expect(policy.type).toBe("workspace-write");
      if (policy.type === "workspace-write") {
        expect(policy.writableRoots).toEqual([]);
        expect(policy.networkAccess).toBe(false);
        expect(policy.excludeTmpdirEnvVar).toBe(false);
        expect(policy.excludeSlashTmp).toBe(false);
      }
    });

    it("supports workspace-write with custom options", () => {
      const policy = newWorkspaceWritePolicy({
        writableRoots: ["/tmp", "/data"],
        networkAccess: true,
        excludeSlashTmp: true,
      });

      expect(policy.type).toBe("workspace-write");
      if (policy.type === "workspace-write") {
        expect(policy.writableRoots).toEqual(["/tmp", "/data"]);
        expect(policy.networkAccess).toBe(true);
        expect(policy.excludeTmpdirEnvVar).toBe(false);
        expect(policy.excludeSlashTmp).toBe(true);
      }
    });
  });

  describe("ReasoningEffort", () => {
    it("has expected values", () => {
      expect(ReasoningEffort.Minimal).toBe("minimal");
      expect(ReasoningEffort.Low).toBe("low");
      expect(ReasoningEffort.Medium).toBe("medium");
      expect(ReasoningEffort.High).toBe("high");
    });
  });
});
