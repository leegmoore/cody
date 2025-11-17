# Cody REST API - Technical Architecture

**Project:** Cody REST API (Phase 6)
**Purpose:** Bridge from current CLI architecture to target REST API platform
**Date:** 2025-11-16

---

## 1. Executive Summary

Phase 6 transforms Cody from a command-line interface into a platform by layering a Fastify-based REST API and Redis Streams event infrastructure on top of the existing, well-tested core library. The core library (ConversationManager, Codex, Session, provider clients) remains unchanged - we're adding an HTTP interface, not rebuilding the engine.

**Current State:** CLI commands → ConversationManager methods → Local display
**Target State:** HTTP requests → Fastify handlers → ConversationManager methods → EventMsg events → Redis Streams → SSE to clients

**Key Architectural Shift:** From stateful, terminal-bound CLI to stateless, networked REST API with durable event streaming.

---

## 2. Current Architecture (Phases 1-5)

### Component Overview

```
┌─────────────────────────────────────┐
│         CLI Layer (Current)         │
│  ┌──────────────────────────────┐   │
│  │   Command Parser             │   │
│  │   (Commander.js)             │   │
│  └──────────┬───────────────────┘   │
│             │                       │
│  ┌──────────┴───────────────────┐   │
│  │   Display Renderer           │   │
│  │   (handles EventMsg)         │   │
│  └──────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Core Library (Stable)          │
│  ┌──────────────────────────────┐   │
│  │   ConversationManager        │   │
│  │   - createConversation()     │   │
│  │   - listConversations()      │   │
│  │   - resumeConversation()     │   │
│  └───────────┬──────────────────┘   │
│              │                      │
│  ┌───────────┴──────────────────┐   │
│  │   Codex Orchestrator         │   │
│  │   - submit()  (SQ)           │   │
│  │   - nextEvent() (EQ)         │   │
│  └───────────┬──────────────────┘   │
│              │                      │
│  ┌───────────┴──────────────────┐   │
│  │   Session                    │   │
│  │   - Turn execution           │   │
│  │   - Tool routing             │   │
│  │   - History management       │   │
│  └───┬──────────────────────┬───┘   │
│      │                      │       │
│  ┌───┴─────┐         ┌──────┴────┐  │
│  │  Model  │         │   Tool    │  │
│  │ Client  │         │  Router   │  │
│  └───┬─────┘         └──────┬────┘  │
└──────┼──────────────────────┼───────┘
       │                      │
       ▼                      ▼
   LLM APIs              Filesystem/Exec
   (OpenAI,              (Tools)
   Anthropic,
   OpenRouter)
```

### Request Flow (Current)

**CLI Command Execution:**
```
1. User: cody chat "Hello"
2. CLI parses command → calls ConversationManager.submitMessage()
3. ConversationManager → Codex.submit(Op)
4. Codex → Session.processMessage()
5. Session → ModelClient.sendMessage()
6. ModelClient streams ResponseEvent → Session processes
7. Session emits EventMsg to Codex
8. Codex queues Event for CLI
9. CLI: conversation.nextEvent() (pull-based)
10. CLI renders EventMsg to terminal
```

**Key Characteristics:**
- **Stateful:** CLI tracks "active conversation" locally
- **Pull-based events:** CLI polls via nextEvent()
- **Synchronous display:** Events rendered as they're pulled
- **Local only:** No network access, single user, single process

### Data Persistence (Current)

**JSONL Rollout Format:**
- Location: `~/.cody/conversations/{conversationId}.jsonl`
- Format: One JSON line per turn
- Contains: SessionMeta (first line) + RolloutTurn (subsequent lines)
- RolloutTurn: `{ timestamp, items: ResponseItem[], metadata }`

**No Database:**
- Conversations stored as files
- Listing requires directory scan
- No indexing, no complex queries
- Simple and reliable for single user

---

## 3. Target Architecture (Phase 6)

### Component Overview

