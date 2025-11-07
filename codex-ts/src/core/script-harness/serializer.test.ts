/**
 * Tests for script result serializer
 */

import { describe, it, expect } from "vitest";
import { serializeExecutionResult, type SerializedResult } from "./serializer.js";
import type { ExecutionResult } from "./orchestrator.js";

describe("serializer.ts", () => {
  describe("Basic serialization", () => {
    it("SR1: serializes successful execution", () => {
      const executionResult: ExecutionResult = {
        ok: true,
        scripts: [
          {
            ok: true,
            returnValue: 42,
            sourceCode: "return 42",
            index: 0,
            metadata: {
              duration_ms: 10,
              tool_calls_made: 0,
            },
          },
        ],
        metadata: {
          totalDuration: 15,
          scriptsExecuted: 1,
          scriptsDetected: 1,
        },
      };

      const result = serializeExecutionResult(executionResult);

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].type).toBe("result");
      expect(result.outputs[0].value).toBe(42);
    });

    it("SR2: serializes failed execution", () => {
      const executionResult: ExecutionResult = {
        ok: false,
        scripts: [],
        error: {
          code: "ScriptSyntaxError",
          message: "Invalid syntax",
          phase: "parsing",
        },
        metadata: {
          totalDuration: 5,
          scriptsExecuted: 0,
          scriptsDetected: 1,
        },
      };

      const result = serializeExecutionResult(executionResult);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("ScriptSyntaxError");
    });

    it("SR3: serializes multiple scripts", () => {
      const executionResult: ExecutionResult = {
        ok: true,
        scripts: [
          {
            ok: true,
            returnValue: 10,
            sourceCode: "return 10",
            index: 0,
            metadata: { duration_ms: 5, tool_calls_made: 0 },
          },
          {
            ok: true,
            returnValue: 20,
            sourceCode: "return 20",
            index: 1,
            metadata: { duration_ms: 5, tool_calls_made: 0 },
          },
        ],
        metadata: {
          totalDuration: 15,
          scriptsExecuted: 2,
          scriptsDetected: 2,
        },
      };

      const result = serializeExecutionResult(executionResult);

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(2);
      expect(result.outputs[0].value).toBe(10);
      expect(result.outputs[1].value).toBe(20);
    });
  });

  describe("Error handling", () => {
    it("SR4: serializes script with error", () => {
      const executionResult: ExecutionResult = {
        ok: true,
        scripts: [
          {
            ok: false,
            error: {
              code: "TypeError",
              message: "Cannot read property",
              phase: "executing",
            },
            sourceCode: "throw new Error()",
            index: 0,
            metadata: { duration_ms: 5, tool_calls_made: 0 },
          },
        ],
        metadata: {
          totalDuration: 10,
          scriptsExecuted: 1,
          scriptsDetected: 1,
        },
      };

      const result = serializeExecutionResult(executionResult);

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].type).toBe("error");
      expect(result.outputs[0].error?.code).toBe("TypeError");
    });
  });

  describe("Metadata", () => {
    it("SR5: includes execution metadata", () => {
      const executionResult: ExecutionResult = {
        ok: true,
        scripts: [
          {
            ok: true,
            returnValue: 42,
            sourceCode: "return 42",
            index: 0,
            metadata: { duration_ms: 10, tool_calls_made: 2 },
          },
        ],
        metadata: {
          totalDuration: 15,
          scriptsExecuted: 1,
          scriptsDetected: 1,
        },
      };

      const result = serializeExecutionResult(executionResult);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalDuration).toBe(15);
      expect(result.metadata.scriptsExecuted).toBe(1);
    });
  });
});
