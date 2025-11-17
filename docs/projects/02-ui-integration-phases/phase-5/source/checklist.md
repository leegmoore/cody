# Phase 5: Persistence & Resume + Compact – Task Checklist

**Status:** In Progress
**Estimated Code:** ~920 lines (CLI 110, resume logic 110, compact 450, tests 150, mocks 100)

---

## Setup & Planning

- [x] Review Phase 4 implementation (auth methods working)
- [x] Read TECH-APPROACH Section 6 (Phase 5 technical approach)
- [x] Read phase-5/source/design.md (implementation details)
- [x] Inspect ported RolloutRecorder: `codex-ts/src/core/rollout/`
- [x] Read Rust compact source: `codex-rs/core/src/codex/compact.rs`
- [x] Read Rust compact tests: `codex-rs/core/tests/suite/compact.rs`
- [x] Locate summarization prompt template: `codex-rs/core/templates/compact/prompt.md`

---

## RolloutRecorder Integration

### Session Auto-Save

- [x] Locate Session.processMessage() in ported code
- [x] Add recorder.appendTurn() call after turn completes
- [x] Pass conversation ID, timestamp, ResponseItems, metadata
- [x] Handle append errors gracefully (log warning, don't crash)
- [x] Verify writes happen after tool execution (full turn captured)

### ConversationManager Constructor

- [x] Inject RolloutRecorder into ConversationManager
- [x] Pass recorder to Session during conversation creation
- [x] Default baseDir: ~/.cody/conversations/ (or ~/.codex/conversations/)
- [x] Document storage path decision in DECISIONS.md

---

## CLI Commands

### list Command

- [x] Create `src/cli/commands/list.ts`
- [x] Implement:
  - [x] Call manager.listConversations()
  - [x] Format output (ID, provider, model, timestamp)
  - [x] Handle empty list (print helpful message)
  - [x] Sort by updatedAt (most recent first)
- [x] Output format:
  - [x] Clear table or list
  - [x] Timestamps human-readable
  - [x] Total count at bottom

### resume Command

- [x] Create `src/cli/commands/resume.ts`
- [x] Implement:
  - [x] Accept conversationId argument
  - [x] Call manager.resumeConversation(id)
  - [x] Set as active conversation
  - [x] Print confirmation with provider/model info
- [x] Error handling:
  - [x] Missing ID → helpful error, suggest `cody list`
  - [x] Corrupted rollout → error with details
  - [x] Empty rollout → error "no turns"

---

## Resume Logic

### ConversationManager.resumeConversation()

- [x] Implement method:
  - [x] Call recorder.readRollout(id)
  - [x] Parse RolloutTurn[] → ResponseItem[]
  - [x] Extract metadata (provider, model, last timestamp)
  - [x] Create Session with pre-loaded history
  - [x] Create CodexConversation wrapper
  - [x] Return conversation
- [x] Error handling:
  - [x] File not found → ConversationNotFoundError
  - [x] Parse error → CorruptedRolloutError with line number
  - [x] Empty file → EmptyRolloutError

### ConversationManager.listConversations()

- [x] Implement method:
  - [x] Call recorder.list()
  - [x] Return conversation metadata array
  - [x] Sort by updatedAt descending

---

## Compact Module (Port from Rust)

### Create Module Structure

- [x] Create `src/core/codex/compact.ts`
- [x] Port types:
  - [x] CompactedItem
  - [x] CompactConfig (thresholds, budgets)
- [x] Port constants:
  - [x] COMPACT_USER_MESSAGE_MAX_TOKENS = 20_000
  - [x] COMPACT_THRESHOLD = 0.8 (80% of context)

### Core Functions

- [x] **runCompactTask()** - Main entry point
  - [ ] Check threshold
  - [ ] Get summary from LLM
  - [ ] Collect user messages
  - [ ] Build compacted history
  - [ ] Replace session history
  - [ ] Persist CompactedItem
  - [ ] Emit events (compacting, completed, warning)

- [x] **needsCompaction()** - Threshold check
  - [ ] Count history tokens
  - [ ] Compare to 80% of context window
  - [ ] Return boolean

- [x] **getSummary()** - LLM summarization
  - [ ] Build summarization prompt
  - [ ] Send to ModelClient
  - [ ] Extract summary text from response
  - [ ] Handle empty or error responses

- [x] **collectUserMessages()** - Extract user messages
  - [ ] Filter history for role=user
  - [ ] Extract text content
  - [ ] Return string array

- [x] **buildCompactedHistory()** - Reconstruct history
  - [ ] Start with initial context
  - [ ] Add selected user messages
  - [ ] Add summary message
  - [ ] Add GhostSnapshots
  - [ ] Return new history array

- [x] **selectRecentMessages()** - Token budget allocation
  - [ ] Work backwards from most recent
  - [ ] Keep messages until budget exhausted
  - [ ] Truncate last message if needed
  - [ ] Return selected messages

- [x] **truncateMiddle()** - Message truncation
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

- [x] Add compact check to Session.processMessage():
  - [x] After turn complete, before return
  - [x] Call compact.needsCompaction()
  - [x] If true, call compact.runCompactTask()
  - [x] Await completion
- [x] Add Session.replaceHistory() method:
  - [x] Replace internal history array
  - [x] Maintain other session state
- [x] Add Session.getInitialContext() method:
  - [x] Return system prompt + base instructions
  - [x] Used by compact to preserve initial context

---

## Mocked-Service Tests (TDD)

- [ ] Create `tests/mocked-service/phase-5-persistence.test.ts`
- [ ] Create/extend mocks:
  - [ ] tests/mocks/rollout-recorder.ts (in-memory JSONL)
  - [ ] tests/mocks/model-client.ts (add summarization detection)
  - [ ] tests/mocks/tokenizer.ts (configurable token counts)

### Auto-Save Suite

- [x] Test 1: Appends turn after each message
- [x] Test 2: Includes metadata in rollout
- [x] Test 3: Handles append failure gracefully

### Resume Suite

- [x] Test 4: Reconstructs conversation from JSONL
- [x] Test 5: Throws on missing conversation
- [x] Test 6: Handles corrupted JSONL
- [x] Test 7: Handles empty rollout
- [x] Test 8: Preserves provider/model metadata

### List Suite

- [x] Test 9: Returns all saved conversations
- [x] Test 10: Returns empty array when none
- [x] Test 11: Includes metadata in list

### Compact Suite

- [x] Test 12: Does not compact under threshold
- [x] Test 13: Triggers compact over threshold
- [x] Test 14: Rebuilds history with summary
- [x] Test 15: Preserves recent user messages
- [x] Test 16: Preserves GhostSnapshots
- [x] Test 17: Truncates middle of long messages
- [x] Test 18: Retries when still too large
- [x] Test 19: Persists CompactedItem to rollout
- [x] Test 20: Handles summarization failure

### CLI Command Suite

- [x] Test 21: list command output
- [x] Test 22: list when empty
- [x] Test 23: resume command success
- [x] Test 24: resume missing ID

- [ ] All 24 tests passing
- [ ] Tests run fast (<3 seconds)
- [ ] No skipped tests

---

## Quality Gates

### Code Quality

- [ ] Run: `npm run format` → no changes
- [ ] Run: `npm run lint` → 0 errors
- [ ] Run: `npx tsc --noEmit` → 0 errors
- [x] Run: `npm run format` → no changes
- [x] Run: `npm run lint` → 0 errors (existing repo warnings OK)
- [x] Run: `npx tsc --noEmit` → 0 errors

### Testing

- [x] Run: `npm test` → all passing (1,876+ baseline + 24 new)
- [x] Verify: 0 skipped tests
- [x] Verify: Compact tests actually test compression logic

### Combined Verification

- [x] Run: `npm run format && npm run lint && npx tsc --noEmit && npm test`
- [x] All commands succeed (lint still reports legacy non-null warnings)
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
  - [x] Storage path chosen
  - [x] Compact threshold (80% or different)
  - [x] User message token budget (20k or adjusted)
  - [x] Summarization model (same as conversation or different)
  - [x] Compact visibility (user sees message or silent)
  - [x] Resume validation (allow provider mismatch or enforce)
  - [x] JSONL format compatibility with Rust
  - [x] Compact persistence strategy
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
