# CODER PROMPT: Core 2.0 Integration Bug Fixes

**Generated:** 2025-01-22
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`

---

## ROLE

You are a senior TypeScript/Node.js developer fixing **integration bugs** in the Core 2.0 streaming architecture. The test harness is built and running. All 10 tests are failing, exposing real bugs in the v2 implementation. Your job is to systematically fix these bugs until tests pass.

---

## PROJECT CONTEXT

**Cody Core 2.0** streaming pipeline has been implemented but never validated end-to-end. A comprehensive test harness now exists with 10 happy path tests. All tests are **currently failing**, which is expected - they're exposing integration bugs that need fixing.

**What Works:**
- ✅ Test harness infrastructure (factory, mocks, hydrator)
- ✅ 10 test conditions implemented
- ✅ 12 fixture files created
- ✅ Tests execute and connect to real Redis/Convex/Fastify

**What's Broken:**
- ❌ Tests failing due to v2 implementation bugs
- ❌ Schema validation errors
- ❌ Consumer group setup issues
- ❌ Event ordering problems

---

## CURRENT PHASE

**Phase:** Core 2.0 Integration Bug Fixes
**Objective:** Fix v2 implementation bugs until all 10 happy path tests pass

**FUNCTIONAL OUTCOME:**
After this phase, all 10 tests pass cleanly, proving the Core 2.0 streaming pipeline works end-to-end for: basic messages, thinking blocks, tool calls, multi-turn conversations, usage metrics, SSE reconnection, and concurrent turns.

---

## PREREQUISITES

✅ **Test Harness Complete:**
- Factory pattern with DI
- MockStreamAdapter replaying fixtures
- Core2TestHarness managing lifecycle
- StreamHydrator consuming SSE
- 10 tests implemented

✅ **Test Execution:**
- Command: `npx vitest run tests/e2e/core-2.0/happy-path.spec.ts`
- Result: 10/10 failing
- Duration: ~60 seconds

✅ **Local Environment:**
- Redis running on localhost:6379
- Convex dev server running
- Fastify can start on random port

---

## STATE LOADING (READ THESE FIRST)

### FIRST: Understand the Current Failures

1. **Run Tests and Capture Output:**
   ```bash
   cd /Users/leemoore/code/codex-port-02/cody-fastify
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts > test-output.txt 2>&1
   ```

2. **Analyze Test Output:**
   - Identify the 3 primary error patterns
   - Note which tests fail with which errors
   - Understand the root causes

### THEN: Review Implementation

3. **Test Harness Code:**
   - `tests/harness/core-harness.ts` - Understand harness lifecycle
   - `tests/mocks/mock-stream-adapter.ts` - Understand fixture replay
   - `tests/fixtures/openai/simple-message.json` - Review fixture format

4. **V2 Core Implementation:**
   - `src/core/schema.ts` - Review StreamEvent and Response schemas
   - `src/core/reducer.ts` - Review event application logic
   - `src/workers/persistence-worker.ts` - Review worker setup and processing
   - `src/core/redis.ts` - Review Redis stream operations

5. **Architecture Docs:**
   - `docs/codex-core-2.0-tech-design.md` - Review intended design
   - `docs/gem/test-conditions-v2-happy-path.md` - Review test expectations

---

## KNOWN ISSUES (From Test Run)

Based on the test output, there are **3 primary bug categories** to fix:

### **Bug 1: Invalid UUID Format in Fixtures**

**Error:**
```
ZodError: Invalid UUID
path: ["payload", "item_id"]
pattern: /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|...
```

**Root Cause:**
- Fixture `item_id` values are using short strings like "msg_001" or "item_msg1"
- Schema expects valid UUID format
- Zod validation correctly rejecting malformed IDs

**Files Affected:**
- All fixture files in `tests/fixtures/openai/*.json`
- All fixture files in `tests/fixtures/anthropic/*.json`

**Fix Options:**

**Option A: Relax Schema (Recommended)**
```typescript
// src/core/schema.ts
// Change item_id from z.string().uuid() to z.string()
item_id: z.string(), // Was: z.string().uuid()
```

**Reasoning:** Real OpenAI API doesn't enforce UUID format for item_id. Our schema is overly strict.

**Option B: Fix Fixtures**
- Replace all "msg_001" with valid UUIDs
- More work, less realistic

**Recommendation:** Use Option A. The schema should match real API behavior.

---

### **Bug 2: Redis Consumer Group Not Created**

**Error:**
```
NOGROUP No such key 'codex:run:...:events' or consumer group 'codex-projector-group'
```

**Root Cause:**
- PersistenceWorker tries to XREADGROUP on a stream
- Consumer group `codex-projector-group` doesn't exist yet
- Redis requires explicit consumer group creation via XGROUP CREATE

**Files Affected:**
- `src/workers/persistence-worker.ts` (worker startup)
- `tests/harness/core-harness.ts` (harness setup)

**Fix:**

Add consumer group creation to harness setup:

```typescript
// tests/harness/core-harness.ts - in setup() method

async setup(): Promise<void> {
  // ... existing setup code ...

  // Create consumer group for persistence worker
  const redis = await createRedisClient('redis://localhost:6379');

  try {
    // Create group (will error if already exists, that's OK)
    await redis.xgroup('CREATE', 'codex-events', 'codex-projector-group', '0', 'MKSTREAM');
  } catch (err) {
    // Ignore BUSYGROUP error (group already exists)
    if (!err.message?.includes('BUSYGROUP')) {
      throw err;
    }
  }

  await redis.quit();

  // ... start worker ...
}
```

**OR:** Fix in PersistenceWorker to auto-create group on startup.

**Recommendation:** Fix in harness setup (simpler, isolated to tests).

---

### **Bug 3: Event Ordering - response_start Missing or Out of Order**

**Error:**
```
Error: Reducer received event before response_start
at ResponseReducer.ensureResponse
```

**Root Cause:**
- ResponseReducer requires response_start as FIRST event
- Either MockAdapter isn't emitting response_start
- OR events are arriving out of order
- OR worker is processing events from previous test run

**Files Affected:**
- `tests/mocks/mock-stream-adapter.ts` (event emission)
- `tests/fixtures/**/*.json` (fixture event order)
- `tests/harness/core-harness.ts` (cleanup between tests)

**Fix:**

**Step 1: Verify Fixtures Have response_start First**

Check each fixture JSON:
```json
{
  "chunks": [
    "data: {\"type\":\"response_start\",\"response_id\":\"...\"}\n\n", // ← MUST be first
    "data: {\"type\":\"item_start\",...}\n\n",
    // ...
  ]
}
```

**Step 2: Ensure MockAdapter Emits in Order**

Review `MockStreamAdapter.stream()`:
- Verify it emits chunks sequentially (not parallel)
- Verify it waits for Redis XADD to complete before next chunk
- Verify no race conditions

**Step 3: Fix Worker State Between Tests**

The worker might be processing old events. Ensure `harness.reset()` cleans up:

```typescript
// tests/harness/core-harness.ts - reset() method

