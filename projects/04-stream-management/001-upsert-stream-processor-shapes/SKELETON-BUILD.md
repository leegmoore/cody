# UpsertStreamProcessor Skeleton Build

**Project:** 04-stream-management
**Slice:** 001-upsert-stream-processor-shapes
**Purpose:** Detailed specification for building the skeleton module

---

## Module Structure

The UpsertStreamProcessor will be implemented as a standalone module within `cody-fastify/src/core/`. This keeps it alongside the existing reducer and schema files.

### File Structure

```
cody-fastify/src/core/
├── schema.ts                      # Existing - StreamEvent types
├── reducer.ts                     # Existing - ResponseReducer
├── upsert-stream-processor/
│   ├── index.ts                   # Main export
│   ├── types.ts                   # All type definitions
│   ├── processor.ts               # UpsertStreamProcessor class
│   ├── item-buffer.ts             # ItemBuffer class
│   └── utils.ts                   # Helper functions (token counting, retry logic)
```

---

## Type Definitions (types.ts)

### UIUpsert

```typescript
export type UIUpsertItemType = 'message' | 'reasoning' | 'tool_call' | 'tool_output' | 'error';
export type UIUpsertChangeType = 'created' | 'updated' | 'completed';
export type MessageOrigin = 'user' | 'agent' | 'system';

export interface UIUpsert {
  type: 'item_upsert';
  turnId: string;
  threadId: string;
  itemId: string;
  itemType: UIUpsertItemType;
  changeType: UIUpsertChangeType;
  content: string;

  // Message-specific
  origin?: MessageOrigin;

  // Reasoning-specific
  providerId?: string;

  // Tool call-specific
  toolName?: string;
  toolArguments?: Record<string, unknown>;
  callId?: string;

  // Tool output-specific
  toolOutput?: Record<string, unknown> | string;
  success?: boolean;

  // Error-specific
  errorCode?: string;
  errorMessage?: string;
}
```

### UITurnEvent

```typescript
export type UITurnEventType = 'turn_started' | 'turn_completed' | 'turn_error';
export type TurnStatus = 'complete' | 'error' | 'aborted';

export interface UITurnEventUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface UITurnEventError {
  code: string;
  message: string;
}

export interface UITurnEvent {
  type: UITurnEventType;
  turnId: string;
  threadId: string;

  // turn_started
  modelId?: string;
  providerId?: string;

  // turn_completed
  status?: TurnStatus;
  usage?: UITurnEventUsage;

  // turn_error
  error?: UITurnEventError;
}
```

### StreamBMessage (Redis envelope)

```typescript
export type StreamBPayloadType = 'item_upsert' | 'turn_event';

export interface StreamBMessage {
  eventId: string;
  timestamp: number;
  turnId: string;
  payloadType: StreamBPayloadType;
  payload: string;  // JSON serialized UIUpsert | UITurnEvent
}
```

### Processor Options

```typescript
export interface UpsertStreamProcessorOptions {
  turnId: string;
  threadId: string;
  batchGradient?: number[];       // Default: [10, 10, 20, 20, 50, 50, 50, 50, 100, 100, 200, 200, 500, 500, 1000, 1000, 2000]
  batchTimeoutMs?: number;        // Default: 1000
  onEmit: (message: StreamBMessage) => Promise<void>;
  retryAttempts?: number;         // Default: 3
  retryBaseMs?: number;           // Default: 1000
  retryMaxMs?: number;            // Default: 10000
}
```

### Buffer State (for testing/debugging)

```typescript
export interface BufferInfo {
  itemId: string;
  itemType: UIUpsertItemType;
  tokenCount: number;
  contentLength: number;
  batchIndex: number;
  isHeld: boolean;
  isComplete: boolean;
}
```

### Internal Item Buffer State

```typescript
export interface ItemBufferState {
  itemId: string;
  itemType: UIUpsertItemType;
  content: string;
  tokenCount: number;
  batchIndex: number;
  emittedTokenCount: number;
  isComplete: boolean;
  isHeld: boolean;
  hasEmittedCreated: boolean;

  // Type-specific metadata
  origin?: MessageOrigin;
  providerId?: string;
  toolName?: string;
  callId?: string;
}
```

---

## ItemBuffer Class (item-buffer.ts)

Manages the state for a single item being processed.

### Constructor

