# Phase 1: Basic Chat Flow - Task Checklist

**Phase:** 1 - Basic Chat Flow
**Status:** Not Started
**Estimated Code:** ~400 lines (CLI ~300, tests ~100)

---

## Setup

- [x] Create CLI directory structure (src/cli/)
- [x] Install Commander.js: `npm install commander`
- [x] Create CLI entry point: src/cli/index.ts
- [x] Add package.json bin entry for "cody" command

---

## Config Loading

- [x] Create src/cli/config.ts
- [x] Implement loadConfig() - reads ~/.codex/config.toml
- [x] Handle missing config (use defaults or error)
- [x] Extract provider, model, auth from config
- [x] Test: Config loads correctly

---

## ModelClient Construction

- [x] Create src/cli/client-factory.ts
- [x] Implement createModelClient(config)
- [x] Switch on config.provider (openai only for Phase 1)
- [x] Switch on config.api (responses only for Phase 1)
- [x] Construct ResponsesClient with auth from config
- [x] Return ModelClient interface
- [x] Test: Client created with correct config

---

## ConversationManager Integration

- [x] Import ConversationManager from core
- [x] Create manager instance (inject ModelClient)
- [x] Store manager reference (singleton or in CLI state)
- [x] Verify: Can call manager.createConversation()

## Conversation API

- [x] Wrap CodexConversation in public Conversation class
- [x] Expose sendMessage/nextEvent helpers
- [x] Update CLI and tests to use Conversation instead of raw submissions

---

## CLI Commands

### cody new

- [x] Create src/cli/commands/new.ts
- [x] Implement newCommand handler
- [x] Call manager.createConversation(config)
- [x] Display conversation ID to user
- [x] Handle errors (config invalid, client creation fails)
- [ ] Test manually: cody new → shows conversation ID

### cody chat

- [x] Create src/cli/commands/chat.ts
- [x] Implement chatCommand handler
- [x] Parse message argument
- [x] Get active conversation (from manager or stored ID)
- [x] Call conversation.sendMessage(message)
- [x] Pass response to display renderer
- [x] Handle errors (no active conversation, API failure)
- [ ] Test manually: cody chat "Hello" → shows response

### cody repl

- [x] Add interactive REPL command
- [x] Keep manager/conversation alive for entire session
- [x] Support `new`, `chat`, `help`, and `exit`
- [ ] Test manually: run `node dist/cli/index.js repl`

---

## Display Renderer

- [x] Create src/cli/display.ts
- [x] Implement renderResponse(items: ResponseItems[])
- [x] Extract text content from ResponseItems
- [x] Print to console (batch mode for Phase 1)
- [x] Format nicely (e.g., "Assistant: [message]")
- [ ] Test: Response displays clearly

---

## Mocked-Service Tests (TDD - Write These FIRST)

- [x] Create tests/mocked-service/ directory
- [x] Create tests/mocks/ directory
- [x] Create tests/mocks/model-client.ts
  - [x] Implement createMockClient(responses)
  - [x] Mock returns preset ResponseItems
  - [x] No real API calls
- [x] Create tests/mocks/config.ts
  - [x] Mock config with test values
- [x] Create tests/mocked-service/phase-1-conversation-flow.test.ts
- [x] Test: Create conversation with mocked client
  - [x] Conversation has ID
  - [x] Conversation stored in manager
- [x] Test: Send message with mocked client
  - [x] Mock client called with message
  - [x] ResponseItems returned
  - [x] Response has expected structure
- [x] Test: Multi-turn conversation
  - [x] Send message 1
  - [x] Send message 2
  - [x] Verify: Second call includes first message in history
  - [x] History maintained correctly
- [x] Add Conversation sendMessage unit tests (total mocked-service tests ≥ 15)
- [x] All mocked-service tests passing

---

## Functional Verification (Manual CLI Testing)

- [ ] Test: cody new with valid config → conversation ID displayed
- [ ] Test: cody chat "Hello" → response from OpenAI displayed
- [ ] Test: cody chat "What did I just say?" → model has context
- [ ] Test: Error cases (missing config, invalid API key)
- [ ] Verify: Multi-turn chat works, context maintained

---

## Quality Gates

- [x] Run: npm run format → no changes (already formatted)
- [x] Run: npm run lint → 0 errors (warnings OK)
- [x] Run: npx tsc --noEmit → 0 errors
- [x] Run: npm test
  - [x] Mocked-service tests: phase-1-conversation-flow.test.ts passing
  - [x] Unit tests: 1,876+ baseline maintained
  - [x] No skipped tests
- [x] Combined check: npm run format && npm run lint && npx tsc --noEmit && npm test
  - [x] All pass in sequence

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
