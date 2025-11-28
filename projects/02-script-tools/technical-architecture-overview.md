# Technical Architecture Overview: Script-Based Tool Execution

**Purpose:** Brain dump of current architecture, how script execution fits, integration points, refactor work, persistence/hydration considerations, and testing strategy.

---

## Current Architecture Summary

### System Topology

```
Client → Fastify API → LLM Provider (OpenAI/Anthropic)
                ↓
           Redis Streams (event transport)
                ↓
        ┌───────┴───────┐
        ↓               ↓
  Persistence       Streaming
    Worker          Endpoint
        ↓               ↓
      Convex        Client (SSE)
```

### Key Components

**Adapters** (`src/core/adapters/`)
- `openai-adapter.ts` - Handles OpenAI Responses API
- `anthropic-adapter.ts` - Handles Anthropic Messages API
- Both normalize provider streams into canonical events
- Both execute tools inline (no external worker dependency)

**Schema** (`src/core/schema.ts`)
- Canonical Zod schemas for all types
- `StreamEvent` envelope with payload discriminated union
- `OutputItem` types: message, reasoning, function_call, function_call_output, error

**Reducer** (`src/core/reducer.ts`)
- `ResponseReducer` class transforms stream events into Response objects
- Same code for live streaming and history replay
- Handles event ordering, deduplication, buffer management

**Workers** (`src/workers/`)
- `persistence-worker.ts` - Reads events, hydrates via reducer, writes to Convex
- `tool-worker.ts` - Exists but currently redundant (adapters execute inline)

**Routes** (`src/api/routes/`)
- `submit.ts` - Accept prompts, create runs, start adapter streaming
- `stream.ts` - SSE endpoint for clients
- `threads.ts` - Thread/run queries

### Event Flow (Current)

```
1. POST /api/v2/submit
   - Create runId, turnId, threadId
   - Instantiate adapter
   - Start background streaming task

2. Adapter streams from provider
   - Parse SSE events
   - Detect tool calls (function_call)
   - Execute tools inline
   - Publish all events to Redis

3. Persistence worker
   - Reads from Redis via consumer group
   - Uses ResponseReducer to hydrate
   - Writes Response to Convex

4. Client streams from GET /api/v2/stream/:runId
   - Reads from Redis
   - Forwards events as SSE
```

---

## How Script Execution Fits In

### New Event Flow

```
1. POST /api/v2/submit (unchanged)

2. Adapter streams from provider
   - Parse SSE events
   - **NEW:** Detect <script> blocks in content
   - **NEW:** Accumulate script text
   - **NEW:** Execute via QuickJS sandbox
   - Publish script_execution and script_execution_output events
   - Continue iteration with result in conversation

3. Persistence worker (minor changes)
   - Handles new event types
   - Hydrates script items into Response

4. Client stream (unchanged - just forwards events)
```

### New Components

```
src/core/script/
├── detector.ts         # Detect <script> tags in content
├── executor.ts         # Interface + orchestration
├── parser.ts           # Validate script syntax
├── hardening.ts        # Security (freeze prototypes, etc.)
├── errors.ts           # Structured error types
├── runtime/
│   ├── quickjs-runtime.ts    # WASM sandbox wrapper
│   ├── worker-pool.ts        # Thread pool for non-blocking
│   ├── promise-tracker.ts    # Async lifecycle management
│   └── console-proxy.ts      # Capture console output
└── tools/
    ├── shell.ts
    ├── readFile.ts
    ├── writeFile.ts
    ├── applyPatch.ts
    └── index.ts              # Tool registry for sandbox
```

### New Agent Config Components

```
src/core/agents/
├── agent-config.ts     # Types and schema
├── agent-registry.ts   # Lookup by slug
└── configs/
    ├── gpt-5.1-codex.ts
    ├── claude-sonnet.ts
    └── claude-haiku.ts
```

---

## Integration Points

### 1. Adapter Integration

**Where:** `openai-adapter.ts` and `anthropic-adapter.ts`

**Current tool detection (OpenAI):**
```typescript
// Detects function_call via response.output_tool_calls events
case "response.output_item.done":
  if (item.type === "function_call") {
    // Execute tool inline
  }
```

**New script detection (to add):**
```typescript
// During content_block_delta processing
case "content_block_delta":
  const text = delta.text;
  scriptDetector.feed(text);  // Accumulate
  if (scriptDetector.hasComplete()) {
    const script = scriptDetector.extract();
    // Emit script_execution event
    // Execute via sandbox
    // Emit script_execution_output event
    // Inject result into conversation
  }
```

