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

import type { ModelProviderInfo, WireApi } from './model-provider-info.js'
import type { CodexAuth } from '../auth/stub-auth.js'
import type { ReasoningEffort, ReasoningSummary } from '../../protocol/config-types.js'
import type { Prompt, ResponseStream } from './client-common.js'

/**
 * Options for creating a ModelClient.
 */
export interface ResponsesApiOptions {
  /** Model provider configuration */
  provider: ModelProviderInfo

  /** Model identifier (e.g., "gpt-4", "gpt-3.5-turbo") */
  modelSlug: string

  /** Optional authentication */
  auth?: CodexAuth

  /** Optional reasoning effort level */
  reasoningEffort?: ReasoningEffort

  /** Optional reasoning summary mode (defaults to 'auto') */
  reasoningSummary?: ReasoningSummary
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
  private readonly provider: ModelProviderInfo
  private readonly modelSlug: string
  private readonly auth?: CodexAuth
  private readonly reasoningEffort?: ReasoningEffort
  private readonly reasoningSummary: ReasoningSummary

  constructor(options: ResponsesApiOptions) {
    this.provider = options.provider
    this.modelSlug = options.modelSlug
    this.auth = options.auth
    this.reasoningEffort = options.reasoningEffort
    this.reasoningSummary = options.reasoningSummary ?? 'auto'
  }

  /**
   * Get the model provider configuration.
   */
  getProvider(): ModelProviderInfo {
    return this.provider
  }

  /**
   * Get the model slug.
   */
  getModelSlug(): string {
    return this.modelSlug
  }

  /**
   * Get the wire API type.
   */
  getWireApi(): WireApi {
    return this.provider.wireApi
  }

  /**
   * Get the authentication (if configured).
   */
  getAuth(): CodexAuth | undefined {
    return this.auth
  }

  /**
   * Get the reasoning effort level.
   */
  getReasoningEffort(): ReasoningEffort | undefined {
    return this.reasoningEffort
  }

  /**
   * Get the reasoning summary mode.
   */
  getReasoningSummary(): ReasoningSummary {
    return this.reasoningSummary
  }

  /**
   * Stream a model response.
   *
   * This method automatically selects between Responses API and Chat API
   * based on the provider's wire_api configuration.
   *
   * TODO(Phase 4.5+): Implement full streaming with HTTP client
   *
   * @param prompt - The prompt to send to the model
   * @returns A stream of response events
   */
  async stream(prompt: Prompt): Promise<ResponseStream> {
    // TODO(Phase 4.5+): Implement actual streaming
    // For now, this is a stub that will be implemented in Phase 4.5+
    // when we have the HTTP client infrastructure ready.
    throw new Error('stream() not yet implemented - deferred to Phase 4.5+')
  }

  /**
   * Stream using the Responses API.
   *
   * TODO(Phase 4.5+): Implement Responses API streaming
   *
   * @param prompt - The prompt to send
   * @returns A stream of response events
   */
  private async streamResponses(prompt: Prompt): Promise<ResponseStream> {
    // TODO(Phase 4.5+): Implement Responses API streaming
    throw new Error('streamResponses() not yet implemented - deferred to Phase 4.5+')
  }

  /**
   * Stream using the Chat Completions API.
   *
   * TODO(Phase 4.5+): Implement Chat API streaming
   *
   * @param prompt - The prompt to send
   * @returns A stream of response events
   */
  private async streamChat(prompt: Prompt): Promise<ResponseStream> {
    // TODO(Phase 4.5+): Implement Chat API streaming
    throw new Error('streamChat() not yet implemented - deferred to Phase 4.5+')
  }
}
