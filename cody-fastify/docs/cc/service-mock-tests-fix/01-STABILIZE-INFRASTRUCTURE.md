# CODER PROMPT: Service Mock Tests - Slice 1 - Stabilize Infrastructure

**Generated:** 2025-11-24
**Target Model:** gemini 3
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`
**Slice:** 1 of 7 (Foundation)

---

## ROLE

You are a senior TypeScript/Node.js developer responsible for **restoring and stabilizing the Core 2.0 test infrastructure**. Your immediate focus is getting the service-mocked test suite to load and run reliably, fixing environment configuration and verifying basic infrastructure connectivity.

---

## PROJECT CONTEXT

**Cody Core 2.0** is a streaming-native agent architecture that processes LLM turns through a Redis Streams pipeline with Convex persistence.

**Test Infrastructure Status:**
- ✅ Core 2.0 architecture implemented (Redis, workers, SSE, Convex)
- ✅ Test harness created (Core2TestHarness with MockModelFactory)
- ✅ 22 comprehensive test conditions defined
- ⚠️ Tests currently: 11 passed / 11 failed (infrastructure issues)
- ❌ Environment configuration incomplete
- ❌ Import statements broken in some tests
- ❌ Persistence timeouts occurring
- ❌ Tool execution not working

**What Happened (The Drift):**
Recent work attempted to "unmock" tool execution but introduced confusion:
1. Tool implementation mocking was added (installMockTools) despite explicit "no mocks" rule
2. Multiple agents attempted fixes, introduced regressions
3. Import statements broken during cleanup
4. Tests now failing on infrastructure issues, not logic issues

**Current Reality:**
- Tests load and run (environment partially working)
- Simple message tests pass (TC-HP-01 works)
- Complex tests timeout (persistence or worker issues)
- Tool tests fail (ToolWorker not emitting outputs)

---

## CURRENT PHASE

**Phase:** Service Mock Tests - Slice 1
**Objective:** Stabilize test infrastructure to achieve consistent, reliable test loading and execution for the simplest test case (TC-HP-01).

**FUNCTIONAL OUTCOME:**
After this slice, TC-HP-01 (Simple message turn) passes consistently 5 times in a row, demonstrating that basic infrastructure (Fastify, Redis, Convex, MockAdapter, PersistenceWorker, SSE, Hydration) works reliably without mocking any infrastructure components.

---

## PREREQUISITES

✅ **Core 2.0 Implementation Complete:**
- `src/core/schema.ts` - Zod schemas (Response, OutputItem, StreamEvent)
- `src/core/reducer.ts` - ResponseReducer for event aggregation
- `src/core/redis.ts` - RedisStream wrapper
- `src/workers/persistence-worker.ts` - Consumes Redis, writes Convex
- `src/workers/tool-worker.ts` - Processes function_call events
- `src/core/adapters/openai-adapter.ts` - OpenAI normalization
- `src/core/adapters/anthropic-adapter.ts` - Anthropic normalization

✅ **Test Infrastructure Exists:**
- `tests/harness/core-harness.ts` - Test harness orchestrator
- `tests/mocks/mock-stream-adapter.ts` - Mocked LLM responses
- `src/core/model-factory.ts` - Factory pattern for DI
- `src/client/hydration.ts` - StreamHydrator for SSE consumption

✅ **Test Suites Written:**
- `tests/e2e/core-2.0/happy-path.spec.ts` - 10 happy path tests
- `tests/e2e/core-2.0/error-handling.spec.ts` - 6 error tests
- `tests/e2e/core-2.0/edge-cases.spec.ts` - 6 edge case tests

✅ **Local Environment:**
- Redis running on localhost:6379
- Convex dev server running (or URL configured)
- Bun/Node.js environment

---

## STATE LOADING (READ THESE FIRST)

### FIRST: Understand the Testing Philosophy

1. **Core 2.0 Design:** `docs/codex-core-2.0-tech-design.md` (Appendix A)
   - Read the "NO MOCKS" rule (tests must use real Redis, real Convex)
   - Understand canonical StreamEvent → Response flow
   - Note: Only LLM API calls are mocked

2. **Test Harness Design:** `docs/cc/v2-custom-harness-cc.md`
   - Understand Core2TestHarness lifecycle (setup, cleanup, reset)
   - Review what's mocked (only LLM responses via MockModelFactory)
   - Review what's real (Redis, Convex, workers, Fastify)

3. **Unmock Tools Doc:** `docs/cc/UNMOCK-TOOLS-PROMPT.md`
   - Understand the history: tool mocking was incorrectly added
   - Review the principle: ToolWorker runs real, tool handlers execute real
   - This is CRITICAL context for understanding current state

### THEN: Review Current Implementation

4. **Test Harness:** `tests/harness/core-harness.ts`
   - Review setup() method (lines 89-123)
   - Review cleanup() method (lines 125-140)
   - Review reset() method (lines 279-322)
   - **CRITICAL**: Note line 320 bug (ToolWorker created without scriptToolRegistry)

5. **Happy Path Tests:** `tests/e2e/core-2.0/happy-path.spec.ts`
   - Review current test structure
   - Note any missing imports
   - Note TC-HP-01 (simplest test we'll stabilize)

6. **Vitest Config:** `vitest.config.ts` and `vitest.setup.ts`
   - Review environment configuration
   - Check if CONVEX_URL is loaded
   - Check for any setup/teardown hooks

---

## TASK SPECIFICATION

Stabilize the test infrastructure in **3 focused sub-tasks**:

### **Task 1: Environment Configuration** (~30 min)

**Deliverables:**

1. **Vitest Config** (`vitest.config.ts`) - Fix environment loading
   - Ensure CONVEX_URL loaded from .env.local
   - Add explicit env variable forwarding
   - Verify other required vars (OPENAI_API_KEY, etc.)

2. **Verification Script** - Quick check before tests
   - Check Redis connectivity (localhost:6379)
   - Check CONVEX_URL is set
   - Report configuration status

**Integration:** Tests will load environment correctly, no CONVEX_URL errors

---

### **Task 2: Fix Missing Imports** (~15 min)

**Deliverables:**

1. **Happy Path Tests** (`tests/e2e/core-2.0/happy-path.spec.ts`)
   - Ensure these imports exist at top of file:
     ```typescript
     import { randomUUID } from "node:crypto";
     import { dirname, join } from "node:path";
     import { fileURLToPath } from "node:url";
     ```
   - Verify __filename, __dirname, FIXTURE_ROOT are defined
   - Check for any other missing imports

**Integration:** Tests load without ReferenceError

---

### **Task 3: Verify TC-HP-01 Infrastructure** (~45 min)

**Deliverables:**

1. **Run TC-HP-01 Only** - Isolate simplest test
   - Command: `npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"`
   - Verify it passes
   - Check logs for errors (NOGROUP, timeouts)