```
┌──────────────────────────────────────────────────┐
│            Client Layer (New)                    │
│  ┌─────────────┐  ┌──────────┐  ┌────────────┐  │
│  │   Browser   │  │   CLI    │  │   Mobile   │  │
│  │   (React)   │  │  (Thin)  │  │    App     │  │
│  └──────┬──────┘  └─────┬────┘  └──────┬─────┘  │
│         │                │              │        │
│         └────────────────┴──────────────┘        │
│                          │                       │
│                    HTTP / SSE                    │
└──────────────────────────┼───────────────────────┘
                           ▼
┌──────────────────────────────────────────────────┐
│         Fastify REST API Layer (New)             │
│  ┌────────────────────────────────────────────┐  │
│  │   Route Handlers                           │  │
│  │   - POST /conversations                    │  │
│  │   - POST /conversations/{id}/messages      │  │
│  │   - GET  /tasks/{taskId}/events (SSE)      │  │
│  └─────────────┬──────────────────────────────┘  │
│                │                                 │
│  ┌─────────────┴──────────────────────────────┐  │
│  │   EventMsg → Redis Bridge                  │  │
│  │   (Subscribes to ConversationManager       │  │
│  │    events, writes to Redis Streams)        │  │
│  └─────────────┬──────────────────────────────┘  │
└────────────────┼─────────────────────────────────┘
                 │                     ▲
                 ▼                     │
      ┌──────────────────┐    ┌───────┴────────┐
      │  Redis Streams   │    │  SSE Endpoint  │
      │  events:{taskId} │◄───┤  reads stream  │
      └──────────────────┘    └────────────────┘
                 │
                 │ (uses)
                 ▼
┌──────────────────────────────────────────────────┐
│      Core Library (Unchanged from Phase 5)       │
│  ┌────────────────────────────────────────────┐  │
│  │   ConversationManager                      │  │
│  │   Codex, Session, ModelClients             │  │
│  │   (Same as current - 1,950+ tests)         │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Request Flow (Target)

**REST API Message Submission:**
```
1. Client: POST /conversations/{id}/messages { message }
2. Fastify handler validates request (Zod schema)
3. Handler calls ConversationManager.submitMessage()
4. Fire async (don't wait for completion)
5. Immediately return: { taskId, eventsUrl }
6. Background: ConversationManager → Codex → Session → ModelClient
7. Session emits EventMsg events during execution
8. EventMsg → Redis Bridge listens, writes each event to Redis Stream
9. Client: GET /tasks/{taskId}/events (SSE connection)
10. SSE endpoint: XREAD from Redis Stream → send as SSE events
11. Client receives EventMsg JSON over SSE in real-time
```

**Key Changes from Current:**
- **Async task pattern:** Submit returns immediately, don't block
- **Push-based events:** Events written to Redis Streams (not pulled via nextEvent())
- **Durable streaming:** Events persist in Redis, client can reconnect
- **Stateless API:** No "active conversation" on server, client passes IDs explicitly

---

## 4. Key Architectural Changes

### Change 1: CLI Wrapper → Library Integration

**Current:**
CLI is standalone application. Commands invoke ConversationManager directly.

**Phase 2.0 (Temporary):**
Fastify shells out to CLI commands:
```typescript
app.post('/conversations', async (req, reply) => {
  const { stdout } = await exec(`cody new --provider ${provider} --model ${model}`);
  const conversationId = parseConversationId(stdout);
  return { conversationId };
});
```

**Phase 2.1 (Target):**
Fastify calls ConversationManager directly:
```typescript
app.post('/conversations', async (req, reply) => {
  const conversation = await conversationManager.createConversation({
    provider: req.body.provider,
    model: req.body.model
  });
  return { conversationId: conversation.id, ... };
});
```

**Benefits:**
- Phase 2.0 validates API design quickly (CLI already works)
- Phase 2.1 removes subprocess overhead, cleaner integration
- Tests written in 2.0 continue passing in 2.1 (same API surface)

---

### Change 2: Pull Events (nextEvent) → Push Events (Redis Streams)

**Current EventMsg Delivery:**
```typescript
// CLI (current)
while (!done) {
  const event = await conversation.nextEvent();  // Pull
  renderEvent(event.msg);
}
```

**Problem:** Pull-based doesn't work for REST API:
- Client can't "poll" without active connection
- Can't support multiple subscribers
- No durability (events lost if client disconnects)

**Target EventMsg Delivery:**
```typescript
// Fastify (new) - EventMsg Bridge
conversation.on('event', (event: Event) => {
  await redis.xadd(`events:${taskId}`, '*',
    'type', event.msg.type,
    'data', JSON.stringify(event.msg)
  );
});

// SSE Endpoint (new)
app.get('/tasks/:taskId/events', async (req, reply) => {
  reply.sse(async function* () {
    const lastId = req.headers['last-event-id'] || '0-0';

    while (true) {
      const events = await redis.xread(
        'BLOCK', 5000,
        'STREAMS', `events:${taskId}`, lastId
      );

      for (const entry of events) {
        yield {
          id: entry.id,
          event: 'cody-event',
          data: entry.data.data  // EventMsg JSON
        };
        lastId = entry.id;
      }

      // Check if task complete, break loop
    }
  });
});
```

**Implementation Requirements:**

**EventMsg → Redis Bridge (NEW):**
- Subscribe to ConversationManager/Codex event emissions
- Write each EventMsg to Redis Stream
- Track task status (running → completed/error)
- Estimated: ~150-200 lines

**SSE Stream Endpoint (NEW):**
- XREAD from Redis Stream with blocking
- Transform Redis entries → SSE format
- Support Last-Event-ID for resume
- Handle completion detection
- Estimated: ~200-250 lines

**Required Changes to Core Library:**
- Session/Codex currently emit events via internal EventEmitter
- Need to expose event subscription interface for Fastify bridge
- Likely already exists (CLI uses it) - verify and document
- Estimated: 0-50 lines (should already be accessible)

---

### Change 3: Stateful CLI → Stateless REST API

**Current CLI State Management:**
- "Active conversation" stored in `~/.cody/active-conversation.txt`
- Commands operate on active conversation by default
- `cody chat "message"` sends to active conversation

**Target REST API (Stateless):**
- No server-side state tracking "active" conversation
- Every operation requires explicit conversationId
- `POST /conversations/{id}/messages` always includes ID

**Client State Management:**
- CLI client tracks active conversation locally
- Browser client tracks selected conversation in React state
- Server doesn't care which conversation client is "working with"

**Benefits:**
- Horizontal scaling (no sticky sessions)
- Simpler server logic (no state to manage)
- Clear API contracts (always explicit IDs)

**Migration:**
- Remove ~/.cody/active-conversation.txt concept from CLI
- CLI becomes thin REST client (calls API, maintains own state)
- Estimated: ~100-150 lines to refactor CLI as REST client

---

### Change 4: Hardcoded Provider Enum

**Current Provider System:**
```typescript
// Flexible, string-based
interface ModelProviderInfo {
  name: string;
  baseUrl?: string;
  wireApi: WireApi;  // Can be Responses, Chat, or Messages
  ...
}

const providers = builtInModelProviders();  // Returns Record<string, ModelProviderInfo>
```

**Target Provider System:**
```typescript
// Fixed enum
enum Provider {
  OpenAI = "openai",        // Locked to Responses API
  Anthropic = "anthropic",  // Locked to Messages API
  OpenRouter = "openrouter" // Locked to Chat API
}

interface ProviderAdapter {
  readonly providerId: Provider;
  readonly name: string;
  readonly wireApi: WireApi;
  readonly models: ModelCatalogEntry[];
  createClient(auth: AuthConfig): ModelClient;
  getModelDefaults(modelId: string): ModelConfig;
}
```

**Changes Required:**
- Create Provider enum
- Define ProviderAdapter interface
- Implement adapters: OpenAIAdapter, AnthropicAdapter, OpenRouterAdapter
- Build model catalogs (curated list of supported models per provider)
- Replace flexible provider lookup with hardcoded registry

**Estimated:** ~600-800 lines (adapters + catalogs + discovery endpoints)

**Deferred to Phase 2.4** (not needed for initial API functionality)

---

## 5. Integration Strategy

### Layered Integration Approach

**Phase 2.0: Wrap CLI (Validation)**
```
HTTP Request → Fastify → exec('cody <command>') → Parse stdout → JSON Response
```

**Purpose:**
- Validate REST API design without rebuilding
- Enable Playwright test development against real API
- Prove async task pattern works

**Limitations:**
- Subprocess overhead (~50-100ms per request)
- No event streaming (blocking until CLI completes)
- CLI output parsing fragile

**Deliverable:** Working REST API with Playwright tests

---

**Phase 2.1: Direct Library Integration (Performance)**
```
HTTP Request → Fastify → ConversationManager methods → JSON Response
```

**Purpose:**
- Remove subprocess overhead
- Direct access to conversation state
- Faster, cleaner integration

**Changes:**
- Import ConversationManager in Fastify server
- Call methods directly instead of exec
- Transform results to API response format

**Deliverable:** Same API, better performance, tests still pass

---

**Phase 2.2: Add Event Streaming (Durability)**
```
HTTP Request → Fastify → ConversationManager (async)
                          ↓
                     EventMsg events
                          ↓
                    Redis Streams
                          ↓
              SSE Endpoint → Client
```

**Purpose:**
- Support hours-long sessions
- Enable client disconnection/reconnection
- Multi-client support

**Changes:**
- Integrate Redis client
- Build EventMsg → Redis bridge
- Implement SSE endpoint
- Add task tracking

**Deliverable:** Non-blocking API with durable streaming

---

## 6. Redis Streams Integration

### Why Redis Streams (Not Direct SSE)

**Direct SSE Problems:**
```
Client ←──SSE──← Fastify ←──EventMsg──← ConversationManager
```

- Client must stay connected for entire session (hours!)
- Single client only
- Connection drop = lost events
- No replay capability

**Redis Streams Solution:**
```
Client ←──SSE──← Fastify ←──XREAD──← Redis Stream ←──XADD──← EventMsg Bridge ←──← ConversationManager
```

**Benefits:**
- Events persisted in Redis (durable)
- Client can disconnect/reconnect (reads from last position)
- Multiple clients can subscribe to same stream
- Fastify instances stateless (any instance can serve SSE)

### Redis Data Model

**Event Streams:**
```
Key: events:{taskId}
Type: Stream
Entries: [
  { id: "1732547890123-0", type: "task_started", data: "{...}" },
  { id: "1732547890234-0", type: "agent_message", data: "{...}" },
  ...
]
```

**Task Metadata:**
```
Key: task:{taskId}
Type: String (JSON)
Value: {
  taskId: "...",
  conversationId: "...",
  status: "running|completed|error",
  startedAt: "...",
  completedAt: "...",
  eventCount: 42
}
```

**Cleanup Strategy:**
- Events retained for 24-48 hours (configurable TTL)
- Task metadata retained for 7 days
- Completed tasks eligible for cleanup after retention period

### Redis Operations

**Write Event (EventMsg → Redis):**
```typescript
await redis.xadd(
  `events:${taskId}`,
  '*',  // Auto-generate ID
  'type', eventMsg.type,
  'data', JSON.stringify(eventMsg)
);
```

**Read Events (Redis → SSE):**
```typescript
const events = await redis.xread(
  'BLOCK', 5000,              // Block for 5 seconds
  'STREAMS',
  `events:${taskId}`, lastId  // Read from lastId onwards
);
```

**Update Task Status:**
```typescript
await redis.set(
  `task:${taskId}`,
  JSON.stringify({
    status: 'completed',
    completedAt: new Date().toISOString(),
    eventCount: await redis.xlen(`events:${taskId}`)
  })
);
```

---

## 7. EventMsg Streaming Protocol

### EventMsg as Canonical Format

**Design Decision:** EventMsg (Codex internal protocol) is the single streaming format for all clients.

**Why EventMsg (Not ResponseItems):**
- Richer event types (40+ vs 6-8)
- Step-level progress (tool begin/end, not just call/output)
- Orchestration events (task_started, task_complete)
- Already provider-agnostic (all providers → ResponseItems → EventMsg)
- Proven in CLI (handles all scenarios)

**Provider Agnosticism:**
```
OpenAI Responses SSE → ResponseEvent → ResponseItems → EventMsg
Anthropic Messages SSE → ResponseEvent → ResponseItems → EventMsg
Google Gemini Stream → ResponseEvent → ResponseItems → EventMsg
```

All providers converge to identical EventMsg streams. Clients receive same event structure regardless of provider.

### Key EventMsg Types for API

**Turn Lifecycle:**
- `task_started` - Turn begins
- `task_complete` - Turn finishes successfully
- `turn_aborted` - Turn cancelled or failed

**Agent Output:**
- `agent_message` - Complete assistant message
- `agent_reasoning` - Complete thinking/reasoning block

**Tool Execution:**
- `exec_command_begin` - Tool execution starting
- `exec_command_end` - Tool execution completed
- `exec_approval_request` - Tool needs user approval (if applicable)

**Tool-Specific:**
- `mcp_tool_call_begin/end` - MCP tool execution
- `web_search_begin/end` - Web search operations

**Metadata:**
- `session_configured` - Configuration details
- `token_count` - Usage and rate limit info
- `error` - Error occurred
- `warning` - Non-fatal warning

**Streaming-Specific (Phase 6 excludes these):**
- `agent_message_delta` - Token-by-token text (not implemented in Phase 6)
- `agent_reasoning_delta` - Thinking deltas (not implemented in Phase 6)

**Phase 6 Scope:** Step-level events only. Delta events deferred to Phase 2.X.

### SSE Wire Format

**EventMsg → SSE Transformation:**
```
EventMsg: { type: "agent_message", message: "Hello world" }
    ↓
SSE:
id: 1732547890123-0
event: cody-event
data: {"type":"agent_message","message":"Hello world"}
```

**Standard SSE Structure:**
- `id`: Redis Stream entry ID (for Last-Event-ID resume)
- `event`: Always "cody-event" (clients filter on this)
- `data`: JSON-serialized EventMsg

**Keepalive:**
- Send `:ping\n\n` comment every 15 seconds during idle
- Prevents proxy/browser timeout
- Doesn't appear in event sequence

---

## 8. Data Flow Diagrams

### Message Submission Flow

```
┌────────┐
│ Client │
└───┬────┘
    │ POST /conversations/c-123/messages
    │ { message: "Hello" }
    ▼
┌────────────────┐
│    Fastify     │
│  POST Handler  │
└───┬────────────┘
    │ 1. Validate request (Zod)
    │ 2. Create taskId
    │ 3. Call ConversationManager.submitMessage(c-123, "Hello")
    │ 4. Fire async (don't await)
    │ 5. Return immediately
    ▼
┌────────────────────────────────┐
│  Response (within 100ms)       │
│  { taskId, eventsUrl }         │
└────────────────────────────────┘
    │
    │ (Meanwhile, async execution)
    ▼
┌─────────────────────┐
│ ConversationManager │
└──────┬──────────────┘
       │ submitMessage()
       ▼
┌──────────────┐
│    Codex     │
│   Session    │
└──────┬───────┘
       │ Emits EventMsg events
       ▼
┌──────────────────┐
│  EventMsg Bridge │ (listens to events)
└──────┬───────────┘
       │ Writes to Redis
       ▼
┌──────────────────────────┐
│   Redis Stream           │
│   events:{taskId}        │
│   [event1, event2, ...]  │
└──────────────────────────┘
```

---

### Event Streaming Flow

```
┌────────┐
│ Client │
└───┬────┘
    │ GET /tasks/{taskId}/events
    │ Accept: text/event-stream
    ▼
┌────────────────┐
│    Fastify     │
│  SSE Endpoint  │
└───┬────────────┘
    │ XREAD BLOCK 5000 STREAMS events:{taskId} {lastId}
    ▼
┌──────────────────────────┐
│   Redis Stream           │
│   events:{taskId}        │
└──────┬───────────────────┘
       │ Returns: [entry1, entry2, ...]
       ▼
┌────────────────┐
│  SSE Transform │
└───┬────────────┘
    │ For each entry:
    │   id: {entry.id}
    │   event: cody-event
    │   data: {entry.data.data}
    ▼
┌─────────────────────────────┐
│  SSE to Client              │
│  id: 123-0                  │
│  event: cody-event          │
│  data: {"type":"..."}       │
└─────────────────────────────┘
```

---

### Multi-Step Turn with Tools

```
User Message
    ↓
Session processes
    ↓ emits
EventMsg: { type: "task_started" }
    ↓ Redis
SSE → Client sees "task started"

Model thinks
    ↓ emits
EventMsg: { type: "agent_reasoning", text: "Need to read file" }
    ↓ Redis
SSE → Client sees reasoning

Model requests tool
    ↓ emits
EventMsg: { type: "exec_command_begin", command: ["cat", "file.txt"] }
    ↓ Redis
SSE → Client sees "tool starting"

Tool executes
    ↓ emits
EventMsg: { type: "exec_command_end", exit_code: 0, stdout: "..." }
    ↓ Redis
SSE → Client sees "tool completed"

Model responds
    ↓ emits
EventMsg: { type: "agent_message", message: "Based on the file..." }
    ↓ Redis
SSE → Client sees final response

Turn completes
    ↓ emits
EventMsg: { type: "task_complete" }
    ↓ Redis
SSE → Client sees completion, closes connection
```

**Client Experience:**
- Submits message, gets taskId immediately
- Subscribes to SSE stream
- Sees real-time progress (thinking, tool execution, response)
- Knows when turn is complete
- Can disconnect/reconnect at any point without losing events

---

## 9. Technology Stack

### Core Framework: Fastify

**Why Fastify:**
- Bun-optimized (faster than Express on Bun runtime)
- Plugin ecosystem (CORS, validation, SSE)
- TypeScript-first with strong type inference
- Proven in v/codex-port and team-bruce (both use Fastify successfully)

**Configuration:**
```typescript
const app = Fastify({
  logger: true,  // Fastify's logger for request/response logging
  bodyLimit: 1048576  // 1MB max payload
});

app.register(cors, { origin: '*' });
app.register(fastifyZod);  // Zod validation plugin
```

---

### Request Validation: Zod

**Why Zod:**
- Runtime schema validation (prevents type gaps)
- Single source of truth for request/response shapes
- Auto-generates TypeScript types from schemas
- Integration with Fastify via fastify-type-provider-zod
- Used successfully in team-bruce (proven pattern)

**The Correct Pattern (from team-bruce):**

**Step 1: Server Setup with Compilers**
```typescript
// src/api/server.ts
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler
} from "fastify-type-provider-zod";

const app = Fastify({ logger: true });

// Register routes with Zod compilers set at group level
app.register(
  (sub) => {
    // KEY: Set compilers for this route group
    sub.setValidatorCompiler(validatorCompiler);
    sub.setSerializerCompiler(serializerCompiler);

    // Register all API routes
    registerConversationRoutes(sub);
    registerMessageRoutes(sub);
    registerTaskRoutes(sub);
    registerProviderRoutes(sub);
  },
  { prefix: "/api/v1" }
);
```

**Step 2: Route Files with Type Provider**
```typescript
// src/api/routes/conversations.ts
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CreateConversationSchema, ConversationResponseSchema } from "../schemas/conversation.ts";

