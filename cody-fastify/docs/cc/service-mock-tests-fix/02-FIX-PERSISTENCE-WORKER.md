# CODER PROMPT: Service Mock Tests - Slice 2 - Fix Persistence Worker

**Generated:** 2025-11-24
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`
**Slice:** 2 of 7 (Persistence)

---

## ROLE

You are a senior TypeScript/Node.js developer fixing **PersistenceWorker integration issues** in the Core 2.0 test suite. Your focus is resolving timeout errors where events stream correctly but Convex persistence fails or is too slow.

---

## PROJECT CONTEXT

**Cody Core 2.0** streaming architecture with Redis → PersistenceWorker → Convex pipeline.

**Current State:**
- ✅ **Slice 1 Complete**: TC-HP-01 passes consistently (infrastructure stable)
- ✅ Environment configured (CONVEX_URL loaded)
- ✅ Imports fixed (tests load without errors)
- ⚠️ **Persistence Issues**: 7 tests timeout waiting for Convex writes
- ❌ PersistenceWorker not saving OR waitForPersisted timeout too short
- ❌ NOGROUP errors appearing in worker logs

---

## CURRENT PHASE

**Phase:** Service Mock Tests - Slice 2
**Objective:** Fix PersistenceWorker so events flowing through Redis are reliably saved to Convex within test timeframes.

**FUNCTIONAL OUTCOME:**
After this slice, TC-HP-01 through TC-HP-04 (basic message tests + thinking blocks) pass consistently, demonstrating that the full event pipeline (MockAdapter → Redis → PersistenceWorker → Convex → SSE → Hydration) works reliably.

---

## PREREQUISITES

✅ **Slice 1 Complete:**
- TC-HP-01 passing 5/5 times
- Environment configured
- Imports fixed
- Basic infrastructure verified

✅ **Current Test Status** (from Slice 1):
- TC-HP-01: ✅ PASSING (simple message OpenAI)
- TC-HP-02 to TC-HP-07: ❌ TIMEOUT (persistence issues)
- TC-HP-08 to TC-HP-10: ❌ VARIOUS (defer to Slice 3)

---

## KNOWN ISSUES

**Issue 1: Persistence Timeouts** (CRITICAL)
- **Error**: "Timed out waiting for persisted response for {runId}"
- **Tests affected**: TC-HP-02, TC-HP-03, TC-HP-04, TC-HP-05, TC-HP-06, TC-HP-07
- **Symptoms**:
  - SSE stream completes (events delivered to test)
  - Hydration succeeds (Response object built)
  - But Convex query returns null
  - waitForPersisted times out after 10s
- **Possible causes**:
  1. PersistenceWorker not consuming events from Redis
  2. Consumer group issues (NOGROUP errors)
  3. Convex write failing silently
  4. Worker consuming but not persisting intermediate states

**Issue 2: NOGROUP Errors** (HIGH)
- **Error**: "NOGROUP No such key or consumer group 'codex-projector-group'"
- **When**: During xautoclaim operations
- **Impact**: Worker might skip events or crash consume loop
- **Root cause**: Consumer groups deleted with streams, not recreated before worker reads

**Issue 3: reset() Bug** (MEDIUM)
- **Location**: `tests/harness/core-harness.ts` line 320
- **Bug**: New ToolWorker created without passing `this.scriptToolRegistry`
- **Impact**: After reset(), test-specific tools (like slowTool) not available
- **Current code**:
  ```typescript
  this.toolWorker = new ToolWorker(this.toolWorkerOptions); // Missing param!
  ```

---

## TASK SPECIFICATION

### **Task 1: Debug Persistence Flow** (~45 min)

**Add diagnostic logging to trace event flow:**

**File:** `src/workers/persistence-worker.ts`

Add logging at key points (temporary, for debugging):
```typescript
// In consumeLoop after reading events
console.log(`[projector] Consumed ${messages.length} events for stream ${streamKey}`);

// Before Convex write
console.log(`[projector] Writing snapshot for runId=${response.id}, status=${response.status}`);

// After successful write
console.log(`[projector] Persisted runId=${response.id} to Convex`);
```

**Run TC-HP-02** (should fail with timeout):
```bash
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-02"
```

**Check logs for**:
- Are events being consumed?
- Is snapshot being written?
- Are there errors during Convex write?

---

### **Task 2: Fix Consumer Group Management** (~45 min)

**Problem:** NOGROUP errors indicate consumer groups don't exist when workers try to claim.

**File:** `tests/harness/core-harness.ts`

**Current reset() method** (lines 279-322):
```typescript
async reset(): Promise<void> {
  await this.worker?.stop();
  await this.toolWorker?.stop();

  const redis = await RedisStream.connect();
  try {
    await this.deleteAllRunStreams(redis);
    // Groups are deleted with streams
  } finally {
    await redis.close();
  }

  // ... Convex cleanup ...

  // Recreate workers
  this.worker = new PersistenceWorker(this.workerOptions);
  await this.worker.start();

  this.toolWorker = new ToolWorker(this.toolWorkerOptions); // BUG: missing param
  await this.toolWorker.start();
}
```

**Fix 1: Pass scriptToolRegistry to ToolWorker**
```typescript
this.toolWorker = new ToolWorker(
  this.toolWorkerOptions,
  this.scriptToolRegistry  // ← ADD THIS
);
```

**Fix 2: Add worker initialization delay**
```typescript
await this.worker.start();
await this.toolWorker.start();

