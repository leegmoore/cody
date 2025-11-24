# Service-Mocked Tests Recovery Strategy

**Date:** 2025-11-24
**Status:** Recovery Plan
**Context:** Fixing Core 2.0 test suite after tool mocking issues and agent churn

---

## Executive Summary

The Core 2.0 service-mocked test suite (22 tests) is partially broken due to:
1. Tool mocking added despite explicit "no mocks except LLMs" rule
2. Multiple agent attempts to fix introduced regressions
3. Infrastructure issues (environment, imports, worker lifecycle)

**Current Status**: 11/22 passing (infrastructure works, but persistence and tool execution have issues)

**Recovery Approach**: 7 small, supervised slices to restore full functionality without mocking infrastructure or tools.

---

## The Problem History

### **What Happened**

1. **Initial Implementation** (commit 0faa5cbe):
   - Test harness created with MockModelFactory
   - 22 tests written
   - Clean architecture: mock only LLM responses

2. **Integration Bugs Fixed** (commit 2eb06137):
   - Fixed schema, NOGROUP, event ordering issues
   - Got 10/10 happy path tests passing
   - **Identified**: Tool execution mocked in fixtures (function_call_output pre-written)
   - **Created**: UNMOCK-TOOLS-PROMPT.md

3. **"Unmock" Commit** (commit 6efb84b9 - **IRONIC FAILURE**):
   - **Title**: "unmock tool execution"
   - **What it did**: ADDED installMockTools() - mocked tool implementations
   - **Justification**: "for safety - no real fs/shell"
   - **Result**: Violated "no mocks except LLMs" rule
   - **Author**: Claude Code

4. **Phase 5.1 & 5.2** (commits 6c25dc7c, f72d1c1b):
   - Error handling tests: 6/6 passing
   - Edge case tests: 6/6 passing
   - **But**: All with tool mocks present

5. **Discovery & Rejection**:
   - User discovered tool mocking in tests
   - Rejected approach (deleted 2 agents who added tool mocks)
   - Asked Gemini to fix

6. **Gemini's Attempts** (uncommitted):
   - Initially tried to ADD MORE tool mocks (mock-tools.ts)
   - User exploded at Gemini
   - Gemini removed mocks, broke imports during cleanup
   - Added DI pattern for test-specific tools (testToolRegistry)
   - Tests now: 11/22 passing

---

## The Core Philosophy

### **What Service-Mocked Tests Are**

**Mock ONLY the boundaries you can't control:**
- ✅ LLM API responses (OpenAI, Anthropic) - mocked via fixtures
- ❌ Everything else is REAL

**What's REAL in these tests:**
- ✅ Redis (actual localhost:6379 connection)
- ✅ Convex (actual dev server or cloud deployment)
- ✅ Fastify (programmatically started, real HTTP)
- ✅ Workers (PersistenceWorker, ToolWorker actually run)
- ✅ Tool execution (readFile reads real files, exec runs real commands)
- ✅ SSE streaming (real EventSource consumption)
- ✅ Hydration (real ResponseReducer logic)

**Why This Matters:**
- Validates full integration (not isolated units)
- Catches serialization bugs, schema mismatches, race conditions
- Provides high-signal confidence that pipeline actually works
- Mocking infrastructure gives false confidence

---

## Recovery Strategy: 7 Small Slices

### **Why Small Slices**

**After multiple agents introduced problems:**
- Need tight supervision
- Want to catch issues early
- Build confidence incrementally
- Easy to verify each step

**Each slice:**
- 1-2 hour scope
- Clear deliverable
- Verification checkpoint
- Commit point

### **The 7 Slices**

**SLICE 1: Stabilize Infrastructure** (~1-2 hours)
- Fix environment (CONVEX_URL loading)
- Fix imports (restore missing imports)
- Get TC-HP-01 passing 5/5 times
- **Deliverable**: Foundation stable

**SLICE 2: Fix Persistence Worker** (~1-2 hours)
- Debug persistence timeouts
- Fix consumer group management
- Fix reset() bug (line 320)
- **Deliverable**: TC-HP-01 through TC-HP-04 passing (basic messages)

**SLICE 3: Fix Tool Execution** (~2-3 hours)
- Debug ToolWorker execution
- Verify real tools execute
- Get function_call_output emitting
- **Deliverable**: TC-HP-05 and TC-HP-08 passing (tool tests)

**SLICE 4: Test Data Management** (~1-2 hours)
- Create test-data directory
- Setup/teardown test files
- Update fixtures for controlled data
- **Deliverable**: Deterministic tool output

