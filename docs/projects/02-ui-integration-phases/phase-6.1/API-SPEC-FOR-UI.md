# Cody Fastify API Specification for UI Development

**Purpose:** Complete API reference for building a web chat interface
**Backend:** Fastify server running on `http://localhost:4010`
**Protocol:** REST + Server-Sent Events (SSE)

---

## API Overview

The Cody API enables conversational AI interactions through a Codex agent. Create a conversation, send messages, and receive streaming responses that include the agent's reasoning and tool usage in real-time.

**Base URL:** `http://localhost:4010/api/v1`

**Core Flow:**
1. Create a conversation → get `conversationId`
2. Send a message → get `turnId` and `streamUrl`
3. Subscribe to SSE stream → receive events in real-time
4. Events include: agent messages, tool calls, reasoning steps, completion

---

## Endpoints

### POST /api/v1/conversations
Create a new conversation.

**Request Body:**
```json
{
  "modelProviderId": "openai",
  "modelProviderApi": "responses",
  "model": "gpt-4o-mini"
}
```

**Response:** `201 Created`
```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2025-11-17T20:30:00.000Z",
  "updatedAt": "2025-11-17T20:30:00.000Z",
  "modelProviderId": "openai",
  "modelProviderApi": "responses",
  "model": "gpt-4o-mini",
  "title": null,
  "summary": null,
  "parent": null,
  "tags": [],
  "agentRole": null
}
```

**Field Descriptions:**
- `conversationId` - UUID for this conversation, use in subsequent requests
- `createdAt` / `updatedAt` - ISO 8601 timestamps
- `modelProviderId` - Provider: `"openai"`, `"anthropic"`, `"openrouter"`
- `modelProviderApi` - API type: `"responses"`, `"chat"`, `"messages"`
- `model` - Model name (e.g., `"gpt-4o-mini"`, `"claude-sonnet-4"`)
- `title`, `summary`, `tags`, `agentRole` - Optional metadata (can be set via PATCH)

**Valid Provider/API Combinations:**
- OpenAI: `responses` or `chat`
- Anthropic: `messages`
- OpenRouter: `chat`

---

### GET /api/v1/conversations
List all conversations.

**Query Parameters:**
- `limit` (optional): Max results per page (default: 50, max: 100)
- `cursor` (optional): Pagination cursor from previous response

**Response:** `200 OK`
```json
{
  "conversations": [
    {
      "conversationId": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2025-11-17T20:30:00.000Z",
      "updatedAt": "2025-11-17T20:35:00.000Z",
      "modelProviderId": "openai",
      "modelProviderApi": "responses",
      "model": "gpt-4o-mini",
      "title": "My Coding Session",
      "summary": null,
      "parent": null,
      "tags": ["coding", "bugfix"],
      "agentRole": null
    }
  ],
  "nextCursor": null
}
```

**Pagination:**
- `nextCursor` is `null` when no more results
- If present, format is `"timestamp:id"` (opaque, just pass it back)

---

### GET /api/v1/conversations/:id
Get a specific conversation with full history.

**Response:** `200 OK`
```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2025-11-17T20:30:00.000Z",
  "updatedAt": "2025-11-17T20:35:00.000Z",
  "modelProviderId": "openai",
  "modelProviderApi": "responses",
  "model": "gpt-4o-mini",
  "title": null,
  "summary": null,
  "parent": null,
  "tags": [],
  "agentRole": null,
  "history": [
    {
      "role": "user",
      "content": "Hello, can you help me?"
    },
    {
      "role": "assistant",
      "content": "Of course! What do you need help with?"
    }
  ]
}
```

**History Format:**
- Array of messages in chronological order
- Each message has `role` (`"user"` or `"assistant"`) and `content` (string)

---

### POST /api/v1/conversations/:id/messages
Send a message to a conversation (async, returns immediately).

**Request Body:**
```json
{
  "message": "Read the README.md file and summarize it"
}
```

**Response:** `202 Accepted`
```json
{
  "turnId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "streamUrl": "/api/v1/turns/7c9e6679-7425-40de-944b-e07fc1f90ae7/stream-events",
  "statusUrl": "/api/v1/turns/7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

**Field Descriptions:**
- `turnId` - UUID for this specific turn (agent's work on this message)
- `streamUrl` - SSE endpoint to subscribe to for real-time events
- `statusUrl` - Polling endpoint to check turn status

**Important:** This endpoint returns immediately (202 Accepted). The agent processes the message asynchronously. Subscribe to `streamUrl` to see events in real-time.

---

### GET /api/v1/turns/:id/stream-events
Subscribe to real-time events for a turn (Server-Sent Events).

**Query Parameters:**
- `thinkingLevel` (optional): `"none"` or `"full"` (default: `"full"`)
- `toolLevel` (optional): `"none"` or `"full"` (default: `"none"`)

**Headers:**
- `Last-Event-ID` (optional): Resume from specific event (for reconnection)

**Response:** `200 OK` with `Content-Type: text/event-stream`

**Event Stream Format:**
```
id: 1
event: task_started
data: {"turnId":"7c9e6679-7425-40de-944b-e07fc1f90ae7"}

