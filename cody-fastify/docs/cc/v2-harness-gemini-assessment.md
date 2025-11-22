# Gemini vs Claude: V2 Custom Test Harness Design Assessment

**Date:** 2025-01-22
**Comparing:**
- Gemini's design: `docs/gem/v2-custom-harness-gem.md`
- Claude's design: `docs/cc/v2-custom-harness-cc.md`

---

## Executive Summary

Both designs propose the same core philosophy (mock LLMs, exercise real infrastructure) but differ significantly in **implementation strategy**, **level of detail**, and **practical considerations**.

**Key Difference:**
- **Gemini:** Emphasizes dependency injection, factory pattern, lightweight design
- **Claude:** Emphasizes global fetch mocking, comprehensive fixtures, detailed implementation specs

**Recommendation:** Hybrid approach combining Gemini's cleaner architecture with Claude's operational detail.

---

## What's the Same ✅

### **1. Core Philosophy (100% Aligned)**

Both designs agree on the fundamental testing strategy:

| Aspect | Gemini | Claude |
|--------|--------|--------|
| Mock LLM APIs | ✅ Yes | ✅ Yes |
| Real Redis | ✅ Yes | ✅ Yes |
| Real Convex | ✅ Yes | ✅ Yes |
| Real Fastify | ✅ Yes | ✅ Yes |
| Real Workers | ✅ Yes | ✅ Yes |
| Real SSE | ✅ Yes | ✅ Yes |

**Verdict:** No philosophical disagreement. Both reject "mock everything" and "E2E only" extremes.

---

### **2. Test Harness Lifecycle (Conceptually Identical)**

Both propose:
```
Setup: Start Fastify + Workers, connect to Redis/Convex
Execute: Submit turn, wait for completion
Verify: Assert on hydrated Response + Convex state
Cleanup: Stop services, restore mocks
```

**Verdict:** Same high-level workflow.

---

### **3. Hydration Library (Same Concept)**

Both recognize need for `ResponseReducer` to hydrate `StreamEvent[]` → `Response`.

**Verdict:** Agreement on the "what," different on the "how" (see differences below).

---

## What's Different ⚠️

### **Difference 1: Mocking Strategy**

| Aspect | Gemini | Claude |
|--------|--------|--------|
| **Approach** | Dependency injection via ModelFactory | Global fetch mocking |
| **Mock Location** | Factory returns `MockStreamAdapter` | `globalThis.fetch = mockFn` |
| **Adapter Change** | Requires refactoring `submit.ts` to accept factory | No production code changes |
| **Test Setup Complexity** | Simple (pass mock factory to harness) | Moderate (setup/teardown fetch mock) |
| **Production Code Impact** | **Requires factory pattern in production** | **No changes to production code** |

**Analysis:**

**Gemini's Approach (Dependency Injection):**
- ✅ **Pros:** Cleaner architecture, explicit dependencies, no global mutation
- ❌ **Cons:** Requires production code refactor, adds factory abstraction, more upfront work

**Claude's Approach (Global Fetch Mock):**
- ✅ **Pros:** Zero production code changes, works immediately, simple to implement
- ❌ **Cons:** Global state mutation (less clean), harder to debug if fetch calls overlap

**My Assessment:**

Gemini's approach is **architecturally superior** but requires **refactoring production code** to support dependency injection. This is net-positive long-term (better testability, clearer dependencies) but adds scope.

Claude's approach is **pragmatic** for immediate testing needs but creates **technical debt** (global mocking is a code smell).

**Recommendation:**
- **Short-term:** Use Claude's global fetch mock to unblock testing NOW
- **Long-term:** Refactor to Gemini's factory pattern in Phase 7 (Model Registry work)

---

### **Difference 2: Level of Detail**

| Aspect | Gemini | Claude |
|--------|--------|--------|
| **Document Length** | 190 lines | 490 lines |
| **Code Examples** | 5 snippets | 15+ snippets |
| **Test Scenarios** | Mentioned conceptually | 30 scenarios in 6 categories (table) |
| **Fixtures** | Not specified | Full JSON examples provided |
| **Implementation Phases** | Mentioned, not detailed | 5 phases with effort estimates |
| **Risks/Open Questions** | Not covered | 3 risks, 2 open questions with mitigations |

