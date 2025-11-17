# Cody REST API - Functional Test Conditions

**Project:** Cody REST API (Phase 6)
**Purpose:** Complete specification of API behavior as testable conditions for Playwright suite
**Date:** 2025-11-16

---

## Overview

This document defines every functional test condition for the Cody REST API. Each condition is written from the client perspective, describes expected behavior, and provides clear pass/fail criteria. These conditions translate directly to Playwright test cases.

**Test Organization:**
- Grouped by feature area (Conversation Management, Messaging, Streaming, etc.)
- Each condition numbered for reference
- Prerequisites and setup clearly stated
- Expected requests and responses fully specified

**Test Philosophy:**
Service-mocked testing at API boundaries. External dependencies (ModelClient, file I/O) mocked for fast, deterministic execution. Tests verify API contracts, not implementation details.

---

## Feature Area 1: Conversation Lifecycle

### TC-1.1: Create Conversation (Minimal)

**Condition:** Client can create a new conversation with minimal configuration.

**Request:**
```http
POST /api/v1/conversations
Content-Type: application/json

{
  "provider": "openai",
  "model": "gpt-5-codex"
}
```

**Expected Response:**
```http
201 Created
Content-Type: application/json

{
  "conversationId": "<uuid>",
  "createdAt": "<iso-8601-timestamp>",
  "provider": "openai",
  "model": "gpt-5-codex",
  "primaryModel": "gpt-5-codex",
  "secondaryModel": null,
  "title": null,
  "summary": null,
  "parent": null,
  "tags": [],
  "agentRole": null
}
```

**Assertions:**
- Status code is 201
- Response contains valid UUID as conversationId
- createdAt is valid ISO-8601 timestamp
- provider and model echo request values
- primaryModel defaults to model value
- All optional metadata fields are null or empty

---

### TC-1.2: Create Conversation (Full Metadata)

**Condition:** Client can create conversation with complete metadata.

**Request:**
```http
POST /api/v1/conversations
Content-Type: application/json

{
  "provider": "anthropic",
  "model": "claude-sonnet-4",
  "title": "API Design Session",
  "summary": "Designing the Cody REST API",
  "tags": ["api-design", "phase-6"],
  "agentRole": "planner",
  "primaryModel": "claude-sonnet-4",
  "secondaryModel": "claude-haiku-4",
  "instructions": "You are a technical architect designing APIs."
}
```

**Expected Response:**
```http
201 Created

{
  "conversationId": "<uuid>",
  "createdAt": "<timestamp>",
  "provider": "anthropic",
  "model": "claude-sonnet-4",
  "title": "API Design Session",
  "summary": "Designing the Cody REST API",
  "tags": ["api-design", "phase-6"],
  "agentRole": "planner",
  "primaryModel": "claude-sonnet-4",
  "secondaryModel": "claude-haiku-4",
  "instructions": "You are a technical architect designing APIs."
}
```

**Assertions:**
- Status 201
- All metadata fields echo request values
- conversationId generated and valid

---

### TC-1.3: Create Conversation (Invalid Provider)

**Condition:** Invalid provider returns 400 error with clear message.

**Request:**
```http
POST /api/v1/conversations

{
  "provider": "invalid-provider",
  "model": "some-model"
}
```

**Expected Response:**
```http
400 Bad Request

{
  "error": {
    "code": "INVALID_PROVIDER",
    "message": "Provider 'invalid-provider' is not supported",
    "details": {
      "validProviders": ["openai", "anthropic", "openrouter"]
    }
  }
}
```

**Assertions:**
- Status 400
- Error code identifies issue
- Error message actionable
- Details list valid options

---

### TC-1.4: Create Conversation (Missing Required Fields)

**Condition:** Missing provider or model returns validation error.

**Request:**
```http
POST /api/v1/conversations

{
  "title": "Missing provider and model"
}
```

**Expected Response:**
```http
400 Bad Request

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "errors": [
        { "field": "provider", "message": "Required" },
        { "field": "model", "message": "Required" }
      ]
    }
  }
}
```

