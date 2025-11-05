# Phase 1 Checklist

**Phase Start Date:** 2025-11-05
**Phase End Date:** _Not completed_
**Current Status:** In Progress

---

## Setup & Infrastructure

- [ ] Review PORT-PLAN.md and phase-1/README.md
- [ ] Create test-utils directory structure
- [ ] Set up golden file testing utilities
- [ ] Create protocol test fixtures directory
- [ ] Set up protocol test factories

---

## Protocol Module Porting

### protocol/config-types.ts
- [x] Read codex-rs/protocol/src/config_types.rs
- [x] Create codex-ts/src/protocol/config-types.ts
- [x] Define SandboxMode enum
- [x] Define ReasoningEffort enum
- [x] Define ReasoningSummary enum
- [x] Define Verbosity enum
- [x] Define ForcedLoginMethod enum
- [x] Create codex-ts/src/protocol/config-types.test.ts
- [x] Write serialization tests (min 8 tests)
- [x] Write validation tests
- [x] Verify all tests pass

### protocol/account.ts
- [x] Read codex-rs/protocol/src/account.rs
- [x] Create codex-ts/src/protocol/account.ts
- [x] Define Account/User types
- [x] Define authentication status types
- [x] Create codex-ts/src/protocol/account.test.ts
- [x] Write serialization tests (min 5 tests)
- [x] Verify all tests pass

### protocol/message-history.ts
- [x] Read codex-rs/protocol/src/message_history.rs
- [x] Create codex-ts/src/protocol/message-history.ts
- [x] Define message history types
- [x] Define turn tracking types
- [x] Create codex-ts/src/protocol/message-history.test.ts
- [x] Write tests (min 5 tests)
- [x] Verify all tests pass

### protocol/custom-prompts.ts
- [x] Read codex-rs/protocol/src/custom_prompts.rs
- [x] Create codex-ts/src/protocol/custom-prompts.ts
- [x] Define prompt template types
- [x] Define placeholder handling
- [x] Create codex-ts/src/protocol/custom-prompts.test.ts
- [x] Write tests (min 6 tests)
- [x] Verify all tests pass

### protocol/plan-tool.ts
- [x] Read codex-rs/protocol/src/plan_tool.rs
- [x] Create codex-ts/src/protocol/plan-tool.ts
- [x] Define TodoItem types
- [x] Define plan tracking types
- [x] Create codex-ts/src/protocol/plan-tool.test.ts
- [x] Write tests (min 6 tests)
- [x] Verify all tests pass

### protocol/items.ts
- [x] Read codex-rs/protocol/src/items.rs
- [x] Read codex-rs/protocol/src/user_input.rs for dependencies
- [x] Read sdk/typescript/src/items.ts for comparison
- [x] Create codex-ts/src/protocol/items.ts
- [x] Define UserInput union type (text, image, local_image)
- [x] Define AgentMessageContent type
- [x] Define TurnItem union type (user_message, agent_message, reasoning, web_search)
- [x] Define UserMessageItem
- [x] Define AgentMessageItem
- [x] Define ReasoningItem
- [x] Define WebSearchItem
- [x] Create helper functions (getTurnItemId, create*, extract* functions)
- [x] Create codex-ts/src/protocol/items.test.ts
- [x] Write serialization tests for each item type (min 12 tests)
- [x] Write validation tests
- [x] Write helper function tests
- [x] Verify all tests pass

### protocol/models.rs
- [ ] Read codex-rs/protocol/src/models.rs
- [ ] Create codex-ts/src/protocol/models.ts
- [ ] Define ModelRequest types
- [ ] Define ModelResponse types
- [ ] Define provider-specific types (OpenAI, Anthropic, etc.)
- [ ] Define streaming response types
- [ ] Define tool call types
- [ ] Create codex-ts/src/protocol/models.test.ts
- [ ] Write serialization tests (min 15 tests)
- [ ] Write validation tests
- [ ] Write streaming response tests
- [ ] Verify all tests pass

### protocol/protocol.ts (LARGEST MODULE)
- [ ] Read codex-rs/protocol/src/protocol.rs thoroughly
- [ ] Create codex-ts/src/protocol/protocol.ts
- [ ] Define Event type
- [ ] Define EventMsg union type
- [ ] Define Op type
- [ ] Define Submission type
- [ ] Define SessionConfiguredEvent
- [ ] Define all event message variants
- [ ] Define request/response types
- [ ] Define session management types
- [ ] Create codex-ts/src/protocol/protocol.test.ts
- [ ] Write Event serialization tests (min 10 tests)
- [ ] Write EventMsg variant tests (min 15 tests)
- [ ] Write Op serialization tests (min 5 tests)
- [ ] Write Submission tests (min 5 tests)
- [ ] Write integration round-trip tests
- [ ] Verify all tests pass

---

## Integration & Testing

### Test Infrastructure
- [ ] Create codex-ts/test-utils/protocol-factories.ts
- [ ] Add factory functions for all protocol types
- [ ] Create codex-ts/test-utils/test-helpers.ts
- [ ] Add assertion helpers for protocol types
- [ ] Create codex-ts/test-utils/golden-file-utils.ts
- [ ] Add golden file comparison utilities

### Golden File Tests
- [ ] Generate golden JSON files from Rust codebase
- [ ] Store in codex-ts/test-fixtures/protocol/
- [ ] Create golden file test for Events
- [ ] Create golden file test for Models
- [ ] Create golden file test for Items
- [ ] Verify golden tests pass

### SDK Compatibility
- [ ] Compare protocol/items.ts with sdk/typescript/src/items.ts
- [ ] Verify type compatibility
- [ ] Compare protocol/protocol.ts events with sdk/typescript/src/events.ts
- [ ] Verify event type compatibility
- [ ] Document any differences in DECISIONS.md

### Integration Tests
- [ ] Create protocol round-trip integration test
- [ ] Test: Create Event → serialize → deserialize → verify equality
- [ ] Test: Create all item types → serialize → deserialize → verify
- [ ] Test: Create complex message flow → verify serialization
- [ ] All integration tests pass

---

## Documentation & Cleanup

- [ ] Update codex-ts/src/protocol/index.ts with all exports
- [ ] Add JSDoc comments to all exported types
- [ ] Update ts-port-status.md with completed modules
- [ ] Update test count in ts-port-status.md
- [ ] Run `pnpm test` and verify 100% pass rate
- [ ] Run `pnpm build` and verify no errors
- [ ] Run linter and fix all warnings
- [ ] Review all code for TODOs and fix/document them
- [ ] Update STATUS.md with final summary

---

## Final Validation

- [ ] All 8 protocol modules ported
- [ ] Minimum 80 new tests written
- [ ] 100% test pass rate achieved
- [ ] All golden file tests pass
- [ ] SDK type compatibility verified
- [ ] Documentation complete
- [ ] No TypeScript errors
- [ ] No linter warnings
- [ ] DECISIONS.md has all technical decisions documented
- [ ] STATUS.md has complete progress log
- [ ] Ready for Phase 2

---

## Summary Stats

**Total Tasks:** 100+
**Completed:** 0
**In Progress:** 0
**Blocked:** 0

**Test Target:** 80+ new tests
**Current Test Count:** TBD

**Estimated Hours:** 35-45
**Actual Hours:** TBD
