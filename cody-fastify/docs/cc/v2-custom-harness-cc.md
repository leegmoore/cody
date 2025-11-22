# Core 2.0 Custom Test Harness - Technical Design

**Version:** 1.0
**Status:** Design Phase
**Target Model:** gpt-5.1-codex-max
**Last Updated:** 2025-01-22

---

## Executive Summary

This document defines the technical design for a **custom integration test harness** for the Core 2.0 streaming architecture. The harness enables comprehensive Test-Driven Development (TDD) by exercising the full pipeline (Fastify → Redis → Workers → Convex → SSE) while mocking ONLY external LLM API calls.

**Key Design Principle:**
> Mock the boundaries you cannot control (LLM APIs). Exercise everything else with real local infrastructure.

**Primary Goals:**
1. Enable fast, deterministic TDD workflow
2. Validate full pipeline integration (not just units)
3. Catch serialization bugs, schema mismatches, race conditions
4. Support comprehensive edge case testing (errors, timeouts, malformed data)

---

## Architecture Overview

### The Three-Layer Testing Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1: Custom Harness Tests (PRIMARY - This Design)              │
│ ─────────────────────────────────────────────────────────────────── │
│ What's Mocked:  LLM API calls (OpenAI, Anthropic, OpenRouter)      │
│ What's Real:    Redis, Convex, Fastify, Adapters, Workers, SSE     │
│ Technology:     TypeScript + Playwright (or Vitest + Supertest)    │
│ Speed:          Fast (< 5 sec for full suite)                       │
│ Coverage:       Comprehensive (all scenarios, edge cases, errors)   │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 2: Provider Integration Tests (VALIDATION)                   │
│ ─────────────────────────────────────────────────────────────────── │
│ What's Mocked:  Nothing                                             │
│ What's Real:    Everything (real LLM API calls)                     │
│ Technology:     Playwright E2E                                      │
│ Speed:          Slow (network latency, rate limits)                 │
│ Coverage:       Shallow (1 happy path per provider)                 │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 3: Full E2E (FUTURE - Post-Launch)                           │
│ ─────────────────────────────────────────────────────────────────── │
│ What's Mocked:  Nothing                                             │
│ Scope:          Multi-turn workflows, tool execution, UI rendering  │
│ When:           Before major releases                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core 2.0 Pipeline Flow (What We're Testing)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      1. SUBMIT ENDPOINT                              │
│                  POST /api/v2/submit                                 │
│                  {prompt, model, threadId?}                          │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                   2. PROVIDER ADAPTER                                │
│            OpenAIStreamAdapter / AnthropicStreamAdapter              │
│                                                                      │
│  • Fetch LLM API (MOCKED in harness tests)                          │
│  • Normalize chunks → StreamEvents                                   │
│  • Emit to Redis                                                     │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                       3. REDIS STREAMS                               │
│                   codex:run:{runId}:events                           │
│                                                                      │
│  • XADD (publish events)                                             │
│  • XREADGROUP (consumer groups)                                      │
│  • Ordering guarantees                                               │
└──────────────┬───────────────────────────────┬───────────────────────┘
               ↓                               ↓
┌──────────────────────────────┐  ┌───────────────────────────────────┐
│   4a. PERSISTENCE WORKER     │  │   4b. SSE STREAM ENDPOINT         │
│   persistence-worker.ts      │  │   GET /api/v2/stream/:runId       │
│                              │  │                                   │
│  • XREADGROUP consume        │  │  • XREAD (tail stream)            │
│  • ResponseReducer.apply()   │  │  • Format as SSE                  │
│  • Convex.projectRunSnapshot │  │  • Send to client                 │
└──────────────┬───────────────┘  └───────────┬───────────────────────┘
               ↓                               ↓
┌──────────────────────────────┐  ┌───────────────────────────────────┐
│      5a. CONVEX STORAGE      │  │   5b. CLIENT CONSUMPTION          │
│      messages table          │  │   (Browser or Test Harness)       │
│                              │  │                                   │
│  • Response snapshots        │  │  • Consume SSE stream             │
│  • Query by runId            │  │  • Apply hydration library        │
└──────────────────────────────┘  └───────────────────────────────────┘
```

**What the harness validates:**
- ✅ Adapter normalization (OpenAI/Anthropic → StreamEvents)
- ✅ Redis publishing/consuming (serialization, ordering)
- ✅ Worker aggregation (ResponseReducer correctness)
- ✅ Convex persistence (schema compliance)
- ✅ SSE streaming (format, reconnection)
- ✅ Hydration (StreamEvents → Response object)

---

## Design Specifications

### 1. Test Infrastructure Setup

#### **Prerequisites (Assumed Running Locally)**
- Redis server on `localhost:6379` (developer runs `redis-server` in terminal)
- Convex dev server (developer runs `npx convex dev` in terminal)

#### **Test Harness Responsibilities**
```typescript
// tests/harness/setup.ts

export interface TestEnvironment {
  fastify: FastifyInstance;
  baseUrl: string;
  redis: RedisClientLike;
  cleanup: () => Promise<void>;
}

export async function setupTestEnvironment(): Promise<TestEnvironment> {
  // 1. Connect to local Redis (assumes running)
  const redis = await createRedisClient('redis://localhost:6379');

  // 2. Start Fastify server programmatically
  const app = await createFastifyApp();
  await app.listen({port: 0}); // Random available port

  const port = (app.server.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${port}`;

  // 3. Start background workers programmatically
  const persistenceWorker = new PersistenceWorker(redis, convexClient);
  await persistenceWorker.start();

  const toolWorker = new ToolWorker(redis);
  await toolWorker.start();

  return {
    fastify: app,
    baseUrl,
    redis,
    cleanup: async () => {
      await persistenceWorker.stop();
      await toolWorker.stop();
      await app.close();
      await redis.quit();
    }
  };
}
```

**Key Decisions:**
- ✅ **No Docker** (relies on local Redis/Convex for now)
- ✅ **Programmatic server start** (no need for `npm run dev` in tests)
- ✅ **Worker lifecycle managed** (start in setup, stop in cleanup)
- ✅ **Random port** (avoids port conflicts in parallel test runs)

---

### 2. LLM API Mocking Strategy

#### **Mock Fetch at Global Level**

```typescript
// tests/mocks/llm-fetch.ts

export interface MockLLMResponse {
  provider: 'openai' | 'anthropic' | 'openrouter';
  fixture: 'simple-message' | 'thinking-message' | 'tool-call' | 'error';
  customChunks?: string[]; // For custom scenarios
}

export function mockLLMFetch(responses: Record<string, MockLLMResponse>) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const urlString = url.toString();

    // OpenAI Responses API
    if (urlString.includes('api.openai.com/v1/responses')) {
      const mockConfig = responses['openai'] || responses['default'];
      return createMockStreamingResponse(
        getOpenAIFixture(mockConfig.fixture)
      );
    }

    // Anthropic Messages API
    if (urlString.includes('api.anthropic.com/v1/messages')) {
      const mockConfig = responses['anthropic'] || responses['default'];
      return createMockStreamingResponse(
        getAnthropicFixture(mockConfig.fixture)
      );
    }

    // OpenRouter
    if (urlString.includes('openrouter.ai/api/v1/chat/completions')) {
      const mockConfig = responses['openrouter'] || responses['default'];
      return createMockStreamingResponse(
        getOpenRouterFixture(mockConfig.fixture)
      );
    }

    // Pass through any other fetch (Convex, etc.)
    return originalFetch(url, init);
  });

  return () => {
    globalThis.fetch = originalFetch; // Restore in cleanup
  };
}

function createMockStreamingResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
        await sleep(5); // Simulate streaming delay
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache'
    }
  });
}
```

**Fixtures defined in:**
```typescript
// tests/fixtures/openai-responses.ts
export const openaiFixtures = {
  'simple-message': [
    'data: {"type":"response.start","response_id":"resp_001"}\n\n',
    'data: {"type":"item.start","item_id":"item_msg1","item_type":"message"}\n\n',
    'data: {"type":"item.content.delta","item_id":"item_msg1","delta":"Hello"}\n\n',
    'data: {"type":"item.content.delta","item_id":"item_msg1","delta":" world"}\n\n',
    'data: {"type":"item.done","item_id":"item_msg1"}\n\n',
    'data: {"type":"response.done","response_id":"resp_001"}\n\n'
  ],

  'thinking-message': [
    'data: {"type":"response.start","response_id":"resp_002"}\n\n',
    'data: {"type":"item.start","item_id":"item_think1","item_type":"reasoning"}\n\n',
    'data: {"type":"item.content.delta","item_id":"item_think1","delta":"Let me think..."}\n\n',
    'data: {"type":"item.done","item_id":"item_think1"}\n\n',
    'data: {"type":"item.start","item_id":"item_msg2","item_type":"message"}\n\n',
    'data: {"type":"item.content.delta","item_id":"item_msg2","delta":"The answer is 42"}\n\n',
    'data: {"type":"item.done","item_id":"item_msg2"}\n\n',
    'data: {"type":"response.done","response_id":"resp_002"}\n\n'
  ],

  'tool-call': [
    'data: {"type":"response.start","response_id":"resp_003"}\n\n',
    'data: {"type":"item.start","item_id":"item_fn1","item_type":"function_call"}\n\n',
    'data: {"type":"item.function_call.delta","item_id":"item_fn1","name":"readFile"}\n\n',
    'data: {"type":"item.function_call.arguments.delta","item_id":"item_fn1","delta":"{\\"path\\":\\""}\n\n',
    'data: {"type":"item.function_call.arguments.delta","item_id":"item_fn1","delta":"README.md\\"}"}\n\n',
    'data: {"type":"item.done","item_id":"item_fn1","function_call":{"name":"readFile","arguments":"{\\"path\\":\\"README.md\\"}"}}\n\n',
    'data: {"type":"response.done","response_id":"resp_003"}\n\n'
  ],

  'error': [
    'data: {"type":"response.start","response_id":"resp_err1"}\n\n',
    'data: {"type":"response.error","error":{"type":"invalid_request","message":"Invalid prompt"}}\n\n'
  ]
};
```

**Anthropic and OpenRouter fixtures:** Similar structure, adapted for each API's specific format.

---

### 3. Hydration Library Interface

The harness requires a **client-side hydration library** to consume SSE streams and build Response objects.

#### **Interface Design**

```typescript
// src/client/hydration.ts (NEW)

export interface HydrationOptions {
  /** Validate events against schema during hydration */
  strict?: boolean;

  /** Throw on unknown event types vs. silently skip */
  throwOnUnknown?: boolean;
}

export class StreamHydrator {
  private reducer: ResponseReducer;

  constructor(options?: HydrationOptions) {
    this.reducer = new ResponseReducer(options?.strict ?? true);
  }

  /**
   * Hydrate a complete SSE stream into a Response object.
   *
   * @param streamUrl - SSE endpoint URL
   * @returns Promise<Response> - Fully hydrated Response
   * @throws HydrationError - On malformed events, schema violations
   */
  async hydrateFromSSE(streamUrl: string): Promise<Response> {
    const events: StreamEvent[] = [];

    const eventSource = new EventSource(streamUrl);

    return new Promise((resolve, reject) => {
      eventSource.onmessage = (e) => {
        const event = JSON.parse(e.data) as StreamEvent;
        events.push(event);

        // Apply to reducer incrementally
        this.reducer.apply(event);

        // Check if response complete
        if (event.type === 'response_done') {
          eventSource.close();
          resolve(this.reducer.snapshot());
        }
      };

      eventSource.onerror = (err) => {
        eventSource.close();
        reject(new HydrationError('SSE stream error', err));
      };

      // Timeout after 30 seconds
      setTimeout(() => {
        eventSource.close();
        reject(new HydrationError('Stream timeout after 30s'));
      }, 30000);
    });
  }

  /**
   * Hydrate from a pre-fetched array of events (for testing).
   */
  hydrateFromEvents(events: StreamEvent[]): Response {
    for (const event of events) {
      this.reducer.apply(event);
    }
    return this.reducer.snapshot();
  }

  /**
   * Get current partial response (for incremental UI updates).
   */
  getPartial(): Response {
    return this.reducer.snapshot();
  }
}
```

**Key Features:**
- ✅ Can hydrate from live SSE stream OR pre-fetched events
- ✅ Uses same ResponseReducer as persistence worker (DRY)
- ✅ Provides incremental snapshots (for testing partial states)
- ✅ Validates events during hydration (catches malformed data)

---

### 4. Test Harness API

#### **Primary Test Interface**

```typescript
// tests/harness/core-harness.ts

export class Core2TestHarness {
  private env: TestEnvironment;
  private hydrator: StreamHydrator;
  private restoreFetch: () => void;

  async setup() {
    // Start infrastructure
    this.env = await setupTestEnvironment();

    // Initialize hydrator
    this.hydrator = new StreamHydrator({strict: true});

    // Mock LLM APIs
    this.restoreFetch = mockLLMFetch({
      'openai': {provider: 'openai', fixture: 'simple-message'},
      'anthropic': {provider: 'anthropic', fixture: 'simple-message'}
    });
  }

  async cleanup() {
    this.restoreFetch(); // Restore real fetch
    await this.env.cleanup();
  }

  /**
   * Submit a prompt and get back runId + streamUrl
   */
  async submit(params: {
    prompt: string;
    model: string;
    providerId?: string;
    threadId?: string;
  }): Promise<{runId: string; streamUrl: string}> {
    const response = await fetch(`${this.env.baseUrl}/api/v2/submit`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`Submit failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Consume SSE stream and hydrate into Response.
   */
  async hydrateStream(streamUrl: string): Promise<Response> {
    return this.hydrator.hydrateFromSSE(streamUrl);
  }

  /**
   * Query Convex to verify persistence.
   */
  async getPersistedResponse(runId: string): Promise<Response | null> {
    // Direct Convex query (assumes test has ConvexClient)
    return await this.env.convex.query('messages.getByRunId', {runId});
  }

  /**
   * Wait for persistence worker to process all events.
   */
  async waitForPersistence(runId: string, timeoutMs = 5000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const persisted = await this.getPersistedResponse(runId);
      if (persisted?.status === 'completed') {
        return;
      }
      await sleep(100);
    }

    throw new Error(`Persistence timeout for runId=${runId}`);
  }

  /**
   * Override mock LLM response for a specific test.
   */
  setMockResponse(fixture: MockLLMResponse) {
    this.restoreFetch(); // Clear previous mock
    this.restoreFetch = mockLLMFetch({default: fixture});
  }

  /**
   * Read raw events from Redis (for debugging/assertions).
   */
  async getRedisEvents(runId: string): Promise<StreamEvent[]> {
    const streamKey = `codex:run:${runId}:events`;
    const result = await this.env.redis.xrange(streamKey, '-', '+');
    return result.map(entry => JSON.parse(entry.data));
  }
}
```

---

### 5. Example Test Case

```typescript
// tests/e2e/core-2.0/simple-turn.spec.ts

import {describe, it, expect, beforeAll, afterAll} from '@playwright/test';
import {Core2TestHarness} from '../harness/core-harness';

describe('Core 2.0 Pipeline: Simple Message Turn', () => {
  let harness: Core2TestHarness;

  beforeAll(async () => {
    harness = new Core2TestHarness();
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it('should process simple message turn end-to-end', async () => {
    // 1. Submit turn (uses mocked OpenAI response)
    const {runId, streamUrl} = await harness.submit({
      prompt: 'Say hello',
      model: 'gpt-5-mini',
      providerId: 'openai'
    });

    expect(runId).toMatch(/^run_[a-z0-9]+$/);
    expect(streamUrl).toBe(`/api/v2/stream/${runId}`);

    // 2. Hydrate from SSE stream
    const response = await harness.hydrateStream(
      `${harness.env.baseUrl}${streamUrl}`
    );

    // 3. Assert hydrated Response structure
    expect(response.response_id).toBe(runId);
    expect(response.status).toBe('completed');
    expect(response.output_items).toHaveLength(1);
    expect(response.output_items[0].item_type).toBe('message');
    expect(response.output_items[0].content).toBe('Hello world');

    // 4. Verify events in Redis
    const redisEvents = await harness.getRedisEvents(runId);
    expect(redisEvents).toContainEqual(
      expect.objectContaining({type: 'response_start'})
    );
    expect(redisEvents).toContainEqual(
      expect.objectContaining({type: 'item_start', payload: {item_type: 'message'}})
    );
    expect(redisEvents).toContainEqual(
      expect.objectContaining({type: 'response_done'})
    );

    // 5. Wait for persistence and verify Convex
    await harness.waitForPersistence(runId);

    const persisted = await harness.getPersistedResponse(runId);
    expect(persisted).toEqual(response); // Exact match
  });

  it('should handle thinking + message turn', async () => {
    // Override with thinking fixture
    harness.setMockResponse({
      provider: 'openai',
      fixture: 'thinking-message'
    });

    const {runId, streamUrl} = await harness.submit({
      prompt: 'What is 6*7?',
      model: 'gpt-5-mini'
    });

    const response = await harness.hydrateStream(
      `${harness.env.baseUrl}${streamUrl}`
    );

    // Assert: Two output items (reasoning + message)
    expect(response.output_items).toHaveLength(2);
    expect(response.output_items[0].item_type).toBe('reasoning');
    expect(response.output_items[0].content).toContain('Let me think');
    expect(response.output_items[1].item_type).toBe('message');
    expect(response.output_items[1].content).toContain('42');

    // Verify persistence includes both items
    await harness.waitForPersistence(runId);
    const persisted = await harness.getPersistedResponse(runId);
    expect(persisted.output_items).toHaveLength(2);
  });

  it('should handle adapter errors gracefully', async () => {
    harness.setMockResponse({
      provider: 'openai',
      fixture: 'error'
    });

    const {runId, streamUrl} = await harness.submit({
      prompt: 'Trigger error',
      model: 'gpt-5-mini'
    });

    const response = await harness.hydrateStream(
      `${harness.env.baseUrl}${streamUrl}`
    );

    // Assert: Response has error status
    expect(response.status).toBe('failed');
    expect(response.output_items).toHaveLength(1);
    expect(response.output_items[0].item_type).toBe('error');
    expect(response.output_items[0].error?.message).toContain('Invalid prompt');
  });
});
```

---

### 6. Test Scenarios (Comprehensive Coverage)

#### **Category 1: Basic Turn Types**

| Test ID | Scenario | Fixture | Assertions |
|---------|----------|---------|------------|
| TC-BT-1 | Simple message turn | `simple-message` | 1 message item, status=completed |
| TC-BT-2 | Thinking + message | `thinking-message` | 2 items (reasoning, message), both persisted |
| TC-BT-3 | Multi-message turn | `multi-message` | 3 message items in sequence |
| TC-BT-4 | Empty response | `empty-response` | 0 output items, status=completed |

#### **Category 2: Tool Execution**

| Test ID | Scenario | Fixture | Assertions |
|---------|----------|---------|------------|
| TC-TE-1 | Single tool call | `tool-call` | function_call item, tool worker processes |
| TC-TE-2 | Tool call + output + message | `tool-call-complete` | 3 items (call, output, message) |
| TC-TE-3 | Multiple tool calls | `multi-tool` | 2 function_call items in sequence |
| TC-TE-4 | Tool call error | `tool-error` | function_call_output with error |

#### **Category 3: Provider Variations**

| Test ID | Scenario | Provider | Assertions |
|---------|----------|----------|------------|
| TC-PV-1 | OpenAI Responses API | openai | Correct normalization to StreamEvents |
| TC-PV-2 | Anthropic Messages API | anthropic | content_blocks → canonical format |
| TC-PV-3 | OpenRouter (Gemini) | openrouter | Chat format → canonical format |

#### **Category 4: Error Handling**

| Test ID | Scenario | Fixture | Assertions |
|---------|----------|---------|------------|
| TC-EH-1 | LLM API error | `error` | response.status=failed, error item |
| TC-EH-2 | Malformed SSE chunk | `malformed-sse` | Adapter handles gracefully or fails cleanly |
| TC-EH-3 | Redis connection failure | N/A (real Redis) | Submit endpoint returns 503 |
| TC-EH-4 | Convex write failure | N/A (mock Convex write to fail) | Worker logs error, stream completes |

#### **Category 5: Streaming Behavior**

| Test ID | Scenario | Fixture | Assertions |
|---------|----------|---------|------------|
| TC-SB-1 | SSE reconnection | `simple-message` | Client can reconnect with Last-Event-ID |
| TC-SB-2 | Slow stream | `slow-chunks` | Hydrator handles delays, doesn't timeout |
| TC-SB-3 | Stream abort mid-turn | `abort-mid-stream` | Partial response, status=incomplete |
| TC-SB-4 | Concurrent turns | 2 fixtures | Both complete independently, no crosstalk |

#### **Category 6: Persistence Validation**

| Test ID | Scenario | Fixture | Assertions |
|---------|----------|---------|------------|
| TC-PV-1 | Response persisted to Convex | `simple-message` | Convex query matches hydrated Response |
| TC-PV-2 | Trace context preserved | `simple-message` | trace_context in Redis → Convex |
| TC-PV-3 | Idempotent replay | `simple-message` | Replaying events yields same Response |
| TC-PV-4 | Usage metrics captured | `simple-message` | response.usage has prompt_tokens, completion_tokens |

**Total Test Count:** ~25-30 comprehensive tests covering critical paths.

---

## Implementation Phases

### **Phase 1: Harness Infrastructure (Foundation)**

**Deliverables:**
1. `tests/harness/setup.ts` - Environment lifecycle (Fastify, Redis, workers)
2. `tests/harness/core-harness.ts` - Core2TestHarness class
3. `tests/mocks/llm-fetch.ts` - Global fetch mocking
4. `tests/fixtures/openai-responses.ts` - OpenAI SSE fixtures
5. `tests/fixtures/anthropic-responses.ts` - Anthropic SSE fixtures
6. `tests/fixtures/openrouter-responses.ts` - OpenRouter fixtures

**Effort:** ~300 lines
**Success Criteria:** Can start/stop harness, mock fetch works, fixtures load

---

### **Phase 2: Hydration Library (Client-Side)**

**Deliverables:**
1. `src/client/hydration.ts` - StreamHydrator class
2. `src/client/errors.ts` - HydrationError types
3. Unit tests for hydration logic (mock events → Response)

**Effort:** ~200 lines
**Success Criteria:** Can hydrate array of StreamEvents into Response, validates schema

---

### **Phase 3: Basic Turn Tests (TDD Foundation)**

**Deliverables:**
1. `tests/e2e/core-2.0/basic-turns.spec.ts`
   - TC-BT-1: Simple message
   - TC-BT-2: Thinking + message
   - TC-BT-3: Multi-message
2. Verification of:
   - Adapter normalization
   - Redis persistence
   - Convex writes
   - SSE streaming
   - Hydration correctness

**Effort:** ~400 lines
**Success Criteria:** 3 tests passing, full pipeline validated

---

### **Phase 4: Tool Execution Tests**

**Deliverables:**
1. `tests/e2e/core-2.0/tool-execution.spec.ts`
   - TC-TE-1: Single tool call
   - TC-TE-2: Tool call + output + message
   - TC-TE-3: Multiple tools
2. Tool worker integration verification

**Effort:** ~300 lines
**Success Criteria:** Tool execution loop works, function_call_output events flow correctly

---

### **Phase 5: Error & Edge Case Tests**

**Deliverables:**
1. `tests/e2e/core-2.0/error-handling.spec.ts` (TC-EH-1 through TC-EH-4)
2. `tests/e2e/core-2.0/streaming-behavior.spec.ts` (TC-SB-1 through TC-SB-4)
3. `tests/e2e/core-2.0/persistence.spec.ts` (TC-PV-1 through TC-PV-4)

**Effort:** ~600 lines
**Success Criteria:** All edge cases covered, error handling robust

---

## Technical Decisions

### **Decision 1: Playwright vs Vitest**

**Options:**
- **Playwright:** Browser-based testing, excellent SSE support, can test actual UI later
- **Vitest:** Node-based, faster startup, better TypeScript integration, uses supertest for HTTP

**Recommendation:** **Vitest + Supertest**

**Rationale:**
- No browser needed for API testing (Playwright is overkill)
- Faster test startup (no browser launch)
- Better TypeScript/ESM support
- Can use same test runner as codex-ts (consistency)
- Supertest provides clean HTTP testing API

**Example with Vitest:**
```typescript
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import supertest from 'supertest';

let request: supertest.SuperTest<supertest.Test>;

beforeAll(async () => {
  const harness = new Core2TestHarness();
  await harness.setup();
  request = supertest(harness.env.baseUrl);
});

it('should submit turn', async () => {
  const res = await request
    .post('/api/v2/submit')
    .send({prompt: 'test', model: 'gpt-5-mini'})
    .expect(202);

  expect(res.body.runId).toBeDefined();
});
```

**Exception:** Keep Playwright for UI tests when web UI is built. Use Vitest for API/pipeline tests.

---

### **Decision 2: Real vs Mock Infrastructure**

**What's Real (Local Services):**
- ✅ Redis (localhost:6379) - REAL
- ✅ Convex (dev server) - REAL
- ✅ Fastify (programmatic) - REAL
- ✅ Workers (programmatic) - REAL

**What's Mocked (External APIs):**
- ✅ OpenAI API - MOCKED
- ✅ Anthropic API - MOCKED
- ✅ OpenRouter API - MOCKED

**Rationale:**
- Redis/Convex are **fast local services** (~1-5ms per operation)
- Mocking them hides **serialization bugs, schema mismatches**
- Running real instances adds **minimal overhead** (<100ms per test)
- Gives **high confidence** in integration

**Measured Performance Target:** Full 30-test suite completes in < 10 seconds.

---

### **Decision 3: Fixture Management**

**Approach:** Pre-defined fixture files (not inline strings)

**Structure:**
```
tests/fixtures/
├── openai/
│   ├── simple-message.json       # SSE chunks for basic message
│   ├── thinking-message.json     # Reasoning + message
│   ├── tool-call.json            # Function call request
│   └── error.json                # API error response
├── anthropic/
│   ├── simple-message.json
│   ├── thinking-message.json
│   └── tool-call.json
└── shared/
    ├── expected-responses.json   # Expected Response objects
    └── schemas.json              # JSON Schema for validation
```

**Benefits:**
- ✅ Easy to read/modify (JSON files vs inline strings)
- ✅ Reusable across tests
- ✅ Can version control realistic examples
- ✅ Can generate from real API responses (record/replay)

---

### **Decision 4: Convex Test Strategy**

**Challenge:** Convex doesn't support true mocking (it's a hosted service).

**Options:**
1. Use real Convex dev server (current approach)
2. Mock ConvexClient (defeats purpose of integration testing)
3. Use in-memory stub (complex, brittle)

**Recommendation:** Use real Convex dev server

**Mitigation:**
- Tests run against local `npx convex dev`
- Each test uses unique runId (no conflicts)
- Cleanup: Delete test data after each test OR use separate dev deployment

```typescript
afterEach(async () => {
  // Clean up test data
  if (testRunId) {
    await convex.mutation('messages.deleteByRunId', {runId: testRunId});
  }
});
```

---

### **Decision 5: Worker Lifecycle**

**Challenge:** Workers are long-running background processes. How to manage in tests?

**Approach:** Programmatic worker control

```typescript
// In harness setup:
const persistenceWorker = new PersistenceWorker(redis, convex);
await persistenceWorker.start(); // Spawns consumer loop

// In harness cleanup:
await persistenceWorker.stop(); // Graceful shutdown
```

**Key:** Workers must support:
- ✅ Programmatic start/stop (not just CLI scripts)
- ✅ Graceful shutdown (finish in-flight work)
- ✅ Configurable consumer group names (avoid conflicts between test runs)

**Worker interface:**
```typescript
export interface Worker {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}
```

---

## Non-Functional Requirements

### **Performance Targets**

| Metric | Target | Rationale |
|--------|--------|-----------|
| Single test execution | < 500ms | Fast feedback loop |
| Full suite (30 tests) | < 10 sec | Usable for TDD |
| Harness setup/teardown | < 2 sec | Minimal overhead |
| SSE stream consumption | < 1 sec | Even for slow fixtures |

### **Reliability Requirements**

- **Deterministic:** Same inputs → same outputs (100% reproducible)
- **Isolated:** Tests don't affect each other (unique runIds, cleanup)
- **Offline:** No external network calls (except localhost Redis/Convex)
- **Debuggable:** Clear error messages, logs available, can inspect Redis/Convex state

### **Maintainability Requirements**

- **DRY:** Fixtures reused, harness utilities shared
- **Readable:** Tests read like specifications (BDD style)
- **Evolvable:** Easy to add new scenarios without refactoring harness
- **Documented:** Each fixture has comments explaining what it tests

---

## Open Questions & Risks

### **Open Question 1: EventSource in Node.js**

**Challenge:** Node.js doesn't have native `EventSource` API (browser-only).

**Solutions:**
1. Use `eventsource` npm package (polyfill)
2. Use `fetch` with manual SSE parsing
3. Use Playwright's browser context (heavy)

**Recommendation:** Use `eventsource` package
```bash
npm install --save-dev eventsource
npm install --save-dev @types/eventsource
```

```typescript
import EventSource from 'eventsource';

const source = new EventSource(streamUrl);
source.onmessage = (e) => { /* ... */ };
```

---

### **Open Question 2: Convex Dev Server in CI**

**Challenge:** CI environment (GitHub Actions) doesn't have Convex dev server running.

**Solutions:**
1. Start `npx convex dev` in CI setup (slow, flaky)
2. Use Convex's test deployment (if available)
3. Mock Convex for CI, real for local (hybrid)

**Recommendation:** Defer to CI setup phase. For now, document requirement:
```markdown
## Prerequisites for Running Tests
- Redis server on localhost:6379
- Convex dev server running (`npx convex dev`)
```

---

### **Risk 1: Test Flakiness from Real Services**

**Risk:** Redis/Convex slowness or unavailability causes flaky tests.

**Mitigation:**
- Generous timeouts (5-10 sec, not 1 sec)
- Retry logic for infrastructure operations
- Health checks before test run (fail fast if Redis down)
- Clear error messages ("Redis not running on :6379")

---

### **Risk 2: Fixture Drift from Real APIs**

**Risk:** OpenAI/Anthropic change their API format, fixtures become stale.

**Mitigation:**
- Layer 2 integration tests (real API calls) catch drift
- Document fixture source ("Generated from OpenAI API 2025-01-22")
- Version fixtures (openai-responses-v2.json)
- Review/update quarterly

---

### **Risk 3: Hydration Library Complexity**

**Risk:** Hydration logic duplicates ResponseReducer, becomes inconsistent.

**Mitigation:**
- **Use the SAME ResponseReducer in both contexts:**
  ```typescript
  // Worker uses it:
  const reducer = new ResponseReducer();
  const response = reducer.apply(event);

  // Hydration library uses it:
  const hydrator = new StreamHydrator(); // Wraps ResponseReducer
  const response = hydrator.hydrateFromEvents(events);
  ```
- No duplication, single source of truth for aggregation logic

---

## Success Criteria

### **Phase 1 Complete When:**
- ✅ Harness can start/stop Fastify + workers
- ✅ Mocked fetch intercepts LLM calls
- ✅ Can submit turn and get runId back
- ✅ 1 simple test passing end-to-end

### **Phase 2 Complete When:**
- ✅ Hydration library exists and has unit tests
- ✅ Can consume SSE stream programmatically
- ✅ Can build Response from StreamEvent[]

### **Full Harness Complete When:**
- ✅ All 30 test scenarios passing
- ✅ Full suite runs in < 10 seconds
- ✅ Zero flaky tests (10 consecutive clean runs)
- ✅ Documented usage guide for adding new tests

---

## Future Enhancements

### **Post-MVP Features (Not in Initial Scope)**

1. **Record/Replay Mode**
   - Run tests with real APIs once
   - Capture responses as fixtures
   - Replay for subsequent runs
   - Use `nock` or custom recorder

2. **Parallel Test Execution**
   - Currently serial (one test at a time)
   - Could parallelize with unique Redis key prefixes
   - Requires worker pool or multiple Fastify instances

3. **UI Testing Integration**
   - Use same fixtures to test web UI
   - Harness provides mock backend for UI E2E tests
   - Unified fixture library

4. **Visual Diff Tool**
   - Compare expected vs actual Response objects
   - Visualize StreamEvent sequences
   - Debug hydration mismatches

---

## Appendix A: File Locations

```
cody-fastify/
├── src/
│   └── client/
│       ├── hydration.ts          # NEW - StreamHydrator class
│       └── errors.ts             # NEW - HydrationError
├── tests/
│   ├── harness/
│   │   ├── setup.ts              # NEW - setupTestEnvironment()
│   │   └── core-harness.ts       # NEW - Core2TestHarness class
│   ├── mocks/
│   │   └── llm-fetch.ts          # NEW - mockLLMFetch()
│   ├── fixtures/
│   │   ├── openai/
│   │   │   ├── simple-message.json
│   │   │   ├── thinking-message.json
│   │   │   ├── tool-call.json
│   │   │   └── error.json
│   │   ├── anthropic/
│   │   │   └── (similar structure)
│   │   └── expected/
│   │       └── responses.json     # Expected Response objects
│   └── e2e/
│       └── core-2.0/
│           ├── basic-turns.spec.ts
│           ├── tool-execution.spec.ts
│           ├── error-handling.spec.ts
│           ├── streaming-behavior.spec.ts
│           └── persistence.spec.ts
```

---

## Appendix B: Alternative Approaches Considered

### **Alternative 1: Mock Everything (Traditional Unit Tests)**

**Approach:** Mock Redis, Convex, LLMs - test pure logic only

**Pros:**
- Fastest possible (no I/O)
- No infrastructure dependencies

**Cons:**
- ❌ Doesn't validate integration
- ❌ False confidence (mocks hide bugs)
- ❌ Defeats purpose (we want to test the PIPELINE)

**Verdict:** REJECTED. This is what failed in Phase 6.

---

### **Alternative 2: Full E2E Only (No Mocks)**

**Approach:** All tests use real LLM APIs, real everything

**Pros:**
- Maximum confidence in real behavior
- Catches all integration issues

**Cons:**
- ❌ Slow (network latency, rate limits)
- ❌ Expensive (real API calls cost money)
- ❌ Non-deterministic (LLM responses vary)
- ❌ Can't test edge cases (can't force specific errors)
- ❌ Breaks TDD workflow (too slow for Red-Green-Refactor)

**Verdict:** REJECTED for primary test layer. Use in Layer 2 only.

---

### **Alternative 3: Redis Mock (In-Memory)**

**Approach:** Use in-memory fake Redis (ioredis-mock or similar)

**Pros:**
- Faster than real Redis
- No external dependency

**Cons:**
- ❌ Doesn't test real Redis serialization
- ❌ Doesn't test XREADGROUP consumer groups correctly
- ❌ Hides Lua script bugs, stream trimming issues
- ❌ Marginal speed gain (~5ms → 1ms per operation)

**Verdict:** REJECTED. Real local Redis is fast enough and catches real bugs.

---

## Appendix C: Example Fixture (OpenAI Simple Message)

```json
// tests/fixtures/openai/simple-message.json
{
  "description": "Basic message turn with no thinking or tools",
  "model": "gpt-5-mini",
  "chunks": [
    "data: {\"type\":\"response.start\",\"response_id\":\"resp_abc123\"}\n\n",

    "data: {\"type\":\"item.start\",\"item_id\":\"msg_001\",\"item_type\":\"message\",\"item\":{\"role\":\"assistant\",\"content\":[]}}\n\n",

    "data: {\"type\":\"item.content.delta\",\"item_id\":\"msg_001\",\"delta\":\"Hello\"}\n\n",

    "data: {\"type\":\"item.content.delta\",\"item_id\":\"msg_001\",\"delta\":\" world\"}\n\n",

    "data: {\"type\":\"item.content.delta\",\"item_id\":\"msg_001\",\"delta\":\"!\"}\n\n",

    "data: {\"type\":\"item.done\",\"item_id\":\"msg_001\",\"item\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Hello world!\"}]}}\n\n",

    "data: {\"type\":\"response.done\",\"response_id\":\"resp_abc123\",\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":3,\"total_tokens\":13}}\n\n"
  ],
  "expected_response": {
    "response_id": "resp_abc123",
    "status": "completed",
    "output_items": [
      {
        "item_id": "msg_001",
        "item_type": "message",
        "role": "assistant",
        "content": "Hello world!"
      }
    ],
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 3,
      "total_tokens": 13
    }
  }
}
```

**Usage in test:**
```typescript
const fixture = require('../fixtures/openai/simple-message.json');

harness.setMockResponse({
  provider: 'openai',
  customChunks: fixture.chunks
});

const response = await harness.submitAndHydrate({
  prompt: 'test',
  model: 'gpt-5-mini'
});

expect(response).toEqual(fixture.expected_response);
```

---

## Summary

The Core 2.0 Custom Test Harness provides a **pragmatic balance** between integration confidence and development speed.

**What makes it effective:**
1. **Mocks only what's necessary** (external LLM APIs)
2. **Exercises real pipeline** (Redis, Convex, workers, SSE)
3. **Enables fast TDD** (deterministic, < 10 sec suite)
4. **Validates full integration** (end-to-end flow tested)
5. **Supports comprehensive coverage** (30+ scenarios including edge cases)

**What makes it maintainable:**
1. **Clean abstractions** (Core2TestHarness encapsulates complexity)
2. **Reusable fixtures** (JSON files, not inline)
3. **Same reducer** (hydration uses persistence logic)
4. **Clear boundaries** (what's mocked vs real is explicit)

This harness will be the **foundation for all Core 2.0 development**, providing the scaffolding for reliable, test-driven iteration until the streaming architecture is production-ready.
