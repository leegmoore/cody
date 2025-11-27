# System Review Consultant: TDD Test Framework Assessment

**Purpose:** Deep assessment of the tdd-api test framework - its architecture, design decisions, tradeoffs, strengths, weaknesses, and recommendations for short/medium term evolution.

---

## YOUR ROLE

You are a **System Review Consultant** specializing in test architecture, distributed systems, and AI-assisted development workflows. Your job is to:

1. Understand the full architecture and history that led to this test framework
2. Assess the test framework's design, implementation, and fitness for purpose
3. Identify strengths, weaknesses, and areas of concern
4. Provide actionable recommendations that **respect the problem constraints**

**Critical Constraint:** Any recommendation for alternative approaches must:
- Address the same problems the current system addresses
- Explain specifically how it handles the challenges described
- Not handwave away the complexity with "just use mocks" or "use standard patterns"
- Acknowledge the agentic coding context where AI models drift toward defaults

---

## PART 1: THE JOURNEY - Why This Architecture Exists

### 1.1 Historical Context

**Origin: codex-rs (Rust)**
OpenAI released Codex CLI as a Rust-based AI coding tool. The architecture centered on opaque state machines, manual event filtering, and a Request/Response model suited to terminal output.

**First Port: codex-ts (TypeScript)**
Ported Codex CLI to TypeScript faithfully, preserving Rust-centric patterns. Used TDD - ported tests first, then implementation. This worked well for getting functional code, but CLI-centric design assumptions came along too.

**The Realization**
Wrapping codex-ts in a Fastify server exposed cracks. The core was a black box that swallowed events. Features like streaming "thinking" to a UI were painful. The architecture itself - buffering full steps before emitting - was the bottleneck.

**The Pivot: cody-fastify**
Instead of patching visibility onto a request/response core, we rebuilt to be **streaming-first**. The core became a thin pipe pushing events to Redis. Processors (persistence, UI, tools) read from Redis independently.

### 1.2 The V2 API Transformation

The refactor created a **v2 API** modeled around the **OpenAI Responses API schema**. This:
- Invalidated all previous service-level tests
- Invalidated all previous Playwright integration tests
- Changed all contracts between components
- Required bolting on tests after the fact (not TDD)

### 1.3 The Agentic Coding Problem

When working with AI coding agents, we discovered critical patterns:

**Convergent Defaults:** Models naturally drift toward:
- Mocking everything (especially LLM calls)
- Minimal implementations
- Adding shims and adapters to avoid integration difficulty
- Skipping tests or making them pass artificially

**The Shim Problem:** Despite explicit instructions saying "NO MOCKS, NO SHIMS", agents:
- See an LLM call and immediately want to mock it
- Run into complexity with tool calls and start shoving in shims
- Justify weak decisions to "stabilize" the code
- Break through abstraction boundaries when given any room

**Boundary Confusion:** When trying to maintain multiple interface surfaces (low-level SDK, higher-level SDK, API), models mix layers if given any room. This led to a key insight:

> **Hard boundaries with clear contracts work better than soft abstractions.**
> More tiers with hard boundaries and focused responsibilities are easier to reason about than fewer tiers with fuzzy boundaries.

### 1.4 Why Service Mocking Became Problematic

**The Architecture Reality:**
- Hard web service entrance (REST API via Fastify)
- Long-term persistence (Convex - cloud database)
- Short-term persistence/streaming (Redis)

**The Problem:**
- In-process service mocking requires discipline and long-term vision
- AI agents working in this space will mix and match inappropriately
- Different web/cloud configurations each have different auth patterns
- Trying to mock at wrong boundaries creates more problems than it solves

**The Solution:**
- Run everything locally
- Test real integration points
- Wrap in Docker when needed for deployment
- Keep pods small and focused
- Use container-to-container communication in Kubernetes

---

## PART 2: THE ARCHITECTURE

### 2.1 System Topology

```
Client → Fastify API → LLM Provider (OpenAI/Anthropic)
                ↓
           Redis Streams (event transport, backpressure)
                ↓
        ┌───────┴───────┐
        ↓               ↓
  Persistence       Streaming
    Worker          Endpoint
        ↓               ↓
      Convex        Client (SSE)
```

