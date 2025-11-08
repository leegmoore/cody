/**
 * Tests for Web Search Tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webSearch } from './search.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('webSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PERPLEXITY_API_KEY = 'test-key';
  });

  it('should throw error if API key is missing', async () => {
    delete process.env.PERPLEXITY_API_KEY;

    await expect(webSearch({ query: 'test' })).rejects.toThrow(
      'PERPLEXITY_API_KEY environment variable not set'
    );
  });

  it('should handle single query', async () => {
    const mockResponse = {
      citations: ['https://example.com', 'https://test.com'],
      choices: [{ message: { content: 'Test content' } }],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await webSearch({ query: 'test query' });

    expect(result.results).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('should handle API errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(webSearch({ query: 'test' })).rejects.toThrow(
      'Perplexity API error'
    );
  });

  it('should limit results to maxResults', async () => {
    const mockResponse = {
      citations: Array.from({ length: 20 }, (_, i) => `https://example${i}.com`),
      choices: [{ message: { content: 'Test content' } }],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await webSearch({ query: 'test', maxResults: 5 });

    expect(result.results.length).toBeLessThanOrEqual(5);
  });
});
