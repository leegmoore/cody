# Phase 5: Persistence & Resume + Compact – Task Checklist

**Status:** Not Started
**Estimated Code:** ~920 lines (CLI 110, resume logic 110, compact 450, tests 150, mocks 100)

---

## Setup & Planning

- [ ] Review Phase 4 implementation (auth methods working)
- [ ] Read TECH-APPROACH Section 6 (Phase 5 technical approach)
- [ ] Read phase-5/source/design.md (implementation details)
- [ ] Inspect ported RolloutRecorder: `codex-ts/src/core/rollout/`
- [ ] Read Rust compact source: `codex-rs/core/src/codex/compact.rs`
- [ ] Read Rust compact tests: `codex-rs/core/tests/suite/compact.rs`
- [ ] Locate summarization prompt template: `codex-rs/core/templates/compact/prompt.md`

---

## RolloutRecorder Integration

### Session Auto-Save

- [ ] Locate Session.processMessage() in ported code
- [ ] Add recorder.appendTurn() call after turn completes
- [ ] Pass conversation ID, timestamp, ResponseItems, metadata
- [ ] Handle append errors gracefully (log warning, don't crash)
- [ ] Verify writes happen after tool execution (full turn captured)

### ConversationManager Constructor

- [ ] Inject RolloutRecorder into ConversationManager
- [ ] Pass recorder to Session during conversation creation
- [ ] Default baseDir: ~/.cody/conversations/ (or ~/.codex/conversations/)
- [ ] Document storage path decision in DECISIONS.md

---

## CLI Commands

### list Command

- [ ] Create `src/cli/commands/list.ts`
- [ ] Implement:
  - [ ] Call manager.listConversations()
  - [ ] Format output (ID, provider, model, timestamp)
  - [ ] Handle empty list (print helpful message)
  - [ ] Sort by updatedAt (most recent first)
- [ ] Output format:
  - [ ] Clear table or list
  - [ ] Timestamps human-readable
  - [ ] Total count at bottom

### resume Command

- [ ] Create `src/cli/commands/resume.ts`
- [ ] Implement:
  - [ ] Accept conversationId argument
  - [ ] Call manager.resumeConversation(id)
  - [ ] Set as active conversation
  - [ ] Print confirmation with provider/model info
- [ ] Error handling:
  - [ ] Missing ID → helpful error, suggest `cody list`
  - [ ] Corrupted rollout → error with details
  - [ ] Empty rollout → error "no turns"

---

## Resume Logic

### ConversationManager.resumeConversation()

- [ ] Implement method:
  - [ ] Call recorder.readRollout(id)
  - [ ] Parse RolloutTurn[] → ResponseItem[]
  - [ ] Extract metadata (provider, model, last timestamp)
  - [ ] Create Session with pre-loaded history
  - [ ] Create CodexConversation wrapper
  - [ ] Return conversation
- [ ] Error handling:
  - [ ] File not found → ConversationNotFoundError
  - [ ] Parse error → CorruptedRolloutError with line number
  - [ ] Empty file → EmptyRolloutError

### ConversationManager.listConversations()

- [ ] Implement method:
  - [ ] Call recorder.list()
  - [ ] Return conversation metadata array
  - [ ] Sort by updatedAt descending

---

## Compact Module (Port from Rust)

### Create Module Structure

- [ ] Create `src/core/codex/compact.ts`
- [ ] Port types:
  - [ ] CompactedItem
  - [ ] CompactConfig (thresholds, budgets)
- [ ] Port constants:
  - [ ] COMPACT_USER_MESSAGE_MAX_TOKENS = 20_000
  - [ ] COMPACT_THRESHOLD = 0.8 (80% of context)

### Core Functions

- [ ] **runCompactTask()** - Main entry point
  - [ ] Check threshold
  - [ ] Get summary from LLM
  - [ ] Collect user messages
  - [ ] Build compacted history
  - [ ] Replace session history
  - [ ] Persist CompactedItem
  - [ ] Emit events (compacting, completed, warning)

- [ ] **needsCompaction()** - Threshold check
  - [ ] Count history tokens
  - [ ] Compare to 80% of context window
  - [ ] Return boolean

- [ ] **getSummary()** - LLM summarization
  - [ ] Build summarization prompt
  - [ ] Send to ModelClient
  - [ ] Extract summary text from response
  - [ ] Handle empty or error responses

- [ ] **collectUserMessages()** - Extract user messages
  - [ ] Filter history for role=user
  - [ ] Extract text content
  - [ ] Return string array

- [ ] **buildCompactedHistory()** - Reconstruct history
  - [ ] Start with initial context
  - [ ] Add selected user messages
  - [ ] Add summary message
  - [ ] Add GhostSnapshots
  - [ ] Return new history array

- [ ] **selectRecentMessages()** - Token budget allocation
  - [ ] Work backwards from most recent
  - [ ] Keep messages until budget exhausted
  - [ ] Truncate last message if needed
  - [ ] Return selected messages

- [ ] **truncateMiddle()** - Message truncation
  - [ ] Keep head (first 40%)
  - [ ] Keep tail (last 40%)
  - [ ] Replace middle with "... truncated ..."
  - [ ] Return truncated string

### Retry Logic

- [ ] Implement retry with backoff:
  - [ ] Catch CONTEXT_WINDOW_EXCEEDED
  - [ ] Remove oldest item from history
  - [ ] Increment truncatedCount
  - [ ] Retry compression
  - [ ] Max iterations: history.length (eventually must succeed or fail)
- [ ] Implement network retry:
  - [ ] Catch network errors
  - [ ] Backoff: 250ms, 500ms, 1s, 2s, 4s
  - [ ] Max retries from provider config
  - [ ] Give up after max

### Integration with Session

- [ ] Add compact check to Session.processMessage():
  - [ ] After turn complete, before return
  - [ ] Call compact.needsCompaction()
  - [ ] If true, call compact.runCompactTask()
  - [ ] Await completion
- [ ] Add Session.replaceHistory() method:
  - [ ] Replace internal history array
  - [ ] Maintain other session state
- [ ] Add Session.getInitialContext() method:
  - [ ] Return system prompt + base instructions
  - [ ] Used by compact to preserve initial context

---

## Mocked-Service Tests (TDD)

- [ ] Create `tests/mocked-service/phase-5-persistence.test.ts`
- [ ] Create/extend mocks:
  - [ ] tests/mocks/rollout-recorder.ts (in-memory JSONL)
  - [ ] tests/mocks/model-client.ts (add summarization detection)
  - [ ] tests/mocks/tokenizer.ts (configurable token counts)

### Auto-Save Suite

- [ ] Test 1: Appends turn after each message
- [ ] Test 2: Includes metadata in rollout
- [ ] Test 3: Handles append failure gracefully

### Resume Suite

- [ ] Test 4: Reconstructs conversation from JSONL
- [ ] Test 5: Throws on missing conversation
- [ ] Test 6: Handles corrupted JSONL
- [ ] Test 7: Handles empty rollout
- [ ] Test 8: Preserves provider/model metadata

### List Suite

- [ ] Test 9: Returns all saved conversations
- [ ] Test 10: Returns empty array when none
- [ ] Test 11: Includes metadata in list

### Compact Suite

- [ ] Test 12: Does not compact under threshold
- [ ] Test 13: Triggers compact over threshold
- [ ] Test 14: Rebuilds history with summary
- [ ] Test 15: Preserves recent user messages
- [ ] Test 16: Preserves GhostSnapshots
- [ ] Test 17: Truncates middle of long messages
- [ ] Test 18: Retries when still too large
- [ ] Test 19: Persists CompactedItem to rollout
- [ ] Test 20: Handles summarization failure

### CLI Command Suite

- [ ] Test 21: list command output
- [ ] Test 22: list when empty
- [ ] Test 23: resume command success
- [ ] Test 24: resume missing ID

- [ ] All 24 tests passing
- [ ] Tests run fast (<3 seconds)
- [ ] No skipped tests

---

## Quality Gates

### Code Quality

- [ ] Run: `npm run format` → no changes
- [ ] Run: `npm run lint` → 0 errors
- [ ] Run: `npx tsc --noEmit` → 0 errors

### Testing

- [ ] Run: `npm test` → all passing (1,876+ baseline + 24 new)
- [ ] Verify: 0 skipped tests
- [ ] Verify: Compact tests actually test compression logic

### Combined Verification

- [ ] Run: `npm run format && npm run lint && npx tsc --noEmit && npm test`
- [ ] All commands succeed
- [ ] Save output for verification

---

## Manual Verification

- [ ] Follow `manual-test-script.md`
- [ ] Test save/resume flow (5 scenarios)
- [ ] Test list command
- [ ] Test compact with long conversation (if feasible)
- [ ] Verify JSONL format matches Rust (compare sample files)

---

## Code Review

### Stage 1: Traditional Review

- [ ] JSONL parsing robustness (handle malformed JSON)
- [ ] File path security (no path traversal)
- [ ] Compact algorithm correctness (matches Rust logic)
- [ ] Error handling comprehensive (all failure modes covered)
- [ ] Token counting accurate (affects compact threshold)
- [ ] Summarization prompt quality (produces good summaries)

### Stage 2: Port Validation Review

- [ ] Rollout format matches Rust exactly (field names, structure)
- [ ] Compact algorithm matches Rust (same steps, same logic)
- [ ] Resume preserves state correctly (history, metadata, context)
- [ ] GhostSnapshot handling correct (preserved across compression)
- [ ] Retry logic matches Rust (same backoff, same max retries)

---

## Documentation

- [ ] Update DECISIONS.md:
  - [ ] Storage path chosen
  - [ ] Compact threshold (80% or different)
  - [ ] User message token budget (20k or adjusted)
  - [ ] Summarization model (same as conversation or different)
  - [ ] Compact visibility (user sees message or silent)
  - [ ] Resume validation (allow provider mismatch or enforce)
  - [ ] JSONL format compatibility with Rust
  - [ ] Compact persistence strategy
  - [ ] Claude keyring path found (from Phase 4 if discovered)
- [ ] Update checklist (mark completed)
- [ ] Verify phase ready for Phase 6

---

## Final Verification

- [ ] All tasks completed
- [ ] All tests passing (mocked-service)
- [ ] All quality gates passed
- [ ] Manual verification complete
- [ ] Code review complete (both stages)
- [ ] Documentation updated
- [ ] JSONL files compatible with Rust Codex
- [ ] Ready to commit and proceed

---

**Phase 5 complete when all items checked ✓**
