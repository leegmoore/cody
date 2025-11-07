/**
 * Transport layer for Anthropic Messages API
 *
 * Handles HTTP requests with authentication, headers, and error handling.
 *
 * Design reference: MESSAGES_API_INTEGRATION_DESIGN_CODEX.md Section 2.12
 */

import type { MessagesApiRequest, AnthropicProviderConfig } from "./types.js";
import { ANTHROPIC_DEFAULTS } from "./types.js";

/**
 * Transport options for Anthropic API requests.
 */
export interface TransportOptions extends AnthropicProviderConfig {
  /** API key for authentication (required) */
  apiKey: string;
}

/**
 * Anthropic API transport error.
 */
export class AnthropicTransportError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorType?: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = "AnthropicTransportError";
  }
}

/**
 * Transport interface for sending requests to Anthropic.
 */
export interface AnthropicTransport {
  /**
   * Send a request to the Anthropic Messages API.
   *
   * @param request - The Messages API request
   * @returns Response with streaming body
   */
  send(request: MessagesApiRequest): Promise<Response>;
}

/**
 * Create an Anthropic Messages API transport.
 *
 * @param options - Transport configuration options
 * @returns Transport instance
 */
export function createAnthropicTransport(
  options: TransportOptions,
): AnthropicTransport {
  const {
    apiKey,
    baseUrl = ANTHROPIC_DEFAULTS.BASE_URL,
    anthropicVersion = ANTHROPIC_DEFAULTS.API_VERSION,
    beta,
  } = options;

  if (!apiKey) {
    throw new Error("API key is required for Anthropic transport");
  }

  return {
    async send(request: MessagesApiRequest): Promise<Response> {
      // Build headers
      const headers: Record<string, string> = {
        "x-api-key": apiKey,
        "anthropic-version": anthropicVersion,
        "content-type": "application/json",
      };

      // Add beta headers if provided
      if (beta && beta.length > 0) {
        headers["anthropic-beta"] = beta.join(",");
      }

      // Build URL
      const url = `${baseUrl}/v1/messages`;

      // Make request
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(request),
        });
      } catch (err) {
        throw new AnthropicTransportError(
          `Network failure: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Handle non-2xx responses
      if (!response.ok) {
        await handleErrorResponse(response);
      }

      return response;
    },
  };
}

/**
 * Handle error responses from Anthropic API.
 *
 * @param response - Failed HTTP response
 * @throws AnthropicTransportError
 */
async function handleErrorResponse(response: Response): Promise<never> {
  const statusCode = response.status;
  let errorData: any;

  try {
    errorData = await response.json();
  } catch {
    throw new AnthropicTransportError(
      `HTTP ${statusCode}: Failed to parse error response`,
      statusCode,
    );
  }

  const errorType = errorData?.error?.type || "unknown_error";
  const errorMessage = errorData?.error?.message || `HTTP ${statusCode}`;
  const requestId = response.headers.get("request-id") || undefined;

  // Map error types to user-friendly messages
  let message: string;
  switch (errorType) {
    case "authentication_error":
      message = `Authentication failed: ${errorMessage}`;
      break;
    case "rate_limit_error":
      const retryAfter = response.headers.get("retry-after");
      message = `Rate limit exceeded: ${errorMessage}`;
      if (retryAfter) {
        message += ` (retry after ${retryAfter}s)`;
      }
      break;
    case "api_error":
      message = `Anthropic API error: ${errorMessage}`;
      break;
    case "overload_error":
      message = `Anthropic servers overloaded: ${errorMessage}`;
      break;
    case "invalid_request_error":
      message = `Invalid request: ${errorMessage}`;
      break;
    case "permission_error":
      message = `Permission denied: ${errorMessage}`;
      break;
    case "not_found_error":
      message = `Resource not found: ${errorMessage}`;
      break;
    default:
      message = `Anthropic error (${errorType}): ${errorMessage}`;
  }

  throw new AnthropicTransportError(message, statusCode, errorType, requestId);
}
