# Planner Agent Initialization

**Purpose:** Seed document to bring a planning agent up to speed on this workspace - the project, its history, the architecture, current state, and how we work.

**How to use:** Load this at session start. It provides enough context to function as a strategic planning partner without requiring extensive file exploration.

---

## The Journey

This workspace contains an AI agent harness that has evolved through several generations. Understanding the journey matters because it explains why things are shaped the way they are.

**Origin: codex-rs**
OpenAI released Codex CLI, a Rust-based tool for AI-assisted coding. The architecture centered on opaque state machines, manual event filtering, and a Request/Response model suited to terminal output.

**First Port: codex-ts**
Ported Codex CLI to TypeScript faithfully, preserving the Rust-centric patterns. Used TDD - ported tests first, then implementation. This worked well for getting functional code, but the CLI-centric design assumptions came along too.

**The Realization**
Wrapping codex-ts in a Fastify server exposed cracks. The core was a black box that swallowed events. Features like streaming "thinking" to a UI were painful. The architecture itself - buffering full steps before emitting - was the bottleneck.

**The Pivot: cody-fastify**
Instead of patching visibility onto a request/response core, we rebuilt to be **streaming-first**. The core became a thin pipe pushing events to Redis. Processors (persistence, UI, tools) read from Redis independently.

**Key Insight: One Shape, Multiple Hydration Levels**
We realized we were fighting format proliferation - one format for streaming, another for persistence, another for loading to UI. The solution: use the **OpenAI Responses API schema** as canonical throughout. Same shape everywhere, just inflated or deflated based on need.

This wasn't arbitrary - we discovered the Responses API was designed for exactly this problem. Once we understood the problem ourselves, the API design made sense.

---

## Architecture Overview

The system is streaming-native. Events flow through Redis, get persisted to Convex, and stream to clients - all using the same canonical shape.

```
                    ┌─────────────────────────────────────────────┐
                    │              cody-fastify                    │
                    │                                              │
  Client ──────────►│  Fastify API                                │
     │              │      │                                       │
     │              │      ▼                                       │
     │              │  Provider Adapter (OpenAI / Anthropic)      │
     │              │      │                                       │
     │              │      │ StreamEvents                         │
     │              │      ▼                                       │
     │              │  Redis Streams ◄─────────────────────────┐  │
     │              │      │                                   │  │
     │              │      ├──────────────►  PersistenceWorker │  │
     │              │      │                      │            │  │
     │              │      │                      ▼            │  │
     │              │      │                   Convex          │  │
     │              │      │                                   │  │
     │              │      └──────────────►  ToolWorker ───────┘  │
     │              │                                              │
     │◄─────────────│  SSE Endpoint (streams events to client)    │
                    │                                              │
                    └─────────────────────────────────────────────┘
```

**Data Flow:**
1. Client submits prompt via API
2. Adapter streams from LLM, normalizes to StreamEvents, writes to Redis
3. Redis fans out: PersistenceWorker saves to Convex, SSE streams to client
4. If tool calls detected, ToolWorker executes and writes results back to stream

**The Canonical Shapes:**

The entire system uses three interlocking types defined in `cody-fastify/src/core/schema.ts`:

**Response** - The container for a complete turn:
```typescript
{
  id: string,
  turn_id: string,
  thread_id: string,
  status: 'queued' | 'in_progress' | 'complete' | 'error' | 'aborted',
  output_items: OutputItem[],  // The actual content
  usage: { prompt_tokens, completion_tokens, total_tokens },
  // ...
}
```

**OutputItem** - A piece of content within a Response:
```typescript
type OutputItem =
  | { type: 'message', content: string, origin: 'user' | 'agent' | 'system' }
  | { type: 'reasoning', content: string }  // "thinking" blocks
  | { type: 'function_call', name: string, arguments: string, call_id: string }
  | { type: 'function_call_output', call_id: string, output: string, success: boolean }
  | { type: 'error', code: string, message: string }
  // ... script execution variants
```

**StreamEvent** - Mutations to a Response, flowing through Redis/SSE:
```typescript
{
  event_id: string,
  run_id: string,
  type: 'response_start' | 'item_start' | 'item_delta' | 'item_done' | 'response_done' | ...,
  payload: { ... }  // Type-specific data
}
```

