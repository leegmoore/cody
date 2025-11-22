# Implementing the persistence layer for Codex Core 2.0
_Exported on 11/21/2025 at 06:38:27 EST from Cursor (2.0.77)_

---

**User**

# Role
You are a Senior Software Architect and Engineer tasked with executing Phase 2 of the **Codex Core 2.0 Rewrite**. You are meticulous, safety-conscious, and deeply understand Event-Driven Architectures. You prioritize "Contract-First" development and verifiable integration tests over unit-level mocking.

# Context: Core 2.0 Rewrite Overview
**Cody** is an agentic coding assistant. It runs as a local Fastify server (`cody-fastify`) that uses Convex for persistence and Redis for real-time event streaming. The Core 2.0 Rewrite is replacing the legacy orchestration engine with a **Streaming-First, Block-Based Event Pipeline**.

**Phase 1 (Foundation) is COMPLETE.** The Redis pipeline is established, Zod schemas are defined, a generic OpenAI Adapter exists, and a verification script confirms basic event flow to Redis.

# Current Phase: Phase 2 - The "Projector" (Persistence)

**High-Level Objective:** Implement the Persistence Layer. Read `StreamEvent`s from Redis and persist materialized `Response` objects to Convex. This phase focuses on building a standalone worker process.

# Key Documentation (Source of Truth)
You must read and internalize these documents before writing code:

1.  **Blueprint:** `cody-fastify/docs/codex-core-2.0-tech-design.md` (The architecture, schema, and plan). **Crucial:** Adhere strictly to "Appendix A: The Contract" for Zod schemas, Redis topology, and Adapter specifications.
2.  **Legacy Context:** `cody-fastify/docs/codex-core-as-is.md` (What we are replacing and why).
3.  **Future Features:** `cody-fastify/docs/codex-enhancement-02.md` (The Script Harness vision you must support).

# Coding Standards & Habits

**TypeScript Strictness**
*   **No `any`:** Use `unknown` if you must, then narrow. Use discriminated unions for event types.
*   **Schema First:** Define your Zod schemas or TS interfaces *before* implementing logic. The `OutputItem` and `StreamEvent` definitions are your contract.
*   **Async/Await:** Prefer `async/await` over `.then()`. Handle promise rejections explicitly.

**Observability & Infrastructure**
*   **OpenLLMetry + Langfuse:** All components (Adapter, Worker, API) must be instrumented with OpenLLMetry (Traceloop). Configure for Langfuse Cloud.
*   **Trace Propagation:** You MUST implement the "Bridge Pattern" to propagate OpenTelemetry trace context across Redis. Events in Redis must carry the parent trace ID so the waterfall is unbroken.
*   **Redis Driver:** `ioredis` is currently used for streaming operations due to `bun:redis` limitations.
*   **Local Config:** For local development, assume Redis has NO Auth and NO TLS. Simplicity first.

**Verification**
*   **Lint/Check Often:** Run `npm run lint` and `npm run typecheck` (or the bun equivalents) after every significant change. Do not let errors accumulate.
*   **Testing Strategy: NO MOCKS.**
    *   **Requirement:** **Working code with mocks is FAILING code.**
    *   **Infrastructure:** Tests MUST run against the real local Redis instance and real OpenAI API.
    *   **Framework:** Use **Playwright** for End-to-End verification. Use simple standalone TS scripts (`bun run scripts/verify.ts`) for pipeline checks.
    *   **Bad:** `vi.mock('redis')` -> Immediate Rejection.
    *   **Good:** `const redis = new Redis(); await redis.xadd(...)`

**Tooling**
*   **Package Structure:**
    *   **`cody-fastify` (Primary):** This is where **ALL** new work happens (Core 2.0, API, Workers). It runs on **Bun**.
    *   **`codex-ts` (Legacy):** Deprecated. The CLI is dead. Treat this package as "Read-Only". Only import reusable tools (like patch logic) from it. Do not add new code here.
*   **Environment:** The environment is **pre-configured** in `cody-fastify`. **Do NOT create new `.env` files.**
*   **Run Scripts:**
    *   `bun run dev`: Starts the server (in `cody-fastify`).
        *   **Local Dev Setup:** Expects Convex to be running in one console (`npx convex dev`) and the `bun run dev` server in another. Both should auto-reload on changes. If either service encounters issues or requires a manual restart, notify me.
    *   `bun run test:e2e`: Runs Playwright tests (in `cody-fastify`).

# Work Plan (Phase 2: The Projector - ISOLATED)

**Constraint:** This phase is strictly about building the persistence worker. **Do NOT** modify existing Fastify API routes. The Projector must function as a standalone background worker, reading directly from Redis and writing to Convex.

**Phase 2 Deliverables (from cody-fastify/docs/codex-core-2.0-tech-design.md):**

1.  **Persistence Worker:** Implement the `PersistenceWorker` class (the Projector). This class will read `StreamEvent`s from Redis, apply reducer logic, and write `Response` objects to Convex.
    *   **Entrypoint:** Create `cody-fastify/src/workers/run_projector.ts` as the executable script to launch this worker process.
2.  **Reducer Logic:** Implement the `ResponseReducer` class (likely in `cody-fastify/src/core/reducer.ts`) that builds a full `Response` object from a sequence of `StreamEvent`s.
    *   **Robustness:** The reducer MUST be idempotent. It should handle duplicate events (replays) gracefully without corrupting the state.
3.  **Convex Schema:** Define the Convex schema for the `messages` table in `cody-fastify/convex/schema.ts` (as detailed in Appendix A of the Tech Design doc).
4.  **DB Writer:** Implement the `ConvexWriter` class (or similar) in `cody-fastify/src/core/persistence/` that handles writing/updating the `Response` object to Convex.
5.  **Verification:** Extend the `cody-fastify/scripts/verify_pipeline.ts` script to:
    *   Spawn the `PersistenceWorker`.
    *   Send a message to Redis (via Adapter).
    *   Assert that the `PersistenceWorker` picks it up and writes a `Response` record to Convex.
    *   Clean up Redis and Convex (if possible) after verification.

# Developer Log
Maintain a `DEVLOG.md` in the root (or `cody-fastify/DEVLOG.md`). Update it after every session.

```markdown
# Developer Log

## [Date] - Phase [X]

### Completed
- [ ] Task A
- [ ] Task B

### Challenges
- Encountered [Problem]. Resolved by [Solution].

### Design Decisions
- Decided to use [Pattern] because [Reason].

### Next Steps
- [ ] Task C
```

# Final Instruction
Please review these instructions and the instructions and information in all reference documents listed thoroughly. You can ask up to 4 crisp clarifying questions before starting. Once the work is started, **continue working until you complete Phase 2.** Do not stop to report status unless there is a blocker or difficult decision that requires user consultation. Otherwise, continue working autonomously until Phase 2 is verified and complete.


---

**Cursor**

```typescript
import { cloneDeep } from "../util/clone.js";
import {
  OutputItem,
  Response,
  ResponseSchema,
  StreamEvent,
} from "./schema.js";

type MutableResponse = Omit<Response, "output_items"> & {
  output_items: OutputItem[];
};

type ItemBuffer = {
  id: string;
  type: OutputItem["type"];
  chunks: string[];
  meta: Record<string, unknown>;
};

export class ResponseReducer {
  private current: MutableResponse | undefined;
  private readonly itemBuffers = new Map<string, ItemBuffer>();
  private readonly processedEventIds = new Set<string>();

  apply(event: StreamEvent): Response | undefined {
    const payloadType = event.payload.type;

    if (payloadType === "response_start") {
      if (this.processedEventIds.has(event.event_id)) {
        return this.snapshot();
      }
      this.bootstrapResponse(event);
      this.processedEventIds.add(event.event_id);
      return this.snapshot();
    }

    if (this.processedEventIds.has(event.event_id)) {
      return this.snapshot();
    }
    this.processedEventIds.add(event.event_id);

    let mutated = false;
    switch (payloadType) {
      case "item_start": {
        const buffer: ItemBuffer = {
          id: event.payload.item_id,
          type: event.payload.item_type,
          chunks: [],
          meta: {},
        };
        if (event.payload.initial_content) {
          buffer.chunks.push(event.payload.initial_content);
        }
        if (event.payload.name) buffer.meta.name = event.payload.name;
        if (event.payload.arguments) buffer.meta.arguments = event.payload.arguments;
        if (event.payload.code) buffer.meta.code = event.payload.code;
        this.itemBuffers.set(event.payload.item_id, buffer);
        mutated = true;
        break;
      }

      case "item_delta": {
        const buf = this.itemBuffers.get(event.payload.item_id);
        if (buf) {
          buf.chunks.push(event.payload.delta_content);
          mutated = true;
        }
        break;
      }

      case "item_done": {
        const finalItem = cloneDeep(event.payload.final_item);
        this.upsertOutputItem(finalItem);
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_error": {
        this.upsertOutputItem({
          id: event.payload.item_id,
          type: "error",
          code: event.payload.error.code,
          message: event.payload.error.message,
          details: event.payload.error.details,
          origin: "system",
        });
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_cancelled": {
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "usage_update": {
        const current = this.ensureResponse();
        current.usage = event.payload.usage;
        mutated = true;
        break;
      }

      case "response_done": {
        const current = this.ensureResponse();
        current.status = event.payload.status;
        current.finish_reason = event.payload.finish_reason;
        if (event.payload.usage) {
          current.usage = event.payload.usage;
        }
        mutated = true;
        break;
      }

      case "response_error": {
        const current = this.ensureResponse();
        current.status = "error";
        current.error = event.payload.error;
        mutated = true;
        break;
      }

      case "turn_aborted_by_user": {
        const current = this.ensureResponse();
        current.status = "aborted";
        current.finish_reason = event.payload.reason;
        mutated = true;
        break;
      }

      case "heartbeat":
      case "script_execution_start":
      case "script_execution_done":
      case "script_execution_error": {
        // These events carry operational metadata that does not directly mutate
        // the persisted response snapshot. We accept them for trace continuity.
        break;
      }
    }

    if (mutated && this.current) {
      this.current.updated_at = Math.max(this.current.updated_at, event.timestamp);
    }

    return this.snapshot();
  }

  snapshot(): Response | undefined {
    if (!this.current) return undefined;
    return ResponseSchema.parse(cloneDeep(this.current));
  }

  private bootstrapResponse(event: StreamEvent & { payload: { type: "response_start" } }): void {
    this.current = {
      id: event.payload.response_id,
      turn_id: event.payload.turn_id,
      thread_id: event.payload.thread_id,
      agent_id: event.payload.agent_id,
      model_id: event.payload.model_id,
      provider_id: event.payload.provider_id,
      created_at: event.payload.created_at,
      updated_at: event.timestamp,
      status: "in_progress",
      output_items: [],
      usage: undefined,
      finish_reason: null,
      error: undefined,
    };
    this.itemBuffers.clear();
    this.processedEventIds.clear();
  }

  private ensureResponse(): MutableResponse {
    if (!this.current) {
      throw new Error("Reducer received event before response_start");
    }
    return this.current;
  }

  private upsertOutputItem(item: OutputItem): void {
    const current = this.ensureResponse();
    const idx = current.output_items.findIndex((existing) => existing.id === item.id);
    if (idx >= 0) {
      current.output_items[idx] = item;
    } else {
      current.output_items.push(item);
    }
  }
}

```

