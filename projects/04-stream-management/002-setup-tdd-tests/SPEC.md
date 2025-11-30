# Slice 002: Setup TDD Tests for UpsertStreamProcessor

**Project:** 04-stream-management
**Slice:** 002-setup-tdd-tests
**Status:** In Progress

---

## High-Level Architecture

```mermaid
flowchart LR
    subgraph Providers
        OAI[OpenAI Responses API]
        ANT[Anthropic Messages API]
    end

    subgraph Adapters
        OAA[OpenAI Adapter]
        ANA[Anthropic Adapter]
    end

    subgraph Processing
        SE[StreamEvent\ncommon format]
        USP[UpsertStreamProcessor]
    end

    subgraph Storage
        RSA[Redis Stream A\nraw events]
        RSB[Redis Stream B\nupserts]
    end

    subgraph APIs
        V2[v2 API]
        XA[xapi]
    end

    OAI --> OAA
    ANT --> ANA
    OAA --> SE
    ANA --> SE
    SE --> RSA --> V2
    SE --> USP --> RSB --> XA
```

---

## What We Are Transforming and Why

The adapters normalize vendor-specific streaming formats into a common StreamEvent format. This format is designed for internal system use - atomic events that can be reduced to build complete Response objects. It works well for persistence and debugging but creates complexity for UI consumption.

The UI needs to render content as it streams. With the current format, the UI must track item state, handle origin changes mid-stream, buffer deltas, detect duplicates, and manage timing. This complexity has proven difficult for coding agents to maintain without introducing bugs.

The UpsertStreamProcessor transforms the atomic StreamEvent format into a UI-friendly UIUpsert format. Each upsert contains complete current state for an item - the UI simply binds the content without tracking deltas or managing state.

**Key benefits:**
- UI becomes stateless renderer - just bind what arrives
- Batching reduces event frequency while maintaining responsiveness
- Full content per upsert enables self-healing on missed events
- Server-side complexity is isolated and testable
- Same format works for streaming and persistence loading

---

## Core Data Flow

```mermaid
flowchart TB
    subgraph Input
        AD[Adapter]
        SE[StreamEvent\natomic events]
    end

    subgraph UpsertStreamProcessor
        direction TB
        IB[Item Buffers\ncontent accumulation]
        BC[Batch Counters\ngradient tracking]
        TM[Timers\nbatch timeout]
        MD[Turn Metadata\nids, provider]
    end

    subgraph Output
        UU[UIUpsert / UITurnEvent\nbatched, full content]
        RSB[Redis Stream B\nserialized messages]
    end

    AD --> SE --> UpsertStreamProcessor --> UU --> RSB
```

---

## Post-Adapter Format: StreamEvent

This is the input to the UpsertStreamProcessor. Already defined in the codebase, summarized here for reference.

**StreamEvent** - envelope for all events

| Attribute | Type | Description |
|-----------|------|-------------|
| event_id | string (uuid) | Unique identifier for this event |
| timestamp | number | Milliseconds since epoch |
| trace_context | TraceContext | Distributed tracing info |
| run_id | string (uuid) | Identifies the turn/run |
| type | string | Event type discriminator |
| payload | object | Type-specific payload |

**Payload Types:**

**response_start** - Turn is beginning

| Attribute | Type | Description |
|-----------|------|-------------|
| type | "response_start" | Discriminator |
| response_id | string (uuid) | Same as run_id |
| turn_id | string (uuid) | Turn identifier |
| thread_id | string (uuid) | Thread identifier |
| agent_id | string (uuid), optional | Agent identifier |
| model_id | string | Model identifier |
| provider_id | string | Provider (e.g., "anthropic", "openai") |
| created_at | number | Timestamp |

**item_start** - New output item beginning

| Attribute | Type | Description |
|-----------|------|-------------|
| type | "item_start" | Discriminator |
| item_id | string | Unique item identifier |
| item_type | string | One of: message, reasoning, function_call, function_call_output, error |
| initial_content | string, optional | Starting content if any |
| name | string, optional | Tool name for function_call |
| arguments | string, optional | Initial arguments for function_call |
| code | string, optional | For script_execution |

**item_delta** - Content chunk for an item

| Attribute | Type | Description |
|-----------|------|-------------|
| type | "item_delta" | Discriminator |
| item_id | string | Which item this delta belongs to |
| delta_content | string | The new content chunk |