**Analysis:**

Gemini's doc is a **high-level design** suitable for alignment discussion.

Claude's doc is an **implementation specification** ready for a coding agent to execute.

**My Assessment:**

Both levels of detail are valuable for different purposes:
- **Gemini's:** Better for stakeholder review, faster to read, focuses on "what/why"
- **Claude's:** Better for implementation, provides "how" with explicit guidance

**Recommendation:** Keep both. Gemini's is the "design intent," Claude's is the "build spec."

---

### **Difference 3: Mermaid Diagram**

**Gemini:** ✅ Includes detailed Mermaid flow diagram showing full pipeline

**Claude:** ❌ Uses ASCII art + text description (no Mermaid)

**Analysis:**

Gemini's diagram is **excellent** for visualizing the architecture. Claude's ASCII is functional but less clear.

**Recommendation:** Adopt Gemini's Mermaid diagram in final spec.

---

### **Difference 4: Technology Choice**

| Aspect | Gemini | Claude |
|--------|--------|--------|
| **Test Runner** | Playwright or Vitest (undecided) | **Vitest + Supertest (decided)** |
| **HTTP Testing** | Not specified | Supertest (explicit) |
| **SSE Consumption** | Not specified | EventSource polyfill (`eventsource` npm) |
| **Justification** | Not provided | Detailed pros/cons comparison |

**Analysis:**

Claude made a specific recommendation (Vitest + Supertest) with reasoning:
- Faster than Playwright (no browser)
- Better TypeScript integration
- Consistent with codex-ts tests

Gemini left it open for discussion.

**My Assessment:**

Claude's choice is **correct** for API-level testing. No need for browser environment.

**Recommendation:** Adopt Vitest + Supertest as decided in Claude's design.

---

### **Difference 5: Mock Adapter Implementation**

**Gemini:**
```typescript
class MockStreamAdapter implements StreamAdapter {
  async stream(params: StreamParams): Promise<{ runId: string }> {
    // 1. Publish response_start
    // 2. Iterate through fixture events
    // 3. Publish to Redis
    // 4. Publish response_done
  }
}
```

**Claude:**
```typescript
function mockLLMFetch(responses: Record<string, MockLLMResponse>) {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    if (url.includes('api.openai.com')) {
      return createMockStreamingResponse(getOpenAIFixture(...));
    }
    // ... handle Anthropic, OpenRouter
    return originalFetch(url); // Pass through
  });
}
```

**Key Difference:**

- **Gemini:** Mock at the **Adapter level** (above fetch)
- **Claude:** Mock at the **fetch level** (below adapter)

**Trade-offs:**

| Approach | Pros | Cons |
|----------|------|------|
| **Gemini (Mock Adapter)** | Tests adapter interface, cleaner API boundary | Doesn't test real adapter normalization logic |
| **Claude (Mock Fetch)** | Tests real adapter normalization, catches bugs in adapter | Global state, messier |

**My Assessment:**

This is the **most significant design decision**.

**Gemini's approach:** Tests that adapters *can* emit events, but doesn't validate they emit *correct* events from real API chunks.

**Claude's approach:** Tests the full adapter (fetch → parse → normalize → emit), which is critical since normalization is complex (handling deltas, content blocks, etc.).

**Recommendation:** **Use Claude's approach (mock fetch)** because:
- Adapter normalization IS the risky code we need to validate
- Missing this was a failure mode in original Core 2.0 (thinking blocks dropped)
- We can still test MockAdapter separately if needed for simpler scenarios

---

## What Gemini Missed

### **1. Fixture Management**

Claude specified:
- JSON fixture files with expected inputs/outputs
- Organized by provider (`tests/fixtures/openai/`, `anthropic/`, etc.)
- Example fixture with full SSE chunk structure

Gemini: Not addressed.

**Impact:** Without fixtures, tests become ad-hoc and inconsistent.

**Recommendation:** Adopt Claude's fixture structure.

---

### **2. Test Scenario Catalog**

Claude provided:
- 30 test scenarios organized into 6 categories
- Table format with Test IDs, fixtures, assertions
- Coverage map (basic turns, tools, errors, streaming, persistence)

Gemini: Only mentioned "happy path, tool calls, thinking" conceptually.

