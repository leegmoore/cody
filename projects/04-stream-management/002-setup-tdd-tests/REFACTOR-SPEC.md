# Refactor Specification: Stream Processor Type Overhaul

**Date:** 2025-12-01
**Context:** Design discussion refined output types for xapi/UI consumption

---

## Summary of Changes

This refactor overhauls the type system to be cleaner and more semantically correct.

### 1. Eliminate "UIUpsert" naming

"Upsert" is a verb, not a noun. We've been treating it as a first-class object which is semantically wrong.

**Old:** `UIUpsert`, `UIUpsertItemType`, `UIUpsertChangeType`
**New:** `Message`, `Thinking`, `ToolCall` as distinct types with `status` field

### 2. Flatten the type discriminator

**Old:**
```typescript
{ type: "item_upsert", itemType: "message", ... }
```

**New:**
```typescript
{ type: "message", ... }
```

The `type` field directly identifies what it is. No wrapper.

### 3. Rename `reasoning` → `thinking`

More universally understood term.

### 4. Rename `changeType` → `status`

**Old:** `changeType: "created" | "updated" | "completed"`
**New:** `status: "create" | "update" | "complete" | "error"`

### 5. Remove `tool_output` as separate type

Tool output is part of `ToolCall` lifecycle - status goes from `create` to `complete`.

### 6. Remove `error` as separate content type

Errors are `status: "error"` on any content type, with `errorCode` and `errorMessage` fields.

### 7. Rename turn event `turn_completed` → `turn_complete`

Consistency with status naming.

### 8. Clean up type names

| Old | New |
|-----|-----|
| `UIUpsert` | `Content` (union of `Message`, `Thinking`, `ToolCall`) |
| `UIUpsertItemType` | `ContentType` (derived: `"message" \| "thinking" \| "tool_call"`) |
| `UIUpsertChangeType` / `UIUpsertStatus` | `Status` |
| `UITurnEvent` | `TurnEvent` (union of `TurnStarted`, `TurnComplete`, `TurnError`) |
| `UITurnEventType` | Gone - use `TurnEvent["type"]` |
| `StreamBMessage` | `StreamMessage` |
| `StreamBPayloadType` | Gone - `type` field discriminates |
| `UpsertStreamProcessorOptions` | `ProcessorOptions` |
| `ItemBufferState` | `BufferState` (moves to item-buffer.ts) |
| `ItemBuffer` | `ContentBuffer` |

---

## New types.ts

```typescript
/**
 * Stream processor output types.
 * These shapes are emitted to Stream B for xapi/UI consumption.
 */

// ---------------------------------------------------------------------------
// Common Types
// ---------------------------------------------------------------------------

export type Status = "create" | "update" | "complete" | "error";

export type MessageOrigin = "user" | "agent" | "system";

export type TurnStatus = "complete" | "error" | "aborted";

// ---------------------------------------------------------------------------
// Content Types
// ---------------------------------------------------------------------------

interface ContentBase {
  turnId: string;
  threadId: string;
  itemId: string;
  status: Status;
  errorCode?: string;
  errorMessage?: string;
}

export interface Message extends ContentBase {
  type: "message";
  content: string;
  origin: MessageOrigin;
}

export interface Thinking extends ContentBase {
  type: "thinking";
  content: string;
  providerId: string;
}

export interface ToolCall extends ContentBase {
  type: "tool_call";
  content: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  callId: string;
  toolOutput?: Record<string, unknown> | string;
  success?: boolean;
}

export type Content = Message | Thinking | ToolCall;

export type ContentType = Content["type"];

// ---------------------------------------------------------------------------
// Turn Events
// ---------------------------------------------------------------------------

export interface TurnStarted {
  type: "turn_started";
  turnId: string;
  threadId: string;
  modelId?: string;
  providerId?: string;
}

export interface TurnComplete {
  type: "turn_complete";
  turnId: string;
  threadId: string;
  status: TurnStatus;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface TurnError {
  type: "turn_error";
  turnId: string;
  threadId: string;
  error: {
    code: string;
    message: string;
  };
}

export type TurnEvent = TurnStarted | TurnComplete | TurnError;

// ---------------------------------------------------------------------------
// Stream Output
// ---------------------------------------------------------------------------

export type StreamOutput = Content | TurnEvent;

export interface StreamMessage {
  eventId: string;
  timestamp: number;
  turnId: string;
  payload: string; // JSON serialized StreamOutput
}

// ---------------------------------------------------------------------------
// Processor Configuration
// ---------------------------------------------------------------------------

export interface ProcessorOptions {
  turnId: string;
  threadId: string;
  batchGradient?: number[];
  batchTimeoutMs?: number;
  onEmit: (message: StreamMessage) => Promise<void>;
  retryAttempts?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
}
```