**The key insight:** StreamEvents describe changes. A client or worker applies events to build/update a Response. Same logic works for live streaming (apply as events arrive) and history loading (apply all events at once).

---

## Current State

**What's Working:**
- Core streaming pipeline (adapters → Redis → workers → persistence)
- OpenAI and Anthropic adapters producing canonical StreamEvents
- Redis fanout to multiple consumers
- Convex persistence via PersistenceWorker
- Basic vanilla JS/HTML UI that renders streams
- Thread and run management via API
- Approximately 70% of tests passing

**What's Broken or Incomplete:**
- **Test infrastructure integrity** - Agents snuck in scaffolds that changed behavior to make tests pass. Lost confidence in service-level mocks. Need to either re-scaffold properly or move to E2E-only approach.
- **Model/provider configuration** - No clean system for specifying which model to use, switching providers, etc.
- **UI complexity ceiling** - Vanilla JS working but hitting limits. Thinking about React/Next.js.
- **Thinking display** - The "reasoning" blocks aren't rendering properly in UI yet.

**Technical Debt:**
- codex-ts package is deprecated - utilities being migrated out, package will eventually be deleted
- Some v1 routes exist but aren't mounted
- Legacy client-stream code paths remain

---

## How We Work: Knowledge Transfer Principles

This section captures principles for creating documentation, prompts, and knowledge artifacts that work well with AI agents. These aren't engineering rules - they're craft knowledge, somewhere between technique and intuition.

### Narrative as Substrate

Human knowledge representation is built on narrative - what happened, then what happened next, and why. LLMs, trained on internet text, use this same substrate. Conforming to it creates more efficient encoding.

**The failure mode:** Flat bullets treat all items as equal weight. Reader/model doesn't know what matters. Key insights lost in noise.

**The pattern:** Prose paragraphs establish branches (context, importance, relationships). Bullets hang leaves off those branches (specifics, details). The paragraph signals "important context coming." The bullets signal "details within that context."

```
We support two authentication methods with different tradeoffs. API keys are
straightforward - read from config, pass in headers. OAuth is more complex
because we're not implementing flows, just reading tokens that other CLIs
have already obtained.

Methods:
- API keys: OpenAI, Anthropic (stored in config.toml)
- OAuth tokens: ChatGPT, Claude (from keyring)
```

The paragraph creates the branch. The bullets hang the leaves.

### Progressive Disclosure (The Whiteboard Phenomenon)

In whiteboard sessions, people who BUILD a diagram together understand it deeply. People who RECEIVE the finished diagram are overwhelmed.

Why? The builders experienced progressive construction - empty board, first component, relationship to first, next component, connections emerge. This temporal progression creates scaffolding for complexity.

**The failure mode:** Dumping a complex diagram first, then explaining. Reader gets end state with no construction narrative. Cognitive overload.

**The pattern:** Build understanding incrementally. Concept first (prose, no diagram). Simple visual. Describe the visual. Zoom into critical path. More detail. Finally, the synthesis diagram. By then, reader has scaffolding - the complex diagram confirms rather than overwhelms.

This applies to all knowledge transfer, not just diagrams. Don't exhaust topic A, then topic B, then topic C. Wind through the topics, making the whole picture progressively more detailed.

### Altitude and Smooth Descent

Documentation exists at different altitudes - high-level vision down to implementation details. The problem is altitude jumps - going from "user can collaborate" directly to "set the X-Collaboration-Token header to UUID v4" with nothing in between.

**The pattern:** Each level answers questions raised by the level above. If high-level says "user can chat," next level says "via ConversationManager → Codex → ModelClient," next level says "createConversation() takes config, returns conversation," next level is actual code.

Smooth descent. No gaps. Reader follows the thread.

### Functional-Technical Weaving

Traditional separation - product writes functional requirements, throws over wall, engineering writes technical specs - creates disconnect. How does "user can chat" map to "WebSocket connection"?

**The pattern:** Maintain both perspectives at every level. Technical decisions tied to functional needs. Every capability has both "user can do X" and "implemented via Y." Tests verify functional outcomes ("can user chat?") not just technical correctness ("does method return object?").

This prevents over-engineering. Can't add event emitters and plugin systems when constantly checking "does user actually need this?"

