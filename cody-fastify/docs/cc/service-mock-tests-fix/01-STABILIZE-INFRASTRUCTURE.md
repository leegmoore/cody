# CODER PROMPT: Service Mock Tests - Slice 1 - Stabilize Infrastructure

**Generated:** 2025-11-24
**Target Model:** gemini 3
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`
**Slice:** 1 of 7 (Foundation)

---

## ROLE

You are a senior TypeScript/Node.js developer responsible for **restoring and stabilizing the Core 2.0 test infrastructure**. Your immediate focus is getting the service-mocked test suite to load and run reliably, fixing environment configuration and verifying basic infrastructure connectivity.

---

## EXECUTION PHILOSOPHY

**This is a small, surgical fix. Not a refactor.**

**Scope:**
- Fix environment loading (vitest.config.ts)
- Fix missing imports (happy-path.spec.ts)
- Get TC-HP-01 passing consistently
- **Total expected changes: <50 lines across 2-3 files**

**Approach:**
- Read error messages to understand WHAT is broken
- Identify WHERE the fix goes
- Apply MINIMAL change to fix it
- Verify it works
- Move on

**Anti-patterns to avoid:**
- Don't refactor test harness or workers
- Don't add new abstractions or helper functions
- Don't "improve" code that isn't broken
- Don't fix tests beyond TC-HP-01 (those are later slices)

**Simplicity check:** If you've written >100 lines of code, you've gone too far. Stop and reassess.

---

## CRITICAL CONSTRAINT: NO MOCKING (Except LLM Responses)

**Absolute Rule:** Mock ONLY LLM API responses. Everything else is REAL.

**What's Mocked** ✅:
- LLM API responses (OpenAI, Anthropic) via MockModelFactory
- Fixtures provide pre-written LLM responses (simple-message.json, etc.)

**What's REAL** (Do NOT Mock) ❌:
- Redis connection and streams (connects to localhost:6379)
- Convex client and database queries (connects to real dev server)
- PersistenceWorker and ToolWorker (actually run and process events)
- Tool implementations (readFile actually reads files, exec actually runs commands)
- Fastify server (programmatically started, real HTTP)
- SSE streaming (real EventSource, real events)
- ResponseReducer and hydration logic (real aggregation)

**Verification Question for Your Report:**
"What is mocked in these tests?"

**Acceptable Answer:** "Only LLM API responses via MockModelFactory fixtures"

**Unacceptable Answer:** "LLM responses plus [anything else]"

**If you mock anything beyond LLM responses, you MUST disclose it in your completion report. Undisclosed mocking will be rejected.**

**Examples of Violations:**
```typescript
// ❌ WRONG - Mocking tools
toolRegistry.register({name: 'readFile', execute: async () => ({output: 'fake'})});

// ❌ WRONG - Mocking workers
const mockWorker = {start: () => {}, process: () => {}};

