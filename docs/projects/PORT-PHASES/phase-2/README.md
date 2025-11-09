# Phase 2: Core Engine

## Overview

Phase 2 builds the core conversation engine by porting configuration management, session lifecycle, and persistence layer. This phase uses the protocol types from Phase 1 to implement the business logic.

## Goals

1. **Configuration system** - Load and manage Codex configuration
2. **Conversation lifecycle** - Create, resume, fork conversations
3. **Session persistence** - Store and retrieve conversation history (rollout)
4. **Message history** - Track turns and items

## What Needs Porting

### Core Modules (4 modules - Configuration & Persistence Only)

1. **core/config.rs**
   - Configuration data structure
   - Config validation
   - Default values
   - Dependencies: `protocol/config-types`

2. **core/config_loader.rs**
   - Load config from TOML files
   - Environment variable overrides
   - CLI argument overrides
   - Dependencies: `core/config`, `common/config-override`

3. **core/message_history.rs**
   - Track conversation turns
   - Manage turn items
   - Dependencies: `protocol/message-history`, `protocol/items`

4. **core/rollout.rs**
   - Persist conversations to disk
   - Load conversations from disk
   - Archive and delete operations
   - Dependencies: `protocol/*`

### Deferred to Later Phases (BLOCKED by dependencies)

5. **core/codex.rs** → DEFERRED (needs `core/client` from Phase 4)
6. **core/codex_conversation.rs** → DEFERRED (needs core/codex)
7. **core/conversation_manager.rs** → DEFERRED (needs `AuthManager` from Phase 5)

## Module Dependencies

```
core/config ← protocol/config-types
    ↓
core/config-loader ← common/config-override
    ↓
core/message-history ← protocol/message-history, protocol/items
    ↓
core/rollout ← protocol/*
    ↓
core/codex ← ALL above
    ↓
core/codex-conversation
    ↓
core/conversation-manager ← ALL above
```

## Porting Order

**Recommended sequence:**
1. `core/config` (foundation)
2. `core/config-loader` (depends on config)
3. `core/message-history` (can be parallel with config-loader)
4. `core/rollout` (persistence layer)

**Modules 5-7 deferred** - moved to Phase 4.5 after dependencies available

## Testing Strategy

### Unit Tests
- Each module needs comprehensive unit tests
- Test configuration loading from various sources
- Test conversation lifecycle operations
- Test persistence (rollout) read/write

### Integration Tests
- **Config integration**: Load config from file → apply overrides → validate
- **Conversation flow**: Create → send message → persist → resume
- **Rollout**: Write conversation → read back → verify equality

### Key Test Scenarios
1. **Config loading**: TOML file + env vars + CLI overrides
2. **Conversation creation**: Default config vs custom config
3. **Resume conversation**: Load from disk, continue session
4. **Fork conversation**: Branch at specific turn
5. **List conversations**: Pagination, filtering
6. **Archive**: Move to archived directory
7. **Delete**: Remove from disk

## Technical Decisions to Make

### Configuration Format
- **Decision needed**: TOML parsing library
- **Options**: `@iarna/toml`, `smol-toml`, custom parser
- **Rust uses**: `toml` crate (full TOML 1.0)

### Persistence Format
- **Decision**: Keep Rust's format or create new?
- **Recommendation**: Match Rust format exactly for compatibility
- **Format**: JSONL with event stream

### File Paths
- **Rust uses**: `PathBuf` extensively
- **TypeScript**: Use `string` with `path` module
- **Cross-platform**: Use `path.join()`, `path.resolve()`

### Async Patterns
- **Rust uses**: `tokio` async runtime
- **TypeScript**: Native `async/await` with Node.js
- **Channels**: Rust `mpsc` → TypeScript `EventEmitter` or async generators

## Success Criteria

- [x] Phase 1 complete (prerequisite)
- [ ] 4 configuration & persistence modules ported
- [ ] Comprehensive tests for each module
- [ ] 100% test pass rate
- [ ] Integration tests passing
- [ ] Config loads from all sources (TOML, env, CLI)
- [ ] Can persist and load rollout files
- [ ] Documentation updated

## Time Estimates

**REMOVED** - estimates are unreliable. Work until done, track actual time.

## File Structure

```
codex-ts/src/core/
├── config.ts
├── config.test.ts
├── config-loader.ts
├── config-loader.test.ts
├── message-history.ts
├── message-history.test.ts
├── rollout.ts
├── rollout.test.ts
├── codex.ts
├── codex.test.ts
├── codex-conversation.ts
├── codex-conversation.test.ts
├── conversation-manager.ts
├── conversation-manager.test.ts
└── index.ts (exports)
```

## Next Phase Preview

Phase 3 will use Phase 2's conversation engine to add:
- Command execution (`core/exec`, `exec`, `execpolicy`)
- File operations (`apply-patch`, `file-search`)
- Tool orchestration (`core/tools`)
- Sandboxing (`core/sandboxing`)
