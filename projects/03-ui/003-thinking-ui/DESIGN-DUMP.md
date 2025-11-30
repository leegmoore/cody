# Design Dump: xapi - Experience API Layer

**Date:** 2025-11-29
**Updated:** 2025-11-29 (pivoted from client library to server-side UX layer)

**Purpose:** Raw research, thoughts, and trade-offs for building an Experience API (xapi) that provides UI-ready streaming and data shapes. This is a thinking dump, not a finalized design.

---

## Architecture Decision: Server-Side UX Processing

**Original idea:** Client-side library that processes raw SSE events into upserts.

**Revised approach:** Server-side xapi layer that:
- Consumes v2 API internally
- Processes events server-side
- Emits UI-ready upserts via SSE
- Uses clean terminology ("turn" not "run")
- Same shapes for streaming and persistence

**Why server-side:**
1. Single source of truth for UX logic - no client bundle to maintain
2. Thinner client - browser just receives and renders
3. Testable on server - integration tests hit xapi endpoints
4. Consistent format - streaming and persistence return same shapes
5. Future flexibility - transport changes are server-side only

**The layer separation:**
```
/api/v2/   - System API (raw events, canonical shapes, internal use)
/xapi/     - Experience API (UI-ready upserts, clean terminology)
```

---

## Terminology: "turn" not "run"

The v2 API uses "runId" which is terrible naming:
- Generic - could mean anything
- No domain meaning - doesn't indicate LLM conversation
- Conflicts with other systems (CI runs, test runs, etc.)
- Verb/noun confusion

**xapi uses "turn":**
- User submits prompt + agent responds = one turn
- Conversational domain language
- Clear meaning

**Boundary translation:**
- xapi receives/returns: turnId
- xapi calls v2 internally with: runId (same UUID value)
- UI only ever sees turnId

**v2 stays unchanged for now.** Once xapi is solid and tested, we can refactor v2 to align terminology.

---

## The Problem in Detail

### Current Architecture Flow

**Live Streaming Path:**
```
1. User types message → app.js:sendMessage()
2. UI immediately shows user message via addUserMessage()
3. pendingUserMessages[] tracks {runId: null, elementId, tempId}
4. POST /submit → returns runId
5. pendingUserMessages entry updated with runId
6. streamRun(runId) opens EventSource
7. Each SSE event:
   a. handleThinkingEvent() - routes reasoning to ThinkingCardManager (Anthropic only)
   b. ResponseReducer.apply() - builds full Response snapshot
   c. renderResponseItems(snapshot.output_items) - re-renders everything
8. renderResponseItems() on every event:
   - iterates ALL output_items
   - for each item, checks if already rendered via getRenderedElement()
   - if not rendered, renders it
   - if rendered, may update content
```

**Persistence Loading Path:**
```
1. switchThread() → loadThread()
2. GET /threads/:id → returns {thread, runs[]}
3. Each run has output_items array (already complete)
4. For each run: renderResponseItems(run.output_items, {status: 'complete'})
5. renderResponseItems sees status='complete', renders reasoning items as ThinkingCards
```

### Where It Breaks

**Problem 1: User Message Origin Dance**

The adapters emit user messages like this:
```
item_start: {item_id: "xxx-user-prompt", item_type: "message"}
  → buffer has NO origin yet, defaults to "agent"
  → refreshBufferedItem() creates message item with origin="agent"

item_done: {item_id: "xxx-user-prompt", final_item: {origin: "user"}}
  → finally sets correct origin
```

So the UI sees the user message TWICE - first with wrong origin, then with correct origin. The UI has to:
- Skip rendering when ID contains "-user-prompt" AND origin is "agent"
- Match pending message by runId when origin becomes "user"
- Update element's data-item-id to match stream item ID
- Clean up old itemId from renderedItems map

This is THREE separate hacks to work around one fundamental issue.

**Problem 2: Full Snapshot Re-rendering**

Every single SSE event triggers:
```javascript
renderResponseItems(snapshot.output_items || [], {...})
```

If there are 5 items and we've rendered 4, we still iterate all 5 to find the 1 that changed. The UI has to:
- Check getRenderedElement() for each item
- If exists, compare content and update
- If not exists, create new element
- Track runAgentAnchors to reuse streaming message elements

