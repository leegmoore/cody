/**
 * Tool format converters for OpenAI APIs
 *
 * This module provides functions to convert ToolSpec types into the
 * appropriate JSON format for different OpenAI API endpoints:
 * - Responses API: Direct tool format
 * - Chat Completions API: Wrapped function format (function tools only)
 *
 * Ported from: codex-rs/core/src/tools/spec.rs
 *
 * Phase 4.1 Note: This module handles tool format conversion for both
 * Responses and Chat APIs. The Chat API only supports function tools,
 * so other tool types (local_shell, web_search, custom) are filtered out.
 */

import type { ToolSpec } from './client-common.js'

/**
 * Convert tools to Responses API format.
 *
 * The Responses API accepts all tool types in their direct format:
 * - function: { type: 'function', name, description, strict, parameters }
 * - local_shell: { type: 'local_shell' }
 * - web_search: { type: 'web_search' }
 * - custom: { type: 'custom', name, description, format }
 *
 * @param tools - Array of ToolSpec to convert
 * @returns Array of tools in Responses API format
 */
export function createToolsJsonForResponsesApi(tools: ToolSpec[]): unknown[] {
  return tools.map((tool) => {
    switch (tool.type) {
      case 'function':
        return {
          type: 'function',
          name: tool.name,
          description: tool.description,
          strict: tool.strict,
          parameters: tool.parameters,
        }
      case 'local_shell':
        return {
          type: 'local_shell',
        }
      case 'web_search':
        return {
          type: 'web_search',
        }
      case 'custom':
        return {
          type: 'custom',
          name: tool.name,
          description: tool.description,
          format: tool.format,
        }
    }
  })
}

/**
 * Convert tools to Chat Completions API format.
 *
 * The Chat Completions API only supports function tools, and requires
 * them to be wrapped in a specific format:
 * { type: 'function', function: { name, description, strict, parameters } }
 *
 * Non-function tools (local_shell, web_search, custom) are filtered out.
 *
 * @param tools - Array of ToolSpec to convert
 * @returns Array of tools in Chat Completions API format (function tools only)
 */
export function createToolsJsonForChatCompletionsApi(tools: ToolSpec[]): unknown[] {
  return tools
    .filter((tool) => tool.type === 'function')
    .map((tool) => {
      // TypeScript knows tool.type === 'function' here
      if (tool.type === 'function') {
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            strict: tool.strict,
            parameters: tool.parameters,
          },
        }
      }
      // This should never be reached due to filter, but TypeScript needs it
      throw new Error('Unreachable: non-function tool after filter')
    })
}
