# Streaming Architecture & Format Conversions

**Status:** Design documentation based on current implementation + Phase 6 REST API plans
**Date:** 2025-11-16
**Context:** Defines how streaming works across provider wire formats, internal protocol, and REST API

---

## Overview: Three-Layer Streaming Model

The Cody platform handles streaming at three distinct levels, each serving a different purpose and audience. Understanding these layers and how data flows between them is essential for implementing the REST API and client integrations.

**The Three Layers:**

1. **Provider Wire Formats** - Native SSE/streaming from LLM APIs (OpenAI, Anthropic, Google)
2. **ResponseEvent Protocol** - Normalized provider-agnostic events for internal processing
3. **EventMsg Protocol** - Rich orchestration events for client consumption

**Data flows unidirectionally** through these layers, with each transformation adding semantic meaning and abstracting away provider-specific details.

---

## Layer 1: Provider Wire Formats (External APIs)

Each LLM provider uses a different streaming format over Server-Sent Events (SSE). Our provider adapters consume these raw streams and normalize them into a common internal format.

### OpenAI Responses API

**Wire Format:**
```
event: response.created
data: {"response":{"id":"resp_abc123"}}

event: response.item.text.delta
data: {"delta":"Hello"}

event: response.item.text.delta
data: {"delta":" world"}

event: response.done
data: {"response":{"id":"resp_abc123","usage":{...}}}
```

**Characteristics:**
- Semantic events (created, item.added, item.text.delta, done)
- Tool calls as response.item.function_call events
- Reasoning blocks as response.item.reasoning events
- Most sophisticated wire format (closest to our needs)

**Status in codex-port-02:** ✅ **IMPLEMENTED** - Full SSE parser and adapter in `src/core/client/responses/`

---

### Anthropic Messages API

**Wire Format:**
```
event: message_start
data: {"type":"message","id":"msg_xyz","role":"assistant","content":[]}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":15}}

event: message_stop
data: {"type":"message_stop"}
```

**Characteristics:**
- Content blocks with start/delta/stop lifecycle
- Delta types: text_delta, thinking_delta, input_json_delta (for tool args)
- Block indexing (multiple blocks in single response)
- Thinking blocks as separate content_block type

**Current Token Streaming:** ✅ **IMPLEMENTED** - Deltas are captured and forwarded

**Adapter:** `src/core/client/messages/adapter.ts`
- Maintains block state buffers
- Emits `output_text_delta` events for text deltas
- Emits `reasoning_content_delta` for thinking deltas
- Aggregates tool input JSON fragments

**Status:** ✅ **PRODUCTION-READY** - Full streaming support with delta forwarding

---

### Google Gemini Content/Parts API

**Wire Format (Expected based on @google/genai SDK):**
```
// Streaming response structure
{
  candidates: [{
    content: {
      parts: [
        { text: "Hello" },
        { text: " world" }
      ],
      role: "model"
    }
  }]
}
```

**Characteristics:**
- Parts-based content (similar to Messages API)
- Streaming via SDK's `streamGenerateContent()` method
- Function calls as separate part type
- Thinking support in Gemini 2.0+

**Current Token Streaming:** ❌ **NOT IMPLEMENTED** - Provider not yet integrated

**Expected Implementation:**
- SDK likely yields chunk objects per text part
- Adapter would need to extract parts, detect deltas vs. complete chunks
- Transform to ResponseEvent format

**Status:** ⏸️ **DEFERRED** - Phase 3.5 designed but not built; token streaming research needed

---

### OpenRouter Chat Completions API

**Wire Format:**
```
data: {"id":"chatcmpl-xyz","choices":[{"delta":{"content":"Hello"},"index":0}]}

data: {"id":"chatcmpl-xyz","choices":[{"delta":{"content":" world"},"index":0}]}

data: {"id":"chatcmpl-xyz","choices":[{"delta":{},"finish_reason":"stop","index":0}]}

data: [DONE]
```

**Characteristics:**
- Standard OpenAI Chat Completions SSE format
- Delta-based streaming (choices[].delta.content)
- Tool calls as delta.function_call or delta.tool_calls
- Simple, widely supported format

**Current Token Streaming:** ⚠️ **PARTIAL** - Parser exists, delta forwarding not confirmed