**Impact:** No clear test plan for coding agent to implement.

**Recommendation:** Adopt Claude's test scenario table as implementation checklist.

---

### **3. Hydration Library API**

Claude specified:
- Complete `StreamHydrator` class interface
- `hydrateFromSSE()` method (for live streams)
- `hydrateFromEvents()` method (for testing)
- `getPartial()` for incremental updates
- Error handling (`HydrationError`)

Gemini: Only mentioned `ResponseReducer` exists, no client wrapper.

**Impact:** Coding agent would have to infer the API.

**Recommendation:** Use Claude's `StreamHydrator` wrapper (adds convenience on top of `ResponseReducer`).

---

### **4. Open Questions & Risks**

Claude identified:
- EventSource polyfill needed for Node.js
- Convex in CI challenge (no dev server)
- Fixture drift risk (APIs change)
- Test flakiness from real services

Gemini: No risk analysis.

**Impact:** Implementation will hit these issues without mitigation plans.

**Recommendation:** Adopt Claude's risk/mitigation section.

---

### **5. Implementation Phases**

Claude provided:
- 5 phases with line count estimates
- Clear deliverables per phase
- Success criteria for each phase

Gemini: Single "Implementation Roadmap" with 5 steps, no detail.

**Impact:** Harder to track progress, estimate effort.

**Recommendation:** Use Claude's phased approach for execution planning.

---

## What Claude Missed

### **1. Mermaid Diagram**

Gemini included a clear visual flow diagram showing:
- Test Runner → Harness → Infrastructure
- Pipeline execution (API → Adapter → Redis → Worker → Convex/SSE)
- Verification flow (hydration, assertions)

Claude: Only ASCII diagrams.

**Impact:** Gemini's diagram is clearer for understanding architecture at a glance.

**Recommendation:** Adopt Gemini's Mermaid diagram.

---

### **2. Dependency Injection Pattern**

Gemini proposed a **factory pattern** for adapter creation:

```typescript
interface ModelFactory {
  createAdapter(provider: string, model: string): StreamAdapter;
}

// Production
const factory = new ProductionModelFactory();

// Test
const factory = new MockModelFactory(fixtures);
```

Claude: Didn't propose factory pattern, relies on global fetch mock.

**Impact:** Gemini's approach is more testable and maintainable long-term.

**Recommendation:** Consider factory pattern for Phase 7 refactor (not now).

---

### **3. EventCollector Utility**

Gemini mentioned:
```typescript
public eventCollector: EventCollector; // In-memory stream collector for assertions
```

This is an interesting idea: a utility that captures all events flowing through Redis for debugging.

Claude: Provided `getRedisEvents()` method but didn't formalize an EventCollector abstraction.

**Analysis:** EventCollector could be useful for:
- Debugging (inspect full event sequence)
- Assertions (verify event order, count)
- Replay (record real runs for regression tests)

**Recommendation:** Add EventCollector utility in Phase 2 (nice-to-have, not critical).

---

### **4. Reset Between Tests**

Gemini specified:
```typescript
async reset(): Promise<void>; // Clear Redis/Convex data between tests
```

Claude: Mentioned cleanup in `afterEach()` but didn't formalize reset method.

**Analysis:** Explicit reset() is cleaner than manual cleanup in every test.

**Recommendation:** Add `harness.reset()` method that:
- Deletes test Redis streams
- Deletes test Convex documents
- Resets worker state

---

## What I Disagree With

### **Disagreement 1: Gemini's Factory Pattern (For Now)**

**Gemini says:** Use dependency injection via ModelFactory.

**My position:** This requires refactoring production code (`submit.ts`, adapter creation) which adds scope to an already complex phase.

**Reasoning:**
- Factory pattern is the RIGHT long-term design
- But we need tests NOW to validate existing code
- Global fetch mock gets us testing immediately
- Factory can be added in Phase 7 (Model Registry refactor)

**Recommendation:** Defer factory pattern, use global mock for Phase 6.

---

### **Disagreement 2: Claude's Alternative Approaches Appendix**

**Claude included:** "Appendix B: Alternative Approaches Considered" with rejected options (mock everything, full E2E only, Redis mock).

