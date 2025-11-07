# Phase 4.7 Checklist

**Status:** Not Started

---

## Prerequisites

- [x] Phase 4.6 complete (11 tools + packs)
- [ ] Perplexity API key available
- [ ] Firecrawl API key available
- [ ] Redis installed/accessible
- [ ] Review Phase 4.7 plan

---

## Setup

- [ ] Install dependencies: npm install @perplexity-ai/sdk firecrawl-api ioredis
- [ ] Configure API keys in environment
- [ ] Setup Redis connection
- [ ] Create src/tools/web/ directory
- [ ] Create src/tools/docs/ directory

---

## Tool 1: webSearch

### Implementation
- [ ] Create src/tools/web/search.ts
- [ ] Integrate Perplexity API
- [ ] Parse search results (title, URL, snippet, score)
- [ ] Implement parallel query support (string[])
- [ ] Implement prefetch logic (background Firecrawl)
- [ ] Add to Redis cache (async, non-blocking)
- [ ] Handle API errors gracefully
- [ ] Create interface types

### Testing
- [ ] Create search.test.ts
- [ ] Test single query (20 tests)
- [ ] Test parallel queries
- [ ] Test prefetch behavior
- [ ] Test error handling
- [ ] Mock Perplexity API
- [ ] Mock Redis
- [ ] Verify tests passing

---

## Tool 2: fetchUrl

### Implementation
- [ ] Create src/tools/web/fetch.ts
- [ ] Check Redis cache (URL-keyed)
- [ ] Integrate Firecrawl API
- [ ] Normalize URLs for caching
- [ ] Auto-assign fileKeys (uuid or hash-based)
- [ ] Implement parallel fetch (string[])
- [ ] Truncate long content (maxLength param)
- [ ] Token counting
- [ ] Cache results in Redis (24hr TTL)
- [ ] Return with fileKey, cached flag

### Announcement Board Integration
- [ ] Create src/tools/web/announcement-board.ts
- [ ] Track fetched items with fileKeys
- [ ] Implement TTL (5 turns)
- [ ] Format for context injection
- [ ] Include usage hints

### Testing
- [ ] Create fetch.test.ts
- [ ] Test cache hits (25 tests)
- [ ] Test cache misses
- [ ] Test parallel fetches
- [ ] Test fileKey assignment
- [ ] Test truncation
- [ ] Test announcement board
- [ ] Mock Firecrawl API
- [ ] Mock Redis
- [ ] Verify tests passing

---

## Tool 3-5: File Cabinet (Stubs)

### saveToFC (Stub)
- [ ] Create src/tools/docs/file-cabinet.ts
- [ ] Define SaveToFCParams interface
- [ ] Implement stub (TODO comment for full impl)
- [ ] Return mock success
- [ ] Create tests (5 tests)
- [ ] Test parameter validation
- [ ] Verify tests passing

### fetchFromFC (Stub)
- [ ] Define FetchFromFCParams interface
- [ ] Implement stub (returns "not implemented")
- [ ] Create tests (5 tests)
- [ ] Test fileKey validation
- [ ] Verify tests passing

### writeFile (Stub)
- [ ] Define WriteFileParams interface (fileKey + path)
- [ ] Implement stub (TODO for fs integration)
- [ ] Create tests (5 tests)
- [ ] Test parameter validation
- [ ] Verify tests passing

---

## Redis Cache Layer

- [ ] Create src/tools/web/cache.ts
- [ ] Implement RedisCache class
- [ ] URL normalization (strip fragments, lowercase, etc.)
- [ ] Get/set with TTL
- [ ] Connection pooling
- [ ] Error handling (fallback if Redis unavailable)
- [ ] Create tests (15 tests)
- [ ] Test cache operations
- [ ] Test TTL expiration
- [ ] Test connection failures
- [ ] Verify tests passing

---

## Integration

- [ ] Add all 5 tools to registry
- [ ] Update tool packs (add to 'research' pack)
- [ ] Wire announcement board to context builder
- [ ] Test all tools from script harness
- [ ] Create integration tests (10 tests)
- [ ] Verify end-to-end flow works

---

## Documentation

- [ ] Update tool-api-reference.md (add 5 tools)
- [ ] Document Redis setup
- [ ] Document API key configuration
- [ ] Document caching strategy
- [ ] Document announcement board format
- [ ] Example scripts using web tools

---

## Final

- [ ] All 5 tools implemented (3 full, 2 stubs)
- [ ] Redis cache working
- [ ] Perplexity integration tested
- [ ] Firecrawl integration tested
- [ ] 90+ tests passing
- [ ] Documentation complete
- [ ] Update PORT_LOG_MASTER.md
- [ ] Commit and push
- [ ] Phase 4.7 COMPLETE!
