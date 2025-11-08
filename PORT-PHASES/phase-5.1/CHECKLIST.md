# Phase 5.1 Checklist

**Status:** Not Started

---

## Prerequisites

- [x] Phase 4.7 complete (web tools)
- [x] Phase 5 complete (auth, CLI, utils)
- [ ] Review Phase 5.1 plan

---

## Module 1: openai_model_info (Trivial)

- [ ] Read codex-rs/core/src/openai_model_info.rs
- [ ] Create codex-ts/src/core/model-info/openai.ts
- [ ] Port ModelInfo interface
- [ ] Port model lookup table (context windows, max tokens)
- [ ] Add get_model_info function
- [ ] Create tests (10 tests)
- [ ] Test model slugs from Rust source table (data lookup, not API calls)
- [ ] Test unknown model slug returns null
- [ ] Verify tests passing

---

## Module 2: model_family (Low Complexity)

- [ ] Read codex-rs/core/src/model_family.rs
- [ ] Create codex-ts/src/core/model-family/index.ts
- [ ] Port ModelFamily interface
- [ ] Port model_family macro patterns
- [ ] Port find_family_for_model function
- [ ] Port derive_default_model_family
- [ ] Create tests (15 tests)
- [ ] Test model family derivation
- [ ] Test capabilities lookup
- [ ] Verify tests passing

---

## Module 3: parse_turn_item (Trivial)

- [ ] Read codex-rs/core/src/event_mapping.rs (find parse_turn_item)
- [ ] Create codex-ts/src/core/event-mapping/parse-turn-item.ts
- [ ] Port parse_turn_item function
- [ ] Convert ResponseItem → TurnItem
- [ ] Create tests (8 tests)
- [ ] Test all item type conversions
- [ ] Verify tests passing

---

## Module 4: shell (Stub)

- [ ] Create codex-ts/src/core/shell/index.ts
- [ ] Define Shell interface
- [ ] Implement default_user_shell() returning bash
- [ ] Stub: {type: "bash", path: "/bin/bash", rcPath: "~/.bashrc"}
- [ ] Add TODO for full implementation
- [ ] Create tests (5 tests)
- [ ] Test returns bash default
- [ ] Verify tests passing

---

## Module 5: features (Stub)

- [ ] Create codex-ts/src/core/features/index.ts
- [ ] Define Feature enum
- [ ] Define Features class
- [ ] Implement enabled() returning false for all
- [ ] List all features from Rust (UnifiedExec, StreamableShell, etc.)
- [ ] Add TODO for full implementation
- [ ] Create tests (8 tests)
- [ ] Test all features disabled
- [ ] Verify tests passing

---

## Module 6: environment_context (Simplified)

- [ ] Read codex-rs/core/src/environment_context.rs
- [ ] Create codex-ts/src/core/environment-context/index.ts
- [ ] Port EnvironmentContext interface
- [ ] Implement simplified version:
  - cwd (working directory)
  - sandbox_mode (from config)
  - network_access (from sandbox policy)
  - shell (from module 4)
- [ ] Omit: Complex writable_roots logic (for now)
- [ ] Create tests (10 tests)
- [ ] Test context creation
- [ ] Test serialization
- [ ] Verify tests passing

---

## Module 7: response_processing (Medium)

- [ ] Read codex-rs/core/src/response_processing.rs
- [ ] Create codex-ts/src/core/response-processing/index.ts
- [ ] Port ProcessedResponseItem type
- [ ] Port process_items function
- [ ] Match tool calls to outputs (by call_id)
- [ ] Integrate with conversation_history.record_items
- [ ] Create tests (20 tests)
- [ ] Test FunctionCall → FunctionCallOutput pairing
- [ ] Test CustomToolCall pairing
- [ ] Test orphan output handling
- [ ] Verify tests passing

---

## Module 8: conversation_history (High Complexity)

### Strategy Pattern Setup
- [ ] Create codex-ts/src/core/conversation-history/strategy.ts
- [ ] Define HistoryStrategy interface
- [ ] Define HistorySegment type
- [ ] Define TokenBudget type
- [ ] Add documentation for future strategies

### Core Implementation
- [ ] Read codex-rs/core/src/conversation_history.rs
- [ ] Create codex-ts/src/core/conversation-history/index.ts
- [ ] Create RegularHistoryStrategy class
- [ ] Port ConversationHistory class (uses strategy)
- [ ] Port record_items (add items to history)
- [ ] Port get_history (return for prompts)
- [ ] Port get_history_for_prompt (filter ghosts)
- [ ] Port remove_first_item (compaction)
- [ ] Port normalize_history (deduplication)
- [ ] Port token tracking (update_token_info)

### Deduplication Logic
- [ ] Port remove_orphan_outputs
- [ ] Port insert_missing_outputs
- [ ] Port remove_corresponding_for
- [ ] Handle FunctionCall/Output pairing

### Tests
- [ ] Create conversation-history.test.ts
- [ ] Test record_items (15 tests)
- [ ] Test get_history (10 tests)
- [ ] Test deduplication (15 tests)
- [ ] Test token tracking (10 tests)
- [ ] Test normalization (10 tests)
- [ ] Verify all 60 tests passing

---

## Integration

- [ ] Wire conversation_history to rollout (Phase 2 already has this)
- [ ] Wire to response_processing
- [ ] Test end-to-end: record turn → retrieve history
- [ ] Verify JSONL format compatible with Rust

---

## Final

- [ ] All 8 modules ported
- [ ] Strategy pattern implemented
- [ ] 130+ tests passing
- [ ] Compatible with existing JSONL storage
- [ ] Update PORT_LOG_MASTER.md
- [ ] Commit and push
- [ ] Phase 5.1 COMPLETE - Ready for Phase 6!
