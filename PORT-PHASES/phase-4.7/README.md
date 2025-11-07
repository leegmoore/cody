# Phase 4.7: Web Search & Document Tools

## Overview

Phase 4.7 implements web search with intelligent caching and document management tools for efficient information retrieval and storage.

**Prerequisites:** Phase 4.6 complete (11 tools + tool packs)

## Goals

1. **Web search** - Perplexity API integration with ranked results
2. **URL fetching** - Firecrawl integration with Redis caching
3. **File Cabinet stubs** - Document storage/retrieval interface (full implementation later)
4. **Cache layer** - Redis-based URL content caching (24hr TTL)

## Tools to Implement

### 1. webSearch (Primary Implementation)

**What it does:**
- Calls Perplexity API with query
- Returns ranked SERP results (titles, URLs, snippets)
- Background prefetch: Top N results → Firecrawl → Redis cache
- Supports single query or parallel queries (string | string[])

**Interface:**
```typescript
webSearch(params: {
  query: string | string[];
  maxResults?: number;      // Default 10
  prefetch?: number;        // Default 3 (top N cached)
}): Promise<{
  results: Array<{
    url: string;
    title: string;
    snippet: string;        // 200-300 chars
    relevanceScore?: number;
  }>;
}>
```

**Dependencies:**
- Perplexity API key
- Redis connection

### 2. fetchUrl (Primary Implementation)

**What it does:**
- Fetch URL content via Firecrawl
- Check Redis cache first (URL-keyed, 24hr TTL)
- Auto-assign fileKey per URL
- Add to announcement board (5 turn TTL)
- Supports single URL or parallel fetches (string | string[])

**Interface:**
```typescript
fetchUrl(params: {
  urls: string | string[];
  maxLength?: number;       // Truncate long pages (default 50KB)
}): Promise<{
  fetches: Array<{
    fileKey: string;        // Auto-assigned
    url: string;
    title: string;
    content: string;        // Markdown
    tokens: number;
    cached: boolean;
  }>;
}>
```

**Dependencies:**
- Firecrawl API key
- Redis connection

### 3-5. File Cabinet Tools (Stubs)

**saveToFC** - Save fileKey to permanent storage
**fetchFromFC** - Retrieve by fileKey
**writeFile** - Write fileKey content to filesystem

**Stub implementation:**
- Proper TypeScript interfaces
- Clear TODO comments
- Return mock success (actual storage deferred)

## Architecture

**Cache Strategy:**
```
Redis (URL-keyed):
  key: normalized URL
  value: {content, title, scrapedAt, tokens}
  TTL: 24 hours

Announcement Board (in-memory):
  Recent fetches with fileKeys
  TTL: 5 turns
  Shows what's available without full content

File Cabinet (stub → later implementation):
  fileKey → {url, content, note, savedAt}
  TTL: 30 days
```

**Prefetch Pattern:**
```
webSearch() called
  → Perplexity returns 10 results
  → Return snippets immediately
  → Background: Firecrawl top 3 → Redis
  → Later fetchUrl() = instant (cached)
```

## Success Criteria

- [ ] Perplexity API integration working
- [ ] Firecrawl API integration working
- [ ] Redis cache working (URL-keyed, 24hr TTL)
- [ ] Prefetch strategy functional
- [ ] fetchUrl uses cache
- [ ] fileKey assignment working
- [ ] Announcement board integration
- [ ] File Cabinet stubs with proper interfaces
- [ ] Tests passing (60+ tests)
- [ ] Documentation complete
