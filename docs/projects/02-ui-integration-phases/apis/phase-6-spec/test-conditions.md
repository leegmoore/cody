# Cody API - Test Conditions

**Phase:** 6 REST API
**Purpose:** Complete functional test specification for Playwright implementation
**Date:** 2025-11-16

---

## Test Organization

**Parallel Tests:** TC-1 through TC-8 (can run concurrently)
**Sequential Tests:** TC-L1 through TC-L7 (lifecycle workflows, must run in order within each test)

---

## TC-1: POST /conversations - Create Conversation

### TC-1.1 Create with Minimal Config
**Call:** POST /conversations
```json
{
  "modelProviderId": "openai",
  "modelProviderApi": "responses",
  "model": "gpt-5-codex"
}
```
**Expect:** 201
**Verify:**
- Response has conversationId (valid UUID)
- Response has createdAt (valid ISO-8601)
- Response has updatedAt (equals createdAt)
- modelProviderId = "openai"
- modelProviderApi = "responses"
- model = "gpt-5-codex"
- title = null
- summary = null
- parent = null
- tags = []
- agentRole = null

### TC-1.2 Create with Full Metadata
**Call:** POST /conversations
```json
{
  "modelProviderId": "anthropic",
  "modelProviderApi": "messages",
  "model": "claude-sonnet-4",
  "title": "Test Conversation",
  "summary": "Testing full metadata",
  "tags": ["test", "phase-6"],
  "agentRole": "planner"
}
```
**Expect:** 201
**Verify:**
- All metadata fields match request values
- tags array = ["test", "phase-6"]
- agentRole = "planner"

### TC-1.3 Missing modelProviderId
**Call:** POST /conversations
```json
{
  "modelProviderApi": "responses",
  "model": "gpt-5-codex"
}
```
**Expect:** 400
**Verify:**
- Error code = "VALIDATION_ERROR"
- Error message mentions "modelProviderId" required

### TC-1.4 Missing modelProviderApi
**Call:** POST /conversations
```json
{
  "modelProviderId": "openai",
  "model": "gpt-5-codex"
}
```
**Expect:** 400
**Verify:**
- Error code = "VALIDATION_ERROR"
- Error message mentions "modelProviderApi" required

### TC-1.5 Missing model
**Call:** POST /conversations
```json
{
  "modelProviderId": "openai",
  "modelProviderApi": "responses"
}
```
**Expect:** 400
**Verify:**
- Error code = "VALIDATION_ERROR"
- Error message mentions "model" required

### TC-1.6 Invalid Provider
**Call:** POST /conversations
```json
{
  "modelProviderId": "invalid-provider",
  "modelProviderApi": "responses",
  "model": "some-model"
}
```
**Expect:** 400
**Verify:**
- Error message lists supported providers

### TC-1.7 OpenAI + Messages (Unsupported Combo)
**Call:** POST /conversations
```json
{
  "modelProviderId": "openai",
  "modelProviderApi": "messages",
  "model": "gpt-5-codex"
}
```
**Expect:** 400
**Verify:**
- Error indicates openai doesn't support messages API

### TC-1.8 Anthropic + Responses (Unsupported Combo)
**Call:** POST /conversations
```json
{
  "modelProviderId": "anthropic",
  "modelProviderApi": "responses",
  "model": "claude-sonnet-4"
}
```
**Expect:** 400

### TC-1.9 Anthropic + Chat (Unsupported Combo)
**Call:** POST /conversations
```json
{
  "modelProviderId": "anthropic",
  "modelProviderApi": "chat",
  "model": "claude-sonnet-4"
}
```
**Expect:** 400

### TC-1.10 OpenRouter + Responses (Unsupported Combo)
**Call:** POST /conversations
```json
{
  "modelProviderId": "openrouter",
  "modelProviderApi": "responses",
  "model": "some-model"
}
```
**Expect:** 400

---

## TC-2: GET /conversations - List Conversations