```typescript
import { cloneDeep } from "../util/clone.js";
import {
  OutputItem,
  Response,
  ResponseSchema,
  StreamEvent,
} from "./schema.js";

type MutableResponse = Omit<Response, "output_items"> & {
  output_items: OutputItem[];
};

type ResponseStartPayload = Extract<
  StreamEvent["payload"],
  { type: "response_start" }
>;

type ItemBuffer = {
  id: string;
  type: OutputItem["type"];
  chunks: string[];
  meta: Record<string, unknown>;
};

export class ResponseReducer {
  private current: MutableResponse | undefined;
  private readonly itemBuffers = new Map<string, ItemBuffer>();
  private readonly processedEventIds = new Set<string>();

  apply(event: StreamEvent): Response | undefined {
    const payloadType = event.payload.type;

    if (payloadType === "response_start") {
      if (this.processedEventIds.has(event.event_id)) {
        return this.snapshot();
      }
      this.bootstrapResponse(event, event.payload);
      this.processedEventIds.add(event.event_id);
      return this.snapshot();
    }

    if (this.processedEventIds.has(event.event_id)) {
      return this.snapshot();
    }
    this.processedEventIds.add(event.event_id);

    let mutated = false;
    switch (payloadType) {
      case "item_start": {
        const buffer: ItemBuffer = {
          id: event.payload.item_id,
          type: event.payload.item_type,
          chunks: [],
          meta: {},
        };
        if (event.payload.initial_content) {
          buffer.chunks.push(event.payload.initial_content);
        }
        if (event.payload.name) buffer.meta.name = event.payload.name;
        if (event.payload.arguments) buffer.meta.arguments = event.payload.arguments;
        if (event.payload.code) buffer.meta.code = event.payload.code;
        this.itemBuffers.set(event.payload.item_id, buffer);
        mutated = true;
        break;
      }

      case "item_delta": {
        const buf = this.itemBuffers.get(event.payload.item_id);
        if (buf) {
          buf.chunks.push(event.payload.delta_content);
          mutated = true;
        }
        break;
      }

      case "item_done": {
        const finalItem = cloneDeep(event.payload.final_item);
        this.upsertOutputItem(finalItem);
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_error": {
        this.upsertOutputItem({
          id: event.payload.item_id,
          type: "error",
          code: event.payload.error.code,
          message: event.payload.error.message,
          details: event.payload.error.details,
          origin: "system",
        });
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_cancelled": {
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "usage_update": {
        const current = this.ensureResponse();
        current.usage = event.payload.usage;
        mutated = true;
        break;
      }

      case "response_done": {
        const current = this.ensureResponse();
        current.status = event.payload.status;
        current.finish_reason = event.payload.finish_reason;
        if (event.payload.usage) {
          current.usage = event.payload.usage;
        }
        mutated = true;
        break;
      }

      case "response_error": {
        const current = this.ensureResponse();
        current.status = "error";
        current.error = event.payload.error;
        mutated = true;
        break;
      }

      case "turn_aborted_by_user": {
        const current = this.ensureResponse();
        current.status = "aborted";
        current.finish_reason = event.payload.reason;
        mutated = true;
        break;
      }

      case "heartbeat":
      case "script_execution_start":
      case "script_execution_done":
      case "script_execution_error": {
        // These events carry operational metadata that does not directly mutate
        // the persisted response snapshot. We accept them for trace continuity.
        break;
      }
    }

    if (mutated && this.current) {
      this.current.updated_at = Math.max(this.current.updated_at, event.timestamp);
    }

    return this.snapshot();
  }

  snapshot(): Response | undefined {
    if (!this.current) return undefined;
    return ResponseSchema.parse(cloneDeep(this.current));
  }

  private bootstrapResponse(
    event: StreamEvent,
    payload: ResponseStartPayload,
  ): void {
    this.current = {
      id: payload.response_id,
      turn_id: payload.turn_id,
      thread_id: payload.thread_id,
      agent_id: payload.agent_id,
      model_id: payload.model_id,
      provider_id: payload.provider_id,
      created_at: payload.created_at,
      updated_at: event.timestamp,
      status: "in_progress",
      output_items: [],
      usage: undefined,
      finish_reason: null,
      error: undefined,
    };
    this.itemBuffers.clear();
    this.processedEventIds.clear();
  }

  private ensureResponse(): MutableResponse {
    if (!this.current) {
      throw new Error("Reducer received event before response_start");
    }
    return this.current;
  }

  private upsertOutputItem(item: OutputItem): void {
    const current = this.ensureResponse();
    const idx = current.output_items.findIndex((existing) => existing.id === item.id);
    if (idx >= 0) {
      current.output_items[idx] = item;
    } else {
      current.output_items.push(item);
    }
  }
}

```

