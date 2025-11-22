# CODER PROMPT: Core 2.0 Test Harness Implementation

**Generated:** 2025-01-22
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`

---

## ROLE

You are a senior TypeScript/Node.js developer implementing a **custom integration test harness** for the Core 2.0 streaming architecture. You will build test infrastructure that validates the full pipeline (Fastify → Redis → Workers → Convex → SSE) using mocked LLM responses and real local infrastructure.

---

## PROJECT CONTEXT

**Cody Core 2.0** is a streaming-native agent architecture that processes LLM turns through a Redis Streams pipeline. The system is in mid-refactor with incomplete integration. We need comprehensive tests to:
1. Find integration bugs in existing v2 implementation
2. Provide scaffolding for fixing those bugs
3. Enable fast TDD workflow for future development

**Current State:** Core components exist (adapters, workers, endpoints) but integration is unvalidated. Tests will fail initially - this is expected and desired.

---

## CURRENT PHASE

**Phase:** Core 2.0 Test Harness Implementation
**Objective:** Build harness infrastructure and implement 10 happy path test conditions

**FUNCTIONAL OUTCOME:**
After this phase, we can submit prompts via `/api/v2/submit`, verify events flow through Redis, validate worker processing, confirm Convex persistence, and hydrate SSE streams into Response objects - all with deterministic mocked LLM responses.

---

## PREREQUISITES

✅ **Core 2.0 Components Exist:**
- Provider adapters: `src/core/adapters/openai-adapter.ts`, `anthropic-adapter.ts`
- Redis infrastructure: `src/core/redis.ts`
- Response reducer: `src/core/reducer.ts`
- Persistence worker: `src/workers/persistence-worker.ts`
- Submit endpoint: `src/api/routes/submit.ts`
- Stream endpoint: `src/api/routes/stream.ts`

✅ **Design Documents Complete:**
- Test strategy: `docs/gem/v2-harness-final-strategy.md`
- Test conditions: `docs/gem/test-conditions-v2-happy-path.md`
- Architecture overview: `docs/codex-core-2.0-tech-design.md`

✅ **Local Environment:**
- Redis running on localhost:6379
- Convex dev server running (`npx convex dev`)

---

## STATE LOADING (READ THESE FIRST)

### FIRST: Load Test Plan and Architecture

**Mandatory reading order:**

1. **Test Conditions:** `docs/gem/test-conditions-v2-happy-path.md`
   - Read ALL 8 test scenarios (TC-HP-01 through TC-HP-08)
   - Note the fixture structure in Appendix A
   - Understand what each test validates

2. **Implementation Strategy:** `docs/gem/v2-harness-final-strategy.md`
   - Review the 6-step implementation roadmap
   - Note the factory pattern approach
   - Review constraints (valid models, no infra mocks, cleanup)

3. **Core 2.0 Architecture:** `docs/codex-core-2.0-tech-design.md`
   - Understand StreamEvent schema
   - Review Response object structure
   - Note provider adapter contracts

### THEN: Review Existing Implementation

4. **Current Schema:** `src/core/schema.ts`
   - Review StreamEvent types
   - Review Response object schema
   - Note all OutputItem variants

5. **Current Reducer:** `src/core/reducer.ts`
   - Understand event application logic
   - Note snapshot generation
   - Identify if any changes needed

6. **Current Adapters:** `src/core/adapters/openai-adapter.ts`
   - Review how OpenAI chunks → StreamEvents
   - Note event emission to Redis
   - Understand normalization logic

---

## TASK SPECIFICATION

Implement the test harness in **3 phases**:

### **Phase 1: Harness Infrastructure (Scaffold)**

Build the foundational infrastructure to run tests.

**Deliverables:**

1. **Test Harness Class** (`tests/harness/core-harness.ts`) - ~200 lines
   - `async setup()` - Start Fastify with mock factory, start workers
   - `async cleanup()` - Stop services, clear Redis/Convex
   - `async submit(params)` - POST to /api/v2/submit
   - `async consumeSSE(streamUrl)` - Connect to SSE, collect events
   - `async hydrate(events)` - Apply to reducer, get Response
   - `async getPersistedResponse(runId)` - Query Convex
   - `async reset()` - Clear test data between tests

2. **Factory Pattern** (`src/core/model-factory.ts`) - ~150 lines
   - `ModelFactory` interface
   - `DefaultModelFactory` class (production - creates real adapters)
   - `MockModelFactory` class (test - creates mock adapters)
   - Factory returns `StreamAdapter` interface

3. **Mock Stream Adapter** (`tests/mocks/mock-stream-adapter.ts`) - ~100 lines
   - Implements `StreamAdapter` interface
   - Reads fixture JSON file
   - Emits chunks to Redis as StreamEvents
   - Supports configurable delays (simulate streaming)

4. **Server Refactor** (`src/server.ts`) - ~20 lines
   - Accept optional `modelFactory` in options
   - Pass factory to submit route
   - Default to `DefaultModelFactory` if not provided

5. **Submit Route Update** (`src/api/routes/submit.ts`) - ~30 lines
   - Accept factory from server options
   - Use `factory.createAdapter(providerId, model)` instead of hardcoded if/else
   - Rest of logic unchanged

**Effort Estimate:** ~500 lines total

---

### **Phase 2: Hydration Library (Client-Side)**

Build the client-side library for consuming SSE and hydrating Response objects.

**Deliverables:**

1. **Stream Hydrator** (`src/client/hydration.ts`) - ~150 lines
   - `StreamHydrator` class wrapping ResponseReducer
   - `async hydrateFromSSE(url)` - Connect EventSource, collect events, hydrate
   - `hydrateFromEvents(events[])` - Synchronous hydration for testing
   - `getPartial()` - Get current partial Response
   - Timeout handling (30 seconds)
   - Error handling (HydrationError)

2. **Hydration Errors** (`src/client/errors.ts`) - ~50 lines
   - `HydrationError` class
   - Error types: StreamTimeout, MalformedEvent, SchemaViolation

3. **EventSource Polyfill** - Install dependency
   ```bash
   npm install --save-dev eventsource @types/eventsource
   ```

**Effort Estimate:** ~200 lines + 1 dependency

---

### **Phase 3: Test Implementation (10 Happy Path Tests)**

Implement the 10 test conditions from the test plan.

**Deliverables:**

1. **Fixture Files** (`tests/fixtures/`) - 12 JSON files
   - `openai/simple-message.json`
   - `openai/thinking-message.json`
   - `openai/tool-call-output-message.json`
   - `openai/usage-message.json`
   - `openai/simple-tool-call.json`
   - `openai/turn1-message.json`
   - `openai/turn2-message.json`
   - `openai/reconnection.json` (for SSE reconnection test)
   - `openai/concurrent-a.json` (for concurrent turns test)
   - `openai/concurrent-b.json` (for concurrent turns test)
   - `anthropic/simple-message.json`
   - `anthropic/thinking-message.json`
   - (Use structure from Appendix A in test conditions doc)

2. **Test Suite** (`tests/e2e/core-2.0/happy-path.spec.ts`) - ~800 lines
   - 10 test cases implementing TC-HP-01 through TC-HP-10
   - Use Vitest as test runner
   - Use harness for setup/cleanup/execution
   - Follow pattern:
     ```typescript
     test('TC-HP-01: Simple message (OpenAI)', async () => {
       const {runId, streamUrl} = await harness.submit({
         prompt: 'Tell me a fun fact.',
         model: 'gpt-5-mini',
         providerId: 'openai'
       });

       const events = await harness.consumeSSE(streamUrl);
       const response = await harness.hydrate(events);

       expect(response.status).toBe('completed');
       expect(response.output_items).toHaveLength(1);
       expect(response.output_items[0].type).toBe('message');

       const persisted = await harness.getPersistedResponse(runId);
       expect(persisted).toEqual(response);
     });
     ```

**Effort Estimate:** ~1000 lines total (fixtures + tests)

**Note:** TC-HP-09 (SSE Reconnection) and TC-HP-10 (Concurrent Turns) were added from Claude's design to supplement Gemini's original 8 tests. See `docs/gem/test-conditions-v2-happy-path.md` for TC-HP-09 and TC-HP-10 specifications.

---

## WORKFLOW STEPS

### **Step-by-Step Process:**

1. **Create Directory Structure**
   ```bash
   mkdir -p tests/harness
   mkdir -p tests/mocks
   mkdir -p tests/fixtures/openai
   mkdir -p tests/fixtures/anthropic
   mkdir -p src/client
   mkdir -p tests/e2e/core-2.0
   ```

2. **Implement Phase 1 (Harness Infrastructure)**
   - Start with `src/core/model-factory.ts` (define interfaces first)
   - Implement `DefaultModelFactory` (reuse existing adapter creation logic)
   - Implement `MockModelFactory` (reads fixtures, returns mock adapter)
   - Implement `tests/mocks/mock-stream-adapter.ts`
   - Update `src/server.ts` to accept factory
   - Update `src/api/routes/submit.ts` to use factory
   - Implement `tests/harness/core-harness.ts`

3. **Verify Phase 1**
   - Run `npx tsc --noEmit` (0 errors)
   - Manually test harness setup/cleanup
   - Verify Fastify starts on random port
   - Verify workers start/stop correctly

4. **Implement Phase 2 (Hydration Library)**
   - Install `eventsource` package
   - Implement `src/client/hydration.ts`
   - Implement `src/client/errors.ts`
   - Write unit tests for hydration (mock events → Response)

5. **Verify Phase 2**
   - Run hydration unit tests
   - Verify StreamHydrator can consume mock event arrays
   - Verify timeout handling works

6. **Implement Phase 3 (Tests & Fixtures)**
   - Create fixture JSON files (use structure from test conditions Appendix A)
   - Implement TC-HP-01 first (simplest)
   - Get TC-HP-01 passing (may require fixes to v2 implementation)
   - Implement remaining 9 tests (TC-HP-02 through TC-HP-10)
   - Note: TC-HP-09 and TC-HP-10 are in updated test conditions doc
   - Document any failures (expected - v2 has bugs)

7. **Run Full Suite**
   ```bash
   cd /Users/leemoore/code/codex-port-02/cody-fastify
   npm test tests/e2e/core-2.0/happy-path.spec.ts
   ```

8. **Document Results**
   - Create `TEST_RESULTS.md` showing:
     - Which tests pass/fail
     - What errors occurred
     - What v2 bugs were discovered
     - Next steps for fixing

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **Use ONLY valid models from MODELS.md**
   - When creating fixtures, use: gpt-5-mini, gpt-5-codex, claude-haiku-4.5, claude-sonnet-4.5
   - NEVER use gpt-4, claude-3-*, or other deprecated models

2. **Follow fixture structure exactly**
   - Use the JSON structure from test conditions Appendix A
   - Include `description`, `provider`, `model`, `chunks`, `expected_response`
   - Use real SSE chunk format (research OpenAI/Anthropic API docs if needed)

3. **Keep production code changes minimal**
   - Factory pattern should be lightweight (routing only)
   - Don't refactor existing adapters
   - Don't change Redis/Convex logic
   - Only add factory injection points

4. **Tests will fail initially - this is OK**
   - Document failures clearly
   - Don't try to "fix" v2 implementation in this phase
   - Focus on building correct test infrastructure
   - Let tests expose the bugs

5. **Use TypeScript strict mode**
   - No `any` types (use `unknown` or proper types)
   - All interfaces must be exported
   - Zod schemas for validation where appropriate

### **INTERRUPT PROTOCOL**

**STOP and ask for clarification if:**
- OpenAI/Anthropic SSE chunk format is unclear (you may need to research their docs)
- Existing adapters don't have a clear interface to mock
- Workers can't be started programmatically
- Convex client API for queries is unclear
- Test plan requires features not in current v2 implementation

**DO NOT:**
- Invent SSE chunk formats (use real API docs)
- Mock Redis or Convex (use real connections)
- Skip fixtures (every test needs a fixture)
- Simplify the Response schema (use complete schema from fixtures)

---

## CODE QUALITY STANDARDS

### **Mandatory Quality Gates:**

- ✅ TypeScript: Zero errors (`npx tsc --noEmit`)
- ✅ ESLint: Zero errors (`npm run lint`)
- ✅ Prettier: Formatted (`npm run format`)
- ✅ Fixtures: Valid JSON (parseable)
- ✅ Tests: Runnable (may fail, but must execute)

### **Verification Command:**
```bash
npm run format && npm run lint && npx tsc --noEmit
```

**Note:** `npm test` will likely fail initially (v2 bugs). This is expected. The goal is to get tests RUNNING and DOCUMENTING failures, not necessarily passing.

---

## IMPLEMENTATION GUIDANCE

### **Factory Pattern Implementation**

```typescript
// src/core/model-factory.ts