**Key insight:** Script detection happens in the same place content streaming happens. It's a state machine that tracks whether we're inside `<script>...</script>`.

### 2. Schema Integration

**Where:** `src/core/schema.ts`

**New OutputItem types:**
```typescript
// Already partially defined, need to verify/extend
type OutputItem =
  | { type: "message"; ... }
  | { type: "reasoning"; ... }
  | { type: "function_call"; ... }
  | { type: "function_call_output"; ... }
  | { type: "script_execution"; code: string; ... }
  | { type: "script_execution_output"; result: any; logs: string[]; operations: Operation[]; ... }
  | { type: "error"; ... }
```

**New StreamEvent payloads:**
```typescript
// item_start for script_execution
{ type: "item_start", item_id: string, item_type: "script_execution" }

// item_done for script_execution
{ type: "item_done", item_id: string, final_item: { type: "script_execution", code: string } }

// item_start for script_execution_output
{ type: "item_start", item_id: string, item_type: "script_execution_output" }

// item_done for script_execution_output
{ type: "item_done", item_id: string, final_item: {
  type: "script_execution_output",
  call_id: string,  // Links to script_execution
  result: any,
  logs: string[],
  operations: Operation[]
}}
```

### 3. Reducer Integration

**Where:** `src/core/reducer.ts`

**Changes needed:**
- Handle `script_execution` items in `apply()` method
- Handle `script_execution_output` items
- Link output to execution via call_id

**Should be straightforward** - same pattern as function_call/function_call_output.

### 4. Persistence Integration

**Where:** `src/workers/persistence-worker.ts`, Convex schema

**Changes needed:**
- Convex schema needs to store script items
- OutputItem union in Convex needs new variants
- Persistence worker should "just work" if reducer handles new types

### 5. Submit Route Integration

**Where:** `src/api/routes/submit.ts`

**Changes needed:**
- Accept `agentId` parameter
- Look up agent config from registry
- Use agent's provider/model
- Pass agent's tool list to adapter

---

## Refactor Work Identified

### Refactor 1: Extract Script Detector (New Code)

**What:** Create reusable script detection state machine.

**Why:** Both adapters need it. Don't duplicate.

**Implementation:**
```typescript
class ScriptDetector {
  private state: "idle" | "accumulating" = "idle";
  private buffer: string[] = [];

  feed(text: string): void {
    // Track <script> opening
    // Accumulate content
    // Track </script> closing
  }

  hasComplete(): boolean { ... }
  extract(): string { ... }
  reset(): void { ... }
}
```

### Refactor 2: Generalize Tool Execution in Adapters

**What:** Current adapters have inline tool execution code. Extract to shared utility.

**Why:** Script execution will follow same pattern. Avoid duplication.

**Current (OpenAI adapter):**
```typescript
// Lines 304-326 - buildToolContinuationItems
// Lines 328-360 - executeToolForContinuation
// Lines 362-402 - publishFunctionCallOutput
```

**Proposed:**
```typescript
// src/core/execution/tool-executor.ts
class ToolExecutor {
  async executeToolCall(call: ToolCall, context: ExecutionContext): Promise<ToolOutput>
  async publishToolOutput(output: ToolOutput, trace: TraceContext): Promise<void>
}

// src/core/execution/script-executor.ts
class ScriptExecutor {
  async executeScript(code: string, context: ExecutionContext): Promise<ScriptOutput>
  async publishScriptOutput(output: ScriptOutput, trace: TraceContext): Promise<void>
}
```

### Refactor 3: Agent Config Layer

**What:** New layer for agent configuration that sits between routes and adapters.

**Why:** Routes shouldn't know about model details. Adapters shouldn't know about agent registry.

**Current flow:**
```
Route → directly creates adapter with model/provider
```

**New flow:**
```
Route → AgentResolver → AgentConfig → AdapterFactory → Adapter
```

### Refactor 4: Consolidate Event Publishing

**What:** Both adapters have similar event publishing code. Extract to shared utility.

**Why:** Reduce duplication, ensure consistency.

**Current:** Each adapter has `makeEvent()`, `publishItemStart()`, `publishItemDone()`, etc.

