# CURRENT.md - Active Slice

**Last Updated:** 2025-11-26

---

## Slice: Tool Call Integration Test - IN VERIFICATION

### The ONE Thing
Add tool call integration test to tdd-api suite, validating complete tool execution flow.

### Done When
- [x] Spec created (`projects/01-api/002-more-tdd-tests/SPEC.md`)
- [x] Coder prompt generated
- [x] Verifier prompt generated
- [x] Coder implemented the test
- [ ] Verifier approved

### What's Being Verified
- `simple-prompt.test.ts` renamed to `openai-prompts.test.ts`
- New test: tool calls (pwd + ls) with >= 2 function_call assertions
- Detailed hydrated vs persisted comparison (field-by-field by item type)
- call_id matching between function_call and function_call_output
- Tests run in parallel, complete within 20 second timeout
- typecheck script added to package.json

### Key Decisions Made
- Keep timeout at 20 seconds (tool calls take longer)
- Assert >= 2 tool calls (not ==2) to allow for retries
- Compare all fields by output item type (message, function_call, function_call_output)
- Exclude timestamp fields from comparison

---

## Previous Slice: Test Strategy & Baseline - COMPLETE ✓

**Outcome:** New test suite created at `test-suites/tdd-api/`

- Test strategy: Full integration, no mocks
- Baseline test: submit → stream → persist → verify
- 4 connectivity checks (Redis, Convex, OpenAI, Fastify)
- ResponseReducer hydration with persisted comparison

---

## Session Notes

**2025-11-26 (evening):**
- Spec'd 002-more-tdd-tests (tool call integration)
- Enhanced prompt-assembly with `--output` flag for custom paths
- Moved legacy tests to `tests-old-notused/` (gitignored)
- Coder completed implementation
- Awaiting verifier result

**2025-11-26 (afternoon):**
- Implemented tdd-api test suite (Phase 1)
- Phase 1 complete
