# Conversation Endpoints Specification

**Date:** 2025-11-16
**Phase:** 6 REST API

---

## 1. POST /api/v1/conversations
Create new conversation

**Request:**
```json
{
  "modelProviderId": "openai",
  "modelProviderApi": "responses",
  "model": "gpt-5-codex",
  "title": "Optional title",
  "summary": "Optional summary",
  "tags": ["tag1", "tag2"],
  "agentRole": "planner"
}
```
Required: modelProviderId, modelProviderApi, model

**Response 201:**
```json
{
  "conversationId": "uuid",
  "createdAt": "iso-8601",
  "updatedAt": "iso-8601",
  "modelProviderId": "openai",
  "modelProviderApi": "responses",
  "model": "gpt-5-codex",
  "title": null,
  "summary": null,
  "parent": null,
  "tags": [],
  "agentRole": null
}
```

**Provider/API Validation:**
- `openai` + `responses` → valid
- `openai` + `chat` → valid
- `openai` + `messages` → 400 (not supported)
- `anthropic` + `messages` → valid
- `anthropic` + `responses` → 400 (not supported)
- `anthropic` + `chat` → 400 (not supported)
- `openrouter` + `chat` → valid
- `openrouter` + `responses` → 400 (not supported)
- `unknown-provider` → 400 (provider not found)

**Tests:**
- Create with valid combination (openai + responses) → 201
- Create with full metadata → all fields preserved
- Missing modelProviderId → 400
- Missing modelProviderApi → 400
- Missing model → 400
- Invalid provider → 400 with supported providers listed
- Invalid API for provider → 400 with supported APIs for that provider
- openai + messages → 400 (combination not supported)
- anthropic + responses → 400 (combination not supported)

---

## 2. GET /api/v1/conversations
List conversations

**Query:**
```
?cursor=timestamp:id  (optional)
?limit=20             (optional, 1-100)
```

**Response 200:**
```json
{
  "conversations": [
    {
      "conversationId": "uuid",
      "createdAt": "iso-8601",
      "updatedAt": "iso-8601",
      "modelProviderId": "openai",
      "modelProviderApi": "responses",
      "model": "gpt-5-codex",
      "title": null,
      "tags": [],
      "agentRole": null
    }
  ],
  "nextCursor": "timestamp:id or null"
}
```

**Tests:**
- Empty list → empty array
- Multiple conversations → sorted by createdAt desc
- Pagination with limit=1 → returns nextCursor
- Using nextCursor → returns next page

---

## 3. GET /api/v1/conversations/:id
Get conversation with history

**Response 200:**
```json
{
  "conversationId": "uuid",
  "createdAt": "iso-8601",
  "updatedAt": "iso-8601",
  "modelProviderId": "openai",
  "modelProviderApi": "responses",
  "model": "gpt-5-codex",
  "title": null,
  "summary": null,
  "parent": null,
  "tags": [],
  "agentRole": null,
  "history": [
    {
      "type": "message",
      "role": "user",
      "content": [{"type": "input_text", "text": "Hello"}]
    },
    {
      "type": "message",
      "role": "assistant",
      "content": [{"type": "text", "text": "Hi there!"}]
    }
  ]
}
```

**Tests:**
- Get existing conversation → 200 with full data
- Get non-existent → 404

---

## 4. DELETE /api/v1/conversations/:id
Delete conversation

**Response:** 204 No Content

**Tests:**
- Delete existing → 204
- Delete non-existent → 404

---

## 5. PATCH /api/v1/conversations/:id
Update conversation metadata

**Request:**
```json
{
  "title": "New Title",
  "summary": "Updated summary",
  "tags": ["new", "tags"],
  "agentRole": "coder",
  "modelProviderId": "anthropic",
  "modelProviderApi": "messages",
  "model": "claude-sonnet-4"
}
```
All fields optional (must provide at least one)

**Provider/API Validation (if updating model config):**
- If updating modelProviderId or modelProviderApi, must validate combination
- Same validation rules as POST /conversations

**Response 200:**
```json
{
  "conversationId": "uuid",
  "createdAt": "iso-8601",
  "updatedAt": "iso-8601 (new timestamp)",
  "modelProviderId": "anthropic",
  "modelProviderApi": "messages",
  "model": "claude-sonnet-4",
  "title": "New Title",
  "summary": "Updated summary",
  "tags": ["new", "tags"],
  "agentRole": "coder",
  "parent": null
}
```

**Tests:**
- Update single field → only that field changes
- Update multiple fields → all specified fields change
- Update model config → validates provider/API combination
- Update with invalid provider/API combo → 400
- Update immutable field (conversationId, createdAt, parent) → 400
- Empty body → 400
- Conversation not found → 404
- updatedAt timestamp is newer than original

---

## 6. POST /api/v1/conversations/:id/messages
Submit message (async task execution)

**Request:**
```json
{
  "message": "Hello, please help me with X",
  "modelProviderId": "anthropic",
  "modelProviderApi": "messages",
  "model": "claude-sonnet-4"
}
```
Required: message
Optional: modelProviderId, modelProviderApi, model (overrides conversation defaults for this turn)

**Provider/API Validation (if providing overrides):**
- If any model config field provided, all three must be provided together
- Validate provider/API combination (same rules as POST /conversations)