**Proposed:**
```typescript
// src/core/events/event-publisher.ts
class EventPublisher {
  constructor(private redis: RedisStream, private runId: string, private trace: TraceContext) {}

  async publishItemStart(itemId: string, itemType: string): Promise<void>
  async publishItemDelta(itemId: string, content: string): Promise<void>
  async publishItemDone(itemId: string, finalItem: OutputItem): Promise<void>
  async publishResponseDone(response: Response): Promise<void>
}
```

---

## Persistence Considerations

### Convex Schema Updates

**Current OutputItem types in Convex:**
- message
- reasoning
- function_call
- function_call_output
- error

**New types needed:**
- script_execution
- script_execution_output

**Schema shape:**
```typescript
// In Convex schema
outputItems: v.array(v.union(
  v.object({ type: v.literal("message"), ... }),
  v.object({ type: v.literal("reasoning"), ... }),
  v.object({ type: v.literal("function_call"), ... }),
  v.object({ type: v.literal("function_call_output"), ... }),
  v.object({ type: v.literal("script_execution"), code: v.string() }),
  v.object({
    type: v.literal("script_execution_output"),
    call_id: v.string(),
    result: v.any(),
    logs: v.array(v.string()),
    operations: v.array(v.object({
      fn: v.string(),
      args: v.array(v.any()),
      result: v.any(),
      durationMs: v.number()
    }))
  }),
  v.object({ type: v.literal("error"), ... }),
))
```

### Hydration Considerations

**ResponseReducer changes:**
- New case in item type switch
- Accumulate script content on deltas (if we stream script text)
- Finalize on item_done

**Thread query changes:**
- May want to summarize operations in UI
- May want to filter large results

---

## Hydration Flow

### Current (function_call)

```
item_start (function_call)
  → Reducer creates placeholder in output_items

item_delta (partial arguments)
  → Reducer accumulates arguments (if streaming)

item_done (function_call with final_item)
  → Reducer finalizes item with all fields

item_start (function_call_output)
  → Reducer creates placeholder

item_done (function_call_output with final_item)
  → Reducer finalizes, links to call via call_id
```

### New (script_execution)

```
item_start (script_execution)
  → Reducer creates placeholder

item_delta (partial script) [optional]
  → Reducer accumulates script text (if we stream it)

item_done (script_execution with code)
  → Reducer finalizes with complete code

item_start (script_execution_output)
  → Reducer creates placeholder

item_done (script_execution_output with result, logs, operations)
  → Reducer finalizes, links to script via call_id
```

**Key decision:** Do we stream script text character-by-character, or wait for complete script?

**Recommendation:** Wait for complete script. Unlike message text, partial scripts aren't useful to display. Emit single item_done when script complete.

---

## Testing Strategy

### Two-Tier Approach

**Tier 1: Service Mock Tests**
- Fast, deterministic, comprehensive
- Mock external dependencies
- Test all code paths
- Run on every change

**Tier 2: tdd-api Integration Tests**
- Real infrastructure
- Smoke tests for critical paths
- Run before deploy

### Service Mock Test Coverage

**Agent Config:**
```
agents/
├── agent-registry.test.ts      # Registry CRUD
└── agent-config.test.ts        # Config validation
```

**Script Detection:**
```
script/
├── detector.test.ts            # Tag detection, accumulation
├── detector-edge-cases.test.ts # Malformed, nested, escaped
```

**Script Execution:**
```
script/
├── executor.test.ts            # Orchestration
├── parser.test.ts              # Syntax validation
├── hardening.test.ts           # Security measures
├── quickjs/
│   ├── runtime.test.ts         # WASM sandbox
│   ├── worker-pool.test.ts     # Thread management
│   └── promise-tracker.test.ts # Async lifecycle
└── tools/
    ├── shell.test.ts
    ├── readFile.test.ts
    └── ...
```

**Adapter Integration:**
```
adapters/
├── openai-script-detection.test.ts
├── anthropic-script-detection.test.ts
└── script-continuation.test.ts   # Multi-turn
```

### Mock Boundaries

**What we mock:**

| Dependency | Mock Implementation |
|------------|---------------------|
| Redis | In-memory Map with stream semantics |
| Convex | In-memory storage |
| LLM APIs | Configurable response sequences |
| File system | Virtual FS (for some tests) |
| Child processes | Mock exec (for tool tests) |

**What we DON'T mock:**

| Component | Why Real |
|-----------|----------|
| Adapters | Core logic under test |
| Schema validation | Must verify actual constraints |
| Reducer | Must verify actual hydration |
| Script detector | Must verify actual parsing |
| Script executor | Must verify actual sandbox behavior |
| Tools (mostly) | Must verify actual execution |

