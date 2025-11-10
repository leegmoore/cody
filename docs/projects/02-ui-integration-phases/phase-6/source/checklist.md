# Phase 6: Library API & REST API – Task Checklist

**Status:** Not Started
**Estimated Code:** ~2,380 lines (library 450, REST API 950, Playwright 980)

---

## Setup & Planning

- [ ] Review Phases 1-5 (all functionality working)
- [ ] Read TECH-APPROACH Section 7 (Phase 6 approach)
- [ ] Read phase-6/source/design.md (implementation details)
- [ ] Install Playwright: `npm install -D @playwright/test`
- [ ] Install Fastify: `npm install fastify`
- [ ] Ensure Bun installed for runtime

---

## Library API Definition

### Exports File

- [ ] Create `src/index.ts` (main library export)
- [ ] Export ConversationManager
- [ ] Export CodexConversation
- [ ] Export createConversationManager factory
- [ ] Export types: ConversationConfig, AuthMethod, Provider, WireApi
- [ ] Export protocol types: ResponseItem, FunctionCall, UserInput
- [ ] Export utilities (optional): countTokens, parseRollout
- [ ] Verify: No internal implementation exported (Session, Codex internals stay private)

### Documentation

- [ ] Create `docs/api/library-api.md`
- [ ] Document all exported classes with signatures
- [ ] Document factory helper with usage
- [ ] Document types with field descriptions
- [ ] Add 3-5 usage examples:
  - [ ] Basic chat example
  - [ ] Multi-turn with tools example
  - [ ] Resume example
  - [ ] Provider switching example
  - [ ] Error handling example
- [ ] Document contract boundaries (what to mock for testing)

### Validation

- [ ] Create minimal test app: `examples/basic-usage.ts`
- [ ] Import library, create conversation, send message
- [ ] Verify: Example works, demonstrates library usage
- [ ] Update existing mocked-service tests to import from library
- [ ] Verify: All Phase 1-5 tests still pass with library imports

---

## REST API Implementation

### Server Setup

- [ ] Create `src/api/server.ts`
- [ ] Implement createServer(options)
- [ ] Implement startServer(port)
- [ ] Configure Fastify (logger, request ID)
- [ ] Add health check endpoint: GET /health

### Middleware

- [ ] Create `src/api/middleware/auth.ts`
  - [ ] Implement authMiddleware(expectedApiKey)
  - [ ] Extract Bearer token from Authorization header
  - [ ] Validate token matches expected
  - [ ] Return 401 if missing or invalid
  - [ ] Skip auth for /health endpoint

- [ ] Create `src/api/middleware/error.ts`
  - [ ] Implement errorMiddleware(error, req, res)
  - [ ] Map ConfigurationError → 400
  - [ ] Map AuthError → 401
  - [ ] Map ConversationNotFoundError → 404
  - [ ] Map all others → 500
  - [ ] Format: {error: {code, message, details}}

### Conversation Routes

- [ ] Create `src/api/routes/conversations.ts`
- [ ] POST /conversations (create)
  - [ ] Validate request body
  - [ ] Call manager.newConversation()
  - [ ] Return 201 with conversationId
- [ ] GET /conversations (list)
  - [ ] Call manager.listConversations()
  - [ ] Return array
- [ ] GET /conversations/:id (get)
  - [ ] Call manager.getConversation(id)
  - [ ] Return 404 if not found
  - [ ] Return metadata
- [ ] DELETE /conversations/:id (delete)
  - [ ] Call manager.removeConversation(id)
  - [ ] Return 204
- [ ] POST /conversations/:id/resume (resume)
  - [ ] Call manager.resumeConversation(id)
  - [ ] Return 404 if not found
  - [ ] Return success

### Message Routes

- [ ] Create `src/api/routes/messages.ts`
- [ ] POST /conversations/:id/messages (send)
  - [ ] Validate request (message field required)
  - [ ] Get conversation or 404
  - [ ] If stream=true:
    - [ ] Set SSE headers
    - [ ] Stream events via reply.raw.write()
    - [ ] End stream on completed event
  - [ ] If stream=false:
    - [ ] Collect all events
    - [ ] Return {items, usage}
- [ ] GET /conversations/:id/messages (history)
  - [ ] Get conversation or 404
  - [ ] Return conversation history
  - [ ] Format: {conversationId, messages: [...]}

### Config Routes

- [ ] Create `src/api/routes/config.ts`
- [ ] GET /config (get current config)
  - [ ] Return provider, api, model, auth method
- [ ] POST /config/provider (set provider)
  - [ ] Validate provider/api combo
  - [ ] Update config
  - [ ] Return success
- [ ] POST /config/auth (set auth method)
  - [ ] Validate method
  - [ ] Update config
  - [ ] Return success

### REST API Documentation

- [ ] Create `docs/api/rest-api.md`
- [ ] Document all endpoints with:
  - [ ] HTTP method and path
  - [ ] Request format (JSON schema)
  - [ ] Response format (JSON schema)
  - [ ] Status codes (success and error)
  - [ ] Example curl commands
- [ ] Document authentication (Bearer token)
- [ ] Document error response format
- [ ] Document SSE streaming format
- [ ] Add usage examples (curl, JavaScript fetch)

---

## Playwright Testing Setup

### Test Infrastructure