**My position:** This is valuable context for understanding WHY this approach was chosen.

**Gemini didn't include:** Alternatives analysis.

**Verdict:** Claude's appendix is useful. Keep it.

---

### **Disagreement 3: Gemini's Brevity**

**Gemini's doc:** 190 lines, high-level, focuses on concepts.

**My concern:** Not enough detail for a coding agent to execute without asking questions.

**Example:** Gemini says "implement MockStreamAdapter" but doesn't show:
- How to handle streaming delays
- How to emit events to Redis
- What fixture structure looks like

**Verdict:** Gemini's brevity is too extreme for implementation. Claude's detail is appropriate for a build spec.

---

## Synthesis: Best of Both Worlds

### **Adopt from Gemini:**

1. ✅ **Mermaid diagram** (clearer than ASCII)
2. ✅ **EventCollector concept** (useful utility)
3. ✅ **reset() method** (cleaner than manual cleanup)
4. ✅ **Long-term factory pattern vision** (defer to Phase 7)

### **Adopt from Claude:**

1. ✅ **Global fetch mock** (immediate, no refactor needed)
2. ✅ **Comprehensive fixture catalog** (30 test scenarios)
3. ✅ **Full fixture examples** (JSON structure shown)
4. ✅ **StreamHydrator API** (complete interface)
5. ✅ **Implementation phases** (effort estimates, deliverables)
6. ✅ **Risk analysis** (open questions, mitigations)
7. ✅ **Technology decision** (Vitest + Supertest justified)
8. ✅ **Performance targets** (< 10 sec suite)

---

## Recommended Combined Design

### **Architecture: Gemini's Diagram + Claude's Detail**

```mermaid
graph TD
    Test[Test Runner: Vitest] -->|1. Setup| Harness[Core2TestHarness]

    subgraph "Real Infrastructure"
        Harness -->|Start| API[Fastify Server]
        Harness -->|Start| Worker[Persistence Worker]
        Harness -->|Connect| Redis[(Redis :6379)]
        Harness -->|Connect| Convex[(Convex Dev)]
    end

    subgraph "Mocked Boundary"
        API --> Adapter[Real Provider Adapter]
        Adapter -->|fetch()| MockFetch[Mocked LLM API]
        MockFetch -.->|Returns| Fixture[SSE Fixture]
    end

    subgraph "Pipeline Flow"
        Adapter -->|Normalize| Events[StreamEvents]
        Events -->|XADD| Redis
        Redis -->|XREADGROUP| Worker
        Worker -->|Apply| Reducer[ResponseReducer]
        Reducer -->|Write| Convex

        Redis -->|XREAD| SSE[SSE Endpoint]
        SSE -->|Stream| Client[Test Harness Client]
    end

    subgraph "Verification"
        Client -->|Hydrate| Hydrator[StreamHydrator]
        Hydrator -->|Build| Response[Response Object]
        Test -->|Assert| Response
        Test -->|Verify| Convex
    end
```

**Source:** Gemini's Mermaid + Claude's component names

---

### **Mocking: Claude's Approach (Short-Term)**

Use global fetch mock as Claude specified:

```typescript
// tests/mocks/llm-fetch.ts
export function mockLLMFetch(responses: Record<string, MockLLMResponse>) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = vi.fn(async (url, init) => {
    if (url.includes('api.openai.com')) {
      return createMockStreamingResponse(getOpenAIFixture(...));
    }
    return originalFetch(url, init); // Pass through
  });

  return () => { globalThis.fetch = originalFetch; };
}
```

**Future:** Migrate to Gemini's factory pattern when refactoring model selection (Phase 7).

---

### **Harness API: Hybrid**

Combine Gemini's `reset()` with Claude's detailed API:

```typescript
export class Core2TestHarness {
  // From Gemini
  async reset(): Promise<void> {
    await this.clearRedisStreams();
    await this.clearConvexData();
  }

  // From Claude
  async submit(params: {prompt, model, providerId?, threadId?}): Promise<{runId, streamUrl}>;
  async hydrateStream(streamUrl: string): Promise<Response>;
  async getPersistedResponse(runId: string): Promise<Response | null>;
  async waitForPersistence(runId: string, timeoutMs?): Promise<void>;
  setMockResponse(fixture: MockLLMResponse): void;
  async getRedisEvents(runId: string): Promise<StreamEvent[]>;

  // From Gemini
  public eventCollector: EventCollector; // For debugging
}
```