**Assertions:**
- Status 400
- Lists all missing required fields
- Zod validation errors properly formatted

---

### TC-1.5: List Conversations (Empty)

**Condition:** Listing conversations when none exist returns empty array.

**Request:**
```http
GET /api/v1/conversations
```

**Expected Response:**
```http
200 OK

{
  "conversations": [],
  "total": 0
}
```

---

### TC-1.6: List Conversations (Multiple)

**Condition:** Listing returns all conversations with metadata.

**Setup:** Create 3 conversations with different metadata.

**Request:**
```http
GET /api/v1/conversations
```

**Expected Response:**
```http
200 OK

{
  "conversations": [
    {
      "conversationId": "<uuid-1>",
      "createdAt": "<timestamp>",
      "title": "Conversation 1",
      "tags": ["tag-a"],
      "agentRole": "coder",
      ...
    },
    {
      "conversationId": "<uuid-2>",
      ...
    },
    {
      "conversationId": "<uuid-3>",
      ...
    }
  ],
  "total": 3
}
```

**Assertions:**
- Status 200
- conversations array length is 3
- Each conversation includes all metadata fields
- Most recently created appears first (sorted by createdAt desc)

---

### TC-1.7: List Conversations (Filtered by Tags)

**Condition:** Can filter conversations by tags.

**Setup:** Create conversations with tags ["api-design"], ["phase-6"], ["api-design", "phase-6"]

**Request:**
```http
GET /api/v1/conversations?tags=api-design
```

**Expected Response:**
```http
200 OK

{
  "conversations": [
    /* Only conversations with "api-design" tag */
  ],
  "total": 2
}
```

---

### TC-1.8: List Conversations (Filtered by Agent Role)

**Condition:** Can filter by agentRole.

**Request:**
```http
GET /api/v1/conversations?agentRole=planner
```

**Expected Response:**
Only conversations with agentRole="planner" returned.

---

### TC-1.9: Get Conversation (Exists)

**Condition:** Can retrieve specific conversation by ID.

**Setup:** Create conversation with ID conv-123

**Request:**
```http
GET /api/v1/conversations/conv-123
```

**Expected Response:**
```http
200 OK

{
  "conversationId": "conv-123",
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>",
  "provider": "openai",
  "model": "gpt-5-codex",
  "title": "...",
  "history": [
    /* Array of ResponseItem objects from conversation */
  ],
  ...
}
```

**Assertions:**
- Status 200
- conversationId matches request
- history array present (may be empty for new conversation)
- All metadata fields included

---

### TC-1.10: Get Conversation (Not Found)

**Condition:** Getting non-existent conversation returns 404.

**Request:**
```http
GET /api/v1/conversations/nonexistent-id
```

**Expected Response:**
```http
404 Not Found

{
  "error": {
    "code": "CONVERSATION_NOT_FOUND",
    "message": "Conversation 'nonexistent-id' not found"
  }
}
```

---

### TC-1.11: Delete Conversation (Exists)

**Condition:** Can delete a conversation.

**Setup:** Create conversation with ID conv-123

**Request:**
```http
DELETE /api/v1/conversations/conv-123
```

**Expected Response:**
```http
204 No Content
```

**Post-Condition:**
- GET /api/v1/conversations/conv-123 returns 404
- Conversation removed from list endpoint

---

### TC-1.12: Delete Conversation (Not Found)

**Condition:** Deleting non-existent conversation returns 404.

**Request:**
```http
DELETE /api/v1/conversations/nonexistent-id
```

**Expected Response:**
```http
404 Not Found

{
  "error": {
    "code": "CONVERSATION_NOT_FOUND",
    "message": "Conversation 'nonexistent-id' not found"
  }
}
```

---

### TC-1.13: Update Conversation Metadata

**Condition:** Can update conversation metadata fields.

**Setup:** Create conversation with minimal metadata

**Request:**
```http
PATCH /api/v1/conversations/conv-123
Content-Type: application/json

{
  "title": "Updated Title",
  "summary": "New summary",
  "tags": ["new-tag"],
  "agentRole": "coder"
}
```

