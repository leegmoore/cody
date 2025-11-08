import { describe, it, expect } from "vitest";
import { summarizeSandboxPolicy } from "./sandbox-summary.js";
import { newWorkspaceWritePolicy } from "../protocol/types.js";

describe("summarizeSandboxPolicy", () => {
  it("summarizes danger-full-access", () => {
    const result = summarizeSandboxPolicy({ type: "danger-full-access" });
    expect(result).toBe("danger-full-access");
  });

  it("summarizes read-only", () => {
    const result = summarizeSandboxPolicy({ type: "read-only" });
    expect(result).toBe("read-only");
  });

  it("summarizes workspace-write with defaults", () => {
    const policy = newWorkspaceWritePolicy();
    const result = summarizeSandboxPolicy(policy);
    expect(result).toBe("workspace-write [workdir, /tmp, $TMPDIR]");
  });

  it("summarizes workspace-write excluding /tmp", () => {
    const policy = newWorkspaceWritePolicy({
      excludeSlashTmp: true,
    });
    const result = summarizeSandboxPolicy(policy);
    expect(result).toBe("workspace-write [workdir, $TMPDIR]");
  });

  it("summarizes workspace-write excluding TMPDIR", () => {
    const policy = newWorkspaceWritePolicy({
      excludeTmpdirEnvVar: true,
    });
    const result = summarizeSandboxPolicy(policy);
    expect(result).toBe("workspace-write [workdir, /tmp]");
  });

  it("summarizes workspace-write with custom roots", () => {
    const policy = newWorkspaceWritePolicy({
      writableRoots: ["/data", "/logs"],
    });
    const result = summarizeSandboxPolicy(policy);
    expect(result).toBe(
      "workspace-write [workdir, /tmp, $TMPDIR, /data, /logs]",
    );
  });

  it("summarizes workspace-write with network access", () => {
    const policy = newWorkspaceWritePolicy({
      networkAccess: true,
    });
    const result = summarizeSandboxPolicy(policy);
    expect(result).toBe(
      "workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)",
    );
  });

  it("summarizes full config with exclusions and custom roots", () => {
    const policy = newWorkspaceWritePolicy({
      writableRoots: ["/custom"],
      networkAccess: true,
      excludeSlashTmp: true,
      excludeTmpdirEnvVar: true,
    });
    const result = summarizeSandboxPolicy(policy);
    expect(result).toBe(
      "workspace-write [workdir, /custom] (network access enabled)",
    );
  });
});
