/**
 * Tests for client module (ModelClient + Responses API)
 *
 * Ported from: codex-rs/core/src/client.rs
 *
 * Phase 4.1 Note: This is a simplified implementation focusing on
 * core structure and types. Full HTTP streaming will be implemented
 * in Phase 4.5+ when HTTP infrastructure is ready.
 */

import { describe, it, expect } from 'vitest'
import { ModelClient, type ResponsesApiOptions } from './client.js'
import { WireApi, type ModelProviderInfo } from './model-provider-info.js'
import { AuthMode, CodexAuth } from '../auth/stub-auth.js'
import type { Prompt } from './client-common.js'

describe('client', () => {
  describe('ModelClient', () => {
    const createTestProvider = (): ModelProviderInfo => ({
      name: 'Test Provider',
      wireApi: WireApi.Responses,
      requiresOpenaiAuth: false,
    })

    it('should create a ModelClient instance', () => {
      const provider = createTestProvider()
      const client = new ModelClient({
        provider,
        modelSlug: 'gpt-4',
      })

      expect(client).toBeDefined()
      expect(client.getModelSlug()).toBe('gpt-4')
    })

    it('should get provider info', () => {
      const provider = createTestProvider()
      const client = new ModelClient({
        provider,
        modelSlug: 'gpt-4',
      })

      expect(client.getProvider()).toEqual(provider)
    })

    it('should get wire API type', () => {
      const provider = createTestProvider()
      const client = new ModelClient({
        provider,
        modelSlug: 'gpt-4',
      })

      expect(client.getWireApi()).toBe(WireApi.Responses)
    })

    it('should support Chat API provider', () => {
      const provider: ModelProviderInfo = {
        name: 'Chat Provider',
        wireApi: WireApi.Chat,
        requiresOpenaiAuth: false,
      }

      const client = new ModelClient({
        provider,
        modelSlug: 'gpt-3.5-turbo',
      })

      expect(client.getWireApi()).toBe(WireApi.Chat)
    })

    it('should store auth if provided', () => {
      const provider = createTestProvider()
      const auth = CodexAuth.fromApiKey('sk-test')

      const client = new ModelClient({
        provider,
        modelSlug: 'gpt-4',
        auth,
      })

      expect(client.getAuth()).toBeDefined()
      expect(client.getAuth()?.mode).toBe(AuthMode.ApiKey)
    })

    it('should work without auth', () => {
      const provider = createTestProvider()

      const client = new ModelClient({
        provider,
        modelSlug: 'gpt-4',
      })

      expect(client.getAuth()).toBeUndefined()
    })

    it('should support reasoning effort', () => {
      const provider = createTestProvider()

      const client = new ModelClient({
        provider,
        modelSlug: 'gpt-4',
        reasoningEffort: 'high',
      })

      expect(client.getReasoningEffort()).toBe('high')
    })

    it('should support reasoning summary', () => {
      const provider = createTestProvider()

      const client = new ModelClient({
        provider,
        modelSlug: 'gpt-4',
        reasoningSummary: 'detailed',
      })

      expect(client.getReasoningSummary()).toBe('detailed')
    })

    it('should default reasoning summary to auto', () => {
      const provider = createTestProvider()

      const client = new ModelClient({
        provider,
        modelSlug: 'gpt-4',
      })

      expect(client.getReasoningSummary()).toBe('auto')
    })
  })

  describe('ResponsesApiOptions', () => {
    it('should create minimal options', () => {
      const options: ResponsesApiOptions = {
        provider: {
          name: 'OpenAI',
          wireApi: WireApi.Responses,
          requiresOpenaiAuth: true,
        },
        modelSlug: 'gpt-4',
      }

      expect(options.modelSlug).toBe('gpt-4')
      expect(options.provider.wireApi).toBe(WireApi.Responses)
    })

    it('should support all optional fields', () => {
      const auth = CodexAuth.fromApiKey('sk-test')

      const options: ResponsesApiOptions = {
        provider: {
          name: 'OpenAI',
          wireApi: WireApi.Responses,
          requiresOpenaiAuth: true,
        },
        modelSlug: 'gpt-4',
        auth,
        reasoningEffort: 'medium',
        reasoningSummary: 'concise',
      }

      expect(options.auth).toBeDefined()
      expect(options.reasoningEffort).toBe('medium')
      expect(options.reasoningSummary).toBe('concise')
    })
  })
})
