/**
 * Model client for OpenAI Responses API and Chat Completions API.
 *
 * This module provides the ModelClient class which abstracts over
 * the two different OpenAI APIs (Responses and Chat) and provides
 * a unified interface for streaming model responses.
 *
 * Ported from: codex-rs/core/src/client.rs
 *
 * Phase 4.1 Note: This is a simplified implementation focusing on
 * core structure and types. Full HTTP streaming will be implemented
 * in Phase 4.5+ when HTTP infrastructure is ready.
 *
 * TODO(Phase 4.5+): Add full stream() implementation with HTTP
 * TODO(Phase 4.5+): Add retry logic with exponential backoff
 * TODO(Phase 4.5+): Add rate limit handling
 * TODO(Phase 4.5+): Add SSE parsing for both Responses and Chat APIs
 * TODO(Phase 4.5+): Add error response parsing
 * TODO(Phase 4.5+): Add usage limit detection
 */

import type { ModelProviderInfo, WireApi } from "./model-provider-info.js";
import { WireApi as WireApiEnum } from "./model-provider-info.js";
import type { CodexAuth } from "../auth/stub-auth.js";
import type { ReasoningEffort } from "../../protocol/config-types.js";
import { ReasoningSummary } from "../../protocol/config-types.js";
import type { Prompt, ResponseEvent } from "./client-common.js";
import type { ResponseItem } from "../../protocol/models.js";
import { streamMessages as streamAnthropicMessages } from "./messages/index.js";
import { sendResponsesRequest } from "./responses/client.js";

/**
 * Response stream type - async generator of response events.
 */
export type ResponseStream = AsyncGenerator<ResponseEvent, void, unknown>;

/**
 * Options for creating a ModelClient.
 */
export interface ResponsesApiOptions {
  /** Model provider configuration */
  provider: ModelProviderInfo;

  /** Model identifier (e.g., "gpt-4", "gpt-3.5-turbo") */
  modelSlug: string;

  /** Optional authentication */
  auth?: CodexAuth;

  /** Optional reasoning effort level */
  reasoningEffort?: ReasoningEffort;

  /** Optional reasoning summary mode (defaults to 'auto') */
  reasoningSummary?: ReasoningSummary;
}

/**
 * Model client for streaming responses from OpenAI APIs.
 *
 * Supports both:
 * - Responses API (WireApi.Responses)
 * - Chat Completions API (WireApi.Chat)
 *
 * The client automatically selects the appropriate API based on the
 * provider's wire_api configuration.
 */
export class ModelClient {
  private readonly provider: ModelProviderInfo;
  private readonly modelSlug: string;
  private readonly auth?: CodexAuth;
  private readonly reasoningEffort?: ReasoningEffort;
  private readonly reasoningSummary: ReasoningSummary;

  constructor(options: ResponsesApiOptions) {
    this.provider = options.provider;
    this.modelSlug = options.modelSlug;
    this.auth = options.auth;
    this.reasoningEffort = options.reasoningEffort;
    this.reasoningSummary = options.reasoningSummary ?? ReasoningSummary.Auto;
  }

  /**
   * Get the model provider configuration.
   */
  getProvider(): ModelProviderInfo {
    return this.provider;
  }

  /**
   * Get the model slug.
   */
  getModelSlug(): string {
    return this.modelSlug;
  }

  /**
   * Get the wire API type.
   */
  getWireApi(): WireApi {
    return this.provider.wireApi;
  }

  /**
   * Get the authentication (if configured).
   */
  getAuth(): CodexAuth | undefined {
    return this.auth;
  }

  /**
   * Get the reasoning effort level.
   */
  getReasoningEffort(): ReasoningEffort | undefined {
    return this.reasoningEffort;
  }

  /**
   * Get the reasoning summary mode.
   */
  getReasoningSummary(): ReasoningSummary {
    return this.reasoningSummary;
  }