**Expected Response:**
```http
200 OK

{
  "conversationId": "conv-123",
  "title": "Updated Title",
  "summary": "New summary",
  "tags": ["new-tag"],
  "agentRole": "coder",
  "updatedAt": "<new-timestamp>",
  ...
}
```

**Assertions:**
- Status 200
- All updated fields reflect new values
- updatedAt timestamp is newer than original
- Fields not in request remain unchanged

---

### TC-1.14: Update Conversation (Partial)

**Condition:** Can update subset of metadata fields.

**Request:**
```http
PATCH /api/v1/conversations/conv-123

{
  "title": "New Title"
}
```

**Expected Response:**
- Status 200
- Only title updated
- Other fields (summary, tags, etc.) unchanged

---

### TC-1.15: Clone Conversation

**Condition:** Can clone a conversation with parent reference.

**Setup:** Create conversation conv-123 with some history

**Request:**
```http
POST /api/v1/conversations/conv-123/clone
```

**Expected Response:**
```http
201 Created

{
  "conversationId": "<new-uuid>",
  "parent": "conv-123",
  "createdAt": "<timestamp>",
  "title": null,
  "history": [
    /* Same history as conv-123 */
  ],
  ...
}
```

**Assertions:**
- Status 201
- New conversationId generated
- parent field set to conv-123
- history copied from original
- All other metadata reset (title, summary, tags null/empty)

---

### TC-1.16: Clone Conversation with Metadata Override

**Condition:** Can provide metadata when cloning.

**Request:**
```http
POST /api/v1/conversations/conv-123/clone

{
  "title": "Cloned Version",
  "tags": ["clone", "experiment"]
}
```

**Expected Response:**
- Status 201
- parent set to conv-123
- title and tags from request
- history copied

---

## Feature Area 2: Message Submission & Tasks

### TC-2.1: Submit Message (Async Task Created)

**Condition:** Submitting message returns task immediately without waiting for completion.

**Setup:** Create conversation conv-123 with mocked ModelClient (will respond in 5 seconds)

**Request:**
```http
POST /api/v1/conversations/conv-123/messages

{
  "message": "Hello, how are you?"
}
```

**Expected Response (Immediate, <100ms):**
```http
202 Accepted

{
  "taskId": "<uuid>",
  "conversationId": "conv-123",
  "eventsUrl": "/api/v1/tasks/<taskId>/events",
  "statusUrl": "/api/v1/tasks/<taskId>"
}
```

**Assertions:**
- Status 202 (Accepted, not 200)
- Response returns within 100ms (not waiting for model)
- taskId is valid UUID
- eventsUrl and statusUrl provided

---

### TC-2.2: Submit Message (Conversation Not Found)

**Condition:** Submitting to non-existent conversation returns 404.

**Request:**
```http
POST /api/v1/conversations/nonexistent/messages

{ "message": "test" }
```

**Expected Response:**
```http
404 Not Found

{
  "error": {
    "code": "CONVERSATION_NOT_FOUND",
    "message": "Conversation 'nonexistent' not found"
  }
}
```

---

### TC-2.3: Submit Message (Empty Message)

**Condition:** Empty message returns validation error.

**Request:**
```http
POST /api/v1/conversations/conv-123/messages

{ "message": "" }
```

**Expected Response:**
```http
400 Bad Request

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Message cannot be empty"
  }
}
```

---

### TC-2.4: Submit Message (Missing Message Field)

**Condition:** Missing message field returns validation error.

**Request:**
```http
POST /api/v1/conversations/conv-123/messages

{}
```

**Expected Response:**
```http
400 Bad Request

{
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "errors": [
        { "field": "message", "message": "Required" }
      ]
    }
  }
}
```

---

### TC-2.5: Get Task Status (Running)

**Condition:** Can check task status while running.

**Setup:** Submit message, task is processing

**Request:**
```http
GET /api/v1/tasks/{taskId}
```