export function registerConversationRoutes(app: FastifyInstance): void {
  // KEY: withTypeProvider gives fully typed request/response
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/conversations",
    {
      schema: {
        body: CreateConversationSchema,     // Zod schema (not JSON schema!)
        response: {
          201: ConversationResponseSchema   // Zod schema
        }
      }
    },
    async (req, reply) => {
      // req.body is fully typed from Zod schema
      // TypeScript knows: req.body.provider is 'openai' | 'anthropic' | 'openrouter'
      // Runtime validation already happened (validatorCompiler)

      const conversation = await conversationManager.createConversation(req.body);
      reply.status(201);
      return conversation;  // serializerCompiler validates response
    }
  );
}
```

**Step 3: Zod Schemas**
```typescript
// src/api/schemas/conversation.ts
import { z } from 'zod';

export const CreateConversationSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter']),
  model: z.string().min(1),
  title: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  agentRole: z.string().optional(),
  primaryModel: z.string().optional(),
  secondaryModel: z.string().optional()
});

export const ConversationResponseSchema = z.object({
  conversationId: z.string().uuid(),
  createdAt: z.string().datetime(),
  provider: z.string(),
  model: z.string(),
  title: z.string().nullable(),
  // ... all metadata fields
});
```

**Critical Details:**
- Import `validatorCompiler` and `serializerCompiler` (not the plugin itself)
- Set compilers via `.setValidatorCompiler()` and `.setSerializerCompiler()` in route registration
- Use `.withTypeProvider<ZodTypeProvider>()` in route files for type inference
- Pass Zod schemas directly in route `schema` option (they're automatically compiled)
- No manual `zod-to-json-schema` conversion needed

**Reference Implementation:**
- Server setup: `/Users/leemoore/code/v/team-bruce/src/server.ts` (lines 1-46)
- Route pattern: `/Users/leemoore/code/v/team-bruce/src/routes/textCompressor.ts` (lines 11-40)

**All endpoints use Zod schemas.** No manual validation, no type gaps, full TypeScript inference.

---

### Error Handling: Hierarchical Error Classes

**Source:** team-bruce `/src/errors.ts` (proven in production)

**Why This Architecture:**
- Domain errors carry HTTP status codes and machine-readable codes
- Handlers throw domain errors; global handler maps to HTTP
- Consistent error response format across all endpoints
- Type-safe error handling with specific error classes

**The Pattern:**

**Step 1: Error Class Hierarchy**
```typescript
// src/api/errors/api-errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, "CONFLICT", details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}
```

**Step 2: Global Error Handler**
```typescript
// In src/api/server.ts
import { ZodError } from "zod";