id: 2
event: agent_message
data: {"text":"I'll read the README file for you."}

id: 3
event: exec_command_begin
data: {"toolName":"readFile","args":{"path":"README.md"},"callId":"call_abc123"}

id: 4
event: exec_command_end
data: {"callId":"call_abc123","exitCode":0,"stdout":"# Cody\n\nCody is..."}

id: 5
event: agent_message
data: {"text":"The README describes..."}

id: 6
event: task_complete
data: {"turnId":"7c9e6679-7425-40de-944b-e07fc1f90ae7"}
```

**Event Types:**

**Lifecycle Events:**
- `task_started` - Turn begins
- `task_complete` - Turn finished successfully
- `turn_aborted` - Turn was cancelled or errored

**Agent Communication:**
- `agent_message` - Agent text response (can be multiple during a turn)
- `agent_message_delta` - Streaming text delta (partial message)
- `agent_reasoning` - Agent's thinking/reasoning step (if `thinkingLevel=full`)

**Tool Execution Events (if `toolLevel=full`):**
- `exec_command_begin` - Tool execution starts
  - Fields: `toolName`, `args`, `callId`
- `exec_command_end` - Tool execution completes
  - Fields: `callId`, `exitCode`, `stdout`, `stderr`

**Error Events:**
- `error` - Error occurred during turn
  - Fields: `message`, `code`, `details`

**Connection Management:**
- `:keepalive` - Comment sent every 15s during idle periods (keeps connection alive)

---

### GET /api/v1/turns/:id
Get turn status (polling alternative to streaming).

**Query Parameters:**
- `thinkingLevel` (optional): `"none"` or `"full"`
- `toolLevel` (optional): `"none"` or `"full"`

**Response:** `200 OK`
```json
{
  "turnId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "startedAt": "2025-11-17T20:35:00.000Z",
  "completedAt": "2025-11-17T20:35:15.000Z",
  "result": {
    "role": "assistant",
    "content": "The README describes the Cody project..."
  },
  "thinking": [],
  "toolCalls": [
    {
      "name": "readFile",
      "callId": "call_abc123",
      "input": {"path": "README.md"},
      "output": {"exitCode": 0, "stdout": "# Cody\n\n..."}
    }
  ]
}
```

**Status Values:**
- `"running"` - Turn is in progress
- `"completed"` - Turn finished successfully
- `"error"` - Turn failed

**Fields:**
- `result` - Final agent message (present when `status="completed"`)
- `thinking` - Array of reasoning steps (if `thinkingLevel=full`)
- `toolCalls` - Array of tool executions (if `toolLevel=full`)

---

### PATCH /api/v1/conversations/:id
Update conversation metadata.

**Request Body:**
```json
{
  "title": "Debugging Session",
  "tags": ["bug", "urgent"]
}
```

**Response:** `200 OK`
```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2025-11-17T20:30:00.000Z",
  "updatedAt": "2025-11-17T20:40:00.000Z",
  "modelProviderId": "openai",
  "modelProviderApi": "responses",
  "model": "gpt-4o-mini",
  "title": "Debugging Session",
  "summary": null,
  "parent": null,
  "tags": ["bug", "urgent"],
  "agentRole": null
}
```

**Updatable Fields:** `title`, `summary`, `tags`, `agentRole`
**Immutable Fields:** `conversationId`, `createdAt`, model configuration

---

### DELETE /api/v1/conversations/:id
Delete a conversation.

**Response:** `204 No Content`

**Error:** `404 Not Found` if conversation doesn't exist

---

## Complete Request/Response Examples

### Example 1: Simple Question

**1. Create conversation:**
```bash
POST /api/v1/conversations
{
  "modelProviderId": "openai",
  "modelProviderApi": "responses",
  "model": "gpt-4o-mini"
}

→ 201 {"conversationId": "conv-123", ...}
```

**2. Send message:**
```bash
POST /api/v1/conversations/conv-123/messages
{
  "message": "What is 2+2?"
}

→ 202 {
  "turnId": "turn-456",
  "streamUrl": "/api/v1/turns/turn-456/stream-events",
  ...
}
```

**3. Subscribe to stream:**
```bash
GET /api/v1/turns/turn-456/stream-events

→ (SSE stream)
id: 1
event: task_started
data: {"turnId":"turn-456"}

id: 2
event: agent_message
data: {"text":"2+2 equals 4."}

id: 3
event: task_complete
data: {"turnId":"turn-456"}
```

---

### Example 2: Tool Usage

**Send message:**
```bash
POST /api/v1/conversations/conv-123/messages
{
  "message": "Read the package.json file"
}

→ 202 {"turnId": "turn-789", "streamUrl": "...", ...}
```

**Subscribe to stream with toolLevel=full:**
```bash
GET /api/v1/turns/turn-789/stream-events?toolLevel=full

→ (SSE stream)
id: 1
event: task_started
data: {"turnId":"turn-789"}

id: 2
event: agent_message
data: {"text":"I'll read that file for you."}

id: 3
event: exec_command_begin
data: {"toolName":"readFile","args":{"path":"package.json"},"callId":"call_001"}