// Give workers time to initialize consumer groups
await sleep(200);
```

**Verify consumer groups exist:**
```bash
# After harness.setup(), check Redis
redis-cli XINFO GROUPS "codex:run:*:events"
# Should show codex-projector-group exists
```

---

### **Task 3: Verify Persistence Working** (~30 min)

**Run TC-HP-01 through TC-HP-04** (basic message tests):

```bash
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-0[1-4]"
```

**Expected Results:**
- ✅ All 4 tests pass
- ✅ No timeout errors
- ✅ No NOGROUP errors in logs
- ✅ Convex queries return Response objects
- ✅ Each test under 10s

**Debug if fails:**
1. Check worker logs for persistence success
2. Query Convex directly during test
3. Check Redis stream still has events after worker consumes
4. Verify XACK is being called (events acknowledged)

---

## WORKFLOW STEPS

1. **Add Diagnostic Logging**
   - Add console.log to persistence-worker.ts
   - Run TC-HP-02 and observe logs

2. **Fix reset() Bug**
   - Edit core-harness.ts line 320
   - Add scriptToolRegistry parameter
   - Add 200ms delay after worker starts

3. **Test Persistence Pipeline**
   ```bash
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-0[1-4]"
   ```

4. **Verify No NOGROUP Errors**
   - Check test output logs
   - Should see clean worker logs

5. **Run Consistency Check**
   ```bash
   for i in {1..3}; do
     npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-0[1-4]"
   done
   ```

6. **Remove Diagnostic Logging**
   - Clean up console.log statements
   - Keep code production-clean

7. **Document and Commit**

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **NO MOCKING** except LLM responses
   - Worker must be real PersistenceWorker
   - Redis must be real connection
   - Convex must be real client
   - This is absolute

2. **Fix bugs, don't work around them**
   - If worker not persisting, fix the worker
   - Don't increase timeouts to hide problems
   - Don't mock Convex to "make tests pass"

3. **Minimal changes to production code**
   - Only modify if required for fix
   - Don't refactor workers "while we're here"
   - Keep changes focused and justified

### **INTERRUPT PROTOCOL**

**STOP and ask if:**
- PersistenceWorker code needs significant changes
- Consumer group management is unclear
- Convex writes are failing with unclear errors
- You need to modify core streaming logic

**DO NOT:**
- Mock Convex client
- Mock PersistenceWorker
- Skip persistence by mocking waitForPersisted
- Increase timeouts to hide bugs (fix bugs instead)

---

## CODE QUALITY STANDARDS

### **Verification Command:**
```bash
npm run format && \
npm run lint && \
npx tsc --noEmit && \
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-0[1-4]"
```

**Success Criteria:**
- All commands pass
- 4/4 tests passing
- No timeout errors
- No NOGROUP errors

---

## SESSION COMPLETION CHECKLIST

1. ✅ **Run verification command**
2. ✅ **Run consistency check** (3 consecutive passes of TC-HP-01 through 04)
3. ✅ **Remove diagnostic logging** (clean up console.log statements)
4. ✅ **Update TEST_RESULTS.md**
5. ✅ **Commit with descriptive message**
6. ✅ **Submit completion report** (use format from Slice 1 prompt)

---

## STARTING POINT

**BEGIN by:**
1. Adding diagnostic logging to persistence-worker.ts
2. Running TC-HP-02 to observe logs
3. Identifying why persistence fails or is slow
4. Applying fixes based on observations

---

## EXPECTED OUTCOME

After this session:
- ✅ TC-HP-01 through TC-HP-04 pass consistently (4/4)
- ✅ PersistenceWorker reliably saves to Convex
- ✅ No persistence timeouts
- ✅ No NOGROUP errors
- ✅ reset() bug fixed (line 320)

**Remaining work for later slices:**
- Tool execution (TC-HP-05, TC-HP-08) - Slice 3
- Multi-turn, usage, concurrent tests - Slice 4-5
- Error handling suite - Slice 6
- Edge cases suite - Slice 7

Focus on persistence. Get the core pipeline solid.
