# CODER PROMPT: Service Mock Tests - Slice 5 - Complete Happy Path Suite

**Generated:** 2025-11-24
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`
**Slice:** 5 of 7 (Happy Path Completion)

---

## ROLE

You are a senior TypeScript/Node.js developer completing the **10-test happy path suite** for Core 2.0. Previous slices established infrastructure, persistence, and tool execution. Your focus is fixing the remaining 4 happy path tests.

---

## PROJECT CONTEXT

**Current State:**
- ✅ **Slices 1-4 Complete**: Infrastructure, persistence, tools, test data all working
- ✅ **Tests Passing**: TC-HP-01 through TC-HP-05, TC-HP-08 (6 total)
- ❌ **Tests Failing**: TC-HP-06, TC-HP-07, TC-HP-09, TC-HP-10 (4 remaining)

**Remaining Tests:**
- TC-HP-06: Multi-turn conversation (context preservation)
- TC-HP-07: Usage metrics capture
- TC-HP-09: SSE reconnection with Last-Event-ID
- TC-HP-10: Concurrent turns (no crosstalk)

---

## CURRENT PHASE

**Phase:** Service Mock Tests - Slice 5
**Objective:** Fix remaining 4 happy path tests to achieve 10/10 passing.

**FUNCTIONAL OUTCOME:**
After this slice, all 10 happy path tests pass, validating: basic messages, thinking blocks, tool execution, multi-turn conversations, usage metrics, SSE reconnection, and concurrent turn isolation.

---

## PREREQUISITES

✅ **Previous Slices Complete:**
- Slice 1: Infrastructure stable
- Slice 2: Persistence working
- Slice 3: Tool execution working
- Slice 4: Test data management implemented

✅ **Currently Passing:**
- TC-HP-01: Simple message (OpenAI)
- TC-HP-02: Simple message (Anthropic)
- TC-HP-03: Thinking + message (OpenAI)
- TC-HP-04: Thinking + message (Anthropic)
- TC-HP-05: Tool call + output + message
- TC-HP-08: Simple tool call

---

## TASK SPECIFICATION

### **Task 1: Fix TC-HP-06 (Multi-Turn)** (~30 min)

**What it tests:** Conversation context across multiple runs

**Likely issue:** Second turn doesn't load first turn's history

**Debug approach:**
1. Check if fixture for turn2 includes history from turn1
2. Verify threadId is same for both turns
3. Check if Convex stores both runs under same thread
4. Verify second run's Response includes context

**Possible fix:** MockAdapter might need to accept history parameter for multi-turn fixtures

---

### **Task 2: Fix TC-HP-07 (Usage Metrics)** (~20 min)

**What it tests:** Token usage counts captured and persisted

**Likely issue:** Usage metrics not being extracted from response

**Debug approach:**
1. Check fixture includes usage in response_done event
2. Verify ResponseReducer captures usage
3. Check if Convex schema includes usage fields
4. Verify assertion expects correct usage structure

**Possible fix:** Ensure fixture has valid usage object, verify reducer applies it

---

### **Task 3: Fix TC-HP-09 (SSE Reconnection)** (~45 min)

**What it tests:** Client can reconnect with Last-Event-ID and resume stream

**Likely issue:** Complex - involves partial consumption and reconnection

**Debug approach:**
1. Verify harness.consumeSSE supports partial consumption
2. Check if reconnection with Last-Event-ID works
3. Verify no duplicate events after reconnection
4. Check if stream resumes from correct position

**Possible fix:** May need to enhance consumeSSE to support early termination and resumption

---

### **Task 4: Fix TC-HP-10 (Concurrent Turns)** (~30 min)

**What it tests:** Multiple simultaneous runs don't interfere with each other

**Likely issue:** Event crosstalk or runId confusion

**Debug approach:**
1. Verify each run has unique runId
2. Check Redis streams are separate (different keys)
3. Verify events from run A don't appear in run B
4. Check Convex documents are distinct

**Possible fix:** Should work if runIds are unique - might just be timing issue

---

## WORKFLOW STEPS

1. **Run failing tests individually:**
   ```bash
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-06"
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-07"
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-09"
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-10"
   ```

2. **For each failure, debug:**
   - Read error message carefully
   - Add targeted logging
   - Identify root cause
   - Apply minimal fix

3. **Fix one test at a time:**
   - Fix TC-HP-06
   - Verify it passes
   - Fix TC-HP-07
   - Verify it passes
   - Continue...

4. **Run full happy path suite:**
   ```bash
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts
   ```

5. **Verify 10/10 passing**

6. **Run consistency check:**
   ```bash
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts
   # Run 3 times, all should pass
   ```

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **NO MOCKING** except LLM responses
2. **Fix tests, don't skip them**
3. **One test at a time**
4. **Verify after each fix**

### **INTERRUPT PROTOCOL**

**STOP and ask if:**
- Multi-turn fixture structure is unclear
- SSE reconnection requires harness changes
- Concurrent test failures suggest race conditions
- You need to modify core worker logic

---

## CODE QUALITY STANDARDS

### **Verification Command:**
```bash
npm run format && \
npm run lint && \
npx tsc --noEmit && \
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts
```

**Success:** 10/10 tests passing

---

## EXPECTED OUTCOME

After this session:
- ✅ All 10 happy path tests passing
- ✅ Multi-turn conversations work
- ✅ Usage metrics captured
- ✅ SSE reconnection works
- ✅ Concurrent turns isolated
- ✅ Full suite under 2 minutes
- ✅ Consistent (passes 3 times in a row)

**This completes the happy path validation.** Error handling and edge cases addressed in Slices 6-7.