### TC-2.1 Empty List
**Setup:** No conversations exist
**Call:** GET /conversations
**Expect:** 200
**Verify:**
- conversations = []
- nextCursor = null

### TC-2.2 Multiple Conversations
**Setup:** Create 3 conversations with different createdAt times
**Call:** GET /conversations
**Expect:** 200
**Verify:**
- conversations.length = 3
- Conversations sorted by createdAt descending (newest first)
- Each conversation has all expected fields

### TC-2.3 Pagination with Limit
**Setup:** Create 3 conversations
**Call:** GET /conversations?limit=1
**Expect:** 200
**Verify:**
- conversations.length = 1
- nextCursor is not null
- nextCursor format = "timestamp:id"

### TC-2.4 Using Next Cursor
**Setup:** Create 3 conversations
**Call:** GET /conversations?limit=1
**Save:** nextCursor from response
**Call:** GET /conversations?cursor={nextCursor}&limit=1
**Expect:** 200
**Verify:**
- conversations.length = 1
- Different conversation than first page
- No duplicates

### TC-2.5 Limit Bounds
**Call:** GET /conversations?limit=0
**Verify:** Returns at least 1 item (clamped to min)
**Call:** GET /conversations?limit=200
**Verify:** Returns max 100 items (clamped to max)

---

## TC-3: GET /conversations/:id - Get Conversation

### TC-3.1 Get Existing Conversation
**Setup:** Create conversation with id = conv-test-1
**Call:** GET /conversations/conv-test-1
**Expect:** 200
**Verify:**
- conversationId = "conv-test-1"
- All metadata fields present
- history = [] (empty for new conversation)

### TC-3.2 Conversation Not Found
**Call:** GET /conversations/nonexistent-id
**Expect:** 404
**Verify:**
- Error code = "NOT_FOUND"

---

## TC-4: DELETE /conversations/:id - Delete Conversation

### TC-4.1 Delete Existing
**Setup:** Create conversation with id = conv-to-delete
**Call:** DELETE /conversations/conv-to-delete
**Expect:** 204 (no content)

### TC-4.2 Delete Non-Existent
**Call:** DELETE /conversations/nonexistent-id
**Expect:** 404

### TC-4.3 Verify Deleted
**Setup:** Create conversation, delete it
**Call:** GET /conversations (list)
**Verify:** Deleted conversation not in list
**Call:** GET /conversations/{deleted-id}
**Verify:** 404

---

## TC-5: PATCH /conversations/:id - Update Metadata

### TC-5.1 Update Title Only
**Setup:** Create conversation
**Call:** PATCH /conversations/{id}
```json
{ "title": "Updated Title" }
```
**Expect:** 200
**Verify:**
- title = "Updated Title"
- All other fields unchanged
- updatedAt > original updatedAt

### TC-5.2 Update Multiple Fields
**Setup:** Create conversation
**Call:** PATCH /conversations/{id}
```json
{
  "title": "New Title",
  "summary": "New Summary",
  "tags": ["new", "tags"],
  "agentRole": "coder"
}
```
**Expect:** 200
**Verify:**
- All specified fields updated
- Model config unchanged
- updatedAt changed

### TC-5.3 Update Model Config (Valid)
**Setup:** Create conversation with openai + responses
**Call:** PATCH /conversations/{id}
```json
{
  "modelProviderId": "anthropic",
  "modelProviderApi": "messages",
  "model": "claude-sonnet-4"
}
```
**Expect:** 200
**Verify:**
- Model config updated
- Metadata unchanged

### TC-5.4 Update Model Config (Invalid Combo)
**Setup:** Create conversation
**Call:** PATCH /conversations/{id}
```json
{
  "modelProviderId": "openai",
  "modelProviderApi": "messages",
  "model": "gpt-5-codex"
}
```
**Expect:** 400

### TC-5.5 Update Immutable Field (conversationId)
**Setup:** Create conversation
**Call:** PATCH /conversations/{id}
```json
{ "conversationId": "different-id" }
```
**Expect:** 400