// ❌ WRONG - Mocking infrastructure
vi.mock('redis'); vi.mock('convex');
```

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
2. Multiple agents attempted fixes, introduced regressions (broke imports during cleanup)
3. Tests now failing on infrastructure issues, not logic issues

**Current Reality:**
- Tests load and run (environment partially working)
- Simple message tests pass (TC-HP-01 works)
- Complex tests timeout (persistence or worker issues)
- Tool tests fail (ToolWorker not emitting outputs)

---

## CURRENT PHASE

**Phase:** Service Mock Tests - Slice 1
**Objective:** Stabilize test infrastructure for the simplest test case (TC-HP-01).

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

✅ **Test Infrastructure Exists:**
- `tests/harness/core-harness.ts` - Test harness orchestrator (369 lines)
- `tests/mocks/mock-stream-adapter.ts` - Mocked LLM responses
- `src/core/model-factory.ts` - Factory pattern for test/prod adapters

✅ **Test Suites Written:**
- `tests/e2e/core-2.0/happy-path.spec.ts` - 10 happy path tests
- 22 total tests across 3 suites

✅ **Local Environment:**
- Redis running on localhost:6379
- Convex dev server running
- .env.local has CONVEX_URL configured

---

## STATE LOADING (READ THESE FIRST)

**Essential Context** (in order):

1. **Why we're here:** `docs/cc/UNMOCK-TOOLS-PROMPT.md`
   - Understand history: tool mocking was added, then rejected
   - Learn principle: only LLM responses are mocked
   - Critical for avoiding same mistake

2. **Current harness:** `tests/harness/core-harness.ts`
   - Review setup(), cleanup(), reset() methods
   - Understand harness lifecycle
   - Note: Line 320 has bug (ToolWorker created without scriptToolRegistry param)

3. **Current tests:** `tests/e2e/core-2.0/happy-path.spec.ts`
   - Review test structure
   - Find TC-HP-01 (the one we're stabilizing)
   - Check for missing imports at top of file

**Reference Documentation** (if needed):
- Architecture: `docs/codex-core-2.0-tech-design.md` (Appendix A has schemas)
- Test design: `docs/cc/v2-custom-harness-cc.md` (harness philosophy)

**Focus:** Understand current state and recent problems. Full architecture understanding not required for this targeted fix.

---

## KNOWN ISSUES (From Latest Test Run)

Based on test run showing 11 passed / 11 failed:

**Issue 1: Persistence Timeouts**
- **Affected tests**: TC-HP-02 through TC-HP-07
- **Error**: "Timed out waiting for persisted response for {runId}"
- **Symptom**: SSE streams complete, hydration works, but Convex query returns null
- **Likely cause**: PersistenceWorker not saving OR waitForPersisted timeout too short
- **Defer to**: Slice 2 (we'll debug this after infrastructure stable)

**Issue 2: Tool Execution Missing**
- **Affected test**: TC-HP-08
- **Error**: Expected ['function_call', 'function_call_output'] but got ['function_call']
- **Symptom**: ToolWorker not emitting function_call_output events
- **Defer to**: Slice 3 (we'll debug after persistence fixed)

**Issue 3: Environment/Import Issues**
- **Potential**: CONVEX_URL not loading, missing imports causing ReferenceError
- **Address in**: This slice

---

## TASK SPECIFICATION

Stabilize test infrastructure in **3 focused tasks**:

### **Task 1: Fix Environment Configuration** (~30 min)

**Problem:**
Test environment doesn't have access to CONVEX_URL and other variables from .env.local file.

**Location:** `vitest.config.ts` (top of file, before defineConfig)

**Required Changes:**
1. Load environment variables from .env.local using dotenv package
2. Forward CONVEX_URL to test environment via defineConfig({ test: { env: {...} } })
3. Forward REDIS_URL with default fallback to localhost:6379
4. Increase testTimeout from default 5s to 10_000ms

**Pattern Reference:**
Check how production code loads environment (src/server.ts or package.json scripts).
Follow similar pattern for test configuration.

**Success Criteria:**
Running tests should not produce "CONVEX_URL must be set" error.

---

### **Task 2: Fix Missing Imports** (~15 min)

**Problem:**
Import statements may be missing from test file, causing ReferenceError during test load.

**Location:** `tests/e2e/core-2.0/happy-path.spec.ts` (lines 1-20)

**Required Imports:**
Verify these Node.js utilities are imported:
- `randomUUID` from node:crypto
- `dirname`, `join` from node:path
- `fileURLToPath` from node:url
- Vitest functions (afterAll, beforeAll, describe, expect, test)

**Verify Usage:**
Check that these constants are defined after imports:
- `__filename` using fileURLToPath
- `__dirname` using dirname
- `FIXTURE_ROOT` using join

**Success Criteria:**
TypeScript compilation of test file succeeds without ReferenceError.

---

### **Task 3: Verify TC-HP-01 Stability** (~45 min)

**Problem:**
Need to confirm basic infrastructure works reliably before fixing other tests.

**Test:** TC-HP-01 (Simple message turn - OpenAI)

**What it validates:**
- MockAdapter publishes StreamEvents to Redis
- PersistenceWorker consumes and saves to Convex
- SSE streams events to test client
- StreamHydrator builds Response object
- Response matches expected structure
- Persisted Response in Convex matches hydrated Response

**Approach:**

1. **Run test individually:**
   ```bash
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
   ```

2. **If fails, diagnose:**
   - Read error output carefully
   - Identify failure point (environment, loading, execution, assertion)
   - Add minimal logging to harness.setup() if needed
   - Check Redis: `redis-cli KEYS "codex:run:*"`
   - Check Convex has data

3. **Apply minimal fix for identified issue**

4. **Achieve consistency:**
   Run test 5 times consecutively - all must pass

**Success Criteria:**
TC-HP-01 passes 5/5 consecutive runs with no flaky failures.

---

## WORKFLOW STEPS

**Step-by-step execution:**

1. **Verify environment files exist:**
   ```bash
   cd cody-fastify
   cat .env.local | grep CONVEX_URL
   redis-cli ping
   ```

2. **Fix vitest.config.ts** (Task 1)
   - Add environment loading
   - Forward required variables
   - Increase timeout

3. **Fix imports** (Task 2)
   - Check happy-path.spec.ts for missing imports
   - Add any that are missing
   - Verify file compiles

4. **Run TC-HP-01** (Task 3)
   ```bash
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
   ```

5. **Debug if needed:**
   - Add targeted logging
   - Identify failure point
   - Apply minimal fix

6. **Consistency check:**
   ```bash
   for i in {1..5}; do
     npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
     echo "Run $i: $?"
   done
   ```

7. **Clean up:**
   - Remove any diagnostic logging
   - Verify format/lint/typecheck

8. **Document:**
   - Update TEST_RESULTS.md
   - Note fixes applied
   - Report current state

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **NO MOCKING except LLM responses** (see CRITICAL CONSTRAINT section above)

2. **Minimal changes only**
   - Fix environment loading: ~10 lines
   - Fix imports: ~5 lines
   - Total: <50 lines
   - If you're writing >100 lines, stop and ask

3. **Don't refactor working code**
   - Test harness works (don't change it)
   - Workers work (don't modify them)
   - Only fix what's broken for TC-HP-01

4. **Follow existing patterns**
   - Check how other parts of codebase load environment
   - Use established import patterns
   - Don't introduce new approaches

5. **Verify incrementally**
   - Test after each fix
   - Don't batch changes
   - Catch issues early

### **INTERRUPT PROTOCOL**

**STOP and ask for clarification if:**
- Unclear whether something counts as "mocking infrastructure"
- Environment loading pattern is ambiguous
- Test fails for unclear reasons after fixes
- Need to modify worker or harness code

**DO NOT:**
- Mock tools, workers, Redis, or Convex
- Create new mocking utilities
- Refactor test harness
- Skip verification steps

---

## KNOWN ISSUES DETAIL

**From Latest Test Run** (11 passed / 11 failed):

**TC-HP-01**: ✅ Currently passing (when environment/imports correct)
**TC-HP-02 to TC-HP-07**: ❌ "Timed out waiting for persisted response"
**TC-HP-08**: ❌ Missing function_call_output (tool execution issue)
**TC-HP-09 to TC-HP-10**: ❌ Various (reconnection, concurrency)

**Root causes:**
- Environment variables not loading correctly
- Import statements missing from cleanup
- Persistence/tool issues (address in later slices)

**This slice addresses:** Environment and imports only

---

## CODE QUALITY STANDARDS

### **Verification Command:**
```bash
npm run format && \
npm run lint && \
npx tsc --noEmit && \
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
```

**All commands must succeed.**

### **Consistency Check:**
```bash
for i in {1..5}; do
  npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-01"
