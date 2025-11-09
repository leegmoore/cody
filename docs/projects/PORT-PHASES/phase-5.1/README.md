# Phase 5.1: Conversation & History Management

## Overview

Phase 5.1 ports the core conversation and history management modules from Rust, including the foundational modules needed by core/codex (Phase 6). This phase establishes conversation storage, turn processing, and model capability detection.

**Prerequisites:** Phases 1-4 complete (protocol, config, tools, client)

## Goals

1. **Conversation history** - Memory management with strategy pattern for future extensions
2. **Response processing** - Tool call pairing and history recording
3. **Model capabilities** - Model family and context window detection
4. **Turn processing** - Convert between response types
5. **Environment context** - Simplified version for turn context
6. **Support modules** - Shell detection, feature flags (stubs)

## Modules to Port

### Core Modules (Full Port)

**1. conversation_history (1,349 lines)**
- **What:** Manages conversation transcript, deduplication, token tracking
- **Does:** Record items, pair tool calls/outputs, provide history for prompts
- **Source:** `codex-rs/core/src/conversation_history.rs`
- **Complexity:** High (core memory management)
- **Enhancement:** Add strategy pattern interface for future gradient system

**2. response_processing (104 lines)**
- **What:** Processes model responses, pairs tool calls with outputs
- **Does:** Match FunctionCall → FunctionCallOutput, record in history
- **Source:** `codex-rs/core/src/response_processing.rs`
- **Complexity:** Medium (critical glue logic)

**3. model_family (192 lines)**
- **What:** Model capability metadata
- **Does:** Maps model slug → capabilities (context window %, parallel tools, etc.)
- **Source:** `codex-rs/core/src/model_family.rs`
- **Complexity:** Low (data structure + lookup)

**4. openai_model_info (87 lines)**
- **What:** Model info lookup table
- **Does:** Returns context_window, max_output_tokens for known models
- **Source:** `codex-rs/core/src/openai_model_info.rs`
- **Complexity:** Trivial (lookup table)

**5. parse_turn_item (50 lines)**
- **What:** Type conversion
- **Does:** ResponseItem → TurnItem
- **Source:** `codex-rs/core/src/event_mapping.rs` (extract function)
- **Complexity:** Trivial (type mapping)

### Simplified Modules

**6. environment_context (50 lines vs 347)**
- **What:** Environment info for turn context
- **Does:** Serialize cwd, sandbox_mode, network_access
- **Source:** `codex-rs/core/src/environment_context.rs` (simplified)
- **Approach:** Just cwd + sandbox_mode, stub the rest

**7. shell (20 lines vs 434)**
- **What:** Shell detection
- **Does:** Return default bash
- **Source:** `codex-rs/core/src/shell.rs` (stubbed)
- **Approach:** `const shell = {type: "bash", path: "/bin/bash"}`

**8. features (30 lines vs 303)**
- **What:** Feature flag system
- **Does:** Return all disabled
- **Source:** `codex-rs/core/src/features.rs` (stubbed)
- **Approach:** All experimental features off for MVP

## Strategy Pattern for History

### Purpose

Design conversation_history to support multiple history strategies (standard, gradient, one-shot) without changing the core implementation.

### Interface

```typescript
interface HistoryStrategy {
  recordTurn(turn: Turn): Promise<void>;
  getHistory(budget: TokenBudget): Promise<ResponseItem[]>;
  getTurn?(turnId: string, level: FidelityLevel): Promise<TurnContent>;
  getStats(): HistoryStats;
}
```

### Implementations

**Phase 5.1: RegularHistoryStrategy**
- Port Rust conversation_history behavior
- Full fidelity, truncate when budget exceeded
- Filesystem storage (JSONL)

**Phase 7: GradientHistoryStrategy**
- Multi-level compression
- Gradient selection
- Database storage (indexed retrieval)

**Future: OneShotHistoryStrategy**
- Epic + log file pattern
- No conversation accumulation

### Integration

```typescript
class ConversationHistory {
  constructor(private strategy: HistoryStrategy) {}

  async recordTurn(turn: Turn) {
    return this.strategy.recordTurn(turn);
  }

  async getHistory(budget: number) {
    return this.strategy.getHistory(budget);
  }
}

// Usage in Phase 6
const history = new ConversationHistory(
  new RegularHistoryStrategy(rolloutPath)
);
```

**Benefit:** Gradient system drops in later without touching conversation_history core.

## Storage Approach

### Phase 5.1: Filesystem (Faithful Port)

**Format:** JSONL (JSON Lines)
**Location:** `~/.codex/sessions/YYYY/MM/DD/rollout-{timestamp}-{uuid}.jsonl`

**Structure:**
```
Line 1: Session metadata
Line 2+: Response items (one per line)
```

**Characteristics:**
- Append-only (fast writes)
- Human-readable (debugging)
- Simple (no DB)
- Portable

**Why now:** Prove port works, match Rust behavior

### Future: Database Abstraction

**When needed:**
- Phase 7 (gradient system - 4 versions per turn)
- Phase 8 (offline processing - cross-session queries)

**Abstraction:**
```typescript
interface TurnStorage {
  saveTurn(turn: TurnVersions): Promise<void>;
  getTurn(id: string, level: string): Promise<TurnContent>;
  getHistory(range: TurnRange, level: string): Promise<Turn[]>;
}
```

**Implementations:**
- FilesystemStorage (current JSONL)
- PostgreSQLStorage (for gradient)
- MongoDBStorage (alternative)

**Not needed now** - defer until features require it.

## Success Criteria

- [ ] All 8 modules ported
- [ ] conversation_history with strategy pattern
- [ ] response_processing pairs tool calls correctly
- [ ] model_family and openai_model_info working
- [ ] JSONL storage working (create, append, read)
- [ ] Can list sessions
- [ ] Can resume sessions
- [ ] Tests passing (100+ tests)
- [ ] Ready for Phase 6 (core/codex)

## Porting Order

1. openai_model_info (easy, no dependencies)
2. model_family (depends on openai_model_info)
3. parse_turn_item (simple type conversion)
4. shell (stub, easy)
5. features (stub, easy)
6. environment_context (simplified)
7. response_processing (depends on parse_turn_item)
8. conversation_history (depends on response_processing, with strategy)

**Total:** ~1,900 lines + 100 for strategy pattern
