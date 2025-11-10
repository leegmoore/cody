# Phase 5: Manual Test Script

**Goal:** Verify conversations persist automatically, can be resumed with full history, and compact algorithm prevents context overflow

**Prerequisites:**
- Phase 4 complete (auth methods working)
- API keys configured
- CLI built and available

---

## Setup

**1. Clean slate:**
```bash
# Backup existing conversations (if any)
mv ~/.cody/conversations ~/.cody/conversations.backup

# Create fresh directory
mkdir -p ~/.cody/conversations
```

**2. Set provider:**
```bash
cody set-provider openai --api responses --model gpt-4o-mini
cody set-auth openai-api-key
```

---

## Test 1: Auto-Save During Conversation

**Objective:** Verify conversations automatically save to JSONL

**Steps:**
1. Create conversation:
   ```bash
   cody new
   ```
   **Expected:** Prints conversation ID (e.g., "conv_abc123")
   **Record ID for later tests**

2. Send first message:
   ```bash
   cody chat "Hello, my name is Alice"
   ```
   **Expected:** Response received

3. Check JSONL file created:
   ```bash
   ls ~/.cody/conversations/
   ```
   **Expected:** File exists: `conv_abc123.jsonl`

4. Inspect JSONL content:
   ```bash
   cat ~/.cody/conversations/conv_abc123.jsonl
   ```
   **Expected:**
   - At least 1 line (JSON object)
   - Contains "Alice" in user message
   - Valid JSON (can parse)

5. Send second message:
   ```bash
   cody chat "What's my name?"
   ```
   **Expected:** Model responds with "Alice"

6. Check JSONL updated:
   ```bash
   cat ~/.cody/conversations/conv_abc123.jsonl | wc -l
   ```
   **Expected:** At least 2 lines (2+ turns saved)

**Success criteria:**
- [ ] JSONL file created automatically
- [ ] File updates after each turn
- [ ] Content is valid JSON
- [ ] User messages preserved in file

---

## Test 2: List Saved Conversations

**Objective:** Verify list command shows saved conversations

**Steps:**
1. Create additional conversations:
   ```bash
   cody new
   cody chat "test conversation 2"
   
   cody new
   cody chat "test conversation 3"
   ```

2. List all conversations:
   ```bash
   cody list
   ```
   **Expected output:**
   ```
   Saved Conversations:
   
     conv_abc123
       Provider: openai (gpt-4o-mini)
       Updated: [timestamp]
   
     conv_def456
       Provider: openai (gpt-4o-mini)
       Updated: [timestamp]
   
     conv_ghi789
       Provider: openai (gpt-4o-mini)
       Updated: [timestamp]
   
   Total: 3 conversation(s)
   ```

3. Verify all 3 conversations listed
4. Verify timestamps are recent
5. Verify provider/model shown

**Success criteria:**
- [ ] All conversations listed
- [ ] Metadata displayed (provider, model, timestamp)
- [ ] Output is readable
- [ ] Total count correct

---

## Test 3: Resume Conversation

**Objective:** Verify can resume saved conversation with full history

**Steps:**
1. Exit CLI (if in REPL mode)

2. Resume first conversation:
   ```bash
   cody resume conv_abc123
   ```
   **Expected:** Prints "✓ Resumed conversation: conv_abc123"

3. Test history loaded:
   ```bash
   cody chat "What did I tell you my name was?"
   ```
   **Expected:** Model responds "Alice" (remembers from Test 1)

4. Continue conversation:
   ```bash
   cody chat "What's 2+2?"
   ```
   **Expected:** Model responds "4"

5. Exit and resume again:
   ```bash
   # Exit CLI
   cody resume conv_abc123
   cody chat "What math question did I just ask?"
   ```
   **Expected:** Model remembers "2+2" question

**Success criteria:**
- [ ] Resume loads conversation
- [ ] History preserved (model remembers earlier messages)
- [ ] Can continue conversation seamlessly
- [ ] Multiple resume cycles work

---

## Test 4: Resume Missing Conversation

**Objective:** Verify helpful error when conversation doesn't exist

**Steps:**
1. Attempt to resume nonexistent ID:
   ```bash
   cody resume conv_nonexistent
   ```
   **Expected:**
   - Error: "✗ Conversation 'conv_nonexistent' not found"
   - Suggests: "List available: cody list"
   - Exit code 1

**Success criteria:**
- [ ] Error message clear
- [ ] Suggests helpful action
- [ ] Doesn't crash

---

## Test 5: Compact with Long Conversation

**Objective:** Verify compact algorithm triggers and works correctly

**Note:** This test is challenging without generating a truly long conversation. We'll simulate by sending many messages.

**Steps:**
1. Create new conversation:
   ```bash
   cody new
   ```

