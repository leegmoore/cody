import { describe, test, expect } from "vitest";
import { McpConnectionManager, ConnectionState } from "./connection-manager";
import type { McpServerConfig } from "../../mcp-server";

describe("McpConnectionManager (stub)", () => {
  test("create manager", () => {
    const manager = new McpConnectionManager();
    expect(manager.listConnections()).toHaveLength(0);
  });

  test("isConnected returns false for unknown server", () => {
    const manager = new McpConnectionManager();
    expect(manager.isConnected("unknown")).toBe(false);
  });

  test("connect throws not implemented", async () => {
    const manager = new McpConnectionManager();
    const config: McpServerConfig = {
      name: "test",
      transport: { type: "stdio", command: "node" },
    };

    await expect(manager.connect(config)).rejects.toThrow(
      "not implemented - deferred to Phase 5",
    );
  });

  test("disconnect throws not implemented", async () => {
    const manager = new McpConnectionManager();
    await expect(manager.disconnect("test")).rejects.toThrow(
      "not implemented - deferred to Phase 5",
    );
  });
});