done
```

**All 5 runs must pass.**

---

## SESSION COMPLETION CHECKLIST

**Before declaring complete:**

1. ✅ Run verification command (format, lint, typecheck, test)
2. ✅ Run consistency check (5 consecutive passes)
3. ✅ Update TEST_RESULTS.md with Slice 1 status
4. ✅ Commit changes with descriptive message
5. ✅ Submit completion report (format below)

---

## COMPLETION REPORT FORMAT

Provide this structured report when done:

```markdown
# SLICE 1 COMPLETION REPORT

## Summary
[1-2 sentences: what was fixed]

## Changes Applied

### Change 1: [Description]
- **File:** [path]
- **Purpose:** [why this fix was needed]
- **Approach:** [what you did]
- **Lines modified:** ~X lines

### Change 2: [Description]
...

## Test Results

### TC-HP-01 Consistency Check
| Run | Status | Runtime | Notes |
|-----|--------|---------|-------|
| 1   | ✅/❌   | Xs      |       |
| 2   | ✅/❌   | Xs      |       |
| 3   | ✅/❌   | Xs      |       |
| 4   | ✅/❌   | Xs      |       |
| 5   | ✅/❌   | Xs      |       |

**Pass Rate:** X/5

## Quality Gates

- Format (npm run format): ✅/❌
- Lint (npm run lint): ✅/❌
- TypeCheck (npx tsc): ✅/❌
- Test (TC-HP-01): ✅/❌

