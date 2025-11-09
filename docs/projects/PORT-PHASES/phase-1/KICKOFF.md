# Phase 1 Kickoff Prompt

Use this prompt to start a new agent session for Phase 1 work.

---

## Prompt Template

```
I'm working on Phase 1 of porting the Codex Rust codebase to TypeScript.

PROJECT CONTEXT:
- Read PORT-PLAN.md for the overall port strategy
- Read PORT-PHASES/phase-1/README.md for detailed Phase 1 requirements
- Read API-DESIGN.md for the target API we're building toward

PHASE 1 GOALS:
Complete the protocol layer by porting all remaining protocol/* modules with comprehensive tests.

YOUR TASKS:
1. Read PORT-PHASES/phase-1/CHECKLIST.md - this is your task list
2. Read PORT-PHASES/phase-1/STATUS.md - this tracks progress
3. Work through the checklist systematically
4. Update CHECKLIST.md as you complete items (check them off)
5. Update STATUS.md after each work session with:
   - What you completed
   - What's in progress
   - Any blockers or decisions
   - Hours spent
6. Record technical decisions in DECISIONS.md

WORKING APPROACH:
- Port tests first or alongside implementation (TDD)
- Verify each module's tests pass before moving to next
- Check types against sdk/typescript/src/*.ts for compatibility
- Run full test suite frequently
- Keep test pass rate at 100%

INTEGRATION TESTING:
Phase 1 must include integration tests that verify protocol types work together:
- Round-trip serialization tests
- SDK type compatibility tests
- Golden file tests (compare against Rust output)

REPORTING:
After each work session, provide:
1. Summary of completed modules
2. Test statistics (written / passing)
3. Updated checklist status
4. Any technical decisions or blockers
5. Remaining work for phase completion

Start by reading all the Phase 1 documentation, then begin with the smallest module to build momentum.
```

---

## Expected Agent Workflow

1. **Session Start**
   - Read PORT-PLAN.md
   - Read phase-1/README.md
   - Read phase-1/CHECKLIST.md
   - Read phase-1/STATUS.md

2. **Work Loop**
   - Pick next unchecked task from CHECKLIST
   - Port the module (implementation + tests)
   - Verify tests pass
   - Check off task in CHECKLIST
   - Update STATUS.md

3. **Session End**
   - Update STATUS.md with session summary
   - Report progress to user
   - Identify next steps

4. **Phase Complete**
   - All CHECKLIST items checked
   - All tests passing
   - Documentation updated
   - Ready for commit

---

## Success Indicators

Agent should report:
- ✅ Module count: X/8 complete
- ✅ Test count: Y/80+ passing
- ✅ No TypeScript errors
- ✅ No linter warnings
- ✅ Integration tests passing
- ✅ SDK compatibility verified

---

## Tips for Agent

- Start with small modules (account, message-history) to build momentum
- Leave protocol.ts for last (it's the largest)
- Keep test pass rate at 100% throughout
- Don't skip integration tests
- Update documentation as you go
- Record decisions immediately in DECISIONS.md
