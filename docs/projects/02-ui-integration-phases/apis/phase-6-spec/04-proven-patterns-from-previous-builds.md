# Proven Patterns from Previous Builds

**Sources:** team-bruce + v/codex-port deep analysis
**Purpose:** Critical patterns, solutions, and hard-won insights for Phase 6 REST API implementation
**Date:** 2025-11-16

---

## Overview

This document synthesizes proven patterns from two previous production codebases (team-bruce and v/codex-port) that directly inform Phase 6 REST API implementation. Organized by priority: what to use immediately, what to consider soon, and what to learn from for future phases.

---

## PART 1: USE IMMEDIATELY (Phase 2.0-2.2 Critical)

### 1.1 Fastify + Zod Integration (The Correct Way)

**Source:** team-bruce `/src/server.ts` + `/src/routes/textCompressor.ts`

**The Pattern:**

```typescript
// Step 1: Server setup with compilers
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler
} from "fastify-type-provider-zod";

const app = Fastify({ logger: true });

app.register(
  (sub) => {
    // KEY: Set compilers at group level
    sub.setValidatorCompiler(validatorCompiler);
    sub.setSerializerCompiler(serializerCompiler);

    registerConversationRoutes(sub);
    registerMessageRoutes(sub);
  },
  { prefix: "/api/v1" }
);

// Step 2: Route files with type provider
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export function registerConversationRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/conversations",
    {
      schema: {
        body: CreateConversationSchema,  // Zod schema directly!
        response: {
          201: ConversationResponseSchema
        }
      }
    },
    async (req, reply) => {
      // req.body is fully typed and validated
    }
  );
}

// Step 3: Schema definitions
export const CreateConversationSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter']),
  model: z.string().min(1),
  title: z.string().optional()
});

export type CreateConversationBody = z.infer<typeof CreateConversationSchema>;
```

**Why This Matters:**
- Runtime validation + compile-time types from single definition
- No JSON Schema conversion needed
- Zod validation errors automatically formatted
- Full TypeScript inference in handlers

**Reference Files:**
- team-bruce `/src/server.ts` lines 1-46
- team-bruce `/src/routes/textCompressor.ts` lines 11-40

---

### 1.2 Error Handling Architecture

**Source:** team-bruce `/src/errors.ts` + `/src/server.ts` error handler

**The Pattern:**

```typescript
// Base error class
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

// Specific errors
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
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

// Global error handler
fastify.setErrorHandler((err, _req, reply) => {
  // Zod validation
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    reply.code(400).send({ error: message });
    return;
  }

  // App errors
  if (err instanceof AppError) {
    reply.code(err.statusCode).send({
      code: err.code,
      message: err.message,
      details: err.details
    });
    return;
  }

  // Unknown errors
  reply.send(err);
});
```

**Use in handlers:**
```typescript
const conversation = await conversationManager.getConversation(id);
if (!conversation) {
  throw new NotFoundError(`Conversation '${id}' not found`);
}
```

**Reference:** team-bruce `/src/errors.ts` (full file)

---

### 1.3 SSE Streaming with reply.hijack()

**Source:** v/codex-port `/src/server.ts` lines 417-501

**The Complete Pattern:**