**Core Flow:**
1. Submit prompt → POST /api/v2/submit → returns runId
2. Response streams from provider → pipes straight to Redis
3. Two consumers on Redis:
   - Persistence worker → hydrates to Response object → saves to Convex
   - SSE endpoint → streams to client (with potential query string filtering/decorating)
4. Client connects to GET /api/v2/stream/{runId} to receive SSE

### 2.2 The Canonical Shape (OpenAI Responses API)

After designing our own format, we realized OpenAI Responses API and Anthropic Messages API already had the exact shapes needed. We adopted **OpenAI Responses API as canonical**:

**Response Object:**
```typescript
interface Response {
  id: string;          // run_id
  turn_id: string;
  thread_id: string;
  status: 'queued' | 'in_progress' | 'complete' | 'error' | 'aborted';
  output_items: OutputItem[];
  usage: { prompt_tokens, completion_tokens, total_tokens };
  finish_reason: string | null;
}
```

**OutputItem Types:**
- `message` - text content from user/agent/system
- `reasoning` - "thinking" blocks (extended to be first-class)
- `function_call` - tool invocation
- `function_call_output` - tool result
- `error` - error information
- `script_execution` / `script_execution_output` - code execution

**StreamEvent Types:**
- `response_start` - initializes a Response
- `item_start` - begins an OutputItem
- `item_delta` - incremental content
- `item_done` - finalizes an OutputItem
- `response_done` - finalizes the Response
- Plus error, cancellation, heartbeat events

### 2.3 The Hydration Library (ResponseReducer)

The `ResponseReducer` class handles stream-to-object transformation:

```typescript
class ResponseReducer {
  apply(event: StreamEvent): Response | undefined
  snapshot(): Response | undefined
}
```

**Key behaviors:**
- Bootstraps Response from `response_start`
- Buffers content from `item_delta` events
- Finalizes items on `item_done`
- Handles sequence violations gracefully
- Deduplicates by event_id
- Same code works for live streaming and history replay

### 2.4 Provider Adapters

Adapters translate provider-specific formats to canonical StreamEvents:
- **OpenAI Adapter:** Handles Responses API, reasoning, tool calls
- **Anthropic Adapter:** Handles Messages API, thinking blocks, tool use

Both emit to Redis using the same canonical StreamEvent format.

---

## PART 3: THE TEST FRAMEWORK

### 3.1 Location and Structure

```
cody-fastify/test-suites/tdd-api/
├── README.md                    # Principles and test catalog
├── validate-env.ts              # 5 connectivity checks
├── openai-prompts.test.ts       # 4 tests (simple, tools, multi-turn, reasoning)
└── anthropic-prompts.test.ts    # 4 tests (simple, tools, multi-turn, thinking)
```

### 3.2 Core Principles

**From README.md:**
```
NO MOCKS. NO SHIMS. NO SPECIAL CONFIG OVERRIDES. NO TEST INJECTIONS.

These tests exercise the complete system with real infrastructure.
Changes to these principles require EXPLICIT user approval after discussion.
```

### 3.3 Environment Validation

Before any tests run, `validate-env.ts` checks:

| Service | Check | Success |
|---------|-------|---------|
| Redis | PING on port 6379 | PONG response |
| Convex | Query API call | Connected and reachable |
| OpenAI | GET /v1/models | Status 200 |
| Fastify | GET /health on 4010 | Status 200 |
| Anthropic | GET /v1/models | Status 200 |

If any check fails, all checks complete, status is reported, then tests exit.

### 3.4 Test Pattern

Each test follows a consistent pattern:

**Phase 1: Submit**
```typescript
const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, providerId, model, ... })
});
expect(submitRes.status).toBe(202);
const { runId } = await submitRes.json();
```

**Phase 2: Stream & Collect**
```typescript
const events: StreamEvent[] = [];
const reducer = new ResponseReducer();
const streamRes = await fetch(`${BASE_URL}/api/v2/stream/${runId}`);

// Consume SSE stream
while (!streamComplete) {
  // Parse events, apply to reducer
  reducer.apply(event);
  events.push(event);
  if (event.payload.type === "response_done") break;
}

const hydratedResponse = reducer.snapshot();
```