app.setErrorHandler((err, req, reply) => {
  // Zod validation errors
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    reply.code(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message,
        details: { errors: err.issues }
      }
    });
    return;
  }

  // Domain errors (AppError subclasses)
  if (err instanceof AppError) {
    reply.code(err.statusCode).send({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
    return;
  }

  // Unexpected errors
  app.log.error({ err, req: req.id }, "Unexpected error");
  reply.code(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      requestId: req.id
    }
  });
});
```

**Step 3: Usage in Handlers**
```typescript
// Handlers throw domain errors
export function registerConversationRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get("/conversations/:id", async (req, reply) => {
    const conversation = await conversationManager.getConversation(req.params.id);

    if (!conversation) {
      throw new NotFoundError(`Conversation '${req.params.id}' not found`);
    }

    reply.code(200).send(conversation);
  });

  typedApp.patch("/conversations/:id", async (req, reply) => {
    // Validate conversation exists
    const existing = await conversationManager.getConversation(req.params.id);
    if (!existing) {
      throw new NotFoundError(`Conversation '${req.params.id}' not found`);
    }

    // Prevent updating immutable fields
    if ('conversationId' in req.body || 'createdAt' in req.body) {
      throw new ValidationError("Cannot update immutable fields", {
        invalidFields: ['conversationId', 'createdAt']
      });
    }

    const updated = await conversationManager.updateConversation(
      req.params.id,
      req.body
    );

    reply.code(200).send(updated);
  });
}
```

**Error Response Format (Standardized):**
```typescript
{
  error: {
    code: "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | ...,
    message: "Human-readable description",
    details?: {
      // Context-specific information
      field?: string,
      validValues?: string[],
      conflictingResource?: string
    }
  }
}
```

**Critical Details:**
- Always throw AppError subclasses in handlers (never return error objects)
- Global handler ensures consistent format
- Zod errors automatically normalized
- Include details for actionable error messages
- Log internal errors but don't expose details to clients

**Reference Implementation:**
- Error classes: team-bruce `/src/errors.ts`
- Global handler: team-bruce `/src/server.ts` lines 62-88
- Handler usage: team-bruce `/src/handlers/runHandlers.ts`

---

### Code Organization: Handler + Repo Separation

**Source:** team-bruce architecture (handlers/ + repos/ directories)

**Why This Architecture:**
- Handlers are thin HTTP adapters (transport layer)
- Repos own data access and business logic (domain layer)
- Clear testing boundaries (test repos with mock Redis, test handlers with mock repos)
- Reusable repos for different interfaces (REST, GraphQL, gRPC)

**The Pattern:**

**Repository Layer** (owns business logic):
```typescript
// src/api/repos/conversation-repo.ts
export class ConversationRepo {
  constructor(private redis: Redis = redisClient) {}

