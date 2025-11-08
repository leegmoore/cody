# Phase 6: Final Core Integration

## Overview

Phase 6 ports the final three core modules that orchestrate the entire Codex system. This phase integrates all previously ported components into a complete, working agent library.

**This is the final port phase.** After Phase 6, the Codex TypeScript port is functionally complete.

## Prerequisites

**MUST be complete before starting:**
- Phase 1-5.1: All modules ported
- **Phase 5.2: Code quality cleanup (CRITICAL)**
  - 0 TypeScript errors
  - 0 ESLint problems
  - 0 test failures
  - 0 skipped tests

**Phase 6 starts with a CLEAN codebase.**

## Goals

1. **Core orchestration** - Main Codex engine (event loop, turn processing)
2. **Conversation wrapper** - Thin API over core
3. **Conversation manager** - High-level public API
4. **Full integration** - All systems working together
5. **Complete testing** - End-to-end workflows verified
6. **Maintained quality** - No degradation from 5.2 baseline

## Modules to Port

### 1. core/codex (3,145 lines - COMPLEX)

**Source:** `codex-rs/core/src/codex.rs`

**What it does:**
- Main orchestration engine
- Event loop (receives Ops, emits Events)
- Turn processing coordinator
- Tool execution routing
- MCP integration
- State management (ActiveTurn)
- Spawn/resume conversations

**Dependencies (75 imports):**
- conversation_history (Phase 5.1) ✅
- response_processing (Phase 5.1) ✅
- ModelClient (Phase 4.1) ✅
- AuthManager (Phase 5) ✅
- ToolRegistry (Phase 4.6) ✅
- MCP connection manager (Phase 4.3) ✅
- Config (Phase 2) ✅
- RolloutRecorder (Phase 2) ✅

**Sub-components:**
- Session struct
- TurnContext struct
- Event loop
- Op handling (15+ operation types)
- Tool call routing
- Response streaming coordination
- Error handling

**Complexity:** HIGHEST - This is the heart of Codex

**Estimated tests:** 50-80

### 2. core/codex-conversation (39 lines - SIMPLE)

**Source:** `codex-rs/core/src/codex_conversation.rs`

**What it does:**
- Thin wrapper around Codex
- Provides conversation-level API
- Submit operations
- Receive events
- Get rollout path

**Dependencies:**
- core/codex (module 1)
- protocol types (Phase 1) ✅

**Complexity:** TRIVIAL - Just delegates to codex

**Estimated tests:** 10-15

### 3. core/conversation-manager (339 lines - MEDIUM)

**Source:** `codex-rs/core/src/conversation_manager.rs`

**What it does:**
- High-level conversation API (public interface)
- Create new conversations
- Resume from rollout
- Fork conversations
- List conversations
- Remove conversations

**Dependencies:**
- core/codex (module 1)
- core/codex-conversation (module 2)
- AuthManager (Phase 5) ✅
- RolloutRecorder (Phase 2) ✅

**Complexity:** MEDIUM - Coordination logic

**Estimated tests:** 30-40

**Total: ~3,500 lines, 90-135 tests**

## Porting Strategy

### Phase 6 is Different

**Previous phases:** Individual modules, limited integration
**Phase 6:** Everything must work together

**Approach:**
1. Port core/codex in sections (event loop, turn processing, tool routing)
2. Test each section before moving on
3. Port codex-conversation (simple wrapper)
4. Port conversation-manager (public API)
5. **Extensive integration testing** (full workflows)
6. **Fix ALL quality issues** (maintain 5.2 baseline)

### Breaking Down core/codex

**Too large to port as single unit. Break into:**

**Section 1: Core Types & Session (500 lines)**
- Session struct
- TurnContext struct
- ActiveTurn state
- Basic initialization

**Section 2: Event Loop (400 lines)**
- Op handling structure
- Event emission
- Message passing

**Section 3: Tool Integration (600 lines)**
- Tool call detection
- Tool router integration
- Tool result handling

**Section 4: Turn Processing (800 lines)**
- Turn initiation
- Response processing
- History recording

**Section 5: MCP & Advanced (600 lines)**
- MCP tool calls
- Web search integration
- Special features

**Section 6: Spawn/Resume (245 lines)**
- Conversation initialization
- Resume from rollout
- Fork logic

**Port incrementally, test continuously.**

## Success Criteria

### Functional Requirements

- [ ] core/codex operational (all 6 sections)
- [ ] core/codex-conversation working
- [ ] core/conversation-manager functional
- [ ] Can create conversation (new)
- [ ] Can send message and get response
- [ ] Can execute tool (structured call)
- [ ] Can handle approval flow
- [ ] Can persist conversation to JSONL
- [ ] Can resume from JSONL
- [ ] Can fork conversation
- [ ] Can list conversations
- [ ] Integration tests pass (5+ full workflows)

### Code Quality Requirements (ENTIRE CODEBASE)

**TypeScript:**
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] All pre-existing type errors resolved (from 5.1)
- [ ] New code has proper types
- [ ] No implicit `any`

**ESLint:**
- [ ] `npm run lint` → 0 problems
- [ ] All pre-existing lint errors resolved (from 5.1)
- [ ] New code follows rules
- [ ] No explicit `any`

**Testing:**
- [ ] `npm test` → All passing
- [ ] `npm test` → 0 skipped
- [ ] All pre-existing failures fixed
- [ ] New module tests comprehensive

**Format:**
- [ ] `npm run format` → No changes

### Quality Verification Command

**Must run clean:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```

**Exit code 0, no errors, no warnings, no skips.**

### Pre-Existing Issues from Phase 5.1

**If Phase 5.2 NOT complete, agent must fix:**
- 65 TypeScript errors
- 319 ESLint problems
- 5 test failures
- 9 skipped tests

**Agent CANNOT skip these.** Phase 6 requires clean baseline.

### Handling Issues

**If agent encounters:**
- Blocking errors
- Ambiguous resolution
- Test failures in other modules
- Uncertainty about fix

**Agent must:**
- STOP porting
- Document issue
- Report to user
- Await guidance
- NOT declare complete with issues

**Phase 6 complete ONLY when:**
- All 3 modules ported
- All integration tests pass
- All quality checks pass
- Entire codebase clean

## Complexity Assessment

**core/codex is the most complex module in the entire port:**
- 3,145 lines (10x average module)
- 75 dependencies (most interconnected)
- Event loop (async complexity)
- State management (ActiveTurn lifecycle)
- Tool orchestration (routing, execution, results)
- MCP integration (dynamic tools)
- Error handling (comprehensive)

**This will take multiple sessions.**

**Recommendation:**
- Port in 6 sections (not all at once)
- Test each section thoroughly
- Commit after each section
- Don't rush - this is critical code

## Success Metrics

**When Phase 6 complete:**
- ✅ Can create new conversation programmatically
- ✅ Can send message, receive response
- ✅ Can execute tool, see result
- ✅ Can approve tool execution
- ✅ Conversation persists to JSONL
- ✅ Can resume conversation from file
- ✅ All tests passing (1,900+ total)
- ✅ All quality checks pass
- ✅ Library ready for use

## Next Steps

**After Phase 6:**
- Rust port COMPLETE
- Move to: UI Integration Project (wire into CLI)
- Begin: Innovation projects (script harness, gradient, etc.)

**Phase 6 is the finish line for the port.**