- [ ] Create `tests/playwright/` directory
- [ ] Create playwright.config.ts
- [ ] Configure base URL (http://localhost:3000)
- [ ] Configure test modes (mocked vs integration)
- [ ] Add npm scripts:
  - [ ] `test:playwright:mocked` - Run with mocks
  - [ ] `test:playwright:integration` - Run with real APIs
  - [ ] `test:playwright` - Run both modes

### Mock Servers

- [ ] Create `tests/playwright/mocks/model-server.ts`
  - [ ] Implement OpenAI Responses API mock
  - [ ] Implement OpenAI Chat API mock
  - [ ] Implement Anthropic Messages API mock
  - [ ] Return preset responses based on request
  - [ ] Track requests for verification

- [ ] Create `tests/playwright/mocks/search-server.ts`
  - [ ] Mock Perplexity API (if Phase 4.7 tools used)
  - [ ] Mock Firecrawl API
  - [ ] Return preset search results

- [ ] Create `tests/playwright/mocks/start-mocks.ts`
  - [ ] Start all mock servers
  - [ ] Export cleanup function
  - [ ] Use in Playwright global setup

### Test Configuration

- [ ] Create `tests/playwright/config/mocked.config.ts`
  - [ ] Mock server URLs (localhost:3001-3004)
  - [ ] Test API key
  - [ ] Mock mode flag

- [ ] Create `tests/playwright/config/integration.config.ts`
  - [ ] Real API URLs
  - [ ] Real API keys from .env
  - [ ] Integration mode flag

### Fixtures

- [ ] Create `tests/playwright/fixtures/responses.ts`
  - [ ] Preset ResponseItems for various scenarios
  - [ ] Tool call responses
  - [ ] Error responses
  - [ ] Thinking/reasoning blocks

---

## Playwright Test Implementation

### Conversations Suite

- [ ] Create `tests/playwright/api/conversations.spec.ts`
- [ ] Implement Tests 1-15 (from test-conditions.md)
- [ ] Use Playwright request API
- [ ] Verify status codes, response formats
- [ ] Test error cases

### Messages Suite

- [ ] Create `tests/playwright/api/messages.spec.ts`
- [ ] Implement Tests 16-35 (20 tests)
- [ ] Test batch and streaming modes
- [ ] Test tool execution via REST
- [ ] Test multi-turn conversations

### Providers Suite

- [ ] Create `tests/playwright/api/providers.spec.ts`
- [ ] Implement Tests 36-47 (12 tests)
- [ ] Test all three providers
- [ ] Test thinking mode
- [ ] Test temperature variation
- [ ] Verify provider parity

### Auth Suite

- [ ] Create `tests/playwright/api/auth.spec.ts`
- [ ] Implement Tests 48-55 (8 tests)
- [ ] Test all auth methods
- [ ] Test missing/invalid tokens
- [ ] Test REST API key validation

### Integration Suite (Non-Mocked)

- [ ] Create `tests/playwright/integration/smoke.spec.ts`
- [ ] Implement Tests 56-63 (8 key scenarios)
- [ ] Use real API keys
- [ ] Test with real models (cheap ones)
- [ ] Log results (latency, token usage)

---

## Quality Gates

### Code Quality

- [ ] Run: `npm run format` → no changes
- [ ] Run: `npm run lint` → 0 errors
- [ ] Run: `npx tsc --noEmit` → 0 errors

### Testing

- [ ] Run: `npm test` → all passing (mocked-service baseline + library tests)
- [ ] Run: `npm run test:playwright:mocked` → 55 tests passing in <2 min
- [ ] Run: `npm run test:playwright:integration` → 8 tests passing in ~5 min
- [ ] Verify: 0 skipped tests across all suites

### Combined Verification

- [ ] Run: `npm run format && npm run lint && npx tsc --noEmit && npm test && npm run test:playwright:mocked`
- [ ] All commands succeed
- [ ] Save output for verification

---

## Manual Verification

- [ ] Follow `manual-test-script.md`
- [ ] Test REST API with curl
- [ ] Test library with example app
- [ ] Verify Bun runtime works
- [ ] Test both streaming and batch modes

---

## Code Review

### Stage 1: Traditional Review

- [ ] API design RESTful (proper HTTP methods, status codes)
- [ ] Error handling comprehensive (all cases covered)
- [ ] Security (auth validation, input sanitization, no injection)
- [ ] Library exports minimal and clean
- [ ] REST routes thin (no business logic)
- [ ] Middleware reusable

### Stage 2: Port Validation Review

- [ ] Library exports match Rust Codex public API philosophy
- [ ] REST API maps correctly to library methods
- [ ] Playwright tests cover all integration paths
- [ ] Mock servers accurately simulate real APIs
- [ ] Non-mocked tests validate real behavior

---

## Documentation

- [ ] Update DECISIONS.md:
  - [ ] Library export choices (what/why)
  - [ ] REST API auth strategy
  - [ ] Streaming format
  - [ ] Error response format
  - [ ] Bun vs Node decision
  - [ ] Mock server approach
  - [ ] Test organization
- [ ] Verify docs/api/ complete (library-api.md, rest-api.md)
- [ ] Update checklist (mark completed)

---

## Final Verification

- [ ] All tasks completed
- [ ] All tests passing (mocked-service + Playwright mocked + Playwright integration)
- [ ] All quality gates passed
- [ ] Manual verification complete
- [ ] Code review complete (both stages)
- [ ] Documentation complete (library + REST API specs)
- [ ] Example app works
- [ ] Ready to commit and proceed to Phase 7

---

**Phase 6 complete when all items checked ✓**