This is O(n) on every event, where n = total items so far.

**Problem 3: Reasoning Item Dual Path**

For Anthropic, reasoning comes in two forms:
1. Streamed: item_start → item_delta* → item_done (thinking content in deltas)
2. Summary-only: item_done with final_item containing summary array

The OpenAI adapter has similar complexity for reasoning:
```javascript
// Handle reasoning items that come with summary field (not content)
if (itemType === "reasoning" && !item) {
  const summaryArray = itemPayload?.summary;
  // ... extract text from summary array
}
```

The UI currently handles this via:
- handleThinkingEvent() in stream.js intercepts reasoning events
- Only for Anthropic provider (tracked in runProviders map)
- Creates/appends/completes ThinkingCards before reducer processes
- renderResponseItems() skips reasoning items during live streaming

But on refresh, renderResponseItems() creates ThinkingCards from persisted reasoning items.

**Problem 4: Tool Call State Management**

Tool calls have their own state system:
```javascript
state.toolCalls = []  // Array of call objects
state.toolCallTimelines = new Map()  // runId → DOM element
state.toolCallSequence = 0  // For ordering
```

The reducer produces function_call items, but the UI:
- Creates/finds call in state.toolCalls array
- Ensures timeline element exists
- Updates stack display
- Opens modal on click
- Matches function_call_output by call_id

This is a THIRD state system (alongside renderedItems and pendingUserMessages).

**Problem 5: Multiple Agent Anchors**

For streaming agent messages:
```javascript
state.runAgentAnchors = new Map()  // runId → {itemId, elementId}
```

When streaming starts, we create an agent message element. As deltas arrive, we need to update THAT element. The anchor tracks which element belongs to which run.

But if we get item_done with a different itemId, we have to:
- Check if anchor exists for this run
- If so, reuse its element
- Update renderedItems with new itemId → same elementId

---

## What the Adapters Actually Emit

### OpenAI Responses API Adapter

Events emitted (in order for a simple response):
1. `response_start` - contains model_id, provider_id, thread_id, etc.
2. `item_start` (user message) + `item_done` (user message with origin=user)
3. `item_start` (agent message, type=message)
4. `item_delta` * N (content chunks)
5. `item_done` (agent message, origin=agent)
6. `usage_update`
7. `response_done`

For reasoning (when reasoningEffort set):
- `response.reasoning.delta` events → converted to item_start/delta/done for type=reasoning
- Reasoning may come as summary only (no deltas, just final_item with summary array)

For tool calls:
- `response.output_tool_calls.delta` → item_start/delta for function_call
- `response.output_tool_calls.done` → item_done for function_call
- Then publishes `item_start/done` for function_call_output

### Anthropic Messages API Adapter

Events emitted:
1. `response_start`
2. `item_start` (user message) + `item_done` (user message with origin=user)
3. `content_block_start` (type=thinking) → `item_start` (type=reasoning)
4. `content_block_delta` (thinking) → `item_delta`
5. `content_block_stop` → `item_done` (reasoning)
6. `content_block_start` (type=text) → `item_start` (type=message)
7. `content_block_delta` (text) → `item_delta`
8. `content_block_stop` → `item_done` (message)
9. Tool calls similar flow
10. `usage_update`
11. `response_done`

Key difference: Anthropic streams FULL thinking content in deltas. OpenAI may only provide summary.

---

## The Reducer's Role

The ResponseReducer:
1. Maintains `itemBuffers: Map<itemId, ItemBuffer>`
2. On item_start: creates buffer, sets type, maybe initial_content
3. On item_delta: appends to buffer chunks
4. On item_done: finalizes item with final_item, removes buffer
5. Returns full Response snapshot on every apply()

The reducer already tracks item state internally. But it returns EVERYTHING on every call, forcing the UI to diff.

The reducer also handles:
- Sequence violations (delta before start)
- Event deduplication (processedEventIds set)
- Origin normalization (updates buffer.meta.origin from final_item)

---

## Persisted Data Shape