export interface StreamAdapter {
  stream(params: {
    prompt: string;
    model: string;
    runId: string;
    // ... other params
  }): Promise<void>;
}

export interface ModelFactory {
  createAdapter(providerId: string, model: string): StreamAdapter;
}

export class DefaultModelFactory implements ModelFactory {
  constructor(private redis: RedisStream, private config: AppConfig) {}

  createAdapter(providerId: string, model: string): StreamAdapter {
    // Reuse existing adapter creation logic from submit.ts
    if (providerId === 'openai') {
      return new OpenAIStreamAdapter(this.redis, model, apiKey);
    }
    if (providerId === 'anthropic') {
      return new AnthropicStreamAdapter(this.redis, model, apiKey);
    }
    throw new Error(`Unknown provider: ${providerId}`);
  }
}

export class MockModelFactory implements ModelFactory {
  private fixtures = new Map<string, FixtureData>();

  loadFixture(provider: string, scenario: string, fixturePath: string) {
    const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    this.fixtures.set(`${provider}:${scenario}`, data);
  }

  createAdapter(providerId: string, model: string): StreamAdapter {
    return new MockStreamAdapter(this.fixtures, providerId, this.redis);
  }
}
```

### **Mock Stream Adapter Implementation**

```typescript
// tests/mocks/mock-stream-adapter.ts