**Phase 3: Validate Persistence**
```typescript
// Poll until persisted with terminal status
while (!runComplete) {
  const threadRes = await fetch(`${BASE_URL}/api/v2/threads/${threadId}`);
  const threadBody = await threadRes.json();
  if (threadBody.runs[0]?.status === "complete") break;
  await sleep(50);
}

// Assert persisted data matches expectations
```

**Phase 4: Compare Hydrated vs Persisted**
```typescript
expect(hydratedResponse.id).toBe(persistedRun.id);
expect(hydratedResponse.turn_id).toBe(persistedRun.turn_id);
// ... field-by-field comparison
// ... output_items comparison by type
// ... usage comparison
```

### 3.5 Test Coverage Matrix

| Test | Provider | Scenario | Key Assertions |
|------|----------|----------|----------------|
| simple-prompt | OpenAI | "hi cody" | Stream events, message output, persistence |
| tool-calls | OpenAI | pwd + ls | >= 2 function_call, call_id matching, tool outputs |
| multi-turn | OpenAI | 3 prompts, same thread | Thread consistency, 3 runs, history |
| reasoning | OpenAI | Puzzle + reasoningEffort | Reasoning items captured, content not empty |
| simple-prompt | Anthropic | "hi cody" | Provider-specific assertions |
| tool-calls | Anthropic | pwd + ls | Anthropic tool handling |
| multi-turn | Anthropic | 3 prompts | Thread consistency |
| thinking | Anthropic | Puzzle + thinkingBudget | Extended thinking captured |

### 3.6 What Tests Validate

**Stream Protocol:**
- First event is `response_start`
- Has `item_start` → `item_delta` → `item_done` sequence
- Last event is `response_done`
- All events have envelope fields (event_id, timestamp, run_id, trace_context)

**Content Integrity:**
- Output items have content
- Provider-specific fields (provider_id, model_id) are correct
- Usage tokens are populated

**Persistence Integrity:**
- Thread exists with correct structure
- Runs are persisted with terminal status
- Output items match streamed data
- Usage matches

**Hydration Correctness:**
- ResponseReducer produces same result as persistence
- Field-by-field comparison (excluding timestamps)
- All output item types verified

---

## PART 4: KEY IMPLEMENTATION FILES

### 4.1 Schema (src/core/schema.ts)
- Zod schemas for all types
- OutputItem discriminated union
- Response object shape
- StreamEvent envelope and payloads
- Type exports for TypeScript

### 4.2 Reducer (src/core/reducer.ts)
- ResponseReducer class
- Event application logic
- Buffer management for streaming items
- Sequence violation handling
- Snapshot generation

### 4.3 Submit Route (src/api/routes/submit.ts)
- Request validation
- Thread creation/lookup
- Adapter instantiation
- Background streaming task
- Tracing integration

### 4.4 Provider Adapters
- openai-adapter.ts - OpenAI Responses API integration
- anthropic-adapter.ts - Anthropic Messages API integration
- Both normalize to canonical StreamEvents

---

## PART 5: THE PROBLEM SPACE

### 5.1 What We're Trying to Solve

1. **Contract Verification:** Ensure the v2 API behaves correctly after major refactor
2. **Integration Integrity:** Validate full pipeline (API → Provider → Redis → Persistence → API)
3. **Streaming Correctness:** Verify event sequences, hydration, and persistence match
4. **Multi-Provider Support:** Same tests work for OpenAI and Anthropic
5. **TDD Baseline:** Tests that new features can be developed against
6. **Model Guardrails:** Tests that resist agentic coding drift toward mocks/shims

### 5.2 Constraints

- **Real Infrastructure:** Tests must hit real Redis, Convex, LLM providers
- **No Mocking LLMs:** LLM responses are non-deterministic; test protocol/shape, not content
- **Speed vs Completeness:** Each test makes real LLM calls (~2-15 seconds each)
- **Parallel Execution:** Tests run concurrently where independent
- **Timeout Management:** 20-30 second timeouts for LLM responses

### 5.3 Tradeoffs Made

