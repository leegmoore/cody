/**
 * Common types and utilities for model client implementations.
 *
 * Defines core interfaces for prompts, response events, and API requests
 * used across different model providers (OpenAI Responses API, Chat API, etc.)
 *
 * Ported from: codex-rs/core/src/client_common.rs
 */

import type { ResponseItem } from '../../protocol/models.js'
import type { TokenUsage, RateLimitSnapshot } from '../../protocol/protocol.js'
import type { ReasoningEffort, ReasoningSummary, Verbosity } from '../../protocol/config-types.js'

/**
 * JSON Schema type for tool parameters.
 *
 * Simplified for Phase 4.1 - full JsonSchema enum will come in later phases if needed.
 */
export interface JsonSchema {
  type: string
  properties?: Record<string, unknown>
  required?: string[]
  description?: string
  [key: string]: unknown
}

/**
 * Tool specification for the Responses API (Function type).
 */
export interface ResponsesApiTool {
  /** Tool name */
  name: string
  /** Tool description */
  description: string
  /** Whether strict schema validation is enabled */
  strict: boolean
  /** JSON schema for tool parameters */
  parameters: JsonSchema
}

/**
 * Format specification for freeform tools.
 */
export interface FreeformToolFormat {
  /** Format type (e.g., "bash_command") */
  type: string
  /** Syntax highlighting hint */
  syntax: string
  /** Tool definition template */
  definition: string
}

/**
 * Freeform tool specification for custom tools.
 */
export interface FreeformTool {
  /** Tool name */
  name: string
  /** Tool description */
  description: string
  /** Format specification */
  format: FreeformToolFormat
}

/**
 * Tool specification variants for the Responses API.
 *
 * Supports function tools, built-in tools (local_shell, web_search),
 * and custom freeform tools.
 */
export type ToolSpec =
  | ({ type: 'function' } & ResponsesApiTool)
  | { type: 'local_shell' }
  | { type: 'web_search' }
  | ({ type: 'custom' } & FreeformTool)

/**
 * API request payload for a single model turn.
 */
export interface Prompt {
  /** Conversation context input items */
  input: ResponseItem[]

  /** Tools available to the model */
  tools: ToolSpec[]

  /** Whether parallel tool calls are permitted */
  parallelToolCalls: boolean

  /** Optional override for the built-in base instructions */
  baseInstructionsOverride?: string

  /** Optional output schema for structured responses */
  outputSchema?: unknown
}

/**
 * Events emitted during response streaming.
 */
export type ResponseEvent =
  | { type: 'created' }
  | { type: 'output_item_done'; item: ResponseItem }
  | { type: 'output_item_added'; item: ResponseItem }
  | {
      type: 'completed'
      responseId: string
      tokenUsage?: TokenUsage
    }
  | { type: 'output_text_delta'; delta: string }
  | { type: 'reasoning_summary_delta'; delta: string }
  | { type: 'reasoning_content_delta'; delta: string }
  | { type: 'reasoning_summary_part_added' }
  | { type: 'rate_limits'; snapshot: RateLimitSnapshot }

/**
 * Reasoning configuration for the Responses API.
 */
export interface Reasoning {
  /** Reasoning effort level */
  effort?: ReasoningEffort
  /** Reasoning summary mode */
  summary?: ReasoningSummary
}

/**
 * Text format type for structured outputs.
 */
export type TextFormatType = 'json_schema'

/**
 * Text format specification for structured outputs.
 */
export interface TextFormat {
  /** Format type */
  type: TextFormatType
  /** Whether strict validation is enabled */
  strict: boolean
  /** JSON schema for the output */
  schema: unknown
  /** Schema name */
  name: string
}

/**
 * OpenAI verbosity levels.
 */
export type OpenAiVerbosity = 'low' | 'medium' | 'high'

/**
 * Text controls for the Responses API.
 */
export interface TextControls {
  /** Verbosity level */
  verbosity?: OpenAiVerbosity
  /** Output format specification */
  format?: TextFormat
}

/**
 * Request object for the Responses API.
 */
export interface ResponsesApiRequest {
  /** Model identifier */
  model: string
  /** System instructions */
  instructions: string
  /** Input items */
  input: ResponseItem[]
  /** Available tools */
  tools: unknown[]
  /** Tool choice mode */
  toolChoice: string
  /** Whether parallel tool calls are enabled */
  parallelToolCalls: boolean
  /** Reasoning configuration */
  reasoning?: Reasoning
  /** Whether to store the conversation */
  store: boolean
  /** Whether to stream the response */
  stream: boolean
  /** Fields to include in the response */
  include: string[]
  /** Optional prompt cache key */
  promptCacheKey?: string
  /** Optional text controls */
  text?: TextControls
}

/**
 * Minimal ModelFamily interface for Phase 4.1.
 *
 * This will be expanded in later phases when full model management is implemented.
 */
export interface ModelFamily {
  /** Base system instructions */
  baseInstructions: string
  /** Whether model needs special apply_patch instructions */
  needsSpecialApplyPatchInstructions: boolean
  /** Whether model supports reasoning summaries */
  supportsReasoningSummaries: boolean
}

/**
 * Convert Verbosity config to OpenAI verbosity format.
 */
function verbosityToOpenAi(verbosity: Verbosity): OpenAiVerbosity {
  // All Verbosity values map directly to OpenAiVerbosity
  return verbosity as OpenAiVerbosity
}

/**
 * Create reasoning parameter for API request.
 *
 * Returns undefined if the model doesn't support reasoning summaries.
 */
export function createReasoningParamForRequest(
  modelFamily: ModelFamily,
  effort: ReasoningEffort | undefined,
  summary: ReasoningSummary,
): Reasoning | undefined {
  if (!modelFamily.supportsReasoningSummaries) {
    return undefined
  }

  return {
    effort,
    summary,
  }
}

/**
 * Create text controls parameter for API request.
 *
 * Returns undefined if neither verbosity nor output schema is set.
 */
export function createTextParamForRequest(
  verbosity: Verbosity | undefined,
  outputSchema: unknown | undefined,
): TextControls | undefined {
  if (verbosity === undefined && outputSchema === undefined) {
    return undefined
  }

  return {
    verbosity: verbosity ? verbosityToOpenAi(verbosity) : undefined,
    format: outputSchema
      ? {
          type: 'json_schema',
          strict: true,
          schema: outputSchema,
          name: 'codex_output_schema',
        }
      : undefined,
  }
}
