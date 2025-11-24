# GEMINI.md

You are a coding agent working on **Cody Core 2.0**, a streaming-native architecture for agentic coding assistance. Your role is to execute focused development tasks with minimal changes, following established patterns, and maintaining high code quality standards. You work incrementally, verify after each change, and report honestly about what you've done.

---

## Project Overview

**Cody Core 2.0** is a streaming-first agent runtime that processes LLM turns through a Redis Streams event pipeline with Convex persistence. The architecture treats all outputs—thinking blocks, tool calls, messages—as typed events flowing through a unified stream, enabling real-time client updates and complete observability. The system supports multiple LLM providers (OpenAI, Anthropic, OpenRouter) through normalized adapters, executes tools via background workers, and maintains conversation state in Convex for durability and resume capability.

**Key Characteristics:**
- Streaming-native (events flow in real-time through Redis)
- Provider-agnostic (unified StreamEvent format)
- Observable (no black box state machines)
- Composable (workers process events independently)
- Production-ready (comprehensive test coverage)

---

## Project Layout

```
┌─────────────────────────────────────────────────────────┐
│                    User/Client                          │
│                 (Browser/CLI/API)                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Fastify API Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Threads    │  │    Submit    │  │  SSE Stream  │  │
│  │   (CRUD)     │  │   (Turns)    │  │  (Events)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Provider Adapters                          │
│         (OpenAI / Anthropic / OpenRouter)               │
│              Normalize → StreamEvents                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 Redis Streams                           │
│            codex:run:{runId}:events                     │
│          (Central Event Pipeline)                       │
└────┬────────────────┬────────────────┬─────────────────┘
     │                │                │
     ▼                ▼                ▼
┌──────────┐  ┌──────────────┐  ┌──────────────┐
│Persistence│  │  SSE Stream  │  │ Tool Worker  │
│  Worker   │  │   Endpoint   │  │ (Execution)  │
└─────┬─────┘  └──────┬───────┘  └──────┬───────┘
      │                │                 │
      ▼                ▼                 ▼
  ┌────────┐      ┌────────┐      ┌─────────┐
  │ Convex │      │ Client │      │  Redis  │
  │(Storage)      │(Hydrate)      │(Output) │
  └────────┘      └────────┘      └─────────┘
```

### Directory Structure

```
cody-fastify/
├── src/
│   ├── core/                  # Core 2.0 implementation
│   │   ├── schema.ts          # Zod schemas (StreamEvent, Response, OutputItem)
│   │   ├── reducer.ts         # Event → Response aggregation
│   │   ├── redis.ts           # Redis Streams wrapper
│   │   ├── model-factory.ts   # Adapter creation (test/prod)
│   │   ├── adapters/          # Provider normalization
│   │   │   ├── openai-adapter.ts
│   │   │   └── anthropic-adapter.ts
│   │   └── tools/             # Tool schema formatting
│   ├── api/
│   │   ├── routes/            # Fastify HTTP endpoints
│   │   │   ├── threads.ts     # Thread CRUD
│   │   │   ├── submit.ts      # Initiate turns
│   │   │   └── stream.ts      # SSE streaming
│   │   ├── services/          # Business logic layer
│   │   └── schemas/           # Request/response validation (Zod)
│   ├── workers/
│   │   ├── persistence-worker.ts  # Redis → Convex pipeline
│   │   └── tool-worker.ts         # Tool execution pipeline
│   └── client/
│       └── hydration.ts       # Client-side SSE consumption
├── tests/
│   ├── harness/               # Test infrastructure
│   ├── mocks/                 # Mock adapters
│   └── fixtures/              # LLM response fixtures (JSON)
├── public/                    # Web UI assets
├── convex/                    # Convex backend (schema, mutations, queries)
├── scripts/                   # Utility scripts (verify_pipeline, bundle, etc.)
└── docs/                      # Architecture, prompts, guides
```

---

## Default Testing Models

**Use these models in tests and documentation:**

```
gpt-5-mini (OpenAI - fast, cheap)
claude-haiku-4.5 (Anthropic - fast, cheap)
google/gemini-2.5-flash (OpenRouter - fast, cheap)
```

**Do not reference any other model names without explicit instruction or permission.**

Examples of forbidden models: gpt-4, gpt-4o, claude-3-opus, gemini-1.5-pro
If unsure about a model name, ASK before using it.

---

## Core Components

### Data Flow

```
LLM API Response
      ↓
Provider Adapter
      ↓ (normalize)
StreamEvent {
  type: "item_delta"
  payload: { delta_content: "..." }
}
      ↓
Redis Stream (XADD)
      ↓
┌─────┴─────┐
│           │
▼           ▼
Worker      SSE Endpoint
│           │
▼           ▼
Reducer     Reducer
│           │
▼           ▼
Convex      Client
(persist)   (display)
```

### Key Data Types

```typescript
// StreamEvent - Wire protocol
type StreamEvent = {
  event_id: string;
  timestamp: number;
  run_id: string;
  type: 'response_start' | 'item_start' | 'item_delta' | 'item_done' | 'response_done' | ...;
  payload: { /* type-specific data */ };
  trace_context: { traceparent: string };
}

// Response - Domain object (Convex storage, client state)
type Response = {
  id: string;           // Same as run_id
  turn_id: string;
  thread_id: string;
  status: 'queued' | 'in_progress' | 'complete' | 'error';
  output_items: OutputItem[];
  usage?: { prompt_tokens, completion_tokens, total_tokens };
  error?: { code, message };
}

// OutputItem - Typed content blocks
type OutputItem =
  | { type: 'message', content: string }
  | { type: 'reasoning', content: string }
  | { type: 'function_call', name: string, arguments: string }
  | { type: 'function_call_output', call_id: string, output: string, success: boolean }
  | { type: 'error', code: string, message: string }
```