  async create(input: CreateConversationInput): Promise<Conversation> {
    // Generate IDs and timestamps (repo's job, not handler's)
    const conversationId = randomUUID();
    const now = new Date().toISOString();

    // Apply defaults and business rules
    const conversation: Conversation = {
      conversationId,
      createdAt: now,
      updatedAt: now,
      provider: input.provider,
      model: input.model,
      primaryModel: input.primaryModel ?? input.model,
      secondaryModel: input.secondaryModel ?? null,
      title: input.title ?? null,
      summary: input.summary ?? null,
      tags: input.tags ?? [],
      agentRole: input.agentRole ?? null,
      parent: null
    };

    // Persist to Redis (or filesystem for Phase 6)
    const key = `conversation:${conversationId}`;
    const created = await this.redis.setnx(key, JSON.stringify(conversation));

    if (created === 0) {
      throw new ConflictError(`Conversation ${conversationId} already exists`);
    }

    // Maintain index for listing
    await this.redis.zadd(
      "conversations:byCreated",
      Date.parse(now),
      conversationId
    );

    return conversation;
  }

  async list(query: ListQuery): Promise<ListResult> {
    // Cursor pagination with tie handling
    // ... (Pattern 1.6 from proven-patterns doc)
  }

  async get(id: string): Promise<Conversation | null> {
    const raw = await this.redis.get(`conversation:${id}`);
    return raw ? JSON.parse(raw) : null;
  }

  async update(id: string, patch: UpdateInput): Promise<Conversation | null> {
    // WATCH/MULTI for atomic updates
    // ... (Pattern 1.5 from proven-patterns doc)
  }

