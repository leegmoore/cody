/**
 * MCP Connection Manager - STUB IMPLEMENTATION
 *
 * This module manages connections to MCP servers.
 * Full implementation deferred to Phase 5.
 *
 * Ported from: codex-rs/core/src/mcp_connection_manager.rs (~800 LOC)
 *
 * Phase 5 TODO:
 * - Implement connection pooling
 * - Add connection lifecycle management
 * - Implement reconnection logic
 * - Add health checking
 * - Integrate with McpServerManager
 */

import type { McpServerConfig } from "../../mcp-server";

/**
 * Connection state
 */
export enum ConnectionState {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
  Failed = "failed",
}

/**
 * MCP connection info
 */
export interface McpConnection {
  serverName: string;
  state: ConnectionState;
  lastError?: string;
}

/**
 * MCP connection manager
 *
 * STUB: Full implementation deferred to Phase 5
 */
export class McpConnectionManager {
  private connections: Map<string, McpConnection>;

  constructor() {
    this.connections = new Map();
  }

  /**
   * Connect to an MCP server
   *
   * TODO(Phase 5): Implement real connection logic
   */
  async connect(_config: McpServerConfig): Promise<void> {
    throw new Error(
      "McpConnectionManager.connect() not implemented - deferred to Phase 5",
    );
  }

  /**
   * Disconnect from an MCP server
   *
   * TODO(Phase 5): Implement graceful disconnect
   */
  async disconnect(_serverName: string): Promise<void> {
    throw new Error(
      "McpConnectionManager.disconnect() not implemented - deferred to Phase 5",
    );
  }

  /**
   * Get connection status
   */
  getConnection(serverName: string): McpConnection | undefined {
    return this.connections.get(serverName);
  }

  /**
   * List all connections
   */
  listConnections(): McpConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Check if connected to a server
   */
  isConnected(serverName: string): boolean {
    const conn = this.connections.get(serverName);
    return conn?.state === ConnectionState.Connected;
  }
}