```typescript
import { cloneDeep } from "../util/clone.js";
import {
  OutputItem,
  Response,
  ResponseSchema,
  StreamEvent,
} from "./schema.js";

type MutableResponse = Omit<Response, "output_items"> & {
  output_items: OutputItem[];
};

type ResponseStartPayload = Extract<
  StreamEvent["payload"],
  { type: "response_start" }
>;

type ItemBuffer = {
  id: string;
  type: OutputItem["type"];
  chunks: string[];
  meta: Record<string, unknown>;
};

export class ResponseReducer {
  private current: MutableResponse | undefined;
  private readonly itemBuffers = new Map<string, ItemBuffer>();
  private readonly processedEventIds = new Set<string>();

  apply(event: StreamEvent): Response | undefined {
    const payloadType = event.payload.type;

    if (payloadType === "response_start") {
      if (this.processedEventIds.has(event.event_id)) {
        return this.snapshot();
      }
      this.bootstrapResponse(event, event.payload);
      this.processedEventIds.add(event.event_id);
      return this.snapshot();
    }

    if (this.processedEventIds.has(event.event_id)) {
      return this.snapshot();
    }
    this.processedEventIds.add(event.event_id);

    let mutated = false;
    switch (payloadType) {
      case "item_start": {
        const buffer: ItemBuffer = {
          id: event.payload.item_id,
          type: event.payload.item_type,
          chunks: [],
          meta: {},
        };
        if (event.payload.initial_content) {
          buffer.chunks.push(event.payload.initial_content);
        }
        if (event.payload.name) buffer.meta.name = event.payload.name;
        if (event.payload.arguments) buffer.meta.arguments = event.payload.arguments;
        if (event.payload.code) buffer.meta.code = event.payload.code;
        this.itemBuffers.set(event.payload.item_id, buffer);
        this.refreshBufferedItem(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_delta": {
        const buf = this.itemBuffers.get(event.payload.item_id);
        if (buf) {
          buf.chunks.push(event.payload.delta_content);
          this.refreshBufferedItem(event.payload.item_id);
          mutated = true;
        }
        break;
      }

      case "item_done": {
        const finalItem = cloneDeep(event.payload.final_item);
        this.upsertOutputItem(finalItem);
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_error": {
        this.removeOutputItem(event.payload.item_id);
        this.upsertOutputItem({
          id: event.payload.item_id,
          type: "error",
          code: event.payload.error.code,
          message: event.payload.error.message,
          details: event.payload.error.details,
          origin: "system",
        });
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_cancelled": {
        this.removeOutputItem(event.payload.item_id);
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "usage_update": {
        const current = this.ensureResponse();
        current.usage = event.payload.usage;
        mutated = true;
        break;
      }

      case "response_done": {
        const current = this.ensureResponse();
        current.status = event.payload.status;
        current.finish_reason = event.payload.finish_reason;
        if (event.payload.usage) {
          current.usage = event.payload.usage;
        }
        mutated = true;
        break;
      }

      case "response_error": {
        const current = this.ensureResponse();
        current.status = "error";
        current.error = event.payload.error;
        mutated = true;
        break;
      }

      case "turn_aborted_by_user": {
        const current = this.ensureResponse();
        current.status = "aborted";
        current.finish_reason = event.payload.reason;
        mutated = true;
        break;
      }

      case "heartbeat":
      case "script_execution_start":
      case "script_execution_done":
      case "script_execution_error": {
        // These events carry operational metadata that does not directly mutate
        // the persisted response snapshot. We accept them for trace continuity.
        break;
      }
    }

    if (mutated && this.current) {
      this.current.updated_at = Math.max(this.current.updated_at, event.timestamp);
    }

    return this.snapshot();
  }

  snapshot(): Response | undefined {
    if (!this.current) return undefined;
    return ResponseSchema.parse(cloneDeep(this.current));
  }

  private bootstrapResponse(
    event: StreamEvent,
    payload: ResponseStartPayload,
  ): void {
    this.current = {
      id: payload.response_id,
      turn_id: payload.turn_id,
      thread_id: payload.thread_id,
      agent_id: payload.agent_id,
      model_id: payload.model_id,
      provider_id: payload.provider_id,
      created_at: payload.created_at,
      updated_at: event.timestamp,
      status: "in_progress",
      output_items: [],
      usage: undefined,
      finish_reason: null,
      error: undefined,
    };
    this.itemBuffers.clear();
    this.processedEventIds.clear();
  }

  private ensureResponse(): MutableResponse {
    if (!this.current) {
      throw new Error("Reducer received event before response_start");
    }
    return this.current;
  }

  private upsertOutputItem(item: OutputItem): void {
    const current = this.ensureResponse();
    const idx = current.output_items.findIndex((existing) => existing.id === item.id);
    if (idx >= 0) {
      current.output_items[idx] = item;
    } else {
      current.output_items.push(item);
    }
  }

  private removeOutputItem(itemId: string): void {
    if (!this.current) return;
    const idx = this.current.output_items.findIndex((existing) => existing.id === itemId);
    if (idx >= 0) {
      this.current.output_items.splice(idx, 1);
    }
  }

  private refreshBufferedItem(itemId: string): void {
    const buffer = this.itemBuffers.get(itemId);
    if (!buffer) return;

    if (buffer.type === "message" || buffer.type === "reasoning") {
      const origin =
        (buffer.meta.origin as "user" | "agent" | "system" | undefined) ?? "agent";
      this.upsertOutputItem({
        id: buffer.id,
        type: buffer.type,
        content: buffer.chunks.join(""),
        origin,
        correlation_id: buffer.meta.correlation_id as string | undefined,
      });
    }
  }
}

```

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  threads: defineTable({
    // External ID (UUIDv7) used in URLs
    externalId: v.string(),
    
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    userId: v.optional(v.string()),
    
    // Config snapshots
    modelProviderId: v.optional(v.string()),
    modelProviderApi: v.optional(v.string()),
    model: v.optional(v.string()),
    agentRole: v.optional(v.string()),
    
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_externalId", ["externalId"])
  .index("by_userId", ["userId"]),

  messages: defineTable({
    runId: v.string(),
    turnId: v.string(),
    threadId: v.string(),
    agentId: v.optional(v.string()),
    modelId: v.string(),
    providerId: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("in_progress"),
      v.literal("complete"),
      v.literal("error"),
      v.literal("aborted"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    outputItems: v.array(
      v.union(
        v.object({
          id: v.string(),
          type: v.literal("message"),
          content: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("reasoning"),
          content: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("function_call"),
          name: v.string(),
          arguments: v.string(),
          call_id: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("function_call_output"),
          call_id: v.string(),
          output: v.string(),
          success: v.boolean(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("script_execution"),
          code: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("script_execution_output"),
          script_id: v.string(),
          result: v.string(),
          success: v.boolean(),
          error: v.optional(
            v.object({
              code: v.string(),
              message: v.string(),
              stack: v.optional(v.string()),
            }),
          ),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("error"),
          code: v.string(),
          message: v.string(),
          details: v.optional(v.any()),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
      ),
    ),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      }),
    ),
    finishReason: v.optional(v.string()),
    error: v.optional(
      v.object({
        code: v.string(),
        message: v.string(),
        details: v.optional(v.any()),
      }),
    ),
  })
    .index("by_runId", ["runId"])
    .index("by_threadId", ["threadId"])
    .index("by_turnId", ["turnId"]),
});

```

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const statusValue = v.union(
  v.literal("queued"),
  v.literal("in_progress"),
  v.literal("complete"),
  v.literal("error"),
  v.literal("aborted"),
);

const outputItemValue = v.union(
  v.object({
    id: v.string(),
    type: v.literal("message"),
    content: v.string(),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("reasoning"),
    content: v.string(),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("function_call"),
    name: v.string(),
    arguments: v.string(),
    call_id: v.string(),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("function_call_output"),
    call_id: v.string(),
    output: v.string(),
    success: v.boolean(),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("script_execution"),
    code: v.string(),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("script_execution_output"),
    script_id: v.string(),
    result: v.string(),
    success: v.boolean(),
    error: v.optional(
      v.object({
        code: v.string(),
        message: v.string(),
        stack: v.optional(v.string()),
      }),
    ),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("error"),
    code: v.string(),
    message: v.string(),
    details: v.optional(v.any()),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
);

const usageValue = v.object({
  promptTokens: v.number(),
  completionTokens: v.number(),
  totalTokens: v.number(),
});

const errorValue = v.object({
  code: v.string(),
  message: v.string(),
  details: v.optional(v.any()),
});

export const persist = mutation({
  args: {
    runId: v.string(),
    turnId: v.string(),
    threadId: v.string(),
    agentId: v.optional(v.string()),
    modelId: v.string(),
    providerId: v.string(),
    status: statusValue,
    createdAt: v.number(),
    updatedAt: v.number(),
    outputItems: v.array(outputItemValue),
    usage: v.optional(usageValue),
    finishReason: v.optional(v.string()),
    error: v.optional(errorValue),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();

    if (!existing) {
      await ctx.db.insert("messages", {
        runId: args.runId,
        turnId: args.turnId,
        threadId: args.threadId,
        agentId: args.agentId,
        modelId: args.modelId,
        providerId: args.providerId,
        status: args.status,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
        outputItems: args.outputItems,
        usage: args.usage,
        finishReason: args.finishReason,
        error: args.error,
      });
      return;
    }

    await ctx.db.patch(existing._id, {
      turnId: args.turnId,
      threadId: args.threadId,
      agentId: args.agentId,
      modelId: args.modelId,
      providerId: args.providerId,
      status: args.status,
      updatedAt: args.updatedAt,
      outputItems: args.outputItems,
      usage: args.usage,
      finishReason: args.finishReason,
      error: args.error,
    });
  },
});

export const getByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("messages")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
  },
});

export const deleteByRunId = mutation({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

```

```typescript
import { ConvexHttpClient } from "convex/browser";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { api } from "../../../convex/_generated/api.js";
import { cloneDeep } from "../../util/clone.js";
import type { OutputItem, Response } from "../schema.js";

const tracer = trace.getTracer("codex.projector");

type PersistArgs = Parameters<typeof api.messages.persist>[0];

function transformOutputItem(item: OutputItem): PersistArgs["outputItems"][number] {
  return cloneDeep(item) as PersistArgs["outputItems"][number];
}

function transformResponse(response: Response): PersistArgs {
  return {
    runId: response.id,
    turnId: response.turn_id,
    threadId: response.thread_id,
    agentId: response.agent_id,
    modelId: response.model_id,
    providerId: response.provider_id,
    status: response.status,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    outputItems: response.output_items.map(transformOutputItem),
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
    finishReason: response.finish_reason ?? undefined,
    error: response.error
      ? {
          code: response.error.code,
          message: response.error.message,
          details: response.error.details,
        }
      : undefined,
  };
}

export class ConvexWriter {
  constructor(private readonly client: ConvexHttpClient) {}

  async persist(response: Response): Promise<void> {
    const payload = transformResponse(response);

    return tracer.startActiveSpan("convex.persist_response", async (span) => {
      span.setAttributes({
        "codex.run_id": response.id,
        "codex.thread_id": response.thread_id,
        "codex.turn_id": response.turn_id,
      });
      try {
        await this.client.mutation(api.messages.persist, payload);
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deleteByRunId(runId: string): Promise<void> {
    return tracer.startActiveSpan("convex.delete_response", async (span) => {
      span.setAttribute("codex.run_id", runId);
      try {
        await this.client.mutation(api.messages.deleteByRunId, { runId });
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}

```

```typescript
*** Begin Patch
*** Update File: cody-fastify/src/core/persistence/convex-writer.ts
@@
-import { ConvexHttpClient } from "convex/browser";
-import { SpanStatusCode, trace } from "@opentelemetry/api";
-import { api } from "../../../convex/_generated/api.js";
-import { cloneDeep } from "../../util/clone.js";
-import type { OutputItem, Response } from "../schema.js";
-
-const tracer = trace.getTracer("codex.projector");
-
-type PersistArgs = Parameters<typeof api.messages.persist>[0];
-
-function transformOutputItem(item: OutputItem): PersistArgs["outputItems"][number] {
-  return cloneDeep(item) as PersistArgs["outputItems"][number];
-}
-
-function transformResponse(response: Response): PersistArgs {
+import { ConvexHttpClient } from "convex/browser";
+import { SpanStatusCode, trace } from "@opentelemetry/api";
+import { api } from "../../../convex/_generated/api.js";
+import { cloneDeep } from "../../util/clone.js";
+import type { OutputItem, Response } from "../schema.js";
+
+const tracer = trace.getTracer("codex.projector");
+
+type ConvexPersistArgs = {
+  runId: string;
+  turnId: string;
+  threadId: string;
+  agentId?: string;
+  modelId: string;
+  providerId: string;
+  status: Response["status"];
+  createdAt: number;
+  updatedAt: number;
+  outputItems: OutputItem[];
+  usage?: {
+    promptTokens: number;
+    completionTokens: number;
+    totalTokens: number;
+  };
+  finishReason?: string;
+  error?: {
+    code: string;
+    message: string;
+    details?: unknown;
+  };
+};
+
+function transformOutputItem(item: OutputItem): OutputItem {
+  return cloneDeep(item);
+}
+
+function transformResponse(response: Response): ConvexPersistArgs {
   return {
     runId: response.id,
     turnId: response.turn_id,
     threadId: response.thread_id,
     agentId: response.agent_id,
@@
   }
 }
 
 export class ConvexWriter {
   constructor(private readonly client: ConvexHttpClient) {}
 
   async persist(response: Response): Promise<void> {
     const payload = transformResponse(response);
 
*** End Patch
```

```typescript
import { ConvexHttpClient } from "convex/browser";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { api } from "../../../convex/_generated/api.js";
import { cloneDeep } from "../../util/clone.js";
import type { OutputItem, Response } from "../schema.js";

const tracer = trace.getTracer("codex.projector");

type ConvexPersistArgs = {
  runId: string;
  turnId: string;
  threadId: string;
  agentId?: string;
  modelId: string;
  providerId: string;
  status: Response["status"];
  createdAt: number;
  updatedAt: number;
  outputItems: OutputItem[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

function transformOutputItem(item: OutputItem): OutputItem {
  return cloneDeep(item);
}

function transformResponse(response: Response): ConvexPersistArgs {
  return {
    runId: response.id,
    turnId: response.turn_id,
    threadId: response.thread_id,
    agentId: response.agent_id,
    modelId: response.model_id,
    providerId: response.provider_id,
    status: response.status,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    outputItems: response.output_items.map(transformOutputItem),
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
    finishReason: response.finish_reason ?? undefined,
    error: response.error
      ? {
          code: response.error.code,
          message: response.error.message,
          details: response.error.details,
        }
      : undefined,
  };
}

export class ConvexWriter {
  constructor(private readonly client: ConvexHttpClient) {}

  async persist(response: Response): Promise<void> {
    const payload = transformResponse(response);

    return tracer.startActiveSpan("convex.persist_response", async (span) => {
      span.setAttributes({
        "codex.run_id": response.id,
        "codex.thread_id": response.thread_id,
        "codex.turn_id": response.turn_id,
      });
      try {
        await this.client.mutation(api.messages.persist, payload);
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deleteByRunId(runId: string): Promise<void> {
    return tracer.startActiveSpan("convex.delete_response", async (span) => {
      span.setAttribute("codex.run_id", runId);
      try {
        await this.client.mutation(api.messages.deleteByRunId, { runId });
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}


```

```typescript
import { randomUUID } from "node:crypto";
import {
  StreamEvent,
  StreamEventSchema,
  streamKeyForRun,
} from "./schema.js";

type RedisClientLike = {
  xadd: (...args: Array<string | number | Buffer>) => Promise<string>;
  xread: (...args: Array<string | number | Buffer>) => Promise<unknown>;
  xreadgroup: (...args: Array<string | number | Buffer>) => Promise<unknown>;
  xgroup: (...args: Array<string | number | Buffer>) => Promise<unknown>;
  xack: (
    streamKey: string,
    groupName: string,
    ...ids: string[]
  ) => Promise<number>;
  xautoclaim: (
    streamKey: string,
    groupName: string,
    consumerName: string,
    minIdle: string | number,
    start: string,
    ...rest: Array<string | number>
  ) => Promise<unknown>;
  scan: (
    cursor: string,
    ...args: Array<string | number>
  ) => Promise<[string, string[]]>;
  del: (...args: Array<string | number>) => Promise<unknown>;
  quit?: () => Promise<void>;
  ping?: () => Promise<string>;
  on?: (event: string, handler: (err: Error) => void) => void;
};

export interface RedisStreamOptions {
  url?: string;
  approximateMaxLen?: number;
}

export interface RedisStreamRecord {
  id: string;
  event: StreamEvent;
}

export interface RedisStreamGroupRecord extends RedisStreamRecord {
  stream: string;
}

/**
  * Thin, typed wrapper around Bun's Redis client focused on Streams (XADD/XREAD).
  */
export class RedisStream {
  private readonly client: RedisClientLike;
  private readonly approximateMaxLen: number;

  constructor(client: RedisClientLike, opts?: RedisStreamOptions) {
    this.client = client;
    this.approximateMaxLen = opts?.approximateMaxLen ?? 1000;
  }

  static async connect(opts?: RedisStreamOptions): Promise<RedisStream> {
    const url =
      opts?.url ??
      process.env.REDIS_URL?.trim() ??
      "redis://127.0.0.1:6379";
    const client = await createRedisClient(url);
    return new RedisStream(client, opts);
  }

  async publish(event: StreamEvent): Promise<string> {
    const streamKey = streamKeyForRun(event.run_id);
    const payload = JSON.stringify(event);
    const id = await this.client.xadd(
      streamKey,
      "MAXLEN",
      "~",
      String(this.approximateMaxLen),
      "*",
      "event",
      payload,
    );
    return id;
  }

  /**
   * Read from a stream, defaulting to blocking for up to blockMs.
   * fromId: use "0-0" for full history, or "$" for new messages only.
   */
  async read(
    streamKey: string,
    fromId = "0-0",
    blockMs = 5000,
    count = 50,
  ): Promise<RedisStreamRecord[]> {
    const raw = await this.client.xread(
      "COUNT",
      String(count),
      "BLOCK",
      String(blockMs),
      "STREAMS",
      streamKey,
      fromId,
    );
    const parsed = this.parseXReadRaw(raw, streamKey);
    return parsed.map(({ id, event }) => ({ id, event }));
  }

  async ensureGroup(
    streamKey: string,
    groupName: string,
    startId = "0-0",
  ): Promise<void> {
    try {
      await this.client.xgroup(
        "CREATE",
        streamKey,
        groupName,
        startId,
        "MKSTREAM",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("BUSYGROUP") ||
          error.message.includes("BUSYGROUP"))
      ) {
        return;
      }
      throw error;
    }
  }

  async readGroup(
    streamKeys: string[],
    groupName: string,
    consumerName: string,
    fromIds: string[],
    blockMs = 5000,
    count = 50,
  ): Promise<RedisStreamGroupRecord[]> {
    if (!streamKeys.length) return [];
    const ids =
      fromIds.length === streamKeys.length
        ? fromIds
        : new Array(streamKeys.length).fill(">");

    const raw = await this.client.xreadgroup(
      "GROUP",
      groupName,
      consumerName,
      "COUNT",
      String(count),
      "BLOCK",
      String(blockMs),
      "STREAMS",
      ...streamKeys,
      ...ids,
    );
    return this.parseXReadRaw(raw);
  }

  async ack(
    streamKey: string,
    groupName: string,
    ...ids: string[]
  ): Promise<number> {
    if (!ids.length) return 0;
    return this.client.xack(streamKey, groupName, ...ids);
  }

  async autoClaim(
    streamKey: string,
    groupName: string,
    consumerName: string,
    minIdleMs: number,
    count = 25,
    startId = "0-0",
  ): Promise<RedisStreamGroupRecord[]> {
    const result = await this.client.xautoclaim(
      streamKey,
      groupName,
      consumerName,
      String(minIdleMs),
      startId,
      "COUNT",
      String(count),
    );

    if (!Array.isArray(result)) return [];
    const entries = result[1];
    return this.parseClaimEntries(streamKey, entries);
  }

  async scanStreams(
    pattern: string,
    cursor = "0",
    count = 50,
  ): Promise<{ cursor: string; keys: string[] }> {
    const [nextCursor, keys] = await this.client.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      String(count),
    );
    return {
      cursor: nextCursor,
      keys: Array.isArray(keys) ? keys : [],
    };
  }

  async deleteStream(streamKey: string): Promise<void> {
    await this.client.del(streamKey);
  }

  async ping(): Promise<string | undefined> {
    if (typeof this.client.ping === "function") {
      return this.client.ping();
    }
    return undefined;
  }

  async close(): Promise<void> {
    if (typeof this.client.quit === "function") {
      await this.client.quit();
    }
  }

  private parseXReadRaw(
    raw: unknown,
    knownStream?: string,
  ): Array<{ stream: string; id: string; event: StreamEvent }> {
    if (!Array.isArray(raw)) return [];
    const records: Array<{ stream: string; id: string; event: StreamEvent }> =
      [];
    for (const streamEntry of raw) {
      if (!Array.isArray(streamEntry) || streamEntry.length < 2) continue;
      const streamKey =
        typeof streamEntry[0] === "string" ? streamEntry[0] : knownStream;
      if (!streamKey) continue;
      const entries = streamEntry[1];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const [id, fields] = entry as [unknown, unknown];
        if (typeof id !== "string" || !Array.isArray(fields)) continue;
        for (let i = 0; i < fields.length; i += 2) {
          const field = fields[i];
          const value = fields[i + 1];
          if (field !== "event" || typeof value !== "string") continue;
          const parsed = this.safeParseEvent(value);
          if (parsed) {
            records.push({ stream: streamKey, id, event: parsed });
          }
        }
      }
    }
    return records;
  }

  private parseClaimEntries(
    streamKey: string,
    entries: unknown,
  ): RedisStreamGroupRecord[] {
    if (!Array.isArray(entries)) return [];
    const results: RedisStreamGroupRecord[] = [];
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const [id, fields] = entry as [unknown, unknown];
      if (typeof id !== "string" || !Array.isArray(fields)) continue;
      for (let i = 0; i < fields.length; i += 2) {
        const field = fields[i];
        const value = fields[i + 1];
        if (field !== "event" || typeof value !== "string") continue;
        const parsed = this.safeParseEvent(value);
        if (parsed) {
          results.push({ stream: streamKey, id, event: parsed });
        }
      }
    }
    return results;
  }

  private safeParseEvent(serialized: string): StreamEvent | undefined {
    try {
      const candidate = JSON.parse(serialized);
      return StreamEventSchema.parse(candidate);
    } catch (err) {
      const stub: StreamEvent = {
        event_id: randomUUID(),
        timestamp: Date.now(),
        trace_context: { traceparent: "00-" + randomUUID().replace(/-/g, "").padEnd(32, "0") + "-0000000000000000-00" },
        run_id: randomUUID(),
        type: "response_error",
        payload: {
          type: "response_error",
          response_id: randomUUID(),
          error: {
            code: "STREAM_PARSE_ERROR",
            message:
              err instanceof Error ? err.message : "Unknown parse error",
          },
        },
      };
      return stub;
    }
  }
}

async function createRedisClient(url: string): Promise<RedisClientLike> {
  const IORedis = (await import("ioredis")).default;
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // fail fast
    reconnectOnError: () => false,
    lazyConnect: false,
  });

  // Surface connection errors instead of silent event spam
  client.on?.("error", (err: Error) => {
    throw err;
  });

  await client.ping();
  return client as unknown as RedisClientLike;
}

```

```typescript
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { ConvexHttpClient } from "convex/browser";
import {
  ROOT_CONTEXT,
  SpanStatusCode,
  propagation,
  trace,
} from "@opentelemetry/api";
import { ConvexWriter } from "../core/persistence/convex-writer.js";
import { RedisStream, type RedisStreamGroupRecord } from "../core/redis.js";
import { ResponseReducer } from "../core/reducer.js";
import { REDIS_STREAM_KEY_PREFIX } from "../core/schema.js";

const tracer = trace.getTracer("codex.projector");

export interface PersistenceWorkerOptions {
  redisUrl?: string;
  convexUrl?: string;
  groupName?: string;
  consumerName?: string;
  streamPattern?: string;
  discoveryIntervalMs?: number;
  scanCount?: number;
  blockMs?: number;
  batchSize?: number;
  reclaimIntervalMs?: number;
  reclaimMinIdleMs?: number;
}

const DEFAULT_GROUP_NAME = "codex-projector-group";

export class PersistenceWorker {
  private readonly groupName: string;
  private readonly consumerName: string;
  private readonly streamPattern: string;
  private readonly options: Required<
    Pick<
      PersistenceWorkerOptions,
      | "discoveryIntervalMs"
      | "scanCount"
      | "blockMs"
      | "batchSize"
      | "reclaimIntervalMs"
      | "reclaimMinIdleMs"
    >
  >;

  private redis: RedisStream | undefined;
  private convexWriter: ConvexWriter | undefined;
  private running = false;
  private joinPromise: Promise<void> | undefined;
  private readonly reducers = new Map<string, ResponseReducer>();
  private readonly streams = new Set<string>();
  private readonly streamOffsets = new Map<string, string>();
  private discoveryCursor = "0";

  constructor(private readonly config: PersistenceWorkerOptions = {}) {
    this.groupName = config.groupName ?? DEFAULT_GROUP_NAME;
    this.consumerName =
      config.consumerName ?? `projector-${process.pid}-${randomUUID()}`;
    this.streamPattern =
      config.streamPattern ?? `${REDIS_STREAM_KEY_PREFIX}:*:events`;
    this.options = {
      discoveryIntervalMs: config.discoveryIntervalMs ?? 1500,
      scanCount: config.scanCount ?? 100,
      blockMs: config.blockMs ?? 5000,
      batchSize: config.batchSize ?? 50,
      reclaimIntervalMs: config.reclaimIntervalMs ?? 15000,
      reclaimMinIdleMs: config.reclaimMinIdleMs ?? 60000,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;

    const convexUrl =
      this.config.convexUrl ?? process.env.CONVEX_URL?.trim() ?? "";
    if (!convexUrl) {
      throw new Error("CONVEX_URL is required to run persistence worker");
    }

    this.redis = await RedisStream.connect({ url: this.config.redisUrl });
    this.convexWriter = new ConvexWriter(new ConvexHttpClient(convexUrl));
    this.running = true;

    await this.fullDiscoveryCycle();

    const consume = this.consumeLoop();
    const discover = this.discoveryLoop();
    const reclaim = this.reclaimLoop();
    this.joinPromise = Promise.all([consume, discover, reclaim]).then(() => {});
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.joinPromise;
    await this.redis?.close();
    this.redis = undefined;
    this.convexWriter = undefined;
    this.reducers.clear();
    this.streams.clear();
    this.streamOffsets.clear();
    this.discoveryCursor = "0";
  }

  async join(): Promise<void> {
    await this.joinPromise;
  }

  private async discoveryLoop(): Promise<void> {
    while (this.running) {
      await sleep(this.options.discoveryIntervalMs);
      if (!this.running) break;
      try {
        await this.discoverOnce();
      } catch (error) {
        console.error("[projector] discovery error", error);
      }
    }
  }

  private async reclaimLoop(): Promise<void> {
    while (this.running) {
      await sleep(this.options.reclaimIntervalMs);
      if (!this.running) break;
      const redis = this.redis;
      if (!redis) continue;
      for (const stream of this.streams) {
        if (!this.running) break;
        try {
          const records = await redis.autoClaim(
            stream,
            this.groupName,
            this.consumerName,
            this.options.reclaimMinIdleMs,
          );
          if (!records.length) continue;
          for (const record of records) {
            await this.processAndAck(record);
            if (!this.running) break;
          }
        } catch (error) {
          console.error("[projector] auto-claim error", error);
        }
      }
    }
  }

  private async consumeLoop(): Promise<void> {
    while (this.running) {
      const redis = this.redis;
      if (!redis) break;
      if (!this.streams.size) {
        await sleep(250);
        continue;
      }

      const streams = Array.from(this.streams);
      const offsets = streams.map((stream) =>
        this.streamOffsets.get(stream) ?? ">",
      );

      try {
        const records = await redis.readGroup(
          streams,
          this.groupName,
          this.consumerName,
          offsets,
          this.options.blockMs,
          this.options.batchSize,
        );

        for (const stream of streams) {
          this.streamOffsets.set(stream, ">");
        }

        if (!records.length) {
          continue;
        }

        for (const record of records) {
          await this.processAndAck(record);
          if (!this.running) break;
        }
      } catch (error) {
        console.error("[projector] readGroup error", error);
        await sleep(1000);
      }
    }
  }

  private async processAndAck(record: RedisStreamGroupRecord): Promise<void> {
    const redis = this.redis;
    if (!redis) return;
    try {
      await this.processRecord(record);
      await redis.ack(record.stream, this.groupName, record.id);
    } catch (error) {
      console.error("[projector] failed to process event", error);
      // Leave message pending so it can be reclaimed later.
    }
  }

  private async processRecord(record: RedisStreamGroupRecord): Promise<void> {
    const writer = this.convexWriter;
    if (!writer) {
      throw new Error("Convex writer not initialized");
    }

    const runId = record.event.run_id;
    const reducer = this.ensureReducer(runId);
    const carrier = {
      traceparent: record.event.trace_context.traceparent,
      ...(record.event.trace_context.tracestate
        ? { tracestate: record.event.trace_context.tracestate }
        : {}),
    };
    const parentCtx = propagation.extract(ROOT_CONTEXT, carrier);

    await tracer.startActiveSpan(
      `projector.${record.event.payload.type}`,
      {
        attributes: {
          "codex.run_id": runId,
          "codex.stream_key": record.stream,
          "codex.event_id": record.id,
          "codex.event_type": record.event.payload.type,
        },
      },
      parentCtx,
      async (span) => {
        try {
          const snapshot = reducer.apply(record.event);
          if (snapshot) {
            await writer.persist(snapshot);
          }
          if (
            record.event.payload.type === "response_done" ||
            record.event.payload.type === "response_error"
          ) {
            this.reducers.delete(runId);
            this.streams.delete(record.stream);
            this.streamOffsets.delete(record.stream);
          }
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private ensureReducer(runId: string): ResponseReducer {
    let reducer = this.reducers.get(runId);
    if (!reducer) {
      reducer = new ResponseReducer();
      this.reducers.set(runId, reducer);
    }
    return reducer;
  }

  private async discoverOnce(): Promise<void> {
    const redis = this.redis;
    if (!redis) return;
    const { cursor, keys } = await redis.scanStreams(
      this.streamPattern,
      this.discoveryCursor,
      this.options.scanCount,
    );
    this.discoveryCursor = cursor;
    for (const key of keys) {
      if (!this.streams.has(key)) {
        await redis.ensureGroup(key, this.groupName);
        this.streams.add(key);
        this.streamOffsets.set(key, "0");
      }
    }
  }

  private async fullDiscoveryCycle(): Promise<void> {
    this.discoveryCursor = "0";
    do {
      await this.discoverOnce();
    } while (this.running && this.discoveryCursor !== "0");
  }
}

```

```typescript
/* eslint-disable no-console */
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { ConvexHttpClient } from "convex/browser";
import { OpenAIStreamAdapter } from "../src/core/adapters/openai-adapter.js";
import { RedisStream } from "../src/core/redis.js";
import { initObservability } from "../src/core/observability.js";
import { streamKeyForRun, type StreamEvent } from "../src/core/schema.js";
import { ResponseReducer } from "../src/core/reducer.js";
import { PersistenceWorker } from "../src/workers/persistence-worker.js";
import { api } from "../convex/_generated/api.js";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to run verify_pipeline");
  }

  const convexUrl = process.env.CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("CONVEX_URL is required to verify pipeline persistence");
  }

  initObservability({ serviceName: "core2-verify" });

  const model =
    process.env.CORE2_MODEL ??
    process.env.OPENAI_MODEL ??
    "gpt-5-mini"; // aligns with requested default

  const redis = await RedisStream.connect();
  await redis.ping().catch(() => {
    console.warn("[warn] Redis ping failed; continuing anyway");
  });

  const adapter = new OpenAIStreamAdapter({
    model,
    apiKey,
    redis,
  });

  const runId = randomUUID();
  const turnId = randomUUID();
  const threadId = randomUUID();
  const prompt = "Hello world, explain quantum physics in one sentence.";
  const streamKey = streamKeyForRun(runId);

  const worker = new PersistenceWorker({
    redisUrl: process.env.REDIS_URL,
    convexUrl,
  });
  await worker.start();

  const convex = new ConvexHttpClient(convexUrl);

  console.log("trace: starting pipeline");

  try {
    const tailPromise = tailStream(
      redis,
      streamKey,
      process.env.SHOW_SNAPSHOT === "1",
    );

    await adapter.stream({
      prompt,
      runId,
      turnId,
      threadId,
    });

    await tailPromise;

    const persisted = await waitForRunSnapshot(convex, runId, 45000);
    console.log("trace: convex snapshot stored", {
      runId,
      status: persisted.status,
      outputItems: persisted.outputItems.length,
    });
  } finally {
    await worker.stop();
    await convex.mutation(api.messages.deleteByRunId, { runId }).catch(() => undefined);
    await redis.deleteStream(streamKey).catch(() => undefined);
    await redis.close();
  }

  console.log("trace: verification complete");
}

async function tailStream(redis: RedisStream, streamKey: string, showSnapshot: boolean) {
  let lastId = "0-0";
  let done = false;
  const reducer = showSnapshot ? new ResponseReducer() : undefined;
  while (!done) {
    const entries = await redis.read(streamKey, lastId, 5000, 50);
    if (!entries.length) {
      continue;
    }

    for (const entry of entries) {
      lastId = entry.id;
      const ev = entry.event;
      logEvent(ev);
      reducer?.apply(ev);
      if (ev.payload.type === "response_done") {
        done = true;
      }
    }
  }
  if (reducer) {
    const snapshot = reducer.snapshot();
    if (snapshot) {
      console.log("=== FINAL SNAPSHOT ===");
      console.log(JSON.stringify(snapshot, null, 2));
    }
  }
}

function logEvent(event: StreamEvent) {
  console.log(
    JSON.stringify(
      {
        id: event.event_id,
        type: event.payload.type,
        payload: event.payload,
        traceparent: event.trace_context.traceparent,
      },
      null,
      2,
    ),
  );
}

async function waitForRunSnapshot(
  convex: ConvexHttpClient,
  runId: string,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await convex
      .query(api.messages.getByRunId, { runId })
      .catch(() => undefined);
    if (doc) return doc;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for Convex snapshot for run ${runId}`);
}