```typescript
constructor(
  itemId: string,
  itemType: UIUpsertItemType,
  options?: {
    initialContent?: string;
    origin?: MessageOrigin;
    providerId?: string;
    toolName?: string;
    callId?: string;
    isHeld?: boolean;
  }
)
```

### Methods

**appendContent(delta: string): void**

Appends delta content to the buffer and updates token count.

- Parameters:
  - delta: string - Content to append
- Returns: void
- Throws: NotImplementedError (skeleton)

**getContent(): string**

Returns the full accumulated content.

- Parameters: none
- Returns: string - Full content
- Throws: NotImplementedError (skeleton)

**getTokenCount(): number**

Returns the current estimated token count (characters / 4).

- Parameters: none
- Returns: number - Estimated tokens
- Throws: NotImplementedError (skeleton)

**getUnemittedTokenCount(): number**

Returns tokens accumulated since last emit.

- Parameters: none
- Returns: number - Tokens since last emit
- Throws: NotImplementedError (skeleton)

**markEmitted(): void**

Updates emittedTokenCount to current tokenCount after an emit.

- Parameters: none
- Returns: void
- Throws: NotImplementedError (skeleton)

**advanceBatchIndex(): void**

Increments the batch index (moves to next gradient level).

- Parameters: none
- Returns: void
- Throws: NotImplementedError (skeleton)

**getBatchIndex(): number**

Returns current position in batch gradient.

- Parameters: none
- Returns: number - Current batch index
- Throws: NotImplementedError (skeleton)

**markComplete(): void**

Marks the item as complete.

- Parameters: none
- Returns: void
- Throws: NotImplementedError (skeleton)

**isComplete(): boolean**

Returns whether item is marked complete.

- Parameters: none
- Returns: boolean
- Throws: NotImplementedError (skeleton)

**isHeld(): boolean**

Returns whether item is being held (user messages).

- Parameters: none
- Returns: boolean
- Throws: NotImplementedError (skeleton)

**setHeld(held: boolean): void**

Sets the held state.

- Parameters:
  - held: boolean
- Returns: void
- Throws: NotImplementedError (skeleton)

**hasEmittedCreated(): boolean**

Returns whether a 'created' upsert has been emitted for this item.

- Parameters: none
- Returns: boolean
- Throws: NotImplementedError (skeleton)

**markCreatedEmitted(): void**

Marks that 'created' upsert has been emitted.

- Parameters: none
- Returns: void
- Throws: NotImplementedError (skeleton)

**getState(): ItemBufferState**

Returns full internal state (for debugging/testing).

- Parameters: none
- Returns: ItemBufferState
- Throws: NotImplementedError (skeleton)

**toBufferInfo(): BufferInfo**

Returns public buffer info (for getBufferState).

- Parameters: none
- Returns: BufferInfo
- Throws: NotImplementedError (skeleton)

---

## UpsertStreamProcessor Class (processor.ts)

Main processor class that receives StreamEvents and emits UIUpserts.

### Constructor

```typescript
constructor(options: UpsertStreamProcessorOptions)
```

Initializes the processor with configuration. Stores options, initializes empty buffer map, sets up defaults for optional parameters.

### Public Methods

**processEvent(event: StreamEvent): Promise\<void\>**

Process a single incoming StreamEvent. Routes to appropriate handler based on event type.

- Parameters:
  - event: StreamEvent - The incoming event from adapter
- Returns: Promise\<void\>
- Throws:
  - NotImplementedError (skeleton)
  - Error if all retry attempts exhausted on emit

**flush(): Promise\<void\>**

Force emit all pending buffered content. Called on turn completion or when processor is being shut down.

- Parameters: none
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**destroy(): void**

Cleanup all resources. Clears all timers, releases all buffers. Must be called when processor is no longer needed.

- Parameters: none
- Returns: void
- Throws: NotImplementedError (skeleton)

**getBufferState(): Map\<string, BufferInfo\>**

Returns current buffer state for all items. Used for testing and debugging.

- Parameters: none
- Returns: Map\<string, BufferInfo\>
- Throws: NotImplementedError (skeleton)

### Private Methods

**handleResponseStart(payload: ResponseStartPayload): Promise\<void\>**

Handles response_start event. Stores turn metadata, emits turn_started event.