### TC-5.6 Update Immutable Field (createdAt)
**Setup:** Create conversation
**Call:** PATCH /conversations/{id}
```json
{ "createdAt": "2020-01-01T00:00:00Z" }
```
**Expect:** 400

### TC-5.7 Empty Body
**Setup:** Create conversation
**Call:** PATCH /conversations/{id}
```json
{}
```
**Expect:** 400

### TC-5.8 Conversation Not Found
**Call:** PATCH /conversations/nonexistent
```json
{ "title": "New" }
```
**Expect:** 404

### TC-5.9 UpdatedAt Changes
**Setup:** Create conversation, note original updatedAt
**Call:** PATCH /conversations/{id} with any valid update
**Verify:** updatedAt in response > original updatedAt

---

## TC-6: POST /conversations/:id/messages - Submit Message

### TC-6.1 Submit Message (Basic)
**Setup:** Create conversation
**Call:** POST /conversations/{id}/messages
```json
{ "message": "Hello, world!" }
```
**Expect:** 202
**Verify:**
- Response has turnId (valid UUID)
- Response has conversationId (matches request)
- Response has streamUrl (format: /api/v1/turns/{turnId}/stream-events)
- Response has statusUrl (format: /api/v1/turns/{turnId})
- Response received within 100ms

### TC-6.2 Conversation Not Found
**Call:** POST /conversations/nonexistent/messages
```json
{ "message": "Test" }
```
**Expect:** 404

### TC-6.3 Empty Message
**Setup:** Create conversation
**Call:** POST /conversations/{id}/messages
```json
{ "message": "" }
```
**Expect:** 400

### TC-6.4 With Model Override (Valid)
**Setup:** Create conversation (openai + responses)
**Call:** POST /conversations/{id}/messages
```json
{
  "message": "Try with Claude",
  "modelProviderId": "anthropic",
  "modelProviderApi": "messages",
  "model": "claude-sonnet-4"
}
```
**Expect:** 202
**Verify:**
- Returns turnId
- (Verify in stream test that anthropic was used)

### TC-6.5 Invalid Override Combo
**Setup:** Create conversation
**Call:** POST /conversations/{id}/messages
```json
{
  "message": "Test",
  "modelProviderId": "openai",
  "modelProviderApi": "messages",
  "model": "gpt-5-codex"
}
```
**Expect:** 400

### TC-6.6 Partial Override
**Setup:** Create conversation
**Call:** POST /conversations/{id}/messages
```json
{
  "message": "Test",
  "modelProviderId": "anthropic"
}
```
**Expect:** 400
**Verify:** Error indicates all three model fields required together

---

## TC-7: GET /turns/:id - Turn Status

### TC-7.1 Completed Turn with Defaults
**Setup:** Create conversation, submit message, wait for completion
**Call:** GET /turns/{turnId}
**Expect:** 200
**Verify:**
- status = "completed"
- startedAt present
- completedAt present
- result present (ResponseItem with assistant message)
- thinking = [] (thinkingLevel defaults to full but conversation may have no thinking)
- toolCalls = [] (toolLevel defaults to none)

### TC-7.2 With thinkingLevel=none
**Setup:** Same as TC-7.1
**Call:** GET /turns/{turnId}?thinkingLevel=none
**Expect:** 200
**Verify:**
- thinking = [] or field absent

### TC-7.3 With toolLevel=full
**Setup:** Create conversation, submit message that uses tool, wait for completion
**Call:** GET /turns/{turnId}?toolLevel=full
**Expect:** 200
**Verify:**
- toolCalls array not empty
- Each toolCall has: name, callId, input, output

### TC-7.4 Running Turn
**Setup:** Create conversation, submit message (mock slow response)
**Call:** GET /turns/{turnId} (while still running)
**Expect:** 200
**Verify:**
- status = "running"
- startedAt present
- completedAt = null
- result absent or null

