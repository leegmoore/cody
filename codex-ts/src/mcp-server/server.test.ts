import { describe, test, expect } from "vitest";
import { McpServerManager, type McpServerConfig } from "./server";

describe("McpServerManager (stub)", () => {
  test("create manager and add server", () => {
    const manager = new McpServerManager();
    const config: McpServerConfig = {
      name: "test-server",
      transport: {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      },
    };

    manager.addServer(config);
    expect(manager.getServer("test-server")).toEqual(config);
  });

  test("list servers", () => {
    const manager = new McpServerManager();
    const config1: McpServerConfig = {
      name: "server1",
      transport: { type: "stdio", command: "node" },
    };
    const config2: McpServerConfig = {
      name: "server2",
      transport: { type: "streamable-http", url: "http://localhost:3000" },
    };

    manager.addServer(config1);
    manager.addServer(config2);

    const servers = manager.listServers();
    expect(servers).toHaveLength(2);
    expect(servers).toContainEqual(config1);
    expect(servers).toContainEqual(config2);
  });

  test("startServer throws not implemented", async () => {
    const manager = new McpServerManager();
    await expect(manager.startServer("test")).rejects.toThrow(
      "not implemented - deferred to Phase 5",
    );
  });

  test("stopServer throws not implemented", async () => {
    const manager = new McpServerManager();
    await expect(manager.stopServer("test")).rejects.toThrow(
      "not implemented - deferred to Phase 5",
    );
  });

  test("restartServer throws not implemented", async () => {
    const manager = new McpServerManager();
    await expect(manager.restartServer("test")).rejects.toThrow(
      "not implemented - deferred to Phase 5",
    );
  });

  test("sendRequest throws not implemented", async () => {
    const manager = new McpServerManager();
    await expect(manager.sendRequest("test", {})).rejects.toThrow(
      "not implemented - deferred to Phase 5",
    );
  });
});