2. **Debug Infrastructure If Fails:**
   - Add logging to harness.setup() showing:
     - Fastify listening on port
     - Redis connected
     - Convex client initialized
     - Workers started
   - Check worker logs during test
   - Verify events flow: MockAdapter → Redis → PersistenceWorker → Convex

3. **Validate Consistency:**
   - Run TC-HP-01 five times in a row
   - All must pass
   - No flaky failures

**Success Criteria:** TC-HP-01 passes 5/5 times

---

## WORKFLOW STEPS

### **Step-by-Step Process:**

1. **Check Current Environment**
   ```bash
   cd cody-fastify
   cat .env.local | grep CONVEX_URL
   redis-cli ping  # Verify Redis
   ```

2. **Fix vitest.config.ts**
   - Add dotenv config loading
   - Forward CONVEX_URL to test environment
   - Add other required vars (OPENAI_API_KEY, etc.)

3. **Verify Missing Imports**
   - Read happy-path.spec.ts lines 1-30
   - Check for randomUUID, dirname, join, fileURLToPath imports
   - Add if missing

4. **Run Simplest Test**
   ```bash
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
   ```

5. **Debug If Fails**
   - Read error output carefully
   - Add console.log in harness.setup() if needed
   - Check Redis streams exist: `redis-cli KEYS "codex:run:*"`
   - Check Convex has data (if test completes)

