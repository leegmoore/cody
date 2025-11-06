import { describe, test, expect } from "vitest";
import { executeMcpToolCall, type McpToolCall } from "./tool-call";

describe("MCP Tool Call (stub)", () => {
  test("executeMcpToolCall throws not implemented", async () => {
    const call: McpToolCall = {
      serverName: "test-server",
      toolName: "test-tool",
      arguments: { arg1: "value1" },
    };

    await expect(executeMcpToolCall(call)).rejects.toThrow(
      "not implemented - deferred to Phase 5",
    );
  });
});