From Convex (via thread-service):
```typescript
interface Response {
  id: string;          // runId
  turn_id: string;
  thread_id: string;
  agent_id?: string;
  model_id: string;
  provider_id: string;
  created_at: number;
  updated_at: number;
  status: "queued" | "in_progress" | "complete" | "error" | "aborted";
  output_items: OutputItem[];
  usage?: { prompt_tokens, completion_tokens, total_tokens };
  finish_reason: string | null;
  error: { code, message, details? } | null;
}
```

OutputItem types:
- message: {id, type, content, origin, correlation_id?}
- reasoning: {id, type, content, origin, correlation_id?}
- function_call: {id, type, name, arguments, call_id, origin}
- function_call_output: {id, type, call_id, output, success, origin}
- error, cancelled, script_execution, script_execution_output

On load, we get complete Response objects. Same shape as streaming produces - this is the "one shape, multiple hydration levels" principle working.

---

## Thoughts on the Proposed Solution

### Core Idea: Change Emission Not Snapshot Emission

Instead of:
```
Event → Reducer → Full Snapshot → UI diffs
```

Do:
```
Event → Library → ItemUpsert | ItemComplete → UI applies directly
```

### What an ItemUpsert Should Contain

```typescript
interface ItemUpsert {
  type: 'upsert';
  itemId: string;
  itemType: OutputItem['type'];
  changeType: 'created' | 'updated' | 'completed';
  item: Partial<OutputItem>;  // Current state of the item
  isComplete: boolean;

  // Context for rendering
  runId: string;
  providerId?: string;  // For Anthropic reasoning detection
}
```

Wait - should `item` be partial or full? During streaming, we don't have full state until item_done. But we want to show content as it arrives.

**Option A: Always full item state**
- Library accumulates internally
- Each upsert has complete current state
- UI can blindly render item.content

**Option B: Partial with deltas**
- Upsert includes delta AND accumulated
- `item.content` is accumulated, `delta` is the new chunk
- UI can animate the delta

I think Option A is cleaner for the UI. Library handles accumulation, UI just renders.

### When to Emit Upserts

**item_start:**
- Create internal buffer
- Emit `{changeType: 'created', isComplete: false}`
- For messages: only emit once we have content (skip empty starts?)

Wait - the user message issue. The adapter emits item_start with no origin, then item_done with origin. Should we:
1. Emit on item_start with wrong origin, then emit 'updated' when origin changes?
2. Hold the user message until item_done, then emit once with correct state?

Option 2 seems cleaner. The library can detect "-user-prompt" pattern and hold.

**item_delta:**
- Append to buffer
- Emit `{changeType: 'updated', isComplete: false}`
- Item contains accumulated content

**item_done:**
- Finalize buffer with final_item
- Emit `{changeType: 'completed', isComplete: true}`
- Item is complete final state

### Batching/Throttling

For fast streaming, we could get 50+ item_delta events per second. Emitting on every delta means 50+ UI updates per second.

Options:
1. **No batching** - emit every delta, let UI throttle
2. **Time-based batching** - accumulate deltas, emit every N ms
3. **Configurable** - batch interval as option, 0 = no batching

I lean toward configurable with sensible default (maybe 50ms?). Library accumulates deltas in batch window, emits combined upsert.

But wait - what about thinking cards? They want to show streaming text. If we batch too aggressively, the shimmer effect is lost.