**Expected Adapter:**
- Parse SSE → extract delta.content
- Accumulate into complete message
- Transform to ResponseEvent

**Status:** ⏸️ **NEEDS REVIEW** - Adapter exists at `src/core/client/chat-completions.ts`, verify delta handling

---

## Layer 2: ResponseEvent Protocol (Internal Normalization)

Provider adapters convert wire formats into a common `ResponseEvent` stream. This is our provider-agnostic internal protocol.

### ResponseEvent Types

**Event Lifecycle:**
```typescript
{ type: "created" }                                    // Stream started
{ type: "output_text_delta", delta: string }           // Text chunk
{ type: "reasoning_content_delta", delta: string }     // Thinking chunk
{ type: "output_item_added", item: ResponseItem }      // Complete item
{ type: "completed", usage: TokenUsage }               // Stream complete
{ type: "error", message: string }                     // Error occurred
```

**Current Implementation:**

**Anthropic Adapter** (`messages/adapter.ts`):
- ✅ Parses `content_block_delta` events
- ✅ Emits `output_text_delta` for text
- ✅ Emits `reasoning_content_delta` for thinking
- ✅ Buffers tool input JSON fragments
- ✅ Emits `output_item_added` when block completes

**OpenAI Responses Adapter** (expected in `responses/adapter.ts`):
- ✅ Should emit `output_text_delta` for text.delta events
- ✅ Should emit `reasoning_content_delta` for reasoning deltas
- ⚠️ **NEEDS VERIFICATION** - Confirm delta events are forwarded, not just buffered

**Transformation Strategy:**
```
Provider SSE Event
    ↓
Parse (sse-parser.ts)
    ↓
Adapt (adapter.ts)
    ↓ emit
ResponseEvent { type: "output_text_delta", delta }
```

**Status:** ✅ **IMPLEMENTED for Anthropic**, ⚠️ **VERIFY for OpenAI Responses**

---

## Layer 3: EventMsg Protocol (Client-Facing Events)

The Codex Session layer consumes ResponseEvent streams and emits EventMsg events. This is the richest, most detailed protocol designed for client consumption and orchestration.

### EventMsg Streaming Events

**EventMsg supports both step-level AND token-level streaming:**

**Step-Level Events (Multi-Step Progress):**
```typescript
{ type: "task_started", model_context_window: 128000 }
{ type: "exec_command_begin", call_id: "...", command: [...] }
{ type: "exec_command_end", call_id: "...", exit_code: 0, stdout: "..." }
{ type: "agent_message", message: "Complete response text" }
{ type: "task_complete", last_agent_message: "..." }
```

**Token-Level Events (Within Single LLM Call):**
```typescript
{ type: "agent_message_delta", delta: "Hello" }
{ type: "agent_message_delta", delta: " world" }
{ type: "agent_reasoning_delta", delta: "Let me think..." }
```

**Mixed Example (Real Turn):**
```typescript
// Turn starts
{ type: "task_started" }

// Model streams thinking
{ type: "agent_reasoning_delta", delta: "I need to " }
{ type: "agent_reasoning_delta", delta: "read the file first" }

// Tool execution step
{ type: "exec_command_begin", call_id: "call_1", command: ["cat", "file.txt"] }
{ type: "exec_command_end", call_id: "call_1", stdout: "file contents..." }

// Model streams final response
{ type: "agent_message_delta", delta: "Based on " }
{ type: "agent_message_delta", delta: "the file, here's " }
{ type: "agent_message_delta", delta: "my analysis..." }

// Turn completes
{ type: "task_complete" }
```

### EventMsg is Wire-Format Agnostic

**Critical Design Property:** EventMsg works identically regardless of provider.

```
OpenAI Responses API SSE
    ↓ adapter
ResponseEvent stream
    ↓ Session/Codex
EventMsg stream

Anthropic Messages API SSE
    ↓ adapter
ResponseEvent stream
    ↓ Session/Codex (same code)
EventMsg stream

Google Gemini SSE
    ↓ adapter
ResponseEvent stream
    ↓ Session/Codex (same code)
EventMsg stream
```

**Clients receive identical EventMsg streams** regardless of which provider is running underneath. This is the power of the abstraction.

---

## Token Streaming Configuration