6. **Achieve 5/5 Success Rate**
   ```bash
   for i in {1..5}; do
     npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
     echo "Run $i complete"
   done
   ```

7. **Document Status**
   - Update TEST_RESULTS.md with Slice 1 status
   - Note what was fixed
   - Note current pass rate
   - List any remaining concerns

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **NO MOCKING except LLM API calls**
   - ❌ DO NOT mock Redis
   - ❌ DO NOT mock Convex
   - ❌ DO NOT mock workers (PersistenceWorker, ToolWorker)
   - ❌ DO NOT mock tool implementations (readFile, exec, etc.)
   - ✅ ONLY mock LLM responses (via MockModelFactory)
   - **This is absolute. Violations will be rejected.**

2. **Use existing test harness patterns**
   - DO NOT create new mocking abstractions
   - DO NOT refactor test harness (unless required for fix)
   - Use Core2TestHarness as-is
   - Keep changes minimal and focused

3. **Fix imports, don't remove functionality**
   - If imports are missing, add them back
   - Don't delete code to "fix" import errors
   - Verify file paths are correct

4. **Follow established patterns from working commits**
   - Reference commit 2eb06137 (10/10 passing before tool mocking)
   - Don't introduce new patterns
   - Keep it simple

### **INTERRUPT PROTOCOL**

**STOP and ask for clarification if:**
- You're unsure whether something counts as "mocking infrastructure"
- vitest.config.ts environment loading is unclear
- Redis or Convex connection patterns are ambiguous
- Test is failing for reasons you can't diagnose from logs
- You need to modify worker code to fix test issues

**DO NOT:**
- Add ANY mocking of tools, workers, Redis, or Convex
- Create mock abstractions like installMockTools, mockToolWorker, etc.
- Modify worker code unless absolutely necessary
- Make assumptions about environment configuration
- Skip verification steps to save time

---

## CRITICAL CONSTRAINTS

### **The "No Mocks" Rule - What It Means**

**ONLY Mock LLM API Responses:**
```typescript
// ✅ CORRECT - Mock OpenAI/Anthropic API via MockModelFactory
const factory = new MockModelFactory({
  adapterFactory: createMockStreamAdapter
});
// Fixtures provide fake LLM responses
```

**Everything Else is REAL:**
```typescript
// ✅ CORRECT - Real infrastructure
const redis = await RedisStream.connect(); // Real Redis
const convex = new ConvexHttpClient(url); // Real Convex
const worker = new PersistenceWorker(); // Real worker
await worker.start(); // Actually runs

// ✅ CORRECT - Real tool execution
// When LLM fixture requests readFile:
// 1. ToolWorker sees function_call in real Redis
// 2. ToolWorker executes REAL readFile function
// 3. Real file is read from disk
// 4. ToolWorker emits REAL function_call_output to Redis
```

**What You CANNOT Do:**
```typescript
// ❌ WRONG - Mocking tool implementations
toolRegistry.register({
  name: 'readFile',
  execute: async () => ({ output: 'mocked content' }) // NO!
});

// ❌ WRONG - Mocking workers
const mockWorker = {
  start: () => {},
  process: () => 'fake output'
}; // NO!

// ❌ WRONG - Mocking Redis
vi.mock('redis', () => ({ /* fake */ })); // NO!
```

---

## KNOWN ISSUES (Current Failures)

Based on latest test run (11 passed / 11 failed):

**Issue 1: Persistence Timeouts**
- **Tests affected**: TC-HP-02, TC-HP-03, TC-HP-04, TC-HP-05, TC-HP-06, TC-HP-07
- **Error**: "Timed out waiting for persisted response for {runId}"
- **Root cause**: PersistenceWorker not saving to Convex OR waitForPersisted timeout too short
- **Evidence**: Events stream (SSE works) but Convex query returns nothing