async reset(): Promise<void> {
  // Stop worker to prevent processing old events
  await this.worker?.stop();

  // Clear Redis streams
  const redis = await createRedisClient('redis://localhost:6379');
  const keys = await redis.keys('codex:run:*:events');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  await redis.quit();

  // Restart worker with clean state
  this.worker = new PersistenceWorker();
  await this.worker.start();
}
```

---

## TASK SPECIFICATION

Fix the bugs in priority order:

### **Task 1: Fix UUID Validation (EASY - 5 min)**

**File:** `src/core/schema.ts`

**Change:**
```typescript
// Find item_id field definition (likely in OutputItemSchema or similar)
// Change from:
item_id: z.string().uuid()

// To:
item_id: z.string()
```

**Verify:**
```bash
npx tsc --noEmit  # Should compile
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts  # Re-run tests
```

**Expected:** UUID errors should disappear, may reveal next layer of errors.

---

### **Task 2: Fix Consumer Group Setup (MEDIUM - 30 min)**

**File:** `tests/harness/core-harness.ts`

**Add to `setup()` method:**

```typescript
async setup(): Promise<void> {
  // ... existing code ...

  // Create consumer group BEFORE starting worker
  const redis = await createRedisClient(process.env.REDIS_URL || 'redis://localhost:6379');

  try {
    // MKSTREAM creates stream if it doesn't exist
    await redis.xgroup('CREATE', 'codex-events', 'codex-projector-group', '0', 'MKSTREAM');
  } catch (err: any) {
    // Group already exists - that's fine
    if (!err.message?.includes('BUSYGROUP')) {
      console.warn('Consumer group creation warning:', err.message);
    }
  }

  await redis.quit();

  // NOW start worker (group exists)
  this.worker = new PersistenceWorker();
  await this.worker.start();
}
```

**Verify:**
```bash
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts
```

**Expected:** NOGROUP errors should disappear.

---

### **Task 3: Fix Event Ordering (HARD - 1-2 hours)**

This is a multi-part investigation and fix.

**Step 3a: Verify Fixture Event Order**

Check EVERY fixture file:
```bash
# Verify first chunk in each fixture is response_start
grep -A1 '"chunks"' tests/fixtures/**/*.json | grep response_start
```

If any fixture is missing response_start as first event, fix it.

**Step 3b: Verify MockAdapter Sequential Emission**

Review `tests/mocks/mock-stream-adapter.ts`:

```typescript
async stream(params) {
  const streamKey = `codex:run:${params.runId}:events`;

  for (const chunk of fixture.chunks) {
    // Parse chunk
    const event = parseSSEChunk(chunk);

    // Emit to Redis
    await this.redis.xadd(streamKey, event);  // ← MUST await

    // Optional delay
    if (simulateStreaming) {
      await sleep(5);
    }
  }
}
```

**Verify:** Each XADD completes before next one starts (no parallel emission).

**Step 3c: Fix Worker State Reset**

Update `harness.reset()` to fully reset worker state:

```typescript
async reset(): Promise<void> {
  // Stop worker
  if (this.worker) {
    await this.worker.stop();
  }

  // Clear ALL Redis keys for this test
  const redis = await createRedisClient('redis://localhost:6379');
  const streamKeys = await redis.keys('codex:run:*:events');

  if (streamKeys.length > 0) {
    await redis.del(...streamKeys);
  }

  // Clear consumer group pending list
  try {
    await redis.xgroup('DESTROY', 'codex-events', 'codex-projector-group');
    await redis.xgroup('CREATE', 'codex-events', 'codex-projector-group', '0', 'MKSTREAM');
  } catch (err) {
    // Ignore errors
  }

  await redis.quit();

  // Restart worker with completely clean state
  this.worker = new PersistenceWorker();
  await this.worker.start();

  // Clear tracked runIds
  this.activeRunIds.clear();
}
```

**Verify:**
```bash
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts
```

**Expected:** "event before response_start" errors should disappear.

---

### **Task 4: Iterative Bug Fixing**

After fixing the 3 primary bugs, re-run tests:

```bash
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts
```

**If still failing:**
1. Document NEW error patterns
2. Identify root cause
3. Fix
4. Re-run
5. Repeat until all 10 tests pass

**Common issues to watch for:**
- SSE stream timeout (increase timeout in StreamHydrator)
- Convex query returning null (worker hasn't persisted yet - add retry)
- Event schema mismatches (fixture events don't match schema)
- Race conditions (events published before worker starts listening)

---

## WORKFLOW STEPS

1. **Fix UUID validation** (Task 1)
2. **Verify fix:** Run tests, capture new output
3. **Fix consumer group** (Task 2)
4. **Verify fix:** Run tests, capture new output
5. **Fix event ordering** (Task 3)
6. **Verify fix:** Run tests, capture new output
7. **Iterate on remaining failures** (Task 4)
8. **Update TEST_RESULTS.md** with final status
9. **Commit fixes**

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **Fix implementation bugs, not test code**
   - Don't modify test assertions to make tests pass
   - Don't modify harness to hide bugs
   - Don't skip failing tests
   - Fix the actual v2 implementation issues

2. **One bug category at a time**
   - Fix UUID validation first (easiest)
   - Then consumer group (medium)
   - Then event ordering (hardest)
   - Run tests after each fix to verify progress

3. **Document all fixes**
   - Update TEST_RESULTS.md after each fix
   - Show before/after test counts
   - Explain what was broken and how you fixed it

4. **Maintain model constraints**
   - Don't change model strings in fixtures
   - Use ONLY: gpt-5-mini, gpt-5-codex, claude-haiku-4.5, claude-sonnet-4.5

5. **Keep fixtures realistic**
   - Don't simplify fixtures to make tests pass
   - Fixtures should match real API behavior
   - If schema is wrong, fix schema (not fixtures)

### **INTERRUPT PROTOCOL**

**STOP and ask if:**
- Tests still failing after fixing all 3 known bugs
- New error patterns emerge that you can't diagnose
- Fixes require major refactoring (> 100 lines in single file)
- Unsure whether to fix schema vs fixtures vs implementation

**DO NOT:**
- Skip tests or mark as `.skip`
- Mock additional infrastructure to make tests pass
- Simplify Response schema or remove fields
- Add delays/retries to hide race conditions (fix the race, don't mask it)

---

## DEBUGGING GUIDANCE

### **For UUID Validation Errors:**

```bash
# Find all item_id field definitions
grep -r "item_id.*uuid" src/core/schema.ts

