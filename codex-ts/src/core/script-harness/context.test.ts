/**
 * Tests for context factory
 */

import { describe, it, expect, vi } from "vitest";
import {
  createScriptContext,
  isContextFrozen,
  createTestContext,
  type ContextSeed,
  type CreateContextOptions,
} from "./context.js";
import type { ScriptContext } from "./runtime/types.js";

describe("context.ts", () => {
  // Helper to create valid seed
  const createValidSeed = (): ContextSeed => ({
    conversationId: "conv_abc123",
    sessionId: "sess_def456",
    turnId: "turn_ghi789",
    workingDirectory: "/workspace/project",
    provider: "anthropic",
    model: "claude-3-5-sonnet-20250219",
    availableTools: ["read_file", "write_file", "run_command"],
    approvalsRequired: true,
    mode: "enabled",
    lastApprovalRequestId: "apr_xyz",
  });

  // Helper to create valid options
  const createValidOptions = (): CreateContextOptions => ({
    scriptId: "scr_test123",
    limits: { timeoutMs: 15000, memoryMb: 64, maxConcurrentToolCalls: 2 },
    remainingToolBudget: 20,
  });

  describe("Basic context creation", () => {
    it("C1: creates context with all required fields", () => {
      const seed = createValidSeed();
      const options = createValidOptions();

      const context = createScriptContext(seed, options);

      // Identity
      expect(context.conversationId).toBe("conv_abc123");
      expect(context.sessionId).toBe("sess_def456");
      expect(context.turnId).toBe("turn_ghi789");
      expect(context.scriptId).toBe("scr_test123");

      // Environment
      expect(context.workingDirectory).toBe("/workspace/project");
      expect(context.provider).toBe("anthropic");
      expect(context.model).toBe("claude-3-5-sonnet-20250219");

      // Sandbox
      expect(context.sandbox.timeoutMs).toBe(15000);
      expect(context.sandbox.memoryMb).toBe(64);
      expect(context.sandbox.remainingToolBudget).toBe(20);
      expect(context.sandbox.maxConcurrentToolCalls).toBe(2);
      expect(context.sandbox.mode).toBe("enabled");

      // Capabilities
      expect(context.capabilities.tools).toEqual([
        "read_file",
        "write_file",
        "run_command",
      ]);

      // Approvals
      expect(context.approvals.required).toBe(true);
      expect(context.approvals.lastRequestId).toBe("apr_xyz");

      // Telemetry
      expect(typeof context.telemetry.emitProgress).toBe("function");
    });

    it("C2: merges limits with defaults", () => {
      const seed = createValidSeed();
      const options: CreateContextOptions = {
        scriptId: "scr_test",
        limits: { timeoutMs: 5000 }, // Only override timeout
        remainingToolBudget: 10,
      };

      const context = createScriptContext(seed, options);

      expect(context.sandbox.timeoutMs).toBe(5000); // Overridden
      expect(context.sandbox.memoryMb).toBe(96); // Default
      expect(context.sandbox.maxConcurrentToolCalls).toBe(4); // Default
    });

    it("C3: uses all defaults when limits not specified", () => {
      const seed = createValidSeed();
      const options: CreateContextOptions = {
        scriptId: "scr_test",
        limits: {},
        remainingToolBudget: 32,
      };

      const context = createScriptContext(seed, options);

      expect(context.sandbox.timeoutMs).toBe(30000);
      expect(context.sandbox.memoryMb).toBe(96);
      expect(context.sandbox.maxConcurrentToolCalls).toBe(4);
    });

    it("C4: clones availableTools array (not shared)", () => {
      const seed = createValidSeed();
      const options = createValidOptions();

      const context = createScriptContext(seed, options);

      expect(context.capabilities.tools).toEqual(seed.availableTools);
      expect(context.capabilities.tools).not.toBe(seed.availableTools); // Different array
    });

    it("C5: handles optional lastApprovalRequestId", () => {
      const seed = createValidSeed();
      delete seed.lastApprovalRequestId;
      const options = createValidOptions();

      const context = createScriptContext(seed, options);

      expect(context.approvals.lastRequestId).toBeUndefined();
    });
  });

  describe("Context freezing", () => {
    it("C6: context object is frozen", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());
      expect(Object.isFrozen(context)).toBe(true);
    });

    it("C7: nested sandbox object is frozen", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());
      expect(Object.isFrozen(context.sandbox)).toBe(true);
    });

    it("C8: nested capabilities object is frozen", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());
      expect(Object.isFrozen(context.capabilities)).toBe(true);
    });

    it("C9: tools array is frozen", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());
      expect(Object.isFrozen(context.capabilities.tools)).toBe(true);
    });

    it("C10: nested approvals object is frozen", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());
      expect(Object.isFrozen(context.approvals)).toBe(true);
    });

    it("C11: nested telemetry object is frozen", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());
      expect(Object.isFrozen(context.telemetry)).toBe(true);
    });

    it("C12: isContextFrozen returns true for frozen context", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());
      expect(isContextFrozen(context)).toBe(true);
    });

    it("C13: attempting to modify context throws in strict mode", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());

      expect(() => {
        "use strict";
        // @ts-expect-error - Testing runtime behavior
        context.conversationId = "new_id";
      }).toThrow(TypeError);
    });

    it("C14: attempting to modify nested objects throws in strict mode", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());

      expect(() => {
        "use strict";
        // @ts-expect-error - Testing runtime behavior
        context.sandbox.timeoutMs = 999;
      }).toThrow(TypeError);
    });

    it("C15: attempting to modify tools array throws in strict mode", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());

      expect(() => {
        "use strict";
        // @ts-expect-error - Testing runtime behavior
        context.capabilities.tools.push("new_tool");
      }).toThrow(TypeError);
    });
  });

  describe("Progress emitter", () => {
    it("C16: emitProgress calls callback with message", () => {
      const onProgress = vi.fn();
      const context = createScriptContext(createValidSeed(), {
        ...createValidOptions(),
        onProgress,
      });

      context.telemetry.emitProgress("Test message");

      expect(onProgress).toHaveBeenCalledWith("Test message", "info");
    });

    it("C17: emitProgress supports warn kind", () => {
      const onProgress = vi.fn();
      const context = createScriptContext(createValidSeed(), {
        ...createValidOptions(),
        onProgress,
      });

      context.telemetry.emitProgress("Warning message", "warn");

      expect(onProgress).toHaveBeenCalledWith("Warning message", "warn");
    });

    it("C18: emitProgress truncates long messages (>1000 chars)", () => {
      const onProgress = vi.fn();
      const context = createScriptContext(createValidSeed(), {
        ...createValidOptions(),
        onProgress,
      });

      const longMessage = "x".repeat(1500);
      context.telemetry.emitProgress(longMessage);

      expect(onProgress).toHaveBeenCalledWith("x".repeat(1000) + "...", "info");
    });

    it("C19: emitProgress throws on non-string message", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());

      expect(() => {
        // @ts-expect-error - Testing runtime behavior
        context.telemetry.emitProgress(123);
      }).toThrow(TypeError);

      expect(() => {
        // @ts-expect-error - Testing runtime behavior
        context.telemetry.emitProgress(null);
      }).toThrow(TypeError);
    });

    it("C20: emitProgress rate limits (500ms minimum interval)", () => {
      vi.useFakeTimers();
      const onProgress = vi.fn();
      const context = createScriptContext(createValidSeed(), {
        ...createValidOptions(),
        onProgress,
      });

      // First call goes through
      context.telemetry.emitProgress("Message 1");
      expect(onProgress).toHaveBeenCalledTimes(1);

      // Immediate second call is rate limited
      context.telemetry.emitProgress("Message 2");
      expect(onProgress).toHaveBeenCalledTimes(1); // Still 1

      // Advance time by 500ms
      vi.advanceTimersByTime(500);

      // Now third call goes through
      context.telemetry.emitProgress("Message 3");
      expect(onProgress).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("C21: emitProgress max events limit (50 events)", () => {
      vi.useFakeTimers();
      const onProgress = vi.fn();
      const context = createScriptContext(createValidSeed(), {
        ...createValidOptions(),
        onProgress,
      });

      // Emit 51 events with proper timing
      for (let i = 0; i < 51; i++) {
        context.telemetry.emitProgress(`Message ${i}`);
        vi.advanceTimersByTime(500); // Respect rate limit
      }

      // Should only have called 50 times (max limit)
      expect(onProgress).toHaveBeenCalledTimes(50);

      vi.useRealTimers();
    });

    it("C22: emitProgress handles callback errors gracefully", () => {
      const onProgress = vi.fn(() => {
        throw new Error("Callback error");
      });
      const context = createScriptContext(createValidSeed(), {
        ...createValidOptions(),
        onProgress,
      });

      // Should not throw
      expect(() => {
        context.telemetry.emitProgress("Test");
      }).not.toThrow();
    });

    it("C23: emitProgress works without callback", () => {
      const context = createScriptContext(createValidSeed(), createValidOptions());

      // Should not throw
      expect(() => {
        context.telemetry.emitProgress("Test");
      }).not.toThrow();
    });

    it("C24: emitProgress is still callable after freezing", () => {
      const onProgress = vi.fn();
      const context = createScriptContext(createValidSeed(), {
        ...createValidOptions(),
        onProgress,
      });

      expect(Object.isFrozen(context)).toBe(true);
      context.telemetry.emitProgress("After freeze");
      expect(onProgress).toHaveBeenCalledWith("After freeze", "info");
    });
  });

  describe("Seed validation", () => {
    it("C25: throws on missing conversationId", () => {
      const seed = createValidSeed();
      // @ts-expect-error - Testing validation
      seed.conversationId = "";
      const options = createValidOptions();

      expect(() => createScriptContext(seed, options)).toThrow(
        "conversationId must be a non-empty string",
      );
    });

    it("C26: throws on missing sessionId", () => {
      const seed = createValidSeed();
      // @ts-expect-error - Testing validation
      seed.sessionId = "";
      const options = createValidOptions();

      expect(() => createScriptContext(seed, options)).toThrow(
        "sessionId must be a non-empty string",
      );
    });

    it("C27: throws on missing turnId", () => {
      const seed = createValidSeed();
      // @ts-expect-error - Testing validation
      seed.turnId = null;
      const options = createValidOptions();

      expect(() => createScriptContext(seed, options)).toThrow(
        "turnId must be a non-empty string",
      );
    });

    it("C28: throws on missing workingDirectory", () => {
      const seed = createValidSeed();
      // @ts-expect-error - Testing validation
      delete seed.workingDirectory;
      const options = createValidOptions();

      expect(() => createScriptContext(seed, options)).toThrow(
        "workingDirectory must be a non-empty string",
      );
    });

    it("C29: throws on missing provider", () => {
      const seed = createValidSeed();
      // @ts-expect-error - Testing validation
      seed.provider = "";
      const options = createValidOptions();

      expect(() => createScriptContext(seed, options)).toThrow(
        "provider must be a non-empty string",
      );
    });

    it("C30: throws on missing model", () => {
      const seed = createValidSeed();
      // @ts-expect-error - Testing validation
      seed.model = undefined;
      const options = createValidOptions();

      expect(() => createScriptContext(seed, options)).toThrow(
        "model must be a non-empty string",
      );
    });

    it("C31: throws on invalid availableTools (not array)", () => {
      const seed = createValidSeed();
      // @ts-expect-error - Testing validation
      seed.availableTools = "not an array";
      const options = createValidOptions();

      expect(() => createScriptContext(seed, options)).toThrow(
        "availableTools must be an array",
      );
    });

    it("C32: throws on invalid approvalsRequired (not boolean)", () => {
      const seed = createValidSeed();
      // @ts-expect-error - Testing validation
      seed.approvalsRequired = "true";
      const options = createValidOptions();

      expect(() => createScriptContext(seed, options)).toThrow(
        "approvalsRequired must be a boolean",
      );
    });

    it("C33: throws on invalid mode", () => {
      const seed = createValidSeed();
      // @ts-expect-error - Testing validation
      seed.mode = "invalid";
      const options = createValidOptions();

      expect(() => createScriptContext(seed, options)).toThrow(
        'mode must be "disabled", "dry-run", or "enabled"',
      );
    });
  });

  describe("Options validation", () => {
    it("C34: throws on missing scriptId", () => {
      const seed = createValidSeed();
      const options = createValidOptions();
      // @ts-expect-error - Testing validation
      options.scriptId = "";

      expect(() => createScriptContext(seed, options)).toThrow(
        "scriptId must be a non-empty string",
      );
    });

    it("C35: throws on invalid remainingToolBudget (negative)", () => {
      const seed = createValidSeed();
      const options = createValidOptions();
      options.remainingToolBudget = -5;

      expect(() => createScriptContext(seed, options)).toThrow(
        "remainingToolBudget must be a non-negative number",
      );
    });

    it("C36: throws on invalid remainingToolBudget (not number)", () => {
      const seed = createValidSeed();
      const options = createValidOptions();
      // @ts-expect-error - Testing validation
      options.remainingToolBudget = "10";

      expect(() => createScriptContext(seed, options)).toThrow(
        "remainingToolBudget must be a non-negative number",
      );
    });

    it("C37: allows zero remainingToolBudget", () => {
      const seed = createValidSeed();
      const options = createValidOptions();
      options.remainingToolBudget = 0;

      const context = createScriptContext(seed, options);
      expect(context.sandbox.remainingToolBudget).toBe(0);
    });
  });

  describe("Test helpers", () => {
    it("C38: createTestContext creates valid frozen context", () => {
      const context = createTestContext();

      expect(context.conversationId).toBe("conv_test");
      expect(context.sessionId).toBe("sess_test");
      expect(context.scriptId).toBe("scr_test");
      expect(Object.isFrozen(context)).toBe(true);
    });

    it("C39: createTestContext accepts overrides", () => {
      const context = createTestContext({
        conversationId: "conv_custom",
        provider: "openai",
        model: "gpt-4",
        availableTools: ["custom_tool"],
      });

      expect(context.conversationId).toBe("conv_custom");
      expect(context.provider).toBe("openai");
      expect(context.model).toBe("gpt-4");
      expect(context.capabilities.tools).toEqual(["custom_tool"]);
    });

    it("C40: createTestContext with custom limits", () => {
      const context = createTestContext({
        limits: { timeoutMs: 10000, memoryMb: 128 },
        remainingToolBudget: 50,
      });

      expect(context.sandbox.timeoutMs).toBe(10000);
      expect(context.sandbox.memoryMb).toBe(128);
      expect(context.sandbox.remainingToolBudget).toBe(50);
    });

    it("C41: createTestContext with onProgress callback", () => {
      const onProgress = vi.fn();
      const context = createTestContext({ onProgress });

      context.telemetry.emitProgress("Test from helper");
      expect(onProgress).toHaveBeenCalledWith("Test from helper", "info");
    });
  });

  describe("Integration scenarios", () => {
    it("C42: context can be used in strict mode script", () => {
      const context = createTestContext();

      // Simulate strict mode script
      const script = () => {
        "use strict";
        // Read properties - OK
        const id = context.conversationId;
        const tools = context.capabilities.tools;
        expect(id).toBe("conv_test");
        expect(tools).toEqual(["test_tool"]);

        // Try to modify - should throw
        expect(() => {
          // @ts-expect-error - Testing runtime
          context.conversationId = "new";
        }).toThrow(TypeError);
      };

      script();
    });

    it("C43: multiple contexts are independent", () => {
      const onProgress1 = vi.fn();
      const onProgress2 = vi.fn();

      const ctx1 = createTestContext({ scriptId: "scr_1", onProgress: onProgress1 });
      const ctx2 = createTestContext({ scriptId: "scr_2", onProgress: onProgress2 });

      ctx1.telemetry.emitProgress("From ctx1");
      ctx2.telemetry.emitProgress("From ctx2");

      expect(onProgress1).toHaveBeenCalledWith("From ctx1", "info");
      expect(onProgress2).toHaveBeenCalledWith("From ctx2", "info");
      expect(onProgress1).not.toHaveBeenCalledWith("From ctx2", "info");
    });

    it("C44: context with all modes (disabled, dry-run, enabled)", () => {
      const ctx1 = createTestContext({ mode: "disabled" });
      const ctx2 = createTestContext({ mode: "dry-run" });
      const ctx3 = createTestContext({ mode: "enabled" });

      expect(ctx1.sandbox.mode).toBe("disabled");
      expect(ctx2.sandbox.mode).toBe("dry-run");
      expect(ctx3.sandbox.mode).toBe("enabled");
    });

    it("C45: context preserves all approval information", () => {
      const context = createTestContext({
        approvalsRequired: true,
        lastApprovalRequestId: "apr_previous_123",
      });

      expect(context.approvals.required).toBe(true);
      expect(context.approvals.lastRequestId).toBe("apr_previous_123");
    });
  });
});