---

### **Fixtures: Claude's Structure + Gemini's Simplicity**

Use Claude's organized fixture structure:
```
tests/fixtures/
├── openai/
│   ├── simple-message.json
│   ├── thinking-message.json
│   └── tool-call.json
├── anthropic/
└── expected/
    └── responses.json
```

But keep fixtures **simple** (like Gemini implied) - only as complex as needed.

---

### **Test Scenarios: Claude's Catalog**

Use Claude's 30-scenario table as the implementation checklist:
- 4 scenarios: Basic Turn Types
- 4 scenarios: Tool Execution
- 3 scenarios: Provider Variations
- 4 scenarios: Error Handling
- 4 scenarios: Streaming Behavior
- 4 scenarios: Persistence Validation

This provides clear scope and progress tracking.

---

### **Implementation Phases: Claude's Breakdown**

Use Claude's 5-phase plan:
1. Harness Infrastructure (~300 lines)
2. Hydration Library (~200 lines)
3. Basic Turn Tests (~400 lines)
4. Tool Execution Tests (~300 lines)
5. Error & Edge Cases (~600 lines)

**Total effort:** ~1800 lines, ~3-5 days of focused work.

---

## Final Recommendations

### **Use This Hybrid Approach:**

1. **Architecture Diagram:** Gemini's Mermaid
2. **Mocking Strategy:** Claude's global fetch (short-term)
3. **Harness API:** Hybrid (Claude's methods + Gemini's reset/collector)
4. **Fixtures:** Claude's structure and examples
5. **Test Scenarios:** Claude's 30-scenario catalog
6. **Implementation Plan:** Claude's 5 phases
7. **Technology:** Claude's decision (Vitest + Supertest)
8. **Risk Analysis:** Claude's open questions + mitigations

### **Document Strategy:**

- **Keep Gemini's doc** as high-level design (for alignment, stakeholders)
- **Keep Claude's doc** as implementation spec (for coding agents)
- **Create synthesis doc** (this assessment) showing combined approach

---

## What Neither Design Addressed

### **Gap 1: Thread History Loading**

Neither design discussed how multi-turn conversations work in tests:

**Question:** For turn 2+, how does the test load thread history?

**Answer Needed:**
```typescript
// Turn 1
const {runId: run1} = await harness.submit({
  prompt: 'Hello',
  threadId: 'thread_123'
});

// Turn 2 - how is history loaded?
const {runId: run2} = await harness.submit({
  prompt: 'What did I just say?',
  threadId: 'thread_123' // Need to load run1 as context
});
```

**Implication:** Harness needs thread management utilities or tests are single-turn only.

**Recommendation:** Add to Phase 4 or defer to v2 CRUD endpoint implementation.

---

### **Gap 2: Worker Auto-Start**

Neither design specified how workers start in the harness.

**Options:**
1. Harness spawns worker processes (child_process)
2. Harness imports and runs workers in-process (threads)
3. Assumes workers already running (manual setup)

**Recommendation:** Start workers **in-process** for simplicity:
```typescript
const worker = new PersistenceWorker(redis, convex);
await worker.start(); // Runs consume loop in background
```

This keeps tests self-contained (no separate processes to manage).

---

### **Gap 3: Test Data Cleanup Strategy**

Both mention cleanup but don't specify:

**Questions:**
- Delete Redis streams after each test?
- Delete Convex documents after each test?
- OR keep accumulating and rely on unique IDs?

**Recommendation:** Clean up per test to avoid pollution:
```typescript
afterEach(async () => {
  await harness.reset(); // Deletes streams/docs from this test
});
```

---

## Conclusion

**Gemini's design:** Architecturally clean, lightweight, good for discussion.

**Claude's design:** Operationally detailed, ready for implementation, better for execution.

**Combined approach:** Use Gemini's architecture (Mermaid, reset, collector) with Claude's implementation detail (fixtures, test catalog, phases, risks).

**Next step:** Create a **synthesis document** that merges the best of both into a single canonical design for the coding agent to implement.

Should I create that synthesis doc now?
