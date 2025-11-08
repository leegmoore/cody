/**
 * Web Search Tool - Perplexity API Integration
 *
 * Performs web search using Perplexity API and returns ranked results.
 * Supports single or parallel queries with optional prefetch caching.
 */

export interface WebSearchParams {
  query: string | string[];
  maxResults?: number; // Default 10
  prefetch?: number; // Default 3 (top N to cache)
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  relevanceScore?: number;
}

export interface WebSearchResult {
  results: SearchResult[];
}

/**
 * Perplexity API response type
 */
type PerplexityResponse = {
  citations?: string[];
  choices?: Array<{ message?: { content?: string } }>;
};

/**
 * Performs web search using Perplexity API
 */
export async function webSearch(
  params: WebSearchParams,
): Promise<WebSearchResult> {
  const { query, maxResults = 10, prefetch = 3 } = params;

  // Get API key from environment
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY environment variable not set");
  }

  // Handle single or multiple queries
  const queries = Array.isArray(query) ? query : [query];

  // Execute searches in parallel
  const searchPromises = queries.map((q) =>
    executePerplexitySearch(q, maxResults, apiKey),
  );
  const searchResults = await Promise.all(searchPromises);

  // Flatten and deduplicate results
  const allResults = searchResults.flat();
  const uniqueResults = deduplicateResults(allResults);

  // Sort by relevance score (if available)
  const sortedResults = uniqueResults.sort(
    (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0),
  );

  // Limit to maxResults
  const limitedResults = sortedResults.slice(0, maxResults);

  // Background prefetch (non-blocking)
  if (prefetch > 0) {
    const urlsToPrefetch = limitedResults.slice(0, prefetch).map((r) => r.url);
    prefetchUrls(urlsToPrefetch).catch((err) => {
      console.warn("Prefetch failed:", err.message);
    });
  }

  return { results: limitedResults };
}

/**
 * Execute a single Perplexity search query
 */
async function executePerplexitySearch(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> {
  // Perplexity API endpoint for search
  const url = "https://api.perplexity.ai/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content:
            "You are a search engine. Return search results with titles, URLs, and snippets.",
        },
        {
          role: "user",
          content: query,
        },
      ],
      return_citations: true,
      return_images: false,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as PerplexityResponse;

  // Parse results from Perplexity response
  const results = parsePerplexityResponse(data, query, maxResults);

  return results;
}

/**
 * Parse Perplexity API response into SearchResult format
 */
function parsePerplexityResponse(
  data: PerplexityResponse,
  query: string,
  maxResults: number,
): SearchResult[] {
  const results: SearchResult[] = [];

  // Extract citations from response
  if (data.citations && Array.isArray(data.citations)) {
    for (let i = 0; i < Math.min(data.citations.length, maxResults); i++) {
      const citation = data.citations[i];

      // Extract title from content or use domain
      const url = citation;
      const title = extractTitleFromUrl(url);

      // Get snippet from response content
      const content = data.choices?.[0]?.message?.content || "";
      const snippet = extractSnippetForUrl(content, url, query);

      results.push({
        url,
        title,
        snippet,
        relevanceScore: maxResults - i, // Higher score for earlier results
      });
    }
  }

  return results;
}

/**
 * Extract title from URL
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace("www.", "");
    const path = urlObj.pathname.split("/").filter(Boolean).join(" - ");
    return path ? `${domain}: ${path}` : domain;
  } catch {
    return url;
  }
}

/**
 * Extract snippet from content for a specific URL
 */
function extractSnippetForUrl(
  content: string,
  _url: string,
  query: string,
): string {
  // Find sentences containing the query or relevant to the URL
  const sentences = content.split(/[.!?]+/).filter(Boolean);

  // Prefer sentences mentioning the query
  const relevantSentences = sentences.filter((s) =>
    s.toLowerCase().includes(query.toLowerCase()),
  );

  const snippet = (relevantSentences[0] || sentences[0] || "").trim();

  // Truncate to ~200-300 chars
  if (snippet.length > 300) {
    return snippet.substring(0, 297) + "...";
  }

  return snippet || "No description available.";
}

/**
 * Deduplicate search results by URL
 */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];

  for (const result of results) {
    const normalizedUrl = normalizeUrl(result.url);
    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      unique.push(result);
    }
  }

  return unique;
}

/**
 * Normalize URL for deduplication
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove trailing slashes, fragments, and common tracking params
    urlObj.hash = "";
    urlObj.search = "";
    return urlObj.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Prefetch URLs in background (non-blocking)
 */
async function prefetchUrls(urls: string[]): Promise<void> {
  // Import fetchUrl dynamically to avoid circular dependency
  const { fetchUrl } = await import("./fetch.js");

  // Fetch URLs in background
  await fetchUrl({ urls });
}