### TC-7.5 Turn Not Found
**Call:** GET /turns/nonexistent-turn-id
**Expect:** 404

---

## TC-8: GET /turns/:id/stream-events - Event Streaming

### TC-8.1 Basic Stream
**Setup:** Create conversation, submit simple message
**Call:** GET /turns/{turnId}/stream-events
**Expect:** 200 (text/event-stream)
**Verify Event Sequence:**
1. Event: task_started
2. Event: agent_message (contains response text)
3. Event: task_complete

### TC-8.2 Stream with Tool Execution
**Setup:** Create conversation, submit message requiring tool (mock readFile)
**Call:** GET /turns/{turnId}/stream-events?toolLevel=full
**Expect:** 200 (text/event-stream)
**Verify Event Sequence:**
1. task_started
2. exec_command_begin (tool: readFile)
3. exec_command_end (with output)
4. agent_message (response using tool result)
5. task_complete

### TC-8.3 With thinkingLevel=none
**Setup:** Submit message
**Call:** GET /turns/{turnId}/stream-events?thinkingLevel=none
**Verify:**
- No agent_reasoning events in stream
- agent_message events present

### TC-8.4 Client Disconnect and Reconnect
**Setup:** Create conversation, submit message (mock 30s execution)
**Call:** GET /turns/{turnId}/stream-events
**Action:**
1. Subscribe to stream
2. Receive first 3 events
3. Save last event ID
4. Close connection
5. Reconnect: GET /turns/{turnId}/stream-events with Last-Event-ID header = saved ID
**Verify:**
- Second stream starts from event 4 (no duplicates)
- Receives remaining events
- Complete event sequence when combined

### TC-8.5 Multiple Subscribers
**Setup:** Submit message
**Action:**
1. Client A subscribes: GET /turns/{turnId}/stream-events
2. Client B subscribes: GET /turns/{turnId}/stream-events
**Verify:**
- Both clients receive identical events
- Both clients receive events in same order
- Either client can disconnect without affecting other

### TC-8.6 Turn Not Found
**Call:** GET /turns/nonexistent/stream-events
**Expect:** 404

### TC-8.7 Keepalive During Long Gaps
**Setup:** Submit message with mocked 20s gap between events
**Call:** GET /turns/{turnId}/stream-events
**Verify:**
- Connection stays alive during gap
- No timeout
- Keepalive comments received (`:keepalive\n\n`)
- Events arrive correctly after gap

### TC-8.8 Error Event in Stream
**Setup:** Submit message (mock error during execution)
**Call:** GET /turns/{turnId}/stream-events
**Verify Event Sequence:**
1. task_started
2. error (with message and details)
3. turn_aborted (or task_complete with error status)

---

## TC-L1: Full Conversation Flow

**Steps:**
1. POST /conversations (openai + responses + gpt-5-codex)
   - Save conversationId
2. POST /conversations/{id}/messages `{ "message": "Hello" }`
   - Save turnId and streamUrl
3. Subscribe to streamUrl
   - Verify: task_started event
   - Verify: agent_message event
   - Verify: task_complete event
4. GET /conversations/{id}
   - Verify: history has 2 items (user message + assistant message)
5. GET /turns/{turnId}
   - Verify: status = "completed"
   - Verify: result contains assistant message

---

## TC-L2: Multi-Turn Conversation

**Steps:**
1. POST /conversations
   - Save conversationId
2. POST /conversations/{id}/messages `{ "message": "First message" }`
   - Subscribe to stream, wait for task_complete
3. POST /conversations/{id}/messages `{ "message": "Second message" }`
   - Subscribe to stream, wait for task_complete
4. GET /conversations/{id}
   - Verify: history.length >= 4 (2 user + 2 assistant minimum)
   - Verify: chronological order (user, assistant, user, assistant)
   - Verify: First message appears before second

---

## TC-L3: Conversation with Tool Execution

**Steps:**
1. POST /conversations
   - Save conversationId