**Issue 2: Tool Execution Missing**
- **Test affected**: TC-HP-08
- **Error**: Expected ['function_call', 'function_call_output'] but got ['function_call']
- **Root cause**: ToolWorker not executing or not emitting function_call_output
- **Evidence**: function_call appears but no corresponding output

**Issue 3: NOGROUP Errors in Logs**
- **Pattern**: "NOGROUP No such key or consumer group 'codex-projector-group'"
- **When**: During worker auto-claim operations
- **Impact**: Workers might not be processing events reliably
- **Root cause**: Consumer groups deleted with streams, not recreated properly

---

## TASK SPECIFICATION

### **Task 1: Fix Environment Configuration** (~30 min)

**Current Problem:**
CONVEX_URL and other environment variables may not be loading in test context.

**File:** `vitest.config.ts`

**Current State:**
```typescript
// Might be missing env loading
export default defineConfig({
  test: {
    // ... config
  }
});
```

**Required Fix:**
```typescript
import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

// Load .env.local for test environment
loadEnv({ path: '.env.local' });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Explicitly forward critical env vars
    env: {
      CONVEX_URL: process.env.CONVEX_URL,
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    testTimeout: 10_000, // Increase from default 5s
  },
});
```

**Verification:**
```bash
# Should print CONVEX_URL value
CONVEX_URL=$(grep CONVEX_URL .env.local | cut -d '=' -f2)
echo "CONVEX_URL: $CONVEX_URL"

# Run test with env debug
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
# Should NOT see "CONVEX_URL must be set" error
```

---

### **Task 2: Fix Missing Imports** (~15 min)

**Current Problem:**
Import statements may be missing from test files, causing ReferenceError.

**File:** `tests/e2e/core-2.0/happy-path.spec.ts`

**Required Imports (Lines 1-15):**
```typescript
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "vitest";

import {
  StreamEventSchema,
  type Response,
  type StreamEvent,
} from "../../../src/core/schema.js";
import { Core2TestHarness } from "../../harness/core-harness.js";
import type { MockFixtureFile } from "../../mocks/mock-stream-adapter.js";
```

**Then verify these are used:**
```typescript
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_ROOT = join(__dirname, "../../fixtures");
```

**Verification:**
```bash
# Should compile without errors
npx tsc --noEmit tests/e2e/core-2.0/happy-path.spec.ts
```

---

### **Task 3: Run and Debug TC-HP-01** (~45 min)

**Goal:** Get the simplest test passing consistently

**File:** `tests/e2e/core-2.0/happy-path.spec.ts`

**The Test:**
```typescript
test("TC-HP-01: Simple message turn (OpenAI)", async () => {
  // This test:
  // 1. Submits simple prompt via /api/v2/submit
  // 2. MockAdapter emits simple-message fixture to Redis
  // 3. PersistenceWorker consumes and saves to Convex
  // 4. SSE streams events to test
  // 5. Hydrates into Response object
  // 6. Verifies Response structure
  // 7. Verifies Convex has same Response
});
```

**Debug Steps If Fails:**

1. **Add Harness Logging** (if needed):
   ```typescript
   // In core-harness.ts setup() method
   console.log('[harness] Fastify listening on', this.baseUrl);
   console.log('[harness] Convex connected to', convexUrl);
   console.log('[harness] PersistenceWorker started');
   ```

2. **Check Redis During Test:**
   ```bash
   # In another terminal, watch Redis during test run
   redis-cli MONITOR
   # Should see XADD commands (events being published)
   ```

3. **Check Event Flow:**
   - MockAdapter should emit response_start, item_start, item_delta, item_done, response_done
   - PersistenceWorker should consume these events
   - Convex should have document with runId
   - SSE should stream all events to test
   - Hydration should build complete Response