2. Send many messages (15-20 messages):
   ```bash
   for i in {1..20}; do
     cody chat "This is message number $i. Please respond with a detailed explanation of what number this is and count from 1 to $i."
   done
   ```
   **Expected:** 
   - All messages succeed
   - Responses get progressively longer
   - Eventually may see "Compacting conversation history..." message

3. Check if compact triggered:
   ```bash
   cat ~/.cody/conversations/conv_*.jsonl | grep -i compact
   ```
   **Expected:** If history large enough, CompactedItem present in rollout

4. Test history after compact:
   ```bash
   cody chat "What was the first message I sent?"
   ```
   **Expected:**
   - Model may not remember exact first message (compressed)
   - But should have general context from summary
   - Recent messages (15-20) should be remembered

**Success criteria:**
- [ ] Long conversation doesn't crash
- [ ] Compact triggers when threshold exceeded (if reached)
- [ ] History compresses successfully
- [ ] Recent context preserved
- [ ] Conversation continues after compact

**Note:** If conversation doesn't reach compact threshold with 20 messages, that's OK. Compact will be tested in mocked-service tests with mocked tokenizer. This manual test validates the conversation doesn't break with many turns.

---

## Test 6: Resume After Compact

**Objective:** Verify resume works with compacted conversations

**Steps:**
1. Using conversation from Test 5 (if compacted):
   ```bash
   # Exit CLI
   cody resume conv_[id from Test 5]
   ```
   **Expected:** Resumes successfully

2. Test history:
   ```bash
   cody chat "Summarize our conversation so far"
   ```
   **Expected:**
   - Model provides summary
   - Summary includes recent messages
   - May include summary from compact (if triggered)

**Success criteria:**
- [ ] Resume works after compact
- [ ] History coherent
- [ ] Can continue conversation

---

## Test 7: JSONL Format Compatibility

**Objective:** Verify JSONL format matches Rust Codex

**Steps:**
1. Create conversation in Cody:
   ```bash
   cody new
   cody chat "test message"
   ```

2. Copy JSONL file:
   ```bash
   cp ~/.cody/conversations/conv_*.jsonl /tmp/cody-test.jsonl
   ```

3. If you have Rust Codex available, try to resume in Rust:
   ```bash
   # In Rust Codex
   codex resume conv_[id]
   ```
   **Expected:** Rust Codex can read our JSONL (format compatible)

4. If Rust Codex not available, manually inspect format:
   ```bash
   cat /tmp/cody-test.jsonl | jq .
   ```
   **Expected:**
   - Valid JSON per line
   - Fields match Rust format (timestamp, items, metadata)
   - ResponseItem structure matches protocol

**Success criteria:**
- [ ] JSONL format valid
- [ ] Compatible with Rust Codex (if testable)
- [ ] Fields match expected schema

---

## Test 8: Error Recovery

**Objective:** Verify graceful handling of persistence errors

**Steps:**
1. Make conversations directory read-only:
   ```bash
   chmod 444 ~/.cody/conversations
   ```

2. Attempt to create conversation:
   ```bash
   cody new
   cody chat "test"
   ```
   **Expected:**
   - Warning: "Failed to save turn: permission denied"
   - Conversation continues (doesn't crash)
   - Response still displayed

3. Restore permissions:
   ```bash
   chmod 755 ~/.cody/conversations
   ```

**Success criteria:**
- [ ] Persistence errors don't crash conversation
- [ ] User sees warning
- [ ] Conversation continues (in-memory only)

---

## Success Checklist

**Functional verification:**
- [ ] Conversations auto-save to JSONL
- [ ] JSONL files created in correct location
- [ ] list command shows all conversations
- [ ] resume command loads history correctly
- [ ] Multi-turn context preserved across resume
- [ ] Missing conversation error is helpful
- [ ] Compact triggers when threshold exceeded (tested in mocked tests if not manual)
- [ ] Long conversations don't crash
- [ ] JSONL format compatible with Rust

**Quality verification:**
- [ ] All mocked-service tests passing (24 tests)
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 errors
- [ ] Format: clean
- [ ] Combined: All checks pass

**Code review:**
- [ ] Stage 1 complete (robustness, security, correctness)
- [ ] Stage 2 complete (Rust compatibility, algorithm correctness)

---

**All checks ✓ → Phase 5 functional verification complete**

**Next:** Commit changes, update project logs, proceed to Phase 6

---

## Cleanup

**After all tests pass:**
```bash
# Remove test conversations
rm -rf ~/.cody/conversations/*

# Or restore backup if you had existing conversations
rm -rf ~/.cody/conversations
mv ~/.cody/conversations.backup ~/.cody/conversations
```
