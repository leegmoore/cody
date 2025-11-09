# Phase 5.2: Code Quality & Test Cleanup

## Overview

Phase 5.2 establishes clean code quality baselines by configuring prettier and eslint integration, fixing all lint errors, resolving test failures, and eliminating skipped tests.

**Prerequisites:** Phase 5.1 complete (conversation & history)

## Goals

1. **Prettier + ESLint integration** - Format auto-fixes some lint issues
2. **Zero lint errors** - Clean code quality
3. **Zero TypeScript errors** - Full type safety
4. **All tests passing** - No failures
5. **Zero skipped tests** - Remove, fix, or convert to TODOs

## Current State

**TypeScript:** 65 type errors
**ESLint:** 319 errors (285 errors, 34 warnings)
**Tests:** 1704 passing, 5 failing, 9 skipped

## Success Criteria

**Final state (one command runs all clean):**
```bash
npm run format && npm run lint && npm test
```

**Output:**
- ✅ Prettier: All files formatted
- ✅ ESLint: 0 problems
- ✅ TypeScript: 0 errors
- ✅ Tests: All passing, 0 skipped

## Approach

### Step 1: Configure Prettier + ESLint

**Current:** ESLint and Prettier might conflict

**Fix:**
- Configure ESLint to defer formatting to Prettier
- Use `eslint-config-prettier` to disable formatting rules
- ESLint focuses on code quality only
- Prettier handles all formatting

### Step 2: Run Format

```bash
npm run format
```

**Fixes automatically:**
- Indentation
- Quote style
- Line length
- Spacing

**May break:**
- Some tests (string comparisons)
- Line-sensitive code

### Step 3: Fix Lint Errors

**Categories:**

**Unused variables (majority):**
- Prefix with `_` if intentionally unused
- Remove if truly unnecessary
- Use if actually needed

**Explicit `any` (50+ occurrences):**
- Replace with proper types
- Use `unknown` if type truly unknown
- Add type assertions where needed

**`{}` type usage:**
- Replace with `object` or `unknown` or `Record<string, never>`

**require() statements:**
- Convert to imports

### Step 4: Fix TypeScript Errors

**After lint fixes, remaining type errors:**

**Type mismatches:**
- `total_token_usage` vs `TokenUsage` (Messages adapter)
- `IoError` vs `ApplyPatchError` (apply-patch)
- `string | undefined` issues

**Fix each:**
- Align types with protocol definitions
- Add proper type guards
- Fix union type handling

### Step 5: Fix Test Failures

**5 failing tests:**

**1-2. Git tests (resolveRepositoryRoot):**
- Check git command availability
- Fix path resolution
- Ensure .git detection works

**3-4. QuickJS isolation tests:**
- Fix: Globals bleeding between executions
- Issue: Context not properly reset
- Solution: Proper context disposal

**5. Exec working directory:**
- Fix: cwd not being respected
- Check child_process spawn options

### Step 6: Handle Skipped Tests

**9 skipped tests - review each:**

**Legitimate skip:**
- Feature not implemented yet
- Platform-specific (can't test in current env)
- **Action:** Remove test or mark as TODO in code comments

**Lazy skip:**
- Test hard to write, skipped for convenience
- **Action:** Implement the test

**Awaiting implementation:**
- Test written for feature not yet built
- **Action:** Remove `.skip`, add comment: `// TODO: Implement feature X before enabling`

**Goal:** 0 skipped tests

### Step 7: Verification Cycle

**After all fixes:**
```bash
npm run format  # Should change nothing
npm run lint    # Should report 0 problems
npx tsc --noEmit  # Should report 0 errors
npm test        # Should pass all, skip none
```

**If any fail:**
- Format may have broken tests → fix tests
- Lint may have new issues → fix
- Repeat until all clean

## Execution Order

1. Configure ESLint + Prettier
2. Run format (expect changes)
3. Fix lint errors (manual, ~2-3 hours)
4. Fix TypeScript errors (manual, ~1-2 hours)
5. Fix test failures (manual, ~1 hour)
6. Review skipped tests (manual, ~30 min)
7. Verification cycle (repeat until clean)

## Success Metrics

- ✅ `npm run format` - No changes (already formatted)
- ✅ `npm run lint` - 0 problems
- ✅ `npx tsc --noEmit` - 0 errors
- ✅ `npm test` - 1718+ passing, 0 failing, 0 skipped
