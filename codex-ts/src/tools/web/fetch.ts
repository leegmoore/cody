/**
 * URL Fetch Tool - Firecrawl Integration with Caching
 *
 * Fetches URL content via Firecrawl with in-memory caching.
 * Auto-assigns fileKeys and tracks fetches on announcement board.
 */

import FirecrawlApp from 'firecrawl';
import { v4 as uuidv4 } from 'uuid';

export interface FetchUrlParams {
  urls: string | string[];
  maxLength?: number; // Default 50KB
}

export interface FetchedDocument {
  fileKey: string;
  url: string;
  title: string;
  content: string;
  tokens: number;
  cached: boolean;
}

export interface FetchUrlResult {
  fetches: FetchedDocument[];
}

/**
 * In-memory cache for fetched URLs
 * Map: normalized URL -> cached document
 */
const urlCache = new Map<string, CachedDocument>();

interface CachedDocument {
  url: string;
  title: string;
  content: string;
  tokens: number;
  scrapedAt: Date;
}

/**
 * Cache TTL: 24 hours
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Fetch URLs via Firecrawl with caching
 */
export async function fetchUrl(params: FetchUrlParams): Promise<FetchUrlResult> {
  const { urls, maxLength = 50 * 1024 } = params; // Default 50KB

  // Handle single or multiple URLs
  const urlList = Array.isArray(urls) ? urls : [urls];

  // Fetch URLs in parallel
  const fetchPromises = urlList.map(url => fetchSingleUrl(url, maxLength));
  const fetches = await Promise.all(fetchPromises);

  return { fetches };
}

/**
 * Fetch a single URL
 */
async function fetchSingleUrl(url: string, maxLength: number): Promise<FetchedDocument> {
  const normalizedUrl = normalizeUrl(url);

  // Check cache first
  const cached = getCachedDocument(normalizedUrl);
  if (cached) {
    const fileKey = generateFileKey(url);

    return {
      fileKey,
      url,
      title: cached.title,
      content: truncateContent(cached.content, maxLength),
      tokens: cached.tokens,
      cached: true,
    };
  }

  // Fetch from Firecrawl
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY environment variable not set');
  }

  const firecrawl = new FirecrawlApp({ apiKey });

  try {
    // Scrape the URL
    const result = await firecrawl.scrape(url, {
      formats: ['markdown'],
      onlyMainContent: true,
    }) as any;

    if (!result.success) {
      throw new Error(`Firecrawl scrape failed for ${url}`);
    }

    const content = result.markdown || '';
    const title = result.metadata?.title || extractTitleFromUrl(url);
    const tokens = estimateTokens(content);

    // Cache the result
    cacheDocument(normalizedUrl, {
      url,
      title,
      content,
      tokens,
      scrapedAt: new Date(),
    });

    const fileKey = generateFileKey(url);

    // Truncate if needed
    const truncatedContent = truncateContent(content, maxLength);

    return {
      fileKey,
      url,
      title,
      content: truncatedContent,
      tokens: estimateTokens(truncatedContent),
      cached: false,
    };
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${(error as Error).message}`);
  }
}

/**
 * Get cached document if still valid
 */
function getCachedDocument(normalizedUrl: string): CachedDocument | null {
  const cached = urlCache.get(normalizedUrl);

  if (!cached) {
    return null;
  }

  // Check if cache is expired
  const age = Date.now() - cached.scrapedAt.getTime();
  if (age > CACHE_TTL_MS) {
    urlCache.delete(normalizedUrl);
    return null;
  }

  return cached;
}

/**
 * Cache a document
 */
function cacheDocument(normalizedUrl: string, doc: CachedDocument): void {
  urlCache.set(normalizedUrl, doc);
}

/**
 * Normalize URL for caching
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove fragments and normalize
    urlObj.hash = '';
    return urlObj.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Generate a unique fileKey for a URL
 */
function generateFileKey(_url: string): string {
  // Use UUID for unique file keys
  return `file_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
}

/**
 * Extract title from URL as fallback
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname.split('/').filter(Boolean).pop() || '';
    return path ? `${domain}/${path}` : domain;
  } catch {
    return url;
  }
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Truncate content to max length
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  return content.substring(0, maxLength) + '\n\n[Content truncated...]';
}

/**
 * Export cache for testing
 */
export function getCacheStats() {
  return {
    size: urlCache.size,
    entries: Array.from(urlCache.keys()),
  };
}

/**
 * Clear cache (for testing)
 */
export function clearCache(): void {
  urlCache.clear();
}
