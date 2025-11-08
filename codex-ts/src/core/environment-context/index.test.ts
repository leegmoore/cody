/**
 * Tests for environment context module.
 * NOTE: These are simplified tests for Phase 5.1.
 */

import { describe, it, expect } from "vitest";
import {
  createEnvironmentContext,
  equalsExceptShell,
  serializeEnvironmentContext,
  NetworkAccess,
  SandboxMode,
} from "./index";
import type { Shell } from "../shell";

describe("environment_context (simplified)", () => {
  describe("createEnvironmentContext", () => {
    it("should create empty context when no params provided", () => {
      const ctx = createEnvironmentContext();
      expect(ctx.cwd).toBeUndefined();
      expect(ctx.sandboxMode).toBeUndefined();
      expect(ctx.networkAccess).toBeUndefined();
      expect(ctx.shell).toBeUndefined();
    });

    it("should create context with cwd", () => {
      const ctx = createEnvironmentContext("/home/user/project");
      expect(ctx.cwd).toBe("/home/user/project");
    });

    it("should create context with all params", () => {
      const shell: Shell = {
        type: "bash",
        shellPath: "/bin/bash",
        bashrcPath: "~/.bashrc",
      };
      const ctx = createEnvironmentContext(
        "/home/user",
        SandboxMode.WorkspaceWrite,
        NetworkAccess.Enabled,
        shell,
      );

      expect(ctx.cwd).toBe("/home/user");
      expect(ctx.sandboxMode).toBe(SandboxMode.WorkspaceWrite);
      expect(ctx.networkAccess).toBe(NetworkAccess.Enabled);
      expect(ctx.shell).toBe(shell);
    });
  });

  describe("equalsExceptShell", () => {
    it("should return true for identical contexts", () => {
      const ctx1 = createEnvironmentContext(
        "/home/user",
        SandboxMode.ReadOnly,
        NetworkAccess.Restricted,
      );
      const ctx2 = createEnvironmentContext(
        "/home/user",
        SandboxMode.ReadOnly,
        NetworkAccess.Restricted,
      );

      expect(equalsExceptShell(ctx1, ctx2)).toBe(true);
    });

    it("should return true when only shell differs", () => {
      const shell1: Shell = {
        type: "bash",
        shellPath: "/bin/bash",
        bashrcPath: "~/.bashrc",
      };
      const shell2: Shell = {
        type: "zsh",
        shellPath: "/bin/zsh",
        zshrcPath: "~/.zshrc",
      };

      const ctx1 = createEnvironmentContext(
        "/home/user",
        SandboxMode.WorkspaceWrite,
        NetworkAccess.Enabled,
        shell1,
      );
      const ctx2 = createEnvironmentContext(
        "/home/user",
        SandboxMode.WorkspaceWrite,
        NetworkAccess.Enabled,
        shell2,
      );

      expect(equalsExceptShell(ctx1, ctx2)).toBe(true);
    });

    it("should return false when cwd differs", () => {
      const ctx1 = createEnvironmentContext("/home/user1");
      const ctx2 = createEnvironmentContext("/home/user2");

      expect(equalsExceptShell(ctx1, ctx2)).toBe(false);
    });

    it("should return false when sandbox_mode differs", () => {
      const ctx1 = createEnvironmentContext(
        "/home/user",
        SandboxMode.ReadOnly,
        NetworkAccess.Restricted,
      );
      const ctx2 = createEnvironmentContext(
        "/home/user",
        SandboxMode.WorkspaceWrite,
        NetworkAccess.Restricted,
      );

      expect(equalsExceptShell(ctx1, ctx2)).toBe(false);
    });

    it("should return false when network_access differs", () => {
      const ctx1 = createEnvironmentContext(
        "/home/user",
        SandboxMode.ReadOnly,
        NetworkAccess.Restricted,
      );
      const ctx2 = createEnvironmentContext(
        "/home/user",
        SandboxMode.ReadOnly,
        NetworkAccess.Enabled,
      );

      expect(equalsExceptShell(ctx1, ctx2)).toBe(false);
    });
  });

  describe("serializeEnvironmentContext", () => {
    it("should serialize empty context", () => {
      const ctx = createEnvironmentContext();
      const serialized = serializeEnvironmentContext(ctx);
      expect(serialized).toContain("<environment_context>");
      expect(serialized).toContain("</environment_context>");
    });

    it("should serialize cwd", () => {
      const ctx = createEnvironmentContext("/home/user/project");
      const serialized = serializeEnvironmentContext(ctx);
      expect(serialized).toContain("cwd: /home/user/project");
    });

    it("should serialize sandbox_mode", () => {
      const ctx = createEnvironmentContext(undefined, SandboxMode.ReadOnly);
      const serialized = serializeEnvironmentContext(ctx);
      expect(serialized).toContain("sandbox_mode: read-only");
    });

    it("should serialize network_access", () => {
      const ctx = createEnvironmentContext(
        undefined,
        undefined,
        NetworkAccess.Enabled,
      );
      const serialized = serializeEnvironmentContext(ctx);
      expect(serialized).toContain("network_access: enabled");
    });

    it("should serialize shell type", () => {
      const shell: Shell = {
        type: "bash",
        shellPath: "/bin/bash",
        bashrcPath: "~/.bashrc",
      };
      const ctx = createEnvironmentContext(
        undefined,
        undefined,
        undefined,
        shell,
      );
      const serialized = serializeEnvironmentContext(ctx);
      expect(serialized).toContain("shell: bash");
    });

    it("should serialize all fields", () => {
      const shell: Shell = {
        type: "zsh",
        shellPath: "/bin/zsh",
        zshrcPath: "~/.zshrc",
      };
      const ctx = createEnvironmentContext(
        "/home/user",
        SandboxMode.WorkspaceWrite,
        NetworkAccess.Enabled,
        shell,
      );
      const serialized = serializeEnvironmentContext(ctx);

      expect(serialized).toContain("cwd: /home/user");
      expect(serialized).toContain("sandbox_mode: workspace-write");
      expect(serialized).toContain("network_access: enabled");
      expect(serialized).toContain("shell: zsh");
    });
  });
});
