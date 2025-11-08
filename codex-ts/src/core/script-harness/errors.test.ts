/**
 * Tests for script harness error types
 *
 * Phase 4.4 - Script Harness: Error Handling
 */

import { describe, it, expect } from "vitest";
import {
  ScriptHarnessError,
  ScriptSyntaxError,
  ScriptTimeoutError,
  ScriptMemoryError,
  ScriptStackOverflowError,
  ApprovalDeniedError,
  ApprovalTimeoutError,
  ToolExecutionError,
  ToolNotFoundError,
  ToolValidationError,
  DetachedPromiseError,
  HarnessInternalError,
  SerializationError,
  ScriptTooLargeError,
  ReturnValueTooLargeError,
  ToolBudgetExceededError,
  ConcurrencyLimitError,
  BannedIdentifierError,
  ScriptCancelledError,
  extractErrorInfo,
  isRetryableError,
} from "./errors.js";

describe("Script Harness Errors", () => {
  describe("Base Error Class", () => {
    it("should create base error with code and phase", () => {
      const error = new ScriptHarnessError(
        "Test error",
        "TEST_ERROR",
        "executing",
      );

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.phase).toBe("executing");
      expect(error.name).toBe("ScriptHarnessError");
    });

    it("should include metadata", () => {
      const error = new ScriptHarnessError(
        "Test error",
        "TEST_ERROR",
        "executing",
        { foo: "bar", count: 42 },
      );

      expect(error.metadata).toEqual({ foo: "bar", count: 42 });
    });

    it("should sanitize stack trace", () => {
      const error = new ScriptHarnessError(
        "Test error",
        "TEST_ERROR",
        "executing",
      );

      const sanitized = error.getSanitizedStack();
      expect(sanitized).toBeTruthy();
      expect(sanitized).not.toContain("/home/");
      expect(sanitized).not.toContain("/usr/");
    });

    it("should convert to JSON", () => {
      const error = new ScriptHarnessError(
        "Test error",
        "TEST_ERROR",
        "parsing",
        { line: 42 },
      );

      const json = error.toJSON();
      expect(json.code).toBe("TEST_ERROR");
      expect(json.message).toBe("Test error");
      expect(json.phase).toBe("parsing");
      expect(json.metadata).toEqual({ line: 42 });
      expect(json.stack).toBeTruthy();
    });
  });

  describe("ScriptSyntaxError", () => {
    it("should create syntax error with location", () => {
      const error = new ScriptSyntaxError(
        "Unexpected token",
        15,
        3,
        "const x =",
      );

      expect(error.code).toBe("ScriptSyntaxError");
      expect(error.phase).toBe("parsing");
      expect(error.line).toBe(15);
      expect(error.column).toBe(3);
      expect(error.snippet).toBe("const x =");
    });

    it("should work without location info", () => {
      const error = new ScriptSyntaxError("Parse error");

      expect(error.code).toBe("ScriptSyntaxError");
      expect(error.line).toBeUndefined();
      expect(error.column).toBeUndefined();
    });
  });

  describe("ScriptTimeoutError", () => {
    it("should include timeout details", () => {
      const error = new ScriptTimeoutError(30000, 30012, 12, 1);

      expect(error.code).toBe("ScriptTimeoutError");
      expect(error.phase).toBe("executing");
      expect(error.message).toContain("30000ms");
      expect(error.elapsedMs).toBe(30012);
      expect(error.completedTools).toBe(12);
      expect(error.pendingTools).toBe(1);
    });

    it("should include metadata", () => {
      const error = new ScriptTimeoutError(5000, 5100, 3, 2);

      expect(error.metadata).toEqual({
        timeoutMs: 5000,
        elapsedMs: 5100,
        completedTools: 3,
        pendingTools: 2,
      });
    });
  });

  describe("ScriptMemoryError", () => {
    it("should include memory limit", () => {
      const error = new ScriptMemoryError(96, 105);

      expect(error.code).toBe("ScriptMemoryError");
      expect(error.phase).toBe("executing");
      expect(error.message).toContain("96MB");
      expect(error.usedMb).toBe(105);
    });

    it("should work without usage info", () => {
      const error = new ScriptMemoryError(96);

      expect(error.usedMb).toBeUndefined();
    });
  });

  describe("ScriptStackOverflowError", () => {
    it("should include stack limit", () => {
      const error = new ScriptStackOverflowError(524288, 1000);

      expect(error.code).toBe("ScriptStackOverflowError");
      expect(error.message).toContain("524288 bytes");
      expect(error.depth).toBe(1000);
    });
  });

  describe("ApprovalDeniedError", () => {
    it("should include tool name", () => {
      const error = new ApprovalDeniedError("exec", "req_123");

      expect(error.code).toBe("ApprovalDeniedError");
      expect(error.phase).toBe("executing");
      expect(error.toolName).toBe("exec");
      expect(error.requestId).toBe("req_123");
      expect(error.message).toContain("exec");
    });

    it("should work without request ID", () => {
      const error = new ApprovalDeniedError("applyPatch");

      expect(error.requestId).toBeUndefined();
    });
  });

  describe("ApprovalTimeoutError", () => {
    it("should include timeout details", () => {
      const error = new ApprovalTimeoutError("exec", 60000);

      expect(error.code).toBe("ApprovalTimeoutError");
      expect(error.toolName).toBe("exec");
      expect(error.timeoutMs).toBe(60000);
      expect(error.message).toContain("60000ms");
    });
  });

  describe("ToolExecutionError", () => {
    it("should include tool error details", () => {
      const error = new ToolExecutionError(
        "exec",
        "Command failed",
        "Permission denied",
        1,
      );

      expect(error.code).toBe("ToolExecutionError");
      expect(error.toolName).toBe("exec");
      expect(error.toolError).toBe("Command failed");
      expect(error.stderr).toBe("Permission denied");
      expect(error.exitCode).toBe(1);
    });

    it("should truncate long stderr", () => {
      const longStderr = "x".repeat(3000);
      const error = new ToolExecutionError("exec", "Failed", longStderr);

      expect(error.stderr).toContain("...<truncated>");
      expect(error.stderr!.length).toBeLessThanOrEqual(2048 + 20); // 2048 + truncation marker
    });

    it("should work without stderr", () => {
      const error = new ToolExecutionError("exec", "Failed");

      expect(error.stderr).toBeUndefined();
      expect(error.exitCode).toBeUndefined();
    });
  });

  describe("ToolNotFoundError", () => {
    it("should list available tools", () => {
      const error = new ToolNotFoundError("badTool", [
        "applyPatch",
        "exec",
        "fileSearch",
      ]);

      expect(error.code).toBe("ToolNotFoundError");
      expect(error.toolName).toBe("badTool");
      expect(error.availableTools).toEqual([
        "applyPatch",
        "exec",
        "fileSearch",
      ]);
      expect(error.message).toContain("applyPatch");
      expect(error.message).toContain("exec");
    });
  });

  describe("ToolValidationError", () => {
    it("should include validation errors", () => {
      const error = new ToolValidationError("exec", [
        "command is required",
        "cwd must be a string",
      ]);

      expect(error.code).toBe("ToolValidationError");
      expect(error.toolName).toBe("exec");
      expect(error.validationErrors).toHaveLength(2);
      expect(error.message).toContain("command is required");
    });
  });

  describe("DetachedPromiseError", () => {
    it("should list orphaned promises", () => {
      const error = new DetachedPromiseError([
        "tool_0 (exec)",
        "tool_1 (applyPatch)",
      ]);

      expect(error.code).toBe("DetachedPromiseError");
      expect(error.phase).toBe("finalizing");
      expect(error.orphanedPromises).toHaveLength(2);
      expect(error.message).toContain("tool_0");
    });
  });

  describe("HarnessInternalError", () => {
    it("should wrap original error", () => {
      const original = new Error("Worker crashed");
      const error = new HarnessInternalError("Unexpected failure", original);

      expect(error.code).toBe("HarnessInternalError");
      expect(error.originalError).toBe(original);
      expect(error.metadata?.originalError).toBe("Worker crashed");
    });

    it("should handle non-Error objects", () => {
      const error = new HarnessInternalError("Failure", "string error");

      expect(error.metadata?.originalError).toBe("string error");
    });
  });

  describe("SerializationError", () => {
    it("should include value type", () => {
      const error = new SerializationError("BigInt not supported", "bigint");

      expect(error.code).toBe("SerializationError");
      expect(error.phase).toBe("finalizing");
      expect(error.valueType).toBe("bigint");
      expect(error.message).toContain("BigInt");
    });
  });

  describe("ScriptTooLargeError", () => {
    it("should include size details", () => {
      const error = new ScriptTooLargeError(25000, 20000);

      expect(error.code).toBe("ScriptTooLargeError");
      expect(error.phase).toBe("parsing");
      expect(error.sizeBytes).toBe(25000);
      expect(error.limitBytes).toBe(20000);
      expect(error.message).toContain("25000");
      expect(error.message).toContain("20000");
    });
  });

  describe("ReturnValueTooLargeError", () => {
    it("should include size details", () => {
      const error = new ReturnValueTooLargeError(150000, 131072);

      expect(error.code).toBe("ReturnValueTooLargeError");
      expect(error.phase).toBe("finalizing");
      expect(error.sizeBytes).toBe(150000);
      expect(error.limitBytes).toBe(131072);
    });
  });

  describe("ToolBudgetExceededError", () => {
    it("should include budget details", () => {
      const error = new ToolBudgetExceededError(32, 33);

      expect(error.code).toBe("ToolBudgetExceededError");
      expect(error.limit).toBe(32);
      expect(error.attempted).toBe(33);
      expect(error.message).toContain("32");
      expect(error.message).toContain("33");
    });
  });

  describe("ConcurrencyLimitError", () => {
    it("should include concurrency details", () => {
      const error = new ConcurrencyLimitError(4, 5);

      expect(error.code).toBe("ConcurrencyLimitError");
      expect(error.limit).toBe(4);
      expect(error.pending).toBe(5);
    });
  });

  describe("BannedIdentifierError", () => {
    it("should list banned identifiers", () => {
      const error = new BannedIdentifierError(["eval", "require", "process"]);

      expect(error.code).toBe("BannedIdentifierError");
      expect(error.phase).toBe("parsing");
      expect(error.identifiers).toEqual(["eval", "require", "process"]);
      expect(error.message).toContain("eval");
    });
  });

  describe("ScriptCancelledError", () => {
    it("should include cancellation reason", () => {
      const error = new ScriptCancelledError("User requested cancellation");

      expect(error.code).toBe("ScriptCancelledError");
      expect(error.message).toContain("User requested cancellation");
    });

    it("should work without reason", () => {
      const error = new ScriptCancelledError();

      expect(error.message).toBe("Script execution cancelled");
    });
  });

  describe("Error Utilities", () => {
    describe("extractErrorInfo", () => {
      it("should extract from ScriptHarnessError", () => {
        const error = new ScriptTimeoutError(30000, 30012, 10, 1);
        const info = extractErrorInfo(error);

        expect(info.code).toBe("ScriptTimeoutError");
        expect(info.message).toContain("30000ms");
        expect(info.stack).toBeTruthy();
      });

      it("should extract from standard Error", () => {
        const error = new Error("Standard error");
        const info = extractErrorInfo(error);

        expect(info.code).toBe("Error");
        expect(info.message).toBe("Standard error");
        expect(info.stack).toBeTruthy();
      });

      it("should handle string errors", () => {
        const info = extractErrorInfo("String error");

        expect(info.code).toBe("UnknownError");
        expect(info.message).toBe("String error");
        expect(info.stack).toBeUndefined();
      });

      it("should handle unknown error types", () => {
        const info = extractErrorInfo({ custom: "object" });

        expect(info.code).toBe("UnknownError");
        expect(info.message).toBe("[object Object]");
      });
    });

    describe("isRetryableError", () => {
      it("should identify retryable errors", () => {
        expect(isRetryableError(new ScriptSyntaxError("Parse error"))).toBe(
          true,
        );
        expect(
          isRetryableError(new ScriptTimeoutError(30000, 30012, 10, 1)),
        ).toBe(true);
        expect(isRetryableError(new ScriptMemoryError(96))).toBe(true);
        expect(isRetryableError(new ToolNotFoundError("bad", ["good"]))).toBe(
          true,
        );
        expect(
          isRetryableError(new ToolValidationError("exec", ["error"])),
        ).toBe(true);
      });

      it("should identify non-retryable errors", () => {
        expect(isRetryableError(new ApprovalDeniedError("exec"))).toBe(false);
        expect(isRetryableError(new ApprovalTimeoutError("exec", 60000))).toBe(
          false,
        );
        expect(isRetryableError(new ToolBudgetExceededError(32, 33))).toBe(
          false,
        );
        expect(isRetryableError(new BannedIdentifierError(["eval"]))).toBe(
          false,
        );
        expect(isRetryableError(new ScriptCancelledError())).toBe(false);
      });

      it("should return false for non-harness errors", () => {
        expect(isRetryableError(new Error("Standard error"))).toBe(false);
        expect(isRetryableError("String error")).toBe(false);
        expect(isRetryableError(null)).toBe(false);
      });
    });
  });

  describe("Error Inheritance", () => {
    it("should be instanceof Error", () => {
      const error = new ScriptTimeoutError(30000, 30012, 10, 1);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ScriptHarnessError).toBe(true);
      expect(error instanceof ScriptTimeoutError).toBe(true);
    });

    it("should have correct prototype chain", () => {
      const error = new ToolNotFoundError("bad", ["good"]);

      expect(Object.getPrototypeOf(error)).toBe(ToolNotFoundError.prototype);
      expect(Object.getPrototypeOf(Object.getPrototypeOf(error))).toBe(
        ScriptHarnessError.prototype,
      );
    });
  });

  describe("Error Messages", () => {
    it("should have descriptive messages", () => {
      const timeout = new ScriptTimeoutError(30000, 30012, 10, 1);
      expect(timeout.message).toMatch(/exceed.*30000ms/i);

      const memory = new ScriptMemoryError(96, 105);
      expect(memory.message).toMatch(/exceed.*96MB/i);

      const notFound = new ToolNotFoundError("bad", ["good1", "good2"]);
      expect(notFound.message).toContain("bad");
      expect(notFound.message).toContain("good1");
    });
  });
});