**Expected Response:**
```http
200 OK

{
  "taskId": "<uuid>",
  "conversationId": "conv-123",
  "status": "running",
  "startedAt": "<timestamp>",
  "completedAt": null,
  "eventCount": 15
}
```

**Assertions:**
- status is "running"
- startedAt present, completedAt null
- eventCount reflects events written to stream so far

---

### TC-2.6: Get Task Status (Completed)

**Condition:** Task status shows completion after turn finishes.

**Setup:** Submit message, wait for completion

**Request:**
```http
GET /api/v1/tasks/{taskId}
```

**Expected Response:**
```http
200 OK

{
  "taskId": "<uuid>",
  "conversationId": "conv-123",
  "status": "completed",
  "startedAt": "<timestamp>",
  "completedAt": "<timestamp>",
  "eventCount": 42
}
```

**Assertions:**
- status is "completed"
- Both startedAt and completedAt present
- completedAt >= startedAt

---

### TC-2.7: Get Task Status (Not Found)

**Condition:** Getting status of non-existent task returns 404.

**Request:**
```http
GET /api/v1/tasks/nonexistent-task-id
```

**Expected Response:**
```http
404 Not Found

{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task 'nonexistent-task-id' not found"
  }
}
```

---

## Feature Area 3: Event Streaming (SSE)

### TC-3.1: Subscribe to Task Events (Basic Flow)

**Condition:** Client can subscribe to SSE stream and receive events.

**Setup:** Submit message to conversation, mock returns simple text response

**Request:**
```http
GET /api/v1/tasks/{taskId}/events
Accept: text/event-stream
```

**Expected Response:**
```http
200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

id: 0-1
event: cody-event
data: {"type":"task_started","model_context_window":128000}

id: 0-2
event: cody-event
data: {"type":"agent_message","message":"Hello! I'm here to help."}

id: 0-3
event: cody-event
data: {"type":"task_complete","last_agent_message":"Hello! I'm here to help."}
```

**Assertions:**
- Response is SSE stream (text/event-stream)
- Connection stays open
- Events arrive in order
- Each event has unique id (Redis Stream entry ID)
- Event data is valid EventMsg JSON
- Stream closes after task_complete event

---

### TC-3.2: Event Stream (Multi-Step with Tools)

**Condition:** Stream includes all step events for tool execution.

**Setup:** Submit message that requires tool use (e.g., "read README.md")

**Expected Event Sequence:**
```
1. { type: "task_started" }
2. { type: "exec_command_begin", call_id: "...", command: ["cat", "README.md"] }
3. { type: "exec_command_end", call_id: "...", exit_code: 0, stdout: "..." }
4. { type: "agent_message", message: "The README contains..." }
5. { type: "task_complete" }
```

**Assertions:**
- All 5 events received
- exec_command_begin precedes exec_command_end with matching call_id
- agent_message comes after tool completion
- task_complete is final event

---

### TC-3.3: Event Stream Resume (Last-Event-ID)

**Condition:** Client can resume stream from specific event using Last-Event-ID.

**Setup:** Start task, receive first 5 events, disconnect

**Request:**
```http
GET /api/v1/tasks/{taskId}/events
Last-Event-ID: 0-5
```

**Expected Response:**
Events 6 onwards (events 1-5 not re-sent).

**Assertions:**
- First event received has id > 0-5
- No duplicate events
- Can catch up to current state

---

### TC-3.4: Event Stream (Task Not Found)

**Condition:** Subscribing to non-existent task returns 404.

**Request:**
```http
GET /api/v1/tasks/nonexistent-task-id/events
```

**Expected Response:**
```http
404 Not Found

{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task 'nonexistent-task-id' not found"
  }
}
```

---

### TC-3.5: Event Stream (Multiple Subscribers)

**Condition:** Multiple clients can subscribe to same task stream.

**Setup:** Submit message, create 2 SSE connections to same taskId

**Expected Behavior:**
- Both connections receive identical events
- Events delivered to both in same order
- Either client can disconnect without affecting other

**Assertions:**
- Client 1 receives all events
- Client 2 receives all events
- Event IDs and data identical for both clients

---