```typescript
app.get("/api/v1/tasks/:taskId/events", async (request, reply) => {
  // Validate task exists
  const task = await getTask(request.params.taskId);
  if (!task) {
    throw new NotFoundError(`Task '${request.params.taskId}' not found`);
  }

  // Set SSE headers
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.hijack();  // CRITICAL: Take socket control

  // Setup abort controller for cleanup
  const controller = new AbortController();

  // Handle client disconnection
  const handleDisconnect = () => {
    controller.abort();
  };
  reply.raw.on("close", handleDisconnect);
  reply.raw.on("error", handleDisconnect);

  // Keepalive to prevent timeout
  const keepaliveMs = 15_000;
  const keepaliveTimer = setInterval(() => {
    if (reply.raw.writableEnded) return;
    try {
      reply.raw.write(`:keepalive\n\n`);
    } catch {
      // Ignore write errors
    }
  }, keepaliveMs);

  if (typeof keepaliveTimer.unref === "function") {
    keepaliveTimer.unref();
  }

  try {
    // Get starting position from Last-Event-ID header
    const lastEventId = request.headers['last-event-id'] || '0-0';

    // Read from Redis Stream
    for await (const entry of readRedisStream(task.streamKey, lastEventId)) {
      if (controller.signal.aborted) {
        break;
      }

      // Write SSE event
      reply.raw.write(`id: ${entry.id}\n`);
      reply.raw.write(`event: cody-event\n`);
      reply.raw.write(`data: ${JSON.stringify(entry.data)}\n\n`);
    }
  } catch (error) {
    // Handle stream trimming (events deleted)
    if (error instanceof StreamTrimmedError) {
      reply.raw.statusCode = 410;  // Gone
      reply.raw.write(`data: ${JSON.stringify({
        type: "error",
        code: "stream_trimmed",
        message: "Events before this point have been deleted",
        earliestAvailableId: error.earliestId
      })}\n\n`);
    } else {
      reply.raw.write(`data: ${JSON.stringify({
        type: "error",
        message: error.message
      })}\n\n`);
    }
  } finally {
    // Cleanup
    reply.raw.off("close", handleDisconnect);
    reply.raw.off("error", handleDisconnect);
    controller.abort();
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
    }
  }

  reply.raw.write("data: [DONE]\n\n");
  reply.raw.end();
});
```

**Critical Details:**
- `reply.hijack()` - Must call before any writes
- `reply.raw.writableEnded` - Check before writing (prevents errors)
- Keepalive every 15s prevents proxy/LB timeout
- Always cleanup listeners in `finally`
- Use AbortController tied to connection lifecycle
- HTTP 410 for trimmed streams (client knows to restart)

**Reference:** v/codex-port `/src/server.ts` lines 417-501

---

### 1.4 Redis Streams Operations

**Source:** v/codex-port `/src/runs/redis.ts`

**Writing Events:**
```typescript
async function publishRunEvent(runId: string, event: RunEvent): Promise<void> {
  const streamKey = runEventsStreamKey(runId);
  const timestamp = new Date().toISOString();

  await client.xadd(
    streamKey,
    "MAXLEN", "~", "50000",  // Keep ~50k events max (automatic trimming)
    "*",  // Auto-generate ID
    "type", event.type,
    "ts", timestamp,
    "runId", runId,
    "payload", JSON.stringify(event)
  );
}
```

**Reading Events:**
```typescript
async function* readRedisStream(
  streamKey: string,
  lastId: string
): AsyncGenerator<{ id: string; data: any }> {
  let currentId = lastId;

  while (true) {
    const response = await redis.xread(
      "BLOCK", "5000",  // Block for 5s (server-side wait)
      "COUNT", "100",   // Batch up to 100 events
      "STREAMS", streamKey, currentId
    );

    if (!response || response.length === 0) {
      // Check if task is complete (no more events coming)
      const task = await getTask(taskId);
      if (task.status === "completed" || task.status === "error") {
        break;  // Exit generator
      }
      continue;  // Keep blocking/waiting
    }

    for (const entry of response[0][1]) {
      currentId = entry[0];  // Update cursor
      const data = parseRedisEntry(entry[1]);
      yield { id: currentId, data };
    }
  }
}
```

**Stream Trimming Detection:**
```typescript
// Check if requested ID was trimmed
const streamInfo = await redis.xinfo("STREAM", streamKey);
const earliestId = streamInfo.find(e => e[0] === 'first-entry')?.[1]?.[0];

if (earliestId && compareStreamIds(earliestId, lastId) > 0) {
  throw new StreamTrimmedError({
    lastSeenId: lastId,
    earliestAvailableId: earliestId
  });
}

function compareStreamIds(id1: string, id2: string): number {
  // Format: "timestamp-sequence"
  const [t1, s1] = id1.split('-').map(Number);
  const [t2, s2] = id2.split('-').map(Number);

  if (t1 !== t2) return t1 - t2;
  return s1 - s2;
}
```

