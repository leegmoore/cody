# Fix Hanging Tests - Debug Mission

**Role:** Test Infrastructure Specialist

**Mission:** Identify and fix hanging/slow tests in the Codex TypeScript test suite.

**Problem:** Running `npm test` hangs or takes excessively long. Need to find which tests are the culprit and fix them.

---

## Context

**Project:** Codex TypeScript port (`codex-ts/` directory)
**Location:** `/Users/leemoore/code/codex-port-02/codex-ts`
**Test framework:** Vitest
**Current status:** 876 tests exist, but test runs hang

**Symptoms:**
- `npm test` doesn't complete
- No clear indication which test is stuck
- Blocks validation of completed phases

---

## Your Task

**Find and fix ALL hanging tests so `npm test` completes in < 30 seconds.**

---

## Methodology

### Step 1: Identify Test Categories

Run this to see all test files:
```bash
cd codex-ts
find src -name "*.test.ts" | sort
```

**Test categories (by module):**
- protocol/* (Phase 1)
- common/* (Phase 0)
- utils/* (Phase 0)
- ollama/* (Phase 4.0)
- mcp-types/* (Phase 4.0)
- core/config* (Phase 2)
- core/rollout* (Phase 2)
- core/message-history* (Phase 2)
- apply-patch/* (Phase 3)
- file-search/* (Phase 3)
- execpolicy/* (Phase 3)
- core/sandboxing/* (Phase 3)
- core/exec/* (Phase 3)
- core/tools/* (Phase 3)
- core/client/* (Phase 4.1)
- core/auth/* (Phase 4.1)
- backend-client/* (Phase 4.3)
- chatgpt/* (Phase 4.3)
- rmcp-client/* (Phase 4.3)
- mcp-server/* (Phase 4.3)
- core/mcp/* (Phase 4.3)

### Step 2: Test Each Category Individually

**Run tests by pattern to isolate hangs:**

```bash
# Test just protocol
npm test -- protocol

# Test just core/config
npm test -- core/config

# Test just core/exec
npm test -- core/exec

# etc. for each category
```

**For each category:**
1. Start test with 30s timeout
2. If hangs, that category has a problem
3. If completes, note duration
4. Build a list of problematic categories

### Step 3: Drill Down to Specific Tests

**For each hanging category, run individual test files:**

```bash
# If core/exec hangs, test each file
npm test -- core/exec/engine.test.ts
npm test -- core/exec/types.test.ts
# etc.
```

**For each file:**
1. Run with timeout
2. If hangs, drill down to specific tests
3. Note which test within file is the culprit

### Step 4: Identify Hanging Test Characteristics

**Common causes of hanging tests:**
- **Async without await** - Test starts async operation but doesn't wait
- **Missing done callback** - Async test without proper completion
- **Infinite loops** - Logic error causing hang
- **Process not killed** - Spawned child process left running
- **Network calls** - Waiting for timeout on unreachable endpoint
- **File watchers** - File system watchers not cleaned up
- **Timers** - setTimeout/setInterval not cleared

**Look for patterns:**
- Tests with `exec` (spawning processes)
- Tests with network calls (fetch, HTTP)
- Tests with file operations
- Tests with timers
- Tests with async generators

### Step 5: Fix Strategy

**For each hanging test:**

**If spawning processes:**
```typescript
// Bad
test('exec command', async () => {
  const result = await exec({command: ['sleep', '100']});
  // Process might not be killed
});

// Good
test('exec command', async () => {
  const result = await exec({command: ['echo', 'hi']});
  expect(result.exitCode).toBe(0);
}, {timeout: 5000}); // Set explicit timeout
```

**If missing cleanup:**
```typescript
// Bad
test('file watcher', () => {
  const watcher = fs.watch(...);
  // Watcher never closed
});

// Good
test('file watcher', async () => {
  const watcher = fs.watch(...);
  try {
    // test logic
  } finally {
    watcher.close();
  }
});
```

**If network calls:**
```typescript
// Bad
test('http request', async () => {
  await fetch('http://unreachable.example.com');
  // Waits for timeout
});

// Good
test('http request', async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 1000);
  await fetch('http://example.com', {signal: controller.signal});
});
```

**If infinite async:**
```typescript
// Bad
test('stream', async () => {
  for await (const chunk of stream) {
    // Stream never ends
  }
});

// Good
test('stream', async () => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    if (chunks.length >= 10) break; // Limit iterations
  }
});
```

### Step 6: Common Fixes

**Add global test timeout** in `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    testTimeout: 10000, // 10 seconds max per test
    hookTimeout: 10000  // 10 seconds for before/after hooks
  }
});
```

**Add per-test timeouts** for slow tests:
```typescript
test('slow operation', async () => {
  // ...
}, {timeout: 30000}); // 30s for this specific test
```

**Kill spawned processes** in afterEach:
```typescript
describe('exec tests', () => {
  const spawnedProcesses: ChildProcess[] = [];

  afterEach(() => {
    // Kill any orphaned processes
    spawnedProcesses.forEach(p => p.kill());
    spawnedProcesses.length = 0;
  });

  test('exec command', async () => {
    const proc = spawn(...);
    spawnedProcesses.push(proc);
    // ...
  });
});
```

---

## Deliverables

**When complete, provide:**

1. **List of hanging tests** - Exact file + test name
2. **Root cause for each** - Why it was hanging
3. **Fixes applied** - What you changed
4. **Test run time** - Before and after (goal: < 30s total)
5. **Commit message** - "fix: resolve hanging tests in [modules]"

**Success criteria:**
- `npm test` completes in < 30 seconds
- All 876 tests still passing
- No false negatives (tests that should fail but pass due to timeout)
- Committed and pushed

---

## Execution Steps

1. **Survey:** Find all test files, note count
2. **Isolate:** Test each category, identify which hang
3. **Drill down:** Find specific hanging tests
4. **Diagnose:** Determine root cause
5. **Fix:** Apply appropriate fix (timeout, cleanup, mock, etc.)
6. **Verify:** Run full suite, confirm < 30s
7. **Document:** Update STATUS, commit, push
8. **Report:** List all fixes made

---

## Commands Reference

```bash
# Run all tests
npm test

# Run with timeout
timeout 30s npm test

# Run specific pattern
npm test -- protocol

# Run specific file
npm test -- src/core/exec/engine.test.ts

# Run with verbose output (see which test is running)
npm test -- --reporter=verbose

# Run tests in sequence (not parallel) for debugging
npm test -- --no-threads

# Check vitest config
cat vitest.config.ts
```

---

## Report Format

**After completing, report:**

```
HANGING TESTS FIXED

Hanging tests found: [N]

Category: core/exec
- Test: "spawns process and captures output"
  - Issue: Child process not killed after test
  - Fix: Added afterEach cleanup
  - File: src/core/exec/engine.test.ts:45

Category: backend-client
- Test: "fetches task details"
  - Issue: Network timeout (no mock)
  - Fix: Added fetch mock with timeout
  - File: src/backend-client/client.test.ts:78

[... repeat for each fix]

Test run time:
- Before: HANG (never completed)
- After: 8.2 seconds

All 876 tests passing ✅

Committed: fix: resolve [N] hanging tests across [M] modules
```

---

**GO! Debug those tests and make the suite fast and reliable.**
