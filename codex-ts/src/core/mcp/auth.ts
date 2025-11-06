/**
 * MCP Authentication Status - STUB IMPLEMENTATION
 *
 * This module determines authentication status for MCP servers.
 * Full implementation deferred to Phase 5.
 *
 * Ported from: codex-rs/core/src/mcp/auth.rs
 *
 * Phase 5 TODO:
 * - Implement auth status computation for streamable HTTP
 * - Add OAuth status checking
 * - Integrate with rmcp-client for real auth checks
 */

import type { McpAuthStatus } from "../../protocol/protocol";
import type { McpServerConfig } from "../../mcp-server";

/**
 * MCP auth status entry
 */
export interface McpAuthStatusEntry {
  config: McpServerConfig;
  authStatus: McpAuthStatus;
}

/**
 * Compute authentication statuses for MCP servers
 *
 * TODO(Phase 5): Implement real auth status computation
 *
 * @param servers - Server configurations to check
 * @returns Map of server name to auth status entry
 */
export async function computeAuthStatuses(
  servers: Map<string, McpServerConfig>,
): Promise<Map<string, McpAuthStatusEntry>> {
  const result = new Map<string, McpAuthStatusEntry>();

  for (const [name, config] of servers.entries()) {
    // Stub: return unsupported for now
    result.set(name, {
      config,
      authStatus: "unsupported",
    });
  }

  return result;
}

/**
 * Compute auth status for a single server
 *
 * TODO(Phase 5): Implement based on transport type
 */
export async function computeAuthStatus(
  _serverName: string,
  _config: McpServerConfig,
): Promise<McpAuthStatus> {
  // Stub: stdio is always unsupported, HTTP would need OAuth check
  return "unsupported";
}