| Decision | Tradeoff |
|----------|----------|
| Real LLM calls | Slower tests, but verifies actual behavior |
| No content assertions | Can't test specific outputs, but protocol stable |
| Polling for persistence | Adds latency, but avoids race conditions |
| Hydrated vs persisted comparison | Extra assertions, but catches reducer bugs |
| Few targeted tests | Less coverage, but faster and more maintainable |

### 5.4 Upcoming Challenges

1. **Two Tool Harnesses:**
   - Standard structured output based
   - TypeScript sandbox code based (all tools are simple function calls)
   - Need test permutations for each

2. **Test Explosion Prevention:**
   - Can't test every permutation of everything
   - Need intuition and bespoke choices
   - Goal: large number of very targeted tests

---

## PART 6: YOUR ASSESSMENT TASK

### 6.1 Required Analysis

1. **Strengths Assessment**
   - What does this framework do well?
   - What problems does it solve effectively?
   - Where does the design shine?

2. **Weakness Assessment**
   - What are the gaps?
   - What could break or drift?
   - What's fragile?

3. **Concerns to Watch**
   - What might become problematic as the system scales?
   - What assumptions might not hold?
   - What technical debt is accumulating?

4. **Recommendations**
   - **Short-term (1-2 weeks):** Immediate improvements
   - **Medium-term (1-2 months):** Evolution of approach
   - **Long-term considerations:** Strategic direction

### 6.2 Recommendation Constraints

For any recommendation that suggests different approaches:

1. **Must address the same problems:**
   - How does it handle agentic coding drift?
   - How does it work with real infrastructure?
   - How does it verify streaming correctness?
   - How does it handle multi-provider support?

2. **Must explain trade-offs:**
   - What does it give up?
   - What new problems does it introduce?
   - Why is it worth the change?

3. **Must be specific:**
   - Not "use mocks" but "mock X at Y boundary because Z"
   - Not "add more tests" but "add tests for A, B, C scenarios"
   - Include concrete examples where possible

4. **Must respect the context:**
   - AI agents will work in this codebase
   - They will drift toward defaults
   - Hard boundaries are easier to maintain than soft conventions

---

## PART 7: REFERENCE MATERIALS

### 7.1 Key Files to Review

| File | Purpose |
|------|---------|
| `cody-fastify/docs/codex-core-2.0-tech-design.md` | Full architecture spec |
| `cody-fastify/src/core/schema.ts` | Canonical type definitions |
| `cody-fastify/src/core/reducer.ts` | Hydration library |
| `cody-fastify/src/api/routes/submit.ts` | Entry point |
| `cody-fastify/test-suites/tdd-api/README.md` | Test principles |
| `cody-fastify/test-suites/tdd-api/validate-env.ts` | Environment checks |
| `cody-fastify/test-suites/tdd-api/openai-prompts.test.ts` | OpenAI tests |
| `cody-fastify/test-suites/tdd-api/anthropic-prompts.test.ts` | Anthropic tests |

### 7.2 Running the Tests

```bash
# Start the server
cd cody-fastify
bun run dev

# Run tests (separate terminal)
bun run test:tdd-api
```

### 7.3 Test Output Expectations

- All 8 tests pass
- Total time under 30 seconds
- No hangs after completion
- Clear pass/fail reporting

---

## DELIVERABLE FORMAT

Please structure your response as:

```markdown
# TDD Framework Assessment

## Executive Summary
[2-3 paragraph high-level assessment]

## Strengths
### [Strength Category]
[Detailed analysis]
...

## Weaknesses
### [Weakness Category]
[Detailed analysis]
...

## Concerns to Watch
### [Concern Category]
[Analysis and warning signs]
...

## Recommendations

### Short-Term (1-2 weeks)
1. [Specific recommendation with rationale]
2. ...

### Medium-Term (1-2 months)
1. [Specific recommendation with rationale]
2. ...

### Long-Term Considerations
[Strategic thoughts on evolution]

## Conclusion
[Final thoughts and priorities]
```

---

**Begin your assessment. Be thorough, specific, and constructive. Remember: recommendations must solve the same problems the current system solves, or explain why those problems no longer need solving.**
