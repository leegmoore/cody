/**
 * MCP Server - Process management for MCP servers
 *
 * This module manages MCP server processes (stdio and HTTP transports).
 * Full implementation deferred to Phase 5 when process management is ready.
 *
 * Ported from: codex-rs/mcp-server (binary + library)
 *
 * Phase 5 TODO:
 * - Implement child process spawning and management
 * - Add stdio transport support
 * - Add streamable HTTP transport support
 * - Implement tool handler routing
 * - Add proper error handling and recovery
 * - Implement patch approval workflows
 * - Add MCP protocol message handling
 * - Process lifecycle management (start/stop/restart)
 */

/**
 * MCP server transport configuration
 */
export type McpServerTransportConfig =
  | {
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  | {
      type: "streamable-http";
      url: string;
      bearerToken?: string;
      headers?: Record<string, string>;
    };

/**
 * MCP server configuration
 */
export interface McpServerConfig {
  name: string;
  transport: McpServerTransportConfig;
  disabled?: boolean;
}

/**
 * MCP server process manager
 *
 * STUB: Full implementation deferred to Phase 5
 */
export class McpServerManager {
  private servers: Map<string, McpServerConfig>;

  constructor() {
    this.servers = new Map();
  }

  /**
   * Add a server configuration
   */
  addServer(config: McpServerConfig): void {
    this.servers.set(config.name, config);
  }

  /**
   * Get server configuration
   */
  getServer(name: string): McpServerConfig | undefined {
    return this.servers.get(name);
  }

  /**
   * List all configured servers
   */
  listServers(): McpServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * Start an MCP server process
   *
   * TODO(Phase 5): Implement process spawning
   */
  async startServer(_name: string): Promise<void> {
    throw new Error(
      "McpServerManager.startServer() not implemented - deferred to Phase 5",
    );
  }

  /**
   * Stop an MCP server process
   *
   * TODO(Phase 5): Implement graceful shutdown
   */
  async stopServer(_name: string): Promise<void> {
    throw new Error(
      "McpServerManager.stopServer() not implemented - deferred to Phase 5",
    );
  }

  /**
   * Restart an MCP server process
   *
   * TODO(Phase 5): Implement restart logic
   */
  async restartServer(_name: string): Promise<void> {
    throw new Error(
      "McpServerManager.restartServer() not implemented - deferred to Phase 5",
    );
  }

  /**
   * Send a request to an MCP server
   *
   * TODO(Phase 5): Implement MCP protocol messaging
   */
  async sendRequest(_serverName: string, _request: unknown): Promise<unknown> {
    throw new Error(
      "McpServerManager.sendRequest() not implemented - deferred to Phase 5",
    );
  }
}

/**
 * MCP tool call context
 */
export interface McpToolCallContext {
  serverName: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

/**
 * Execute an MCP tool call
 *
 * TODO(Phase 5): Implement tool execution
 */
export async function executeMcpTool(
  _context: McpToolCallContext,
): Promise<unknown> {
  throw new Error("executeMcpTool() not implemented - deferred to Phase 5");
}
