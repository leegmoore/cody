# CODER PROMPT: Service Mock Tests - Slice 7 - Edge Cases Suite

**Generated:** 2025-11-24
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`
**Slice:** 7 of 7 (Edge Cases & Stress)

---

## ROLE

You are a senior TypeScript/Node.js developer completing the **6-test edge case suite** for Core 2.0. These tests validate system behavior under stress conditions and edge cases (large payloads, rapid streams, race conditions, schema violations).

---

## PROJECT CONTEXT

**Current State:**
- ✅ **Slices 1-6 Complete**: Happy path (10/10) + Error handling (6/6) passing
- ⏳ **Edge Cases Suite**: 6 tests, some may already pass from recent fixes

**Tests in This Suite:**
- TC-ER-07: Large response (1MB+ streamed content)
- TC-ER-08: Rapid stream (1000 events, zero delay)
- TC-ER-09: Out-of-order events (sequence violation)
- TC-ER-10: High concurrency (50 simultaneous turns)
- TC-ER-11: Thread collision (concurrent turns, same thread)
- TC-ER-12: Schema violations (malformed events)

---

## CURRENT PHASE

**Phase:** Service Mock Tests - Slice 7 (FINAL)
**Objective:** Validate system handles edge cases and stress conditions.

**FUNCTIONAL OUTCOME:**
After this slice, all 22 Core 2.0 service-mocked tests pass (10 happy + 6 error + 6 edge), validating the streaming pipeline is production-ready, handles edge cases gracefully, and performs well under stress.

---

## TASK SPECIFICATION

### **Task 1: Run Edge Case Suite** (~15 min)

```bash
npx vitest run tests/e2e/core-2.0/edge-cases.spec.ts
```

**Check current status:**
- Some tests might already pass (5/6 based on recent TEST_RESULTS.md)
- Identify which tests fail
- Focus on failures

---

### **Task 2: Fix Failing Tests** (~1-2 hours)

**For each failure:**

**TC-ER-07 (Large response):**
- Currently: Timeout on 1MB+ payload
- Likely: Convex document size limit or persistence timeout
- Fix: Verify fixture isn't TOO large, check Convex 1MB limit
- May need: Pagination or chunking for huge responses

**TC-ER-08 (Rapid stream):**
- Should pass: 1000 events with zero delay
- Tests: Event ordering preserved, no dropped events
- If fails: Check buffer handling in StreamHydrator

**TC-ER-09 (Out-of-order):**
- Should: Detect sequence violation and error
- Tests: ResponseReducer catches out-of-order events
- If fails: Check reducer sequence validation

**TC-ER-10 (High concurrency):**
- Should pass: 50 concurrent turns complete
- Tests: No runId collisions, no event crosstalk
- If fails: Might be timing/resource issue

**TC-ER-11 (Thread collision):**
- Should pass: Same threadId, different turnIds
- Tests: Both persist correctly, distinct runs
- If fails: Check thread/run relationship in Convex

**TC-ER-12 (Schema violations):**
- Should: Catch invalid events, emit error
- Tests: MockAdapter validates against schema
- If fails: Check Zod validation in adapter

---

## WORKFLOW STEPS

1. **Run suite, identify failures**
2. **For each failure:**
   - Debug with logging
   - Identify root cause
   - Apply minimal fix
   - Verify passes
3. **Run full suite:**
   ```bash
   npx vitest run tests/e2e/core-2.0/
   ```
4. **Verify 22/22 passing**
5. **Run final consistency check**
6. **Remove all diagnostic logging**
7. **Clean commit**

---

## WORKFLOW RULES

1. **NO MOCKING** except LLM responses
2. **Fix edge cases, don't skip tests**
3. **Performance issues = real fixes, not higher timeouts**

---

## CODE QUALITY STANDARDS

### **Final Verification:**
```bash
npm run format && \
npm run lint && \
npx tsc --noEmit && \
npx vitest run tests/e2e/core-2.0/
```

**Success:** 22/22 tests passing

---

## EXPECTED OUTCOME

After this session:
- ✅ 22/22 tests passing (10 happy + 6 error + 6 edge)
- ✅ Full suite under 5 minutes
- ✅ No flaky tests (passes 3 times in a row)
- ✅ All diagnostic logging removed
- ✅ Production-ready test suite

**SERVICE-MOCKED TEST SUITE COMPLETE**

**Final Validation:**
- [ ] NO infrastructure mocking (only LLM responses)
- [x] Real Redis, Real Convex, Real workers
- [x] Real tool execution
- [ ] If ANY mocking exists beyond LLM, disclose in report

This completes the Core 2.0 service-mocked test validation. Smoke tests (real APIs) can proceed separately.
