# Phase 1: Basic Chat Flow - Task Checklist

**Phase:** 1 - Basic Chat Flow
**Status:** Not Started
**Estimated Code:** ~400 lines (CLI ~300, tests ~100)

---

## Setup

- [ ] Create CLI directory structure (src/cli/)
- [ ] Install Commander.js: `npm install commander`
- [ ] Create CLI entry point: src/cli/index.ts
- [ ] Add package.json bin entry for "cody" command

---

## Config Loading

- [ ] Create src/cli/config.ts
- [ ] Implement loadConfig() - reads ~/.codex/config.toml
- [ ] Handle missing config (use defaults or error)
- [ ] Extract provider, model, auth from config
- [ ] Test: Config loads correctly

---

## ModelClient Construction

- [ ] Create src/cli/client-factory.ts
- [ ] Implement createModelClient(config)
- [ ] Switch on config.provider (openai only for Phase 1)
- [ ] Switch on config.api (responses only for Phase 1)
- [ ] Construct ResponsesClient with auth from config
- [ ] Return ModelClient interface
- [ ] Test: Client created with correct config

---

## ConversationManager Integration

- [ ] Import ConversationManager from core
- [ ] Create manager instance (inject ModelClient)
- [ ] Store manager reference (singleton or in CLI state)
- [ ] Verify: Can call manager.createConversation()

---

## CLI Commands

### cody new

- [ ] Create src/cli/commands/new.ts
- [ ] Implement newCommand handler
- [ ] Call manager.createConversation(config)
- [ ] Display conversation ID to user
- [ ] Handle errors (config invalid, client creation fails)
- [ ] Test manually: cody new → shows conversation ID

### cody chat

- [ ] Create src/cli/commands/chat.ts
- [ ] Implement chatCommand handler
- [ ] Parse message argument
- [ ] Get active conversation (from manager or stored ID)
- [ ] Call conversation.sendMessage(message)
- [ ] Pass response to display renderer
- [ ] Handle errors (no active conversation, API failure)
- [ ] Test manually: cody chat "Hello" → shows response

---

## Display Renderer

- [ ] Create src/cli/display.ts
- [ ] Implement renderResponse(items: ResponseItems[])
- [ ] Extract text content from ResponseItems
- [ ] Print to console (batch mode for Phase 1)
- [ ] Format nicely (e.g., "Assistant: [message]")
- [ ] Test: Response displays clearly

---

## Mocked-Service Tests (TDD - Write These FIRST)

- [ ] Create tests/mocked-service/ directory
- [ ] Create tests/mocks/ directory
- [ ] Create tests/mocks/model-client.ts
  - [ ] Implement createMockClient(responses)
  - [ ] Mock returns preset ResponseItems
  - [ ] No real API calls
- [ ] Create tests/mocks/config.ts
  - [ ] Mock config with test values
- [ ] Create tests/mocked-service/phase-1-conversation-flow.test.ts
- [ ] Test: Create conversation with mocked client
  - [ ] Conversation has ID
  - [ ] Conversation stored in manager
- [ ] Test: Send message with mocked client
  - [ ] Mock client called with message
  - [ ] ResponseItems returned
  - [ ] Response has expected structure
- [ ] Test: Multi-turn conversation
  - [ ] Send message 1
  - [ ] Send message 2
  - [ ] Verify: Second call includes first message in history
  - [ ] History maintained correctly
- [ ] All mocked-service tests passing

---

## Functional Verification (Manual CLI Testing)

- [ ] Test: cody new with valid config → conversation ID displayed
- [ ] Test: cody chat "Hello" → response from OpenAI displayed
- [ ] Test: cody chat "What did I just say?" → model has context
- [ ] Test: Error cases (missing config, invalid API key)
- [ ] Verify: Multi-turn chat works, context maintained

---

## Quality Gates

- [ ] Run: npm run format → no changes (already formatted)
- [ ] Run: npm run lint → 0 errors (warnings OK)
- [ ] Run: npx tsc --noEmit → 0 errors
- [ ] Run: npm test
  - [ ] Mocked-service tests: phase-1-conversation-flow.test.ts passing
  - [ ] Unit tests: 1,876+ baseline maintained
  - [ ] No skipped tests
- [ ] Combined check: npm run format && npm run lint && npx tsc --noEmit && npm test
  - [ ] All pass in sequence

---

## Documentation

- [ ] Update DECISIONS.md with key choices made
- [ ] Review: All decisions have rationale
- [ ] Verify: CHECKLIST complete (all tasks checked)

---

## Final

- [ ] All tasks above complete
- [ ] All quality gates passed
- [ ] Functional verification successful
- [ ] Code committed and pushed
- [ ] Phase 1 ready for verification stages
