/**
 * Tool conversion bridge for Anthropic Messages API.
 *
 * This module converts Codex ToolSpec definitions to Anthropic's tool schema
 * format and prepares tool results for follow-up requests.
 *
 * Reference: MESSAGES_API_INTEGRATION_DESIGN_CODEX.md
 * - Section 3.1: Tool Format Specification
 * - Section 3.2: Tool Use Lifecycle
 * - Section 3.3: Tool Result Handling
 *
 * Phase 4.2 - Stage 2: Tool Conversion
 */

import type { ToolSpec, JsonSchema } from '../client-common.js'
import type { AnthropicTool, AnthropicToolInputSchema, AnthropicToolResultBlock } from './types.js'

// ============================================================================
// Constants
// ============================================================================

/** Maximum tool name length per Anthropic API spec */
const MAX_TOOL_NAME_LENGTH = 64

/** Maximum tool result size (32KB) */
const MAX_TOOL_RESULT_SIZE = 32 * 1024

/** Truncation notice for large outputs */
const TRUNCATION_NOTICE = '\n[truncated - output exceeded 32KB limit]'

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown during tool conversion.
 */
export class ToolConversionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolConversionError'
  }
}

// ============================================================================
// Tool Conversion
// ============================================================================

/**
 * Convert Codex ToolSpec array to Anthropic Messages API tool format.
 *
 * Handles:
 * - Function tools: Direct conversion to Anthropic schema
 * - LocalShell: Mapped to execute_command tool
 * - WebSearch: Mapped to web_search tool
 * - Custom/Freeform: Rejected (unsupported by Anthropic)
 *
 * Validations:
 * - Tool names must be ≤ 64 characters
 * - Tool names must be unique (no duplicates)
 * - Schema must be type: 'object'
 *
 * @param tools - Array of Codex ToolSpec
 * @returns Array of Anthropic tool schemas
 * @throws ToolConversionError if validation fails
 *
 * Reference: Design Section 3.1
 */
export function createToolsJsonForMessagesApi(tools: ToolSpec[]): AnthropicTool[] {
  const converted: AnthropicTool[] = []
  const seenNames = new Set<string>()

  for (const tool of tools) {
    let anthropicTool: AnthropicTool

    switch (tool.type) {
      case 'function':
        anthropicTool = convertFunctionTool(tool)
        break

      case 'local_shell':
        anthropicTool = convertLocalShellTool()
        break

      case 'web_search':
        anthropicTool = convertWebSearchTool()
        break

      case 'custom':
        throw new ToolConversionError(
          `Anthropic Messages API does not support custom/freeform tools. ` +
            `Tool "${tool.name}" cannot be used.`,
        )

      default:
        // TypeScript exhaustiveness check
        const _exhaustive: never = tool
        throw new ToolConversionError(`Unknown tool type: ${JSON.stringify(_exhaustive)}`)
    }

    // Validate name length
    if (anthropicTool.name.length > MAX_TOOL_NAME_LENGTH) {
      throw new ToolConversionError(
        `Tool name "${anthropicTool.name}" exceeds 64 character limit ` +
          `(length: ${anthropicTool.name.length})`,
      )
    }

    // Check for duplicate names
    if (seenNames.has(anthropicTool.name)) {
      throw new ToolConversionError(`Duplicate tool name: "${anthropicTool.name}"`)
    }

    seenNames.add(anthropicTool.name)
    converted.push(anthropicTool)
  }

  return converted
}

/**
 * Convert a function tool to Anthropic format.
 */
function convertFunctionTool(
  tool: Extract<ToolSpec, { type: 'function' }>,
): AnthropicTool {
  // Ensure schema is type: 'object'
  const schema = tool.parameters
  if (schema.type !== 'object') {
    throw new ToolConversionError(
      `Tool "${tool.name}" must have schema type "object", got "${schema.type}"`,
    )
  }

  // Convert to Anthropic input schema
  const inputSchema: AnthropicToolInputSchema = {
    type: 'object',
    properties: schema.properties ?? {},
    required: schema.required,
    additionalProperties: tool.strict ? false : undefined,
    $defs: schema.$defs as Record<string, unknown> | undefined,
  }

  return {
    name: tool.name,
    description: tool.description,
    input_schema: inputSchema,
  }
}

/**
 * Convert local_shell tool to Anthropic format.
 */
function convertLocalShellTool(): AnthropicTool {
  return {
    name: 'execute_command',
    description: 'Execute a shell command on the local system',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute' },
      },
      required: ['command'],
    },
  }
}

/**
 * Convert web_search tool to Anthropic format.
 */
function convertWebSearchTool(): AnthropicTool {
  return {
    name: 'web_search',
    description: 'Search the web for information',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  }
}

// ============================================================================
// Tool Result Preparation
// ============================================================================

/**
 * Prepare a tool result block for sending back to Anthropic.
 *
 * Handles:
 * - Result content formatting (text or JSON)
 * - Error status flagging
 * - Size truncation (max 32KB)
 * - tool_use_id correlation
 *
 * @param toolUseId - ID from the tool_use block
 * @param output - Tool execution output (string)
 * @param isError - Whether the tool execution failed
 * @returns Anthropic tool_result content block
 *
 * Reference: Design Section 3.3
 */
export function prepareToolResult(
  toolUseId: string,
  output: string,
  isError: boolean,
): AnthropicToolResultBlock {
  // Truncate if necessary
  let content = output
  if (output.length > MAX_TOOL_RESULT_SIZE) {
    content = output.slice(0, MAX_TOOL_RESULT_SIZE) + TRUNCATION_NOTICE
  }

  return {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content,
    is_error: isError,
  }
}

/**
 * Prepare multiple tool results as a single user message.
 *
 * Used when multiple tools are executed in parallel.
 *
 * @param results - Array of tool result blocks
 * @returns Array of content blocks for a user message
 *
 * Reference: Design Section 2.7 (Parallel Tool Execution)
 */
export function prepareToolResultsMessage(
  results: AnthropicToolResultBlock[],
): AnthropicToolResultBlock[] {
  return results
}
