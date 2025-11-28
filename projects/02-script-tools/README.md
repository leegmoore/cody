# Project 02: Script-Based Tool Execution

**Status:** Planning
**Date:** November 2025

---

## Overview

This project implements a **script-based tool execution harness** as an alternative to traditional JSON-structured tool calling. Instead of models outputting structured JSON tool calls that execute one-at-a-time, models write JavaScript/TypeScript code in `<script>` blocks that executes in a sandboxed QuickJS WASM runtime.

### Why Script-Based Execution?

**Problem with JSON Tool Calls:**
1. **JSON escaping burden** - Models must escape quotes, newlines, backslashes in code strings. Smaller models frequently fail at this.
2. **No interleaving** - Models can't mix thinking/output with tool execution. It's all-or-nothing structured output.
3. **Multiple round-trips** - Each tool call requires a turn. Complex workflows = many turns = context fragmentation.
4. **Rigid format** - Parallel calls are batch-or-nothing. No conditional logic between tools.

**Script-Based Solution:**
1. **Natural syntax** - Models write code directly. No escaping. `await shell("pwd")` not `{"command": "pwd"}`.
2. **Interleaving** - Models can think, write script, explain, write more script. Full flexibility.
3. **Compositional** - Multiple tools in one script. Output of tool A feeds into tool B. Conditional logic. Error handling.
4. **Fewer turns** - Complex workflows complete in one turn. Original context stays recent.

### Model Training Alignment

The sandbox exposes functions that match what models were trained on:
- OpenAI models: `applyPatch()` matches their training data
- Anthropic models: `strReplaceEditor()` matches their training data

Models get the RL benefit of familiar function signatures without the JSON overhead.

---

## Architecture Summary

```
Model Response (contains <script>...</script>)
    ↓
Adapter detects script block
    ↓
Emits script_execution event
    ↓
Script Harness validates & executes in QuickJS WASM sandbox
    ↓
Sandbox has instrumented functions: shell(), readFile(), applyPatch(), etc.
    ↓
Results returned: { result, logs[], operations[] }
    ↓
Emits script_execution_output event
    ↓
Result injected into conversation for next turn
```

**Key Properties:**
- Execution happens inline in the adapter (no separate worker needed)
- QuickJS runs in worker threads to avoid blocking event loop
- Functions are instrumented to record operations for visibility
- Console output captured for model self-documentation
- Multi-turn iteration supported (model can write multiple scripts across turns)

---

## Project Documents

| Document | Purpose |
|----------|---------|
| `README.md` | This file - project overview and orientation |
| `plan.md` | Phased implementation plan with TDD approach |
| `technical-architecture-overview.md` | Architecture deep dive, integration points, refactor work |
| `quickjs-sandbox-analysis.md` | Analysis of existing QuickJS code in codex-ts (migrated here) |

---

## Key References

### Product Vision
- `docs/product-vision/codex-enhancement-02.md` - Original product spec for script execution

### Testing Philosophy
- `docs/core/contract-testing-tdd-philosophy.md` - Service mock testing approach (mock external deps, test contracts)

### Current Architecture
- `cody-fastify/docs/codex-core-2.0-tech-design.md` - Current streaming architecture
- `cody-fastify/src/core/schema.ts` - Canonical event/item schemas
- `cody-fastify/src/core/adapters/` - OpenAI and Anthropic adapters

### Existing QuickJS Implementation
- `codex-ts/src/script-harness/` - Full QuickJS sandbox implementation (to be migrated)
- 200+ unit tests already exist and pass

---

## Success Criteria

1. **Agent configs working** - Can submit with agentId, get correct model/provider/tools
2. **Script detection working** - Adapter detects `<script>` blocks, emits events
3. **Script execution working** - QuickJS sandbox executes scripts, returns structured results
4. **Multi-turn working** - Model can iterate (script → result → script → result)
5. **Tools working** - shell, readFile, writeFile, applyPatch functional and instrumented
6. **TDD throughout** - Every phase has tests written first

---

## Testing Strategy

### Two Test Suites

**1. tdd-api (Integration Tests)**
- Real infrastructure (Redis, Convex, LLM providers)
- End-to-end validation
- Smoke tests for critical paths
- Located: `cody-fastify/test-suites/tdd-api/`

**2. Service Mock Tests (New)**
- Mock external dependencies (Redis, Convex, LLM APIs)
- Exercise all code paths in-process
- Fast, deterministic, comprehensive
- Located: `cody-fastify/test-suites/service-mocks/` (to be created)

### What Gets Mocked

| Mock | Real |
|------|------|
| Redis | Adapters |
| Convex | Schema validation |
| LLM provider APIs | Reducers |
| File system (for some tests) | Script harness |
| | Tool execution |

### TDD Workflow

1. Define contract (what's the public API?)
2. Write failing tests against contract
3. Implement to green
4. Refactor as needed

---

## Relationship to Existing Tool System

**Current (JSON Tool Calls):**
- Model outputs `function_call` items
- Adapter detects, executes inline
- Publishes `function_call_output`

**New (Script Execution):**
- Model outputs `<script>` in content
- Adapter detects, executes via QuickJS sandbox
- Publishes `script_execution` and `script_execution_output`

**Coexistence:**
- Both can exist in same system
- Different event types, different code paths
- Same underlying tool implementations
- Eventually may deprecate JSON tool calls (script is strictly more capable)

---

## Getting Started

1. Read `plan.md` for implementation phases
2. Read `technical-architecture-overview.md` for architecture details
3. Read `quickjs-sandbox-analysis.md` for existing code inventory
4. Reference product vision doc for full spec