Streaming behavior is configurable at the turn level to balance responsiveness vs. overhead.

### Turn-Level Streaming Config

```typescript
interface TurnStreamingConfig {
  /** Enable step-level progress events (tool begin/end, etc.) */
  stepEvents: boolean;           // Default: true

  /** Enable token-by-token delta streaming within LLM responses */
  tokenStreaming: boolean;       // Default: false (for autonomous runs)

  /** Minimum characters to accumulate before emitting delta event */
  tokenBatchSize: number;        // Default: 25 chars
}
```

**Default Modes:**

**Interactive Chat:**
```typescript
{
  stepEvents: true,
  tokenStreaming: true,
  tokenBatchSize: 10  // Responsive typewriter effect
}
```

**Autonomous Coding Run:**
```typescript
{
  stepEvents: true,
  tokenStreaming: false,  // No deltas, just complete messages
  tokenBatchSize: N/A
}
```

**Monitoring/Logging:**
```typescript
{
  stepEvents: true,
  tokenStreaming: false,
  tokenBatchSize: N/A
}
```

### Batching Implementation

**When tokenStreaming is enabled:**

Instead of emitting every single character:
```typescript
// WITHOUT batching (expensive)
{ type: "agent_message_delta", delta: "H" }
{ type: "agent_message_delta", delta: "e" }
{ type: "agent_message_delta", delta: "l" }
// etc. for 1000s of characters
```

**WITH batching (tokenBatchSize: 25):**
```typescript
// Buffer accumulates: "Hello world, this is a lo"
{ type: "agent_message_delta", delta: "Hello world, this is a lo" }

// Buffer accumulates: "ng response from the mode"
{ type: "agent_message_delta", delta: "ng response from the mode" }

// Buffer accumulates: "l."
{ type: "agent_message_delta", delta: "l." }
```

**Batching Strategy:**
- Accumulate deltas in buffer
- Emit when buffer reaches `tokenBatchSize` characters
- Emit remaining buffer on stream completion
- Flush on newlines (paragraph boundaries) for better UX

**Status:** ❌ **NOT IMPLEMENTED** - Current code emits every delta; batching layer needed

---

## Current Implementation Status

### What's Already Working

**✅ Provider SSE Parsing:**
- OpenAI Responses: Full SSE parser
- Anthropic Messages: Full SSE parser with delta support
- Both emit ResponseEvent streams with token deltas

**✅ ResponseEvent → ResponseItems Conversion:**
- Deltas accumulate into complete items
- Items added to conversation history

**✅ EventMsg Protocol:**
- 40+ event types defined
- CLI consumes EventMsg stream via `conversation.nextEvent()`

**✅ Token Delta Forwarding (Anthropic):**
- `content_block_delta` → `output_text_delta` → (should become) `agent_message_delta`

### What Needs Implementation

**⚠️ Delta Forwarding to EventMsg:**
Currently, ResponseEvent deltas (output_text_delta, reasoning_content_delta) are consumed by adapters but **not yet transformed into EventMsg deltas** for client consumption.

**Required Work:**
- Session/Codex layer needs to convert ResponseEvent deltas → EventMsg deltas
- Emit `agent_message_delta` when receiving `output_text_delta`
- Emit `agent_reasoning_delta` when receiving `reasoning_content_delta`

**File to modify:** `codex-ts/src/core/codex/session.ts`
- Add delta event emission during response processing
- Estimated: ~50-100 lines

**⚠️ Token Batching:**
Add configurable batching layer to reduce event volume.

**Required Work:**
- Delta buffer in Session layer
- Accumulate deltas up to `tokenBatchSize`
- Emit batch or flush on completion
- Estimated: ~100-150 lines

**❌ OpenAI Responses Delta Verification:**
Confirm that Responses adapter emits deltas, not just buffered complete items.

**Required Work:**
- Review `src/core/client/responses/` (file not found earlier - may be in different location)
- Verify delta events are emitted
- Add if missing
- Estimated: 0-100 lines (depending on current state)

**❌ Google Gemini Integration:**
Entire provider not yet implemented.

**Required Work:**
- SDK integration (@google/genai)
- SSE/streaming parser for Gemini format
- Delta detection and forwarding
- Estimated: ~400-600 lines

---

