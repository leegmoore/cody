/**
 * Tool result builder for Anthropic Messages API
 *
 * Converts tool execution outputs to Anthropic tool_result format
 * for follow-up requests in tool-calling conversations.
 *
 * Design reference: MESSAGES_API_INTEGRATION_DESIGN_CODEX.md Section 3.3
 */

import type { AnthropicContentBlock, AnthropicMessage } from "./types.js";

/**
 * Maximum size for tool result content before truncation (32KB)
 */
const MAX_TOOL_RESULT_SIZE = 32 * 1024;

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** Tool use ID from the model's tool_use block */
  toolUseId: string;
  /** Tool output (string, JSON, or binary) */
  output: string | object | Buffer;
  /** Whether the tool execution failed */
  isError?: boolean;
}

/**
 * Build a tool_result content block from execution output.
 *
 * Handles:
 * - String outputs (plain text)
 * - JSON outputs (serialized to string)
 * - Binary outputs (base64 encoded)
 * - Error flags
 * - Size limits with truncation
 *
 * @param result - Tool execution result
 * @returns Anthropic content block with tool_result
 */
export function buildToolResult(
  result: ToolExecutionResult,
): AnthropicContentBlock {
  let content: string;
  let mimeType: string | undefined;

  // Handle different output types
  if (Buffer.isBuffer(result.output)) {
    // Binary output: base64 encode
    content = result.output.toString("base64");
    mimeType = "application/octet-stream";
  } else if (typeof result.output === "object") {
    // JSON output: serialize
    content = JSON.stringify(result.output, null, 2);
    mimeType = "application/json";
  } else {
    // String output: use as-is
    content = String(result.output);
  }

  // Enforce size limit
  let wasTruncated = false;
  if (content.length > MAX_TOOL_RESULT_SIZE) {
    const truncateNotice =
      "\n\n[... output truncated due to size limit ...]";
    const availableSize = MAX_TOOL_RESULT_SIZE - truncateNotice.length;
    content = content.slice(0, availableSize) + truncateNotice;
    wasTruncated = true;
  }

  // Build tool_result block
  const toolResult: AnthropicContentBlock = {
    type: "tool_result",
    tool_use_id: result.toolUseId,
    content,
  };

  // Add optional fields
  if (result.isError) {
    toolResult.is_error = true;
  }

  if (mimeType) {
    // Note: Anthropic doesn't have a mime_type field in tool_result,
    // but we track it for potential future use
    (toolResult as any).mime_type = mimeType;
  }

  if (wasTruncated) {
    // Add metadata flag for tracking
    (toolResult as any).was_truncated = true;
  }

  return toolResult;
}

/**
 * Build a user message containing tool results.
 *
 * This creates the follow-up message that includes tool execution
 * results to send back to the model.
 *
 * @param results - Array of tool execution results
 * @returns Anthropic message with role='user' and tool_result content
 */
export function buildToolResultMessage(
  results: ToolExecutionResult[],
): AnthropicMessage {
  const content = results.map((result) => buildToolResult(result));

  return {
    role: "user",
    content,
  };
}

/**
 * Append tool results to prompt history.
 *
 * This updates the prompt's input array by adding:
 * 1. The assistant's message with tool calls (if not already present)
 * 2. A user message with tool results
 *
 * @param promptInput - Current prompt input array
 * @param assistantMessage - The assistant's message containing tool calls
 * @param toolResults - Tool execution results
 * @returns Updated prompt input array
 */
export function appendToolResults(
  promptInput: any[],
  assistantMessage: any,
  toolResults: ToolExecutionResult[],
): any[] {
  const updated = [...promptInput];

  // Add assistant message if not already in history
  const hasAssistantMessage = updated.some(
    (item) =>
      item.type === "message" &&
      item.role === "assistant" &&
      JSON.stringify(item.content).includes("custom_tool_call"),
  );

  if (!hasAssistantMessage && assistantMessage) {
    updated.push(assistantMessage);
  }

  // Build and add tool result message
  const toolResultMessage = buildToolResultMessage(toolResults);

  // Convert to Codex ResponseItem format
  const userMessage = {
    type: "message" as const,
    role: "user" as const,
    content: toolResultMessage.content.map((block) => ({
      type: "tool_result" as const,
      tool_use_id: (block as any).tool_use_id,
      content: (block as any).content,
      is_error: (block as any).is_error,
    })),
  };

  updated.push(userMessage);

  return updated;
}
