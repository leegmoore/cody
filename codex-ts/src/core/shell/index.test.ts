/**
 * Tests for shell detection module.
 * NOTE: These are stub tests for Phase 5.1.
 */

import { describe, it, expect } from "vitest";
import { defaultUserShell, getShellName } from "./index";
import type { Shell } from "./index";

describe("shell (stub)", () => {
  describe("defaultUserShell", () => {
    it("should return bash as default", async () => {
      const shell = await defaultUserShell();
      expect(shell.type).toBe("bash");
      if (shell.type === "bash") {
        expect(shell.shellPath).toBe("/bin/bash");
        expect(shell.bashrcPath).toBe("~/.bashrc");
      }
    });

    it("should return a valid Shell object", async () => {
      const shell = await defaultUserShell();
      expect(shell).toBeDefined();
      expect(shell.type).toBeDefined();
    });
  });

  describe("getShellName", () => {
    it("should return bash name for bash shell", () => {
      const shell: Shell = {
        type: "bash",
        shellPath: "/bin/bash",
        bashrcPath: "~/.bashrc",
      };
      expect(getShellName(shell)).toBe("bash");
    });

    it("should return zsh name for zsh shell", () => {
      const shell: Shell = {
        type: "zsh",
        shellPath: "/bin/zsh",
        zshrcPath: "~/.zshrc",
      };
      expect(getShellName(shell)).toBe("zsh");
    });

    it("should return exe name for powershell", () => {
      const shell: Shell = {
        type: "powershell",
        exe: "pwsh",
      };
      expect(getShellName(shell)).toBe("pwsh");
    });

    it("should return undefined for unknown shell", () => {
      const shell: Shell = {
        type: "unknown",
      };
      expect(getShellName(shell)).toBeUndefined();
    });
  });
});