**Reference:** v/codex-port `/src/runs/redis.ts` lines 200-350

---

### 1.5 Repository Pattern with WATCH/MULTI

**Source:** team-bruce `/src/repos/SessionRepo.ts` lines 161-197

**Atomic Update Pattern:**

```typescript
async update(id: string, patch: UpdateInput): Promise<Entity | null> {
  const key = `entity:${id}`;

  // Watch key for changes
  await this.redis.watch(key);

  // Read current value
  const raw = await this.redis.get(key);
  if (!raw) {
    await this.redis.unwatch();
    return null;  // Not found
  }

  // Apply changes in-process
  const entity = JSON.parse(raw) as Entity;
  Object.assign(entity, patch);
  entity.updatedAt = new Date().toISOString();

  // Attempt atomic write
  const result = await this.redis
    .multi()
    .set(key, JSON.stringify(entity))
    .zadd("entities:index", Date.parse(entity.updatedAt), id)
    .exec();

  if (!result) {
    return null;  // Concurrent modification detected
  }

  return entity;
}
```

**Why WATCH/MULTI:**
- Detects concurrent modifications
- Ensures read-modify-write atomicity
- Returns null if race condition detected
- Caller decides whether to retry

**Reference:** team-bruce `/src/repos/SessionRepo.ts` lines 161-197

---

### 1.6 Cursor Pagination with Tie Handling

**Source:** team-bruce `/src/repos/MessageRepo.ts` lines 86-179

**The Problem:** When multiple records have the same timestamp, standard cursor pagination loses items.

**The Solution:**

```typescript
async list(sid: string, query: ListQuery): Promise<ListResult> {
  let minScore = "-inf";
  let maxScore = "+inf";
  let cursorMs: number | null = null;
  let cursorId: string | null = null;

  // Parse cursor: "timestamp:id"
  if (query.cursor) {
    const [msStr, idStr] = query.cursor.split(":");
    const parsed = Number.parseInt(msStr ?? "", 10);
    if (!Number.isNaN(parsed)) {
      cursorMs = parsed;
      cursorId = idStr ?? null;
      minScore = parsed.toString();  // Inclusive
    }
  }

  // Fetch limit + 1 to detect hasMore
  const limit = Math.max(1, Math.min(100, query.limit ?? 20));
  const ids = await this.redis.zrangebyscore(
    `messages:bySession:${sid}`,
    minScore,
    maxScore,
    "LIMIT", 0, limit + 1
  );

  // Load and filter for ties
  const items = [];
  for (const id of ids) {
    const raw = await this.redis.get(`message:${id}`);
    if (!raw) continue;

    const message = JSON.parse(raw);
    const messageMs = Date.parse(message.createdAt);

    // Skip items with same timestamp but not strictly after cursor ID
    if (
      cursorMs !== null &&
      messageMs === cursorMs &&
      cursorId !== null &&
      message.mid <= cursorId
    ) {
      continue;  // This item was on previous page
    }

    if (items.length < limit) {
      items.push(message);
    } else {
      break;  // Found limit+1, hasMore = true
    }
  }

  // Build next cursor
  let nextCursor = null;
  if (ids.length > limit && items.length > 0) {
    const last = items[items.length - 1];
    const ms = Date.parse(last.createdAt);
    nextCursor = `${ms}:${last.mid}`;
  }

  return { items, nextCursor };
}
```

**Why This Is Critical:**
- Prevents lost items at page boundaries
- Uses ID as tie-breaker when timestamps match
- Works with Redis ZSET (no special commands needed)

**Reference:** team-bruce `/src/repos/MessageRepo.ts` lines 86-179

---

### 1.7 Distributed Lock for Exclusive Execution

**Source:** team-bruce `/src/handlers/runHandlers.ts` + v/codex-port `/src/runs/run-worker.ts`

**The Pattern:**