---

## Tool Call Lifecycle Design

### The Problem

Input events from adapters have separate items:
- `function_call` with `item_id: "fc-001"`, `call_id: "call-001"`
- `function_call_output` with `item_id: "fco-001"`, `call_id: "call-001"`

Output needs to be a single `ToolCall` with two status updates using the same `itemId`.

### The Solution

The processor maintains a `toolCallRegistry` map to store tool call metadata:

```typescript
interface ToolCallMetadata {
  itemId: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  callId: string;
}

private toolCallRegistry: Map<string, ToolCallMetadata> = new Map();
// Key is callId, value is the metadata
```

**Processing `function_call`:**

1. On `item_start` with `item_type: "function_call"`:
   - Create a buffer for the tool call
   - Mark as held (don't emit yet - no meaningful content)

2. On `item_done` with `final_item.type: "function_call"`:
   - Parse `arguments` JSON string to object
   - Store in registry: `toolCallRegistry.set(call_id, { itemId, toolName, toolArguments, callId })`
   - Emit `ToolCall` with `status: "create"`
   - Keep buffer alive (will be updated on output)

**Processing `function_call_output`:**

1. On `item_start` with `item_type: "function_call_output"`:
   - **IGNORE** - do not create buffer

2. On `item_done` with `final_item.type: "function_call_output"`:
   - Look up metadata: `metadata = toolCallRegistry.get(call_id)`
   - If not found: log warning, emit nothing
   - Parse `output` JSON string to object
   - Emit `ToolCall` with:
     - `itemId: metadata.itemId` (same as create)
     - `status: "complete"`
     - `toolName: metadata.toolName`
     - `toolArguments: metadata.toolArguments`
     - `callId: metadata.callId`
     - `toolOutput: parsedOutput`
     - `success: final_item.success`
   - Remove from registry: `toolCallRegistry.delete(call_id)`
   - Clean up buffer

### Example Flow

Input:
```
1. item_start { item_id: "fc-001", item_type: "function_call", name: "read_file" }
2. item_done { item_id: "fc-001", final_item: { type: "function_call", call_id: "call-001", name: "read_file", arguments: "{...}" } }
3. item_start { item_id: "fco-001", item_type: "function_call_output" }
4. item_done { item_id: "fco-001", final_item: { type: "function_call_output", call_id: "call-001", output: "{...}", success: true } }
```

Output:
```
1. (nothing)
2. tool_call { itemId: "fc-001", status: "create", toolName: "read_file", toolArguments: {...}, callId: "call-001" }
3. (nothing)
4. tool_call { itemId: "fc-001", status: "complete", toolName: "read_file", toolArguments: {...}, callId: "call-001", toolOutput: {...}, success: true }
```

---

## Error Handling Design

Errors are reported on the same content item with `status: "error"`.

### Example: Message Error Mid-Stream

Input:
```
1. item_start { item_id: "msg-001", item_type: "message" }
2. item_delta { item_id: "msg-001", delta_content: "I was starting to respond but" }
3. item_error { item_id: "msg-001", error: { code: "CONTENT_FILTER", message: "..." } }
```

Output:
```
1. (nothing - no content yet)
2. message { itemId: "msg-001", status: "create", content: "I was starting to respond but" }
3. message { itemId: "msg-001", status: "error", content: "I was starting to respond but", errorCode: "CONTENT_FILTER", errorMessage: "..." }
```

The UI shows partial content with an error indicator.

---

## Input Type Mapping

The processor maps adapter input types to output content types:

| Input `item_type` | Output `type` |
|-------------------|---------------|
| `message` | `message` |
| `reasoning` | `thinking` |
| `function_call` | `tool_call` |
| `function_call_output` | (updates existing `tool_call`) |
| `error` | (handled via `status: "error"` on affected content) |

---

## Flush on Destroy Behavior

When `destroy()` is called:

1. If a buffer has content already emitted and no NEW content since: **emit nothing**
2. If a buffer has unemitted content: **emit with `status: "create"`**
3. Clean up all buffers and timers

---

## Response Error Handling (TC-08 Decision)

When `response_error` event arrives:

- Emit `TurnError` (not `TurnComplete` with error status)
- `TurnError` has `type: "turn_error"` with error details
- `TurnComplete` is for successful completion (status indicates final state)

This distinguishes:
- `turn_complete` with `status: "error"` - turn finished, but content had errors
- `turn_error` - turn itself failed (provider error, timeout, etc.)

---

## Files to Update

### 1. types.ts
**Path:** `cody-fastify/src/core/upsert-stream-processor/types.ts`

**Action:** Replace entire file with new types.ts content shown above.

### 2. processor.ts
**Path:** `cody-fastify/src/core/upsert-stream-processor/processor.ts`

**Changes:**

Update imports:
- FIND: `import type { ... UIUpsertChangeType ... } from "./types.js"`
- REPLACE: Import new types (`Content`, `Message`, `Thinking`, `ToolCall`, `TurnEvent`, `Status`, `ProcessorOptions`, `StreamMessage`, `ContentType`)

Update class name (optional but recommended):
- FIND: `class UpsertStreamProcessor`
- REPLACE: `class StreamProcessor`

Update options type:
- FIND: `UpsertStreamProcessorOptions`
- REPLACE: `ProcessorOptions`

Add tool call registry:
```typescript
interface ToolCallMetadata {
  itemId: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  callId: string;
}

private toolCallRegistry: Map<string, ToolCallMetadata> = new Map();
```

Update method signatures:
- FIND: `_changeType: UIUpsertChangeType`
- REPLACE: `_status: Status`

Update build method:
- FIND: `buildUpsertFromBuffer`
- REPLACE: `buildContentFromBuffer` (returns `Content` not `UIUpsert`)

### 3. item-buffer.ts
**Path:** `cody-fastify/src/core/upsert-stream-processor/item-buffer.ts`

**Changes:**

Rename class:
- FIND: `class ItemBuffer`
- REPLACE: `class ContentBuffer`

Update imports to use new types.

Move buffer state types INTO this file (they're internal):
```typescript
export interface BufferState {
  itemId: string;
  contentType: ContentType;
  content: string;
  tokenCount: number;
  batchIndex: number;
  emittedTokenCount: number;
  isComplete: boolean;
  isHeld: boolean;
  hasEmittedCreate: boolean;
  origin?: MessageOrigin;
  providerId?: string;
  toolName?: string;
  callId?: string;
  toolArguments?: Record<string, unknown>;
}

export interface BufferInfo {
  itemId: string;
  contentType: ContentType;
  tokenCount: number;
  contentLength: number;
  batchIndex: number;
  isHeld: boolean;
  isComplete: boolean;
}
```

Update property/method names:
- FIND: `hasEmittedCreated` → REPLACE: `hasEmittedCreate`
- FIND: `markCreatedEmitted` → REPLACE: `markCreateEmitted`

Constructor parameter:
- FIND: `itemType: UIUpsertItemType`
- REPLACE: `contentType: ContentType`

### 4. index.ts
**Path:** `cody-fastify/src/core/upsert-stream-processor/index.ts`

**Action:** Update all exports to match new type names.

```typescript
// Types
export type {
  Status,
  MessageOrigin,
  TurnStatus,
  Message,
  Thinking,
  ToolCall,
  Content,
  ContentType,
  TurnStarted,
  TurnComplete,
  TurnError,
  TurnEvent,
  StreamOutput,
  StreamMessage,
  ProcessorOptions,
} from "./types.js";

// Classes
export { StreamProcessor } from "./processor.js";
export { ContentBuffer, type BufferState, type BufferInfo } from "./content-buffer.js";

// Utilities
export { NotImplementedError, RetryExhaustedError } from "./utils.js";
export { estimateTokenCount, generateEventId, sleep, calculateRetryDelay, parseJsonSafe } from "./utils.js";
```

Note: Rename `item-buffer.ts` → `content-buffer.ts`

### 5. Rename file
- FIND: `item-buffer.ts`
- RENAME TO: `content-buffer.ts`

---

## Test Fixture Updates

### Fixture Types (types.ts in __tests__/fixtures/)

**Path:** `cody-fastify/src/core/upsert-stream-processor/__tests__/fixtures/types.ts`

```typescript
/**
 * Test fixture types for StreamProcessor TDD tests.
 */

import type { StreamEvent } from "../../../schema.js";
import type { Content, TurnEvent } from "../../types.js";

// ---------------------------------------------------------------------------
// Test Constants
// ---------------------------------------------------------------------------

export const TEST_TURN_ID = "test-turn-00000000-0000-0000-0000-000000000001";
export const TEST_THREAD_ID = "test-thread-0000-0000-0000-0000-000000000001";
export const TEST_TRACE_CONTEXT = {
  traceparent: "00-test-trace-id-000000000000000000-span-id-00000000-01",
};

// ---------------------------------------------------------------------------
// Expected Message Type
// ---------------------------------------------------------------------------

export interface ExpectedOutput {
  /** Partial matching against the emitted Content or TurnEvent */
  payload: Partial<Content | TurnEvent>;
}

// ---------------------------------------------------------------------------
// OnEmit Behavior Configuration
// ---------------------------------------------------------------------------

export type OnEmitBehavior =
  | { type: "success" }
  | { type: "fail_then_succeed"; failCount: number }
  | { type: "always_fail" };

// ---------------------------------------------------------------------------
// Test Fixture Interface
// ---------------------------------------------------------------------------

export interface TestFixture {
  id: string;
  name: string;
  description: string;
  options?: {
    batchGradient?: number[];
    batchTimeoutMs?: number;
    retryAttempts?: number;
    retryBaseMs?: number;
    retryMaxMs?: number;
  };
  input: StreamEvent[];
  expected: ExpectedOutput[];
  onEmitBehavior?: OnEmitBehavior;
  special?: {
    requiresTiming?: boolean;
    delayBetweenEvents?: { afterIndex: number; delayMs: number }[];
    earlyDestroy?: boolean;
    expectedErrorCount?: number;
  };
}
```

### TC-01: Simple Agent Message

```typescript
expected: [
  {
    payload: {
      type: "turn_started",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
      modelId: "claude-sonnet-4-20250514",
      providerId: "anthropic",
    },
  },
  {
    payload: {
      type: "message",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
      itemId: "msg-01-001",
      status: "create",
      content: "Hello there!",
      origin: "agent",
    },
  },
  {
    payload: {
      type: "message",
      itemId: "msg-01-001",
      status: "complete",
      content: "Hello there!",
      origin: "agent",
    },
  },
  {
    payload: {
      type: "turn_complete",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
      status: "complete",
      usage: {
        promptTokens: 10,
        completionTokens: 3,
        totalTokens: 13,
      },
    },
  },
],
```

### TC-02: Batching Threshold

Apply same pattern - `type: "message"`, `status: "create"/"update"/"complete"`, no `itemType` field.

### TC-03: User Message Hold

Apply same pattern.

### TC-04: Thinking Block

```typescript
expected: [
  {
    payload: {
      type: "turn_started",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
      providerId: "anthropic",
    },
  },
  {
    payload: {
      type: "thinking",
      status: "create",
      content: "Let me think about this problem. ",
      providerId: "anthropic",
    },
  },
  {
    payload: {
      type: "thinking",
      status: "update",
      content: "Let me think about this problem. I should consider multiple factors here.",
      providerId: "anthropic",
    },
  },
  {
    payload: {
      type: "thinking",
      status: "complete",
      providerId: "anthropic",
    },
  },
  {
    payload: {
      type: "message",
      status: "create",
      origin: "agent",
    },
  },
  {
    payload: {
      type: "message",
      status: "complete",
      origin: "agent",
    },
  },
  {
    payload: {
      type: "turn_complete",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
      status: "complete",
    },
  },
],
```

### TC-05: Tool Call and Output

```typescript
expected: [
  // 1. turn_started
  {
    payload: {
      type: "turn_started",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
    },
  },
  // 2. tool_call create (on function_call item_done)
  {
    payload: {
      type: "tool_call",
      itemId: "fc-05-001",
      status: "create",
      content: "",
      toolName: "read_file",
      toolArguments: { path: "/tmp/test.txt", encoding: "utf-8" },
      callId: "call-05-001",
    },
  },
  // 3. tool_call complete (on function_call_output item_done)
  {
    payload: {
      type: "tool_call",
      itemId: "fc-05-001",
      status: "complete",
      content: "",
      toolName: "read_file",
      toolArguments: { path: "/tmp/test.txt", encoding: "utf-8" },
      callId: "call-05-001",
      toolOutput: { content: "Hello from file!", bytes: 17 },
      success: true,
    },
  },
  // 4. message create
  {
    payload: {
      type: "message",
      itemId: "msg-05-001",
      status: "create",
      content: "The file contains: Hello from file!",
      origin: "agent",
    },
  },
  // 5. message complete
  {
    payload: {
      type: "message",
      itemId: "msg-05-001",
      status: "complete",
      content: "The file contains: Hello from file!",
      origin: "agent",
    },
  },
  // 6. turn_complete
  {
    payload: {
      type: "turn_complete",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
      status: "complete",
    },
  },
],
```

### TC-06: Multiple Tool Calls

Input sequence (summarized):
1. response_start
2. function_call #1 (read_file) start
3. function_call #1 done
4. function_call_output #1 start
5. function_call_output #1 done
6. function_call #2 (write_file) start
7. function_call #2 done
8. function_call_output #2 start
9. function_call_output #2 done
10. message start
11. message delta
12. message done
13. response_done

```typescript
expected: [
  // 1. turn_started
  {
    payload: {
      type: "turn_started",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
    },
  },
  // 2. tool_call #1 create
  {
    payload: {
      type: "tool_call",
      itemId: "fc-06-001",
      status: "create",
      toolName: "read_file",
      toolArguments: { path: "/tmp/input.txt" },
      callId: "call-06-001",
    },
  },
  // 3. tool_call #1 complete
  {
    payload: {
      type: "tool_call",
      itemId: "fc-06-001",
      status: "complete",
      toolName: "read_file",
      callId: "call-06-001",
      toolOutput: { content: "input data" },
      success: true,
    },
  },
  // 4. tool_call #2 create
  {
    payload: {
      type: "tool_call",
      itemId: "fc-06-002",
      status: "create",
      toolName: "write_file",
      toolArguments: { path: "/tmp/output.txt", content: "processed" },
      callId: "call-06-002",
    },
  },
  // 5. tool_call #2 complete
  {
    payload: {
      type: "tool_call",
      itemId: "fc-06-002",
      status: "complete",
      toolName: "write_file",
      callId: "call-06-002",
      toolOutput: { bytesWritten: 9 },
      success: true,
    },
  },
  // 6. message create
  {
    payload: {
      type: "message",
      itemId: "msg-06-001",
      status: "create",
      origin: "agent",
    },
  },
  // 7. message complete
  {
    payload: {
      type: "message",
      itemId: "msg-06-001",
      status: "complete",
      origin: "agent",
    },
  },
  // 8. turn_complete
  {
    payload: {
      type: "turn_complete",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
      status: "complete",
    },
  },
],
```

### TC-07: Item Error Mid-Stream

```typescript
expected: [
  // 1. turn_started
  {
    payload: {
      type: "turn_started",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
    },
  },
  // 2. message create (partial content)
  {
    payload: {
      type: "message",
      itemId: "msg-07-001",
      status: "create",
      content: "I was starting to respond but",
    },
  },
  // 3. message error (same itemId)
  {
    payload: {
      type: "message",
      itemId: "msg-07-001",
      status: "error",
      content: "I was starting to respond but",
      errorCode: "CONTENT_FILTER",
      errorMessage: "Response blocked by content filter",
    },
  },
  // 4. turn_complete with error status
  {
    payload: {
      type: "turn_complete",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
      status: "error",
    },
  },
],
```

### TC-08: Response Error

```typescript
expected: [
  // 1. turn_started
  {
    payload: {
      type: "turn_started",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
    },
  },
  // 2. turn_error (NOT turn_complete)
  {
    payload: {
      type: "turn_error",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
      error: {
        code: "PROVIDER_ERROR",
        message: "Provider returned 500 error",
      },
    },
  },
],
```

### TC-09 through TC-11

Apply same pattern - `type` is the content type directly, `status` field.

### TC-12: Flush on Destroy

```typescript
expected: [
  // 1. turn_started
  {
    payload: {
      type: "turn_started",
      turnId: TEST_TURN_ID,
      threadId: TEST_THREAD_ID,
    },
  },
  // 2. message create (emitted on delta, before destroy)
  {
    payload: {
      type: "message",
      itemId: "msg-12-001",
      status: "create",
      content: "This content is buffered but never completed...",
    },
  },
  // NO THIRD EMISSION - destroy emits nothing if no new content
],
```

### TC-13 and TC-14

Apply same pattern. TC-14 should still expect `RetryExhaustedError`.

---

## Global Find/Replace Summary

For test fixtures:

| Find | Replace |
|------|---------|
| `payloadType: "item_upsert"` | (DELETE - not needed) |
| `payloadType: "turn_event"` | (DELETE - not needed) |
| `type: "item_upsert"` | (use content type directly: `type: "message"` etc.) |
| `itemType: "message"` | `type: "message"` |
| `itemType: "reasoning"` | `type: "thinking"` |
| `itemType: "tool_call"` | `type: "tool_call"` |
| `itemType: "tool_output"` | (DELETE - merged into tool_call) |
| `itemType: "error"` | (use `status: "error"` on content type) |
| `changeType: "created"` | `status: "create"` |
| `changeType: "updated"` | `status: "update"` |
| `changeType: "completed"` | `status: "complete"` |
| `type: "turn_completed"` | `type: "turn_complete"` |

For source files:

| Find | Replace |
|------|---------|
| `UIUpsert` | `Content` |
| `UIUpsertItemType` | `ContentType` |
| `UIUpsertChangeType` | `Status` |
| `UIUpsertStatus` | `Status` |
| `UITurnEvent` | `TurnEvent` |
| `UITurnEventType` | `TurnEvent["type"]` or inline |
| `UpsertStreamProcessorOptions` | `ProcessorOptions` |
| `UpsertStreamProcessor` | `StreamProcessor` |
| `ItemBuffer` | `ContentBuffer` |
| `ItemBufferState` | `BufferState` |
| `ItemBufferOptions` | `BufferOptions` |
| `StreamBMessage` | `StreamMessage` |
| `StreamBPayloadType` | (DELETE) |
| `hasEmittedCreated` | `hasEmittedCreate` |
| `markCreatedEmitted` | `markCreateEmitted` |

---

## Execution Order

1. Rename `item-buffer.ts` → `content-buffer.ts`
2. Replace `types.ts` with new content
3. Update `content-buffer.ts` (was item-buffer.ts)
4. Update `processor.ts`
5. Update `index.ts`
6. Update `__tests__/fixtures/types.ts`
7. Update all test fixtures (tc-01 through tc-14)
8. Update `__tests__/helpers.ts` if needed
9. Update `__tests__/processor.test.ts` if needed
10. Run typecheck
11. Run tests

---

## Verification Criteria

**Typecheck:**
```bash
cd cody-fastify && bun run typecheck
```
Expected: 0 errors

**Tests:**
```bash
cd cody-fastify && bun test src/core/upsert-stream-processor
```
Expected:
- 14 tests run
- 14 tests FAIL with `NotImplementedError`
- 0 tests fail for type errors or missing properties

If any test fails for reasons other than `NotImplementedError`, the refactor has issues.

---

## Checklist

- [ ] Rename `item-buffer.ts` → `content-buffer.ts`
- [ ] Update `types.ts` with new type definitions
- [ ] Update `content-buffer.ts` with new types and method names
- [ ] Update `processor.ts` with new types, add `toolCallRegistry`
- [ ] Update `index.ts` exports
- [ ] Update `__tests__/fixtures/types.ts`
- [ ] Update TC-01 expected outputs
- [ ] Update TC-02 expected outputs
- [ ] Update TC-03 expected outputs
- [ ] Update TC-04 expected outputs (reasoning → thinking)
- [ ] Update TC-05 expected outputs (tool_call lifecycle)
- [ ] Update TC-06 expected outputs (multiple tools - full rewrite)
- [ ] Update TC-07 expected outputs (error as status)
- [ ] Update TC-08 expected outputs (turn_error)
- [ ] Update TC-09 expected outputs
- [ ] Update TC-10 expected outputs
- [ ] Update TC-11 expected outputs
- [ ] Update TC-12 expected outputs (only 2 items)
- [ ] Update TC-13 expected outputs
- [ ] Update TC-14 expected outputs
- [ ] Update test helpers if needed
- [ ] Update main test file if needed
- [ ] Typecheck passes
- [ ] All 14 tests fail with NotImplementedError
