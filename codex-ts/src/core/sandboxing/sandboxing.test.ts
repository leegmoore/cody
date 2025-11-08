/**
 * Tests for sandbox management
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SandboxManager,
  SandboxType,
  SandboxPreference,
  type CommandSpec,
  CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR,
  CODEX_SANDBOX_ENV_VAR,
  SandboxTransformError,
  setWindowsSandboxEnabled,
  getPlatformSandbox,
  isSandboxAvailable,
} from "./index.js";
import type { SandboxPolicy } from "../../protocol/protocol.js";

describe("Platform Detection", () => {
  afterEach(() => {
    // Reset Windows sandbox state
    setWindowsSandboxEnabled(false);
  });

  it("should detect platform sandbox", () => {
    const sandbox = getPlatformSandbox();

    // Should return appropriate sandbox based on current platform
    if (process.platform === "darwin") {
      expect(sandbox).toBe(SandboxType.MacosSeatbelt);
    } else if (process.platform === "linux") {
      expect(sandbox).toBe(SandboxType.LinuxSeccomp);
    } else if (process.platform === "win32") {
      // Windows sandbox is opt-in
      expect(sandbox).toBeUndefined();
    }
  });

  it("should enable Windows sandbox when flag is set", () => {
    setWindowsSandboxEnabled(true);

    if (process.platform === "win32") {
      const sandbox = getPlatformSandbox();
      expect(sandbox).toBe(SandboxType.WindowsRestrictedToken);
    }
  });

  it("should check sandbox availability", () => {
    expect(isSandboxAvailable(SandboxType.None)).toBe(true);

    if (process.platform === "darwin") {
      expect(isSandboxAvailable(SandboxType.MacosSeatbelt)).toBe(true);
      expect(isSandboxAvailable(SandboxType.LinuxSeccomp)).toBe(false);
    } else if (process.platform === "linux") {
      expect(isSandboxAvailable(SandboxType.LinuxSeccomp)).toBe(true);
      expect(isSandboxAvailable(SandboxType.MacosSeatbelt)).toBe(false);
    }
  });
});

describe("SandboxManager", () => {
  let manager: SandboxManager;

  beforeEach(() => {
    manager = new SandboxManager();
    setWindowsSandboxEnabled(false);
  });

  afterEach(() => {
    setWindowsSandboxEnabled(false);
  });

  describe("selectInitial", () => {
    const dangerPolicy: SandboxPolicy = { mode: "danger-full-access" };
    const readOnlyPolicy: SandboxPolicy = { mode: "read-only" };
    const workspaceWritePolicy: SandboxPolicy = {
      mode: "workspace-write",
      writable_roots: ["/workspace"],
      network_access: false,
    };

    it("should forbid sandbox when preference is Forbid", () => {
      const result = manager.selectInitial(
        readOnlyPolicy,
        SandboxPreference.Forbid,
      );
      expect(result).toBe(SandboxType.None);
    });

    it("should require sandbox when preference is Require", () => {
      const result = manager.selectInitial(
        dangerPolicy,
        SandboxPreference.Require,
      );

      // Should get platform sandbox or None
      const platformSandbox = getPlatformSandbox();
      if (platformSandbox) {
        expect(result).toBe(platformSandbox);
      } else {
        expect(result).toBe(SandboxType.None);
      }
    });

    it("should use no sandbox for danger-full-access with Auto preference", () => {
      const result = manager.selectInitial(
        dangerPolicy,
        SandboxPreference.Auto,
      );
      expect(result).toBe(SandboxType.None);
    });

    it("should use platform sandbox for read-only with Auto preference", () => {
      const result = manager.selectInitial(
        readOnlyPolicy,
        SandboxPreference.Auto,
      );

      const platformSandbox = getPlatformSandbox();
      if (platformSandbox) {
        expect(result).toBe(platformSandbox);
      } else {
        expect(result).toBe(SandboxType.None);
      }
    });

    it("should use platform sandbox for workspace-write with Auto preference", () => {
      const result = manager.selectInitial(
        workspaceWritePolicy,
        SandboxPreference.Auto,
      );

      const platformSandbox = getPlatformSandbox();
      if (platformSandbox) {
        expect(result).toBe(platformSandbox);
      } else {
        expect(result).toBe(SandboxType.None);
      }
    });
  });

  describe("transform", () => {
    const baseSpec: CommandSpec = {
      program: "ls",
      args: ["-la", "/tmp"],
      cwd: "/workspace",
      env: { PATH: "/usr/bin", HOME: "/home/user" },
    };

    const readOnlyPolicy: SandboxPolicy = { mode: "read-only" };
    const workspaceWriteNoNetwork: SandboxPolicy = {
      mode: "workspace-write",
      writable_roots: ["/workspace"],
      network_access: false,
    };
    const workspaceWriteWithNetwork: SandboxPolicy = {
      mode: "workspace-write",
      writable_roots: ["/workspace"],
      network_access: true,
    };
    const dangerPolicy: SandboxPolicy = { mode: "danger-full-access" };

    it("should transform with no sandbox", () => {
      const result = manager.transform(
        baseSpec,
        readOnlyPolicy,
        SandboxType.None,
        "/workspace",
      );

      expect(result.command).toEqual(["ls", "-la", "/tmp"]);
      expect(result.cwd).toBe("/workspace");
      expect(result.sandbox).toBe(SandboxType.None);
      expect(result.env).toEqual({
        PATH: "/usr/bin",
        HOME: "/home/user",
        [CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR]: "1",
      });
    });

    it("should add network disabled flag for read-only policy", () => {
      const result = manager.transform(
        baseSpec,
        readOnlyPolicy,
        SandboxType.None,
        "/workspace",
      );

      expect(result.env[CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR]).toBe("1");
    });

    it("should add network disabled flag for workspace-write without network", () => {
      const result = manager.transform(
        baseSpec,
        workspaceWriteNoNetwork,
        SandboxType.None,
        "/workspace",
      );

      expect(result.env[CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR]).toBe("1");
    });

    it("should not add network disabled flag for workspace-write with network", () => {
      const result = manager.transform(
        baseSpec,
        workspaceWriteWithNetwork,
        SandboxType.None,
        "/workspace",
      );

      expect(
        result.env[CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR],
      ).toBeUndefined();
    });

    it("should not add network disabled flag for danger-full-access", () => {
      const result = manager.transform(
        baseSpec,
        dangerPolicy,
        SandboxType.None,
        "/workspace",
      );

      expect(
        result.env[CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR],
      ).toBeUndefined();
    });

    it("should wrap with macOS Seatbelt sandbox", () => {
      const result = manager.transform(
        baseSpec,
        readOnlyPolicy,
        SandboxType.MacosSeatbelt,
        "/workspace",
      );

      expect(result.sandbox).toBe(SandboxType.MacosSeatbelt);
      expect(result.command[0]).toBe("/usr/bin/sandbox-exec");
      expect(result.command.length).toBeGreaterThan(3);
      expect(result.env[CODEX_SANDBOX_ENV_VAR]).toBe("seatbelt");
    });

    it("should wrap with Linux Seccomp sandbox", () => {
      const linuxSandboxExe = "/usr/local/bin/codex-linux-sandbox";
      const result = manager.transform(
        baseSpec,
        readOnlyPolicy,
        SandboxType.LinuxSeccomp,
        "/workspace",
        linuxSandboxExe,
      );

      expect(result.sandbox).toBe(SandboxType.LinuxSeccomp);
      expect(result.command[0]).toBe(linuxSandboxExe);
      expect(result.arg0).toBe("codex-linux-sandbox");
    });

    it("should throw error for Linux sandbox without executable path", () => {
      expect(() => {
        manager.transform(
          baseSpec,
          readOnlyPolicy,
          SandboxType.LinuxSeccomp,
          "/workspace",
        );
      }).toThrow(SandboxTransformError);

      expect(() => {
        manager.transform(
          baseSpec,
          readOnlyPolicy,
          SandboxType.LinuxSeccomp,
          "/workspace",
        );
      }).toThrow("missing codex-linux-sandbox executable path");
    });

    it("should handle Windows Restricted Token sandbox", () => {
      const result = manager.transform(
        baseSpec,
        readOnlyPolicy,
        SandboxType.WindowsRestrictedToken,
        "/workspace",
      );

      expect(result.sandbox).toBe(SandboxType.WindowsRestrictedToken);
      // Command should be unchanged (sandbox runs in-process)
      expect(result.command).toEqual(["ls", "-la", "/tmp"]);
    });

    it("should preserve timeout", () => {
      const specWithTimeout: CommandSpec = {
        ...baseSpec,
        timeoutMs: 5000,
      };

      const result = manager.transform(
        specWithTimeout,
        readOnlyPolicy,
        SandboxType.None,
        "/workspace",
      );

      expect(result.timeoutMs).toBe(5000);
    });

    it("should preserve escalated permissions flag", () => {
      const specWithPerms: CommandSpec = {
        ...baseSpec,
        withEscalatedPermissions: true,
      };

      const result = manager.transform(
        specWithPerms,
        readOnlyPolicy,
        SandboxType.None,
        "/workspace",
      );

      expect(result.withEscalatedPermissions).toBe(true);
    });

    it("should preserve justification", () => {
      const specWithJustification: CommandSpec = {
        ...baseSpec,
        justification: "User requested file listing",
      };

      const result = manager.transform(
        specWithJustification,
        readOnlyPolicy,
        SandboxType.None,
        "/workspace",
      );

      expect(result.justification).toBe("User requested file listing");
    });

    it("should not mutate original spec environment", () => {
      const originalEnv = { ...baseSpec.env };

      manager.transform(
        baseSpec,
        readOnlyPolicy,
        SandboxType.None,
        "/workspace",
      );

      expect(baseSpec.env).toEqual(originalEnv);
    });

    it("should include original command in sandboxed command", () => {
      const result = manager.transform(
        baseSpec,
        readOnlyPolicy,
        SandboxType.MacosSeatbelt,
        "/workspace",
      );

      // Command should contain the original program and args somewhere
      const commandString = result.command.join(" ");
      expect(commandString).toContain("ls");
      expect(commandString).toContain("-la");
      expect(commandString).toContain("/tmp");
    });
  });

  describe("Integration scenarios", () => {
    it("should handle full workflow for read-only command", () => {
      const spec: CommandSpec = {
        program: "cat",
        args: ["README.md"],
        cwd: "/project",
        env: { LANG: "en_US.UTF-8" },
      };
      const policy: SandboxPolicy = { mode: "read-only" };

      // Select sandbox
      const sandbox = manager.selectInitial(policy, SandboxPreference.Auto);

      // Transform to exec env
      const env = manager.transform(
        spec,
        policy,
        sandbox,
        "/project",
        "/usr/bin/codex-sandbox",
      );

      expect(env.cwd).toBe("/project");
      expect(env.sandbox).toBeDefined();
      expect(env.env[CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR]).toBe("1");
    });

    it("should handle full workflow for workspace-write with network", () => {
      const spec: CommandSpec = {
        program: "npm",
        args: ["install"],
        cwd: "/project",
        env: {},
      };
      const policy: SandboxPolicy = {
        mode: "workspace-write",
        writable_roots: ["/project"],
        network_access: true,
      };

      const sandbox = manager.selectInitial(policy, SandboxPreference.Auto);
      const env = manager.transform(
        spec,
        policy,
        sandbox,
        "/project",
        "/usr/bin/codex-sandbox",
      );

      // Should allow network
      expect(env.env[CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR]).toBeUndefined();
    });
  });
});