```typescript
async function executeExclusively(resourceId: string, work: () => Promise<void>) {
  const lockKey = `lock:${resourceId}`;
  const workerId = randomUUID();
  const ttlSeconds = 60;

  // Acquire lock (NX = only if not exists)
  const acquired = await redis.set(
    lockKey,
    workerId,
    "NX",  // Only set if key doesn't exist
    "EX",  // Expire after TTL
    ttlSeconds
  );

  if (!acquired) {
    // Another worker has the lock
    // Option A: Throw conflict error
    throw new ConflictError("Resource is being processed");

    // Option B: Wait and poll (from team-bruce)
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const status = await checkResourceStatus(resourceId);
      if (status.isComplete) {
        return;  // Other worker finished
      }
      await sleep(150);  // Poll every 150ms
    }
    throw new Error("Timeout waiting for resource");
  }

  try {
    await work();
  } finally {
    // Release lock (only if we still own it)
    const current = await redis.get(lockKey);
    if (current === workerId) {
      await redis.del(lockKey);
    }
  }
}
```

**Lock Refresh for Long Operations:**
```typescript
// For operations >60s, refresh lock periodically
const refreshInterval = setInterval(async () => {
  const current = await redis.get(lockKey);
  if (current === workerId) {
    await redis.expire(lockKey, ttlSeconds);  // Reset TTL
  } else {
    clearInterval(refreshInterval);
    throw new Error("Lost lock ownership");
  }
}, 20_000);  // Refresh every 20s (3x safety margin)
```

**Reference Files:**
- team-bruce `/src/handlers/runHandlers.ts` lines 236-266
- v/codex-port `/src/runs/run-worker.ts` lines 108-150

---

### 1.8 Thin Handler Pattern (Transport-Only)

**Source:** team-bruce `/src/handlers/sessionHandlers.ts`

**The Pattern:**

```typescript
// Handler builder (dependency injection)
export function buildSessionHandlers(repo: SessionRepo) {
  return {
    async create(
      req: FastifyRequest<{ Body: SessionCreateBody }>,
      reply: FastifyReply
    ): Promise<void> {
      const session = await repo.create(req.body);
      reply.code(201).send(session);
    },

    async list(
      req: FastifyRequest<{ Querystring: ListSessionsQuery }>,
      reply: FastifyReply
    ): Promise<void> {
      const result = await repo.list(req.query);
      reply.code(200).send(result);
    },

    async get(
      req: FastifyRequest<{ Params: { sid: string } }>,
      reply: FastifyReply
    ): Promise<void> {
      const session = await repo.get(req.params.sid);
      if (!session) {
        throw new NotFoundError(`Session '${req.params.sid}' not found`);
      }
      reply.code(200).send(session);
    }
  };
}
```

**Design Rules:**
- Handlers ONLY: extract params, call repo, set status code
- NO business logic in handlers
- NO Redis access in handlers
- ALL validation in Zod schemas
- Let errors bubble to global handler

**Reference:** team-bruce `/src/handlers/sessionHandlers.ts`

---

### 1.9 Dependency Injection for Testability

**Source:** v/codex-port `/src/server.ts`

**The Pattern:**

```typescript
export interface CreateServerOptions {
  // Core dependencies
  conversationManager?: ConversationManager;
  redis?: RedisClient;

  // Function dependencies
  generateId?: () => string;
  createSession?: typeof createSessionDefault;

  // Service dependencies
  runsService?: BackgroundRunsService;

  // Configuration
  logger?: FastifyServerOptions["logger"];
  runsStreamKeepaliveMs?: number;
}

export async function createServer(options: CreateServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });

  // Use provided or create defaults
  const conversationManager = options.conversationManager
    ?? await ConversationManager.create();
  const redis = options.redis
    ?? await createRedisClient();
  const generateId = options.generateId
    ?? randomUUID;

  // Build handlers with injected dependencies
  const handlers = buildHandlers(conversationManager, redis);

  // Register routes
  app.post('/conversations', handlers.create);

  return app;
}
```

**Testing:**
```typescript
// In tests
const mockConversationManager = {
  createConversation: vi.fn().mockResolvedValue({ id: 'test' })
};

const app = await createServer({
  conversationManager: mockConversationManager
});

const response = await app.inject({
  method: 'POST',
  url: '/conversations',
  payload: { provider: 'openai', model: 'gpt-5-codex' }
});

expect(mockConversationManager.createConversation).toHaveBeenCalled();
```

