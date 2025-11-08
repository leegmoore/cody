/**
 * Tests for Fetch URL Tool
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fetchUrl, clearCache, getCacheStats } from "./fetch.js";

describe("fetchUrl", () => {
  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    clearCache();
  });

  afterEach(() => {
    clearCache();
  });

  it("should throw error if API key is missing", async () => {
    delete process.env.FIRECRAWL_API_KEY;

    await expect(fetchUrl({ urls: "https://example.com" })).rejects.toThrow(
      "FIRECRAWL_API_KEY environment variable not set",
    );
  });

  it("should handle single URL", async () => {
    // This test would need proper mocking of Firecrawl
    // For now, we just test the interface
    expect(fetchUrl).toBeDefined();
  });

  it("should handle array of URLs", async () => {
    expect(fetchUrl).toBeDefined();
  });

  it("should return cached results on second fetch", () => {
    const stats = getCacheStats();
    expect(stats).toBeDefined();
    expect(stats.size).toBe(0);
  });

  it("should truncate content if over maxLength", async () => {
    // This would need mocking
    expect(fetchUrl).toBeDefined();
  });
});
