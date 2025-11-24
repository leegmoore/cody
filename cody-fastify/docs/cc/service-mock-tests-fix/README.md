# Service-Mocked Tests Recovery - Quick Reference

**Purpose:** Restore Core 2.0 service-mocked test suite to 22/22 passing with real infrastructure

---

## Current Status

**Tests**: 11 passed / 11 failed (22 total)
**Issue**: Tool mocking, persistence timeouts, worker issues
**Goal**: 22/22 passing with ONLY LLM mocking

---

## Prompt Execution Order

Execute these prompts in sequence. Complete each slice before proceeding to next.

### **00-RECOVERY-STRATEGY.md**
Read first - explains the problem, philosophy, and approach

### **01-STABILIZE-INFRASTRUCTURE.md** ⭐ START HERE
- **Goal**: TC-HP-01 passing 5/5 times
- **Fixes**: Environment, imports, basic connectivity
- **Time**: 1-2 hours
- **Target**: 1 test passing reliably

### **02-FIX-PERSISTENCE-WORKER.md**
- **Goal**: TC-HP-01 through TC-HP-04 passing
- **Fixes**: Persistence timeouts, NOGROUP errors, reset() bug
- **Time**: 1-2 hours
- **Target**: 4 tests passing (basic messages)

### **03-FIX-TOOL-EXECUTION.md**
- **Goal**: TC-HP-05 and TC-HP-08 passing
- **Fixes**: ToolWorker execution, real tool output
- **Time**: 2-3 hours
- **Target**: 6 tests passing (adds tool tests)

### **04-TEST-DATA-MANAGEMENT.md**
- **Goal**: Deterministic tool output
- **Fixes**: Controlled test data, setup/teardown
- **Time**: 1-2 hours
- **Target**: Same 6 tests but deterministic

### **05-COMPLETE-HAPPY-PATH.md**
- **Goal**: 10/10 happy path tests
- **Fixes**: Multi-turn, usage metrics, reconnection, concurrency
- **Time**: 2-3 hours
- **Target**: 10 tests passing

### **06-ERROR-HANDLING-SUITE.md**
- **Goal**: 16/22 total (adds 6 error tests)
- **Fixes**: Error scenarios, slowTool registration
- **Time**: 2-3 hours
- **Target**: 16 tests passing

### **07-EDGE-CASES-SUITE.md**
- **Goal**: 22/22 ALL PASSING ✅
- **Fixes**: Large payloads, stress tests, race conditions
- **Time**: 2-3 hours
- **Target**: Complete test suite

---

## Execution Pattern

For each slice:

```bash
# 1. Review prompt
cat docs/cc/service-mock-tests-fix/01-STABILIZE-INFRASTRUCTURE.md

# 2. Start fresh agent session with prompt

# 3. Monitor execution

# 4. Verify deliverable
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"

# 5. Check agent's report
# - What's mocked? (should be ONLY LLMs)
# - Tests passing?
# - Any concerns?

# 6. If good, commit
git add -A
git commit -m "fix(test): Slice 1 complete - infrastructure stable"

# 7. Move to next slice
```

---

## Critical Checkpoints

After **EACH** slice, verify:

### ✅ **Mocking Verification**
- [ ] Agent reports what's mocked
- [ ] ONLY LLM responses mocked
- [ ] NO tool implementations mocked
- [ ] NO infrastructure (Redis, Convex, workers) mocked

### ✅ **Test Results**
- [ ] Target tests passing
- [ ] No regressions in previous tests
- [ ] Consistent (passes multiple times)

### ✅ **Code Quality**
- [ ] Format, lint, typecheck clean
- [ ] No diagnostic logging left
- [ ] Changes minimal and focused

**If ANY checkpoint fails**: Stop. Fix before next slice.

---

## Red Flags - Stop Immediately If:

🚨 Agent says: "I'll mock X temporarily"
🚨 Agent creates: installMockTools, mockToolRegistry, mockWorker, etc.
🚨 Agent suggests: "Increase timeouts to fix flaky tests"
🚨 Agent proposes: Major refactoring of workers
🚨 Tests pass but agent won't confirm what's mocked

**Action**: Reject work, re-prompt with stronger "NO MOCKING" emphasis

---

## Timeline

**Optimistic**: 3-4 days (1-2 slices per day)
**Realistic**: 5-7 days (with debugging)
**With Issues**: 2 weeks (if agents struggle)

**Progress is incremental** - each slice adds value even if full recovery takes time.

---

## Success Definition

**Done when:**
- ✅ 22/22 tests passing
- ✅ Full suite under 5 minutes
- ✅ Passes 5 times consecutively (no flakes)
- ✅ Only LLM responses mocked
- ✅ All code clean (no debug logging)
- ✅ Documented (TEST_RESULTS.md updated)

**Then proceed to**: Smoke tests (real APIs), UI migration, Script Harness integration