void main().catch((err) => {
  console.error("[error] verify_pipeline failed:", err);
  process.exit(1);
});

```

```typescript
/* eslint-disable no-console */
import { initObservability } from "../core/observability.js";
import { PersistenceWorker } from "./persistence-worker.js";

async function main() {
  initObservability({ serviceName: "core2-projector" });

  const worker = new PersistenceWorker({
    redisUrl: process.env.REDIS_URL,
    convexUrl: process.env.CONVEX_URL,
  });

  await worker.start();
  console.log("[projector] worker started");

  await new Promise<void>((resolve) => {
    let stopping = false;
    const shutdown = async (signal: NodeJS.Signals) => {
      if (stopping) return;
      stopping = true;
      console.log(`[projector] received ${signal}, stopping...`);
      await worker.stop();
      resolve();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

  console.log("[projector] worker stopped");
}

void main().catch((error) => {
  console.error("[projector] fatal error", error);
  process.exit(1);
});

```

```json
{
  "name": "cody-fastify",
  "version": "0.1.0",
  "description": "Fastify boilerplate with health check and Playwright smoke test",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/server.ts",
    "start": "bun src/server.ts",
    "build": "tsc --noEmit",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\" \"tests/**/*.ts\"",
    "test:e2e": "PW_TEST_HTML_REPORT_OPEN=never playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report",
    "verify:pipeline": "bun run scripts/verify_pipeline.ts",
    "run:projector": "bun run src/workers/run_projector.ts",
    "run:projector:convex": "bun run src/workers/run_projector.ts"
  },
  "dependencies": {
    "@fastify/cors": "^11.1.0",
    "@fastify/static": "^8.0.1",
    "@traceloop/node-server-sdk": "^0.20.1",
    "codex-ts": "workspace:*",
    "convex": "^1.29.2",
    "fastify": "^5.2.0",
    "fastify-type-provider-zod": "^6.0.0",
    "ioredis": "^5.8.2",
    "ioredis-mock": "^8.13.1",
    "zod": "^4.1.5"
  },
  "devDependencies": {
    "@playwright/test": "^1.56.1",
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "bun-types": "^1.3.1",
    "dotenv": "^17.2.3",
    "eslint": "^8.55.0",
    "eslint-config-prettier": "^10.1.8",
    "prettier": "^3.6.2",
    "typescript": "^5.3.3"
  },
  "engines": {
    "bun": ">=1.0.0"
  }
}

```

```json
{
  "name": "cody-fastify",
  "version": "0.1.0",
  "description": "Fastify boilerplate with health check and Playwright smoke test",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/server.ts",
    "start": "bun src/server.ts",
    "build": "tsc --noEmit",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\" \"tests/**/*.ts\"",
    "test:e2e": "PW_TEST_HTML_REPORT_OPEN=never playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report",
    "verify:pipeline": "bun run scripts/verify_pipeline.ts",
    "run:projector": "bun run src/workers/run_projector.ts",
    "run:projector:convex": "bun run src/workers/run_projector.ts"
  },
  "dependencies": {
    "@fastify/cors": "^11.1.0",
    "@fastify/static": "^8.0.1",
    "@opentelemetry/api": "^1.9.0",
    "@traceloop/node-server-sdk": "^0.20.1",
    "codex-ts": "workspace:*",
    "convex": "^1.29.2",
    "fastify": "^5.2.0",
    "fastify-type-provider-zod": "^6.0.0",
    "ioredis": "^5.8.2",
    "ioredis-mock": "^8.13.1",
    "zod": "^4.1.5"
  },
  "devDependencies": {
    "@playwright/test": "^1.56.1",
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "bun-types": "^1.3.1",
    "dotenv": "^17.2.3",
    "eslint": "^8.55.0",
    "eslint-config-prettier": "^10.1.8",
    "prettier": "^3.6.2",
    "typescript": "^5.3.3"
  },
  "engines": {
    "bun": ">=1.0.0"
  }
}

```

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  threads: defineTable({
    // External ID (UUIDv7) used in URLs
    externalId: v.string(),
    
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    userId: v.optional(v.string()),
    
    // Config snapshots
    modelProviderId: v.optional(v.string()),
    modelProviderApi: v.optional(v.string()),
    model: v.optional(v.string()),
    agentRole: v.optional(v.string()),
    
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_externalId", ["externalId"])
  .index("by_userId", ["userId"]),

  messages: defineTable({
    runId: v.string(),
    turnId: v.string(),
    threadId: v.string(),
    agentId: v.optional(v.string()),
    modelId: v.string(),
    providerId: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("in_progress"),
      v.literal("complete"),
      v.literal("error"),
      v.literal("aborted"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    outputItems: v.array(
      v.union(
        v.object({
          id: v.string(),
          type: v.literal("message"),
          content: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("reasoning"),
          content: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("function_call"),
          name: v.string(),
          arguments: v.string(),
          call_id: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("function_call_output"),
          call_id: v.string(),
          output: v.string(),
          success: v.boolean(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("script_execution"),
          code: v.string(),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("script_execution_output"),
          script_id: v.string(),
          result: v.string(),
          success: v.boolean(),
          error: v.optional(
            v.object({
              code: v.string(),
              message: v.string(),
              stack: v.optional(v.string()),
            }),
          ),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
        v.object({
          id: v.string(),
          type: v.literal("error"),
          code: v.string(),
          message: v.string(),
          details: v.optional(v.any()),
          origin: v.string(),
          correlation_id: v.optional(v.string()),
        }),
      ),
    ),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      }),
    ),
    finishReason: v.optional(v.string()),
    error: v.optional(
      v.object({
        code: v.string(),
        message: v.string(),
        details: v.optional(v.any()),
      }),
    ),
  })
    .index("by_runId", ["runId"])
    .index("by_threadId", ["threadId"])
    .index("by_turnId", ["turnId"]),

  legacyMessages: defineTable({
    threadId: v.id("threads"),
    role: v.string(),
    content: v.string(),
    turnId: v.optional(v.string()),
    type: v.optional(v.string()),
    callId: v.optional(v.string()),
    toolName: v.optional(v.string()),
    toolArgs: v.optional(v.any()),
    toolOutput: v.optional(v.any()),
    status: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_callId", ["callId"]),
});

```

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const statusValue = v.union(
  v.literal("queued"),
  v.literal("in_progress"),
  v.literal("complete"),
  v.literal("error"),
  v.literal("aborted"),
);

const outputItemValue = v.union(
  v.object({
    id: v.string(),
    type: v.literal("message"),
    content: v.string(),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("reasoning"),
    content: v.string(),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("function_call"),
    name: v.string(),
    arguments: v.string(),
    call_id: v.string(),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("function_call_output"),
    call_id: v.string(),
    output: v.string(),
    success: v.boolean(),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("script_execution"),
    code: v.string(),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("script_execution_output"),
    script_id: v.string(),
    result: v.string(),
    success: v.boolean(),
    error: v.optional(
      v.object({
        code: v.string(),
        message: v.string(),
        stack: v.optional(v.string()),
      }),
    ),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("error"),
    code: v.string(),
    message: v.string(),
    details: v.optional(v.any()),
    origin: v.string(),
    correlation_id: v.optional(v.string()),
  }),
);

const usageValue = v.object({
  promptTokens: v.number(),
  completionTokens: v.number(),
  totalTokens: v.number(),
});

const errorValue = v.object({
  code: v.string(),
  message: v.string(),
  details: v.optional(v.any()),
});

export const add = mutation({
  args: {
    conversationId: v.string(),
    role: v.string(),
    content: v.string(),
    turnId: v.optional(v.string()),
    type: v.optional(v.string()),
    callId: v.optional(v.string()),
    toolName: v.optional(v.string()),
    toolArgs: v.optional(v.any()),
    toolOutput: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.conversationId))
      .unique();

    if (!thread) {
      throw new Error(`Thread not found: ${args.conversationId}`);
    }

    await ctx.db.insert("legacyMessages", {
      threadId: thread._id,
      role: args.role,
      content: args.content,
      turnId: args.turnId,
      type: args.type ?? "message",
      callId: args.callId,
      toolName: args.toolName,
      toolArgs: args.toolArgs,
      toolOutput: args.toolOutput,
      status: args.status,
      createdAt: Date.now(),
    });

    await ctx.db.patch(thread._id, { updatedAt: Date.now() });
  },
});