**Reference:** v/codex-port `/src/server.ts` lines 33-48

---

## PART 2: CONSIDER SOON (Phase 2.3-2.4)

### 2.1 Advanced Zod Validation

**Source:** team-bruce schemas with superRefine

**Cross-Field Validation:**
```typescript
export const RunStatusPatchBodySchema = z
  .object({
    status: z.enum(["active", "stopped", "completed", "error"]),
    completionSummary: z.string().max(2000).nullable().optional(),
    errorMessage: z.string().max(2000).nullable().optional()
  })
  .superRefine((data, ctx) => {
    // Business rule: completed status requires summary
    if (data.status === "completed" && !data.completionSummary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "completionSummary required when status is completed",
        path: ["completionSummary"]
      });
    }

    // Business rule: error status requires message
    if (data.status === "error" && !data.errorMessage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errorMessage required when status is error",
        path: ["errorMessage"]
      });
    }
  });
```

**Flexible Input with Coercion:**
```typescript
export const ListQuerySchema = z.object({
  // Accept string or number (query params are strings)
  limit: z.union([z.number().int(), z.string()]).optional(),
  cursor: z.string().optional()
});

// In handler/repo
let limit = 20;
if (query.limit !== undefined) {
  const parsed = typeof query.limit === "string"
    ? Number.parseInt(query.limit, 10)
    : query.limit;
  if (!Number.isNaN(parsed)) {
    limit = Math.max(1, Math.min(100, parsed));  // Bound to sensible range
  }
}
```

**Reference:** team-bruce `/src/schemas/run.ts`, `/src/repos/SessionRepo.ts`

---

### 2.2 Background Async Work with State Updates

**Source:** team-bruce `/src/repos/ChunkRepo.ts` lines 276-320

**Fire-and-Forget Pattern:**

```typescript
// In repo method (triggered by state change)
if (previousState === "open" && newState === "closed") {
  // Fire async compression job
  this.generateFidelitiesAsync(sid, cid).catch((err) => {
    console.error(`Fidelity generation failed for ${sid}:${cid}:`, err);
  });
}

private async generateFidelities(sid: string, cid: number): Promise<void> {
  const now = new Date().toISOString();

  try {
    // Update status to indicate work started
    for (const letter of ["L", "M", "S", "D"]) {
      await this.updateFidelityStatus(sid, cid, letter, {
        status: "pending",
        updatedAt: now
      });
    }

    // Do the work (call external service)
    await runCompressionJob({ sid, cid });

    // Update to ready
    for (const letter of ["L", "M", "S", "D"]) {
      await this.updateFidelityStatus(sid, cid, letter, {
        status: "ready",
        updatedAt: now
      });
    }
  } catch (error) {
    // Update to error
    for (const letter of ["L", "M", "S", "D"]) {
      await this.updateFidelityStatus(sid, cid, letter, {
        status: "error",
        updatedAt: now,
        note: "job-execution-failed"
      });
    }
  }
}

private generateFidelitiesAsync(sid: string, cid: number): Promise<void> {
  return this.generateFidelities(sid, cid);
}
```

**Key Insight:** Always update status field before AND after async work. Clients can poll status to track progress.

---

### 2.3 Redis Key Naming Conventions

**Sources:** Both codebases

**Standardized Patterns:**

```
Primary Records:
  conversation:{id}                    → Conversation JSON
  task:{id}                            → Task metadata JSON
  message:{id}                         → Message JSON

Indexes (for listing):
  conversations:byCreated              → ZSET (score=epoch_ms, member=id)
  conversations:byUpdated              → ZSET (score=epoch_ms, member=id)
  tasks:byConversation:{conversationId} → ZSET

Event Streams:
  events:{taskId}                      → Stream of EventMsg
  control:{taskId}                     → Stream of control messages

Locks:
  lock:task:{taskId}                   → Lock string, EX=60s

Transient Data:
  temp:{taskId}:result                 → Temp storage, EX=3600s
```

