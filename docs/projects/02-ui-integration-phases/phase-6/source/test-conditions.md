# Phase 6: Test Conditions

**Test Frameworks:**
- Playwright (REST API testing)
- Vitest (library import validation)

**Test Modes:**
- Mocked: Mock LLM APIs, fast, comprehensive
- Non-mocked: Real LLM APIs, slow, key scenarios only

---

## Library API Validation (Vitest)

**File:** `tests/library/exports.test.ts`

### Test 1: Can Import Library
- **Execute:** `import {ConversationManager} from '@openai/codex-core'`
- **Verify:** Import succeeds, ConversationManager is defined

### Test 2: Factory Helper Works
- **Execute:** `import {createConversationManager} from '@openai/codex-core'`
- **Verify:** Can call factory, returns ConversationManager instance

### Test 3: Types Exported
- **Execute:** Import ConversationConfig, AuthMethod, ResponseItem types
- **Verify:** All types available, TypeScript compilation succeeds

### Test 4: Existing Mocked-Service Tests Work with Library Imports
- **Execute:** Update phase 1-5 mocked-service tests to import from '@openai/codex-core' instead of relative paths
- **Verify:** All tests still pass (library exports work)

---

## Playwright Mocked Mode Tests

**Environment:** `TEST_MODE=mocked`
**Base URL:** `http://localhost:3000`
**Mock APIs:** localhost:3001-3004

### Suite 1: Conversations API (15 tests)

**File:** `tests/playwright/api/conversations.spec.ts`

**Test 1: Create Conversation (OpenAI Responses)**
- **Request:** POST /conversations with provider=openai, api=responses
- **Verify:** 201 Created, returns conversationId, provider, model

**Test 2: Create Conversation (Anthropic Messages)**
- **Request:** POST /conversations with provider=anthropic, api=messages
- **Verify:** 201 Created, returns conversationId

**Test 3: Create with Invalid Provider**
- **Request:** POST /conversations with provider=invalid
- **Verify:** 400 Bad Request, error.code='CONFIGURATION_ERROR'

**Test 4: Create with Missing Fields**
- **Request:** POST /conversations with missing model field
- **Verify:** 400 Bad Request, error message lists missing fields

**Test 5: Create Without Auth Header**
- **Request:** POST /conversations without Authorization header
- **Verify:** 401 Unauthorized

**Test 6: Create with Invalid API Key**
- **Request:** POST /conversations with wrong Bearer token
- **Verify:** 401 Unauthorized

**Test 7: List Conversations**
- **Setup:** Create 3 conversations
- **Request:** GET /conversations
- **Verify:** Returns array with 3 items, all have id/provider/model/updatedAt

**Test 8: List When Empty**
- **Request:** GET /conversations (no conversations created)
- **Verify:** Returns {conversations: []}

**Test 9: Get Conversation**
- **Setup:** Create conversation
- **Request:** GET /conversations/:id
- **Verify:** Returns conversation metadata

**Test 10: Get Missing Conversation**
- **Request:** GET /conversations/nonexistent
- **Verify:** 404 Not Found, error.code='CONVERSATION_NOT_FOUND'

**Test 11: Delete Conversation**
- **Setup:** Create conversation
- **Request:** DELETE /conversations/:id
- **Verify:** 204 No Content, conversation removed

**Test 12: Delete Missing Conversation**
- **Request:** DELETE /conversations/nonexistent
- **Verify:** 404 Not Found

**Test 13: Resume Conversation**
- **Setup:** Create conversation, send messages, get ID
- **Request:** POST /conversations/:id/resume
- **Verify:** Returns {conversationId, resumed: true}

**Test 14: Resume Missing Conversation**
- **Request:** POST /conversations/nonexistent/resume
- **Verify:** 404 Not Found

**Test 15: Concurrent Conversation Creation**
- **Execute:** Create 5 conversations in parallel (Promise.all)
- **Verify:** All succeed, all have unique IDs

### Suite 2: Messages API (20 tests)

**File:** `tests/playwright/api/messages.spec.ts`

**Test 16: Send Message (Batch Mode)**
- **Setup:** Create conversation
- **Request:** POST /conversations/:id/messages with message="Hello", stream=false
- **Verify:** Returns {items: [...], usage: {...}}, items[0].type='message'

**Test 17: Send Message (Streaming Mode)**
- **Request:** POST /conversations/:id/messages with stream=true
- **Verify:** Response Content-Type='text/event-stream', body contains SSE events

**Test 18: Send to Missing Conversation**
- **Request:** POST /conversations/nonexistent/messages
- **Verify:** 404 Not Found

**Test 19: Send Empty Message**
- **Request:** POST /conversations/:id/messages with message=""
- **Verify:** 400 Bad Request, error about empty message

**Test 20: Send Message with Tool Call**
- **Setup:** Mock model returns FunctionCall item
- **Request:** POST /conversations/:id/messages with message triggering tool
- **Verify:** Response includes function_call and function_call_output items

**Test 21: Get Message History**
- **Setup:** Create conversation, send 3 messages
- **Request:** GET /conversations/:id/messages
- **Verify:** Returns {messages: [...]}, array has 6+ items (3 user + 3 assistant)

**Test 22: Multi-Turn Conversation**
- **Execute:** Send 3 messages in sequence to same conversation
- **Verify:** Each response has context from previous messages

**Test 23: Large Message Handling**
- **Request:** Send message with 10k characters
- **Verify:** Succeeds, no truncation errors

