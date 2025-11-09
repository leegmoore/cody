# Phase 5.2 Checklist

**Status:** Not Started

---

## Step 1: Configure Prettier + ESLint Integration

- [ ] Install eslint-config-prettier: npm install --save-dev eslint-config-prettier
- [ ] Update .eslintrc.json to extend prettier config
- [ ] Disable ESLint formatting rules
- [ ] Verify: ESLint focuses on code quality, Prettier on formatting
- [ ] Test: Run format, then lint - no conflicts

---

## Step 2: Run Format (Baseline)

- [ ] Run: npm run format
- [ ] Review changes (expect many files changed)
- [ ] Commit: "chore: prettier format baseline"
- [ ] Note: Tests may break from formatting changes

---

## Step 3: Fix Lint Errors (Manual)

### Unused Variables (~150 errors)
- [ ] Prefix with _ if intentionally unused
- [ ] Remove if unnecessary
- [ ] Use if actually needed
- [ ] Run lint after each batch of fixes

### Explicit `any` Types (~50 errors)
- [ ] Replace with proper types
- [ ] Use `unknown` if type unknown
- [ ] Add type guards where needed

### `{}` Type Usage (~10 errors)
- [ ] utils/cache/index.ts: Replace {} with object or unknown
- [ ] Fix all occurrences

### require() Statements
- [ ] utils/git: Convert require to import
- [ ] Fix all occurrences

### Final Lint Check
- [ ] Run: npm run lint
- [ ] Should report: 0 problems
- [ ] Commit: "fix: resolve all lint errors"

---

## Step 4: Fix TypeScript Errors (Manual)

### Critical Type Mismatches
- [ ] Messages adapter: Fix total_token_usage → proper TokenUsage
- [ ] Apply-patch: Fix IoError type compatibility
- [ ] Chat-completions: Fix string | undefined handling
- [ ] Client: Fix ReasoningSummary type

### Unused Imports
- [ ] Remove or use unused imports
- [ ] Clean up type-only imports

### Implicit Any
- [ ] Add explicit types
- [ ] Fix tool-result-builder parameter types

### Final TypeCheck
- [ ] Run: npx tsc --noEmit
- [ ] Should report: 0 errors
- [ ] Commit: "fix: resolve all TypeScript errors"

---

## Step 5: Fix Test Failures

### Git Tests (2 failures)
- [ ] utils/git: resolveRepositoryRoot tests
- [ ] Check git command available
- [ ] Fix .git directory detection
- [ ] Verify tests passing

### QuickJS Isolation (2 failures)
- [ ] script-harness/runtime: Context isolation
- [ ] Fix: State bleeding between executions
- [ ] Proper context disposal/reset
- [ ] Verify tests passing

### Exec Working Directory (1 failure)
- [ ] core/exec: cwd not respected
- [ ] Fix spawn options
- [ ] Verify tests passing

### Final Test Check
- [ ] Run: npm test
- [ ] Should report: 0 failures
- [ ] Commit: "fix: resolve test failures"

---

## Step 6: Review Skipped Tests (9 total)

### Find All Skipped
- [ ] Run: npm test -- --reporter=verbose | grep -i skip
- [ ] List each with reason

### For Each Skipped Test
- [ ] Determine category:
  - Legitimate skip (platform-specific, not applicable)
  - Lazy skip (hard test, skipped for convenience)
  - Awaiting implementation (feature not built)

### Actions
- [ ] Legitimate: Remove test
- [ ] Lazy: Implement test
- [ ] Awaiting: Remove .skip, add TODO comment in code
- [ ] Document decision for each

### Final Skip Check
- [ ] Run: npm test
- [ ] Should report: 0 skipped
- [ ] Commit: "fix: resolve all skipped tests"

---

## Step 7: Verification Cycle

### Run All Checks
- [ ] npm run format (should change nothing)
- [ ] npm run lint (should report 0 problems)
- [ ] npx tsc --noEmit (should report 0 errors)
- [ ] npm test (should pass all, skip none)

### If Any Fail
- [ ] Identify what broke
- [ ] Fix issues
- [ ] Re-run cycle
- [ ] Repeat until all clean

### Final Verification
- [ ] All 4 commands clean in single run
- [ ] Commit: "chore: verify clean code quality baseline"

---

## Final

- [ ] 0 lint errors
- [ ] 0 TypeScript errors
- [ ] 0 test failures
- [ ] 0 skipped tests
- [ ] Format/lint/type/test all clean
- [ ] Update PORT_LOG_MASTER.md
- [ ] Commit and push
- [ ] Phase 5.2 COMPLETE!