  async delete(id: string): Promise<void> {
    const key = `conversation:${id}`;
    const deleted = await this.redis.del(key);

    if (deleted === 0) {
      throw new NotFoundError(`Conversation '${id}' not found`);
    }

    await this.redis.zrem("conversations:byCreated", id);
  }
}
```

**Handler Layer** (thin transport):
```typescript
// src/api/handlers/conversation-handlers.ts
export function buildConversationHandlers(repo: ConversationRepo) {
  return {
    async create(
      req: FastifyRequest<{ Body: CreateConversationBody }>,
      reply: FastifyReply
    ): Promise<void> {
      const conversation = await repo.create(req.body);
      reply.code(201).send(conversation);
    },

    async list(
      req: FastifyRequest<{ Querystring: ListConversationsQuery }>,
      reply: FastifyReply
    ): Promise<void> {
      const result = await repo.list(req.query);
      reply.code(200).send(result);
    },

    async get(
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> {
      const conversation = await repo.get(req.params.id);

      if (!conversation) {
        throw new NotFoundError(`Conversation '${req.params.id}' not found`);
      }

      reply.code(200).send(conversation);
    },

    async update(
      req: FastifyRequest<{ Params: { id: string }; Body: UpdateConversationBody }>,
      reply: FastifyReply
    ): Promise<void> {
      const conversation = await repo.update(req.params.id, req.body);

      if (!conversation) {
        throw new NotFoundError(`Conversation '${req.params.id}' not found`);
      }

      reply.code(200).send(conversation);
    },

    async delete(
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> {
      await repo.delete(req.params.id);
      reply.code(204).send();
    }
  };
}
```

**Route Registration** (wires it together):
```typescript
// src/api/routes/conversations.ts
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ConversationRepo } from "../repos/conversation-repo.ts";
import { buildConversationHandlers } from "../handlers/conversation-handlers.ts";
import {
  CreateConversationSchema,
  ListConversationsQuerySchema,
  UpdateConversationSchema,
  ConversationResponseSchema
} from "../schemas/conversation.ts";

export function registerConversationRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Create dependencies
  const repo = new ConversationRepo();
  const handlers = buildConversationHandlers(repo);

  // Register routes with schemas
  typedApp.post(
    "/conversations",
    {
      schema: {
        body: CreateConversationSchema,
        response: { 201: ConversationResponseSchema }
      }
    },
    handlers.create
  );

  typedApp.get(
    "/conversations",
    {
      schema: {
        querystring: ListConversationsQuerySchema
      }
    },
    handlers.list
  );

  typedApp.get(
    "/conversations/:id",
    {
      schema: {
        response: { 200: ConversationResponseSchema }
      }
    },
    handlers.get
  );

  typedApp.patch(
    "/conversations/:id",
    {
      schema: {
        body: UpdateConversationSchema,
        response: { 200: ConversationResponseSchema }
      }
    },
    handlers.update
  );

  typedApp.delete(
    "/conversations/:id",
    handlers.delete
  );
}
```

**Design Rules:**
- **Handlers:** ONLY extract request data, call repo, set status code
- **Repos:** ALL business logic, ID generation, timestamps, Redis I/O, defaults
- **Routes:** Wire handlers and repos together, apply schemas
- **Errors:** Throw domain errors (ValidationError, NotFoundError), let global handler catch

**Benefits:**
- Clear separation of concerns
- Easy to test (mock Redis for repo tests, mock repo for handler tests)
- Reusable repos (can use with GraphQL, gRPC, etc.)
- Business logic centralized (not scattered across handlers)

**Reference Implementation:**
- Repo pattern: team-bruce `/src/repos/SessionRepo.ts` (full file)
- Handler pattern: team-bruce `/src/handlers/sessionHandlers.ts` (full file)
- Route pattern: team-bruce `/src/routes/sessions.ts` lines 46-80

---

### Event Streaming: Redis Streams + SSE

**Redis Streams:**
- Purpose: Durable event storage
- Pattern: One stream per task (`events:{taskId}`)
- Retention: 24-48 hour TTL (configurable)
- Consumer: SSE endpoint via XREAD

**Server-Sent Events (SSE):**
- Purpose: HTTP-based real-time delivery to clients
- Protocol: Standard EventSource API
- Format: `id`, `event`, `data` fields
- Client: Browser's native EventSource or polyfill

**Why Not WebSockets:**
- SSE is simpler (unidirectional, just push events)
- Works through HTTP proxies without special config
- Auto-reconnect built into EventSource API
- No bidirectional handshaking complexity

**For Phase 6 (step streaming only), SSE is sufficient.** WebSockets deferred unless bidirectional need emerges.

---

## 10. File Structure & Organization

### New Directories

```
codex-ts/
├── src/
│   ├── api/                    (NEW - REST API layer)
│   │   ├── server.ts           Main Fastify setup
│   │   ├── routes/
│   │   │   ├── conversations.ts   Conversation endpoints
│   │   │   ├── messages.ts        Message submission
│   │   │   ├── tasks.ts           Task status/events
│   │   │   └── providers.ts       Provider discovery
│   │   ├── schemas/
│   │   │   ├── conversation.ts    Zod schemas
│   │   │   ├── message.ts
│   │   │   └── task.ts
│   │   ├── bridges/
│   │   │   └── eventmsg-redis.ts  EventMsg → Redis Stream bridge
│   │   ├── streaming/
│   │   │   └── sse.ts             SSE endpoint implementation
│   │   └── errors/
│   │       └── api-errors.ts      HTTP error classes
│   │
│   ├── core/               (EXISTING - unchanged)
│   │   ├── conversation-manager.ts
│   │   ├── codex/
│   │   ├── client/
│   │   └── ...
│   │
│   └── cli/                (REFACTORED - becomes REST client)
│       └── ...
│
├── tests/
│   ├── playwright/         (NEW - API contract tests)
│   │   ├── conversations.spec.ts
│   │   ├── messages.spec.ts
│   │   ├── streaming.spec.ts
│   │   ├── providers.spec.ts
│   │   └── helpers/
│   │       └── api-client.ts
│   │
│   └── mocked-service/     (EXISTING - continue using)
│       └── ...
```

---

## 11. What Changes, What Stays

### Core Library (UNCHANGED)

**These modules remain as-is from Phase 5:**
- ✅ `src/core/conversation-manager.ts` - Conversation lifecycle
- ✅ `src/core/codex/codex.ts` - Main orchestrator
- ✅ `src/core/codex/session.ts` - Turn execution
- ✅ `src/core/client/` - ModelClient adapters (all providers)
- ✅ `src/tools/` - Tool registry and implementations
- ✅ `src/core/rollout.ts` - JSONL persistence
- ✅ `src/core/auth/` - Authentication management
- ✅ `src/protocol/` - All type definitions

**Reason:** Core library is stable, well-tested (1,950+ tests), and proven. Phase 6 wraps it, doesn't rebuild it.

**Allowed Minor Changes:**
- Expose event subscription interface if not already public
- Add conversation metadata fields to SessionMeta
- Enhance ConversationManager with update/clone methods

**Estimated Changes to Core:** <200 lines total

---

### REST API Layer (ALL NEW)

**New Components:**
- `src/api/server.ts` - Fastify setup (~200 lines)
- `src/api/routes/` - All route handlers (~400-600 lines)
- `src/api/schemas/` - Zod validation schemas (~300-400 lines)
- `src/api/bridges/eventmsg-redis.ts` - Event bridge (~150-200 lines)
- `src/api/streaming/sse.ts` - SSE endpoint (~200-250 lines)
- `src/api/errors/` - HTTP error mapping (~100-150 lines)

**Total New Code:** ~1,350-1,800 lines

---

### CLI Layer (REFACTORED)

**Current CLI:**
- Calls ConversationManager directly
- Maintains local state (active conversation)
- Renders EventMsg to terminal

**Target CLI (Phase 2.1+):**
- Becomes REST client (calls Fastify API)
- Still maintains local state (which conversation is active)
- Fetches conversation list from API instead of file scan
- Subscribes to SSE for event streaming

**Changes Required:**
- Replace ConversationManager calls with fetch() to API
- Update conversation listing to API call
- Update chat command to call POST /messages and subscribe to SSE
- Estimated: ~200-300 lines refactored

**Benefit:** CLI proves API is usable for programmatic clients.

---

### Testing (EXPANDED)

**New: Playwright API Tests**
- `tests/playwright/` - All new tests
- Coverage: All endpoints, all scenarios from test conditions doc
- 40+ test cases
- Mocked ModelClient for determinism
- Estimated: ~2,000-2,500 lines

**Existing: Service-Mocked Tests**
- `tests/mocked-service/` - Continue passing
- Verify core library unchanged
- Baseline: 1,950+ tests must stay green

---

## 12. Implementation Roadmap

### Phase 2.0: Fastify + CLI Wrapper

**Goal:** Validate REST API design with minimal implementation.

**Work:**
1. Create Fastify server setup
2. Define Zod schemas for all endpoints
3. Implement route handlers that shell out to CLI:
   - POST /conversations → exec('cody new ...')
   - GET /conversations → exec('cody list ...')
   - POST /.../messages → exec('cody chat ...')
4. Parse CLI output, return as JSON
5. Write Playwright tests for all endpoints (will pass with mocked CLI)

**Deliverable:** Working REST API (via CLI delegation) + complete test suite

**Estimated:** ~600-800 lines (server + routes + schemas + Playwright tests)

---

### Phase 2.1: Direct Library Integration

**Goal:** Remove CLI subprocess, use library directly.

**Work:**
1. Import ConversationManager in Fastify handlers
2. Replace exec() calls with direct method calls:
   - exec('cody new') → conversationManager.createConversation()
   - exec('cody list') → conversationManager.listConversations()
   - exec('cody chat') → conversation.submitMessage()
3. Transform ConversationManager results → API response format
4. Add conversation metadata fields to SessionMeta
5. Implement update and clone operations on ConversationManager

**Deliverable:** Direct library integration, same API surface, tests still pass

**Estimated:** ~400-600 lines (handler refactor + ConversationManager additions)

**Key Refactor:**
- Message submission still synchronous/blocking in 2.1
- Client waits for full turn completion (acceptable for initial version)
- Event streaming added in 2.2

---

### Phase 2.2: Redis Streams + Async Tasks

**Goal:** Non-blocking message submission with durable event streaming.

**Work:**
1. Integrate Redis client (ioredis)
2. Implement EventMsg → Redis Stream bridge:
   - Subscribe to ConversationManager/Codex events
   - Write each EventMsg to Redis Stream
   - Update task status in Redis
3. Change message submission to async pattern:
   - Generate taskId
   - Fire ConversationManager.submitMessage() in background
   - Return taskId + eventsUrl immediately
4. Implement SSE endpoint:
   - Read from Redis Stream via XREAD (blocking)
   - Transform to SSE format
   - Support Last-Event-ID resume
   - Handle stream completion
5. Implement task status endpoint
6. Update Playwright tests for async pattern

**Deliverable:** Non-blocking API with durable SSE streaming

**Estimated:** ~600-800 lines (Redis integration + streaming + async pattern)

---

### Phase 2.3: Conversation Metadata Enhancement

**Goal:** Support full metadata model designed in planning.

**Work:**
1. Add metadata fields to SessionMeta (if not done in 2.1)
2. Implement filtering in listConversations (by tags, agentRole)
3. Enhance update operation to handle all fields
4. Implement clone with metadata override support
5. Add Playwright tests for metadata operations

**Deliverable:** Full metadata support

**Estimated:** ~200-300 lines (minor enhancements + tests)

---

### Phase 2.4: Provider System Refactor

**Goal:** Clean up provider abstraction with hardcoded enum and adapters.

**Work:**
1. Define Provider enum
2. Create ProviderAdapter interface
3. Implement adapters for openai, anthropic, openrouter
4. Build model catalogs (curated lists)
5. Implement provider/model discovery endpoints
6. Refactor ConversationManager to use new provider system
7. Add Playwright tests for discovery endpoints

**Deliverable:** Clean provider abstraction with discovery

**Estimated:** ~600-800 lines (significant refactor but well-scoped)

---

## 13. Design Patterns & Guidelines

### API Design Principles

**RESTful Resources:**
- Nouns, not verbs: /conversations (not /createConversation)
- HTTP verbs semantically: POST create, GET read, PATCH update, DELETE delete
- Hierarchical: /conversations/{id}/messages (messages under conversations)

**Stateless Operations:**
- Every request includes all needed context
- No server-side session state
- Clients manage their own navigation/selection

**Async for Long Operations:**
- Operations >1 second return taskId immediately
- Client subscribes to progress via SSE
- Never block HTTP request for minutes/hours

**Structured Errors:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",  // Machine-readable
    message: "...",             // Human-readable
    details: { ... }            // Actionable specifics
  }
}
```

