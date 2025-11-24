/**
 * Tool schema formatter utilities.
 *
 * Ported from codex-ts/src/core/client/tool-converters.ts to ensure that
 * Core 2.0 adapters emit the exact same tool payloads that worked in v1.
 */

import type { ToolSpec } from "codex-ts/src/core/client/client-common.js";

/**
 * Convert ToolSpec definitions into the OpenAI Responses API tool format.
 *
 * Mirrors v1's createToolsJsonForResponsesApi implementation verbatim.
 */
export function formatToolsForResponsesApi(tools: ToolSpec[]): unknown[] {
  return tools.map((tool) => {
    switch (tool.type) {
      case "function":
        return {
          type: "function",
          name: tool.name,
          description: tool.description,
          strict: tool.strict,
          parameters: tool.parameters,
        };
      case "local_shell":
        return { type: "local_shell" };
      case "web_search":
        return { type: "web_search" };
      case "custom":
        return {
          type: "custom",
          name: tool.name,
          description: tool.description,
          format: tool.format,
        };
    }
  });
}

/**
 * Convert ToolSpec definitions into the Chat Completions-compatible format.
 *
 * Identical to v1's createToolsJsonForChatCompletionsApi implementation.
 */
export function formatToolsForChatCompletionsApi(tools: ToolSpec[]): unknown[] {
  return tools
    .filter((tool) => tool.type === "function")
    .map((tool) => {
      if (tool.type === "function") {
        return {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            strict: tool.strict,
            parameters: tool.parameters,
          },
        };
      }
      throw new Error("Unexpected non-function tool after filtering");
    });
}

/**
 * Convert ToolSpec definitions into the Anthropic Messages API format.
 *
 * Each tool is declared by name/description/input_schema.
 */
export function formatToolsForAnthropicMessages(
  tools: ToolSpec[],
): Array<{ name: string; description?: string; input_schema: unknown }> {
  return tools
    .filter((tool) => tool.type === "function")
    .map((tool) => {
      if (tool.type === "function") {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        };
      }
      throw new Error("Unexpected non-function tool after filtering");
    });
}
