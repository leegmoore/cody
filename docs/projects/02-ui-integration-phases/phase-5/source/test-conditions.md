# Phase 5: Test Conditions

**Test Framework:** Vitest (mocked-service)
**Test File:** `tests/mocked-service/phase-5-persistence.test.ts`
**Mocks:** `tests/mocks/rollout-recorder.ts`, `tests/mocks/model-client.ts` (extended for summarization)

---

## Suite 1: Auto-Save (Persistence)

### Test 1: Appends Turn After Each Message
- **Setup:** Mock recorder (in-memory), create conversation
- **Execute:** Send two messages (await responses)
- **Verify:** Recorder.appendTurn called twice, buffer has 2+ JSONL lines

### Test 2: Includes Metadata in Rollout
- **Setup:** Create conversation with provider=openai, model=gpt-4
- **Execute:** Send message
- **Verify:** First JSONL line has metadata.provider='openai', metadata.model='gpt-4'

### Test 3: Handles Append Failure Gracefully
- **Setup:** Mock recorder that throws on appendTurn
- **Execute:** Send message
- **Verify:** Conversation continues (doesn't crash), warning logged

---

## Suite 2: Resume

### Test 4: Reconstructs Conversation from JSONL
- **Setup:** Create conversation, send 2 messages, get rollout buffer
- **Execute:** Create new manager, resumeConversation(id) with saved rollout
- **Verify:** Conversation loaded, history.length > 0, can send new message

### Test 5: Throws on Missing Conversation
- **Setup:** Empty recorder
- **Execute:** resumeConversation('nonexistent-id')
- **Verify:** Throws error with message "Conversation nonexistent-id not found"

### Test 6: Handles Corrupted JSONL
- **Setup:** Recorder with invalid JSON: 'invalid json\n{broken'
- **Execute:** resumeConversation('test-id')
- **Verify:** Throws error mentioning parsing failure

### Test 7: Handles Empty Rollout File
- **Setup:** Recorder with empty string for conversation
- **Execute:** resumeConversation('test-id')
- **Verify:** Throws error "Conversation test-id has no turns"

### Test 8: Preserves Provider/Model from Rollout
- **Setup:** Rollout with metadata.provider='anthropic'
- **Execute:** Resume conversation
- **Verify:** Resumed conversation uses anthropic provider (metadata preserved)

---

## Suite 3: List

### Test 9: Returns All Saved Conversations
- **Setup:** Create 3 conversations with mock recorder
- **Execute:** manager.listConversations()
- **Verify:** Returns array with 3 items, IDs match created conversations

### Test 10: Returns Empty Array When No Conversations
- **Setup:** Empty recorder
- **Execute:** manager.listConversations()
- **Verify:** Returns []

### Test 11: Includes Metadata in List
- **Setup:** Create conversation with provider/model metadata
- **Execute:** manager.listConversations()
- **Verify:** Returned items have provider, model, updatedAt fields

---

## Suite 4: Compact Algorithm

### Test 12: Does Not Compact When Under Threshold
- **Setup:** Mock tokenizer returning low count (e.g., 1000 tokens), context window 100k
- **Execute:** Send message
- **Verify:** Summarization not called (mockClient.sendMessage called once for regular message only)

### Test 13: Triggers Compact When Over Threshold
- **Setup:** Mock tokenizer returning high count (e.g., 85k tokens), context window 100k (exceeds 80k threshold)
- **Execute:** Send message
- **Verify:** Summarization called (mockClient.sendMessage called with prompt containing "concise summary")

### Test 14: Rebuilds History with Summary
- **Setup:** Session with large history, trigger compact
- **Execute:** runCompactTask()
- **Verify:** 
  - New history shorter than original
  - Summary item present (role=user, content includes "Summary")
  - Initial context preserved (system prompt still there)

### Test 15: Preserves Recent User Messages
- **Setup:** History with 10 user messages, trigger compact
- **Execute:** runCompactTask()
- **Verify:** 
  - Most recent user messages present in new history
  - Older user messages replaced by summary
  - User message count reduced but recent ones kept

### Test 16: Preserves GhostSnapshots
- **Setup:** History with GhostSnapshot items, trigger compact
- **Execute:** runCompactTask()
- **Verify:** GhostSnapshot items still present in new history (not removed by compression)

### Test 17: Truncates Middle of Long Messages
- **Setup:** User message with 50k tokens (exceeds 20k budget), trigger compact
- **Execute:** selectRecentMessages() with that message
- **Verify:** Message truncated (head + tail preserved, middle replaced with "... truncated ...")

### Test 18: Retries When Compacted History Still Too Large
- **Setup:** Mock: first compact attempt throws CONTEXT_WINDOW_EXCEEDED, second succeeds
- **Execute:** runCompactTask()
- **Verify:** 
  - Oldest item removed from history
  - Retry happened (2 summarization calls)
  - Eventually succeeds

### Test 19: Persists CompactedItem to Rollout
- **Setup:** Trigger compact
- **Execute:** runCompactTask()
- **Verify:** Rollout contains CompactedItem (type='compacted', summary text present)

### Test 20: Handles Summarization Failure
- **Setup:** Mock LLM returns empty or throws error
- **Execute:** runCompactTask()
- **Verify:** 
  - Uses fallback summary: "(summary unavailable)"
  - Doesn't crash
  - History still compacted (with placeholder summary)

---

## CLI Command Tests

### Test 21: list Command Output
- **Setup:** Mock recorder with 3 conversations
- **Execute:** Run `cody list` (capture stdout)
- **Verify:** Output shows all 3 IDs, provider, model, timestamps

### Test 22: list Command When Empty
- **Setup:** Empty recorder
- **Execute:** Run `cody list`
- **Verify:** Output: "No saved conversations", suggests "cody new"

### Test 23: resume Command Success
- **Setup:** Saved conversation in recorder
- **Execute:** Run `cody resume <id>`
- **Verify:** Prints "✓ Resumed conversation: <id>", sets active conversation

### Test 24: resume Command Missing ID
- **Execute:** Run `cody resume nonexistent`
- **Verify:** Error message, suggests "cody list", exit code 1

---

## Mock Strategy

**Mock RolloutRecorder:**
- In-memory Map: conversationId → JSONL content string
- appendTurn: Serializes turn, appends to string
- readRollout: Parses string, returns RolloutTurn[]
- list: Extracts metadata from first line of each conversation
- Test helpers: getBuffer(id), setBuffer(id, content) for setup/verification

**Mock ModelClient (extended for summarization):**
- Detect summarization prompt (contains "concise summary")
- Return preset summary for summarization calls
- Return regular responses for conversation calls
- Track call count to verify summarization triggered

**Mock Tokenizer:**
- countTokens() returns configurable value
- For threshold tests: return high count to trigger compact
- For non-compact tests: return low count

**Mock Filesystem:**
- Not needed (RolloutRecorder mock handles all I/O)
- Tests run entirely in-memory

---

## Verification Checklist

**Automated tests pass:**
- [ ] Auto-save tests: 3 tests
- [ ] Resume tests: 5 tests
- [ ] List tests: 3 tests
- [ ] Compact tests: 9 tests
- [ ] CLI command tests: 4 tests
- [ ] Total: 24 tests, all passing in <3 seconds

**Quality gates:**
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 errors
- [ ] Format: no changes
- [ ] Combined: All checks pass

**Manual verification:**
- [ ] Follow manual-test-script.md
- [ ] Test save/resume flow
- [ ] Test list command
- [ ] Test compact with long conversation (if possible)

**Code review:**
- [ ] Stage 1: JSONL robustness, file security, compact correctness, error handling
- [ ] Stage 2: Rollout format matches Rust, compact algorithm matches Rust, state preservation correct

---

**All checks ✓ → Phase 5 test conditions complete**