---

### Code Organization Patterns

**Separation of Concerns:**
- **Routes** - HTTP handling only (validation, error codes, response format)
- **Handlers** - Thin adapters (call ConversationManager, transform results)
- **Schemas** - Zod definitions (request/response validation)
- **Bridges** - Integration adapters (EventMsg → Redis)
- **Core Library** - Business logic (unchanged)

**Dependency Injection:**
```typescript
function createServer(options: {
  conversationManager: ConversationManager,
  redis: RedisClient,
  logger?: Logger
}) {
  // Server configured with injected dependencies
  // Enables testing with mocks
}
```

---

### Testing Strategy

**API Contract Tests (Playwright):**
- Test at HTTP boundary
- Mock external dependencies (ModelClient, file I/O)
- Focus on API behavior, not implementation
- Each endpoint has happy path + error cases + edge cases

**Existing Service-Mocked Tests:**
- Continue running (verify core library unchanged)
- Baseline: 1,950+ tests must stay green
- Add minimal integration tests for new ConversationManager methods

**Integration Tests (Manual):**
- Real providers (OpenAI, Anthropic, OpenRouter)
- Verify EventMsg streams work with live APIs
- Test hours-long sessions
- Run periodically, not in CI (require API keys, take time)

---

## 14. Future Phase Setup

### Foundation for Continuous Runs (Phase 2.5)

**What Phase 6 Provides:**
- ✅ Async task pattern (taskId, status tracking)
- ✅ Redis Streams infrastructure
- ✅ EventMsg streaming protocol
- ✅ Hours-long session support (client reconnection)

**What Phase 2.5 Adds:**
- Run state machine (active, paused, stopped, completed)
- Multi-turn autonomous loops (agent continues without user input)
- Run control API (pause, resume, cancel endpoints)
- Background worker pool (process runs independently)

**Migration Path:**
- Task concept extends to Run concept
- EventMsg streams work identically for runs
- Redis infrastructure reused

---

### Foundation for Multi-Agent Coordination (Phase 2.6)

**What Phase 6 Provides:**
- ✅ Per-task event streams (can subscribe to any task)
- ✅ Redis-based events (accessible across conversations)
- ✅ Stateless API (no coupling between conversations)

