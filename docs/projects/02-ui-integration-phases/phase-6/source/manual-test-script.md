# Phase 6: Manual Test Script

**Goal:** Verify library can be imported and used, REST API works with curl/Postman, both interfaces expose same functionality

**Prerequisites:**
- Phase 5 complete (persistence working)
- Bun installed
- API keys configured

---

## Part A: Library API Testing

### Setup

**1. Create test app:**
```bash
mkdir -p /tmp/cody-test
cd /tmp/cody-test
npm init -y
npm install /path/to/codex-ts  # Link to local library
```

**2. Create test script:**
```typescript
// test-library.ts
import {createConversationManager} from '@openai/codex-core';

async function main() {
  console.log('Testing Cody library...\n');

  // Create manager
  const manager = await createConversationManager();

  // Create conversation
  const {conversation, conversationId} = await manager.newConversation({
    provider: {name: 'openai', api: 'responses', model: 'gpt-4o-mini'},
    auth: {method: 'openai-api-key'}
  });

  console.log(`✓ Created conversation: ${conversationId}\n`);

  // Send message
  await conversation.submit([{type: 'text', text: 'Say hello in one sentence'}]);
  const event = await conversation.nextEvent();

  console.log('✓ Response:', event.msg);
  console.log('\n✓ Library API works!\n');
}

main().catch(console.error);
```

### Test 1: Library Import

**Execute:**
```bash
bun test-library.ts
```

**Expected:**
- Prints "✓ Created conversation: conv_..."
- Prints response from model
- Prints "✓ Library API works!"
- No errors

**Success criteria:**
- [ ] Can import library
- [ ] Factory creates manager
- [ ] Conversation creation works
- [ ] Message sending works
- [ ] No TypeScript errors

---

## Part B: REST API Testing

### Setup

**1. Start REST API server:**
```bash
cd /path/to/codex-ts
export CODY_API_KEY=test-api-key-123
bun src/api/server.ts
```

**Expected:** Prints "✓ Cody REST API listening on http://localhost:3000"

**2. Open new terminal for testing**

### Test 2: Health Check

**Execute:**
```bash
curl http://localhost:3000/health
```

**Expected:**
```json
{"status":"ok"}
```

**Success:** [ ] Health check responds

### Test 3: Create Conversation

**Execute:**
```bash
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "api": "responses",
    "model": "gpt-4o-mini",
    "auth": {"method": "openai-api-key"}
  }'
```

**Expected:**
```json
{
  "conversationId": "conv_abc123",
  "created": 1699564800000,
  "provider": "openai",
  "api": "responses",
  "model": "gpt-4o-mini"
}
```

**Record conversationId for next tests**

**Success:** [ ] Conversation created via REST

### Test 4: Send Message (Batch Mode)

**Execute:**
```bash
curl -X POST http://localhost:3000/api/v1/conversations/conv_abc123/messages \
  -H "Authorization: Bearer test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Say hello in one sentence",
    "stream": false
  }'
```

**Expected:**
```json
{
  "items": [
    {
      "type": "message",
      "role": "assistant",
      "content": [{"type": "text", "text": "Hello! ..."}]
    }
  ],
  "usage": {
    "inputTokens": 15,
    "outputTokens": 12,
    "totalTokens": 27
  }
}
```

**Success:** [ ] Message sent, response received

### Test 5: Send Message (Streaming Mode)

**Execute:**
```bash
curl -X POST http://localhost:3000/api/v1/conversations/conv_abc123/messages \
  -H "Authorization: Bearer test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Count to 5",
    "stream": true
  }' \
  --no-buffer
```

**Expected:**
- Content-Type: text/event-stream
- Multiple `data: {...}` lines
- Events stream in real-time
- Final event has type='completed'

**Success:** [ ] Streaming works

### Test 6: List Conversations

**Execute:**
```bash
curl http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer test-api-key-123"
```

**Expected:**
```json
{
  "conversations": [
    {
      "id": "conv_abc123",
      "provider": "openai",
      "model": "gpt-4o-mini",
      "updatedAt": 1699564800000
    }
  ]
}
```

**Success:** [ ] List shows created conversation

### Test 7: Get Message History

**Execute:**
```bash
curl http://localhost:3000/api/v1/conversations/conv_abc123/messages \
  -H "Authorization: Bearer test-api-key-123"
```