2. POST /conversations/{id}/messages
   ```json
   { "message": "Read the file test.txt" }
   ```
   (Mock: Model calls readFile tool)
3. Subscribe to stream with toolLevel=full
   - Verify sequence:
     - task_started
     - exec_command_begin (tool: readFile, file: test.txt)
     - exec_command_end (exit_code: 0, stdout: file contents)
     - agent_message (mentions file contents)
     - task_complete
4. GET /turns/{turnId}?toolLevel=full
   - Verify: toolCalls array has 1 entry
   - Verify: toolCalls[0].name = "readFile"
   - Verify: toolCalls[0].output present

---

## TC-L4: Provider Override Workflow

**Steps:**
1. POST /conversations (openai + responses + gpt-5-codex)
   - Save conversationId
2. POST /conversations/{id}/messages with override
   ```json
   {
     "message": "Use Claude for this",
     "modelProviderId": "anthropic",
     "modelProviderApi": "messages",
     "model": "claude-sonnet-4"
   }
   ```
   - Subscribe to stream
   - Verify: Events come from anthropic (check event metadata if available)
3. POST /conversations/{id}/messages (no override)
   ```json
   { "message": "Back to default" }
   ```
   - Subscribe to stream
   - Verify: Uses openai (conversation default)

---

## TC-L5: Metadata Lifecycle

**Steps:**
1. POST /conversations
   ```json
   {
     "modelProviderId": "openai",
     "modelProviderApi": "responses",
     "model": "gpt-5-codex",
     "title": "Initial Title",
     "tags": ["initial"]
   }
   ```
   - Save conversationId, original updatedAt
2. PATCH /conversations/{id}
   ```json
   { "title": "Updated Title" }
   ```
   - Verify: title changed, tags unchanged, updatedAt changed
3. PATCH /conversations/{id}
   ```json
   { "tags": ["updated", "tags"] }
   ```
   - Verify: tags changed, title unchanged, updatedAt changed again
4. GET /conversations/{id}
   - Verify: title = "Updated Title"
   - Verify: tags = ["updated", "tags"]
5. GET /conversations (list)
   - Find conversation by id
   - Verify: Metadata matches (title, tags visible in list)

---

## TC-L6: Stream Reconnection

**Steps:**
1. POST /conversations, save id
2. POST /conversations/{id}/messages (mock: slow execution, 30s total)
   - Save turnId, streamUrl
3. Subscribe to streamUrl
4. Receive first 5 events
   - Save last event ID from `id:` field
5. Close connection (disconnect)
6. Reconnect: GET streamUrl with header `Last-Event-ID: {saved-id}`
7. Receive remaining events
**Verify:**
- No duplicate events
- Events 6+ received (not 1-5)
- Complete event sequence when combined with first subscription
- Final event is task_complete

---

## TC-L7: Concurrent Conversations

**Steps:**
1. POST /conversations (create A), save idA
2. POST /conversations (create B), save idB
3. POST /conversations/{idA}/messages `{ "message": "Message to A" }`
   - Save turnIdA, streamUrlA
4. POST /conversations/{idB}/messages `{ "message": "Message to B" }`
   - Save turnIdB, streamUrlB
5. Subscribe to streamUrlA and streamUrlB simultaneously
6. Collect all events from both streams
**Verify:**
- Stream A completes with task_complete
- Stream B completes with task_complete
- Events from A don't appear in B's stream
- Events from B don't appear in A's stream
- Both conversations independent

---

## Test Summary

**Parallel Tests:** 30 tests (TC-1.1 through TC-8.8)
**Lifecycle Tests:** 7 tests (TC-L1 through TC-L7)
**Total:** 37 test conditions

**Coverage:**
- Conversation CRUD (create, list, get, delete, update)
- Provider/API validation (10 validation tests)
- Pagination (cursor-based)
- Message submission (async pattern)
- Event streaming (SSE with reconnection)
- Tool execution visibility
- Model overrides
- Metadata management
- Concurrent operations
