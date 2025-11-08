/**
 * Request builder for Anthropic Messages API
 *
 * Converts Codex Prompt to Anthropic MessagesApiRequest format.
 *
 * Design reference: MESSAGES_API_INTEGRATION_DESIGN_CODEX.md Section 2.1
 */

import type { Prompt } from "../client-common.js";
import type { ResponseItem } from "../../../protocol/models.js";
import type {
  MessagesApiRequest,
  AnthropicMessage,
  AnthropicProviderConfig,
} from "./types.js";
import { ANTHROPIC_DEFAULTS } from "./types.js";
import { createToolsJsonForMessagesApi } from "./tool-bridge.js";

/**
 * Additional request options for building Messages API requests.
 */
export interface MessagesRequestOptions {
  /** Optional temperature (0.0-1.0) */
  temperature?: number;
  /** Optional top_p sampling (0.0-1.0) */
  topP?: number;
  /** Optional top_k sampling */
  topK?: number;
  /** Optional stop sequences */
  stopSequences?: string[];
  /** Optional trace ID for debugging */
  traceId?: string;
  /** Optional tool choice override */
  toolChoice?: "auto" | "any" | "none";
}

/**
 * Build an Anthropic Messages API request from a Codex Prompt.
 *
 * Handles:
 * - Message conversion (Codex ResponseItem → Anthropic messages)
 * - Tool conversion (ToolSpec → Anthropic tools)
 * - System prompt injection
 * - Parameter mapping (temperature, tokens, etc.)
 * - Tool choice configuration
 *
 * @param prompt - Codex prompt with conversation history
 * @param config - Anthropic provider configuration
 * @param model - Model identifier (e.g., 'claude-3-5-sonnet-20241022')
 * @param options - Optional request parameters
 * @returns MessagesApiRequest ready to send to Anthropic
 */
export function buildMessagesRequest(
  prompt: Prompt,
  config: AnthropicProviderConfig,
  model: string,
  options?: MessagesRequestOptions,
): MessagesApiRequest {
  // Convert messages from Codex format to Anthropic format
  const messages = convertMessages(prompt.input);

  // Build base request
  const request: MessagesApiRequest = {
    model,
    messages,
    stream: true,
    max_output_tokens:
      config.maxOutputTokens ?? ANTHROPIC_DEFAULTS.MAX_OUTPUT_TOKENS,
  };

  // Add system prompt if provided
  if (prompt.baseInstructionsOverride) {
    request.system = prompt.baseInstructionsOverride.trim();
  }

  // Add tools if present
  if (prompt.tools && prompt.tools.length > 0) {
    const anthropicTools = createToolsJsonForMessagesApi(prompt.tools);
    request.tools = anthropicTools;

    // Set tool_choice: options override takes precedence, then parallelToolCalls
    if (options?.toolChoice !== undefined) {
      request.tool_choice = options.toolChoice;
    } else {
      // Set tool_choice based on parallelToolCalls
      // Note: Anthropic currently serializes tool execution, but we set 'any'
      // to enable the adapter to handle multiple tool_use blocks if they arrive
      request.tool_choice = prompt.parallelToolCalls ? "any" : "auto";
    }
  }

  // Add optional parameters
  if (options?.temperature !== undefined) {
    request.temperature = options.temperature;
  }

  if (options?.topP !== undefined) {
    request.top_p = options.topP;
  }

  if (options?.topK !== undefined) {
    request.top_k = options.topK;
  }

  if (options?.stopSequences && options.stopSequences.length > 0) {
    request.stop_sequences = options.stopSequences;
  }

  // Add metadata
  const metadata: Record<string, unknown> = {};

  if (options?.traceId) {
    metadata.trace_id = options.traceId;
  }

  if (prompt.outputSchema) {
    // Mark that output schema is present for reference
    metadata.output_schema_present = true;
  }

  if (Object.keys(metadata).length > 0) {
    request.metadata = metadata;
  }

  return request;
}

/**
 * Convert Codex ResponseItem array to Anthropic messages.
 *
 * Handles:
 * - Message role mapping (user/assistant)
 * - Content block conversion (text, images, tool calls, etc.)
 * - Multi-turn conversation preservation
 *
 * @param items - Codex response items (conversation history)
 * @returns Array of Anthropic messages
 */
function convertMessages(items: ResponseItem[]): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];

  for (const item of items) {
    if (item.type === "message") {
      // Convert content blocks
      const textContent = item.content
        .map((block: { type: string; text?: string }) => {
          if (block.type === "input_text" || block.type === "output_text") {
            return block.text || "";
          }
          // Skip images and other content types for now
          // They will be handled in later stages
          return "";
        })
        .filter((text: string) => text.length > 0)
        .join("\n");

      if (textContent) {
        messages.push({
          role: item.role as "user" | "assistant",
          content: textContent,
        });
      }
    }
    // Other item types (tool calls, reasoning, etc.) will be handled
    // by the streaming adapter in later stages
  }

  return messages;
}