**Expected:**
```json
{
  "conversationId": "conv_abc123",
  "messages": [
    {"type": "message", "role": "user", "content": [...]},
    {"type": "message", "role": "assistant", "content": [...]}
  ]
}
```

**Success:** [ ] History returned

### Test 8: Resume Conversation

**Execute:**
```bash
# Exit server (Ctrl+C), restart
bun src/api/server.ts

# Resume via API
curl -X POST http://localhost:3000/api/v1/conversations/conv_abc123/resume \
  -H "Authorization: Bearer test-api-key-123"
```

**Expected:**
```json
{
  "conversationId": "conv_abc123",
  "resumed": true
}
```

**Send message to resumed conversation:**
```bash
curl -X POST http://localhost:3000/api/v1/conversations/conv_abc123/messages \
  -H "Authorization: Bearer test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{"message": "What did I ask you before?", "stream": false}'
```

**Expected:** Model remembers previous messages

**Success:** [ ] Resume works via REST

### Test 9: Error Cases

**Test 9a: Missing Auth Header**
```bash
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai", "api": "responses", "model": "gpt-4"}'
```
**Expected:** 401 Unauthorized

**Test 9b: Invalid API Key**
```bash
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer wrong-key" \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai", "api": "responses", "model": "gpt-4"}'
```
**Expected:** 401 Unauthorized

**Test 9c: Missing Conversation**
```bash
curl http://localhost:3000/api/v1/conversations/nonexistent \
  -H "Authorization: Bearer test-api-key-123"
```
**Expected:** 404 Not Found, error.code='CONVERSATION_NOT_FOUND'

**Test 9d: Invalid Request**
```bash
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai"}'  # Missing api, model
```
**Expected:** 400 Bad Request, error lists missing fields

**Success:** [ ] All error cases handled correctly

### Test 10: Multi-Provider via REST

**Execute:**
```bash
# Create OpenAI conversation
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai", "api": "responses", "model": "gpt-4o-mini", "auth": {"method": "openai-api-key"}}'

# Create Anthropic conversation
curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{"provider": "anthropic", "api": "messages", "model": "claude-3-haiku", "auth": {"method": "anthropic-api-key"}}'

# Send to both
curl -X POST http://localhost:3000/api/v1/conversations/[openai-id]/messages \
  -H "Authorization: Bearer test-api-key-123" \
  -d '{"message": "test", "stream": false}'

curl -X POST http://localhost:3000/api/v1/conversations/[anthropic-id]/messages \
  -H "Authorization: Bearer test-api-key-123" \
  -d '{"message": "test", "stream": false}'
```

**Expected:** Both work, responses from different models

**Success:** [ ] Multi-provider works via REST

---

## Part C: Playwright Automated Tests

### Test 11: Run Mocked Suite

**Execute:**
```bash
npm run test:playwright:mocked
```

**Expected:**
- ~55 tests run
- All pass
- Runtime <2 minutes
- Output shows: "55 passed"

**Success:** [ ] Mocked Playwright tests pass

### Test 12: Run Integration Suite

**Execute:**
```bash
# Ensure API keys in .env
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export OPENROUTER_API_KEY=sk-or-...

npm run test:playwright:integration
```

**Expected:**
- ~8 tests run
- All pass (or document failures)
- Runtime ~5 minutes
- Cost ~$0.05-0.10

**Success:** [ ] Integration Playwright tests pass

---

## Success Checklist

**Library API:**
- [ ] Can import from '@openai/codex-core'
- [ ] Factory helper works
- [ ] Types exported
- [ ] Example app works
- [ ] Existing mocked-service tests work with library imports
- [ ] docs/api/library-api.md complete

**REST API:**
- [ ] Server starts with Bun
- [ ] Health check responds
- [ ] All endpoints work (create, list, send, resume)
- [ ] Streaming mode works
- [ ] Batch mode works
- [ ] Error cases handled correctly
- [ ] docs/api/rest-api.md complete

**Testing:**
- [ ] Playwright mocked: 55 tests passing
- [ ] Playwright integration: 8 tests passing
- [ ] Library validation tests passing
- [ ] All quality gates passed

**Code review:**
- [ ] Stage 1 complete (API design, security)
- [ ] Stage 2 complete (library clean, REST correct)

---

**All checks ✓ → Phase 6 functional verification complete**

**Next:** Commit changes, update project logs, assess need for Phase 7 polish
