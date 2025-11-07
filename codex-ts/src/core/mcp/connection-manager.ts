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
import type {
  McpResource,
  McpResourceTemplate,
} from "../../tools/mcp-resource/index.js";

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
 * Parameters for listing resources with pagination
 */
export interface ListResourcesParams {
  cursor?: string;
}

/**
 * Result from listing resources
 */
export interface ListResourcesResult {
  resources: McpResource[];
  nextCursor?: string;
}

/**
 * Result from listing resource templates
 */
export interface ListResourceTemplatesResult {
  resourceTemplates: McpResourceTemplate[];
  nextCursor?: string;
}

/**
 * Content block from MCP resource read
 */
export interface ResourceContentBlock {
  type: "text" | "resource";
  text?: string;
  uri?: string;
  mimeType?: string;
}

/**
 * Result from reading a resource
 */
export interface ReadResourceResult {
  contents: ResourceContentBlock[];
}

/**
 * MCP connection manager
 *
 * STUB: Full implementation deferred to Phase 5
 * Methods are wired but return empty results until real MCP integration is complete.
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

  /**
   * List resources from a specific MCP server
   *
   * Phase 5 TODO: Implement real MCP protocol call
   * Currently returns empty list as connection manager is stubbed
   */
  async listResources(
    _serverName: string,
    _params?: ListResourcesParams,
  ): Promise<ListResourcesResult> {
    // Stub: Return empty list until Phase 5 MCP integration
    return {
      resources: [],
      nextCursor: undefined,
    };
  }

  /**
   * List all resources from all connected MCP servers
   *
   * Phase 5 TODO: Implement real aggregation across servers
   * Currently returns empty map as connection manager is stubbed
   */
  async listAllResources(): Promise<Record<string, McpResource[]>> {
    // Stub: Return empty map until Phase 5 MCP integration
    return {};
  }

  /**
   * List resource templates from a specific MCP server
   *
   * Phase 5 TODO: Implement real MCP protocol call
   * Currently returns empty list as connection manager is stubbed
   */
  async listResourceTemplates(
    _serverName: string,
    _params?: ListResourcesParams,
  ): Promise<ListResourceTemplatesResult> {
    // Stub: Return empty list until Phase 5 MCP integration
    return {
      resourceTemplates: [],
      nextCursor: undefined,
    };
  }

  /**
   * List all resource templates from all connected MCP servers
   *
   * Phase 5 TODO: Implement real aggregation across servers
   * Currently returns empty map as connection manager is stubbed
   */
  async listAllResourceTemplates(): Promise<
    Record<string, McpResourceTemplate[]>
  > {
    // Stub: Return empty map until Phase 5 MCP integration
    return {};
  }

  /**
   * Read a specific resource from an MCP server
   *
   * Phase 5 TODO: Implement real MCP protocol call
   * Currently throws as connection manager is stubbed
   */
  async readResource(
    serverName: string,
    uri: string,
  ): Promise<ReadResourceResult> {
    // Stub: Throw error until Phase 5 MCP integration
    throw new Error(
      `MCP resource reading not yet implemented (connection manager stubbed): ${serverName}::${uri}`,
    );
  }
}

/**
 * Global MCP connection manager instance
 */
export const mcpConnectionManager = new McpConnectionManager();
