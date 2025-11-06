/**
 * Tests for Anthropic Messages API tool conversion.
 *
 * Phase 4.2 - Stage 2: Tool Conversion (15 tests)
 *
 * Test Coverage (from Design Doc Section 4.5):
 * - TC-01 through TC-10: Tool conversion tests
 * - Tool result formatting (5 tests)
 *
 * Reference: Design Section 3.1 (Tool Format Specification)
 * Reference: Design Section 4.5 (Tool Calling Tests)
 */

import { describe, test, expect } from 'vitest'
import type { ToolSpec } from '../client-common.js'
import {
  createToolsJsonForMessagesApi,
  prepareToolResult,
  ToolConversionError,
} from './tool-bridge.js'
import type { AnthropicTool, AnthropicToolResultBlock } from './types.js'

describe('Messages API Tool Bridge - Stage 2', () => {
  // ============================================================================
  // TC-01: Basic function tool conversion
  // ============================================================================
  test('TC-01: Converter maps basic function tool', () => {
    const toolSpec: ToolSpec = {
      type: 'function',
      name: 'get_weather',
      description: 'Get weather for a location',
      strict: false,
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
        required: ['location'],
      },
    }

    const result = createToolsJsonForMessagesApi([toolSpec])

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'get_weather',
      description: 'Get weather for a location',
      input_schema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
        required: ['location'],
      },
    })
  })

  // ============================================================================
  // TC-02: Tool name length validation
  // ============================================================================
  test('TC-02: Converter enforces name length (max 64 chars)', () => {
    const toolSpec: ToolSpec = {
      type: 'function',
      name: 'a'.repeat(65), // 65 characters - too long!
      description: 'Test tool',
      strict: false,
      parameters: {
        type: 'object',
        properties: {},
      },
    }

    expect(() => createToolsJsonForMessagesApi([toolSpec])).toThrow(ToolConversionError)
    expect(() => createToolsJsonForMessagesApi([toolSpec])).toThrow(
      /Tool name.*exceeds 64 character limit/i,
    )
  })

  // ============================================================================
  // TC-03: Freeform tools are unsupported
  // ============================================================================
  test('TC-03: Converter strips unsupported Freeform tools', () => {
    const toolSpec: ToolSpec = {
      type: 'custom',
      name: 'custom_tool',
      description: 'A custom tool',
      format: {
        type: 'bash_command',
        syntax: 'bash',
        definition: 'some template',
      },
    }

    expect(() => createToolsJsonForMessagesApi([toolSpec])).toThrow(ToolConversionError)
    expect(() => createToolsJsonForMessagesApi([toolSpec])).toThrow(/does not support.*custom/i)
  })

  // ============================================================================
  // TC-04: LocalShell tool mapping
  // ============================================================================
  test('TC-04: Converter handles LocalShell mapping', () => {
    const toolSpec: ToolSpec = {
      type: 'local_shell',
    }

    const result = createToolsJsonForMessagesApi([toolSpec])

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'execute_command',
      description: 'Execute a shell command on the local system',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to execute' },
        },
        required: ['command'],
      },
    })
  })

  // ============================================================================
  // TC-05: WebSearch tool mapping
  // ============================================================================
  test('TC-05: Converter handles WebSearch mapping', () => {
    const toolSpec: ToolSpec = {
      type: 'web_search',
    }

    const result = createToolsJsonForMessagesApi([toolSpec])

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'web_search',
      description: 'Search the web for information',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    })
  })

  // ============================================================================
  // TC-06: Schema with $defs preserved
  // ============================================================================
  test('TC-06: Converter preserves schema $defs', () => {
    const toolSpec: ToolSpec = {
      type: 'function',
      name: 'process_data',
      description: 'Process data with nested types',
      strict: false,
      parameters: {
        type: 'object',
        properties: {
          data: { $ref: '#/$defs/DataItem' },
        },
        required: ['data'],
        $defs: {
          DataItem: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              value: { type: 'number' },
            },
          },
        },
      },
    }

    const result = createToolsJsonForMessagesApi([toolSpec])

    expect(result).toHaveLength(1)
    expect(result[0].input_schema.$defs).toBeDefined()
    expect(result[0].input_schema.$defs).toEqual({
      DataItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          value: { type: 'number' },
        },
      },
    })
  })

  // ============================================================================
  // TC-07: Required array validation
  // ============================================================================
  test('TC-07: Converter enforces required list', () => {
    // Missing required array should still work (optional)
    const toolSpec: ToolSpec = {
      type: 'function',
      name: 'optional_params',
      description: 'Tool with optional params',
      strict: false,
      parameters: {
        type: 'object',
        properties: {
          opt1: { type: 'string' },
          opt2: { type: 'number' },
        },
        // No required array - all optional
      },
    }

    const result = createToolsJsonForMessagesApi([toolSpec])

    expect(result).toHaveLength(1)
    expect(result[0].input_schema.required).toBeUndefined()
  })

  // ============================================================================
  // TC-08: Nested arrays in schema
  // ============================================================================
  test('TC-08: Converter handles nested arrays', () => {
    const toolSpec: ToolSpec = {
      type: 'function',
      name: 'process_list',
      description: 'Process a list of items',
      strict: false,
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        required: ['items'],
      },
    }

    const result = createToolsJsonForMessagesApi([toolSpec])

    expect(result).toHaveLength(1)
    const schema = result[0].input_schema
    expect(schema.properties.items.type).toBe('array')
    expect(schema.properties.items.items.properties.tags.type).toBe('array')
  })

  // ============================================================================
  // TC-09: Enum properties preserved
  // ============================================================================
  test('TC-09: Converter handles enums', () => {
    const toolSpec: ToolSpec = {
      type: 'function',
      name: 'set_mode',
      description: 'Set operating mode',
      strict: false,
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['fast', 'balanced', 'accurate'],
            description: 'Operating mode',
          },
        },
        required: ['mode'],
      },
    }

    const result = createToolsJsonForMessagesApi([toolSpec])

    expect(result).toHaveLength(1)
    expect(result[0].input_schema.properties.mode.enum).toEqual([
      'fast',
      'balanced',
      'accurate',
    ])
  })

  // ============================================================================
  // TC-10: Tool name deduplication
  // ============================================================================
  test('TC-10: Tool registry deduplicates names', () => {
    const toolSpecs: ToolSpec[] = [
      {
        type: 'function',
        name: 'get_data',
        description: 'First version',
        strict: false,
        parameters: { type: 'object', properties: {} },
      },
      {
        type: 'function',
        name: 'get_data', // Duplicate name!
        description: 'Second version',
        strict: false,
        parameters: { type: 'object', properties: {} },
      },
    ]

    // Should throw an error for duplicate names
    expect(() => createToolsJsonForMessagesApi(toolSpecs)).toThrow(ToolConversionError)
    expect(() => createToolsJsonForMessagesApi(toolSpecs)).toThrow(/Duplicate tool name/i)
  })

  // ============================================================================
  // Tool Result Tests (5 tests)
  // ============================================================================

  // ============================================================================
  // TR-01: Success result formatting
  // ============================================================================
  test('TR-01: Tool result marshaler formats success', () => {
    const result = prepareToolResult('toolu_123', 'Success output', false)

    expect(result).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_123',
      content: 'Success output',
      is_error: false,
    })
  })

  // ============================================================================
  // TR-02: JSON output formatting
  // ============================================================================
  test('TR-02: Tool result marshaler formats JSON output', () => {
    const jsonOutput = JSON.stringify({ status: 'ok', count: 42 })
    const result = prepareToolResult('toolu_456', jsonOutput, false)

    expect(result).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_456',
      content: jsonOutput,
      is_error: false,
    })
  })

  // ============================================================================
  // TR-03: Error result flagging
  // ============================================================================
  test('TR-03: Tool result marshaler flags error status', () => {
    const result = prepareToolResult('toolu_789', 'Command failed: timeout', true)

    expect(result).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_789',
      content: 'Command failed: timeout',
      is_error: true,
    })
  })

  // ============================================================================
  // TR-04: Empty output handling
  // ============================================================================
  test('TR-04: Tool result handles empty output', () => {
    const result = prepareToolResult('toolu_empty', '', false)

    expect(result).toEqual({
      type: 'tool_result',
      tool_use_id: 'toolu_empty',
      content: '',
      is_error: false,
    })
  })

  // ============================================================================
  // TR-05: Large output truncation
  // ============================================================================
  test('TR-05: Tool result enforces size limits', () => {
    // Create a large output (100KB)
    const largeOutput = 'x'.repeat(100 * 1024)
    const result = prepareToolResult('toolu_large', largeOutput, false)

    // Should truncate to max size (32KB by default in design)
    expect(result.content.length).toBeLessThanOrEqual(32 * 1024 + 100) // +100 for truncation notice
    expect(result.content).toContain('[truncated - output exceeded 32KB limit]')
  })
})
