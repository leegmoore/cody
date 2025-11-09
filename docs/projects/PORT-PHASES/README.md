# TypeScript Port Phases

This directory contains detailed plans, checklists, and progress tracking for each phase of the Codex Rust → TypeScript port.

## Quick Links

- [**Overall Port Plan**](../PORT-PLAN.md) - Complete port strategy
- [**API Design**](../API-DESIGN.md) - Target API we're building
- [**Current Status**](../ts-port-status.md) - What's already done

## Phases

### [Phase 1: Foundation & Protocol](./phase-1/README.md)
**Goal:** Complete protocol layer and establish testing infrastructure

**Status:** ✅ COMPLETE

**Documents:**
- [README.md](./phase-1/README.md) - Detailed phase plan
- [CHECKLIST.md](./phase-1/CHECKLIST.md) - Task tracking
- [STATUS.md](./phase-1/STATUS.md) - Progress log
- [DECISIONS.md](./phase-1/DECISIONS.md) - Technical decisions
- [KICKOFF.md](./phase-1/KICKOFF.md) - Agent kickoff prompt

**Key Deliverables:**
- All `protocol/*` modules ported (8 modules)
- 80+ tests passing
- Golden file test infrastructure
- SDK type compatibility verified

---

### Phase 2: Core Engine
**Goal:** Conversation and turn management

**Status:** Not Started

**Key Deliverables:**
- `core/config` and config loading
- `core/conversation-manager`
- `core/codex-conversation`
- `core/message-history`
- `core/rollout` (persistence)

---

### Phase 3: Execution & Tools
**Goal:** Command execution, file operations, tool management

**Status:** Not Started

**Key Deliverables:**
- `core/exec` and `exec` module
- `execpolicy` and sandboxing
- `apply-patch` module
- `file-search` module
- `core/tools` orchestration

---

### Phase 4: Model Integration & MCP (Split into 4 sub-phases)
**Goal:** LLM communication, multi-provider support, and MCP server integration

**Status:** 🔄 IN PROGRESS

#### [Phase 4.0](./phase-4/) - MCP Foundation ✅ COMPLETE
- mcp-types, ollama/client (57 tests)

#### [Phase 4.1](./phase-4.1/) - OpenAI Client ✅ COMPLETE
- client-common, model-provider-info, stub-auth, chat-completions, client, tool-converters (114 tests)

#### [Phase 4.2](./phase-4.2/) - Anthropic Messages API 🔄 IN PROGRESS
- Add Messages API as third provider (167 tests target)
- **Design:** [MESSAGES_API_INTEGRATION_DESIGN_CODEX.md](../MESSAGES_API_INTEGRATION_DESIGN_CODEX.md)
- 11 stages: types, tool conversion, request builder, SSE parser, streaming adapter, etc.

#### [Phase 4.3](./phase-4.3/) - Backend Services & MCP ⏳ NEXT
- backend-client, chatgpt, rmcp-client, mcp-server, core/mcp (5 modules)

#### [Phase 4.4](./phase-4.4/) - Script Harness Core ⏳ PLANNED
- Script-based tool harness (5 weeks, 14 modules, 40 tests)
- **Design:** [SCRIPT_HARNESS_DESIGN_FINAL.md](../SCRIPT_HARNESS_DESIGN_FINAL.md)
- QuickJS runtime, XML detection, tool facade, promise tracking, approvals

#### [Phase 4.5](./phase-4.5/) - Script Harness Hardening ⏳ PLANNED
- Production hardening (5 weeks, 60 total tests)
- **Design:** [SCRIPT_HARNESS_DESIGN_FINAL.md](../SCRIPT_HARNESS_DESIGN_FINAL.md)
- isolated-vm runtime, tools.spawn, security review, documentation

---

### Phase 5: CLI, Auth & Polish
**Goal:** Complete system with CLI and authentication

**Status:** Not Started

**Key Deliverables:**
- `login` and `keyring-store`
- `core/auth` and `AuthManager`
- `exec/exec_events` (JSONL output)
- `cli` entry point
- `app-server` (IDE integration)
- Platform utilities (git, image, pty)

---

## How to Use This Structure

### Starting a Phase

1. Read `PORT-PLAN.md` for context
2. Read `phase-N/README.md` for detailed requirements
3. Review `phase-N/CHECKLIST.md` for tasks
4. Start working through the checklist

### During a Phase

1. Check off completed items in `CHECKLIST.md`
2. Update `STATUS.md` after each session with:
   - What you completed
   - What's in progress
   - Blockers or decisions
   - Hours spent
3. Record technical decisions in `DECISIONS.md`

### Completing a Phase

1. Verify all checklist items complete
2. Ensure all tests passing
3. Update documentation
4. Write final summary in `STATUS.md`
5. Move to next phase

---

## Phase Dependencies

```
Phase 1 (Protocol)
    ↓
Phase 2 (Core Engine) ← depends on Phase 1
    ↓
Phase 3 (Execution & Tools) ← depends on Phase 2
    ↓
Phase 4 (Model Integration & MCP) ← depends on Phase 2 & 3
    ↓
Phase 5 (CLI, Auth & Polish) ← depends on all previous
```

Each phase builds on the previous, so they must be completed in order.

---

## Success Criteria

Each phase is complete when:
- ✅ All checklist items checked
- ✅ All tests passing (100% pass rate)
- ✅ Integration tests passing
- ✅ Documentation updated
- ✅ No TypeScript errors
- ✅ No linter warnings
- ✅ STATUS.md has final summary
- ✅ Ready for next phase

---

## Getting Help

If you encounter issues:

1. Check `DECISIONS.md` for similar problems
2. Review Rust source code for reference
3. Check existing TS modules for patterns
4. Document the decision in `DECISIONS.md`

---

## Timeline

- Phase 1: 1-2 weeks
- Phase 2: 3 weeks
- Phase 3: 2 weeks
- Phase 4: 2 weeks
- Phase 5: 2 weeks

**Total: ~11 weeks**