### TC-3.6: Event Stream (Error Event)

**Condition:** Errors during execution produce error events.

**Setup:** Submit message, mock ModelClient throws error

**Expected Event Sequence:**
```
1. { type: "task_started" }
2. { type: "error", message: "Model API error: rate limit exceeded", details: "..." }
3. { type: "turn_aborted", reason: "..." }
```

**Assertions:**
- error event includes message and details
- Stream terminates after error
- Task status becomes "error"

---

### TC-3.7: Event Stream Keepalive

**Condition:** SSE connection sends periodic keepalive to prevent timeout.

**Setup:** Start long-running task with 30-second gaps between events

**Expected Behavior:**
- During gaps, receive keepalive events (e.g., ping or comment)
- Connection doesn't timeout during idle periods
- Keepalives don't appear in event sequence (comments only)

**Assertions:**
- Connection stays alive for >60 seconds
- Actual events arrive correctly between keepalives

---

## Feature Area 4: Conversation Metadata Operations

### TC-4.1: Update Title

**Condition:** Can update just the title field.

**Setup:** Create conversation

**Request:**
```http
PATCH /api/v1/conversations/conv-123

{ "title": "New Title" }
```

**Expected Response:**
```http
200 OK

{
  "conversationId": "conv-123",
  "title": "New Title",
  "updatedAt": "<new-timestamp>",
  ...
}
```

**Assertions:**
- title updated
- Other fields unchanged
- updatedAt timestamp changed

---

### TC-4.2: Update Multiple Fields

**Condition:** Can update multiple metadata fields in single request.

**Request:**
```http
PATCH /api/v1/conversations/conv-123

{
  "title": "Updated",
  "summary": "New summary",
  "tags": ["tag1", "tag2"],
  "agentRole": "coder"
}
```

**Expected Response:**
- All fields updated
- Other fields unchanged

---

### TC-4.3: Update with Invalid Field

**Condition:** Attempting to update immutable field returns error.

**Request:**
```http
PATCH /api/v1/conversations/conv-123

{
  "conversationId": "different-id",
  "createdAt": "2020-01-01T00:00:00Z"
}
```

**Expected Response:**
```http
400 Bad Request

{
  "error": {
    "code": "INVALID_FIELDS",
    "message": "Cannot update immutable fields",
    "details": {
      "invalidFields": ["conversationId", "createdAt"]
    }
  }
}
```

---

### TC-4.4: Add Tags to Existing Tags