Maybe different batching for different item types?
- reasoning: low batch interval (16ms? one frame)
- message: medium batch interval (50ms)
- tool calls: no batching (they're rare)

Or just let it be configurable and tune later.

### Tool Call Correlation

Currently function_call and function_call_output are separate items. They're linked by call_id.

Should library correlate them? Emit a combined "tool execution" with:
- call: the function_call item
- output: the function_call_output item (when available)
- status: 'pending' | 'executing' | 'complete' | 'error'

This would simplify UI tool rendering. No need to match by call_id.

But the user said: "the start and stop tool calls will just let client know when to switch from processing to done. plan to basically emit 1 tool call start and 1 tool call end chunk."

So maybe:
- function_call → emit as tool_start upsert
- function_call_output → emit as tool_complete upsert
- No intermediate streaming (there's nothing to stream for tool execution)

### Thinking Cards: Provider-Specific Handling

User said: "for anthropic only it will emit reasoning items like any other item. we'll hold off on other providers and just have them show 'Doing AI Stuff...' animated shimmer."

So:
- Anthropic reasoning → emit reasoning upserts, UI creates ThinkingCard
- OpenAI reasoning → DON'T emit reasoning upserts (or emit with flag to ignore?)
- Generic shimmer stays until first message content arrives

Actually, maybe we should emit reasoning for all providers, but include provider_id in upsert. UI decides whether to show ThinkingCard or ignore.

Or library config: `emitReasoning: 'anthropic-only' | 'all' | 'none'`

### Persistence Loading

User said: "it needs full response snapshots for loading from persistence rather than streaming"

Two paths:
1. **Streaming mode**: Event → Upsert emission
2. **Hydration mode**: Full Response → emit upserts for all items as completed

For hydration from persistence:
```javascript
library.hydrateFromResponse(persistedRun)
// Emits upsert for each output_item with changeType='completed', isComplete=true
```

The UI can handle these exactly like streamed items - just happens all at once.

But should these be batched differently? Emitting 20 upserts synchronously on page load is fine. The UI can batch DOM updates.

### Response-Level Events

Not just item upserts. The library should also emit:
- response_started: {runId, threadId, modelId, providerId}
- response_completed: {runId, status, usage, finishReason}
- response_error: {runId, error}

These let UI update status indicators, token counts, etc.

---

## The Library's Internal State

What does the library need to track?

```typescript
class StreamingHydrator {
  // Current response being built
  private currentResponse: {
    id: string;
    threadId: string;
    providerId: string;
    modelId: string;
    status: string;
    // ...
  } | null;

  // Item buffers (like reducer)
  private itemBuffers: Map<string, {
    id: string;
    type: OutputItem['type'];
    chunks: string[];
    meta: Record<string, unknown>;
    lastEmittedContent?: string;  // For diffing
    isHeld: boolean;  // For user messages
  }>;

  // Batching
  private pendingUpserts: ItemUpsert[];
  private batchTimer: number | null;
  private batchInterval: number;

  // Event deduplication
  private processedEventIds: Set<string>;

  // Callbacks
  private onItemUpsert: (upsert: ItemUpsert) => void;
  private onResponseEvent: (event: ResponseEvent) => void;
}
```

### Item Holding Logic

For user messages (ID contains '-user-prompt'):
1. On item_start: create buffer, set isHeld=true
2. On item_delta: append to buffer (still held)
3. On item_done: set origin from final_item, emit SINGLE upsert with changeType='created', isComplete=true

For other items:
1. On item_start: create buffer, emit if has initial_content
2. On item_delta: append, emit batched update
3. On item_done: finalize, emit completed

### What About the Existing Reducer?

The ResponseReducer already does most of this. Could we:
1. Keep reducer for full snapshot (for tests, persistence comparison)
2. Add parallel upsert emission

Or replace reducer entirely?

The reducer is used in:
- stream.js on frontend (via reducer.bundle.js)
- Test suites for verification

We could:
- Keep reducer for test verification
- New library for UI consumption
- Both process same events, different outputs

Or:
- New library wraps reducer
- Uses reducer for state, adds upsert emission

Leaning toward new library that shares concepts with reducer but doesn't depend on it. Cleaner separation.

---

## UI Simplification

If library emits upserts, UI becomes:

```javascript
const hydrator = new StreamingHydrator({
  batchInterval: 50,
  onItemUpsert: (upsert) => {
    switch (upsert.itemType) {
      case 'message':
        if (upsert.changeType === 'created') {
          if (upsert.item.origin === 'user') {
            renderUserMessage(upsert);
          } else {
            renderAgentMessage(upsert);
          }
        } else {
          updateMessageContent(upsert.itemId, upsert.item.content);
        }
        break;

      case 'reasoning':
        if (upsert.providerId === 'anthropic') {
          handleThinkingCard(upsert);
        }
        break;

      case 'function_call':
        if (upsert.changeType === 'created') {
          createToolCard(upsert);
        }
        break;

      case 'function_call_output':
        completeToolCard(upsert.item.call_id, upsert);
        break;
    }
  },

  onResponseEvent: (event) => {
    if (event.type === 'completed') {
      removeShimmer();
      updateTokenCount(event.usage);
    }
  }
});

// Streaming
hydrator.connectToSSE(`/stream/${runId}`);

// OR from persistence
persistedRuns.forEach(run => hydrator.hydrateFromResponse(run));
```

No more:
- pendingUserMessages array
- renderedItems map
- runAgentAnchors map
- Full snapshot diffing
- Origin change detection hacks

---

## State That Can Die

With upsert-based rendering, we can eliminate:

```javascript
// DELETE THESE
state.pendingUserMessages = [];      // Library handles user message holding
state.renderedItems = new Map();     // DOM is source of truth via data-item-id
state.runAgentAnchors = new Map();   // Library tracks streaming items

// KEEP THESE (for modal/UI state, not rendering logic)
state.toolCalls = [];                // Still needed for modal navigation
state.toolCallTimelines = new Map(); // Still needed for DOM cleanup
state.toolCallModalCallId = null;    // Modal state
```

Actually, even toolCalls[] could be simplified. Currently it's:
```javascript
{
  callId, toolName, arguments, output, status, type, startedAt, completedAt, runId, sequence
}
```

If upserts include all this info, UI could just query DOM or keep minimal state for modal.

---

## Test Strategy

Library should be heavily unit tested:

1. **Event sequence tests**
   - Simple message flow (start → delta → done)
   - User message holding (start → done with origin change)
   - Multi-item response
   - Tool call flow
   - Reasoning flow (Anthropic style)
   - Reasoning flow (OpenAI summary style)

2. **Batching tests**
   - Rapid deltas get batched
   - Batch interval configurable
   - Flush on completion

3. **Edge cases**
   - Duplicate events (same event_id)
   - Missing item_start (sequence violation)
   - Empty content
   - Very long content

4. **Persistence hydration tests**
   - Full response hydration
   - Multiple runs hydration
   - Order preservation

Each test: feed events, assert emitted upserts match expectations.

---

## Open Questions

1. **Naming**: "StreamingHydrator" vs "ResponseHydrator" vs "UpsertEmitter"?
   - Hydrator suggests building from parts (good)
   - Streaming suggests live events (but also handles persistence)
   - Maybe "ResponseProcessor" with streaming/batch modes?

2. **Bundle strategy**:
   - Library needs to work in browser (reducer.bundle.js pattern)
   - Same code in Node for server-side rendering?
   - Shared npm package or bundled file?

3. **Error recovery**:
   - What if connection drops mid-stream?
   - Can we resume? Does library track last event_id?
   - Or just clear state and reload from persistence?

4. **Memory management**:
   - Long conversation = many completed items
   - Should library forget completed items after emit?
   - Or keep for potential re-query?

5. **Thread context**:
   - Library instance per thread? Or per session?
   - How to handle thread switch?

---

## Rough Implementation Phases

### Phase 1: Core Upsert Logic
- Item buffer management
- Upsert emission on item events
- User message holding
- Basic batching

### Phase 2: Response Events
- response_start/done/error events
- Provider tracking
- Status updates

### Phase 3: Persistence Hydration
- hydrateFromResponse(run) method
- Emit completed upserts for all items

### Phase 4: UI Integration
- Replace reducer.bundle.js in stream.js
- Simplify renderResponseItems to upsert handler
- Remove legacy state management

### Phase 5: Test Coverage
- Unit tests for all paths
- Integration tests with mock SSE
- Comparison tests (library output matches reducer)

---

## xapi Route Structure

```
/xapi/threads                        GET     List threads
/xapi/threads                        POST    Create thread
/xapi/threads/:threadId              GET     Get thread with turns
/xapi/threads/:threadId              PATCH   Update thread
/xapi/threads/:threadId              DELETE  Delete thread
/xapi/threads/:threadId/turn         POST    Submit prompt → returns SSE stream

/xapi/turns/:turnId                  GET     Get single turn (refresh/debug)
```

**The key innovation: POST /turn returns SSE directly**

No more:
1. POST /submit → {runId}
2. GET /stream/:runId

Instead:
1. POST /turn → SSE stream (turnId in first event)

Client holds the connection, receives upserts until turn_completed.

---

## xapi Response Shapes

### UIUpsert (streaming and persistence)

```typescript
interface UIUpsert {
  type: 'item_upsert';
  turnId: string;
  threadId: string;
  itemId: string;
  itemType: 'message' | 'reasoning' | 'tool_call' | 'tool_output' | 'error';
  changeType: 'created' | 'updated' | 'completed';

  // The item data - shape depends on itemType
  item: UIMessageItem | UIReasoningItem | UIToolCallItem | UIToolOutputItem | UIErrorItem;
}

interface UIMessageItem {
  content: string;
  origin: 'user' | 'agent' | 'system';
}

interface UIReasoningItem {
  content: string;
  providerId: string;  // UI can filter: only show ThinkingCard for 'anthropic'
}

interface UIToolCallItem {
  callId: string;
  name: string;
  arguments: object;  // PARSED, not string - UI doesn't have to parse
}

interface UIToolOutputItem {
  callId: string;
  output: object;     // PARSED
  success: boolean;
}

interface UIErrorItem {
  code: string;
  message: string;
}
```

### UITurnEvent (response-level events)

```typescript
interface UITurnEvent {
  type: 'turn_started' | 'turn_completed' | 'turn_error';
  turnId: string;
  threadId: string;

  // Only on turn_started
  modelId?: string;
  providerId?: string;

  // Only on turn_completed
  status?: 'complete' | 'error' | 'aborted';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  // Only on turn_error
  error?: {
    code: string;
    message: string;
  };
}
```

### Thread response (GET /xapi/threads/:id)

```typescript
interface UIThread {
  threadId: string;
  title: string | null;
  summary: string | null;
  tags: string[];
  modelId: string;
  providerId: string;
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
}

interface UITurn {
  turnId: string;
  threadId: string;
  status: 'complete' | 'error' | 'aborted';
  items: UIUpsert[];  // All items as completed upserts
  usage?: { promptTokens, completionTokens, totalTokens };
  createdAt: string;
  updatedAt: string;
}

// GET /xapi/threads/:id response
{
  thread: UIThread;
  turns: UITurn[];
}
```

---

## xapi Implementation: The Turn Processor

The core logic that processes v2 events into UI upserts:

```typescript
class TurnProcessor {
  private turnId: string;
  private threadId: string;
  private providerId: string | null = null;

  // Item state (like reducer, but for upsert emission)
  private itemBuffers: Map<string, ItemBuffer>;
  private heldItems: Map<string, HeldItem>;  // User messages held until item_done

  // Batching
  private pendingUpserts: UIUpsert[];
  private batchInterval: number;

  // Output
  private emit: (upsert: UIUpsert | UITurnEvent) => void;

  processEvent(event: StreamEvent): void {
    // Handle response_start → emit turn_started
    // Handle item_start → create buffer, maybe emit 'created'
    // Handle item_delta → append, batch emit 'updated'
    // Handle item_done → emit 'completed'
    // Handle response_done → emit turn_completed
    // etc.
  }

  // For persistence loading
  hydrateFromRun(run: Response): UIUpsert[] {
    // Convert each output_item to completed UIUpsert
  }
}
```

**Key behaviors:**

1. **User message holding**: When item_id contains '-user-prompt', hold until item_done, then emit ONCE with correct origin.

2. **Batching**: Accumulate deltas for ~50ms, emit combined 'updated' upsert with full accumulated content.

3. **Reasoning filtering**: Include providerId in reasoning upserts. UI decides whether to render ThinkingCard.

4. **Tool call parsing**: Parse arguments/output JSON server-side. UI receives objects, not strings.

5. **Turn events**: Emit turn_started (with turnId, modelId, providerId) and turn_completed (with status, usage).

---

## Client Code With xapi

```javascript
// Submit and stream a turn
async function submitTurn(threadId, prompt) {
  const response = await fetch(`/xapi/threads/${threadId}/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, thinkingBudget: 1536 }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = JSON.parse(line.slice(5));

      if (data.type === 'turn_started') {
        state.currentTurnId = data.turnId;
        removeShimmer();
      }
      else if (data.type === 'item_upsert') {
        applyUpsert(data);
      }
      else if (data.type === 'turn_completed') {
        updateUsage(data.usage);
        enableInput();
      }
    }
  }
}