4. **Common Failure Modes:**
   - **Timeout**: PersistenceWorker not running or not persisting
   - **NOGROUP**: Consumer group not created
   - **No events**: MockAdapter not publishing or Redis not connected
   - **Schema error**: Events don't match StreamEventSchema

**Success Criteria:**
```bash
# Run test 5 times
for i in {1..5}; do
  npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
  if [ $? -ne 0 ]; then
    echo "FAILED on run $i"
    exit 1
  fi
done
echo "SUCCESS: 5/5 passing"
```

---

## CODE QUALITY STANDARDS

### **Mandatory Quality Gates:**

- ✅ **TypeScript**: Zero errors (`npx tsc --noEmit`)
- ✅ **ESLint**: Zero errors (`npm run lint`)
- ✅ **Format**: Prettier compliant (`npm run format`)
- ✅ **Test**: TC-HP-01 passes 5/5 times

### **Verification Command:**
```bash
npm run format && \
npm run lint && \
npx tsc --noEmit && \
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
```

**All commands must succeed (exit code 0) before declaring slice complete.**

---

## SESSION COMPLETION CHECKLIST

### **Before ending session:**

1. ✅ **Run verification command** (above)
   ```bash
   npm run format && npm run lint && npx tsc --noEmit
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
   ```

2. ✅ **Run consistency check** (5 consecutive passes)
   ```bash
   for i in {1..5}; do
     npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
   done
   ```

3. ✅ **Document results in TEST_RESULTS.md:**
   ```markdown
   ## [Date] - Slice 1: Infrastructure Stabilization

   **Tests:** TC-HP-01 passing 5/5 consecutive runs
   **Runtime:** ~X seconds per run
   **Fixes Applied:**
   - [List what was fixed]

   **Issues Remaining:**
   - [List known issues for next slices]

   **Environment:**
   - CONVEX_URL: [status]
   - Redis: [status]
   - Workers: [status]
   ```

4. ✅ **Commit work:**
   ```bash
   git add -A
   git commit -m "fix(test): Slice 1 - stabilize test infrastructure

   Fixed environment loading, missing imports, and basic harness connectivity.
   TC-HP-01 now passes consistently 5/5 times.

   Fixes:
   - vitest.config.ts: Added CONVEX_URL environment loading
   - happy-path.spec.ts: Restored missing imports
   - Verified Redis/Convex connectivity

   Results: TC-HP-01 passing 5/5 consecutive runs

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

5. ✅ **Report summary to user:**
   - TC-HP-01 status: X/5 passing
   - Fixes applied: [list]
   - Environment status: [Redis, Convex, Workers]
   - Issues found: [list]
   - Ready for Slice 2: [YES/NO with reasoning]

---

## STARTING POINT

**BEGIN by:**

1. Reading `vitest.config.ts` and checking environment configuration
2. Reading `happy-path.spec.ts` lines 1-30 to verify imports
3. Running TC-HP-01 once to see current failure mode
4. Applying fixes based on observed errors
5. Achieving 5/5 consecutive passes

**Focus on:** Minimal fixes to get TC-HP-01 stable. Don't fix other tests yet. Don't refactor. Just stabilize the foundation.

---

## EXPECTED OUTCOME

After this session:
- ✅ vitest.config.ts loads CONVEX_URL and other env vars correctly
- ✅ happy-path.spec.ts has all required imports
- ✅ TC-HP-01 passes 5/5 consecutive times
- ✅ No CONVEX_URL errors in logs
- ✅ Clear documentation of what was fixed

**Realistic Expectations:**
- Other tests (TC-HP-02 through TC-HP-10) will still fail - this is expected
- NOGROUP errors might still appear in logs - we'll address in Slice 2
- Tool execution (TC-HP-05, TC-HP-08) won't work yet - we'll fix in Slice 3

**The goal is a stable foundation**, not a complete fix. Get TC-HP-01 reliable, then we build from there.

---

## OUTPUT REPORT FORMAT

After completing work, provide this structured report:

```markdown
# SLICE 1 COMPLETION REPORT

