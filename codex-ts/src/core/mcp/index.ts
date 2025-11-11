/**
 * MCP Integration - Core MCP support
 *
 * STUB IMPLEMENTATION - Full implementation deferred to Phase 5
 *
 * Ported from: codex-rs/core/src/mcp/
 */

// Auth

// Connection Management

// Tool Calls
export { computeAuthStatuses, computeAuthStatus } from "./auth.js";
export type { McpAuthStatusEntry } from "./auth.js";
export { McpConnectionManager, ConnectionState } from "./connection-manager.js";
export type { McpConnection } from "./connection-manager.js";
export { executeMcpToolCall } from "./tool-call.js";
export type { McpToolCall, McpToolResult } from "./tool-call.js";