- Parameters:
  - payload: ResponseStartPayload
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**handleItemStart(payload: ItemStartPayload): Promise\<void\>**

Handles item_start event. Creates new ItemBuffer, determines if item should be held.

- Parameters:
  - payload: ItemStartPayload
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**handleItemDelta(payload: ItemDeltaPayload): Promise\<void\>**

Handles item_delta event. Appends content to buffer, checks batch threshold, may emit.

- Parameters:
  - payload: ItemDeltaPayload
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**handleItemDone(payload: ItemDonePayload): Promise\<void\>**

Handles item_done event. Finalizes item, emits completed upsert, cleans up buffer.

- Parameters:
  - payload: ItemDonePayload
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**handleItemError(payload: ItemErrorPayload): Promise\<void\>**

Handles item_error event. Emits error upsert, cleans up buffer.

- Parameters:
  - payload: ItemErrorPayload
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**handleItemCancelled(payload: ItemCancelledPayload): Promise\<void\>**

Handles item_cancelled event. Cleans up buffer for cancelled item without emitting.

- Parameters:
  - payload: ItemCancelledPayload
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**handleResponseDone(payload: ResponseDonePayload): Promise\<void\>**

Handles response_done event. Flushes all buffers, emits turn_completed.

- Parameters:
  - payload: ResponseDonePayload
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**handleResponseError(payload: ResponseErrorPayload): Promise\<void\>**

Handles response_error event. Flushes all buffers, emits turn_error.

- Parameters:
  - payload: ResponseErrorPayload
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**shouldEmitBatch(buffer: ItemBuffer): boolean**

Determines if batch threshold is reached for an item.

- Parameters:
  - buffer: ItemBuffer
- Returns: boolean - true if should emit
- Throws: NotImplementedError (skeleton)

**getCurrentBatchThreshold(buffer: ItemBuffer): number**

Returns the token threshold for current batch index from gradient.

- Parameters:
  - buffer: ItemBuffer
- Returns: number - Token threshold
- Throws: NotImplementedError (skeleton)

**emitUpsert(upsert: UIUpsert): Promise\<void\>**

Wraps upsert in StreamBMessage and calls onEmit with retry logic.

- Parameters:
  - upsert: UIUpsert
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**emitTurnEvent(event: UITurnEvent): Promise\<void\>**

Wraps turn event in StreamBMessage and calls onEmit with retry logic.

- Parameters:
  - event: UITurnEvent
- Returns: Promise\<void\>
- Throws: NotImplementedError (skeleton)

**buildUpsertFromBuffer(buffer: ItemBuffer, changeType: UIUpsertChangeType): UIUpsert**

Constructs a UIUpsert from the current buffer state.

- Parameters:
  - buffer: ItemBuffer
  - changeType: UIUpsertChangeType
- Returns: UIUpsert
- Throws: NotImplementedError (skeleton)

**startBatchTimer(itemId: string): void**

Starts or resets the batch timeout timer for an item.

- Parameters:
  - itemId: string
- Returns: void
- Throws: NotImplementedError (skeleton)

**clearBatchTimer(itemId: string): void**

Clears the batch timeout timer for an item.

- Parameters:
  - itemId: string
- Returns: void
- Throws: NotImplementedError (skeleton)

**clearAllTimers(): void**

Clears all batch timeout timers.

- Parameters: none
- Returns: void
- Throws: NotImplementedError (skeleton)

**isUserMessage(itemId: string, payload: ItemStartPayload | ItemDonePayload): boolean**

Determines if an item is a user message that should be held.

- Parameters:
  - itemId: string
  - payload: ItemStartPayload | ItemDonePayload
- Returns: boolean
- Throws: NotImplementedError (skeleton)

---

## Utility Functions (utils.ts)

**NotImplementedError class**

```typescript
export class NotImplementedError extends Error {
  constructor(methodName: string) {
    super(`${methodName} is not yet implemented`);
    this.name = 'NotImplementedError';
  }
}
```

**estimateTokenCount(text: string): number**

Estimates token count from text using chars/4 heuristic.

- Parameters:
  - text: string
- Returns: number - Estimated token count
- Throws: NotImplementedError (skeleton)

**sleep(ms: number): Promise\<void\>**

Promise-based sleep utility for retry delays.

- Parameters:
  - ms: number - Milliseconds to sleep
