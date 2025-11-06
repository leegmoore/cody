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

- [ ] All modules ported
- [ ] Full conversation flow works end-to-end
- [ ] Can create conversation
- [ ] Can send message and get response
- [ ] Can execute tools
- [ ] Can persist and resume
- [ ] 100% test pass rate
- [ ] Integration tests cover full workflows

## Next Steps

After Phase 6, the TypeScript port is COMPLETE and the library can be published as @openai/codex-core.
