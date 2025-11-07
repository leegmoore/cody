/**
 * Tests for tool facade
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createToolsProxy,
  SimpleToolRegistry,
  SimpleApprovalBridge,
  type ToolDefinition,
  type ToolFacadeConfig,
} from "./tool-facade.js";
import { PromiseTracker } from "./runtime/promise-tracker.js";
import {
  ToolNotFoundError,
  ToolValidationError,
  ToolBudgetExceededError,
  ConcurrencyLimitError,
  ApprovalDeniedError,
  ToolExecutionError,
} from "./errors.js";

describe("tool-facade.ts", () => {
  let registry: SimpleToolRegistry;
  let tracker: PromiseTracker;
  let approvalBridge: SimpleApprovalBridge;

  beforeEach(() => {
    registry = new SimpleToolRegistry();
    tracker = new PromiseTracker(
      { maxToolInvocations: 32, maxConcurrentToolCalls: 4 },
      "scr_test",
    );
    approvalBridge = new SimpleApprovalBridge(true); // Auto-approve
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create valid config
  const createConfig = (
    overrides?: Partial<ToolFacadeConfig>,
  ): ToolFacadeConfig => ({
    allowedTools: ["test_tool", "another_tool"],
    maxToolInvocations: 32,
    maxConcurrentToolCalls: 4,
    scriptId: "scr_test",
    mode: "enabled",
    ...overrides,
  });

  // Helper to create a simple tool
  const createTool = (name: string, overrides?: Partial<ToolDefinition>) => {
    return {
      name,
      execute: vi.fn(async (args: any) => ({ result: `${name} executed`, args })),
      ...overrides,
    } as ToolDefinition;
  };

  describe("Basic proxy creation", () => {
    it("TF1: creates immutable proxy object", () => {
      const tools = createToolsProxy(registry, tracker, createConfig());
      // In strict mode, setting properties throws (trap returns false)
      expect(() => {
        "use strict";
        // @ts-expect-error - Testing runtime behavior
        tools.newProp = "test";
      }).toThrow(TypeError);
    });

    it("TF2: exposes allowed tools", () => {
      registry.register(createTool("test_tool"));
      registry.register(createTool("another_tool"));

      const tools = createToolsProxy(registry, tracker, createConfig());

      expect(typeof tools.test_tool).toBe("function");
      expect(typeof tools.another_tool).toBe("function");
    });

    it("TF3: does not expose non-allowed tools", () => {
      registry.register(createTool("test_tool"));
      registry.register(createTool("forbidden_tool"));

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ allowedTools: ["test_tool"] }),
      );

      expect(typeof tools.test_tool).toBe("function");
      expect(() => tools.forbidden_tool).toThrow(ToolNotFoundError);
    });

    it("TF4: prevents setting properties", () => {
      const tools = createToolsProxy(registry, tracker, createConfig());

      expect(() => {
        "use strict";
        // @ts-expect-error - Testing runtime behavior
        tools.newTool = () => {};
      }).toThrow(TypeError);
    });

    it("TF5: prevents deleting properties", () => {
      registry.register(createTool("test_tool"));
      const tools = createToolsProxy(registry, tracker, createConfig());

      expect(() => {
        "use strict";
        // @ts-expect-error - Testing runtime behavior
        delete tools.test_tool;
      }).toThrow(TypeError);
    });

    it("TF6: tool names accessible via dot notation", () => {
      registry.register(createTool("test_tool"));
      registry.register(createTool("another_tool"));

      const tools = createToolsProxy(registry, tracker, createConfig());

      // Can access tools via property access
      expect(typeof tools.test_tool).toBe("function");
      expect(typeof tools.another_tool).toBe("function");
    });
  });

  describe("Tool execution", () => {
    it("TF7: executes tool and returns result", async () => {
      const tool = createTool("test_tool");
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());
      const result = await tools.test_tool({ input: "test" });

      expect(tool.execute).toHaveBeenCalledWith(
        { input: "test" },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(result).toEqual({
        result: "test_tool executed",
        args: { input: "test" },
      });
    });

    it("TF8: freezes result before returning", async () => {
      const tool = createTool("test_tool", {
        execute: vi.fn(async () => ({ data: "mutable" })),
      });
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());
      const result = await tools.test_tool({});

      expect(Object.isFrozen(result)).toBe(true);
    });

    it("TF9: passes AbortSignal to tool", async () => {
      const tool = createTool("test_tool");
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());
      await tools.test_tool({});

      expect(tool.execute).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("TF10: registers promise with tracker", async () => {
      const tool = createTool("test_tool");
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());
      const promise = tools.test_tool({});

      // Promise should be tracked
      const status = tracker.getStatus();
      expect(status.pending).toBe(1);

      await promise;

      // After completion, should be completed
      const completed = tracker.getCompletedResults();
      expect(completed.length).toBe(1);
    });

    it("TF11: executes multiple tools sequentially", async () => {
      registry.register(createTool("tool1"));
      registry.register(createTool("tool2"));

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ allowedTools: ["tool1", "tool2"] }),
      );

      const result1 = await tools.tool1({ a: 1 });
      const result2 = await tools.tool2({ b: 2 });

      expect(result1).toMatchObject({ result: "tool1 executed" });
      expect(result2).toMatchObject({ result: "tool2 executed" });
    });

    it("TF12: executes tools concurrently", async () => {
      const tool1 = createTool("tool1", {
        execute: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { result: "tool1" };
        }),
      });
      const tool2 = createTool("tool2", {
        execute: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { result: "tool2" };
        }),
      });

      registry.register(tool1);
      registry.register(tool2);

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ allowedTools: ["tool1", "tool2"] }),
      );

      // Start both concurrently
      const [result1, result2] = await Promise.all([
        tools.tool1({}),
        tools.tool2({}),
      ]);

      expect(result1).toMatchObject({ result: "tool1" });
      expect(result2).toMatchObject({ result: "tool2" });
    });
  });

  describe("Error handling", () => {
    it("TF13: throws ToolNotFoundError for non-existent tool", () => {
      const tools = createToolsProxy(registry, tracker, createConfig());

      expect(() => tools.nonexistent_tool).toThrow(ToolNotFoundError);
      expect(() => tools.nonexistent_tool).toThrow("Tool not found: nonexistent_tool");
    });

    it("TF14: throws ToolNotFoundError for tool not in registry", () => {
      // Tool allowed but not registered
      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ allowedTools: ["missing_tool"] }),
      );

      expect(() => tools.missing_tool).toThrow(ToolNotFoundError);
    });

    it("TF15: propagates tool execution errors", async () => {
      const tool = createTool("test_tool", {
        execute: vi.fn(async () => {
          throw new Error("Tool execution failed");
        }),
      });
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());

      await expect(tools.test_tool({})).rejects.toThrow("Tool execution failed");
    });
  });

  describe("Argument validation", () => {
    it("TF16: validates arguments with schema", async () => {
      const tool = createTool("test_tool", {
        validateArgs: (args: any) => {
          if (!args || typeof args.required !== "string") {
            return { valid: false, errors: ["Missing required field"] };
          }
          return { valid: true };
        },
      });
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());

      await expect(tools.test_tool({})).rejects.toThrow(ToolValidationError);
      await expect(tools.test_tool({})).rejects.toThrow("Missing required field");
    });

    it("TF17: accepts valid arguments", async () => {
      const tool = createTool("test_tool", {
        validateArgs: (args: any) => {
          if (args && typeof args.value === "number") {
            return { valid: true };
          }
          return { valid: false, errors: ["value must be number"] };
        },
      });
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());

      const result = await tools.test_tool({ value: 42 });
      expect(result).toBeDefined();
    });

    it("TF18: skips validation if not provided", async () => {
      const tool = createTool("test_tool");
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());

      // Should accept any args without validation
      const result = await tools.test_tool({ anything: "goes" });
      expect(result).toBeDefined();
    });
  });

  describe("Budget enforcement", () => {
    it("TF19: enforces total tool invocation limit", async () => {
      const tool = createTool("test_tool");
      registry.register(tool);

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ maxToolInvocations: 3 }),
      );

      // First 3 calls succeed
      await tools.test_tool({});
      await tools.test_tool({});
      await tools.test_tool({});

      // 4th call exceeds budget
      await expect(tools.test_tool({})).rejects.toThrow(ToolBudgetExceededError);
    });

    it("TF20: enforces concurrency limit", async () => {
      vi.useFakeTimers();

      const tool = createTool("test_tool", {
        execute: vi.fn(
          async () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ result: "done" }), 1000);
            }),
        ),
      });
      registry.register(tool);

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ maxConcurrentToolCalls: 2 }),
      );

      // Start 2 concurrent calls (at limit)
      const p1 = tools.test_tool({ id: 1 });
      const p2 = tools.test_tool({ id: 2 });

      // 3rd concurrent call should fail
      await expect(tools.test_tool({ id: 3 })).rejects.toThrow(
        ConcurrencyLimitError,
      );

      // Complete first two
      vi.advanceTimersByTime(1000);
      await p1;
      await p2;

      // Now we can make another call
      const p3 = tools.test_tool({ id: 3 });
      vi.advanceTimersByTime(1000);
      await p3;
    });

    it("TF21: tracks statistics correctly", async () => {
      const tool = createTool("test_tool");
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());

      await tools.test_tool({});
      await tools.test_tool({});

      // @ts-expect-error - Accessing internal stats
      const stats = tools.__stats;
      expect(stats.totalCalls).toBe(2);
      expect(stats.callsByTool.test_tool).toBe(2);
    });

    it("TF22: decrements active count after completion", async () => {
      const tool = createTool("test_tool");
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());

      // @ts-expect-error - Accessing internal stats
      expect(tools.__stats.activeCalls).toBe(0);

      const promise = tools.test_tool({});

      // Active count increases during execution
      // (might be 0 or 1 depending on timing - just check it completes)

      await promise;

      // @ts-expect-error - Accessing internal stats
      expect(tools.__stats.activeCalls).toBe(0);
    });
  });

  describe("Approval integration", () => {
    it("TF23: requests approval when tool requires it", async () => {
      const tool = createTool("test_tool", {
        requiresApproval: () => true,
      });
      registry.register(tool);

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig(),
        approvalBridge,
      );

      await tools.test_tool({ data: "test" });

      const requests = approvalBridge.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].toolName).toBe("test_tool");
      expect(requests[0].args).toEqual({ data: "test" });
    });

    it("TF24: throws ApprovalDeniedError when approval denied", async () => {
      const tool = createTool("test_tool", {
        requiresApproval: () => true,
      });
      registry.register(tool);

      approvalBridge.setAutoApprove(false); // Deny approval

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig(),
        approvalBridge,
      );

      await expect(tools.test_tool({})).rejects.toThrow(ApprovalDeniedError);
    });

    it("TF25: skips approval when not required", async () => {
      const tool = createTool("test_tool", {
        requiresApproval: () => false,
      });
      registry.register(tool);

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig(),
        approvalBridge,
      );

      await tools.test_tool({});

      expect(approvalBridge.getRequests()).toHaveLength(0);
    });

    it("TF26: skips approval when bridge not provided", async () => {
      const tool = createTool("test_tool", {
        requiresApproval: () => true,
      });
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());

      // Should execute without approval
      const result = await tools.test_tool({});
      expect(result).toBeDefined();
    });

    it("TF27: conditional approval based on args", async () => {
      const tool = createTool("test_tool", {
        requiresApproval: (args: any) => args.dangerous === true,
      });
      registry.register(tool);

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig(),
        approvalBridge,
      );

      // Safe call - no approval
      await tools.test_tool({ dangerous: false });
      expect(approvalBridge.getRequests()).toHaveLength(0);

      // Dangerous call - requires approval
      await tools.test_tool({ dangerous: true });
      expect(approvalBridge.getRequests()).toHaveLength(1);
    });
  });

  describe("Execution modes", () => {
    it("TF28: disabled mode throws ToolExecutionError", async () => {
      const tool = createTool("test_tool");
      registry.register(tool);

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ mode: "disabled" }),
      );

      await expect(tools.test_tool({})).rejects.toThrow(ToolExecutionError);
      await expect(tools.test_tool({})).rejects.toThrow(
        "Script tool harness is disabled",
      );
    });

    it("TF29: dry-run mode returns mock result", async () => {
      const tool = createTool("test_tool");
      registry.register(tool);

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ mode: "dry-run" }),
      );

      const result = await tools.test_tool({ data: "test" });

      expect(result).toMatchObject({
        __dryRun: true,
        toolName: "test_tool",
        args: { data: "test" },
        message: expect.stringContaining("Dry-run"),
      });

      // Tool should not be executed
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it("TF30: enabled mode executes normally", async () => {
      const tool = createTool("test_tool");
      registry.register(tool);

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ mode: "enabled" }),
      );

      await tools.test_tool({});

      expect(tool.execute).toHaveBeenCalled();
    });
  });

  describe("SimpleToolRegistry", () => {
    it("TF31: registers and retrieves tools", () => {
      const registry = new SimpleToolRegistry();
      const tool = createTool("test_tool");

      registry.register(tool);

      expect(registry.has("test_tool")).toBe(true);
      expect(registry.get("test_tool")).toBe(tool);
    });

    it("TF32: lists all tools", () => {
      const registry = new SimpleToolRegistry();
      registry.register(createTool("tool1"));
      registry.register(createTool("tool2"));

      const tools = registry.list();
      expect(tools).toEqual(expect.arrayContaining(["tool1", "tool2"]));
    });

    it("TF33: clears all tools", () => {
      const registry = new SimpleToolRegistry();
      registry.register(createTool("tool1"));
      registry.register(createTool("tool2"));

      registry.clear();

      expect(registry.list()).toHaveLength(0);
    });
  });

  describe("SimpleApprovalBridge", () => {
    it("TF34: auto-approves when configured", async () => {
      const bridge = new SimpleApprovalBridge(true);

      const approved = await bridge.requestApproval({
        toolName: "test",
        args: {},
        scriptId: "scr_1",
        toolCallId: "tc_1",
      });

      expect(approved).toBe(true);
    });

    it("TF35: auto-denies when configured", async () => {
      const bridge = new SimpleApprovalBridge(false);

      const approved = await bridge.requestApproval({
        toolName: "test",
        args: {},
        scriptId: "scr_1",
        toolCallId: "tc_1",
      });

      expect(approved).toBe(false);
    });

    it("TF36: records approval requests", async () => {
      const bridge = new SimpleApprovalBridge();

      await bridge.requestApproval({
        toolName: "test1",
        args: { a: 1 },
        scriptId: "scr_1",
        toolCallId: "tc_1",
      });

      await bridge.requestApproval({
        toolName: "test2",
        args: { b: 2 },
        scriptId: "scr_1",
        toolCallId: "tc_2",
      });

      const requests = bridge.getRequests();
      expect(requests).toHaveLength(2);
      expect(requests[0].toolName).toBe("test1");
      expect(requests[1].toolName).toBe("test2");
    });

    it("TF37: clears approval history", async () => {
      const bridge = new SimpleApprovalBridge();

      await bridge.requestApproval({
        toolName: "test",
        args: {},
        scriptId: "scr_1",
        toolCallId: "tc_1",
      });

      bridge.clear();

      expect(bridge.getRequests()).toHaveLength(0);
    });
  });

  describe("Integration scenarios", () => {
    it("TF38: complete workflow with multiple tools", async () => {
      registry.register(createTool("read_file"));
      registry.register(createTool("write_file", { requiresApproval: () => true }));

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ allowedTools: ["read_file", "write_file"] }),
        approvalBridge,
      );

      // Read doesn't need approval
      await tools.read_file({ path: "/file.txt" });

      // Write needs approval (auto-approved)
      await tools.write_file({ path: "/output.txt", content: "data" });

      expect(approvalBridge.getRequests()).toHaveLength(1);
      expect(approvalBridge.getRequests()[0].toolName).toBe("write_file");
    });

    it("TF39: handles tool errors gracefully", async () => {
      const tool = createTool("test_tool", {
        execute: vi.fn(async () => {
          throw new Error("Network timeout");
        }),
      });
      registry.register(tool);

      const tools = createToolsProxy(registry, tracker, createConfig());

      await expect(tools.test_tool({})).rejects.toThrow("Network timeout");

      // Error should be tracked - promise completed (failed)
      const status = tracker.getStatus();
      expect(status.pending).toBe(0); // No longer pending
    });

    it("TF40: validates tool access patterns", async () => {
      registry.register(createTool("allowed_tool"));
      registry.register(createTool("forbidden_tool"));

      const tools = createToolsProxy(
        registry,
        tracker,
        createConfig({ allowedTools: ["allowed_tool"] }),
      );

      // Allowed tool works
      await expect(tools.allowed_tool({})).resolves.toBeDefined();

      // Forbidden tool throws
      expect(() => tools.forbidden_tool).toThrow(ToolNotFoundError);
    });
  });
});