export class MockStreamAdapter implements StreamAdapter {
  constructor(
    private fixtures: Map<string, FixtureData>,
    private provider: string,
    private redis: RedisStream
  ) {}

  async stream(params: {prompt: string; model: string; runId: string}): Promise<void> {
    // 1. Find fixture (could match by provider, or by prompt, or default)
    const fixture = this.fixtures.get(`${this.provider}:default`)
      || this.fixtures.values().next().value;

    if (!fixture) {
      throw new Error(`No fixture loaded for provider: ${this.provider}`);
    }

    // 2. Parse SSE chunks and emit as StreamEvents to Redis
    const streamKey = `codex:run:${params.runId}:events`;

    for (const chunk of fixture.chunks) {
      // Parse SSE chunk (format: "data: {JSON}\n\n")
      const json = chunk.replace(/^data: /, '').replace(/\n\n$/, '');
      const event = JSON.parse(json);

      // Emit to Redis
      await this.redis.xadd(streamKey, {
        type: event.type,
        payload: JSON.stringify(event)
      });

      // Optional: Add delay to simulate streaming
      await sleep(5);
    }
  }
}
```

### **Test Harness Implementation**

```typescript
// tests/harness/core-harness.ts

import {FastifyInstance} from 'fastify';
import {createServer} from '../../src/server';
import {MockModelFactory} from '../../src/core/model-factory';
import {StreamHydrator} from '../../src/client/hydration';
import EventSource from 'eventsource';

