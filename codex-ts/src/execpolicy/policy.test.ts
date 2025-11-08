/**
 * Tests for execution policy checking
 */

import { describe, it, expect } from "vitest";
import { Policy } from "./policy.js";
import { DEFAULT_POLICY } from "./default-policy.js";
import type { ExecCall } from "./types.js";

describe("execpolicy", () => {
  const policy = new Policy(DEFAULT_POLICY);

  describe("safe commands", () => {
    it("should allow ls with no args", () => {
      const result = policy.check({ program: "ls", args: [] });
      expect(result.result).toBe("safe");
      if (result.result === "safe") {
        expect(result.match.program).toBe("ls");
        expect(result.match.systemPath).toContain("/bin/ls");
      }
    });

    it("should allow ls with file args", () => {
      const result = policy.check({ program: "ls", args: ["-l", "foo"] });
      expect(result.result).toBe("safe");
      if (result.result === "safe") {
        expect(result.match.flags).toEqual([{ name: "-l" }]);
        expect(result.match.args[0].value).toBe("foo");
      }
    });

    it("should allow cat with file", () => {
      const result = policy.check({ program: "cat", args: ["file.txt"] });
      expect(result.result).toBe("safe");
    });

    it("should allow cat with flag and file", () => {
      const result = policy.check({ program: "cat", args: ["-n", "file.txt"] });
      expect(result.result).toBe("safe");
      if (result.result === "safe") {
        expect(result.match.flags).toContainEqual({ name: "-n" });
      }
    });

    it("should allow pwd", () => {
      const result = policy.check({ program: "pwd", args: [] });
      expect(result.result).toBe("safe");
    });

    it("should allow pwd with flags", () => {
      const result = policy.check({ program: "pwd", args: ["-P"] });
      expect(result.result).toBe("safe");
    });

    it("should allow printenv with no args", () => {
      const result = policy.check({ program: "printenv", args: [] });
      expect(result.result).toBe("safe");
    });

    it("should allow printenv with single arg", () => {
      const result = policy.check({ program: "printenv", args: ["PATH"] });
      expect(result.result).toBe("safe");
    });

    it("should allow head with option", () => {
      const result = policy.check({
        program: "head",
        args: ["-n", "10", "file.txt"],
      });
      expect(result.result).toBe("safe");
      if (result.result === "safe") {
        expect(result.match.opts).toEqual([
          { name: "-n", value: "10", argType: "PositiveInt" },
        ]);
      }
    });

    it("should allow grep with pattern and files", () => {
      const result = policy.check({
        program: "grep",
        args: ["pattern", "file.txt"],
      });
      expect(result.result).toBe("safe");
    });

    it("should allow echo with args", () => {
      const result = policy.check({
        program: "echo",
        args: ["hello", "world"],
      });
      expect(result.result).toBe("safe");
    });
  });

  describe("match commands (require file approval)", () => {
    it("should return match for cp (has writeable file)", () => {
      const result = policy.check({
        program: "cp",
        args: ["src.txt", "dest.txt"],
      });
      expect(result.result).toBe("match");
      if (result.result === "match") {
        expect(result.match.args).toHaveLength(2);
        expect(result.match.args[0].type).toBe("ReadableFile");
        expect(result.match.args[1].type).toBe("WriteableFile");
      }
    });

    it("should return match for mkdir", () => {
      const result = policy.check({ program: "mkdir", args: ["newdir"] });
      expect(result.result).toBe("match");
    });

    it("should allow cp with recursive flag", () => {
      const result = policy.check({
        program: "cp",
        args: ["-r", "src", "dest"],
      });
      expect(result.result).toBe("match");
      if (result.result === "match") {
        expect(result.match.flags).toContainEqual({ name: "-r" });
      }
    });
  });

  describe("forbidden commands", () => {
    it("should forbid rm command", () => {
      const result = policy.check({ program: "rm", args: ["file.txt"] });
      expect(result.result).toBe("forbidden");
      if (result.result === "forbidden") {
        expect(result.reason).toContain("forbidden");
      }
    });

    it("should forbid sudo", () => {
      const result = policy.check({ program: "sudo", args: ["ls"] });
      expect(result.result).toBe("forbidden");
      if (result.result === "forbidden") {
        expect(result.reason).toContain("Privilege escalation");
      }
    });

    it("should forbid applied deploy", () => {
      const result = policy.check({ program: "applied", args: ["deploy"] });
      expect(result.result).toBe("forbidden");
      if (result.result === "forbidden") {
        expect(result.reason).toContain("Infrastructure Risk");
      }
    });

    it("should forbid args with forbidden substrings", () => {
      const result = policy.check({ program: "ls", args: ["--exec=rm"] });
      expect(result.result).toBe("forbidden");
      if (result.result === "forbidden") {
        expect(result.reason).toContain("forbidden substring");
      }
    });
  });

  describe("unverified commands", () => {
    it("should return unverified for unknown program", () => {
      const result = policy.check({ program: "unknowncommand", args: [] });
      expect(result.result).toBe("unverified");
    });

    it("should return unverified for cat with no args", () => {
      const result = policy.check({ program: "cat", args: [] });
      expect(result.result).toBe("unverified");
    });

    it("should return unverified for unknown option", () => {
      const result = policy.check({ program: "ls", args: ["--unknown"] });
      expect(result.result).toBe("unverified");
    });

    it("should return unverified for cp with only one arg", () => {
      const result = policy.check({ program: "cp", args: ["onefile"] });
      expect(result.result).toBe("unverified");
    });

    it("should return unverified for printenv with multiple args", () => {
      const result = policy.check({
        program: "printenv",
        args: ["PATH", "HOME"],
      });
      expect(result.result).toBe("unverified");
    });
  });

  describe("positive examples verification", () => {
    it("should verify all positive examples pass", () => {
      const failures = policy.checkPositiveExamples();
      expect(failures).toEqual([]);
    });
  });

  describe("negative examples verification", () => {
    it("should verify all negative examples fail", () => {
      const failures = policy.checkNegativeExamples();
      expect(failures).toEqual([]);
    });
  });

  describe("option parsing", () => {
    it("should parse flag options", () => {
      const result = policy.check({ program: "ls", args: ["-l", "-a"] });
      expect(result.result).toBe("safe");
      if (result.result === "safe") {
        expect(result.match.flags).toContainEqual({ name: "-l" });
        expect(result.match.flags).toContainEqual({ name: "-a" });
      }
    });

    it("should parse value options", () => {
      const result = policy.check({
        program: "head",
        args: ["-n", "5", "file.txt"],
      });
      expect(result.result).toBe("safe");
      if (result.result === "safe") {
        expect(result.match.opts).toContainEqual({
          name: "-n",
          value: "5",
          argType: "PositiveInt",
        });
      }
    });

    it("should error when option followed by another option", () => {
      const result = policy.check({
        program: "head",
        args: ["-n", "-c", "file.txt"],
      });
      expect(result.result).toBe("unverified");
    });
  });

  describe("argument pattern matching", () => {
    it("should match single argument pattern", () => {
      const result = policy.check({ program: "printenv", args: ["HOME"] });
      expect(result.result).toBe("safe");
    });

    it("should match one-or-more pattern", () => {
      const result = policy.check({
        program: "cat",
        args: ["file1.txt", "file2.txt", "file3.txt"],
      });
      expect(result.result).toBe("safe");
    });

    it("should match zero-or-more pattern", () => {
      const result = policy.check({ program: "ls", args: [] });
      expect(result.result).toBe("safe");
    });

    it("should match literal argument", () => {
      const result = policy.check({ program: "applied", args: ["lint"] });
      expect(result.result).toBe("unverified"); // 'lint' is not 'deploy', so no match
    });
  });
});
