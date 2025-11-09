# Phase 1: Quick Start Guide

## New Session? Start Here! 👋

If you're a new agent session starting Phase 1 work, follow this guide.

---

## Step 1: Read Context (5 minutes)

Read these documents in order:

1. **[PORT-PLAN.md](../../PORT-PLAN.md)** - Overall port strategy (skim, 2 min)
2. **[API-DESIGN.md](../../API-DESIGN.md)** - Target API we're building (skim, 2 min)
3. **[README.md](./README.md)** - Phase 1 detailed plan (read carefully, 5 min)

---

## Step 2: Review Tasks (3 minutes)

1. **[CHECKLIST.md](./CHECKLIST.md)** - Your complete task list
2. **[STATUS.md](./STATUS.md)** - Current progress

Look for:
- ✅ What's already done
- ⬜ What's next
- 🚫 Any blockers

---

## Step 3: Work Strategy

### Order of Operations

Port modules in this order (smallest to largest):

1. **protocol/account.ts** (20 lines, ~1 hour)
2. **protocol/message-history.ts** (11 lines, ~1 hour)
3. **protocol/custom-prompts.ts** (20 lines, ~1-2 hours)
4. **protocol/plan-tool.ts** (28 lines, ~1-2 hours)
5. **protocol/config-types.ts** (87 lines, ~2-3 hours)
6. **protocol/items.ts** (159 lines, ~4-5 hours) ⚠️ Must match SDK!
7. **protocol/models.rs** (690 lines, ~6-8 hours)
8. **protocol/protocol.ts** (1560 lines, ~8-10 hours) ⚠️ Largest!

### For Each Module

1. ✅ Read Rust source in `codex-rs/protocol/src/`
2. ✅ Create TypeScript file in `codex-ts/src/protocol/`
3. ✅ Create test file (`.test.ts`)
4. ✅ Port types with JSDoc comments
5. ✅ Write tests (min 5-15 per module)
6. ✅ Run tests, verify 100% pass
7. ✅ Check off in CHECKLIST.md
8. ✅ Update STATUS.md

---

## Step 4: Testing Requirements

### Every module needs:
- ✅ Serialization tests (object → JSON)
- ✅ Deserialization tests (JSON → object)
- ✅ Validation tests (invalid data rejected)
- ✅ Edge case tests

### Special requirements:
- **protocol/items.ts**: Must match `sdk/typescript/src/items.ts` types exactly
- **protocol/protocol.ts**: Events must match `sdk/typescript/src/events.ts`

### Test Infrastructure
Create these utilities first:
- `test-utils/protocol-factories.ts` - Factory functions for test data
- `test-utils/test-helpers.ts` - Assertion helpers
- `test-utils/golden-file-utils.ts` - Golden file comparison

---

## Step 5: Update Progress

After each module:

1. Check off tasks in **CHECKLIST.md**
2. Update **STATUS.md** with:
   - Module name and status
   - Test count
   - Any issues or decisions
3. Record decisions in **DECISIONS.md**

---

## Step 6: Session End

Before ending your session:

1. Run full test suite: `pnpm test`
2. Verify no TypeScript errors: `pnpm build`
3. Update STATUS.md with session summary:
   - Modules completed
   - Test statistics
   - Hours spent
   - Next steps
4. Report to user with progress summary

---

## Quick Commands

```bash
# Run tests
cd codex-ts
pnpm test

# Run tests for specific file
pnpm test protocol/account.test.ts

# Run tests in watch mode
pnpm test --watch

# Build TypeScript
pnpm build

# Lint
pnpm lint
```

---

## Success Indicators

Phase 1 is complete when:
- ✅ 8 protocol modules ported
- ✅ 80+ tests passing
- ✅ 100% test pass rate
- ✅ SDK type compatibility verified
- ✅ Golden file tests created
- ✅ All CHECKLIST items checked
- ✅ Documentation updated

---

## Need Help?

- **Can't find Rust source?** Look in `codex-rs/protocol/src/`
- **Test failing?** Check similar tests in existing modules
- **Type mismatch?** Compare with `sdk/typescript/src/*.ts`
- **Unclear requirement?** Check README.md or DECISIONS.md

---

## Example Agent Session Flow

```
1. Read START-HERE.md ← You are here
2. Read README.md for context
3. Review CHECKLIST.md
4. Start with protocol/account.ts
5. Port implementation + tests
6. Verify tests pass
7. Check off in CHECKLIST.md
8. Update STATUS.md
9. Move to next module
10. Repeat until phase complete
11. Report final summary
```

---

## Ready? Let's Go! 🚀

Start with **protocol/account.ts** - it's the smallest module and a great warm-up.

Open `codex-rs/protocol/src/account.rs` and let's port it!
