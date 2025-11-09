# Phase 4.7 Checklist

**Status:** ✅ COMPLETE

---

## Prerequisites

- [x] Phase 4.6 complete (11 tools + packs)
- [x] Perplexity API key available (via env var)
- [x] Firecrawl API key available (via env var)
- [x] In-memory cache (Map) instead of Redis
- [x] Review Phase 4.7 plan

---

## Setup

- [x] Install dependencies: npm install firecrawl (Note: Used 'firecrawl', not '@perplexity-ai/sdk' or 'firecrawl-api')
- [x] Configure API keys in environment (PERPLEXITY_API_KEY, FIRECRAWL_API_KEY, OPENROUTER_API_KEY)
- [x] Used in-memory Map cache instead of Redis
- [x] Create src/tools/web/ directory
- [x] Create src/tools/docs/ directory
- [x] Create src/tools/agents/ directory
- [x] Create src/tools/prompts/ directory

---

## Tool 1: webSearch

### Implementation
- [x] Create src/tools/web/search.ts
- [x] Integrate Perplexity API (REST API, no SDK available)
- [x] Parse search results (title, URL, snippet, score)
- [x] Implement parallel query support (string[])
- [x] Implement prefetch logic (background Firecrawl)
- [x] Add to Map cache (async, non-blocking)
- [x] Handle API errors gracefully
- [x] Create interface types

### Testing
- [x] Create search.test.ts
- [x] Test single query
- [x] Test parallel queries
- [x] Test prefetch behavior
- [x] Test error handling
- [x] Mock Perplexity API
- [x] Verify tests passing (4 tests)

---

## Tool 2: fetchUrl

### Implementation
- [x] Create src/tools/web/fetch.ts
- [x] Check Map cache (URL-keyed)
- [x] Integrate Firecrawl API
- [x] Normalize URLs for caching
- [x] Auto-assign fileKeys (UUID-based)
- [x] Implement parallel fetch (string[])
- [x] Truncate long content (maxLength param)
- [x] Token counting (estimation)
- [x] Cache results in Map (24hr TTL)
- [x] Return with fileKey, cached flag

### Announcement Board Integration
- [-] Create src/tools/web/announcement-board.ts (Deferred to future phase)
- [-] Track fetched items with fileKeys
- [-] Implement TTL (5 turns)
- [-] Format for context injection
- [-] Include usage hints

### Testing
- [x] Create fetch.test.ts
- [x] Test cache hits
- [x] Test cache misses
- [x] Test parallel fetches
- [x] Test fileKey assignment
- [x] Test truncation
- [x] Verify tests passing (5 tests)

---

## Tool 3-10: Stubs (File Cabinet, Prompts, Agents)

### saveToFC, fetchFromFC, writeFile (Stubs)
- [x] Create src/tools/docs/file-cabinet.ts
- [x] Define all interfaces (SaveToFC, FetchFromFC, WriteFile)
- [x] Implement stubs with TODO comments
- [x] Return mock success/data
- [x] Parameter validation
- [x] Create tests
- [x] Verify tests passing

### savePrompts, getPrompts (Stubs)
- [x] Create src/tools/prompts/index.ts
- [x] Define interfaces
- [x] Implement stubs with validation
- [x] Create tests
- [x] Verify tests passing

### launchSync, launchAsync (Stubs)
- [x] Create src/tools/agents/launch.ts
- [x] Define interfaces
- [x] Implement stubs with validation
- [x] Create tests
- [x] Verify tests passing

### llmChat (Full Implementation)
- [x] Create src/tools/agents/llm.ts
- [x] Integrate OpenRouter API
- [x] Support custom models
- [x] Token usage tracking
- [x] Create tests
- [x] Verify tests passing

---

## In-Memory Cache Layer

- [x] Implemented in src/tools/web/fetch.ts
- [x] URL normalization (strip fragments, lowercase, etc.)
- [x] Get/set with TTL (24hr)
- [x] Error handling
- [x] Cache stats utilities
- [x] Tests included

---

## Integration

- [x] Add all 10 tools to registry
- [-] Update tool packs (deferred to future phase)
- [-] Wire announcement board to context builder (deferred)
- [x] Verify tools load correctly
- [x] Tests passing

---

## Documentation

- [x] Update CHECKLIST.md
- [x] Update STATUS.md
- [x] Update PORT_LOG_MASTER.md
- [-] Update tool-api-reference.md (deferred)
- [x] Document caching strategy (in code comments)
- [-] Example scripts (deferred)

---

## Final

- [x] All 10 tools implemented (3 full, 7 stubs)
- [x] In-memory Map cache working
- [x] Perplexity integration working (REST API)
- [x] Firecrawl integration working
- [x] OpenRouter integration working
- [x] 19+ tests passing
- [x] Documentation updated
- [x] Update PORT_LOG_MASTER.md
- [x] Commit and push
- [x] Phase 4.7 COMPLETE!
