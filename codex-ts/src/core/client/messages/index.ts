/**
 * Anthropic Messages API integration - Main entry point
 *
 * Exports the main streaming function that coordinates all components:
 * - Request building
 * - HTTP transport
 * - SSE parsing
 * - Event adaptation
 *
 * Design reference: MESSAGES_API_INTEGRATION_DESIGN_CODEX.md
 */

import type { Prompt } from "../client-common.js";
import type { ResponseEvent } from "../client-common.js";
import type { AnthropicProviderConfig } from "./types.js";
import {
  buildMessagesRequest,
  type MessagesRequestOptions,
} from "./request-builder.js";
import { createAnthropicTransport } from "./transport.js";
import { parseSseStream } from "./sse-parser.js";
import { adaptAnthropicStream } from "./adapter.js";

/**
 * Stream responses from the Anthropic Messages API.
 *
 * This is the main entry point that coordinates all components:
 * 1. Builds the MessagesApiRequest from Codex Prompt
 * 2. Sends HTTP request with authentication
 * 3. Parses SSE stream from response
 * 4. Adapts Anthropic events to Codex ResponseEvent format
 *
 * @param prompt - Codex prompt with conversation history and tools
 * @param config - Anthropic provider configuration
 * @param model - Model identifier (e.g., 'claude-3-5-sonnet-20241022')
 * @param options - Optional request parameters (temperature, tokens, etc.)
 * @returns Async generator yielding ResponseEvent objects
 */
export async function* streamMessages(
  prompt: Prompt,
  config: AnthropicProviderConfig & { apiKey: string },
  model: string,
  options?: MessagesRequestOptions,
): AsyncGenerator<ResponseEvent, void, unknown> {
  // Step 1: Build the Messages API request
  const request = buildMessagesRequest(prompt, config, model, options);

  // Step 2: Create transport and send request
  const transport = createAnthropicTransport(config);
  const response = await transport.send(request);

  // Ensure we have a response body
  if (!response.body) {
    throw new Error("No response body received from Anthropic API");
  }

  // Step 3: Parse SSE stream
  const sseEvents = parseSseStream(response.body);

  // Step 4: Adapt to Codex ResponseEvent format
  yield* adaptAnthropicStream(sseEvents);
}

// Re-export types for convenience
export type { AnthropicProviderConfig, MessagesApiRequest } from "./types.js";
export type { MessagesRequestOptions } from "./request-builder.js";
export type { ToolExecutionResult } from "./tool-result-builder.js";
export type { RetryConfig } from "./retry.js";
export { AnthropicTransportError } from "./transport.js";
export {
  buildToolResult,
  buildToolResultMessage,
  appendToolResults,
} from "./tool-result-builder.js";
export {
  withRetry,
  calculateRetryDelay,
  shouldRetry,
  DEFAULT_RETRY_CONFIG,
  RETRYABLE_STATUS_CODES,
  RETRYABLE_ERROR_TYPES,
} from "./retry.js";
