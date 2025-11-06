/**
 * MCP Integration - Core MCP support
 *
 * STUB IMPLEMENTATION - Full implementation deferred to Phase 5
 *
 * Ported from: codex-rs/core/src/mcp/
 */

// Auth
export { computeAuthStatuses, computeAuthStatus } from "./auth";
export type { McpAuthStatusEntry } from "./auth";

// Connection Management
export { McpConnectionManager, ConnectionState } from "./connection-manager";
export type { McpConnection } from "./connection-manager";

// Tool Calls
export { executeMcpToolCall } from "./tool-call";
export type { McpToolCall, McpToolResult } from "./tool-call";