- Returns: Promise\<void\>
- Implementation: Simple setTimeout wrapper (implement fully in skeleton)

```typescript
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**calculateRetryDelay(attempt: number, baseMs: number, maxMs: number): number**

Calculates exponential backoff delay for retry attempt.

- Parameters:
  - attempt: number - Which attempt (0-indexed)
  - baseMs: number - Base delay in milliseconds
  - maxMs: number - Maximum delay cap
- Returns: number - Delay in milliseconds
- Throws: NotImplementedError (skeleton)

**parseJsonSafe\<T\>(json: string): T | string**

Safely parses JSON, returns original string if parsing fails.

- Parameters:
  - json: string
- Returns: T | string - Parsed object or original string
- Throws: NotImplementedError (skeleton)

**generateEventId(): string**

Generates a UUID for event IDs.

- Parameters: none
- Returns: string - UUID
- Implementation: Use crypto.randomUUID() (implement fully in skeleton)

```typescript
import { randomUUID } from 'node:crypto';

export function generateEventId(): string {
  return randomUUID();
}
```

---

## Index Export (index.ts)

```typescript
// Re-export all public types
export type {
  BufferInfo,
  ItemBufferState,
  MessageOrigin,
  StreamBMessage,
  StreamBPayloadType,
  TurnStatus,
  UITurnEvent,
  UITurnEventError,
  UITurnEventType,
  UITurnEventUsage,
  UIUpsert,
  UIUpsertChangeType,
  UIUpsertItemType,
  UpsertStreamProcessorOptions,
} from './types.js';

// Export main class
export { UpsertStreamProcessor } from './processor.js';

// Export ItemBuffer class and its options
export { ItemBuffer } from './item-buffer.js';
export type { ItemBufferOptions } from './item-buffer.js';

// Export utilities
export {
  calculateRetryDelay,
  estimateTokenCount,
  generateEventId,
  NotImplementedError,
  parseJsonSafe,
  sleep,
} from './utils.js';
```

---

## Skeleton Implementation Notes

### Methods to Fully Implement

These can be fully implemented in the skeleton (trivial implementations):

1. `sleep()` - Simple setTimeout wrapper
2. `generateEventId()` - crypto.randomUUID()
3. Constructors - Initialize state, store options

### Methods to Stub with NotImplementedError

All other methods should throw NotImplementedError:

```typescript
methodName(): ReturnType {
  throw new NotImplementedError('methodName');
}
```

### Private State to Initialize

**UpsertStreamProcessor constructor:**

The processor uses a `RequiredOptions` interface internally (not `Required<UpsertStreamProcessorOptions>`) because `onEmit` is a callback and can't be optional. This pattern provides explicit control over which fields have defaults.

```typescript
// Internal type for resolved options
interface RequiredOptions {
  turnId: string;
  threadId: string;
  batchGradient: number[];
  batchTimeoutMs: number;
  onEmit: (message: StreamBMessage) => Promise<void>;
  retryAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
}

// Default batch gradient
const DEFAULT_BATCH_GRADIENT = [
  10, 10, 20, 20, 50, 50, 50, 50, 100, 100, 200, 200, 500, 500, 1000, 1000, 2000,
];

// Private state
private itemBuffers: Map<string, ItemBuffer> = new Map();
private batchTimers: Map<string, NodeJS.Timeout> = new Map();
private turnMetadata: TurnMetadata | null = null;
private options: RequiredOptions;
```

**ItemBuffer constructor:**
```typescript
private state: ItemBufferState;
```

Initialize all ItemBufferState fields from constructor parameters.

### Imports from Existing Code

From `../schema.ts`:
- StreamEvent
- StreamEventPayload (or individual payload types)
- OutputItem

---

## Verification

After building skeleton:

1. Run `bun run typecheck` from `cody-fastify/` directory
2. All files should compile without type errors
3. No runtime testing yet - just type verification

---

## Deliverables

1. `cody-fastify/src/core/upsert-stream-processor/types.ts`
2. `cody-fastify/src/core/upsert-stream-processor/utils.ts`
3. `cody-fastify/src/core/upsert-stream-processor/item-buffer.ts`
4. `cody-fastify/src/core/upsert-stream-processor/processor.ts`
5. `cody-fastify/src/core/upsert-stream-processor/index.ts`
6. Passing typecheck