**item_done** - Item is complete

| Attribute | Type | Description |
|-----------|------|-------------|
| type | "item_done" | Discriminator |
| item_id | string | Which item completed |
| final_item | OutputItem | Complete item with all fields |

**item_error** - Error on specific item

| Attribute | Type | Description |
|-----------|------|-------------|
| type | "item_error" | Discriminator |
| item_id | string | Which item errored |
| error | ErrorObject | Error details (code, message, stack) |

**response_done** - Turn is complete

| Attribute | Type | Description |
|-----------|------|-------------|
| type | "response_done" | Discriminator |
| response_id | string (uuid) | Which response completed |
| status | string | One of: complete, error, aborted |
| usage | object, optional | Token counts (prompt, completion, total) |
| finish_reason | string, nullable | Why generation stopped |

**response_error** - Turn-level error

| Attribute | Type | Description |
|-----------|------|-------------|
| type | "response_error" | Discriminator |
| response_id | string (uuid) | Which response errored |
| error | ErrorObject | Error details |

---

## Post-Processor Format: UIUpsert and UITurnEvent

These are the outputs from the UpsertStreamProcessor.

### UIUpsert - Item content update

| Attribute | Type | Description |
|-----------|------|-------------|
| type | "item_upsert" | Discriminator |
| turnId | string (uuid) | Turn this belongs to |
| threadId | string (uuid) | Thread this belongs to |
| itemId | string | Item identifier |
| itemType | string | One of: message, reasoning, tool_call, tool_output, error |
| changeType | string | One of: created, updated, completed |
| content | string | Full accumulated content up to this point |
| origin | string, optional | For messages: user, agent, or system |
| providerId | string, optional | For reasoning: which provider (for UI filtering) |
| toolName | string, optional | For tool_call: name of the tool |
| toolArguments | object, optional | For tool_call: parsed arguments |
| callId | string, optional | For tool_call and tool_output: links them together |
| toolOutput | object or string, optional | For tool_output: parsed result |
| success | boolean, optional | For tool_output: whether tool succeeded |
| errorCode | string, optional | For error: error code |
| errorMessage | string, optional | For error: error description |

### UITurnEvent - Turn lifecycle event

| Attribute | Type | Description |
|-----------|------|-------------|
| type | string | One of: turn_started, turn_completed, turn_error |
| turnId | string (uuid) | Turn identifier |
| threadId | string (uuid) | Thread identifier |
| modelId | string, optional | For turn_started: model being used |
| providerId | string, optional | For turn_started: provider being used |
| status | string, optional | For turn_completed: complete, error, or aborted |
| usage | object, optional | For turn_completed: promptTokens, completionTokens, totalTokens |
| error | object, optional | For turn_error: code and message |

### Redis Stream B Message - Envelope for Redis

| Attribute | Type | Description |
|-----------|------|-------------|
| eventId | string (uuid) | Unique identifier for this emission |
| timestamp | number | Milliseconds since epoch |
| turnId | string (uuid) | For stream key construction |
| payloadType | string | Either "item_upsert" or "turn_event" |
| payload | string | JSON serialized UIUpsert or UITurnEvent |

Stream key pattern: `codex:turn:{turnId}:upserts`

---

## UpsertStreamProcessor Methods

**constructor(options: UpsertStreamProcessorOptions)**

Creates a new processor instance for a single turn.

Options:
| Option | Type | Description |
|--------|------|-------------|
| turnId | string (uuid) | Turn identifier |
| threadId | string (uuid) | Thread identifier |
| batchGradient | number[] | Token counts per batch level, e.g., [10, 10, 20, 20, 50, ...] |
| batchTimeoutMs | number | Max milliseconds before forcing batch emit, default 1000 (safety fallback, not primary mechanism) |
| onEmit | function | Async callback receiving StreamBMessage to write to Redis |
| retryAttempts | number | Number of retry attempts on emit failure, default 3 |
| retryBaseMs | number | Base delay for exponential backoff, default 1000 |
| retryMaxMs | number | Maximum retry delay, default 10000 |

**processEvent(event: StreamEvent): Promise\<void\>**

Process a single incoming event. May buffer internally or emit immediately depending on event type and batch state.

**flush(): Promise\<void\>**