### Bespoke Depth

Uniform depth wastes tokens on simple topics while under-explaining complex ones.

**The pattern:** Go deep where it matters - complex, novel, critical, risky. Stay shallow where it doesn't - simple, existing, optional, safe.

"OAuth token retrieval is complex because we read from keyring, handle expiry, mock filesystem in tests. [3 paragraphs, diagram, code example]"

"API key storage is straightforward - read from config.toml. See existing implementation."

Same documentation, different depth based on what reader actually needs.

### Fighting Convergent Defaults

Agents naturally drift toward high-probability patterns from training data: mock everything, minimal implementations, generic solutions, skip tests. Even when they know better approaches.

**The pattern:** Every prompt must actively steer away from defaults. Explicit avoidances ("DO NOT mock Redis"). Concrete alternatives ("use real Redis connection"). Code scaffolds for non-standard patterns. The steering creates context that makes your preferred approach higher probability.

---

## Anti-Patterns to Watch

### Test Scaffold Corruption
Agents create Fastify test scaffolds that reset the entire app state, inject tool mocks, and change real behavior to make tests pass. **This already happened.** Any test that doesn't exercise real Redis/Convex is suspect.

### Shim Creep
Agents add adapters, translation layers, and shims to avoid integration difficulty. Question every new abstraction - is it solving a real problem or avoiding the real problem?

### Context Overload
Don't dump entire codebase into prompts. Don't let agents go exploring everything. Curate: FIRST the problem/requirements, THEN specific relevant code.

### All of Topic A, Then All of Topic B
This creates isolated understanding that doesn't integrate. Wind through topics progressively instead.

---

## Workspace Structure

```
codex-port-02/
├── CLAUDE.md           # Role/principles (lean, always loaded)
├── PLANNER-INIT.md     # This file - full context for planner sessions
├── cody-fastify/       # Active project - streaming LLM harness
│   ├── src/
│   │   ├── core/       # Canonical schemas, adapters, reducers
│   │   ├── api/        # Fastify routes and services
│   │   └── workers/    # Background processors
│   ├── docs/           # Design docs, prompts, test plans
│   └── tests/          # Playwright E2E, Vitest unit
├── codex-ts/           # DEPRECATED - utilities being migrated out
└── docs/
    └── core/           # Methodology docs (like documentation-design-brain-dump.md)
```

**Key files to know:**
- `cody-fastify/src/core/schema.ts` - The canonical shapes (read this to understand data model)
- `cody-fastify/docs/codex-core-2.0-tech-design.md` - Full architecture specification
- `cody-fastify/README.md` - File index with descriptions
- `docs/core/documentation-design-brain-dump.md` - Full methodology principles (what this section summarizes)

---

## Current Priorities

**Immediate:**
1. Stabilize testing approach - either fix service mocks or commit to E2E-only
2. Get thinking/reasoning blocks displaying in UI
3. Clean up model/provider configuration

**Near-term:**
4. Decide on React/Next.js migration for UI
5. Complete tool execution flow end-to-end
6. Documentation cleanup - remove stale docs, consolidate

**The meta-priority:** Establish sustainable process for working with AI agents. Not just fixing code, but fixing how we work so we don't keep losing agent coherence.

---

## For Reference

**Full methodology:** `docs/core/documentation-design-brain-dump.md` (~25k tokens of principles with extensive examples)

**Architecture spec:** `cody-fastify/docs/codex-core-2.0-tech-design.md`

**Process guide:** `cody-fastify/docs/cc/GUIDE-ITERATIVE-AGENTIC-CODING.md`

Don't read all of these upfront - reference when you need depth on a specific topic.

---

## After Loading This Document

**Now read these files to complete orientation:**

1. **STATE.md** - Current ground truth (what's working, what's broken)
2. **CURRENT.md** - Active slice (what we're working on NOW)
3. **NEXT.md** - Work queue (what's coming after current)
4. **PROCESS.md** - Workflow and checkpoints (how we work)

These are living documents updated each session:
- STATE.md tells you where things actually are
- CURRENT.md tells you what's in focus right now
- NEXT.md tells you what's queued up
- PROCESS.md tells you how to work, including context checkpoints at 100k and 150k