## Summary
[1-2 sentence overview of what was done]

## Fixes Applied

### Fix 1: [Name]
- **File:** [path]
- **Lines:** [specific lines]
- **Change:** [what was changed]
- **Reason:** [why this was necessary]

### Fix 2: [Name]
...

## Test Results

### TC-HP-01 Consistency Check
| Run | Result | Runtime | Notes |
|-----|--------|---------|-------|
| 1   | ✅/❌  | Xs      |       |
| 2   | ✅/❌  | Xs      |       |
| 3   | ✅/❌  | Xs      |       |
| 4   | ✅/❌  | Xs      |       |
| 5   | ✅/❌  | Xs      |       |

**Pass Rate:** X/5

## Verification Command Results

```bash
npm run format  # ✅/❌
npm run lint    # ✅/❌
npx tsc         # ✅/❌
TC-HP-01 test   # ✅/❌
```

## Environment Status

- **CONVEX_URL:** [set/missing] - [value or error]
- **Redis Connection:** [success/failed] - [details]
- **Convex Connection:** [success/failed] - [details]
- **Workers Started:** [yes/no] - [which workers]

## Issues Discovered

### Issue 1: [Name]
- **Severity:** Critical/High/Medium/Low
- **Description:** [what's wrong]
- **Impact:** [which tests affected]
- **Recommended Fix:** [for future slice]

### Issue 2: [Name]
...

## Recommendations for Next Slice

**Ready to proceed:** YES/NO

**If YES:**
- Slice 2 can focus on: [specific area]
- Expected to fix: [which tests]

**If NO:**
- Blockers: [list blockers]
- Need clarification on: [list questions]

## Mocking Verification

**CONFIRM:** The following is the COMPLETE list of what is mocked in these tests:
- [x] LLM API responses (OpenAI, Anthropic) via MockModelFactory
- [ ] Nothing else

**If anything else is mocked, LIST IT HERE:**
- [None / or list items]
```

---

## IMPLEMENTATION NOTES

### **Environment Loading Pattern**

The correct pattern for vitest environment loading:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Load environment before config
config({ path: '.env.local' });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Forward vars to test env
    env: {
      CONVEX_URL: process.env.CONVEX_URL,
    },
  },
});
```

### **Debugging Persistence Issues**

If TC-HP-01 times out on `waitForPersisted`:

1. **Check PersistenceWorker is running:**
   ```typescript
   // Add to harness.setup() after worker.start()
   console.log('[harness] PersistenceWorker started:', this.worker.isRunning());
   ```

2. **Check Redis has events:**
   ```bash
   redis-cli XLEN "codex:run:{runId}:events"
   # Should show > 0 messages
   ```

3. **Check Convex query:**
   ```typescript
   // In test, add debug logging
   const persisted = await harness.getPersistedResponse(runId);
   console.log('[test] Persisted response:', persisted);
   ```

4. **Check consumer group:**
   ```bash
   redis-cli XINFO GROUPS "codex:run:{runId}:events"
   # Should show codex-projector-group exists
   ```

---

## SUCCESS CRITERIA

**Slice 1 is COMPLETE when:**
- ✅ vitest.config.ts loads environment correctly
- ✅ All test files have required imports
- ✅ TC-HP-01 passes 5/5 consecutive times
- ✅ No environment errors in test output
- ✅ Format, lint, typecheck all pass
- ✅ Report submitted with mocking verification

**Do not proceed to Slice 2 until all criteria met.**

---

## CRITICAL REMINDERS

1. **NO MOCKING** except LLM responses - this is non-negotiable
2. **Minimal changes** - fix only what's broken for TC-HP-01
3. **Verify incrementally** - test after each fix
4. **Ask if uncertain** - don't assume or guess
5. **Real infrastructure** - Redis, Convex, workers must be real
6. **Report honestly** - if something is mocked, admit it in report

The goal is **one passing test with real infrastructure**, not "make tests pass by any means necessary."
