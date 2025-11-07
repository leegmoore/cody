/**
 * Tests for LLM Chat Tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { llmChat } from './llm.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('llmChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.TEST_MODEL_FLASH = 'google/gemini-2.0-flash-001';
  });

  it('should throw error if API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;

    await expect(
      llmChat({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow('OPENROUTER_API_KEY environment variable not set');
  });

  it('should call OpenRouter API with correct parameters', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Test response' } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await llmChat({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.content).toBe('Test response');
    expect(result.usage.totalTokens).toBe(30);
  });

  it('should handle API errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(
      llmChat({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow('OpenRouter API error');
  });
});
