# Phase 1: Decisions Log

**Phase:** 1 - Basic Chat Flow
**Purpose:** Track implementation decisions made during phase execution

---

## Decision Format

For each significant choice, log:
- **Decision:** What was decided
- **Rationale:** Why this approach
- **Alternatives:** What else was considered
- **Date:** When decided

---

## Decisions

**Decision:** Load failures for `~/.codex/config.toml` are treated as configuration errors instead of silently falling back to defaults.
**Rationale:** Phase 1 focuses on verifying wiring, so surfacing misconfiguration early keeps debugging clear and matches the manual test expectations.
**Alternatives:** Auto-create a default config or fall back to environment variables entirely.
**Date:** 2025-11-10

---

**Decision:** Active conversations are kept in-memory for the lifecycle of a single CLI process.
**Rationale:** Resume-from-rollout isn’t implemented yet, so persisting conversations across separate `cody` invocations would require unported features. Keeping state in-process lets us validate the manager/Codex/session chain now and unblock later phases.
**Alternatives:** Stub out file-based persistence or attempt to rehydrate conversations from JSONL rollouts.
**Date:** 2025-11-10

---

**Decision:** The CLI now instantiates the real OpenAI Responses client (Phase 4.1) instead of mocks and always supplies an API key via CodexAuth.
**Rationale:** Manual chats must exercise the actual Responses API; mocks are only appropriate for mocked-service tests. Wiring the concrete client surfaced the HTTP call path for future provider work.
**Alternatives:** Continue returning the placeholder `ModelClient` (no network) or gate the HTTP path behind flags.
**Date:** 2025-11-10

---

**Decision:** Switched the project to NodeNext module resolution and normalized all relative imports to explicit `.js` extensions so the `tsc` build emits runnable ESM.
**Rationale:** Without NodeNext semantics, the compiled CLI referenced bare specifiers like `../protocol/protocol`, which Node refused to load. Normalizing the imports keeps the emitted code executable and matches how the runtime resolves modules.
**Alternatives:** Maintain old Node module resolution and accept broken builds, or rely on bundlers to rewrite paths at build time.
**Date:** 2025-11-10

---

**Decision:** Introduced a `Conversation` wrapper that exposes `sendMessage()` and `nextEvent()` instead of letting callers touch `CodexConversation` directly.
**Rationale:** The CLI and mocked-service tests now depend on a stable high-level API and no longer need to reason about low-level submission operations.
**Alternatives:** Continue exposing `CodexConversation` publicly and duplicate op-building logic in every caller.
**Date:** 2025-11-11

---

**Decision:** Added a `cody repl` command as the supported entry point so conversation creation and chat happen inside a single long-running process.
**Rationale:** Sharing state across separate invocations would require full “resume from rollout” support. The REPL keeps the conversation manager alive and satisfies the Phase 1 requirement without persisting complex state.
**Alternatives:** Persist active conversation metadata to disk and implement true resume support.
**Date:** 2025-11-11

---