Force emit all pending buffered content. Called on turn completion or error.

**destroy(): void**

Cleanup all resources. Clears timers, releases buffers. Must be called when processor is no longer needed to prevent memory leaks.

**getBufferState(): Map\<string, BufferInfo\>**

Returns current buffer state for testing/debugging. BufferInfo contains itemId, tokenCount, content length, and batch index.

---

## Functional Description

The UpsertStreamProcessor maintains internal state for each item in a turn. When events arrive:

**On response_start:**
- Store turn metadata (turnId, threadId, modelId, providerId)
- Emit turn_started event immediately

**On item_start:**
- Create new item buffer
- If item is a user message (detected by item_id pattern or origin), mark as held
- If initial_content provided and not held, may emit created upsert

**On item_delta:**
- Append delta_content to item buffer
- Increment token count (estimated as character count divided by 4)
- Check if batch threshold reached (based on gradient and current batch index)
- If threshold reached, emit updated upsert with full accumulated content, advance batch index
- Reset batch timer

**On item_done:**
- If item was held (user message), emit single created+completed upsert with correct origin
- Otherwise emit completed upsert with final content
- Clear item buffer

**On item_error:**
- Emit error upsert for the item
- Clear item buffer

**On response_done:**
- Flush any remaining buffered content
- Emit turn_completed event with status and usage

**On response_error:**
- Flush any remaining buffered content
- Emit turn_error event

**Batch timing:**
- Each item has a batch timer (default 1000ms)
- Timer is a safety fallback, not the primary batching mechanism
- Normal flow: batch gradient thresholds or item_done trigger emits
- Timer only fires if stream stalls, packets lost, or provider delays
- Timer resets on each delta
- If timer fires, emit current buffered content as "updated"

**Retry logic:**
- If onEmit fails, retry up to retryAttempts times
- Use exponential backoff starting at retryBaseMs
- Cap delay at retryMaxMs
- If all retries fail, throw error

---

## Output Object Types

### Message Upsert (user)

Emitted once when user message item completes. Held until item_done to ensure correct origin.

| Field | Value |
|-------|-------|
| type | "item_upsert" |
| itemType | "message" |
| changeType | "completed" |
| origin | "user" |
| content | Full message text |

### Message Upsert (agent)

Emitted multiple times as content streams. First emission is "created", subsequent are "updated", final is "completed".

| Field | Value |
|-------|-------|
| type | "item_upsert" |
| itemType | "message" |
| changeType | "created" or "updated" or "completed" |
| origin | "agent" |
| content | Full accumulated text so far |

### Reasoning Upsert

Emitted for thinking/reasoning blocks. Includes providerId so UI can decide whether to display.

| Field | Value |
|-------|-------|
| type | "item_upsert" |
| itemType | "reasoning" |
| changeType | "created" or "updated" or "completed" |
| providerId | "anthropic" or "openai" etc |
| content | Full accumulated reasoning text |

### Tool Call Upsert

Emitted when function_call item completes. Not streamed (arguments come complete).

| Field | Value |
|-------|-------|
| type | "item_upsert" |
| itemType | "tool_call" |
| changeType | "completed" |
| toolName | Name of the tool |
| toolArguments | Parsed arguments object |
| callId | Identifier linking to output |

### Tool Output Upsert

Emitted when function_call_output item completes.

| Field | Value |
|-------|-------|
| type | "item_upsert" |
| itemType | "tool_output" |
| changeType | "completed" |
| callId | Links to corresponding tool_call |
| toolOutput | Parsed output object or string |
| success | Boolean indicating success |

### Error Upsert

Emitted on item_error.

| Field | Value |
|-------|-------|
| type | "item_upsert" |
| itemType | "error" |
| changeType | "completed" |
| errorCode | Error code string |
| errorMessage | Error description |

### Turn Started Event

Emitted immediately on response_start.

| Field | Value |
|-------|-------|
| type | "turn_started" |
| turnId | Turn identifier |
| threadId | Thread identifier |
| modelId | Model being used |
| providerId | Provider being used |

### Turn Completed Event

Emitted on response_done after flushing buffers.

| Field | Value |
|-------|-------|
| type | "turn_completed" |
| turnId | Turn identifier |
| threadId | Thread identifier |
| status | "complete" or "error" or "aborted" |
| usage | Token counts if available |