function applyUpsert(upsert) {
  const elementId = `item-${upsert.itemId}`;

  switch (upsert.itemType) {
    case 'message':
      if (upsert.changeType === 'created') {
        if (upsert.item.origin === 'user') {
          createUserMessage(elementId, upsert.item.content);
        } else {
          createAgentMessage(elementId, upsert.item.content);
        }
      } else {
        updateMessageContent(elementId, upsert.item.content);
      }
      break;

    case 'reasoning':
      if (upsert.item.providerId === 'anthropic') {
        handleThinkingCard(upsert);
      }
      // else: ignore, generic shimmer handles it
      break;

    case 'tool_call':
      if (upsert.changeType === 'created') {
        createToolCard(upsert.item);
      }
      break;

    case 'tool_output':
      completeToolCard(upsert.item.callId, upsert.item);
      break;
  }
}

// Load thread (persistence)
async function loadThread(threadId) {
  const response = await fetch(`/xapi/threads/${threadId}`);
  const { thread, turns } = await response.json();

  clearChat();
  setThreadTitle(thread.title);

  for (const turn of turns) {
    for (const upsert of turn.items) {
      applyUpsert(upsert);  // SAME function as streaming!
    }
  }
}
```

**Note:** `applyUpsert()` is identical for streaming and persistence. That's the win.

---

## What Dies in the UI

With xapi, we eliminate:

```javascript
// DELETE - xapi handles user message timing
state.pendingUserMessages = [];