export const list = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("legacyMessages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .collect();
  },
});

export const persist = mutation({
  args: {
    runId: v.string(),
    turnId: v.string(),
    threadId: v.string(),
    agentId: v.optional(v.string()),
    modelId: v.string(),
    providerId: v.string(),
    status: statusValue,
    createdAt: v.number(),
    updatedAt: v.number(),
    outputItems: v.array(outputItemValue),
    usage: v.optional(usageValue),
    finishReason: v.optional(v.string()),
    error: v.optional(errorValue),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();

    if (!existing) {
      await ctx.db.insert("messages", {
        runId: args.runId,
        turnId: args.turnId,
        threadId: args.threadId,
        agentId: args.agentId,
        modelId: args.modelId,
        providerId: args.providerId,
        status: args.status,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
        outputItems: args.outputItems,
        usage: args.usage,
        finishReason: args.finishReason,
        error: args.error,
      });
      return;
    }

    await ctx.db.patch(existing._id, {
      turnId: args.turnId,
      threadId: args.threadId,
      agentId: args.agentId,
      modelId: args.modelId,
      providerId: args.providerId,
      status: args.status,
      updatedAt: args.updatedAt,
      outputItems: args.outputItems,
      usage: args.usage,
      finishReason: args.finishReason,
      error: args.error,
    });
  },
});

export const getByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("messages")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
  },
});