### Turn Error Event

Emitted on response_error.

| Field | Value |
|-------|-------|
| type | "turn_error" |
| turnId | Turn identifier |
| threadId | Thread identifier |
| error | Object with code and message |

---

## Functional Test Cases

### TC-01: Simple Agent Message

**Scenario:** Agent responds with a short message under one batch threshold.

**Input events:**
1. response_start with provider "anthropic"
2. item_start with item_id "msg-1", item_type "message"
3. item_delta with delta_content "Hello there!"
4. item_done with final_item containing content "Hello there!", origin "agent"
5. response_done with status "complete"

**Expected outputs:**
1. turn_started event with modelId, providerId
2. item_upsert: itemType "message", changeType "created", content "Hello there!", origin "agent"
3. item_upsert: itemType "message", changeType "completed", content "Hello there!", origin "agent"
4. turn_completed event with status "complete"

---

### TC-02: Agent Message With Batching

**Scenario:** Agent responds with content that exceeds first batch threshold (10 tokens).

**Input events:**
1. response_start
2. item_start with item_id "msg-1", item_type "message"
3. item_delta with 20 characters (~5 tokens) "Hello, how are you?"
4. item_delta with 30 characters (~8 tokens) " I hope you're having a great"
5. item_delta with 20 characters (~5 tokens) " day today!"
6. item_done with final content
7. response_done

**Expected outputs:**
1. turn_started
2. item_upsert: changeType "created", content "Hello, how are you?" (after first delta, under threshold)
3. item_upsert: changeType "updated", content "Hello, how are you? I hope you're having a great" (threshold crossed)
4. item_upsert: changeType "completed", content "Hello, how are you? I hope you're having a great day today!"
5. turn_completed

---

### TC-03: User Message (Held Until Complete)

**Scenario:** User message should not emit until item_done to ensure correct origin.

**Input events:**
1. response_start
2. item_start with item_id "run-123-user-prompt", item_type "message"
3. item_done with final_item containing content "What is the weather?", origin "user"
4. (agent response events...)
5. response_done

**Expected outputs:**
1. turn_started
2. item_upsert: itemType "message", changeType "completed", content "What is the weather?", origin "user"
3. (agent response upserts...)
4. turn_completed

Note: No "created" or "updated" emitted for user message - single "completed" emission.

---

### TC-04: Anthropic Reasoning Block

**Scenario:** Anthropic model emits thinking/reasoning before response.

**Input events:**
1. response_start with provider "anthropic"
2. item_start with item_type "reasoning"
3. item_delta with reasoning content (multiple deltas)
4. item_done for reasoning
5. item_start with item_type "message"
6. item_delta with message content
7. item_done for message
8. response_done

**Expected outputs:**
1. turn_started with providerId "anthropic"
2. item_upsert: itemType "reasoning", changeType "created", providerId "anthropic"
3. item_upsert: itemType "reasoning", changeType "updated" (if batching triggers)
4. item_upsert: itemType "reasoning", changeType "completed"
5. item_upsert: itemType "message", changeType "created"
6. item_upsert: itemType "message", changeType "completed"
7. turn_completed

---

### TC-05: Tool Call and Output

**Scenario:** Agent calls a tool and receives output.

**Input events:**
1. response_start
2. item_start with item_type "function_call", name "read_file"
3. item_done with final_item containing name "read_file", arguments '{"path": "/tmp/test.txt"}', call_id "call-1"
4. item_start with item_type "function_call_output"
5. item_done with final_item containing call_id "call-1", output '{"content": "file contents"}', success true
6. (agent continues with message...)
7. response_done

**Expected outputs:**
1. turn_started
2. item_upsert: itemType "tool_call", changeType "completed", toolName "read_file", toolArguments {path: "/tmp/test.txt"}, callId "call-1"
3. item_upsert: itemType "tool_output", changeType "completed", callId "call-1", toolOutput {content: "file contents"}, success true
4. (message upserts...)
5. turn_completed

---

### TC-06: Multiple Tool Calls in Sequence

**Scenario:** Agent calls multiple tools before responding.

**Input events:**
1. response_start
2. function_call "read_file" with call_id "call-1"
3. function_call_output for "call-1"
4. function_call "write_file" with call_id "call-2"
5. function_call_output for "call-2"
6. agent message
7. response_done