# Check what format fixtures are using
grep -A5 '"item_id"' tests/fixtures/openai/simple-message.json
```

---

### **For Consumer Group Errors:**

```bash
# Check if consumer group exists
redis-cli XINFO GROUPS codex-events

# Check stream keys
redis-cli KEYS "codex:run:*"

# Check if worker is trying to read before stream exists
# (Add logging to persistence-worker.ts)
```

---

### **For Event Ordering Errors:**

```bash
# Verify first event in fixture
node -e "const f = require('./tests/fixtures/openai/simple-message.json'); console.log(f.chunks[0])"

# Check Redis event order
redis-cli XRANGE codex:run:{runId}:events - + COUNT 5

# Add logging in MockStreamAdapter to verify emission order
# Add logging in ResponseReducer to see what event it receives first
```

---

## CODE QUALITY STANDARDS

### **Mandatory Quality Gates:**

- ✅ TypeScript: Zero errors (`npx tsc --noEmit`)
- ✅ ESLint: Zero errors (`npm run lint`)
- ✅ Tests: All 10 passing (`npx vitest run tests/e2e/core-2.0/happy-path.spec.ts`)
- ✅ No skipped tests
- ✅ No test.only or describe.only

### **Verification Command:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npx vitest run tests/e2e/core-2.0/happy-path.spec.ts
```

