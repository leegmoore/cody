# Phase 6: Final Integration

## Overview

Phase 6 is the final integration phase where we wire together all the deferred modules that required dependencies from all previous phases.

## Goals

1. **Core orchestration** - The main Codex engine
2. **Conversation management** - High-level conversation API
3. **Full integration** - All modules working together
4. **End-to-end testing** - Complete workflows

## Modules to Port

### Core Orchestration (Deferred from Phase 2)

1. **core/codex** - Main orchestrator
   - Requires: core/client (Phase 4), core/auth (Phase 5), core/exec (Phase 3), all protocol types
   - The heart of the system

2. **core/codex-conversation** - Conversation wrapper
   - Requires: core/codex
   - Thin wrapper for conversation operations

3. **core/conversation-manager** - High-level API
   - Requires: core/codex, core/auth, core/rollout
   - ConversationManager class from API design

## Porting Order

1. core/codex (main orchestrator)
2. core/codex-conversation (wrapper)
3. core/conversation-manager (high-level API)

## Success Criteria

### Functional Requirements
- [ ] All modules ported (core/codex, core/codex-conversation, core/conversation-manager)
- [ ] Full conversation flow works end-to-end
- [ ] Can create conversation
- [ ] Can send message and get response
- [ ] Can execute tools
- [ ] Can persist and resume
- [ ] Integration tests cover full workflows

### Code Quality Requirements (ENTIRE CODEBASE)

**TypeScript:**
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] All pre-existing type errors resolved
- [ ] No implicit `any` types
- [ ] Proper type annotations throughout

**ESLint:**
- [ ] `npm run lint` reports 0 problems
- [ ] All pre-existing lint errors resolved
- [ ] All unused variables removed or prefixed with _
- [ ] No explicit `any` types
- [ ] All require() converted to imports

**Testing:**
- [ ] `npm test` reports 0 failures
- [ ] `npm test` reports 0 skipped tests
- [ ] All pre-existing test failures fixed
- [ ] All skipped tests either removed (not needed), implemented (lazy), or converted to TODO comments (awaiting feature)
- [ ] New tests for all ported modules

**Format:**
- [ ] `npm run format` makes no changes (already formatted)
- [ ] Code follows prettier configuration

### Quality Verification Command

**Single command must run clean:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```

**All must succeed with:**
- Prettier: No file changes
- ESLint: 0 problems
- TypeScript: 0 errors
- Tests: All passing, none skipped

### Handling Issues

**If agent encounters:**
- Pre-existing errors blocking work
- Ambiguous error resolution
- Test failures from other modules
- Uncertainty about correct fix

**Agent must:**
- STOP work on current module
- Document the issue clearly
- Discuss with user before proceeding
- NOT declare phase complete with unresolved issues
- NOT decide "not my responsibility"

**Phase 6 is only complete when ENTIRE codebase is clean.**

## Next Steps

After Phase 6, the TypeScript port is COMPLETE and the library can be published as @openai/codex-core.