id: 4
event: exec_command_end
data: {"callId":"call_001","exitCode":0,"stdout":"{\n  \"name\": \"cody\"..."}

id: 5
event: agent_message
data: {"text":"The package.json shows this is the Cody project version 0.1.0..."}

id: 6
event: task_complete
data: {"turnId":"turn-789"}
```

---

### Example 3: Agent Reasoning

**Send message:**
```bash
POST /api/v1/conversations/conv-123/messages
{
  "message": "Should I use async/await or promises?"
}

→ 202 {"turnId": "turn-abc", ...}
```

**Subscribe with thinkingLevel=full:**
```bash
GET /api/v1/turns/turn-abc/stream-events?thinkingLevel=full

→ (SSE stream)
id: 1
event: task_started
data: {"turnId":"turn-abc"}

id: 2
event: agent_reasoning
data: {"text":"Let me think about the trade-offs between these two approaches..."}

id: 3
event: agent_reasoning
data: {"text":"Async/await is syntactic sugar over promises, making code more readable..."}

id: 4
event: agent_message
data: {"text":"I recommend using async/await because..."}

id: 5
event: task_complete
data: {"turnId":"turn-abc"}
```

---

## Event Types Reference

**Note:** Recent additions include `patch_apply_begin/end`, `web_search_begin/end`, `mcp_tool_call_begin/end`, and improved tool call event structures with proper `callId` tracking.

### Core Lifecycle Events

**task_started**
- Turn begins processing
- Data: `{"turnId": "string", "modelProviderId": "openai", "model": "gpt-4o-mini"}`

**task_complete**
- Turn finished successfully (always the final event)
- Data: `{"turnId": "string"}`

**turn_aborted**
- Turn cancelled or errored
- Data: `{"turnId": "string", "reason": "string"}`

### Agent Communication Events

**agent_message**
- Agent produces text response (multiple can occur in one turn)
- Data: `{"text": "string"}`
- Note: Some variants send deltas, others send complete messages

**agent_reasoning**
- Agent's internal thinking (only if `thinkingLevel=full`)
- Data: `{"text": "string"}`
- Note: Multiple reasoning events can occur as agent thinks through the problem

### Tool Execution Events (if toolLevel=full)

**exec_command_begin**
- Shell command execution starts
- Data: `{"callId": "call_123", "toolName": "exec", "command": ["npm", "test"], "cwd": "/path"}`

**exec_command_output_delta**
- Streaming output from command (stdout/stderr)
- Data: `{"callId": "call_123", "stream": "stdout", "data": "partial output"}`

**exec_command_end**
- Command execution completes
- Data: `{"callId": "call_123", "exitCode": 0, "stdout": "complete output", "stderr": "", "timedOut": false}`

**patch_apply_begin**
- Code patch application starts
- Data: `{"filePath": "src/server.ts"}`

**patch_apply_end**
- Patch application completes
- Data: `{"filePath": "src/server.ts", "success": true, "error": null}`

**mcp_tool_call_begin**
- MCP tool invocation starts
- Data: `{"invocation": {"server": "mcp-server-name", "tool": "tool_name", "arguments": {}}}`

**mcp_tool_call_end**
- MCP tool completes
- Data: `{"invocation": {...}, "result": {}, "error": null}`

**web_search_begin**
- Web search starts
- Data: `{"callId": "call_456"}`

**web_search_end**
- Web search completes
- Data: `{"callId": "call_456"}`

### Raw Response Items (Alternative Event Format)

The API also emits `raw_response_item` events that contain the underlying Codex `ResponseItem` structures. These are mapped to the events above:

**raw_response_item with function_call**
- Maps to: `exec_command_begin`
- Item type: `"function_call"`
- Data includes: `{"callId": "string", "toolName": "string", "arguments": {...}}`

**raw_response_item with function_call_output**
- Maps to: `exec_command_end`
- Item type: `"function_call_output"`
- Data includes: `{"callId": "string", "output": {...}}`

### Error Events

**error**
- Error during processing
- Data: `{"message": "Error description", "code": "ERROR_CODE", "details": {}}`

**stream_error**
- SSE stream error
- Data: `{"error": "string"}`

### Connection Management

**:keepalive**
- SSE comment sent every 15 seconds during idle periods
- Format: `:keepalive\n\n`
- Not a data event, just keeps connection alive

---

## Event Filtering with Query Parameters

**thinkingLevel:**
- `none` - Suppresses `agent_reasoning` events
- `full` - Includes all reasoning events (default)

**toolLevel:**
- `none` - Suppresses all tool execution events (default)
- `full` - Includes `exec_command_begin/end`, `patch_apply_begin/end`, `mcp_tool_call_begin/end`, etc.

**Example:** To see agent messages and reasoning but hide tool details:
```
GET /turns/:id/stream-events?thinkingLevel=full&toolLevel=none
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

**Common Error Codes:**

**400 Bad Request:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "modelProviderId: Required",
    "details": {"errors": [...]}
  }
}
```

**404 Not Found:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Conversation not found"
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req_xyz"
  }
}
```

---