// DELETE - DOM is source of truth via data-item-id
state.renderedItems = new Map();

// DELETE - xapi tracks streaming items
state.runAgentAnchors = new Map();

// DELETE - no more reducer in browser
import { ResponseReducer } from './reducer.bundle.js';

// DELETE - xapi does the filtering
function handleThinkingEvent() { ... }
```

What remains:
```javascript
state.toolCalls = [];           // For modal navigation (could simplify further)
state.toolCallTimelines = new Map();  // DOM element tracking
state.currentThreadId = null;
state.currentTurnId = null;     // renamed from currentRunId
```

---

## Migration Path

**Phase 1: Build xapi routes**
- Implement TurnProcessor class
- Wire up /xapi/threads/:id/turn POST → SSE
- Wire up /xapi/threads/:id GET → thread with turns
- Unit test TurnProcessor thoroughly

**Phase 2: Build new UI code**
- New stream.js that consumes xapi
- New simpler state management
- Keep old code, feature flag between them

**Phase 3: Test and validate**
- Integration tests for xapi endpoints
- Manual testing of UI
- Compare behavior old vs new

**Phase 4: Cut over**
- Remove feature flag
- Delete old stream.js, reducer.bundle.js
- Delete legacy state management
- Clean up v2 routes if no longer needed externally

**Phase 5: Later - v2 terminology refactor**
- Rename runId → turnId in v2
- Align persistence schema
- This is safe because xapi abstracts it

---

## Summary

**The core insight**: Streaming and UX formatting belong server-side. The UI should receive ready-to-render shapes, not raw system events.

**Key design decisions**:
- xapi as UX layer, v2 stays as system API
- "turn" terminology in xapi (maps to runId internally)
- POST /turn returns SSE directly (no separate stream endpoint)
- Same UIUpsert shape for streaming and persistence
- Server-side batching, user message holding, JSON parsing
- UI becomes pure rendering - no event processing

**What changes**:
- New /xapi/ routes with TurnProcessor
- UI consumes xapi, much simpler code
- Same applyUpsert() for streaming and loading
- Remove reducer.bundle.js, legacy state management

**Risk mitigation**:
- Build alongside existing system
- Feature flag for gradual rollout
- Comprehensive tests before cutover
- v2 unchanged until xapi proven