**Principles:**
- Hierarchical: `resource:subtype:{id}`
- Predictable: Derivable from entity IDs
- Namespaced: Group related keys
- Consistent casing: lowercase with colons

---

### 2.4 Playwright Test Organization

**Source:** team-bruce `/tests/` structure

**File Organization:**
```
tests/
├── sessions.spec.ts          # Session CRUD tests
├── messages.spec.ts          # Message operations
├── runs.spec.ts              # Run lifecycle tests
├── chunks.spec.ts            # Chunk and fidelity tests
├── orchestration/            # Orchestration runtime tests
│   ├── execute.e2e.spec.ts
│   ├── memory.spec.ts
│   └── parser.spec.ts
└── helpers/
    └── api-helpers.ts        # Reusable test functions
```

**Helper Pattern:**
```typescript
// tests/helpers/api-helpers.ts
export async function createConversation(
  request: APIRequestContext,
  baseURL: string,
  body: any = {}
): Promise<string> {
  const res = await request.post(`${baseURL}/api/v1/conversations`, {
    headers: { "Content-Type": "application/json" },
    data: body
  });

  expect(res.status()).toBe(201);
  const json = await res.json();
  return json.conversationId;
}

export async function submitMessage(
  request: APIRequestContext,
  baseURL: string,
  conversationId: string,
  message: string
): Promise<{ taskId: string; eventsUrl: string }> {
  const res = await request.post(
    `${baseURL}/api/v1/conversations/${conversationId}/messages`,
    {
      headers: { "Content-Type": "application/json" },
      data: { message }
    }
  );

  expect(res.status()).toBe(202);
  return await res.json();
}
```

**Reference:** team-bruce `/tests/sessions.spec.ts`, `/tests/epic3/helpers.ts`

---

## PART 3: LEARN FROM (Insights & Solutions)

### 3.1 HTTP Status Code Semantics

**Source:** team-bruce comment in `/src/handlers/runHandlers.ts:56-116`

**Key Insight:**

```
Comment 7: Always responds 201 on successful request handling,
including when autonomous execution transitions the run to an error state.
The HTTP status does not mirror the run lifecycle; instead, the response
body contains the final Run snapshot with `status` possibly set to 'error'.
```

**Rule:**
- 201 = "Resource created successfully"
- 200 = "Operation succeeded"
- Business status goes in response body, not HTTP status
- HTTP 500 reserved for unexpected errors only
- Domain errors (validation, not found, etc.) use appropriate 4xx codes

**Example:**
```typescript
// Task completes with error? Still 201 Created
reply.code(201).send({
  taskId: "task_123",
  status: "error",  // Business status
  error: { message: "Model timeout" }
});

// Task not found? 404
reply.code(404).send({
  error: {
    code: "TASK_NOT_FOUND",
    message: "Task 'task_123' not found"
  }
});
```

---

### 3.2 Graceful Shutdown for Background Workers

**Source:** v/codex-port `/src/runs/run-worker.ts` + `/src/runs/run-service.ts`

**Two-Phase Shutdown:**

```typescript
// In server
app.addHook("onClose", async () => {
  if (runsService) {
    await runsService.shutdown();  // Signal workers to stop
  }
  if (redis) {
    await redis.quit();
  }
});

// In run-service
async shutdown(): Promise<void> {
  const shutdownPromises = [];
  const workerPromises = [];

  for (const [runId, entry] of activeWorkers.entries()) {
    // Signal shutdown
    shutdownPromises.push(
      entry.worker.shutdown().catch(err => {
        console.error(`Worker ${runId} shutdown failed:`, err);
      })
    );

    // Wait for completion
    workerPromises.push(
      entry.promise.catch(err => {
        console.error(`Worker ${runId} promise rejected:`, err);
      })
    );
  }

  // Wait for all shutdowns to initiate
  await Promise.allSettled(shutdownPromises);

  // Wait for all workers to complete (with timeout)
  await Promise.race([
    Promise.allSettled(workerPromises),
    sleep(5000)  // 5s grace period
  ]);

  activeWorkers.clear();
}
```