  /**
   * Stream a model response.
   *
   * This method automatically selects between Responses API, Chat API, and
   * Messages API based on the provider's wire_api configuration.
   *
   * @param prompt - The prompt to send to the model
   * @returns A stream of response events
   */
  async stream(prompt: Prompt): Promise<ResponseStream> {
    // Route to appropriate API based on wire protocol
    switch (this.provider.wireApi) {
      case WireApiEnum.Responses:
        return this.streamResponses(prompt);
      case WireApiEnum.Chat:
        return this.streamChat(prompt);
      case WireApiEnum.Messages:
        return this.streamMessages(prompt);
      default:
        throw new Error(`Unsupported wire API: ${this.provider.wireApi}`);
    }
  }

  async sendMessage(prompt: Prompt): Promise<ResponseItem[]> {
    switch (this.provider.wireApi) {
      case WireApiEnum.Responses:
        return this.sendResponses(prompt);
      default:
        throw new Error(
          `sendMessage() not implemented for wire API ${this.provider.wireApi}`,
        );
    }
  }

  /**
   * Stream using the Responses API.
   *
   * TODO(Phase 4.5+): Implement Responses API streaming
   *
   * @param prompt - The prompt to send
   * @returns A stream of response events
   */
  private async streamResponses(_prompt: Prompt): Promise<ResponseStream> {
    throw new Error("Responses streaming not yet implemented");
  }

  /**
   * Stream using the Chat Completions API.
   *
   * TODO(Phase 4.5+): Implement Chat API streaming
   *
   * @param prompt - The prompt to send
   * @returns A stream of response events
   */
  private async streamChat(_prompt: Prompt): Promise<ResponseStream> {
    // TODO(Phase 4.5+): Implement Chat API streaming
    throw new Error(
      "streamChat() not yet implemented - deferred to Phase 4.5+",
    );
  }

  /**
   * Stream using the Anthropic Messages API.
   *
   * @param prompt - The prompt to send
   * @returns A stream of response events
   */
  private async streamMessages(prompt: Prompt): Promise<ResponseStream> {
    // Get API key from auth or environment
    const apiKey = this.getApiKeyForMessages();

    // Build config
    const providerExtras = this.provider as unknown as Record<string, unknown>;
    const config = {
      apiKey,
      baseUrl: this.provider.baseUrl,
      anthropicVersion: providerExtras.anthropicVersion as string | undefined,
      beta: providerExtras.beta as string[] | undefined,
    };

    // Build options from prompt metadata
    const promptExtras = prompt as unknown as Record<string, unknown>;
    const options = {
      temperature: promptExtras.temperature as number | undefined,
      topP: promptExtras.topP as number | undefined,
      topK: promptExtras.topK as number | undefined,
      stopSequences: promptExtras.stopSequences as string[] | undefined,
      traceId: promptExtras.traceId as string | undefined,
      toolChoice: promptExtras.toolChoice as
        | "auto"
        | "none"
        | "any"
        | undefined,
    };

    // Return async generator as ResponseStream
    return streamAnthropicMessages(prompt, config, this.modelSlug, options);
  }

  /**
   * Get API key for Messages API from auth or environment.
   */
  private getApiKeyForMessages(): string {
    // Try experimental bearer token first (for testing)
    if (this.provider.experimentalBearerToken) {
      return this.provider.experimentalBearerToken;
    }

    // Try environment variable
    const envKey = this.provider.envKey || "ANTHROPIC_API_KEY";
    const apiKey = process.env[envKey];

    if (!apiKey) {
      throw new Error(
        `Missing API key for Anthropic. Set ${envKey} environment variable or configure experimentalBearerToken.`,
      );
    }

    return apiKey;
  }

  private async sendResponses(prompt: Prompt): Promise<ResponseItem[]> {
    const apiKey = await this.getOpenAiApiKey();
    return sendResponsesRequest(prompt, {
      provider: this.provider,
      model: this.modelSlug,
      apiKey,
      reasoningEffort: this.reasoningEffort,
      reasoningSummary: this.reasoningSummary,
    });
  }

  private async getOpenAiApiKey(): Promise<string> {
    if (this.auth) {
      const token = (await this.auth.getToken()).trim();
      if (token) {
        return token;
      }
    }

    const envKey = this.provider.envKey ?? "OPENAI_API_KEY";
    const apiKey = process.env[envKey]?.trim();
    if (apiKey) {
      return apiKey;
    }

    throw new Error(
      `Missing API key for provider ${this.provider.name}. Set ${envKey} or configure Codex auth.`,
    );
  }
}