**This command must succeed with 10/10 tests passing before declaring phase complete.**

---

## SESSION COMPLETION CHECKLIST

### **Before ending session:**

1. ✅ **Run full verification command**
   ```bash
   npm run format && npm run lint && npx tsc --noEmit && npx vitest run tests/e2e/core-2.0/happy-path.spec.ts
   ```

2. ✅ **Update TEST_RESULTS.md:**
   ```markdown
   # Core 2.0 Integration Test Results

   **Date:** 2025-01-22
   **Phase:** Bug Fixes - Phase 4

   ## Test Status: X/10 Passing

   | Test | Status | Notes |
   |------|--------|-------|
   | TC-HP-01 | ✅ PASS | Fixed UUID validation |
   | TC-HP-02 | ✅ PASS | - |
   | ... | ... | ... |

   ## Bugs Fixed

   1. **UUID Validation** - Relaxed schema to accept non-UUID item_id
   2. **Consumer Group** - Added group creation in harness setup
   3. **Event Ordering** - Fixed MockAdapter sequential emission

   ## Remaining Issues

   (List any tests still failing and why)
   ```

3. ✅ **Commit fixes:**
   ```bash
   git add -A
   git commit -m "fix(core-2.0): resolve integration bugs exposed by test harness

   Fixes identified by 10 happy path integration tests.

   ## Bugs Fixed

   1. UUID Validation - Relaxed item_id schema from uuid() to string()
      - Real OpenAI API doesn't enforce UUID format
      - Fixtures use readable IDs like 'msg_001'

   2. Consumer Group Setup - Create group in harness setup
      - XGROUP CREATE before worker starts
      - Prevents NOGROUP errors on XREADGROUP

   3. Event Ordering - Ensure response_start emitted first
      - MockAdapter sequential emission (await each XADD)
      - Fixtures verified to have response_start as first event
      - Worker reset clears pending events between tests

   ## Test Results

   - Before: 0/10 passing
   - After: X/10 passing (see TEST_RESULTS.md)

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

4. ✅ **Report summary:**
   - Test results (X/10 passing)
   - Bugs fixed (list with brief explanation)
   - Remaining issues (if any tests still failing)
   - Next steps (fix remaining bugs OR move to next phase)

---

## STARTING POINT

**BEGIN by:**

1. Running the test suite and capturing full output to `test-output.txt`
2. Analyzing the 3 primary error patterns
3. Fixing Bug 1 (UUID validation) - simplest fix
4. Re-running tests to verify progress
5. Fixing Bug 2 (consumer group)
6. Re-running tests
7. Fixing Bug 3 (event ordering)
8. Iterating until all 10 tests pass

**Focus on systematic debugging:** One bug at a time, verify after each fix, document progress.

---

## EXPECTED OUTCOME

After this session:
- ✅ All 3 primary bugs fixed
- ✅ 8-10 tests passing (some may expose additional bugs)
- ✅ Clear documentation of any remaining issues
- ✅ Foundation for final bug fixes (if needed)

**Success criteria:** At least 8/10 tests passing. If 2 tests still fail, document why and prepare for follow-up session.

---

## NOTES

**This is bug fixing, not feature development.**

The test harness is your specification. The tests define correct behavior. Your job is to make the v2 implementation match what the tests expect.

**Don't change:**
- Test assertions (unless genuinely wrong)
- Fixture expected_response structures
- Harness API (unless fixing actual harness bugs)

**Do change:**
- v2 implementation code (schemas, workers, adapters)
- Infrastructure setup (consumer groups, Redis config)
- Event emission logic (ordering, timing)

The tests are correct. The implementation is buggy. Fix the implementation.
