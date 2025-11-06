/**
 * MCP Tool Call - STUB IMPLEMENTATION
 *
 * This module handles MCP tool invocations.
 * Full implementation deferred to Phase 5.
 *
 * Ported from: codex-rs/core/src/mcp_tool_call.rs
 *
 * Phase 5 TODO:
 * - Implement tool call routing
 * - Add parameter validation
 * - Integrate with connection manager
 * - Add result formatting
 */

/**
 * MCP tool call request
 */
export interface McpToolCall {
  serverName: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP tool call result
 */
export interface McpToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Execute an MCP tool call
 *
 * TODO(Phase 5): Implement tool execution via connection manager
 */
export async function executeMcpToolCall(
  _call: McpToolCall,
): Promise<McpToolResult> {
  throw new Error("executeMcpToolCall() not implemented - deferred to Phase 5");
}