**What Phase 2.6 Adds:**
- Cross-run visibility (planner reads coder's events)
- Run control from other conversations (planner pauses/redirects coder)
- Shared state/coordination primitives

**Migration Path:**
- Planner conversation calls GET /tasks/{coderTaskId}/events
- Planner can POST /tasks/{coderTaskId}/control with instructions
- Redis enables cross-conversation communication

---

### Foundation for Memory Gradients (Phase 3+)

**What Phase 6 Provides:**
- ✅ Redis integration (hot storage for gradients)
- ✅ EventMsg events (hooks for offline processing)
- ✅ Conversation history in ResponseItems format (ready for compression)

**What Phase 3+ Adds:**
- Fidelity compression system (R/L/M/S/D levels from team-bruce)
- Chunk-based memory storage in Redis
- Context preprocessing agents
- Gradient calculation and injection

**Migration Path:**
- Use Redis for gradient cache (latest calculated gradient)
- EventMsg events trigger async Convex jobs (summarization, compression)
- ResponseItems → fidelity compression → Redis chunks
- Conversation retrieval injects gradient from Redis cache

---

## 15. Key Design Decisions

### Decision 1: EventMsg Over ResponseItems for Streaming

**Rationale:**
- EventMsg provides step-level granularity (tool begin/end, not just call/output)
- Already provider-agnostic (all providers converge to EventMsg)
- Richer event types for complex workflows (40+ types vs 6-8)
- Proven in CLI (handles all scenarios)

**Trade-off:**
- More complex protocol (40+ event types)
- Codex-specific (not generic LLM API)

**Accepted:** For hours-long autonomous sessions, step-level detail is essential. EventMsg provides this.

---

### Decision 2: Redis Streams Over Direct SSE

**Rationale:**
- Hours-long sessions require client reconnection
- Multiple clients may monitor same task (planner watching coder)
- Events must be durable (not lost on disconnect)
- Horizontal scaling requires external event bus

**Trade-off:**
- Redis dependency (infrastructure complexity)
- Extra hop (latency ~5-10ms)

**Accepted:** Durability and multi-client support are requirements, not nice-to-haves.

---

### Decision 3: Hardcoded Provider Enum

**Rationale:**
- Each provider requires custom adapter code anyway (Responses vs Messages vs Gemini)
- Finite set of providers (3-4 major ones)
- Simplifies implementation (no plugin system complexity)
- Agent can maintain catalogs (automated PRs for new models)

**Trade-off:**
- Users can't add custom providers without code changes
- New provider requires code change + PR

**Accepted:** For current needs (3-4 providers), hardcoded is simpler and more maintainable.

---

### Decision 4: Stateless API (No Server-Side Active State)

**Rationale:**
- Enables horizontal scaling (no sticky sessions)
- Simpler server logic (no state synchronization)
- Clear API contracts (always explicit IDs)
- Clients naturally manage their own UI state

**Trade-off:**
- Clients must track "current conversation" themselves
- All operations require conversationId parameter

**Accepted:** REST APIs should be stateless. Client state management is client's job.

---

### Decision 5: Step-Level Streaming Only (Phase 6)

**Rationale:**
- Token streaming adds significant complexity (batching, volume, Redis overhead)
- For autonomous coding runs, step-level is sufficient
- Can add token streaming later without breaking API

**Trade-off:**
- No real-time "typewriter effect" in Phase 6
- Interactive chat UX less responsive

**Accepted:** Get step streaming working first. Add token streaming in Phase 2.X if needed.

---

## 16. Error Handling Strategy

### HTTP Status Code Mapping

**2xx Success:**
- 200 OK - Successful GET/PATCH
- 201 Created - Successful POST (resource created)
- 202 Accepted - Async task created
- 204 No Content - Successful DELETE

**4xx Client Errors:**
- 400 Bad Request - Validation failure, malformed JSON
- 404 Not Found - Resource doesn't exist
- 409 Conflict - Concurrent operation conflict
- 413 Payload Too Large - Request body exceeds limit
- 415 Unsupported Media Type - Wrong Content-Type

**5xx Server Errors:**
- 500 Internal Server Error - Unexpected failure
- 503 Service Unavailable - Redis unavailable

### Error Response Format

**Standard Structure:**
```typescript
{
  error: {
    code: string,          // Machine-readable error code
    message: string,       // Human-readable message
    details?: object,      // Additional context (optional)
    requestId?: string     // For error tracking (optional)
  }
}
```

**Example Error Responses:**
```json
// Validation Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "errors": [
        { "field": "provider", "message": "Must be one of: openai, anthropic, openrouter" }
      ]
    }
  }
}

// Not Found
{
  "error": {
    "code": "CONVERSATION_NOT_FOUND",
    "message": "Conversation 'conv-xyz' not found"
  }
}

// Internal Error
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req_abc123"
  }
}
```

### Error Handling in Code

**ConversationManager Errors → HTTP Errors:**
```typescript
try {
  const conversation = await conversationManager.getConversation(id);
} catch (error) {
  if (error instanceof ConversationNotFoundError) {
    return reply.status(404).send({
      error: {
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation '${id}' not found`
      }
    });
  }
  throw error;  // Let global error handler catch
}
```

**Global Error Handler:**
```typescript
app.setErrorHandler((error, request, reply) => {
  // Log error with context
  app.log.error({ error, request: request.id }, 'Request failed');

  // Map to appropriate status code
  const status = mapErrorToStatus(error);

  // Send safe error response (no stack traces, internal details)
  reply.status(status).send({
    error: {
      code: getErrorCode(error),
      message: getSafeMessage(error),
      requestId: request.id
    }
  });
});
```

---

## 17. Performance Considerations

### Expected Request Latency

**Non-Streaming Endpoints:**
- GET /conversations: <50ms (file scan + JSON parse)
- GET /conversations/{id}: <50ms (single file read)
- POST /conversations: <100ms (create file + generate ID)
- PATCH /conversations/{id}: <50ms (read + modify + write)
- DELETE /conversations/{id}: <20ms (file delete)

**Async Task Submission:**
- POST /.../messages: <100ms (validate + generate taskId + fire async)

**SSE Streaming:**
- Event delivery latency: <500ms from emission to client receipt
- Includes: EventMsg emission + Redis write + Redis read + SSE send

**Redis Operations:**
- XADD (write event): ~1-2ms
- XREAD (blocking read): 5s block timeout, returns immediately when events available
- SET/GET (task metadata): <1ms

### Scalability Characteristics

**Single Instance Capacity:**
- Concurrent conversations: 100+ (limited by ConversationManager memory)
- Concurrent SSE connections: 1,000+ (limited by file descriptors)
- Redis event throughput: 10,000+ events/sec (Redis Streams are fast)

**Bottlenecks:**
- LLM API rate limits (provider-dependent)
- File I/O for conversation persistence (JSONL writes)
- Memory for conversation history (large conversations = large memory)

**Not Optimized For:**
- High-frequency requests (1000s of req/sec)
- Large-scale multi-tenancy (no user isolation)
- Geo-distributed deployment (single Redis instance)

**Target Workload:**
- 1-10 concurrent users
- 1-100 concurrent conversations
- Hours-long sessions (proven requirement)
- Development/team tool (not public SaaS)

---

## 18. Deployment Architecture

### Development Setup

```
┌──────────────┐
│   Developer  │
│   (Browser)  │
└──────┬───────┘
       │ HTTP
       ▼
┌──────────────────┐
│  Fastify (Bun)   │
│  localhost:4010  │
└─────┬────────────┘
      │
      ▼
┌──────────────────┐
│  Redis (local)   │
│  localhost:6379  │
└──────────────────┘
```

**Run Commands:**
```bash
# Start Redis
redis-server

# Start Fastify
bun run api:dev

# Run tests
bun run test:api
```

---

### Production Deployment (Future)

```
┌─────────────┐
│   Clients   │
└──────┬──────┘
       │ HTTPS
       ▼
┌──────────────┐
│  Load Bal.   │  (optional, for multiple instances)
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Fastify (Bun)   │  (1-N instances)
│  Port 4010       │
└─────┬────────────┘
      │
      ▼
┌──────────────────┐
│  Redis Cluster   │  (for HA)
└──────────────────┘
```

**Phase 6 Targets:** Single instance only. Multi-instance support deferred.

---

## 19. Migration Path

### From Current CLI to REST API

**Week 1: Phase 2.0 (Wrap CLI)**
- Fastify + Playwright tests ready
- API usable via CLI delegation
- Test suite defines contracts

**Week 2: Phase 2.1 (Library Integration)**
- Remove CLI subprocess
- Direct ConversationManager calls
- Same API, better performance

**Week 3: Phase 2.2 (Add Streaming)**
- Redis Streams integrated
- Async task pattern working
- SSE streaming functional

**Week 4: Phase 2.3-2.4 (Enhancements)**
- Metadata complete
- Provider refactor done
- API production-ready

**Result:** REST API platform ready for web UI, mobile clients, and future phases (continuous runs, multi-agent, memory gradients).

---

## 20. Summary

Phase 6 establishes the REST API foundation by wrapping the proven core library with Fastify HTTP handling, Redis Streams for durable event delivery, and Server-Sent Events for client streaming. The incremental approach (wrap CLI → library integration → add streaming) manages risk while enabling fast validation via comprehensive Playwright tests.

**Architectural Principles:**
- Preserve stable core library (1,950+ tests, zero changes unless required)
- Stateless REST API (horizontal scaling, clear contracts)
- EventMsg as canonical streaming format (provider-agnostic, step-level detail)
- Redis Streams for durability (hours-long sessions, client reconnection)
- Incremental delivery (each sub-phase independently useful)

**Foundation for Future:**
- Continuous runs (async task infrastructure ready)
- Multi-agent coordination (Redis enables cross-conversation communication)
- Memory gradients (Redis storage, EventMsg hooks for processing)
- Web/mobile clients (clean REST API, real-time streaming)

**Success Metric:** Can build a web application using only the REST API that provides the same capabilities as the current CLI, with support for hours-long agent sessions and multiple concurrent users monitoring the same work.