**Condition:** Update merges tags (doesn't replace) when using special syntax.

*Note: May defer this - simple replace is fine for Phase 6*

---

### TC-4.5: Clear Optional Field

**Condition:** Can clear optional field by setting to null.

**Request:**
```http
PATCH /api/v1/conversations/conv-123

{
  "title": null,
  "agentRole": null
}
```

**Expected Response:**
- title and agentRole are null
- Fields removed from conversation metadata

---

## Feature Area 5: Provider & Model Discovery

### TC-5.1: List Providers

**Condition:** Can retrieve list of supported providers.

**Request:**
```http
GET /api/v1/providers
```

**Expected Response:**
```http
200 OK

{
  "providers": [
    {
      "providerId": "openai",
      "name": "OpenAI",
      "wireApi": "responses",
      "description": "OpenAI Responses API (GPT-5, GPT-4, etc.)"
    },
    {
      "providerId": "anthropic",
      "name": "Anthropic",
      "wireApi": "messages",
      "description": "Anthropic Messages API (Claude Sonnet, Opus, Haiku)"
    },
    {
      "providerId": "openrouter",
      "name": "OpenRouter",
      "wireApi": "chat",
      "description": "OpenRouter Chat Completions (Multi-provider aggregator)"
    }
  ]
}
```

**Assertions:**
- All hardcoded providers included
- Each has id, name, wireApi, description

---

### TC-5.2: List Models for Provider (OpenAI)

**Condition:** Can retrieve model catalog for a provider.

**Request:**
```http
GET /api/v1/providers/openai/models
```

**Expected Response:**
```http
200 OK

{
  "provider": "openai",
  "models": [
    {
      "modelId": "gpt-5-codex",
      "displayName": "GPT-5 Codex",
      "contextWindow": 128000,
      "supportsTools": true,
      "supportsReasoning": true,
      "defaultConfig": {
        "temperature": 0.7,
        "reasoningEffort": "high"
      }
    },
    {
      "modelId": "gpt-4o-2024-11-20",
      ...
    }
  ]
}
```

**Assertions:**
- models array not empty
- Each model has id, display name, capabilities
- defaultConfig included

---

### TC-5.3: List Models for Provider (Not Found)

**Condition:** Invalid provider returns 404.

**Request:**
```http
GET /api/v1/providers/invalid-provider/models
```

**Expected Response:**
```http
404 Not Found

{
  "error": {
    "code": "PROVIDER_NOT_FOUND",
    "message": "Provider 'invalid-provider' not found"
  }
}
```

---

### TC-5.4: Get Model Details

**Condition:** Can retrieve detailed metadata for specific model.

**Request:**
```http
GET /api/v1/providers/openai/models/gpt-5-codex
```

**Expected Response:**
```http
200 OK

{
  "provider": "openai",
  "modelId": "gpt-5-codex",
  "displayName": "GPT-5 Codex",
  "contextWindow": 128000,
  "maxOutputTokens": 16384,
  "supportsTools": true,
  "supportsReasoning": true,
  "supportsThinking": false,
  "defaultConfig": {
    "temperature": 0.7,
    "reasoningEffort": "high",
    "verbosity": "medium"
  },
  "pricing": {
    "inputTokens": 0.01,
    "outputTokens": 0.03,
    "cachedInputTokens": 0.005
  }
}
```

---

## Feature Area 6: Error Handling & Edge Cases

### TC-6.1: Invalid JSON Body

**Condition:** Malformed JSON returns 400.

**Request:**
```http
POST /api/v1/conversations

{ invalid json syntax
```

**Expected Response:**
```http
400 Bad Request

{
  "error": {
    "code": "INVALID_JSON",
    "message": "Request body is not valid JSON",
    "details": {
      "parseError": "Unexpected token 'i' at position 2"
    }
  }
}
```

---

### TC-6.2: Wrong Content-Type

**Condition:** Non-JSON content-type returns 400.

**Request:**
```http
POST /api/v1/conversations
Content-Type: text/plain

provider=openai&model=gpt-5
```

**Expected Response:**
```http
400 Bad Request or 415 Unsupported Media Type

{
  "error": {
    "code": "INVALID_CONTENT_TYPE",
    "message": "Content-Type must be application/json"
  }
}
```

---

### TC-6.3: Missing Content-Type

**Condition:** Missing Content-Type header assumes application/json or returns error.

*Decision needed: Be lenient (assume JSON) or strict (require header)?*

---

### TC-6.4: Large Payload

**Condition:** Excessively large request body returns 413.

**Request:**
```http
POST /api/v1/conversations/conv-123/messages

{ "message": "<10MB of text>" }
```

**Expected Response:**
```http
413 Payload Too Large

{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Request body exceeds maximum size of 1MB"
  }
}
```

---

### TC-6.5: Internal Server Error

**Condition:** Unexpected errors return 500 with safe message.

**Setup:** Trigger internal error (Redis connection fails, etc.)

**Expected Response:**
```http
500 Internal Server Error

{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "<uuid>"
  }
}
```

**Assertions:**
- Status 500
- No internal details leaked (stack traces, file paths)
- requestId for error tracking

---

### TC-6.6: CORS Preflight

**Condition:** OPTIONS requests return proper CORS headers.

**Request:**
```http
OPTIONS /api/v1/conversations
Origin: http://localhost:3000
Access-Control-Request-Method: POST
```

**Expected Response:**
```http
204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Last-Event-ID
```

---

## Feature Area 7: Multi-Provider Behavior

### TC-7.1: Create with OpenAI Provider

**Condition:** Conversation with OpenAI provider uses Responses API.

**Request:**
```http
POST /api/v1/conversations

{
  "provider": "openai",
  "model": "gpt-5-codex"
}
```

**Post-Condition:**
- Conversation created successfully
- Subsequent messages use OpenAI Responses API client
- EventMsg stream works correctly

---

### TC-7.2: Create with Anthropic Provider

**Condition:** Conversation with Anthropic uses Messages API.

**Request:**
```http
POST /api/v1/conversations

{
  "provider": "anthropic",
  "model": "claude-sonnet-4"
}
```

**Post-Condition:**
- Conversation uses Anthropic Messages API client
- EventMsg stream works (same format as OpenAI)

---

### TC-7.3: Create with OpenRouter Provider

**Condition:** Conversation with OpenRouter uses Chat Completions API.

**Request:**
```http
POST /api/v1/conversations

{
  "provider": "openrouter",
  "model": "anthropic/claude-3.5-sonnet"
}
```

**Post-Condition:**
- Conversation uses OpenRouter client
- EventMsg stream works

---

### TC-7.4: Provider-Agnostic EventMsg Format

**Condition:** EventMsg streams are identical regardless of provider.

**Setup:** Create 3 conversations (OpenAI, Anthropic, OpenRouter), send identical message to each

**Expected Behavior:**
- All 3 event streams contain same event types
- EventMsg format identical (type, field names, structure)
- Only data differs (different model responses)

**Assertions:**
- Event sequences structurally identical
- No provider-specific event types leaked

---

## Feature Area 8: Conversation History & State

### TC-8.1: Get Conversation History

**Condition:** Can retrieve full conversation history.

**Setup:** Create conversation, send 3 messages, wait for completion

**Request:**
```http
GET /api/v1/conversations/conv-123
```

**Expected Response:**
```http
200 OK

{
  "conversationId": "conv-123",
  "history": [
    { "type": "message", "role": "user", "content": [...] },
    { "type": "message", "role": "assistant", "content": [...] },
    { "type": "message", "role": "user", "content": [...] },
    { "type": "function_call", ... },
    { "type": "function_call_output", ... },
    { "type": "message", "role": "assistant", "content": [...] },
    ...
  ],
  ...
}
```

**Assertions:**
- history is complete ResponseItem[] array
- Includes all user messages, assistant messages, tool calls, outputs
- Ordered chronologically (oldest first)

---

### TC-8.2: History Persists After Completion

**Condition:** Conversation history available after task completes.

**Setup:** Submit message, wait for task_complete, query conversation

**Expected Behavior:**
- GET /conversations/{id} includes new message and response in history
- History persisted (not lost when task completes)

---

### TC-8.3: Clone Preserves History

**Condition:** Cloned conversation has identical history.

**Setup:** Create conversation with 5-turn history, clone it

**Expected Behavior:**
- Clone's history array matches original's history array
- Both conversations independent (new messages to clone don't affect original)

---

## Feature Area 9: Concurrent Operations

### TC-9.1: Submit Multiple Messages (Same Conversation)

**Condition:** Submitting second message while first is running returns error or queues.

**Setup:** Submit message 1 (long-running), immediately submit message 2

**Expected Behavior (Option A - Error):**
```http
409 Conflict

{
  "error": {
    "code": "CONVERSATION_BUSY",
    "message": "Conversation has active task. Wait for completion or cancel existing task."
  }
}
```

**Expected Behavior (Option B - Queue):**
```http
202 Accepted

{
  "taskId": "<uuid-2>",
  "queuePosition": 1,
  ...
}
```

*Decision needed: Reject concurrent submissions or queue them?*

---

### TC-9.2: Create Multiple Conversations (Concurrent)

**Condition:** Can create multiple conversations simultaneously.

**Setup:** Send 10 concurrent POST /conversations requests

**Expected Behavior:**
- All 10 return 201 Created
- All have unique conversationIds
- No race conditions or conflicts

---

### TC-9.3: Clone While Original Has Active Task

**Condition:** Can clone conversation even if original has running task.

**Setup:** Submit message to conv-1 (task running), clone conv-1

**Expected Behavior:**
- Clone succeeds (202 Accepted)
- Clone has snapshot of history at clone time (doesn't include in-progress task)
- Original task completes normally

---

## Feature Area 10: Redis Integration

### TC-10.1: Redis Events Are Durable

**Condition:** Events persist in Redis after client disconnects.

**Setup:** Submit message, subscribe to events, receive 5 events, disconnect

**Expected Behavior:**
- Events 1-5 still in Redis Stream
- New client can subscribe and retrieve all events from start
- Events not lost

**Verification:**
- Client 1 disconnects after event 5
- Client 2 subscribes with no Last-Event-ID
- Client 2 receives events 1-N (all from beginning)

---

### TC-10.2: Event Retention

**Condition:** Events retained in Redis for reasonable duration.

**Expected Behavior:**
- Events available for at least 24 hours after task completion
- Optional: Cleanup/TTL after retention period

*Decision needed: Event retention policy (TTL, manual cleanup, indefinite)*

---

### TC-10.3: Redis Failure Handling

**Condition:** If Redis unavailable, API returns clear error.

**Setup:** Stop Redis server, submit message

**Expected Response:**
```http
503 Service Unavailable

{
  "error": {
    "code": "REDIS_UNAVAILABLE",
    "message": "Event streaming service unavailable. Try again later."
  }
}
```

**Assertions:**
- Status 503 (not 500)
- Error message doesn't expose Redis details
- API degrades gracefully

---

## Feature Area 11: Model Configuration

### TC-11.1: Submit with Model Override

**Condition:** Can override conversation's default model for single message.

**Setup:** Create conversation with primaryModel="gpt-5-codex"

**Request:**
```http
POST /api/v1/conversations/conv-123/messages

{
  "message": "Try with Claude",
  "override": {
    "provider": "anthropic",
    "model": "claude-sonnet-4"
  }
}
```

**Expected Behavior:**
- Task uses claude-sonnet-4 for this turn only
- Conversation's primaryModel unchanged
- EventMsg stream uses Anthropic adapter

---

### TC-11.2: Submit with Model Config Override

**Condition:** Can override model parameters per message.

**Request:**
```http
POST /api/v1/conversations/conv-123/messages

{
  "message": "Think harder on this",
  "modelConfig": {
    "reasoningEffort": "high",
    "temperature": 0.2
  }
}
```

**Expected Behavior:**
- This turn uses specified reasoning effort and temperature
- Conversation defaults unchanged

---

## Test Summary

**Total Test Conditions:** 40+

**Coverage Breakdown:**
- Conversation Lifecycle: 16 tests
- Message Submission & Tasks: 7 tests
- Event Streaming (SSE): 7 tests
- Metadata Operations: 5 tests
- Provider Discovery: 4 tests
- Error Handling: 6 tests
- Multi-Provider: 4 tests
- Concurrent Operations: 3 tests
- Redis Integration: 3 tests
- Model Configuration: 2 tests

**Estimated Playwright LOC:** ~2,000-2,500 lines (comprehensive suite with helpers, fixtures, assertions)

---

## Acceptance Criteria

**Phase 6 is complete when:**

1. ✅ All Playwright tests passing (40+ functional tests)
2. ✅ All existing library tests passing (1,950+)
3. ✅ Can perform every current CLI operation via REST API
4. ✅ SSE streaming works for hours-long sessions with reconnection
5. ✅ Multiple providers work with identical EventMsg streams
6. ✅ Conversation metadata fully supported
7. ✅ Zero TypeScript errors, zero ESLint errors
8. ✅ API documentation complete with examples
9. ✅ Can build simple web client using API (proves usability)

**Stretch Goals (Optional):**
- OpenAPI/Swagger specification generated from Zod schemas
- Postman collection for manual testing
- Simple example web client (HTML + vanilla JS)

**Ready for Phase 2.5+ when:**
- Redis Streams infrastructure proven stable
- Async task pattern works reliably
- EventMsg format covers all needed event types
- API contract solidified (breaking changes avoided)
