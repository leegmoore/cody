import { setTimeout as sleep } from "node:timers/promises";

import {
  toolRegistry,
  type RegisteredTool,
} from "codex-ts/src/tools/registry.js";

export type RestoreFn = () => void;

interface ToolRegistryInternal {
  tools: Map<string, RegisteredTool>;
}

type MockToolResult = { content: string; success?: boolean };

const DEFAULT_SLOW_DELAY_MS = 10_000;

export function installMockTools(): RestoreFn {
  const originalTools = toolRegistry.getAll();

  const overrideTool = (mock: RegisteredTool) => {
    toolRegistry.register(mock);
  };

  const createMockTool = (
    name: string,
    execute: (params: unknown) => Promise<MockToolResult>,
  ): RegisteredTool => {
    const existing = toolRegistry.get(name);
    const metadata = existing?.metadata ?? {
      name,
      description: `Mock implementation for ${name}`,
      requiresApproval: false,
    };
    return {
      metadata: {
        ...metadata,
        requiresApproval: false,
      },
      execute,
    } satisfies RegisteredTool;
  };

  overrideTool(
    createMockTool("readFile", async (params: unknown) => {
      const payload = params as { path?: string; filePath?: string };
      const path = payload?.path ?? payload?.filePath ?? "README.md";

      if (path === "nonexistent.txt") {
        return {
          content: "Error: ENOENT - File not found",
          success: false,
        };
      }

      if (path === "__slow_tool__" || path === "slow-tool.txt") {
        await sleep(DEFAULT_SLOW_DELAY_MS);
        return {
          content: `Simulated slow read for ${path}`,
          success: true,
        };
      }

      return {
        content: `# Mock README\n\nPretend content for ${path}`,
        success: true,
      };
    }),
  );

  overrideTool(
    createMockTool("exec", async (params: unknown) => {
      const command = (params as { command?: string })?.command ?? "ls -l";
      if (command === "slowTool") {
        await sleep(DEFAULT_SLOW_DELAY_MS);
      }
      return {
        content: `total 0\nmocked-output-for "${command}"\nmock-file.txt\nmock-dir/`,
        success: true,
      };
    }),
  );

  overrideTool(
    createMockTool("slowTool", async (params: unknown) => {
      const duration =
        typeof (params as { durationMs?: number })?.durationMs === "number"
          ? (params as { durationMs?: number }).durationMs
          : DEFAULT_SLOW_DELAY_MS;
      await sleep(duration);
      return {
        content: `slowTool completed after ${duration}ms`,
        success: true,
      };
    }),
  );

  return () => {
    const internal = toolRegistry as unknown as ToolRegistryInternal;
    internal.tools = new Map(originalTools);
  };
}