**Test 24: Concurrent Messages to Same Conversation**
- **Execute:** Send 3 messages in parallel to same conversation
- **Verify:** All succeed (or properly queued/rejected)

**Test 25-35:** (10 more message tests covering error cases, edge cases, tool execution scenarios)

### Suite 3: Provider Parity (12 tests)

**File:** `tests/playwright/api/providers.spec.ts`

**Test 36: Responses API Works**
- **Request:** Create with api=responses, send message
- **Verify:** Response received

**Test 37: Chat API Works**
- **Request:** Create with api=chat, send message
- **Verify:** Response received

**Test 38: Messages API Works**
- **Request:** Create with api=messages, send message
- **Verify:** Response received

**Test 39: OpenRouter Works**
- **Request:** Create with provider=openai, api=chat, model=google/gemini-2.0-flash-001 (via OpenRouter)
- **Verify:** Response received

**Test 40: Provider Switching**
- **Execute:** Create conversation with openai, then create with anthropic
- **Verify:** Both work, isolated from each other

**Test 41: Thinking Mode (Responses)**
- **Request:** Create with thinking enabled, send message
- **Verify:** Response includes reasoning blocks

**Test 42: Thinking Mode (Messages)**
- **Request:** Create with thinking enabled (Messages API), send message
- **Verify:** Response includes thinking blocks

**Test 43: Temperature Variation**
- **Execute:** Send same message with temp=0.2, 0.7, 1.0
- **Verify:** Responses differ (higher temp = more variation)

**Test 44-47:** (4 more provider tests)

### Suite 4: Authentication (8 tests)

**File:** `tests/playwright/api/auth.spec.ts`

**Test 48: API Key Auth Works**
- **Request:** Create conversation with auth.method='openai-api-key'
- **Verify:** Succeeds

**Test 49: Missing Model Provider Key**
- **Setup:** Mock AuthManager returns null
- **Request:** Create conversation
- **Verify:** 400 Bad Request, error about missing provider key

**Test 50: OAuth Auth Works (Mocked)**
- **Setup:** Mock keyring with OAuth token
- **Request:** Create with auth.method='oauth-chatgpt'
- **Verify:** Succeeds, uses mocked token

**Test 51: Invalid Auth Method**
- **Request:** Create with auth.method='invalid'
- **Verify:** 400 Bad Request

**Test 52-55:** (4 more auth tests)

---

## Playwright Non-Mocked Mode Tests

**Environment:** `TEST_MODE=integration`
**Base URL:** `http://localhost:3000`
**Real APIs:** OpenAI, Anthropic, OpenRouter

### Key Scenario Tests (8 tests)

**File:** `tests/playwright/integration/smoke.spec.ts`

**Test 56: OpenAI Responses End-to-End**
- **Execute:** Create conversation (real API key), send message, verify response
- **Verify:** Real GPT-4o-mini responds

**Test 57: Anthropic Messages End-to-End**
- **Execute:** Create with Messages API, send message
- **Verify:** Real Claude responds

**Test 58: OpenRouter End-to-End**
- **Execute:** Create via OpenRouter, send message
- **Verify:** Real Gemini responds

**Test 59: Tool Execution**
- **Execute:** Send message triggering readFile tool
- **Verify:** Tool executes, result returned, model responds

**Test 60: Persistence & Resume**
- **Execute:** Create, send messages, resume, continue
- **Verify:** History preserved across resume

**Test 61: Thinking Mode (Real)**
- **Execute:** Create with thinking enabled, send complex prompt
- **Verify:** Real thinking/reasoning blocks in response

**Test 62: Temperature (Real)**
- **Execute:** Same prompt with different temperatures
- **Verify:** Outputs vary

**Test 63: Multi-Provider in One Session**
- **Execute:** Create OpenAI conversation, create Anthropic conversation, send to both
- **Verify:** Both work, isolated

---

## Mock Strategy

**Mock Model Server:**
- Implements OpenAI Responses, Chat, and Anthropic Messages endpoints
- Returns preset responses based on request
- Tracks requests for verification
- Runs on localhost:3001-3003

**Mock Search Server:**
- Implements Perplexity and Firecrawl endpoints (if Phase 4.7 tools used)
- Returns preset search results
- Runs on localhost:3004

**Mock Keyring:**
- Returns test OAuth tokens
- No real filesystem access

**Mock Filesystem:**
- Use temp directories for JSONL persistence
- Clean up after tests

---

## Verification Checklist

**Library API:**
- [ ] Can import from '@openai/codex-core'
- [ ] Factory helper works
- [ ] Types exported
- [ ] Existing mocked-service tests work with library imports
- [ ] docs/api/library-api.md complete

**REST API:**
- [ ] Server starts with Bun
- [ ] Health check works
- [ ] All endpoints respond
- [ ] docs/api/rest-api.md complete

**Playwright (mocked):**
- [ ] Conversations suite: 15 tests passing
- [ ] Messages suite: 20 tests passing
- [ ] Providers suite: 12 tests passing
- [ ] Auth suite: 8 tests passing
- [ ] Total: 55 tests, all passing in <2 minutes

**Playwright (non-mocked):**
- [ ] 8 key scenarios passing
- [ ] Real models tested
- [ ] Results logged
- [ ] Cost ~$0.05-0.10

**Quality gates:**
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 errors
- [ ] Format: clean
- [ ] Combined: All checks pass

**Code review:**
- [ ] Stage 1: API design, security, error handling
- [ ] Stage 2: Library exports clean, REST maps correctly

---

**All checks ✓ → Phase 6 test conditions complete**
