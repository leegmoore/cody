import { describe, test, expect } from "vitest";
import { computeAuthStatuses, computeAuthStatus } from "./auth";
import type { McpServerConfig } from "../../mcp-server";

describe("MCP Auth (stub)", () => {
  test("computeAuthStatuses returns unsupported for all servers", async () => {
    const servers = new Map<string, McpServerConfig>();
    servers.set("server1", {
      name: "server1",
      transport: { type: "stdio", command: "node" },
    });
    servers.set("server2", {
      name: "server2",
      transport: { type: "streamable-http", url: "http://localhost" },
    });

    const statuses = await computeAuthStatuses(servers);

    expect(statuses.size).toBe(2);
    expect(statuses.get("server1")?.authStatus).toBe("unsupported");
    expect(statuses.get("server2")?.authStatus).toBe("unsupported");
  });

  test("computeAuthStatus returns unsupported", async () => {
    const config: McpServerConfig = {
      name: "test",
      transport: { type: "stdio", command: "node" },
    };

    const status = await computeAuthStatus("test", config);
    expect(status).toBe("unsupported");
  });
});
