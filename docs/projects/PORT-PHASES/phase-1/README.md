# Phase 1: Foundation & Protocol

## Overview

Phase 1 establishes the foundation for the entire TypeScript port by completing the protocol layer and setting up robust testing infrastructure. This phase is critical because all subsequent work depends on correct protocol type definitions.

## Goals

1. **Complete protocol type definitions** - Port all remaining `protocol/*` modules
2. **Establish test patterns** - Create testing infrastructure that matches Rust patterns
3. **Enable integration testing** - Build harness for testing cross-module flows
4. **Set quality baseline** - 100% test pass rate, no technical debt

## What's Already Done

From `ts-port-status.md`, these modules are complete:
- ✅ `protocol/approvals` - Approval request types
- ✅ `protocol/conversation-id` - UUIDv7 conversation identifiers (8 tests)
- ✅ `protocol/num-format` - Number formatting (9 tests)
- ✅ `protocol/parse-command` - Shell command parsing
- ✅ `protocol/types` - Core protocol types (6 tests)
- ✅ `protocol/user-input` - User input types

## What Needs Porting

### Protocol Modules

1. **protocol/protocol.rs** (1560 lines) - Core protocol messages
   - `Event`, `EventMsg`, `Op`, `Submission` types
   - Request/response message types
   - Session management types
   - This is the main protocol definition file

2. **protocol/models.rs** (690 lines) - Model request/response types
   - `ModelRequest`, `ModelResponse`
   - Provider-specific types (OpenAI, Anthropic, etc.)
   - Streaming response types

3. **protocol/items.rs** (159 lines) - Turn item types
   - `TurnItem` enum and variants
   - Tool call items, file change items, etc.
   - Matches `sdk/typescript/src/items.ts` types

4. **protocol/config_types.rs** (87 lines) - Configuration types
   - `SandboxMode`, `ApprovalMode` enums
   - Model provider configuration
   - MCP server configuration

5. **protocol/account.rs** (20 lines) - Account/auth types
   - User account information
   - Authentication status types

6. **protocol/message_history.rs** (11 lines) - Message history types
   - History management types
   - Turn tracking

7. **protocol/custom_prompts.rs** (20 lines) - Custom prompt types
   - Prompt template definitions
   - Placeholder handling

8. **protocol/plan_tool.rs** (28 lines) - Planning tool types
   - Todo list management
   - Plan tracking types

### Testing Infrastructure

9. **Vitest configuration improvements**
   - Add golden file testing utilities
   - Add snapshot testing for protocol serialization
   - Integration test helpers

10. **Test utilities module**
    - Factories for creating test protocol objects
    - Assertion helpers for protocol types
    - Mock data generators

## Module Dependencies

```
protocol/protocol.rs (core)
├── protocol/types.rs ✅
├── protocol/user-input.rs ✅
├── protocol/approvals.rs ✅
├── protocol/items.rs (to port)
├── protocol/models.rs (to port)
├── protocol/config_types.rs (to port)
├── protocol/account.rs (to port)
├── protocol/message_history.rs (to port)
├── protocol/custom_prompts.rs (to port)
└── protocol/plan_tool.rs (to port)
```

## Testing Strategy

### Unit Tests
For each protocol module:
- Test serialization (TypeScript → JSON)
- Test deserialization (JSON → TypeScript)
- Test validation (invalid data rejected)
- Test edge cases (empty, null, large values)

### Integration Tests
- **Protocol round-trips**: Create object → serialize → deserialize → verify equality
- **SDK compatibility**: Ensure types match `sdk/typescript/src/events.ts` and `sdk/typescript/src/items.ts`
- **Schema validation**: All protocol types have correct JSON schema

### Golden File Tests
- Compare serialized output against known-good Rust JSON output
- Store golden files in `codex-ts/test-fixtures/protocol/`

## Key Technical Decisions

### Type Safety
- Use strict TypeScript types (no `any`)
- Use discriminated unions for variant types
- Validate at runtime using Zod or similar

### Serialization
- Use standard JSON.stringify/parse
- Add custom serializers for special types (dates, UUIDs)
- Match Rust's serde output format exactly

### Error Handling
- Throw typed errors for invalid data
- Include context in error messages
- Match Rust error messages where possible

## File Structure

```
codex-ts/src/protocol/
├── types.ts ✅
├── types.test.ts ✅
├── user-input.ts ✅
├── approvals.ts ✅
├── parse-command.ts ✅
├── conversation-id/ ✅
├── num-format/ ✅
├── protocol.ts (NEW)
├── protocol.test.ts (NEW)
├── models.ts (NEW)
├── models.test.ts (NEW)
├── items.ts (NEW)
├── items.test.ts (NEW)
├── config-types.ts (NEW)
├── config-types.test.ts (NEW)
├── account.ts (NEW)
├── account.test.ts (NEW)
├── message-history.ts (NEW)
├── message-history.test.ts (NEW)
├── custom-prompts.ts (NEW)
├── custom-prompts.test.ts (NEW)
├── plan-tool.ts (NEW)
├── plan-tool.test.ts (NEW)
└── index.ts (export all)

codex-ts/test-utils/
├── protocol-factories.ts (NEW)
├── test-helpers.ts (NEW)
└── golden-file-utils.ts (NEW)

codex-ts/test-fixtures/
└── protocol/
    ├── events.json (NEW)
    ├── models.json (NEW)
    └── items.json (NEW)
```

## Success Criteria

- [ ] All 8 protocol modules ported with tests
- [ ] Minimum 10 tests per module (80+ total new tests)
- [ ] 100% test pass rate
- [ ] Types match SDK types exactly
- [ ] Golden file tests pass
- [ ] Documentation updated in ts-port-status.md
- [ ] No TypeScript compilation errors
- [ ] No linter warnings

## Estimated Effort

- **protocol/protocol.rs**: 8-10 hours (largest file)
- **protocol/models.rs**: 6-8 hours (complex types)
- **protocol/items.rs**: 4-5 hours (needs SDK alignment)
- **protocol/config_types.rs**: 2-3 hours
- **Other protocol modules**: 1-2 hours each
- **Test infrastructure**: 4-6 hours
- **Golden file tests**: 3-4 hours
- **Documentation**: 2-3 hours

**Total**: ~35-45 hours (1-2 weeks)

## How to Execute This Phase

See `CHECKLIST.md` for step-by-step tasks.

Use `STATUS.md` to log progress daily.

Record technical decisions in `DECISIONS.md`.

## Next Phase Preview

Phase 2 will use these protocol types to build:
- Configuration loading and management
- Conversation manager for session lifecycle
- Rollout (persistence) system
- Message history tracking

All of Phase 2 depends on Phase 1 being 100% complete and correct.
