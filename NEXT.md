# NEXT.md - Work Queue

**Last Updated:** 2025-11-25

The prioritized backlog. What's coming after the current slice.

---

## Queue

### 1. Complete Process Foundation (CURRENT)
**Status:** In Progress
**What:** Finish refining process docs, build out tools, create slash commands
**Done when:**
- TOOLS.md implementation complete (slash commands created)
- Beads initialized and tested
- Process docs stable enough to use for real work

### 2. Test Infrastructure Recovery
**Status:** Blocked by #1
**Problem:** Test harness was corrupted. Service mocks change behavior. Don't trust test results.
**Decision needed:** E2E only? Re-scaffold mocks? Audit and fix?
**Approach:**
1. Audit `tests/harness/core-harness.ts` for scaffold corruption
2. Document what's actually being mocked vs. what should be real
3. Decide strategy: clean up mocks OR go E2E-only
4. Implement chosen strategy
5. Verify tests are testing real behavior

**Could use beads:** Epic with subtasks

### 3. Model/Provider Configuration
**Status:** Blocked by #2 (want stable tests first)
**Problem:** No clean way to specify model at runtime
**Scope:**
- Submit endpoint accepts model/provider params
- UI selector for model choice
- Config system for defaults
- Validation of model/provider combinations

### 4. Thinking Display in UI
**Status:** Blocked by #2
**Problem:** Reasoning blocks not rendering
**Scope:** UI changes only - adapters already produce `reasoning` OutputItems
**Likely small:** Just wire up the UI to display them

### 5. UI Framework Migration
**Status:** Future (after #2-4 stable)
**Problem:** Vanilla JS hitting complexity ceiling
**Decision needed:** React? Next.js? Something else?
**Scope:** Major - rebuild UI layer

---

## Discovered Work (Captured, Not Scheduled)

Items found during other work. Will be scheduled when appropriate.

*None yet - use this section to capture things found but not immediately actionable*

---

## Completed

Items moved here when done, with date and brief outcome.

*None yet*

---

## Notes

- Queue order based on dependencies and risk
- Test infrastructure is blocking because we can't verify other work without trustworthy tests
- Process work is blocking because we need stable process to do test infrastructure well
- UI migration is last because it's high effort and current UI is functional