**Reference:** v/codex-port `/src/runs/run-service.ts` lines 180-230

---

### 3.3 Token Usage Extraction (Multi-Source)

**Source:** v/codex-port `/src/runs/run-worker.ts` lines 539-593

**Resilient Extraction:**

```typescript
function extractTokenUsage(result: TurnResult): TokenUsage | undefined {
  // Try direct field
  if (result.tokenUsage) {
    return normalizeTokenUsage(result.tokenUsage);
  }

  // Try events array
  for (const event of result.events) {
    if (event.type === "token_usage") {
      const normalized = normalizeTokenUsage(event);
      if (normalized) return normalized;
    }

    // Nested in completion event
    if (event.type === "turn_completed" && event.tokenUsage) {
      const normalized = normalizeTokenUsage(event.tokenUsage);
      if (normalized) return normalized;
    }
  }

  return undefined;
}

function normalizeTokenUsage(raw: any): TokenUsage | undefined {
  const inputTokens = toNumber(raw.inputTokens) ?? 0;
  const outputTokens = toNumber(raw.outputTokens) ?? 0;
  const totalTokens = toNumber(raw.totalTokens) ?? (inputTokens + outputTokens);

  if (!Number.isFinite(totalTokens)) {
    return undefined;
  }

  return { inputTokens, outputTokens, totalTokens };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}
```

**Insight:** Different providers format token usage differently. Check multiple sources, normalize carefully.

---

## PART 4: IMPLEMENTATION CHECKLIST

### Phase 2.0 (Wrap CLI in Fastify)

**Must Implement:**
- [ ] Fastify server with Zod compilers (Pattern 1.1)
- [ ] Error hierarchy (Pattern 1.2)
- [ ] Global error handler (Pattern 1.2)
- [ ] Zod schemas for all endpoints (Pattern 1.1)
- [ ] Route handlers that exec CLI commands
- [ ] Response parsing and normalization
- [ ] Playwright test suite with helpers (Pattern 2.4)

**Reference Files:**
- team-bruce `/src/server.ts` (setup)
- team-bruce `/src/errors.ts` (errors)
- team-bruce `/src/schemas/` (validation)

---

### Phase 2.1 (Library Integration)

**Must Implement:**
- [ ] Import ConversationManager in server
- [ ] Replace exec() with direct method calls
- [ ] Thin handler pattern (Pattern 1.8)
- [ ] Dependency injection (Pattern 1.9)
- [ ] Update Playwright tests (should pass unchanged)

**Reference Files:**
- team-bruce `/src/handlers/sessionHandlers.ts`
- v/codex-port `/src/server.ts` CreateServerOptions

---

### Phase 2.2 (Redis Streams + SSE)

**Must Implement:**
- [ ] Redis client setup
- [ ] EventMsg → Redis Stream bridge
- [ ] SSE endpoint with reply.hijack() (Pattern 1.3)
- [ ] Keepalive mechanism (15s interval)
- [ ] Last-Event-ID resume support
- [ ] Stream trimming detection (HTTP 410)
- [ ] Task metadata tracking in Redis
- [ ] Async task pattern in message submission
- [ ] Update Playwright tests for async + SSE

**Reference Files:**
- v/codex-port `/src/server.ts` lines 417-501 (SSE)
- v/codex-port `/src/runs/redis.ts` (all Redis ops)

---

## PART 5: ANTI-PATTERNS TO AVOID

### 5.1 DON'T: Business Logic in Handlers

```typescript
// ❌ BAD
app.post('/conversations', async (req, reply) => {
  const id = randomUUID();
  const now = new Date().toISOString();

  await redis.set(`conversation:${id}`, JSON.stringify({
    id, createdAt: now, ...req.body
  }));

  await redis.zadd('conversations:index', Date.parse(now), id);

  reply.code(201).send({ id });
});

// ✓ GOOD
app.post('/conversations', async (req, reply) => {
  const conversation = await conversationRepo.create(req.body);
  reply.code(201).send(conversation);
});
```

