# Known Bugs and Issues

**Status:** Tracking bugs for future fix pass
**Last Updated:** 2025-11-07

---

## Active Bugs

### 🐛 Bug #3: Flaky tests in full suite run
**Module:** `async-utils`, `file-search`
**Files:** `src/async-utils/index.test.ts`, `src/file-search/search.test.ts`
**Severity:** Low (tests pass individually)

**Description:**
When running the full test suite, 11 tests timeout after 5000ms. These tests pass consistently when run individually or in small groups, suggesting test pollution or resource exhaustion in the full suite.

**Failing tests:**
- `async-utils/index.test.ts`: "returns Err when signal aborted first" (1 test)
- `file-search/search.test.ts`: All 11 tests timeout

**Error:**
```
Error: Test timed out in 5000ms.
```

**Impact:**
- Full test suite shows: 11 failed | 1137 passed (1148)
- Individual test runs: All tests pass (100%)
- Likely test pollution or resource contention issue

**Notes:**
- Tests pass individually: `npm test -- src/file-search/search.test.ts` ✓
- Tests fail in full suite: `npm test` ✗
- Vitest config uses `singleFork: true` (sequential execution)
- May be related to temporary file cleanup or async resource exhaustion
- Fixed 1 test (was 12 failures, now 11) by improving abort listener cleanup

**Priority:** Low (doesn't block core functionality, tests pass individually)

---

## Fixed Bugs

### ✅ Bug #1: TypeScript generic constraint error in cache module (FIXED)
**Module:** `utils/cache`
**File:** `src/utils/cache/index.ts:17,38`
**Fixed:** 2025-11-07

**Original Issue:**
Type parameters `K` and `V` did not satisfy the constraint `{}` in LRU cache implementation.

**Original Error:**
```
src/utils/cache/index.ts(18,27): error TS2344: Type 'K' does not satisfy the constraint '{}'.
src/utils/cache/index.ts(29,31): error TS2344: Type 'K' does not satisfy the constraint '{}'.
```

**Fix:**
Added `extends {}` constraint to both generic type parameters `K` and `V` to match `lru-cache` library requirements.

**Changed:**
```typescript
// Before
export class LruCache<K, V> {

// After
export class LruCache<K extends {}, V extends {}> {
```

**Verification:**
- TypeScript compilation now succeeds with zero errors in cache module
- All 13 cache tests still passing (100%)

---

### ✅ Bug #2: ESLint configuration missing (FIXED)
**Module:** `codex-ts` (project-level)
**File:** `.eslintrc.json` (created)
**Fixed:** 2025-11-07

**Original Issue:**
No ESLint configuration file existed. Running `npm run lint` failed with "couldn't find a configuration file".

**Fix:**
Created `.eslintrc.json` with TypeScript-appropriate configuration:
- Uses `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`
- Extends recommended ESLint and TypeScript ESLint rulesets
- Configured to allow `_`-prefixed unused variables
- Enforces no `any` types
- Ignores node_modules, dist, and .js files

**Verification:**
- `npm run lint` now runs successfully
- ESLint processes all TypeScript files
- Code quality checks now active

---

## Bug Triage Guidelines

**Severity Levels:**
- **Critical:** Crashes, data loss, security issues, blocks all work
- **High:** Major functionality broken, many tests failing, blocks phase completion
- **Medium:** Incorrect behavior, minor functionality issues, compilation warnings
- **Low:** Edge cases, cosmetic issues, non-blocking warnings

**When to do bug pass:**
- 5+ bugs accumulated
- Critical/High severity bug found
- End of major phase (e.g., after Phase 5)
- Before release/merge to main

**Bug Pass Strategy:**
1. Sort bugs by severity
2. Fix Critical and High first
3. Address Medium if time permits
4. Document Low bugs for future consideration
5. Re-run full test suite after fixes
6. Update this file with "Fixed Bugs" section

---

## Reporting New Bugs

When you discover a bug:

1. **Add entry above** in "Active Bugs" section
2. **Include:**
   - Module name
   - File and line number
   - Severity level
   - Clear description
   - Expected vs actual behavior
   - Impact assessment
   - Priority level
3. **Don't fix immediately** unless Critical
4. **Continue with current work** - bug passes are scheduled
5. **Update bug count** in PORT_LOG_MASTER.md

---

## Bug Tracking Stats

- **Total Active:** 1
- **Total Fixed:** 2
- **By Severity:**
  - Critical: 0
  - High: 0
  - Medium: 0 (2 fixed)
  - Low: 1 (flaky tests)
- **By Phase:**
  - Phase 0 (pre-work): 0 (2 fixed)
  - Phase 1-5: 1 (flaky tests)
- **Last Bug Pass:** 2025-11-07 (after Phase 5 completion)
- **Next Bug Pass:** When 5+ bugs accumulated or before release
