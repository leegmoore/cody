/**
 * Tests for script runtime types and interfaces
 *
 * Phase 4.4 - Script Harness: Runtime Types
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCRIPT_LIMITS,
  type ScriptRuntimeAdapter,
  type ScriptExecutionResult,
  type ScriptContext,
  type ScriptExecutionLimits,
} from "./types.js";

describe("Script Runtime Types", () => {
  describe("Default Limits", () => {
    it("should define correct default timeout", () => {
      expect(DEFAULT_SCRIPT_LIMITS.timeoutMs).toBe(30000);
    });

    it("should define correct default memory limit", () => {
      expect(DEFAULT_SCRIPT_LIMITS.memoryMb).toBe(96);
    });

    it("should define correct default stack size", () => {
      expect(DEFAULT_SCRIPT_LIMITS.maxStackBytes).toBe(524288);
    });

    it("should define correct default source size limit", () => {
      expect(DEFAULT_SCRIPT_LIMITS.maxSourceBytes).toBe(20000);
    });

    it("should define correct default return size limit", () => {
      expect(DEFAULT_SCRIPT_LIMITS.maxReturnBytes).toBe(131072);
    });

    it("should define correct default max tool invocations", () => {
      expect(DEFAULT_SCRIPT_LIMITS.maxToolInvocations).toBe(32);
    });

    it("should define correct default max concurrent tool calls", () => {
      expect(DEFAULT_SCRIPT_LIMITS.maxConcurrentToolCalls).toBe(4);
    });
  });

  describe("Type Validation", () => {
    it("should accept valid ScriptExecutionResult", () => {
      const result: ScriptExecutionResult = {
        ok: true,
        returnValue: { message: "success" },
        metadata: {
          duration_ms: 150,
          tool_calls_made: 3,
          memory_used_mb: 12,
        },
      };

      expect(result.ok).toBe(true);
      expect(result.metadata.tool_calls_made).toBe(3);
    });

    it("should accept valid error result", () => {
      const result: ScriptExecutionResult = {
        ok: false,
        error: {
          code: "ScriptTimeoutError",
          message: "Script exceeded 30000ms time limit",
          phase: "executing",
          stack: "Error: timeout\n  at script.ts:15:3",
        },
        metadata: {
          duration_ms: 30012,
          tool_calls_made: 12,
        },
      };

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("ScriptTimeoutError");
    });

    it("should accept valid ScriptContext", () => {
      const context: ScriptContext = {
        conversationId: "conv_123",
        sessionId: "sess_456",
        turnId: "turn_789",
        scriptId: "scr_abc",
        workingDirectory: "/workspace",
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
        sandbox: {
          timeoutMs: 30000,
          memoryMb: 96,
          remainingToolBudget: 32,
          maxConcurrentToolCalls: 4,
          mode: "enabled",
        },
        capabilities: {
          tools: ["applyPatch", "exec", "fileSearch"],
        },
        approvals: {
          required: true,
        },
        telemetry: {
          emitProgress: () => {},
        },
      };

      expect(context.scriptId).toBe("scr_abc");
      expect(context.capabilities.tools).toHaveLength(3);
    });
  });

  describe("Runtime Adapter Interface", () => {
    it("should define required methods", () => {
      // This is a compile-time check - if this compiles, the interface is correct
      const mockAdapter: ScriptRuntimeAdapter = {
        name: "test-runtime",
        async initialize(_config: ScriptExecutionLimits) {},
        async execute(
          _sourceCode: string,
          _globals: Record<string, unknown>,
          _limits: Partial<ScriptExecutionLimits>,
          _signal?: AbortSignal,
        ): Promise<ScriptExecutionResult> {
          return {
            ok: true,
            returnValue: undefined,
            metadata: {
              duration_ms: 0,
              tool_calls_made: 0,
            },
          };
        },
        async dispose() {},
        getStatus() {
          return {
            healthy: true,
            workersActive: 0,
            workersAvailable: 2,
          };
        },
      };

      expect(mockAdapter.name).toBe("test-runtime");
    });
  });
});
