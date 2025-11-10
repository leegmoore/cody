# Phase 1: Test Conditions

**Test Framework:** Vitest
**Test Location:** `tests/mocked-service/phase-1-conversation-flow.test.ts`
**Mock Location:** `tests/mocks/model-client.ts`, `tests/mocks/config.ts`

---

## Test Suite: Phase 1 Conversation Flow

### Test 1: Create Conversation

**Functional description:**
User can create a new conversation. ConversationManager returns conversation with valid ID. Conversation is stored and retrievable.

**Setup:**
- Mock ModelClient (no responses needed for creation)
- Mock Config (openai, responses, api-key)

**Execute:**
- Create ConversationManager with mocks
- Call newConversation(config)

**Verify:**
- Returns NewConversation object
- conversationId is defined and valid format
- conversation object is CodexConversation instance
- Can retrieve conversation via getConversation(id)

**Implementation:** Create test file, mock setup, call newConversation, assert on return values.

---

### Test 2: Send Message and Receive Response

**Functional description:**
User can send message to conversation and receive model response. Message is submitted, model responds, response is returned.

**Setup:**
- Mock ModelClient with preset response:
  `[{type: 'message', role: 'assistant', content: [{type: 'text', text: 'Hello!'}]}]`
- Create conversation via newConversation

**Execute:**
- Call conversation.submit([{type: 'text', text: 'Test message'}])
- Call conversation.nextEvent()

**Verify:**
- Event received with assistant message
- Event contains expected text
- Mock ModelClient.sendMessage was called

**Implementation:** Setup mock with response, submit message, await event, assert on event content and mock call.

---

### Test 3: Multi-Turn Conversation Maintains History

**Functional description:**
User can have multi-turn conversation. Each new message includes previous messages in history sent to model. Context is maintained across turns.

**Setup:**
- Mock ModelClient with two responses (one per turn)
- Create conversation

**Execute:**
- Submit first message: "First message"
- Receive first response (nextEvent)
- Submit second message: "Second message"
- Receive second response

**Verify:**
- Mock ModelClient called twice
- Second call's request includes first message in history
- History length increased after each turn
- Model sees previous context

**Implementation:** Mock tracks calls, submit twice, inspect second call's request parameter, assert history includes first message.

---

### Test 4: Error Handling - Invalid Config

**Functional description:**
CLI handles invalid configuration gracefully. Error message clear and actionable.

**Setup:**
- Mock Config with missing required field (e.g., no API key)

**Execute:**
- Attempt to create conversation with invalid config

**Verify:**
- Throws ConfigurationError
- Error message describes problem
- No conversation created

**Implementation:** Create invalid config mock, expect(newConversation).rejects.toThrow(ConfigurationError).

---

### Test 5: Error Handling - No Active Conversation

**Functional description:**
If user tries to chat without creating conversation first, clear error shown.

**Setup:**
- ConversationManager with no conversations

**Execute:**
- Attempt to get conversation that doesn't exist

**Verify:**
- getConversation returns undefined
- CLI should check this and show error

**Implementation:** Call getConversation with non-existent ID, assert undefined, CLI handles gracefully.

---

## Mock Strategy

**Mock External Dependencies:**
- ModelClient (all API calls) → returns preset ResponseItems
- Filesystem (config reading) → returns test config
- Network → no real network calls

**Don't Mock:**
- ConversationManager (we're testing this integration)
- CodexConversation (part of integration)
- Codex orchestration (assume works from port)

**Test Boundary:**
CLI layer integration with ConversationManager. Everything below manager assumed working (ported code tested).

---

## Test Setup Pattern

```typescript
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {ConversationManager} from '../../src/core/conversation-manager';
import {createMockClient} from '../mocks/model-client';
import {createMockConfig} from '../mocks/config';

describe('Phase 1: Conversation Flow', () => {
  let mockClient;
  let mockConfig;
  let manager;

  beforeEach(() => {
    mockClient = createMockClient([/* responses */]);
    mockConfig = createMockConfig();
    manager = new ConversationManager(/* deps with mocks */);
  });

  it('test name', async () => {
    // Test implementation
  });
});
```

---

## Success Criteria

All 5 tests pass. Mocked-service test file exists and runs. No real API calls made during tests. Tests run fast (<1 second). Tests deterministic (same result every run).
