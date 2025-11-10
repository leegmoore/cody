# Phase 1: Manual Test Script

**Purpose:** Verify functional requirements through actual CLI usage
**Prerequisites:** Phase 1 code complete, all automated tests passing
**Duration:** ~5 minutes

---

## Setup

1. Build CLI:
   ```bash
   cd codex-ts
   npm run build
   ```

2. Ensure config exists at `~/.codex/config.toml` with valid OpenAI API key:
   ```toml
   [provider]
   name = "openai"
   api = "responses"
   model = "gpt-4o-mini"

   [auth]
   method = "api-key"
   openai_key = "sk-proj-..."
   ```

3. Make CLI available:
   ```bash
   npm link
   # or
   node src/cli/index.js
   ```

---

## Test 1: Create Conversation

**Execute:**
```bash
cody new
```

**Expected output:**
```
Created conversation: conv_[some-id]
```

**Verify:**
- ✅ Conversation ID displayed
- ✅ No errors shown
- ✅ Command completes successfully

**If fails:** Check error message. Verify config file exists and has valid API key.

---

## Test 2: Send First Message

**Execute:**
```bash
cody chat "Hello, can you hear me?"
```

**Expected output:**
```
Assistant: Yes, I can hear you! How can I help you today?
```
(Exact response varies, but should be coherent assistant message)

**Verify:**
- ✅ Response from model displayed
- ✅ Response is relevant to message sent
- ✅ No errors or warnings
- ✅ Command completes and returns to prompt

**If fails:** Check if conversation was created first. Verify API key is valid. Check network connection.

---

## Test 3: Multi-Turn Conversation (Context Maintained)

**Execute:**
```bash
cody chat "I just said hello. What did I say?"
```

**Expected output:**
```
Assistant: You said "Hello, can you hear me?"
```
(Should reference previous message, proving context maintained)

**Verify:**
- ✅ Model references previous turn
- ✅ Context from first message present
- ✅ Response coherent and contextual
- ✅ History working across turns

**If fails:** History not being maintained. Check Session history implementation. Verify conversation isn't being recreated between commands.

---

## Test 4: Multiple Messages in Sequence

**Execute:**
```bash
cody chat "My name is Alex"
cody chat "What is my name?"
cody chat "Tell me a short joke"
cody chat "What was the joke about?"
```

**Expected behavior:**
- Second message: Model says "Alex" or "Your name is Alex"
- Fourth message: Model references the joke topic

**Verify:**
- ✅ All 4 messages get responses
- ✅ Context maintained throughout
- ✅ Model can reference information from any previous turn
- ✅ No degradation or errors over multiple turns

---

## Test 5: Error Cases

**Test 5a: No active conversation**

Execute (without running `cody new` first):
```bash
cody chat "This should fail"
```

Expected: Clear error message like "No active conversation. Run: cody new"

**Test 5b: Invalid config**

Temporarily rename ~/.codex/config.toml, then:
```bash
cody new
```

Expected: Configuration error with helpful message pointing to config file.

Restore config after test.

---

## Success Checklist

After completing all tests:

- [ ] Test 1: Can create conversation
- [ ] Test 2: Can send message and receive response
- [ ] Test 3: Multi-turn context maintained
- [ ] Test 4: Multiple sequential turns work
- [ ] Test 5a: Error handling works (no conversation)
- [ ] Test 5b: Error handling works (invalid config)

**All tests pass:** Phase 1 functional requirements verified.

**Any test fails:** Document failure, investigate, fix before declaring phase complete.

---

## Notes for Verification

User (project owner) runs these tests manually. Take notes on:
- Does CLI feel responsive?
- Are error messages clear?
- Is UX acceptable?
- Any rough edges to polish in Phase 7?

This is qualitative validation beyond automated tests. User experience matters.