export const deleteByRunId = mutation({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

```

```typescript
import { cloneDeep } from "../util/clone.js";
import {
  OutputItem,
  Response,
  ResponseSchema,
  StreamEvent,
} from "./schema.js";

type MutableResponse = Omit<Response, "output_items"> & {
  output_items: OutputItem[];
};

type ResponseStartPayload = Extract<
  StreamEvent["payload"],
  { type: "response_start" }
>;

type ItemBuffer = {
  id: string;
  type: OutputItem["type"];
  chunks: string[];
  meta: Record<string, unknown>;
};

export class ResponseReducer {
  private current: MutableResponse | undefined;
  private readonly itemBuffers = new Map<string, ItemBuffer>();
  private readonly processedEventIds = new Set<string>();

  apply(event: StreamEvent): Response | undefined {
    const payloadType = event.payload.type;

    if (payloadType === "response_start") {
      if (this.processedEventIds.has(event.event_id)) {
        return this.snapshot();
      }
      this.bootstrapResponse(event, event.payload);
      this.processedEventIds.add(event.event_id);
      return this.snapshot();
    }

    if (this.processedEventIds.has(event.event_id)) {
      return this.snapshot();
    }
    this.processedEventIds.add(event.event_id);

    let mutated = false;
    switch (payloadType) {
      case "item_start": {
        const buffer: ItemBuffer = {
          id: event.payload.item_id,
          type: event.payload.item_type,
          chunks: [],
          meta: {},
        };
        if (event.payload.initial_content) {
          buffer.chunks.push(event.payload.initial_content);
        }
        if (event.payload.name) buffer.meta.name = event.payload.name;
        if (event.payload.arguments) buffer.meta.arguments = event.payload.arguments;
        if (event.payload.code) buffer.meta.code = event.payload.code;
        this.itemBuffers.set(event.payload.item_id, buffer);
        this.refreshBufferedItem(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_delta": {
        const buf = this.itemBuffers.get(event.payload.item_id);
        if (buf) {
          buf.chunks.push(event.payload.delta_content);
          this.refreshBufferedItem(event.payload.item_id);
          mutated = true;
        }
        break;
      }

      case "item_done": {
        const finalItem = cloneDeep(event.payload.final_item);
        this.upsertOutputItem(finalItem);
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_error": {
        this.removeOutputItem(event.payload.item_id);
        this.upsertOutputItem({
          id: event.payload.item_id,
          type: "error",
          code: event.payload.error.code,
          message: event.payload.error.message,
          details: event.payload.error.details,
          origin: "system",
        });
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_cancelled": {
        this.removeOutputItem(event.payload.item_id);
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "usage_update": {
        const current = this.ensureResponse();
        current.usage = event.payload.usage;
        mutated = true;
        break;
      }

      case "response_done": {
        const current = this.ensureResponse();
        current.status = event.payload.status;
        current.finish_reason = event.payload.finish_reason;
        if (event.payload.usage) {
          current.usage = event.payload.usage;
        }
        mutated = true;
        break;
      }

      case "response_error": {
        const current = this.ensureResponse();
        current.status = "error";
        current.error = event.payload.error;
        mutated = true;
        break;
      }

      case "turn_aborted_by_user": {
        const current = this.ensureResponse();
        current.status = "aborted";
        current.finish_reason = event.payload.reason;
        mutated = true;
        break;
      }

      case "heartbeat":
      case "script_execution_start":
      case "script_execution_done":
      case "script_execution_error": {
        // These events carry operational metadata that does not directly mutate
        // the persisted response snapshot. We accept them for trace continuity.
        break;
      }
    }

    if (mutated && this.current) {
      this.current.updated_at = Math.max(this.current.updated_at, event.timestamp);
    }

    return this.snapshot();
  }

  snapshot(): Response | undefined {
    if (!this.current) return undefined;
    return ResponseSchema.parse(cloneDeep(this.current));
  }

  private bootstrapResponse(
    event: StreamEvent,
    payload: ResponseStartPayload,
  ): void {
    this.current = {
      id: payload.response_id,
      turn_id: payload.turn_id,
      thread_id: payload.thread_id,
      agent_id: payload.agent_id,
      model_id: payload.model_id,
      provider_id: payload.provider_id,
      created_at: payload.created_at,
      updated_at: event.timestamp,
      status: "in_progress",
      output_items: [],
      usage: undefined,
      finish_reason: null,
      error: undefined,
    };
    this.itemBuffers.clear();
    this.processedEventIds.clear();
  }

  private ensureResponse(): MutableResponse {
    if (!this.current) {
      throw new Error("Reducer received event before response_start");
    }
    return this.current;
  }

  private upsertOutputItem(item: OutputItem): void {
    const current = this.ensureResponse();
    const idx = current.output_items.findIndex((existing) => existing.id === item.id);
    if (idx >= 0) {
      current.output_items[idx] = item;
    } else {
      current.output_items.push(item);
    }
  }

  private removeOutputItem(itemId: string): void {
    if (!this.current) return;
    const idx = this.current.output_items.findIndex((existing) => existing.id === itemId);
    if (idx >= 0) {
      this.current.output_items.splice(idx, 1);
    }
  }

  private refreshBufferedItem(itemId: string): void {
    const buffer = this.itemBuffers.get(itemId);
    if (!buffer) return;

    if (buffer.type === "message") {
      const origin =
        (buffer.meta.origin as "user" | "agent" | "system" | undefined) ?? "agent";
      this.upsertOutputItem({
        id: buffer.id,
        type: "message",
        content: buffer.chunks.join(""),
        origin,
        correlation_id: buffer.meta.correlation_id as string | undefined,
      });
      return;
    }

    if (buffer.type === "reasoning") {
      const origin =
        (buffer.meta.origin as "agent" | "system" | undefined) ?? "agent";
      this.upsertOutputItem({
        id: buffer.id,
        type: "reasoning",
        content: buffer.chunks.join(""),
        origin,
        correlation_id: buffer.meta.correlation_id as string | undefined,
      });
    }
  }
}

```

```typescript
import type { FastifyRequest, FastifyReply } from "fastify";
import type { TurnQueryParams, TurnStatusResponse } from "../schemas/turn.js";
import { NotFoundError } from "../errors/api-errors.js";
import { clientStreamManager } from "../client-stream/client-stream-manager.js";
import type { CodexRuntime } from "../services/codex-runtime.js";
import type {
  ClientEvent,
  StoredEvent,
  StreamMessage,
  TurnRecord,
} from "../types/turns.js";
import type { ResponseItem } from "codex-ts/src/protocol/models.ts";

export function buildTurnHandlers(_codexRuntime: CodexRuntime) {
  return {
    async getStatus(
      req: FastifyRequest<{
        Params: { id: string };
        Querystring: TurnQueryParams;
      }>,
      reply: FastifyReply,
    ): Promise<void> {
      const turnId = req.params.id;
      const turn = await clientStreamManager.getTurn(turnId);

      if (!turn) {
        throw new NotFoundError(`Turn ${turnId} not found`);
      }

      // Build response based on query params
      const thinkingLevel = req.query.thinkingLevel;
      const toolLevel = req.query.toolLevel;

      const response: TurnStatusResponse = {
        turnId: turn.turnId,
        conversationId: turn.conversationId,
        status: turn.status,
        startedAt: turn.startedAt,
        completedAt: turn.completedAt,
      };

      // Include result if present
      if (turn.result) {
        response.result = turn.result;
      }

      // Include thinking based on thinkingLevel
      if (thinkingLevel !== "none") {
        response.thinking = turn.thinking;
      } else {
        response.thinking = [];
      }

      // Include toolCalls based on toolLevel
      if (toolLevel === "full") {
        response.toolCalls = turn.toolCalls;
      } else {
        response.toolCalls = [];
      }

      // Include model provider info if available
      if (turn.modelProviderId) {
        response.modelProviderId = turn.modelProviderId;
      }
      if (turn.modelProviderApi) {
        response.modelProviderApi = turn.modelProviderApi;
      }
      if (turn.model) {
        response.model = turn.model;
      }

      reply.code(200).send(response);
    },

    async streamEvents(
      req: FastifyRequest<{
        Params: { id: string };
        Querystring: TurnQueryParams;
      }>,
      reply: FastifyReply,
    ): Promise<void> {
      const turnId = req.params.id;
      const turn = await clientStreamManager.getTurn(turnId);

      if (!turn) {
        throw new NotFoundError(`Turn ${turnId} not found`);
      }

      // Parse Last-Event-ID header if present
      const lastEventIdHeader = req.headers["last-event-id"];
      const fromEventId = parseLastEventId(lastEventIdHeader);

      // Get query params
      const thinkingLevel = req.query.thinkingLevel;
      const toolLevel = req.query.toolLevel;
      const thinkingFormat =
        req.query.thinkingFormat ??
        (thinkingLevel === "none" ? "none" : "full");
      const toolFormat =
        req.query.toolFormat ?? (toolLevel === "full" ? "full" : "none");

      // Set SSE headers
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.write(`:keepalive\n\n`);

      // Helper to send events with filtering
      const sendEvents = (events: StoredEvent[]): boolean => {
        for (const storedEvent of events) {
          if (
            !shouldIncludeEvent(
              storedEvent.msg,
              thinkingFormat,
              toolFormat,
            )
          ) {
            continue;
          }

          const eventType = mapEventMsgToSSEEventType(storedEvent.msg);
          const eventData = mapEventMsgToSSEData(
            storedEvent.msg,
            turn,
            toolFormat,
            thinkingFormat,
          );

          try {
            reply.raw.write(`id: ${turnId}:${storedEvent.id}\n`);
            reply.raw.write(`event: ${eventType}\n`);
            reply.raw.write(`data: ${JSON.stringify(eventData)}\n\n`);
          } catch {
            return false;
          }
        }

        return true;
      };

      // Send stored events first
      const initialEvents = await clientStreamManager.getEvents(
        turnId,
        fromEventId,
      );
      if (!sendEvents(initialEvents)) {
        return;
      }

      let lastEventId =
        initialEvents.length > 0
          ? initialEvents[initialEvents.length - 1].id
          : fromEventId ?? 0;

      const finish = () => {
        try {
          reply.raw.end();
        } catch {
          // ignore
        }
      };

      // Set up keepalive timer
      const keepaliveInterval = setInterval(() => {
        try {
          reply.raw.write(`:keepalive\n\n`);
        } catch {
          clearInterval(keepaliveInterval);
        }
      }, 15000);

      // Poll for new events - continue polling even if turn appears completed
      // to catch any late-arriving events from async message processor
      let completedPollCount = 0;
      const maxCompletedPolls = 50; // Poll for up to 5 seconds after completion
      
      const pollInterval = setInterval(async () => {
        const newEvents = await clientStreamManager.getEvents(
          turnId,
          lastEventId,
        );
        if (newEvents.length > 0) {
          if (!sendEvents(newEvents)) {
            clearInterval(pollInterval);
            clearInterval(keepaliveInterval);
            return;
          }
          lastEventId = newEvents[newEvents.length - 1].id;
          completedPollCount = 0; // Reset counter if we got new events
        }

        const updatedTurn = await clientStreamManager.getTurn(turnId);
        if (updatedTurn && updatedTurn.status !== "running") {
          // Turn is completed, but continue polling for a short time
          // to catch any late-arriving events
          completedPollCount++;
          if (completedPollCount >= maxCompletedPolls) {
            // No new events for a while, safe to close
            clearInterval(pollInterval);
            clearInterval(keepaliveInterval);
            finish();
          }
        } else if (updatedTurn && updatedTurn.status === "running") {
          // Turn is still running, reset completed counter
          completedPollCount = 0;
        }
      }, 100);

      // Clean up on client disconnect
      req.raw.on("close", () => {
        clearInterval(pollInterval);
        clearInterval(keepaliveInterval);
      });
    },
  };
}

function shouldIncludeEvent(
  msg: StreamMessage,
  thinkingFormat: "none" | "summary" | "full",
  toolFormat: "none" | "summary" | "full",
): boolean {
  if (isClientEvent(msg)) {
    if (isThinkingClientEvent(msg)) {
      if (thinkingFormat === "none") {
        return false;
      }
      if (thinkingFormat === "summary" && msg.type === "thinking_delta") {
        return false;
      }
      return true;
    }

    if (isToolClientEvent(msg)) {
      if (toolFormat === "none") {
        return false;
      }
      return true;
    }

    return true;
  }

  if (
    thinkingFormat === "none" &&
    (msg.type === "agent_reasoning" ||
      msg.type === "agent_reasoning_delta" ||
      msg.type === "agent_reasoning_raw_content" ||
      msg.type === "agent_reasoning_raw_content_delta" ||
      msg.type === "reasoning_content_delta" ||
      msg.type === "reasoning_raw_content_delta")
  ) {
    return false;
  }

  if (
    toolFormat === "none" &&
    (msg.type === "exec_command_begin" ||
      msg.type === "exec_command_end" ||
      msg.type === "exec_command_output_delta" ||
      msg.type === "mcp_tool_call_begin" ||
      msg.type === "mcp_tool_call_end" ||
      (msg.type === "raw_response_item" &&
        msg.item &&
        isToolRawResponseItem(msg.item)))
  ) {
    return false;
  }

  return true;
}

/**
 * Map EventMsg type to SSE event type string
 */
function mapEventMsgToSSEEventType(msg: StreamMessage): string {
  if (isClientEvent(msg)) {
    return msg.type;
  }
  if (msg.type === "raw_response_item") {
    if (msg.item.type === "function_call") {
      return "exec_command_begin";
    }
    if (msg.item.type === "function_call_output") {
      return "exec_command_end";
    }
  }

  const typeMap: Record<string, string> = {
    task_started: "task_started",
    task_complete: "task_complete",
    agent_message: "agent_message",
    agent_message_delta: "agent_message",
    agent_message_content_delta: "agent_message",
    agent_reasoning: "agent_reasoning",
    agent_reasoning_delta: "agent_reasoning",
    agent_reasoning_raw_content: "agent_reasoning",
    agent_reasoning_raw_content_delta: "agent_reasoning",
    reasoning_content_delta: "agent_reasoning",
    reasoning_raw_content_delta: "agent_reasoning",
    exec_command_begin: "exec_command_begin",
    exec_command_end: "exec_command_end",
    exec_command_output_delta: "exec_command_output_delta",
    mcp_tool_call_begin: "mcp_tool_call_begin",
    mcp_tool_call_end: "mcp_tool_call_end",
    error: "error",
    stream_error: "error",
    turn_aborted: "turn_aborted",
  };

  return typeMap[msg.type] || "cody-event";
}

/**
 * Map EventMsg to SSE data payload
 */
function mapEventMsgToSSEData(
  msg: StreamMessage,
  turn: TurnRecord,
  toolFormat: "none" | "summary" | "full",
  thinkingFormat: "none" | "summary" | "full",
): Record<string, unknown> {
  const eventType = mapEventMsgToSSEEventType(msg);

  if (isClientEvent(msg)) {
    return {
      event: eventType,
      modelProviderId: turn.modelProviderId,
      modelProviderApi: turn.modelProviderApi,
      model: turn.model,
      ...formatClientEventPayload(msg, toolFormat, thinkingFormat),
    };
  }

  if (msg.type === "raw_response_item" && msg.item) {
    const base = {
      event: eventType,
      modelProviderId: turn.modelProviderId,
      modelProviderApi: turn.modelProviderApi,
      model: turn.model,
      rawResponseItemType: msg.item.type,
    };

    if (isFunctionCallItem(msg.item)) {
      const item = msg.item;
      return {
        ...base,
        callId: item.call_id ?? item.id,
        toolName: item.name,
        arguments: safeParseJson(item.arguments),
      };
    }

    if (isFunctionCallOutputItem(msg.item)) {
      const item = msg.item;
      const toolName =
        turn.toolCalls.find((tc) => tc.callId === item.call_id)?.name ??
        item.call_id;

      return {
        ...base,
        callId: item.call_id,
        toolName,
        output: item.output,
      };
    }

    return {
      ...base,
      raw: msg.item,
    };
  }

  return {
    event: eventType,
    ...msg,
    modelProviderId: turn.modelProviderId,
    modelProviderApi: turn.modelProviderApi,
    model: turn.model,
  };
}

function isToolRawResponseItem(item: ResponseItem): item is Extract<
  ResponseItem,
  { type: "function_call" | "function_call_output" }
> {
  return item.type === "function_call" || item.type === "function_call_output";
}

function safeParseJson(value: string | undefined): unknown {
  if (!value) {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isFunctionCallItem(
  item: ResponseItem | undefined,
): item is Extract<ResponseItem, { type: "function_call" }> {
  return item?.type === "function_call";
}

function isFunctionCallOutputItem(
  item: ResponseItem | undefined,
): item is Extract<ResponseItem, { type: "function_call_output" }> {
  return item?.type === "function_call_output";
}

function isClientEvent(msg: StreamMessage): msg is ClientEvent {
  return (
    msg.type === "tool_call_begin" ||
    msg.type === "tool_call_end" ||
    msg.type === "ts_exec_begin" ||
    msg.type === "ts_exec_end" ||
    msg.type === "thinking_started" ||
    msg.type === "thinking_delta" ||
    msg.type === "thinking_completed"
  );
}

function isThinkingClientEvent(
  event: ClientEvent,
): event is Extract<
  ClientEvent,
  { type: "thinking_started" | "thinking_delta" | "thinking_completed" }
> {
  return (
    event.type === "thinking_started" ||
    event.type === "thinking_delta" ||
    event.type === "thinking_completed"
  );
}

function isToolClientEvent(
  event: ClientEvent,
): event is Extract<
  ClientEvent,
  { type: "tool_call_begin" | "tool_call_end" | "ts_exec_begin" | "ts_exec_end" }
> {
  return (
    event.type === "tool_call_begin" ||
    event.type === "tool_call_end" ||
    event.type === "ts_exec_begin" ||
    event.type === "ts_exec_end"
  );
}

function formatClientEventPayload(
  event: ClientEvent,
  toolFormat: "none" | "summary" | "full",
  thinkingFormat: "none" | "summary" | "full",
): Record<string, unknown> {
  switch (event.type) {
    case "tool_call_begin":
      return {
        callId: event.callId,
        toolName: event.toolName,
        ...(toolFormat === "full" ? { arguments: event.arguments } : {}),
      };
    case "tool_call_end":
      return {
        callId: event.callId,
        status: event.status,
        ...(toolFormat === "full" ? { output: event.output } : {}),
      };
    case "ts_exec_begin":
      return {
        execId: event.execId,
        label: event.label,
        ...(toolFormat === "full" ? { source: event.source } : {}),
      };
    case "ts_exec_end":
      return {
        execId: event.execId,
        status: event.status,
        ...(toolFormat === "full" ? { output: event.output } : {}),
      };
    case "thinking_started":
      return {
        thinkingId: event.thinkingId,
      };
    case "thinking_delta":
      if (thinkingFormat !== "full") {
        return { thinkingId: event.thinkingId };
      }
      return {
        thinkingId: event.thinkingId,
        delta: event.delta,
      };
    case "thinking_completed":
      return {
        thinkingId: event.thinkingId,
        ...(thinkingFormat !== "none" ? { text: event.text } : {}),
      };
  }
}

function parseLastEventId(
  header: string | string[] | undefined,
): number | undefined {
  if (!header) {
    return undefined;
  }
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    return undefined;
  }
  const parts = value.split(":");
  const numericPart = parts[parts.length - 1];
  const parsed = Number.parseInt(numericPart, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

```

```typescript
import { randomUUID } from "node:crypto";
import { RedisStream } from "../redis.js";
import {
  OutputItem,
  StreamEvent,
  StreamEventSchema,
  TraceContext,
} from "../schema.js";
import { childTraceContext, createTraceContext } from "../tracing.js";

interface OpenAIAdapterOptions {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  providerId?: string;
  redis: RedisStream;
}

interface StreamParams {
  prompt: string;
  runId?: string;
  turnId?: string;
  threadId?: string;
  agentId?: string;
}

type ItemAccumulator = {
  id: string;
  type: OutputItem["type"];
  content: string[];
  name?: string;
  callId?: string;
  started?: boolean;
  argumentsChunks?: string[];
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const UUID_REGEX =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;

/**
 * Minimal OpenAI Responses API adapter that normalizes chunks into StreamEvents.
 * This keeps logic intentionally dumb: translate vendor chunks -> Redis events, nothing else.
 */
export class OpenAIStreamAdapter {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly providerId: string;
  private readonly redis: RedisStream;

  constructor(opts: OpenAIAdapterOptions) {
    this.model = opts.model;
    this.apiKey = (opts.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAI adapter");
    }
    this.baseUrl = opts.baseUrl ?? OPENAI_RESPONSES_URL;
    this.providerId = opts.providerId ?? "openai";
    this.redis = opts.redis;
  }

  async stream(params: StreamParams): Promise<{ runId: string }> {
    const runId = params.runId ?? randomUUID();
    const turnId = params.turnId ?? randomUUID();
    const threadId = params.threadId ?? randomUUID();
    const baseTrace = createTraceContext();

    const responseStart = this.makeEvent(baseTrace, runId, {
      type: "response_start",
      response_id: runId,
      turn_id: turnId,
      thread_id: threadId,
      agent_id: params.agentId,
      model_id: this.model,
      provider_id: this.providerId,
      created_at: Date.now(),
    });
    await this.redis.publish(responseStart);

    const controller = new AbortController();
    const reqBody = {
      model: this.model,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: params.prompt }],
        },
      ],
      stream: true,
      reasoning: { effort: "medium" },
    };

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const errorText = await res.text();
      const errEvent = this.makeEvent(baseTrace, runId, {
        type: "response_error",
        response_id: runId,
        error: {
          code: `HTTP_${res.status}`,
          message: errorText || "OpenAI response error",
        },
      });
      await this.redis.publish(errEvent);
      throw new Error(
        `OpenAI Responses API returned ${res.status}: ${errorText}`,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const buffer: string[] = [];
    const items = new Map<string, ItemAccumulator>();

    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) {
        done = true;
      }
        if (value) {
        buffer.push(decoder.decode(value, { stream: true }));
      }
      const joined = buffer.join("");
      const blocks = joined.split("\n\n");
      // Keep trailing partial block in buffer
      buffer.length = 0;
      if (blocks.length > 0) {
        const trailing = blocks.pop();
        if (trailing && trailing.trim().length > 0 && !trailing.trim().startsWith("data:")) {
          buffer.push(trailing);
        } else if (trailing && trailing.trim().startsWith("data:") && !trailing.trim().endsWith("}")) {
          buffer.push(trailing);
        }
      }

      for (const block of blocks) {
        const parsed = parseSseBlock(block);
        if (!parsed) continue;
        if (parsed.data === "[DONE]") {
          done = true;
          break;
        }

        await this.handleOpenAIEvent({
          runId,
          turnId,
          threadId,
          baseTrace,
          block: parsed,
          items,
        });
      }
    }

    // Final response_done event
    const responseDone = this.makeEvent(baseTrace, runId, {
      type: "response_done",
      response_id: runId,
      status: "complete",
      usage: undefined,
      finish_reason: null,
    });
    await this.redis.publish(responseDone);

    return { runId };
  }

  private async handleOpenAIEvent(input: {
    runId: string;
    turnId: string;
    threadId: string;
    baseTrace: TraceContext;
    block: { event: string; data: string };
    items: Map<string, ItemAccumulator>;
  }) {
    const { runId, baseTrace, block, items } = input;
    const trace = childTraceContext(baseTrace);
    const dataJson = safeJson(block.data);

    // Heuristic mapping for Responses API events
    if (block.event === "response.output_text.delta" && dataJson) {
      const itemId = ensureValidItemId(dataJson?.item?.id as string | undefined);
      const delta = typeof dataJson?.delta === "string" ? dataJson.delta : "";
      const item = ensureItem(items, itemId, "message");
      await this.publishItemStartIfNeeded(trace, runId, item);
      await this.publishItemDelta(trace, runId, itemId, delta);
      item.content.push(delta);
      return;
    }

    if (block.event === "response.output_tool_calls.delta" && dataJson) {
      const tool = asObject(dataJson.tool_call);
      const item = asObject(dataJson.item);
      const delta = asObject(dataJson.delta);
      const deltaFunction = asObject(delta?.function);
      const toolFunction = asObject(tool?.function);

      const callId = ensureValidItemId(
        getString(tool?.id) ?? getString(item?.id),
      );
      const name =
        getString(toolFunction?.name) ?? getString(deltaFunction?.name);
      const argsChunk = getString(deltaFunction?.arguments) ?? "";
      const item = ensureItem(items, callId, "function_call");
      item.name = item.name ?? name;
      item.callId = callId;
      item.argumentsChunks = item.argumentsChunks ?? [];
      if (argsChunk) item.argumentsChunks.push(argsChunk);
      await this.publishItemStartIfNeeded(trace, runId, {
        ...item,
        name: item.name,
        callId: callId,
      });
      if (argsChunk) {
        await this.publishItemDelta(trace, runId, callId, argsChunk);
      }
      return;
    }

    if (block.event === "response.output_tool_calls.done" && dataJson) {
      const tool = asObject(dataJson.tool_call);
      const itemPayload = asObject(dataJson.item);
      const callId = ensureValidItemId(
        getString(tool?.id) ?? getString(itemPayload?.id),
      );
      const item = ensureItem(items, callId, "function_call");
      item.name =
        item.name ??
        getString(asObject(tool?.function)?.name) ??
        "function_call";
      item.callId = callId;
      const finalArgs =
        item.argumentsChunks?.join("") ??
        getString(asObject(tool?.function)?.arguments) ??
        "";
      await this.publishItemDone(trace, runId, {
        ...item,
        content: [finalArgs],
      });
      return;
    }

    if (block.event === "response.reasoning.delta" && dataJson) {
      const item = asObject(dataJson.item);
      const itemId = ensureValidItemId(getString(item?.id));
      const delta = getString(dataJson.delta) ?? "";
      const item = ensureItem(items, itemId, "reasoning");
      await this.publishItemStartIfNeeded(trace, runId, item);
      await this.publishItemDelta(trace, runId, itemId, delta);
      item.content.push(delta);
      return;
    }

    if (block.event === "response.output_item.done" && dataJson) {
      const itemPayload = asObject(dataJson.item);
      const itemId = getString(itemPayload?.id) || "message-default";
      const item = items.get(itemId);
      if (item) {
        await this.publishItemDone(trace, runId, item);
      }
      return;
    }

    if (block.event === "response.completed" && dataJson?.usage) {
      const usage = asObject(dataJson.usage);
      const usageEvent = this.makeEvent(trace, runId, {
        type: "usage_update",
        response_id: runId,
        usage: {
          prompt_tokens: getNumber(usage?.prompt_tokens) ?? 0,
          completion_tokens: getNumber(usage?.completion_tokens) ?? 0,
          total_tokens: getNumber(usage?.total_tokens) ?? 0,
        },
      });
      await this.redis.publish(usageEvent);
      return;
    }

    // Unknown event type; ignore but keep flow going.
  }

  private async publishItemStartIfNeeded(
    trace: TraceContext,
    runId: string,
    item: ItemAccumulator,
  ) {
    if (item.started) return;
    item.started = true;
    const payload =
      item.type === "function_call"
        ? {
            type: "item_start" as const,
            item_id: item.id,
            item_type: item.type,
            initial_content: undefined,
            name: item.name,
            arguments: undefined,
          }
        : {
            type: "item_start" as const,
            item_id: item.id,
            item_type: item.type,
            initial_content: undefined,
          };
    await this.redis.publish(this.makeEvent(trace, runId, payload));
  }

  private async publishItemDelta(
    trace: TraceContext,
    runId: string,
    itemId: string,
    delta: string,
  ) {
    const event = this.makeEvent(trace, runId, {
      type: "item_delta",
      item_id: itemId,
      delta_content: delta,
    });
    await this.redis.publish(event);
  }

  private async publishItemDone(
    trace: TraceContext,
    runId: string,
    item: ItemAccumulator,
  ) {
    const finalItem: OutputItem =
      item.type === "function_call"
        ? {
            id: item.id,
            type: "function_call",
            name: item.name ?? "unknown",
            arguments:
              (item.argumentsChunks?.length
                ? item.argumentsChunks.join("")
                : item.content.join("")) ?? "",
            call_id: item.callId ?? item.id,
            origin: "agent",
          }
        : {
            id: item.id,
            type: item.type,
            content: item.content.join(""),
            origin: "agent",
          } as OutputItem;

    const event = this.makeEvent(trace, runId, {
      type: "item_done",
      item_id: item.id,
      final_item: finalItem,
    });
    await this.redis.publish(event);
  }

  private makeEvent(
    trace: TraceContext,
    runId: string,
    payload: StreamEvent["payload"],
  ): StreamEvent {
    const event: StreamEvent = {
      event_id: randomUUID(),
      timestamp: Date.now(),
      trace_context: trace,
      run_id: runId,
      type: payload.type,
      payload,
    };
    return StreamEventSchema.parse(event);
  }
}

function safeJson(input: unknown): Record<string, unknown> | undefined {
  if (typeof input !== "string") return undefined;
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

function parseSseBlock(
  block: string,
): { event: string; data: string } | undefined {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return undefined;

  let eventName = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice("data:".length).trim();
    }
  }
  return { event: eventName, data };
}

function ensureItem(
  items: Map<string, ItemAccumulator>,
  id: string,
  type: ItemAccumulator["type"],
): ItemAccumulator {
  const existing = items.get(id);
  if (existing) return existing;
  const created: ItemAccumulator = { id, type, content: [] };
  items.set(id, created);
  return created;
}

function ensureValidItemId(rawId: string | undefined): string {
  if (rawId && UUID_REGEX.test(rawId)) {
    return rawId;
  }
  return randomUUID();
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

```

```typescript
import type { Conversation } from "codex-ts/src/core/conversation.ts";
import type { Event } from "codex-ts/src/protocol/protocol.ts";
import type { EventMsg } from "codex-ts/src/protocol/protocol.ts";
import { clientStreamManager } from "../client-stream/client-stream-manager.js";
import { convexClient } from "./convex-client.js";
import { api } from "../../../convex/_generated/api.js";

/**
 * Process a message submission by consuming events until completion.
 * 
 * This function will keep calling nextEvent() until it receives a task_complete,
 * turn_aborted, or error event for the given submissionId.
 */
export async function processMessage(
  conversation: Conversation,
  submissionId: string,
  turnId: string,
  conversationId: string,
): Promise<void> {
  // Consume events until we get task_complete or turn_aborted for this submission
  let eventsProcessed = 0;
  const maxEvents = 1000; // Safety limit
  let foundCompletionEvent = false;
  let accumulatedMessage = "";
  let capturedError = "";
  let thinkingBuffer = "";

  const writeThinkingChunk = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await convexClient
      .mutation(api.messages.add, {
        conversationId,
        role: "assistant",
        content: trimmed,
        turnId,
        type: "thinking",
      })
      .catch((e) =>
        console.error("Failed to sync thinking chunk to Convex", e),
      );
  };

  const flushThinkingBuffer = async () => {
    if (!thinkingBuffer.trim()) return;
    await writeThinkingChunk(thinkingBuffer);
    thinkingBuffer = "";
  };

  while (eventsProcessed < maxEvents && !foundCompletionEvent) {
    try {
      const event: Event = await conversation.nextEvent();
      eventsProcessed++;

      // Log every event type for debugging
      if (event.msg) {
          console.log(`[processMessage] Received event: ${event.msg.type}`, 
            event.msg.type === "agent_reasoning" ? "(thinking start)" : 
            event.msg.type.includes("reasoning") ? "(thinking delta)" : "");
      }

      // Only process events for this submission
      if (event.id !== submissionId) {
        continue;
      }

      const msg = event.msg;

      // Accumulate assistant message
      if (msg.type === "agent_message") {
        accumulatedMessage += msg.message;
      } else if (msg.type === "agent_message_delta") {
        accumulatedMessage += msg.delta;
      } else if (msg.type === "agent_message_content_delta") {
        accumulatedMessage += msg.delta;
      }

      // Capture error messages
      if (msg.type === "error") {
        capturedError = msg.message || "An unknown error occurred.";
      }

      // Sync Tool Calls/Outputs to Convex
      if (msg.type === "raw_response_item" && msg.item) {
        const item = msg.item;
        if (item.type === "function_call") {
          await convexClient.mutation(api.messages.add, {
            conversationId,
            role: "assistant",
            content: "",
            turnId,
            type: "tool_call",
            callId: item.call_id ?? item.id,
            toolName: item.name,
            toolArgs: item.arguments,
          }).catch(e => console.error("Failed to sync tool call to Convex", e));
        } else if (item.type === "function_call_output") {
          // Check for failure in output
          if (item.output?.success === false) {
             const errorDetail = typeof item.output.content === "string" 
                ? item.output.content 
                : JSON.stringify(item.output.content);
             capturedError = `Tool execution failed: ${errorDetail}`;
          }

          await convexClient.mutation(api.messages.add, {
            conversationId,
            role: "tool",
            content: "",
            turnId,
            type: "tool_output",
            callId: item.call_id,
            toolOutput: item.output,
          }).catch(e => console.error("Failed to sync tool output to Convex", e));
        }
      }

      if (
        msg.type === "agent_reasoning" ||
        msg.type === "agent_reasoning_raw_content"
      ) {
        await flushThinkingBuffer();
        await writeThinkingChunk(msg.text);
      } else if (
        msg.type === "agent_reasoning_delta" ||
        msg.type === "agent_reasoning_raw_content_delta" ||
        msg.type === "reasoning_content_delta" ||
        msg.type === "reasoning_raw_content_delta"
      ) {
        thinkingBuffer += msg.delta || "";
      } else if (msg.type === "agent_reasoning_section_break") {
        await flushThinkingBuffer();
      }

      // Add event to turn store FIRST
      await clientStreamManager.addEvent(turnId, msg);
      await handleToolFailureEvent(turnId, msg);

      // Update turn status for error events
      if (msg.type === "error") {
        await clientStreamManager.updateTurnStatus(turnId, "error");
      }

      // Check if turn is complete
      if (
        msg.type === "task_complete" ||
        msg.type === "turn_aborted"
      ) {
        foundCompletionEvent = true;
        
        await flushThinkingBuffer();

        // Sync final Assistant Message to Convex
        if (accumulatedMessage.trim()) {
            await convexClient.mutation(api.messages.add, {
                conversationId,
                role: "assistant",
                content: accumulatedMessage,
                turnId,
            }).catch(e => console.error("Failed to sync assistant message to Convex", e));
        } else if (capturedError) {
            // Fallback: Write error message if no text was generated
            await convexClient.mutation(api.messages.add, {
                conversationId,
                role: "assistant",
                content: `I encountered an error and could not complete the request.\n\nError details: ${capturedError}`,
                turnId,
                status: "failed"
            }).catch(e => console.error("Failed to sync error message to Convex", e));
        }
      }
    } catch (error) {
      // Handle errors - store error event before breaking
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      capturedError = errorMessage; // Capture for fallback write
      
      await clientStreamManager.addEvent(turnId, {
        type: "error",
        message: errorMessage,
      });
      await clientStreamManager.updateTurnStatus(turnId, "error");
      foundCompletionEvent = true;

      await flushThinkingBuffer().catch((e) =>
        console.error("Failed flushing thinking buffer on error", e),
      );
      
      // Attempt to write fallback message immediately on crash
      if (!accumulatedMessage.trim()) {
          await convexClient.mutation(api.messages.add, {
            conversationId,
            role: "assistant",
            content: `System Error: ${errorMessage}`,
            turnId,
            status: "failed"
        }).catch(e => console.error("Failed to sync crash message to Convex", e));
      }
    }
  }

  await flushThinkingBuffer().catch((e) =>
    console.error("Failed flushing thinking buffer post-loop", e),
  );

  if (eventsProcessed >= maxEvents && !foundCompletionEvent) {
    await clientStreamManager.addEvent(turnId, {
      type: "error",
      message: "Maximum event limit reached",
    });
    await clientStreamManager.updateTurnStatus(turnId, "error");
  }

  // Ensure turn status is updated if we didn't get a completion event
  const turn = await clientStreamManager.getTurn(turnId);
  if (turn && turn.status === "running" && foundCompletionEvent) {
    // If we found a completion event but status wasn't updated, update it
    if (!turn.completedAt) {
      await clientStreamManager.updateTurnStatus(turnId, "completed");
    }
  }
}

async function handleToolFailureEvent(
  turnId: string,
  msg: EventMsg,
): Promise<void> {
  if (
    msg.type === "raw_response_item" &&
    msg.item?.type === "function_call_output" &&
    msg.item.output?.success === false
  ) {
    const errorMessage =
      typeof msg.item.output.content === "string"
        ? msg.item.output.content
        : JSON.stringify(msg.item.output.content);

    await clientStreamManager.addEvent(turnId, {
      type: "stream_error",
      error: errorMessage,
    });
  }
}

```

```typescript
*** Begin Patch
*** Update File: cody-fastify/src/api/services/conversation-service-codex.ts
@@
-import { api } from "../../../convex/_generated/api.js";
+import { api } from "../../../convex/_generated/api.js";
+import type { Doc } from "../../../convex/_generated/dataModel.js";
 import type { ReasoningEffort } from "codex-ts/src/protocol/config-types.ts";
 
-type ConvexMessage =
-  | {
-      role: string;
-      content: string;
-      turnId?: string;
-      type?: "message";
-    }
-  | {
-      type: "run_snapshot";
-      callId: string;
-      toolOutput?: unknown;
-      status?: string;
-      turnId?: string;
-    }
-  | {
-      type: "thinking";
-      content: string;
-      turnId?: string;
-    }
-  | {
-      type: "tool_call";
-      callId: string;
-      toolName?: string;
-      toolArgs?: unknown;
-      status?: string;
-      turnId?: string;
-  }
-  | {
-      type: "tool_output";
-      callId: string;
-      toolOutput?: unknown;
-      turnId?: string;
-    };
+type LegacyMessageDoc = Doc<"legacyMessages">;
 
 type HistoryItem = ConversationResponse["history"][number];
 
-// Helper to map Convex message to API history format
-function mapConvexMessageToHistory(msg: ConvexMessage): HistoryItem {
-  if (msg.type === "run_snapshot") {
+// Helper to map Convex message to API history format
+function mapLegacyMessageToHistory(msg: LegacyMessageDoc): HistoryItem {
+  const msgType = msg.type ?? "message";
+
+  if (msgType === "run_snapshot") {
     return {
       type: "run_snapshot",
-      callId: msg.callId,
+      callId: msg.callId ?? "",
       status: msg.status,
-      output: msg.toolOutput,
+      output: msg.toolOutput,
       turnId: msg.turnId,
     };
   }
 
-  if (msg.type === "thinking") {
+  if (msgType === "thinking") {
     return {
       type: "thinking",
       content: msg.content ?? "",
       turnId: msg.turnId,
     };
   }
 
-  if (msg.type === "tool_call") {
+  if (msgType === "tool_call") {
     return {
       type: "tool_call",
-      callId: msg.callId,
+      callId: msg.callId ?? "",
       toolName: msg.toolName,
       arguments: msg.toolArgs,
       status: msg.status,
       turnId: msg.turnId,
     };
   }
 
-  if (msg.type === "tool_output") {
+  if (msgType === "tool_output") {
     return {
       type: "tool_output",
-      callId: msg.callId,
+      callId: msg.callId ?? "",
       output: msg.toolOutput,
       turnId: msg.turnId,
     };
   }
 
   return {
     type: "message",
-    role: msg.role,
-    content: msg.content,
+    role: msg.role ?? "assistant",
+    content: msg.content ?? "",
     turnId: msg.turnId,
   };
 }
*** End Patch
```

```typescript
*** Begin Patch
*** Update File: cody-fastify/src/api/services/conversation-service-codex.ts
@@
-import { api } from "../../../convex/_generated/api.js";
-import type { ReasoningEffort } from "codex-ts/src/protocol/config-types.ts";
-
-type ConvexMessage =
-  | {
-      role: string;
-      content: string;
-      turnId?: string;
-      type?: "message";
-    }
-  | {
-      type: "run_snapshot";
-      callId: string;
-      toolOutput?: unknown;
-      status?: string;
-      turnId?: string;
-    }
-  | {
-      type: "thinking";
-      content: string;
-      turnId?: string;
-    }
-  | {
-      type: "tool_call";
-      callId: string;
-      toolName?: string;
-      toolArgs?: unknown;
-      status?: string;
-      turnId?: string;
-  }
-  | {
-      type: "tool_output";
-      callId: string;
-      toolOutput?: unknown;
-      turnId?: string;
-    };
+import { api } from "../../../convex/_generated/api.js";
+import type { Doc } from "../../../convex/_generated/dataModel.js";
+import type { ReasoningEffort } from "codex-ts/src/protocol/config-types.ts";
+
+type LegacyMessageDoc = Doc<"legacyMessages">;
 
 type HistoryItem = ConversationResponse["history"][number];
 
 // Helper to map Convex message to API history format
-function mapConvexMessageToHistory(msg: ConvexMessage): HistoryItem {
-  if (msg.type === "run_snapshot") {
+function mapLegacyMessageToHistory(msg: LegacyMessageDoc): HistoryItem {
+  const msgType = msg.type ?? "message";
+
+  if (msgType === "run_snapshot") {
     return {
       type: "run_snapshot",
-      callId: msg.callId,
-      status: msg.status,
+      callId: msg.callId ?? "",
+      status: msg.status,
       output: msg.toolOutput,
       turnId: msg.turnId,
     };
   }
-  if (msg.type === "thinking") {
+
+  if (msgType === "thinking") {
     return {
       type: "thinking",
-      content: msg.content,
+      content: msg.content ?? "",
       turnId: msg.turnId,
     };
   }
-  if (msg.type === "tool_call") {
+
+  if (msgType === "tool_call") {
     return {
       type: "tool_call",
-      callId: msg.callId,
+      callId: msg.callId ?? "",
       toolName: msg.toolName,
       arguments: msg.toolArgs,
-      status: msg.status || "in_progress",
+      status: msg.status,
       turnId: msg.turnId,
     };
   }
-  if (msg.type === "tool_output") {
+
+  if (msgType === "tool_output") {
     return {
       type: "tool_output",
-      callId: msg.callId,
+      callId: msg.callId ?? "",
       output: msg.toolOutput,
       turnId: msg.turnId,
     };
   }
   return {
     type: "message",
-    role: msg.role,
-    content: msg.content,
+    role: msg.role ?? "assistant",
+    content: msg.content ?? "",
     turnId: msg.turnId,
   };
 }
*** End Patch
```

```typescript
*** Begin Patch
*** Update File: cody-fastify/src/api/services/conversation-service-codex.ts
@@
-import { convexClient } from "./convex-client.js";
-import { api } from "../../../convex/_generated/api.js";
-import type { ReasoningEffort } from "codex-ts/src/protocol/config-types.ts";
-
-type ConvexMessage =
-  | {
-      role: string;
-      content: string;
-      turnId?: string;
-      type?: "message";
-    }
-  | {
-      type: "run_snapshot";
-      callId: string;
-      toolOutput?: unknown;
-      status?: string;
-      turnId?: string;
-    }
-  | {
-      type: "thinking";
-      content: string;
-      turnId?: string;
-    }
-  | {
-      type: "tool_call";
-      callId: string;
-      toolName?: string;
-      toolArgs?: unknown;
-      status?: string;
-      turnId?: string;
-  }
-  | {
-      type: "tool_output";
-      callId: string;
-      toolOutput?: unknown;
-      turnId?: string;
-    };
+import { convexClient } from "./convex-client.js";
+import { api } from "../../../convex/_generated/api.js";
+import type { Doc } from "../../../convex/_generated/dataModel.js";
+import type { ReasoningEffort } from "codex-ts/src/protocol/config-types.ts";
+
+type LegacyMessageDoc = Doc<"legacyMessages">;
@@
-// Helper to map Convex message to API history format
-function mapConvexMessageToHistory(msg: ConvexMessage): HistoryItem {
-  if (msg.type === "run_snapshot") {
+// Helper to map Convex message to API history format
+function mapLegacyMessageToHistory(msg: LegacyMessageDoc): HistoryItem {
+  const msgType = msg.type ?? "message";
+
+  if (msgType === "run_snapshot") {
     return {
       type: "run_snapshot",
-      callId: msg.callId,
+      callId: msg.callId ?? "",
       status: msg.status,
       output: msg.toolOutput,
       turnId: msg.turnId,
     };
   }
-  if (msg.type === "thinking") {
+
+  if (msgType === "thinking") {
     return {
       type: "thinking",
-      content: msg.content,
+      content: msg.content ?? "",
       turnId: msg.turnId,
     };
   }
-  if (msg.type === "tool_call") {
+
+  if (msgType === "tool_call") {
     return {
       type: "tool_call",
-      callId: msg.callId,
+      callId: msg.callId ?? "",
       toolName: msg.toolName,
       arguments: msg.toolArgs,
-      status: msg.status || "in_progress",
+      status: msg.status ?? "in_progress",
       turnId: msg.turnId,
     };
   }
-  if (msg.type === "tool_output") {
+
+  if (msgType === "tool_output") {
     return {
       type: "tool_output",
-      callId: msg.callId,
+      callId: msg.callId ?? "",
       output: msg.toolOutput,
       turnId: msg.turnId,
     };
   }
   return {
     type: "message",
-    role: msg.role,
-    content: msg.content,
+    role: msg.role ?? "assistant",
+    content: msg.content ?? "",
     turnId: msg.turnId,
   };
 }
*** End Patch
```

