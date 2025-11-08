/**
 * Tool bridge for Anthropic Messages API
 *
 * Converts Codex ToolSpec definitions to Anthropic's tool schema format
 * and handles tool result conversion.
 *
 * Design reference: MESSAGES_API_INTEGRATION_DESIGN_CODEX.md Section 3
 */

import type { ToolSpec } from "../client-common.js";
import type { AnthropicTool, AnthropicContentBlock } from "./types.js";

/**
 * Maximum allowed length for tool names (Anthropic limit).
 */
const MAX_TOOL_NAME_LENGTH = 64;

/**
 * Tool conversion error types.
 */
export class AnthropicToolConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnthropicToolConversionError";
  }
}

/**
 * Validate tool name length and format.
 *
 * @param name - Tool name to validate
 * @throws {AnthropicToolConversionError} If name is invalid
 */
export function validateToolName(name: string): void {
  if (!name || name.length === 0) {
    throw new AnthropicToolConversionError("Tool name cannot be empty");
  }

  if (name.length > MAX_TOOL_NAME_LENGTH) {
    throw new AnthropicToolConversionError(
      `Tool name "${name}" exceeds maximum length of ${MAX_TOOL_NAME_LENGTH} characters`,
    );
  }
}

/**
 * Convert Codex ToolSpec array to Anthropic Messages API tool format.
 *
 * This function handles:
 * - Function tools: Direct conversion with schema mapping
 * - LocalShell tools: Mapped to bash execution schema
 * - WebSearch tools: Mapped to web search schema
 * - Custom/Freeform tools: Rejected (not supported by Anthropic)
 *
 * @param tools - Array of Codex ToolSpec to convert
 * @returns Array of Anthropic tool schemas
 * @throws {AnthropicToolConversionError} If tool conversion fails
 */
export function createToolsJsonForMessagesApi(
  tools: ToolSpec[],
): AnthropicTool[] {
  const seenNames = new Set<string>();
  const result: AnthropicTool[] = [];

  for (const tool of tools) {
    let anthropicTool: AnthropicTool;

    switch (tool.type) {
      case "function":
        anthropicTool = convertFunctionTool(tool);
        break;

      case "local_shell":
        anthropicTool = convertLocalShellTool();
        break;

      case "web_search":
        anthropicTool = convertWebSearchTool();
        break;

      case "custom":
        throw new AnthropicToolConversionError(
          `Freeform/custom tools are not supported by Anthropic Messages API. ` +
            `Tool name: "${tool.name}"`,
        );

      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = tool;
        throw new AnthropicToolConversionError(
          `Unknown tool type: ${JSON.stringify(tool)}`,
        );
      }
    }

    // Validate and deduplicate by name
    validateToolName(anthropicTool.name);

    if (seenNames.has(anthropicTool.name)) {
      console.warn(
        `[tool-bridge] Duplicate tool name "${anthropicTool.name}" detected. ` +
          `Only the first definition will be used.`,
      );
      continue; // Skip duplicates
    }

    seenNames.add(anthropicTool.name);
    result.push(anthropicTool);
  }

  return result;
}

/**
 * Convert a function tool to Anthropic schema format.
 *
 * Handles:
 * - Schema conversion (parameters → input_schema)
 * - Strict mode (adds additionalProperties: false)
 * - Required field validation
 * - Preservation of $defs, enums, nested schemas
 *
 * @param tool - Function tool to convert
 * @returns Anthropic tool schema
 */
function convertFunctionTool(
  tool: Extract<ToolSpec, { type: "function" }>,
): AnthropicTool {
  const schema = tool.parameters;

  // Validate required fields exist in properties
  if (schema.required && schema.properties) {
    const propertyNames = Object.keys(schema.properties);
    for (const requiredField of schema.required) {
      if (!propertyNames.includes(requiredField)) {
        throw new AnthropicToolConversionError(
          `Tool "${tool.name}": Required field "${requiredField}" not found in properties`,
        );
      }
    }
  }

  // Build input_schema with strict mode support
  const inputSchema: AnthropicTool["input_schema"] = {
    type: "object",
    properties: schema.properties || {},
    required: schema.required,
  };

  // Apply strict mode if requested
  if (tool.strict) {
    inputSchema.additionalProperties = false;
  }

  // Preserve $defs if present
  if ("$defs" in schema && schema.$defs) {
    inputSchema.$defs = schema.$defs;
  }

  // Preserve other JSON Schema extensions (anyOf, allOf, oneOf, etc.)
  for (const key of Object.keys(schema)) {
    if (
      key !== "type" &&
      key !== "properties" &&
      key !== "required" &&
      key !== "$defs" &&
      !Object.prototype.hasOwnProperty.call(inputSchema, key)
    ) {
      // Dynamic property assignment for schema extensions
      (inputSchema as Record<string, unknown>)[key] = schema[key];
    }
  }

  return {
    name: tool.name,
    description: tool.description,
    input_schema: inputSchema,
  };
}

/**
 * Convert local_shell tool to Anthropic bash tool schema.
 *
 * Maps to a bash execution tool with command and optional restart_sequence.
 *
 * @returns Anthropic tool schema for bash execution
 */
function convertLocalShellTool(): AnthropicTool {
  return {
    name: "bash",
    description: "Execute bash commands in the local shell environment",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The bash command to execute",
        },
        restart_sequence: {
          type: "number",
          description: "Optional restart sequence number",
        },
      },
      required: ["command"],
    },
  };
}

/**
 * Convert web_search tool to Anthropic web search schema.
 *
 * Maps to a web search tool with a query parameter.
 *
 * @returns Anthropic tool schema for web search
 */
function convertWebSearchTool(): AnthropicTool {
  return {
    name: "web_search",
    description: "Search the web for information",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  };
}

/**
 * Create a tool_result content block from a tool execution output.
 *
 * This function will be expanded in later stages to handle:
 * - Successful results (string or JSON)
 * - Error results (is_error flag)
 * - Binary data (base64 encoding)
 * - Multi-block content
 *
 * @param toolUseId - The tool_use ID to reference
 * @param output - The tool execution output
 * @param isError - Whether this is an error result
 * @returns Anthropic tool_result content block
 */
export function createToolResultBlock(
  toolUseId: string,
  output: string,
  isError: boolean = false,
): Extract<AnthropicContentBlock, { type: "tool_result" }> {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: output,
    is_error: isError,
  };
}