**Response 202 Accepted (Immediate, <100ms):**
```json
{
  "taskId": "uuid",
  "conversationId": "uuid",
  "eventsUrl": "/api/v1/tasks/{taskId}/events",
  "statusUrl": "/api/v1/tasks/{taskId}"
}
```

**Behavior:**
- Message submission triggers async turn execution
- Response returns immediately (does NOT wait for completion)
- Agent processes message in background (may take seconds to hours)
- Client subscribes to eventsUrl for real-time progress

**Streaming Architecture:**
1. Fastify handler fires ConversationManager.submitMessage() asynchronously
2. As agent executes, EventMsg events are emitted
3. EventMsg → Redis Bridge writes each event to Redis Stream: `events:{taskId}`
4. Client calls eventsUrl (SSE endpoint)
5. SSE endpoint reads from Redis Stream via XREAD
6. Events delivered to client as Server-Sent Events

**eventsUrl Endpoint (GET /api/v1/tasks/:taskId/events):**
- Fastify SSE endpoint (text/event-stream)
- Reads from Redis Stream: `events:{taskId}`
- Proxies events to client in real-time
- Supports reconnection via Last-Event-ID header
- Delivers EventMsg format (step-level events only, no token deltas)

**EventMsg Stream Format:**
```
id: 1732547890123-0
event: cody-event
data: {"type":"task_started","model_context_window":128000}

id: 1732547890124-0
event: cody-event
data: {"type":"exec_command_begin","call_id":"...","command":["cat","file.txt"]}

id: 1732547890125-0
event: cody-event
data: {"type":"exec_command_end","call_id":"...","exit_code":0,"stdout":"..."}

id: 1732547890126-0
event: cody-event
data: {"type":"agent_message","message":"Based on the file..."}

id: 1732547890127-0
event: cody-event
data: {"type":"task_complete"}
```

**Event Types (Step-Level Only):**
- `task_started` - Turn execution begins
- `exec_command_begin` - Tool execution starting
- `exec_command_end` - Tool execution completed
- `agent_reasoning` - Complete thinking block
- `agent_message` - Complete assistant response
- `task_complete` - Turn finished
- `turn_aborted` - Turn cancelled or error
- `error` - Error occurred

**NO Token Deltas:** Phase 6 does not include `agent_message_delta` or `agent_reasoning_delta`. Complete messages/reasoning blocks only.

**Tests:**
- Submit message → 202 with turnId + URLs
- Submit to non-existent conversation → 404
- Empty message → 400
- With provider override → uses overridden provider
- Subscribe to streamUrl → receives EventMsg stream
- Stream includes task_started, agent_message, task_complete
- Client can disconnect and reconnect with Last-Event-ID

---

## 7. GET /api/v1/turns/:id
Get turn status and result

**Query Parameters:**
```
?thinkingLevel=none|full    (default: full)
?toolLevel=none|full        (default: none)
```

**Response 200 (Turn Completed):**
```json
{
  "turnId": "uuid",
  "conversationId": "uuid",
  "status": "completed",
  "startedAt": "iso-8601",
  "completedAt": "iso-8601",
  "result": {
    "type": "message",
    "role": "assistant",
    "content": [{"type": "text", "text": "Final response"}]
  },
  "thinking": [
    /* Full thinking blocks if thinkingLevel=full, empty if none */
  ],
  "toolCalls": [
    /* Full tool execution details if toolLevel=full, empty if none */
  ]
}
```

**Response 200 (Turn Running):**
```json
{
  "turnId": "uuid",
  "conversationId": "uuid",
  "status": "running",
  "startedAt": "iso-8601",
  "completedAt": null
}
```

**Response 404:**
Turn not found

**Tests:**
- Get completed turn with defaults → full thinking, no tools
- Get with thinkingLevel=none → no thinking in response
- Get with toolLevel=full → includes tool details
- Get running turn → status=running, no result yet
- Get non-existent → 404

---

## 8. GET /api/v1/turns/:id/stream-events
Subscribe to turn event stream (SSE)

**Query Parameters:**
```
?thinkingLevel=none|full    (default: full)
?toolLevel=none|full        (default: none)
```

**Response:** text/event-stream

**Behavior:**
- Opens SSE connection
- Streams EventMsg events as turn executes
- Filters events based on query parameters
- Supports Last-Event-ID header for reconnection

**Event Filtering:**
- `thinkingLevel=none` - Suppresses agent_reasoning events
- `thinkingLevel=full` - Includes all agent_reasoning events (default)
- `toolLevel=none` - Suppresses exec_command_begin/end events (default)
- `toolLevel=full` - Includes all tool execution events

**EventMsg Stream (with defaults: thinkingLevel=full, toolLevel=none):**
```
id: 123-0
event: cody-event
data: {"type":"task_started"}

id: 123-1
event: cody-event
data: {"type":"agent_reasoning","text":"Let me think about this..."}

id: 123-2
event: cody-event
data: {"type":"agent_message","message":"Here's my response"}

id: 123-3
event: cody-event
data: {"type":"task_complete"}
```

**With toolLevel=full:**
Additional events: exec_command_begin, exec_command_end, mcp_tool_call_begin/end

**Tests:**
- Subscribe with defaults → receives thinking, no tool details
- Subscribe with thinkingLevel=none → no reasoning events
- Subscribe with toolLevel=full → receives tool execution events
- Client disconnect and reconnect with Last-Event-ID → resumes stream
- Turn not found → 404
- Stream closes after task_complete event