**Expected outputs:**
1. turn_started
2. tool_call upsert for "read_file"
3. tool_output upsert for call-1
4. tool_call upsert for "write_file"
5. tool_output upsert for call-2
6. message upserts
7. turn_completed

---

### TC-07: Item Error Mid-Stream

**Scenario:** An item encounters an error during processing.

**Input events:**
1. response_start
2. item_start for message
3. item_delta with partial content
4. item_error with error code "CONTENT_FILTER", message "Content blocked"
5. response_done with status "error"

**Expected outputs:**
1. turn_started
2. item_upsert: changeType "created" with partial content
3. item_upsert: itemType "error", errorCode "CONTENT_FILTER", errorMessage "Content blocked"
4. turn_completed with status "error"

---

### TC-08: Response Error

**Scenario:** Turn-level error occurs.

**Input events:**
1. response_start
2. response_error with error code "RATE_LIMIT", message "Too many requests"

**Expected outputs:**
1. turn_started
2. turn_error with error code "RATE_LIMIT", message "Too many requests"

---

### TC-09: Batch Timeout (Safety Fallback)

**Scenario:** Stream stalls, timeout forces emit of buffered content.

**Setup:**
- batchTimeoutMs set to 1000ms (or shorter for test)

**Input events:**
1. response_start
2. item_start for message
3. item_delta with 10 characters (~2 tokens)
4. (timeout period passes with no more deltas)
5. item_delta with 10 more characters
6. item_done

**Expected outputs:**
1. turn_started
2. item_upsert: changeType "created" with first delta content
3. item_upsert: changeType "updated" with accumulated content (after timeout fires)
4. item_upsert: changeType "updated" with more content (or merged with next)
5. item_upsert: changeType "completed"
6. turn_completed

Note: In normal operation, batch gradient or item_done triggers emits before timeout. This test verifies the safety fallback.

---

### TC-10: Batch Gradient Progression

**Scenario:** Long response exercises multiple batch gradient levels.

**Input events:**
1. response_start
2. item_start for message
3. Multiple item_deltas totaling ~500 tokens

**Expected outputs:**
1. turn_started
2. Upserts at approximately: 10, 20, 40, 60, 110, 160, 210, 260, 360, 460 tokens (following gradient)
3. Final completed upsert
4. turn_completed

Gradient: [10, 10, 20, 20, 50, 50, 50, 50, 100, 100, ...]
Cumulative thresholds: 10, 20, 40, 60, 110, 160, 210, 260, 360, 460, ...

---

### TC-11: Empty Content Item

**Scenario:** Item starts and completes with no content.

**Input events:**
1. response_start
2. item_start with item_type "message", no initial_content
3. item_done with empty content
4. response_done

**Expected outputs:**
1. turn_started
2. item_upsert: changeType "completed", content "" (empty string)
3. turn_completed

---

### TC-12: Flush on Destroy

**Scenario:** Processor destroyed with content still buffered.

**Input events:**
1. response_start
2. item_start for message
3. item_delta with content
4. (destroy() called without item_done or response_done)

**Expected behavior:**
- flush() should be called implicitly or explicitly before destroy()
- Any buffered content should be emitted
- Timers should be cleared
- No memory leaks

---

### TC-13: Redis Emit Retry

**Scenario:** First emit attempt fails, retry succeeds.

**Setup:**
- onEmit configured to fail once then succeed

**Input events:**
1. response_start

**Expected behavior:**
- First emit attempt fails
- Wait 1 second (retryBaseMs)
- Second emit attempt succeeds
- turn_started event eventually delivered

---

### TC-14: Redis Emit Retry Exhausted

**Scenario:** All retry attempts fail.

**Setup:**
- onEmit configured to always fail
- retryAttempts set to 3

**Input events:**
1. response_start

**Expected behavior:**
- Attempt 1 fails, wait 1s
- Attempt 2 fails, wait 2s
- Attempt 3 fails, wait 4s (capped at 10s)
- Attempt 4 fails
- processEvent throws error after retries exhausted

---

## Next Steps

1. Build TDD test harness for UpsertStreamProcessor
2. Create mock fixtures for all test cases
3. Wire up tests against skeleton (all should fail with NotImplementedError)
4. Implement methods until all tests pass

---

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
