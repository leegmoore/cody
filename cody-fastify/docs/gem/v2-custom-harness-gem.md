# V2 Custom Test Harness Design

**Date:** November 22, 2025
**Status:** Draft
**Context:** Core 2.0 Stabilization (Pipeline Integration with Mocked Intelligence)

---

## 1. Objective

To verify the entire **V2 Core Streaming Pipeline** (Fastify API → Redis Stream → Persistence Worker → Convex → SSE Endpoint → Client Hydration) without relying on real, expensive, and non-deterministic LLM APIs.

We strictly adhere to the **"Pipeline Integration with Mocked Intelligence"** philosophy:
- **REAL** Infrastructure (Redis, Convex, Fastify, Workers)
- **MOCKED** Intelligence (LLM API responses)

This harness will serve as the primary workbench for TDD during the V2 stabilization phase.

---

## 2. Architecture Topology

```mermaid
graph TD
    Test[Test Runner (Playwright/Vitest)] -->|1. Setup| Harness[Custom Test Harness]
    
    subgraph "Real Infrastructure (Local)"
        Harness -->|2. Start| API[Fastify Server]
        Harness -->|2. Start| Worker[Persistence Worker]
        Harness -->|Check| Redis[(Local Redis :6379)]
        Harness -->|Check| Convex[(Local Convex)]
    end
    
    subgraph "Pipeline Execution"
        Test -->|3. Submit Turn| API
        API -->|4. Use| MockAdapter[Mock Provider Adapter]
        MockAdapter -.->|5. Simulate Stream| Redis
        
        Redis -->|6. Stream Events| Worker
        Worker -->|7. Persist| Convex
        
        Redis -->|8. Stream Events| SSE[SSE Endpoint]
        SSE -->|9. Consume| Harness
    end
    
    subgraph "Verification"
        Harness -->|10. Hydrate| Reducer[ResponseReducer Lib]
        Reducer -->|11. State| HydratedObj[Response Object]
        
        Test -->|12. Assert| HydratedObj
        Test -->|13. Verify DB| Convex
    end
```

---

## 3. Harness Components

### 3.1. `TestHarness` Class
The central orchestrator for the test environment.

```typescript
interface HarnessConfig {
  redisUrl?: string;
  convexUrl?: string;
}

class TestHarness {
  public app: FastifyInstance;
  public baseUrl: string;
  public convex: ConvexHttpClient;
  public redis: RedisStream;
  
  // In-memory stream collector for assertions
  public eventCollector: EventCollector;

  static async create(config?: HarnessConfig): Promise<TestHarness>;
  
  // Lifecycle
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async reset(): Promise<void>; // Clear Redis/Convex data between tests

  // Interaction
  async submitTurn(prompt: string, mocks: MockFixture[]): Promise<string>; // Returns runId
  async waitForCompletion(runId: string): Promise<Response>;
}
```

### 3.2. Mock Injection Strategy
We avoid monkey-patching `globalThis.fetch`. Instead, we use **Dependency Injection** at the API route level.

1.  **Factory Pattern:** `src/core/model-factory.ts`
    -   Production: Returns `OpenAIStreamAdapter` / `AnthropicStreamAdapter`.
    -   Test: Returns `MockStreamAdapter`.
2.  **Configuration:** The Fastify app accepts a `modelFactory` in its constructor/plugin options.
3.  **Mechanism:**
    -   The Harness instantiates the Fastify app with a `MockModelFactory`.
    -   The `MockModelFactory` holds a registry of `MockFixture`s mapped by Prompt/Model.
    -   When `submit.ts` calls `factory.createAdapter()`, it gets the mock.

### 3.3. `MockStreamAdapter`
A compliant implementation of the `StreamAdapter` interface that replays a pre-recorded or scripted sequence of events.

```typescript
class MockStreamAdapter implements StreamAdapter {
  constructor(private fixture: MockFixture, private redis: RedisStream) {}

  async stream(params: StreamParams): Promise<{ runId: string }> {
    // 1. Publish response_start
    // 2. Iterate through fixture events
    // 3. Publish events to Redis with realistic delays (optional) or immediate flush
    // 4. Publish response_done
  }
}
```

---

## 4. The Hydration Contract (`ResponseReducer`)

The "Hydration Library" is the shared logic that turns a stream of events into a usable state object. This must be isomorphic (usable in Node tests and Browser clients).

**Location:** `src/core/reducer.ts`

```typescript
class ResponseReducer {
  private state: Response;

  constructor(initialState?: Response);

  // The Core Contract
  apply(event: StreamEvent): void;
  
  // Accessors
  getSnapshot(): Response;
  getMessages(): Message[];
  getToolCalls(): ToolCall[];
}
```

**Test Verification:**
The Harness listens to the *Real* SSE endpoint, feeds events into `ResponseReducer`, and asserts on `reducer.getSnapshot()`. This proves the Client will see the correct state.

---

## 5. Test Workflow (Step-by-Step)

### Phase 1: Infrastructure Check (Setup)
1.  Harness starts.
2.  Pings local Redis (fails if not running).
3.  Pings local Convex (fails if not running).
4.  Starts Fastify server on random port.
5.  Starts Persistence Worker (in-process for simplicity, or separate process).

### Phase 2: Execution (Run Test)
1.  **Test:** Defines a fixture: `[Thinking("Hrm..."), Message("Hello")]`.
2.  **Test:** Calls `harness.submitTurn("Hi", fixture)`.
3.  **Harness:** Registers fixture with `MockFactory`.
4.  **Harness:** POSTs to `/api/v2/submit`.
5.  **System:** Runs the full pipeline. MockAdapter emits events -> Redis -> Worker -> Convex.

### Phase 3: Consumption (SSE & Hydration)
1.  **Harness:** Connects to `GET /api/v2/stream/{runId}`.
2.  **Harness:** Pushes received SSE events into `ResponseReducer`.
3.  **Harness:** Waits for `response_done` event.

### Phase 4: Assertion (Verify)
1.  **Hydration Check:** `expect(reducer.getSnapshot()).toEqual(expectedState)`.
2.  **Persistence Check:** `expect(await convex.query(...)).toEqual(expectedState)`.
3.  **Parity Check:** `expect(reducer.getSnapshot()).toEqual(convexState)`.

---

## 6. Implementation Roadmap

1.  **Refactor `src/core/reducer.ts`:** Ensure it meets the Hydration Contract and exports a clean API.
2.  **Implement `MockStreamAdapter`:** Build the replay logic.
3.  **Implement `TestHarness`:** Build the orchestrator class.
4.  **Update `src/server.ts`:** Allow injection of `ModelFactory` for testing.
5.  **Write First Test:** "Happy Path: Single Message".

---

## 7. Next Steps

*   Approve this design.
*   Create `tests/harness/` directory.
*   Begin implementing `TestHarness`.