### Test Patterns

**Pattern 1: Mock LLM Response**
```typescript
const mockLLM = createLLMMock([
  { content: "I'll run a command.\n<script>\nawait shell('pwd');\n</script>" }
]);

const adapter = new OpenAIAdapter({
  redis: mockRedis,
  llmClient: mockLLM  // Injected
});

await adapter.stream({ prompt: "test" });

expect(mockRedis.events).toContainEqual(
  expect.objectContaining({
    payload: { type: "item_done", final_item: { type: "script_execution" } }
  })
);
```

**Pattern 2: Verify Event Sequence**
```typescript
const events = mockRedis.getEvents(runId);

expect(events.map(e => e.payload.type)).toEqual([
  "response_start",
  "item_start",      // message
  "item_delta",      // "I'll run..."
  "item_done",       // message complete
  "item_start",      // script_execution
  "item_done",       // script complete
  "item_start",      // script_execution_output
  "item_done",       // output complete
  "response_done"
]);
```

**Pattern 3: Verify Script Output Structure**
```typescript
const outputEvent = events.find(e =>
  e.payload.type === "item_done" &&
  e.payload.final_item.type === "script_execution_output"
);

expect(outputEvent.payload.final_item).toMatchObject({
  type: "script_execution_output",
  result: expect.any(String),
  logs: expect.any(Array),
  operations: expect.arrayContaining([
    expect.objectContaining({ fn: "shell", args: ["pwd"] })
  ])
});
```

---

## Open Questions

### Q1: Script Tag Format

**Options:**
- `<script>...</script>` - Generic, familiar
- `<tool-calls>...</tool-calls>` - Matches product vision doc
- `<code>...</code>` - Conflicts with markdown

**Recommendation:** Use `<script>` - it's what we discussed and is intuitive.

### Q2: Stream Script Text or Not?

**Options:**
- Stream character-by-character (like message text)
- Wait for complete script, emit single event

**Recommendation:** Wait for complete. Partial scripts aren't useful to display, and it simplifies the reducer.

### Q3: Tool Worker Fate

**Options:**
- Keep tool-worker running (redundant but harmless)
- Remove tool-worker (cleanup)
- Repurpose for script execution (add complexity)

**Recommendation:** Keep for now, remove later if confirmed unused.

### Q4: Agent Config File Format

**Options:**
- TypeScript files (type-safe, can have logic)
- JSON/YAML files (data-only, easier to generate)
- Zod schemas (validation built-in)

**Recommendation:** TypeScript files with Zod schemas. Best of both worlds.

---

## Summary of Work

### New Files to Create

```
src/core/script/
├── detector.ts
├── executor.ts
├── parser.ts
├── hardening.ts
├── errors.ts
├── runtime/
│   ├── quickjs-runtime.ts
│   ├── worker-pool.ts
│   ├── promise-tracker.ts
│   └── console-proxy.ts
└── tools/
    ├── shell.ts
    ├── readFile.ts
    ├── writeFile.ts
    ├── applyPatch.ts
    └── index.ts

src/core/agents/
├── agent-config.ts
├── agent-registry.ts
└── configs/
    ├── gpt-5.1-codex.ts
    ├── claude-sonnet.ts
    └── claude-haiku.ts

test-suites/service-mocks/
├── setup.ts
├── mocks/
│   ├── redis-mock.ts
│   ├── convex-mock.ts
│   └── llm-mock.ts
├── agents/
├── api/
└── script/
```

### Files to Modify

```
src/core/schema.ts              # New OutputItem types
src/core/reducer.ts             # Handle new item types
src/core/adapters/openai-adapter.ts     # Script detection
src/core/adapters/anthropic-adapter.ts  # Script detection
src/api/routes/submit.ts        # AgentId support
convex/schema.ts                # New item types
```

### Files to Migrate

```
codex-ts/src/script-harness/ → cody-fastify/src/core/script/
  - runtime/*
  - parser.ts
  - hardening.ts
  - errors.ts
  - context.ts
  - (tests come too)
```

---

## Next Steps

1. **Set up service-mocks test infrastructure** - Mock factories, test utilities
2. **Phase 1 implementation** - Agent config foundation
3. **Phase 2 implementation** - Script plumbing with fake executor
4. **Migrate QuickJS code** - Bring over from codex-ts
5. **Phase 3+ implementation** - Tools and polish