**SLICE 5: Complete Happy Path** (~2-3 hours)
- Fix TC-HP-06 (multi-turn)
- Fix TC-HP-07 (usage metrics)
- Fix TC-HP-09 (SSE reconnection)
- Fix TC-HP-10 (concurrent turns)
- **Deliverable**: 10/10 happy path passing

**SLICE 6: Error Handling Suite** (~2-3 hours)
- Fix slowTool registration (testToolRegistry)
- Validate error test fixtures
- Get 6/6 error tests passing
- **Deliverable**: 16/22 total passing

**SLICE 7: Edge Cases Suite** (~2-3 hours)
- Fix any remaining edge case failures
- Validate stress tests
- **Deliverable**: 22/22 ALL PASSING

---

## Using These Prompts

### **For Each Slice**

1. **Review the prompt** - Read full prompt before starting
2. **Give to fresh coder** - Start new agent session with prompt
3. **Supervise execution** - Watch agent work, catch issues early
4. **Verify deliverable** - Run verification commands
5. **Review report** - Check mocking verification section
6. **Commit if good** - Or iterate if issues found
7. **Move to next slice** - Start next prompt only after current complete

### **Supervision Checklist**

After agent completes each slice:

**Check 1: Mocking Verification**
- [ ] Agent reports what's mocked
- [ ] Only LLM responses mocked
- [ ] No tool implementations mocked
- [ ] No infrastructure mocked

**Check 2: Tests Pass**
- [ ] Verification command succeeds
- [ ] Target tests pass
- [ ] No regressions in previous tests

**Check 3: Code Quality**
- [ ] No diagnostic logging left in code
- [ ] Format, lint, typecheck clean
- [ ] Changes are minimal and focused

**If ANY check fails**: Don't proceed. Fix issues first.

---

## Timeline Estimate

**Optimistic** (everything goes smoothly):
- Slices 1-2: Day 1 (2-4 hours)
- Slices 3-4: Day 2 (3-5 hours)
- Slices 5-6: Day 3 (4-6 hours)
- Slice 7: Day 4 (2-3 hours)
- **Total**: 3-4 days

**Realistic** (some debugging required):
- 1-2 slices per day
- **Total**: 5-7 days

**With issues** (agent struggles, requires guidance):
- Could take 2 weeks
- But incremental progress is visible

---

## Success Criteria

**Final Goal**: 22/22 tests passing with:
- ✅ Real Redis, Real Convex, Real Workers
- ✅ Real tool execution (no mocked implementations)
- ✅ Mocked only LLM API responses
- ✅ Full suite under 5 minutes
- ✅ Consistent (passes 5 times in a row)
- ✅ No diagnostic logging in production code
- ✅ Clean, documented, committed

---

## Anti-Patterns to Watch For

### **Agent Convergent Defaults (Fight These)**

**Pattern 1: "Let me just mock this for now"**
- Agent will want to mock tools "temporarily"
- **Response**: NO. Fix the real issue.

**Pattern 2: "Tests are too strict"**
- Agent will want to weaken assertions
- **Response**: Fix the implementation, not the test.

**Pattern 3: "Need to refactor workers"**
- Agent will suggest large refactors
- **Response**: Minimal fixes only. Refactor later.

**Pattern 4: "Increase timeouts"**
- Agent will want to hide bugs with longer waits
- **Response**: Fix performance issues, don't mask them.

### **Red Flags in Agent Reports**

🚨 "I mocked X temporarily to unblock"
🚨 "Tests are flaky, increased timeout"
🚨 "Refactored worker architecture"
🚨 "Created helper to bypass Y"

**If you see these**: Agent is taking shortcuts. Reject and re-prompt with stronger constraints.

---

## After Recovery: Next Steps

Once 22/22 tests passing:

1. **Smoke Tests** (real APIs):
   - Get 6/6 smoke tests passing
   - Validate real provider behavior
   - Fix any provider-specific issues

2. **UI Migration**:
   - Complete vanilla JS → React migration
   - Use working Core 2.0 as foundation
   - Self-editing feedback loop

3. **Script Harness**:
   - Integrate QuickJS script execution
   - Compositional tool calling
   - Validate innovation thesis

---

## Final Notes

**This is a recovery mission.**

The goal is NOT to build new features. The goal is to **restore test integrity** so we have a reliable foundation for future work.

**Patience and discipline** - Small slices, careful supervision, no shortcuts.

The service-mocked tests are your safety net. Once they're solid, everything else becomes easier.