---

### 5.2 DON'T: Unbounded Query Parameters

```typescript
// ❌ BAD
const limit = query.limit || 20;  // What if limit = 1000000?

// ✓ GOOD
const limit = Math.max(1, Math.min(100, query.limit ?? 20));
```

---

### 5.3 DON'T: Silent Async Failures

```typescript
// ❌ BAD
this.processInBackground(data);  // No .catch()!

// ✓ GOOD
this.processInBackground(data).catch(err => {
  console.error('Background process failed:', err);
  this.updateStatus(id, "error");
});
```

---

### 5.4 DON'T: Forget SSE Cleanup

```typescript
// ❌ BAD
app.get('/events', async (req, reply) => {
  reply.hijack();
  for await (const event of stream) {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  // Missing: close/error listeners, abort controller, keepalive cleanup
});

// ✓ GOOD (see Pattern 1.3)
```

---

## PART 6: COPY-PASTE READY CODE

### Cursor Pagination Function

```typescript
async function paginateWithCursor<T extends { id: string; createdAt: string }>(
  indexKey: string,
  itemKeyPrefix: string,
  query: { cursor?: string; limit?: number }
): Promise<{ items: T[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(100, query.limit ?? 20));

  let minScore = "-inf";
  let cursorMs: number | null = null;
  let cursorId: string | null = null;

  if (query.cursor) {
    const [msStr, idStr] = query.cursor.split(":");
    const parsed = Number.parseInt(msStr ?? "", 10);
    if (!Number.isNaN(parsed)) {
      cursorMs = parsed;
      cursorId = idStr ?? null;
      minScore = parsed.toString();
    }
  }

  const ids = await redis.zrangebyscore(
    indexKey,
    minScore,
    "+inf",
    "LIMIT", 0, limit + 1
  );

  const items: T[] = [];
  for (const id of ids) {
    const raw = await redis.get(`${itemKeyPrefix}:${id}`);
    if (!raw) continue;

    const item = JSON.parse(raw) as T;
    const itemMs = Date.parse(item.createdAt);

    if (
      cursorMs !== null &&
      itemMs === cursorMs &&
      cursorId !== null &&
      item.id <= cursorId
    ) {
      continue;
    }

    if (items.length < limit) {
      items.push(item);
    } else {
      break;
    }
  }

  let nextCursor = null;
  if (ids.length > limit && items.length > 0) {
    const last = items[items.length - 1];
    const ms = Date.parse(last.createdAt);
    nextCursor = `${ms}:${last.id}`;
  }

  return { items, nextCursor };
}
```

---

### Distributed Lock Helper

```typescript
async function withLock<T>(
  redis: Redis,
  lockKey: string,
  ttlSeconds: number,
  work: () => Promise<T>
): Promise<T> {
  const workerId = randomUUID();
  const acquired = await redis.set(lockKey, workerId, "NX", "EX", ttlSeconds);

  if (!acquired) {
    throw new ConflictError("Resource is locked");
  }

  try {
    return await work();
  } finally {
    const current = await redis.get(lockKey);
    if (current === workerId) {
      await redis.del(lockKey);
    }
  }
}

// Usage
const result = await withLock(
  redis,
  `lock:conversation:${id}`,
  60,
  async () => {
    return await processConversation(id);
  }
);
```

---

## SUMMARY: CRITICAL PATHS

**For Phase 2.0-2.1 (Foundation):**
1. Use Fastify + Zod pattern exactly as team-bruce (1.1)
2. Implement error hierarchy exactly as team-bruce (1.2)
3. Use thin handlers pattern (1.8)
4. Implement dependency injection (1.9)

**For Phase 2.2 (Streaming):**
1. Use SSE pattern from v/codex-port (1.3)
2. Use Redis Streams operations from v/codex-port (1.4)
3. Implement cursor pagination with ties from team-bruce (1.6)
4. Use distributed locks from both (1.7)

**All patterns are production-proven and ready for direct implementation.**

**Total Reference Code Available:** ~3,000 lines of proven patterns across both codebases.