## Environment Status

- CONVEX_URL: ✅ Loaded from .env.local / ❌ [issue]
- Redis (localhost:6379): ✅ Connected / ❌ [issue]
- Workers: ✅ Started / ❌ [issue]

## Mocking Verification

**Question:** What is mocked in these tests?

**Answer:** [Your answer here]

**Confirmation:**
- [x] Only LLM API responses are mocked
- [ ] Other things are mocked: [list if any]

## Issues for Next Slice

[List any remaining issues observed - these are expected and OK]

## Line Count

**Total lines modified:** ~X lines

**Breakdown:**
- vitest.config.ts: ~X lines
- happy-path.spec.ts: ~X lines
- Other: ~X lines

**Simplicity check:** Under 50 lines total ✅/❌

## Ready for Slice 2?

**YES/NO** - [Brief reasoning]
```

---

## STARTING POINT

**Begin by:**

1. Reading current `vitest.config.ts` to understand configuration
2. Checking `.env.local` to see what environment variables exist
3. Reading `happy-path.spec.ts` lines 1-30 to check for missing imports
4. Running TC-HP-01 once to observe current behavior
5. Applying fixes based on observed errors

**Focus:** Get TC-HP-01 stable. Everything else is later slices.

---

## EXPECTED OUTCOME

After this session:

**Code Changes:**
- ✅ vitest.config.ts: ~10 lines (environment loading)
- ✅ happy-path.spec.ts: ~5 lines (missing imports)
- ✅ Total: <50 lines modified

**Test Results:**
- ✅ TC-HP-01 passes 5/5 consecutive times
- ✅ No environment errors
- ✅ No import errors
- ⏳ Other tests still failing (expected - address in later slices)

**Not Expected in This Slice:**
- ❌ Fixing persistence timeouts (that's Slice 2)
- ❌ Fixing tool execution (that's Slice 3)
- ❌ Refactoring harness or workers
- ❌ Adding new abstractions

**Reality Check:**
If you've modified >100 lines or changed worker code, you've gone beyond slice scope. This should be a quick, targeted infrastructure fix.

---

## DEBUGGING GUIDANCE

**If TC-HP-01 fails after environment/import fixes:**

**Diagnostic approach:**
1. Check what error message says
2. Add minimal console.log to harness.setup():
   ```typescript
   console.log('[harness] Fastify port:', port);
   console.log('[harness] Convex URL:', convexUrl);
   console.log('[harness] Workers started');
   ```
3. Run test again, observe logs
4. Identify which component fails (Fastify, Redis, Convex, Worker)
5. Apply targeted fix

**Common issues:**
- CONVEX_URL still not loading → check dotenv path
- Redis not connecting → verify Redis running
- Worker not starting → check worker initialization
- Events not flowing → check MockAdapter publishing

**For each issue:**
- Fix the specific problem
- Don't add workarounds or mocks
- Verify fix works
- Remove diagnostic logging

---

## IMPLEMENTATION NOTES

### **Environment Loading Pattern**

Vitest needs environment variables loaded before configuration:

**Approach:**
1. Import dotenv at top of vitest.config.ts
2. Call config({ path: '.env.local' }) before defineConfig
3. Forward process.env.CONVEX_URL to test.env object
4. This makes CONVEX_URL available in test processes

**Reference:** Check how production server loads environment

---

### **Import Pattern**

Standard imports for test files using fixtures:

**Required utilities:**
- Node crypto (for randomUUID)
- Node path (for dirname, join, fileURLToPath)
- Vitest test functions
- Schema types from src/core/schema.ts
- Harness from tests/harness/core-harness.ts

**Pattern:** Check other test files (error-handling.spec.ts, edge-cases.spec.ts) for reference

---

## SUCCESS CRITERIA

**Slice 1 Complete When:**
- ✅ vitest.config.ts loads environment from .env.local
- ✅ happy-path.spec.ts has all required imports
- ✅ TC-HP-01 passes 5/5 consecutive times
- ✅ No environment or import errors
- ✅ Format, lint, typecheck all pass
- ✅ Completion report submitted

**Total changes:** <50 lines
**Total time:** 1-2 hours

**Do not proceed to Slice 2 until all criteria met.**