export class Core2TestHarness {
  private app?: FastifyInstance;
  private baseUrl?: string;
  private worker?: PersistenceWorker;
  private factory: MockModelFactory;
  private hydrator: StreamHydrator;

  constructor() {
    this.factory = new MockModelFactory();
    this.hydrator = new StreamHydrator();
  }

  async setup() {
    // Load fixtures into factory
    this.factory.loadFixture('openai', 'default',
      'tests/fixtures/openai/simple-message.json');
    // ... load other fixtures

    // Start Fastify with mock factory
    this.app = await createServer({
      modelFactory: this.factory,
      // ... other options
    });

    await this.app.listen({port: 0}); // Random port
    const addr = this.app.server.address();
    this.baseUrl = `http://localhost:${addr.port}`;

    // Start persistence worker
    const redis = await createRedisClient('redis://localhost:6379');
    const convex = new ConvexHttpClient(process.env.CONVEX_URL!);
    this.worker = new PersistenceWorker(redis, convex);
    await this.worker.start();
  }

  async cleanup() {
    await this.worker?.stop();
    await this.app?.close();
  }

  async submit(params: {
    prompt: string;
    model: string;
    providerId: string;
    threadId?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/api/v2/submit`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`Submit failed: ${response.status}`);
    }

    return response.json() as Promise<{runId: string; streamUrl: string}>;
  }

  async consumeSSE(streamUrl: string): Promise<StreamEvent[]> {
    const events: StreamEvent[] = [];
    const fullUrl = `${this.baseUrl}${streamUrl}`;

    return new Promise((resolve, reject) => {
      const source = new EventSource(fullUrl);

      source.onmessage = (e) => {
        const event = JSON.parse(e.data);
        events.push(event);

        if (event.type === 'response_done') {
          source.close();
          resolve(events);
        }
      };

      source.onerror = (err) => {
        source.close();
        reject(err);
      };

      setTimeout(() => {
        source.close();
        reject(new Error('SSE timeout after 30s'));
      }, 30000);
    });
  }

  async hydrate(events: StreamEvent[]): Promise<Response> {
    return this.hydrator.hydrateFromEvents(events);
  }

  async getPersistedResponse(runId: string): Promise<Response | null> {
    // Query Convex directly
    const convex = new ConvexHttpClient(process.env.CONVEX_URL!);
    return await convex.query('messages.getByRunId', {runId});
  }

  async reset() {
    // Delete Redis test streams
    const redis = await createRedisClient('redis://localhost:6379');
    const keys = await redis.keys('codex:run:*:events');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.quit();

    // Delete Convex test documents (implement deleteByRunId mutation)
    // await convex.mutation('messages.deleteTestData', {});
  }
}
```

### **Test Implementation Pattern**

```typescript
// tests/e2e/core-2.0/happy-path.spec.ts

import {describe, it, expect, beforeAll, afterAll, afterEach} from 'vitest';
import {Core2TestHarness} from '../harness/core-harness';

describe('Core 2.0 Happy Path Tests', () => {
  let harness: Core2TestHarness;

  beforeAll(async () => {
    harness = new Core2TestHarness();
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  afterEach(async () => {
    await harness.reset();
  });

  it('TC-HP-01: Simple message turn (OpenAI)', async () => {
    const {runId, streamUrl} = await harness.submit({
      prompt: 'Tell me a fun fact.',
      model: 'gpt-5-mini',
      providerId: 'openai'
    });

    expect(runId).toBeDefined();
    expect(streamUrl).toContain(runId);

    const events = await harness.consumeSSE(streamUrl);
    const response = await harness.hydrate(events);

    // Load expected from fixture
    const fixture = JSON.parse(
      fs.readFileSync('tests/fixtures/openai/simple-message.json', 'utf-8')
    );

    expect(response.status).toBe('completed');
    expect(response.provider_id).toBe('openai');
    expect(response.model_id).toBe('gpt-5-mini');
    expect(response.output_items).toHaveLength(1);
    expect(response.output_items[0].type).toBe('message');

    // Verify persistence
    await sleep(500); // Give worker time to process
    const persisted = await harness.getPersistedResponse(runId);
    expect(persisted).toMatchObject({
      status: 'completed',
      output_items: expect.arrayContaining([
        expect.objectContaining({type: 'message'})
      ])
    });
  });

  // Implement TC-HP-02 through TC-HP-08 following same pattern
});
```

---

## CRITICAL CONSTRAINTS

### **Model References:**

**ONLY use these models in fixtures and tests:**
- gpt-5-mini
- gpt-5-codex
- claude-haiku-4.5
- claude-sonnet-4.5

**NEVER reference:** gpt-4, gpt-4o, claude-3-*, or any deprecated models.

### **Infrastructure:**

- ✅ Use REAL Redis (localhost:6379)
- ✅ Use REAL Convex (dev server)
- ✅ Use REAL Fastify (programmatic start)
- ✅ Use REAL workers (programmatic start)
- ❌ DO NOT mock Redis client
- ❌ DO NOT mock Convex client
- ❌ DO NOT mock Fastify server

### **Fixture Creation:**

When creating fixture JSON files:
1. Research actual OpenAI Responses API SSE format (if unclear)
2. Research actual Anthropic Messages API streaming format (if unclear)
3. Use realistic event sequences
4. Include all required fields in events
5. Use proper JSON escaping in chunks

---

## SESSION COMPLETION CHECKLIST

### **Before ending session:**

1. ✅ **Run verification command** (format, lint, type-check)
2. ✅ **Document test results:**
   - Create or update `TEST_RESULTS.md`
   - List which tests pass/fail
   - Document any bugs discovered in v2 implementation
   - Note any incomplete work

3. ✅ **Commit work:**
   ```bash
   git add -A
   git commit -m "feat(test): implement Core 2.0 test harness

   - Add ModelFactory pattern for dependency injection
   - Implement MockStreamAdapter for fixture replay
   - Create StreamHydrator for client-side event consumption
   - Implement 8 happy path test conditions
   - Add fixtures for OpenAI and Anthropic responses

   Test Status: X/8 passing (see TEST_RESULTS.md for details)

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

4. ✅ **Report summary to user:**
   - Lines of code added
   - Test pass/fail count
   - Bugs discovered
   - Next steps (fixing v2 bugs vs completing harness)

---

## STARTING POINT

**BEGIN by:**

1. Reading all three design documents (test conditions, final strategy, architecture)
2. Creating the directory structure
3. Implementing the ModelFactory interface
4. Building one fixture (openai/simple-message.json)
5. Implementing MockStreamAdapter
6. Getting TC-HP-01 to RUN (even if it fails)

**Focus on getting infrastructure working first, then iterate on test coverage.**

---

## EXPECTED OUTCOME

After this session:
- ✅ Test harness infrastructure exists and compiles
- ✅ Factory pattern implemented with DI
- ✅ 10 test cases implemented (TC-HP-01 through TC-HP-10)
- ✅ At least 1-2 tests running (may fail, but executable)
- ✅ Clear documentation of what's broken in v2
- ✅ Foundation for iterative bug fixing

**It's OK if tests fail.** The goal is to BUILD the harness that EXPOSES the bugs.

**Test Scope:**
- TC-HP-01 to TC-HP-08: From Gemini's test conditions (core happy paths)
- TC-HP-09: SSE Reconnection (from Claude's design)
- TC-HP-10: Concurrent Turns (from Claude's design)