### Workers

```
┌─────────────────────────────────────┐
│      PersistenceWorker              │
│  ┌───────────────────────────────┐  │
│  │ 1. XREADGROUP (consume)       │  │
│  │ 2. ResponseReducer.apply()    │  │
│  │ 3. Convex.mutation(persist)   │  │
│  │ 4. XACK (acknowledge)         │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│        ToolWorker                   │
│  ┌───────────────────────────────┐  │
│  │ 1. Watch for function_call    │  │
│  │ 2. Execute real tool handler  │  │
│  │ 3. Emit function_call_output  │  │
│  │ 4. Continue pipeline          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## Development Commands

### Setup
```bash
cd cody-fastify
bun install
```

### Development
```bash
bun run dev          # Start Fastify server (port 4010)
bun run build        # TypeScript compilation
bun run format       # Prettier auto-fix
bun run lint         # ESLint check
```

### Verification
```bash
npx tsc --noEmit     # Type checking
bun run format       # Formatting
bun run lint         # Linting
```

### Common Utilities
```bash
# Check Redis connection
redis-cli ping

# Check Redis streams
redis-cli KEYS "codex:run:*"

# Monitor Redis activity
redis-cli MONITOR

# Check environment
cat .env.local
```

---

## TypeScript Standards

**Strict Mode:**
- No `any` - use `unknown` or proper types
- No implicit returns - explicit return statements
- Discriminated unions for variant types
- Handle undefined/null explicitly

**Code Style:**
- Prettier formatting (non-negotiable)
- camelCase for functions/variables
- PascalCase for classes/types/interfaces
- ES modules only (import/export, not require)
- Prefer async/await over .then()

**Verification:**
```bash
npx tsc --noEmit    # Must show 0 errors
bun run lint        # Must show 0 errors (warnings OK)
bun run format      # Auto-fixes formatting
```

---

## Quality Gates

**Before declaring work complete:**

### Standard Verification
```bash
bun run format
bun run lint
npx tsc --noEmit
```

All must succeed (exit code 0).

### Code Staging
```bash
git add -A
git status --short
```

Stage changes but **do NOT commit**. User reviews before committing.

---

## Definition of Done

**Work is complete when:**

1. ✅ **Quality gates pass** (format, lint, typecheck)
2. ✅ **Target deliverable achieved** (specified in prompt)
3. ✅ **Changes staged** (git add -A, but not committed)
4. ✅ **Documentation updated** (TEST_RESULTS.md or relevant docs)
5. ✅ **Report submitted** (structured format from prompt)

**Report must include:**
- Summary of changes (what was fixed)
- Files modified (with line counts)
- Verification results (quality gates status)
- Issues discovered (if any)
- Ready for next work? (YES/NO with reasoning)

---

## Execution Principles

### Minimal Changes
- Fix only what's broken for the current task
- Don't refactor working code
- Don't add "nice to have" features
- Keep changes focused and small

### Incremental Verification
- Test after each change
- Don't batch multiple fixes
- Catch issues early
- Build confidence step by step

### Follow Existing Patterns
- Check how similar code works elsewhere
- Use established conventions
- Don't introduce new approaches without reason
- Maintain consistency with codebase

### Honest Reporting
- Report what you actually did
- Disclose any compromises or workarounds
- Highlight issues or concerns
- Ask when uncertain

---

## Common Patterns

### Environment Loading
```typescript
import { config } from 'dotenv';
config({ path: '.env.local' });
```

### Redis Operations
```typescript
const redis = await RedisStream.connect();
await redis.publish(streamKey, event);
const messages = await redis.readGroup(streamKey, group);
await redis.close();
```

### Convex Queries
```typescript
const convex = new ConvexHttpClient(process.env.CONVEX_URL);
const result = await convex.query(api.messages.getByRunId, { runId });
```

### Zod Validation
```typescript
import { z } from 'zod';

const Schema = z.object({
  field: z.string(),
  optional: z.number().optional(),
});

const validated = Schema.parse(data); // Throws if invalid
```

---

## What NOT To Do

**❌ Don't hallucinate model names**
- Use only approved models from "Default Testing Models"
- Don't reference gpt-4, claude-3, gemini-1.5, etc.

**❌ Don't refactor working code**
- Fix what's broken, don't "improve" what works
- Avoid "while we're here" refactors

**❌ Don't skip verification**
- Always run quality gates before reporting complete
- Test your changes before staging

**❌ Don't commit**
- Stage with `git add -A`
- Do NOT run `git commit`
- User reviews and commits

---

## Resources

**Architecture:**
- `docs/codex-core-2.0-tech-design.md` - Core 2.0 streaming design
- `docs/codex-core-as-is.md` - Legacy architecture (being replaced)

**Methodology:**
- `docs/cc/GUIDE-ITERATIVE-AGENTIC-CODING.md` - Development approach
- `docs/cc/PROMPT-STRUCTURE-PRINCIPLES.md` - Prompt patterns

**Current Work:**
Check `docs/cc/` for phase-specific prompts and recovery strategies.

---

## Final Reminders

1. **Keep it simple** - Minimal changes only
2. **Verify incrementally** - Test after each fix
3. **Follow patterns** - Use existing conventions
4. **Report honestly** - Transparency over completion
5. **Stage, don't commit** - User reviews first
6. **Ask when uncertain** - Don't assume or guess

Good luck! 🚀
