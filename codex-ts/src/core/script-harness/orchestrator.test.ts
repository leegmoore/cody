/**
 * Tests for script harness orchestrator
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  Orchestrator,
  type OrchestratorConfig,
  type ExecutionResult,
} from "./orchestrator.js";
import { QuickJSRuntime } from "./runtime/quickjs-runtime.js";
import type { ToolRegistry, ApprovalBridge } from "./tool-facade.js";
import { DEFAULT_SCRIPT_LIMITS } from "./runtime/types.js";

describe("orchestrator.ts", () => {
  let orchestrator: Orchestrator;
  let mockToolRegistry: ToolRegistry;
  let mockApprovalBridge: ApprovalBridge;

  beforeEach(async () => {
    // Simple tool registry
    mockToolRegistry = {
      getTool: (name: string) => {
        if (name === "testTool") {
          return {
            name: "testTool",
            description: "Test tool",
            inputSchema: {},
            requiresApproval: false,
            execute: async (args: unknown) => ({ result: args }),
          };
        }
        return undefined;
      },
      listTools: () => [
        {
          name: "testTool",
          description: "Test tool",
          inputSchema: {},
          requiresApproval: false,
          execute: async (args: unknown) => ({ result: args }),
        },
      ],
    };

    // Simple approval bridge (auto-approve)
    mockApprovalBridge = {
      requestApproval: async () => ({ approved: true }),
      cancelPending: () => {},
    };

    const config: OrchestratorConfig = {
      runtime: new QuickJSRuntime(),
      toolRegistry: mockToolRegistry,
      approvalBridge: mockApprovalBridge,
      limits: DEFAULT_SCRIPT_LIMITS,
      mode: "enabled",
    };

    orchestrator = new Orchestrator(config);
    await orchestrator.initialize();
  });

  describe("Basic orchestration", () => {
    it("OR1: executes simple script without tools", async () => {
      const text = `
Here is a calculation:
<tool-calls>
return 1 + 1
</tool-calls>
Done!
      `;

      const result = await orchestrator.execute(text);

      if (!result.ok) {
        console.log("ERROR:", JSON.stringify(result.error, null, 2));
        console.log("SCRIPTS:", JSON.stringify(result.scripts, null, 2));
      }

      expect(result.ok).toBe(true);
      expect(result.scripts).toHaveLength(1);
      expect(result.scripts[0].returnValue).toBe(2);
    });

    it("OR2: handles text with no scripts", async () => {
      const text = "Just plain text with no scripts";

      const result = await orchestrator.execute(text);

      expect(result.ok).toBe(true);
      expect(result.scripts).toHaveLength(0);
    });

    it("OR3: executes multiple scripts", async () => {
      const text = `
<tool-calls>
return 10
</tool-calls>
Some text
<tool-calls>
return 20
</tool-calls>
      `;

      const result = await orchestrator.execute(text);

      expect(result.ok).toBe(true);
      expect(result.scripts).toHaveLength(2);
      expect(result.scripts[0].returnValue).toBe(10);
      expect(result.scripts[1].returnValue).toBe(20);
    });

    it("OR4: provides execution metadata", async () => {
      const text = "<tool-calls>return 42</tool-calls>";

      const result = await orchestrator.execute(text);

      expect(result.ok).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.metadata.scriptsExecuted).toBe(1);
    });
  });

  describe("Error handling", () => {
    it("OR5: handles syntax errors", async () => {
      const text = "<tool-calls>this is not valid {{{</tool-calls>";

      const result = await orchestrator.execute(text);

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.phase).toBe("parsing");
    });

    it("OR6: handles runtime errors", async () => {
      const text = "<tool-calls>throw new Error('test error')</tool-calls>";

      const result = await orchestrator.execute(text);

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.phase).toBe("executing");
    });

    it("OR7: continues after error when continueOnError=true", async () => {
      const config: OrchestratorConfig = {
        runtime: new QuickJSRuntime(),
        toolRegistry: mockToolRegistry,
        approvalBridge: mockApprovalBridge,
        limits: DEFAULT_SCRIPT_LIMITS,
        mode: "enabled",
        continueOnError: true,
      };

      const orch = new Orchestrator(config);
      await orch.initialize();

      const text = `
<tool-calls>throw new Error('fail')</tool-calls>
<tool-calls>return 42</tool-calls>
      `;

      const result = await orch.execute(text);

      expect(result.ok).toBe(true);
      expect(result.scripts).toHaveLength(2);
      expect(result.scripts[0].ok).toBe(false);
      expect(result.scripts[1].ok).toBe(true);
      expect(result.scripts[1].returnValue).toBe(42);
    });
  });

  describe("Mode handling", () => {
    it("OR8: disabled mode returns empty result", async () => {
      const config: OrchestratorConfig = {
        runtime: new QuickJSRuntime(),
        toolRegistry: mockToolRegistry,
        approvalBridge: mockApprovalBridge,
        limits: DEFAULT_SCRIPT_LIMITS,
        mode: "disabled",
      };

      const orch = new Orchestrator(config);
      await orch.initialize();

      const text = "<tool-calls>return 42</tool-calls>";
      const result = await orch.execute(text);

      expect(result.ok).toBe(true);
      expect(result.scripts).toHaveLength(0);
    });

    it("OR9: dry-run mode detects but doesn't execute", async () => {
      const config: OrchestratorConfig = {
        runtime: new QuickJSRuntime(),
        toolRegistry: mockToolRegistry,
        approvalBridge: mockApprovalBridge,
        limits: DEFAULT_SCRIPT_LIMITS,
        mode: "dry-run",
      };

      const orch = new Orchestrator(config);
      await orch.initialize();

      const text = "<tool-calls>return 42</tool-calls>";
      const result = await orch.execute(text);

      expect(result.ok).toBe(true);
      expect(result.scriptsDetected).toBe(1);
      expect(result.scripts).toHaveLength(0);
    });
  });

  describe("Context injection", () => {
    it("OR10: injects context into script", async () => {
      const text = "<tool-calls>return context.sessionId</tool-calls>";

      const result = await orchestrator.execute(text, {
        contextSeed: { sessionId: "test-123" },
      });

      expect(result.ok).toBe(true);
      expect(result.scripts[0].returnValue).toBe("test-123");
    });
  });

  describe("Lifecycle", () => {
    it("OR11: can dispose and reinitialize", async () => {
      await orchestrator.dispose();
      await orchestrator.initialize();

      const text = "<tool-calls>return 42</tool-calls>";
      const result = await orchestrator.execute(text);

      expect(result.ok).toBe(true);
      expect(result.scripts[0].returnValue).toBe(42);
    });

    it("OR12: errors if not initialized", async () => {
      const fresh = new Orchestrator({
        runtime: new QuickJSRuntime(),
        toolRegistry: mockToolRegistry,
        approvalBridge: mockApprovalBridge,
        limits: DEFAULT_SCRIPT_LIMITS,
        mode: "enabled",
      });

      const text = "<tool-calls>return 42</tool-calls>";

      await expect(fresh.execute(text)).rejects.toThrow();
    });
  });
});