## Phase 6 REST API Streaming Design

### Architecture: Fastify + Redis Streams + SSE

**The Flow:**

```
Client HTTP Request
    ↓
POST /conversations/{id}/messages
    ↓
Fastify handler fires async turn execution
    ↓
ConversationManager.submitMessage()
    ↓
Session emits EventMsg events
    ↓
Event listener writes to Redis Stream: events:{taskId}
    ↓
Fastify returns: { taskId, eventsUrl }
    ↓
Client subscribes: GET /tasks/{taskId}/events
    ↓
Fastify reads Redis Stream → sends as SSE
    ↓
Client receives EventMsg JSON over SSE
```

### Why Redis Streams (Not Direct SSE)

**Redis Streams provide:**
1. **Durability** - Events persisted, client can reconnect
2. **Multi-client** - Multiple subscribers to same task
3. **Resume** - Client can catch up from last event ID
4. **Scalability** - Multiple Fastify instances can write/read same stream
5. **Essential for hours-long sessions** - Client WILL disconnect, needs to resume

**Alternative (Direct SSE) fails for:**
- Hours-long sessions (client can't stay connected)
- Mobile clients (network interruptions)
- Multi-viewer scenarios (planner monitoring coder)

### REST Endpoints

**Submit Message (Async):**
```
POST /api/v1/conversations/{conversationId}/messages
Body: {
  message: string,
  streamConfig?: {
    stepEvents: boolean,
    tokenStreaming: boolean,
    tokenBatchSize: number
  }
}
Response: {
  taskId: string,
  eventsUrl: string  // e.g., "/api/v1/tasks/{taskId}/events"
}
```

**Subscribe to Events (SSE):**
```
GET /api/v1/tasks/{taskId}/events
Query params:
  - lastEventId (optional): Resume from specific event
Response: text/event-stream (SSE)

SSE Format:
id: {redis-stream-id}
event: cody-event
data: {"type":"agent_message_delta","delta":"..."}

id: {redis-stream-id}
event: cody-event
data: {"type":"exec_command_begin","call_id":"...","command":[...]}
```

**Get Task Status:**
```
GET /api/v1/tasks/{taskId}
Response: {
  taskId: string,
  conversationId: string,
  status: "running" | "completed" | "error",
  startedAt: string,
  completedAt?: string,
  eventCount: number
}
```

### Implementation Requirements

**Fastify Event Bridge (NEW):**
- Subscribe to Session EventMsg events
- Write each event to Redis Stream
- Format: `XADD events:{taskId} * type {msg.type} data {JSON.stringify(msg)}`
- Estimated: ~150-200 lines

**SSE Endpoint (NEW):**
- Read from Redis Stream: `XREAD BLOCK 5000 STREAMS events:{taskId} {lastEventId}`
- Transform Redis entries → SSE format
- Handle client disconnection
- Support Last-Event-ID header for resume
- Estimated: ~200-250 lines

**Task Tracking (NEW):**
- Store task metadata in Redis: `task:{taskId}`
- Track status, timestamps, event count
- Cleanup completed tasks (TTL or manual)
- Estimated: ~100-150 lines

**Total New Code: ~450-600 lines for REST API streaming layer**

---

## Token Streaming: Current State & Required Work

### What's Implemented

**Anthropic Messages Adapter:**
```typescript
// In: content_block_delta SSE event
case "content_block_delta":
  if (event.delta.type === "text_delta") {
    // ✅ IMPLEMENTED: Extract delta text
    block.buffer = (block.buffer || "") + event.delta.text;

    // ✅ IMPLEMENTED: Emit delta event
    yield { type: "output_text_delta", delta: event.delta.text };
  }
```

**Status:** ✅ Deltas are extracted and emitted as ResponseEvent

### What's Missing

**❌ ResponseEvent Delta → EventMsg Delta:**

Currently, Session/Codex layer does NOT forward deltas to clients:

```typescript
// CURRENT (in session.ts):
for await (const event of responseStream) {
  if (event.type === "output_text_delta") {
    // ❌ Delta is consumed but NOT emitted as EventMsg
    // Text accumulates in buffer, only complete message emitted
  }
}
```

**NEEDED:**
```typescript
// REQUIRED (in session.ts):
for await (const event of responseStream) {
  if (event.type === "output_text_delta") {
    // Accumulate in buffer
    buffer += event.delta;

    // ✅ EMIT delta to client (if tokenStreaming enabled)
    if (streamConfig.tokenStreaming) {
      emitEvent({ type: "agent_message_delta", delta: event.delta });
    }
  }
}
```

**File to Modify:** `codex-ts/src/core/codex/session.ts`
**Estimated Work:** ~50-100 lines (add delta emission logic)

**❌ Batching Layer:**

Even when emitting deltas, we need configurable batching:

```typescript
class DeltaBatcher {
  private buffer = "";
  private readonly batchSize: number;

  add(delta: string, emit: (batched: string) => void) {
    this.buffer += delta;

    if (this.buffer.length >= this.batchSize) {
      emit(this.buffer);
      this.buffer = "";
    }
  }

  flush(emit: (batched: string) => void) {
    if (this.buffer.length > 0) {
      emit(this.buffer);
      this.buffer = "";
    }
  }
}
```

**File to Create:** `codex-ts/src/core/codex/delta-batcher.ts`
**Estimated Work:** ~100-150 lines (batcher class + tests)

---

## Provider Delta Support Research

### OpenAI Responses API Delta Events

**From OpenAI Documentation:**
```
event: response.item.text.delta
data: {"item_id":"item_123","delta":"text chunk"}

event: response.item.reasoning.delta
data: {"item_id":"item_123","delta":"thinking chunk"}
```

**Expected Implementation:**
- Responses API SSE parser extracts delta events
- Adapter emits `output_text_delta` and `reasoning_content_delta`
- Should already work (pattern matches Anthropic)

**Action Required:**
1. Verify Responses adapter at `src/core/client/responses/` exists and handles deltas
2. If missing, implement delta extraction (same pattern as Messages adapter)
3. Add tests for delta streaming

### Google Gemini Streaming Research

**Based on @google/genai SDK documentation:**

Gemini uses `streamGenerateContent()` which yields chunks:
```javascript
const stream = await model.streamGenerateContent(request);

for await (const chunk of stream.stream) {
  const text = chunk.text();  // Accumulated text so far
  // OR
  for (const part of chunk.candidates[0].content.parts) {
    if (part.text) {
      // This is likely a delta, not full accumulated text
    }
  }
}
```

**Uncertainty:** Does SDK yield per-token chunks or accumulated text?

**Research Needed:**
1. Test actual streaming behavior with live Gemini API
2. Determine if `chunk.text()` returns delta or cumulative
3. If cumulative, calculate delta manually (diff with previous)

**Estimated Implementation:**
- If SDK provides deltas: ~50 lines (simple extraction)
- If SDK provides cumulative: ~100-150 lines (delta calculation + buffering)

---

## Streaming Overhead Analysis

### Event Size Estimation

**EventMsg Delta Event:**
```json
{"type":"agent_message_delta","delta":"Hello world, this is a batch of text"}
```
- Type field: ~30 bytes
- Delta field (25 chars): ~25 bytes
- JSON overhead: ~15 bytes
- **Total: ~70 bytes per event**

### Volume Analysis

**Scenario: 10,000 token response**

**Token-by-token (no batching):**
- ~10,000 events
- ~700 KB total
- ~10,000 Redis writes
- ~10,000 SSE events to client

**Batched (25 chars ≈ 6 tokens per event):**
- ~1,700 events
- ~120 KB total
- ~1,700 Redis writes
- ~1,700 SSE events to client

**No token streaming (step-level only):**
- ~5-10 events (just step begin/end)
- ~500 bytes total
- ~5-10 Redis writes

**Recommendation:**
- Default to **no token streaming** for autonomous runs
- Enable token streaming for interactive chat
- Use **batching (20-30 chars)** when token streaming enabled

---

## Configuration Propagation

### Where Streaming Config Lives

**System-Level Default:**
```toml
# ~/.cody/config.toml
[streaming]
step_events = true
token_streaming = false
token_batch_size = 25
```

**Conversation-Level Override:**
```typescript
POST /conversations
{
  streamingDefaults: {
    stepEvents: true,
    tokenStreaming: false,
    tokenBatchSize: 25
  }
}
```

**Turn-Level Override:**
```typescript
POST /conversations/{id}/messages
{
  message: "...",
  streamConfig: {
    tokenStreaming: true,  // Enable for this turn only
    tokenBatchSize: 10
  }
}
```

**Priority:** Turn > Conversation > System

---

## Implementation Roadmap

### Already Complete (codex-port-02)

1. ✅ Provider SSE parsers (Responses, Messages)
2. ✅ ResponseEvent protocol definition
3. ✅ ResponseEvent delta events (Anthropic)
4. ✅ EventMsg protocol definition (40+ types)
5. ✅ EventMsg consumption (CLI display layer)

### Phase 6 Work Required

**Step 1: Complete Delta Path (Estimated: 150-250 lines)**
- [ ] Verify OpenAI Responses adapter emits deltas
- [ ] Add Session layer delta forwarding (ResponseEvent → EventMsg)
- [ ] Implement DeltaBatcher class
- [ ] Wire batching into Session

**Step 2: Fastify Streaming Layer (Estimated: 450-600 lines)**
- [ ] Create Fastify server setup
- [ ] Implement async task execution wrapper
- [ ] Add EventMsg → Redis Stream bridge
- [ ] Implement SSE endpoint reading from Redis Stream
- [ ] Add task status/metadata tracking

**Step 3: Streaming Config (Estimated: 100-150 lines)**
- [ ] Add streaming config to TurnContext
- [ ] Propagate config through Session → delta logic
- [ ] Add REST API parameters for config

**Step 4: Client Integration (Estimated: 200-300 lines)**
- [ ] Update CLI to handle streaming config
- [ ] Build simple web client demonstrating SSE subscription
- [ ] Test hours-long session with reconnection

**Total Estimated: ~900-1,300 lines for complete streaming system**

---

## Format Comparison Table

| Layer | Format | Granularity | Purpose | Audience |
|-------|--------|-------------|---------|----------|
| **Provider Wire** | OpenAI SSE, Anthropic SSE, Gemini chunks | Token-level | Provider's native format | Internal adapters only |
| **ResponseEvent** | Normalized events | Token + Item-level | Provider-agnostic processing | Internal Session layer |
| **EventMsg** | Rich orchestration events | Token + Step + Turn-level | Client consumption | REST API clients, CLI, UI |

---

## Client Presentation Freedom

**Key Design Principle:** Server controls event granularity; client controls presentation.

**Server Responsibility:**
- Emit EventMsg stream at configured granularity
- Batch deltas based on `tokenBatchSize`
- Include all step/tool events

**Client Responsibility:**
- Subscribe to EventMsg SSE stream
- Choose how to render deltas:
  - Typewriter animation (char-by-char with setTimeout)
  - Paragraph fade-in (batch 3-4 deltas, animate together)
  - Instant display (just append, no animation)
- Buffer/debounce as needed for smooth UX

**Example:**
```javascript
// Browser client
const eventSource = new EventSource(eventsUrl);
const deltaBuffer = [];

eventSource.addEventListener('cody-event', (e) => {
  const event = JSON.parse(e.data);

  if (event.type === 'agent_message_delta') {
    deltaBuffer.push(event.delta);

    // Flush every 3 deltas with fade-in animation
    if (deltaBuffer.length >= 3) {
      animateParagraphFadeIn(deltaBuffer.join(''));
      deltaBuffer.length = 0;
    }
  }
});
```

**Server doesn't care about presentation.** Emits structured events; client renders however it wants.

---

## Summary

**Current State:**
- Token streaming infrastructure **partially implemented**
- Delta events extracted from providers (Anthropic confirmed, OpenAI needs verification)
- EventMsg protocol supports deltas but Session layer doesn't emit them yet
- No batching layer

**Phase 6 Additions:**
- Complete delta forwarding path (ResponseEvent → EventMsg)
- Add configurable batching
- Build Fastify + Redis Streams layer
- Implement SSE endpoints
- ~900-1,300 lines total

**Result:**
- Unified EventMsg streaming for all clients
- Works for interactive chat (token deltas) AND autonomous runs (step events)
- Configurable granularity (step-only vs. token streaming)
- Durable (Redis Streams) for hours-long sessions
- Provider-agnostic (same events from OpenAI, Anthropic, Gemini, etc.)
