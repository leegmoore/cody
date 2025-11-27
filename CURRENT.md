# CURRENT.md - Active Slice

**Last Updated:** 2025-11-26

---

## Slice: Test Strategy & Baseline - COMPLETE ✓

### The ONE Thing
~~Evaluate test harness strategy and establish 2 baseline tests (with/without tools)~~

**Outcome:** New test suite created at `test-suites/tdd-api/`

### Done When
- [x] Test strategy decided → New suite, full integration, no mocks
- [x] Baseline test implemented and passing
  - Submit "hi cody" → stream → persist → verify
  - Includes ResponseReducer hydration comparison
- [x] Tests verify real behavior (4 connectivity checks, no infrastructure mocks)
- [x] Ready to add history tests

### What Was Delivered
- `test-suites/tdd-api/validate-env.ts` - 4 connectivity checks
- `test-suites/tdd-api/simple-prompt.test.ts` - Full integration test
- `test-suites/tdd-api/README.md` - Documentation
- `package.json` - Added `test:tdd-api` script

### Key Decisions Made
- No mocks, no shims, no special config - full integration only
- Connectivity checks (not env var pre-checks) for validation
- Use ResponseReducer to hydrate stream events
- Compare hydrated response to persisted run
- Strong typing (no `any` types)
- Polling for persistence (not fixed wait)

---

## Next Slice

**Phase 2: OpenAI Full Support** - Add multi-turn history test (will fail), then implement

See NEXT.md for details.

---

## Session Notes

**2025-11-26:**
- Spec'd tdd-api test suite with planner
- Coder implemented with verifier checkpoint
- Resolved Convex URL confusion (connectivity check, not env var check)
- Added ResponseReducer hydration and comparison assertions
- Test passing, no timeouts, no hangs
- Phase 1 complete
