# Bubbletea-TS Reference Guide

## Quick Links to Key Files

### Analysis Documents (In this repo)
These are your starting point:

1. **BUBBLETEA_INDEX.md** (5 min read)
   - Navigation guide for all documents
   - Quick takeaways
   - How to use this analysis

2. **BUBBLETEA_EXECUTIVE_SUMMARY.md** (5 min read)
   - The 5 core success patterns
   - Key metrics
   - Phase 6 checklist

3. **BUBBLETEA_ANALYSIS.md** (30-45 min read)
   - Complete system breakdown
   - 12 major sections
   - Reference document

4. **PHASE6_RECOMMENDATIONS.md** (20-30 min read)
   - Directly applicable patterns
   - Code templates
   - Implementation checklist

### Original Bubbletea-TS Files (Reference)

All files are in: `/Users/leemoore/code/bubbletea-ts/bubbletea-ts/.port-plan/`

#### Planning Documents
- **plan.md** (238 lines)
  - Master blueprint for entire project
  - Phases 0-7 breakdown
  - Module mapping matrix
  - Guiding principles
  - Reference: Read to understand the planning approach

- **progress-log.md** (789 lines)
  - 64 sessions of execution history
  - Reverse-chronological entries
  - Template: `## [DATE] (Session N)` with Done/Next/Blockers
  - Sticky guardrails section at top
  - Reference: Study real session progression

- **decision-log.md** (42 lines)
  - 66 architectural decisions
  - Immutable record with ID, date, title, rationale, status
  - Reference: See decision log pattern

#### Supporting Documents
- **standard-prompt.md** (7 lines)
  - Template prompt for agent restart
  - Reference: Use as template for phase-6-standard-prompt.txt

- **tty-signal-plan.md** (68 lines)
  - Implementation roadmap for TTY/signals
  - Reference: Example of phase-specific planning

- **tty-signal-strategy.md** (88 lines)
  - Deep-dive strategy document
  - Reference: Example of strategy documentation

#### Loop Control
- **codex-loop.zsh** (64 lines)
  - Perpetual loop script
  - Runs `codex exec`, auto-commits, sleeps 30s
  - Reference: Template for phase-6-loop.sh if needed

## The File Structure to Replicate for Phase 6

Create this structure in your codex-port-02 repository:

```
codex-port-02/
├── .port-plan/
│   ├── phase-6-plan.md              # Copy structure from bubbletea's plan.md
│   ├── phase-6-progress-log.md      # Copy template from bubbletea's progress-log.md
│   ├── phase-6-decision-log.md      # Copy format from bubbletea's decision-log.md
│   ├── phase-6-standard-prompt.txt  # Copy style from bubbletea's standard-prompt.md
│   └── phase-6-loop.sh              # (optional) Copy from bubbletea's codex-loop.zsh
│
├── phase-6/
│   ├── api-surface.md               # Document public API contracts
│   ├── cli-flows.md                 # Document expected user workflows
│   └── tool-roadmap.md              # Tool integration planning
│
└── BUBBLETEA_*.md                   # (Reference documents)
    ├── INDEX.md
    ├── EXECUTIVE_SUMMARY.md
    ├── ANALYSIS.md
    └── PHASE6_RECOMMENDATIONS.md
```

## Key Files to Study

### Understand the Pattern
Read in this order:

1. **BUBBLETEA_EXECUTIVE_SUMMARY.md**
   - 5 core success patterns
   - Why they work
   - Immediate checklist

2. **plan.md** (from bubbletea)
   - How planning is organized
   - Phase breakdown
   - Module mapping

3. **progress-log.md** (from bubbletea)
   - Session template
   - Sticky guardrails
   - How Done/Next is formatted

4. **decision-log.md** (from bubbletea)
   - Decision format
   - IDs and status tracking

5. **PHASE6_RECOMMENDATIONS.md**
   - How to adapt for Phase 6
   - Code templates
   - Implementation steps

### Understand the Tests-First Approach
1. Study **tea.test.ts** (805 lines)
   - How contract tests are written
   - Message type checking patterns
   - Fake infrastructure usage

2. Study **suspend.test.ts**
   - Real-world example of feature testing
   - How Go specs are translated to Vitest

3. Study **exec.test.ts**
   - Another real-world example
   - Command execution patterns

## Session Execution Pattern (From Real Logs)

Example from Session 64:

```
## 2025-11-15 (Session 64)

- **Completed:**
  - Fixed the repo-level Vitest wiring
  - Repaired the input/mouse runtime
  - Executed the full Phase 6.5 verification chain

- **What's Next (priority order):**
  1. Translate the Go ReleaseTerminal/RestoreTerminal specs
  2. With the new specs in place, update the TypeScript TTY/signal plumbing
  3. Keep the Phase 6.5 gate green

- **Blockers/Risks:**
  - None; Phase 6.5 chain is green locally
```

**Copy this template for Phase 6 sessions.**

## The Decision Log Pattern

From bubbletea's decision-log.md:

```
| ID    | Date       | Title                           | Decision                  | Status |
|-------|------------|---------------------------------|---------------------------|--------|
| D-054 | 2025-11-15 | Suspend process bridge strategy | Implemented Unix-only ... | Final  |
| D-055 | 2025-11-15 | Formatter spec extraction       | Moved the Printf suite ... | Final  |
```

**For Phase 6, use P6D-001, P6D-002, etc.**

## Quality Gate Pattern

From bubbletea's Phase 6.5:

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

**For Phase 6 (in codex-ts/):**

```bash
npm run format && npm run lint && npx tsc --noEmit && npm run build && npm test
```

**Critical rule:** If ANY stage fails, restart the entire chain from format.

## Guardrails Template

From bubbletea's progress-log.md (sticky section):

```markdown
## Phase 6 Guardrails (sticky)

- Keep plan/progress/decision docs in sync
- Prioritize locally executable tasks only
- OUT OF SCOPE FOR PHASE 6:
  - [list of deferred items]
  - [platform constraints]
  - [dependencies not ready]
- Session ritual:
  1. Read phase-6-plan.md, progress-log.md, decision-log.md
  2. Execute "What's Next"
  3. Update progress log with Done/Next
  4. Log any decisions
  5. Git commit
```

**Copy this pattern to phase-6-progress-log.md at the top.**

## Key Metrics to Track (for Phase 6)

From bubbletea's success:

- **Sessions:** X (track cumulative)
- **Tests Passing:** Y (should increase monotonically)
- **Lint Errors:** 0 (before phase completion)
- **Type Errors:** 0 (before phase completion)
- **Decisions Logged:** Z (immutable record)
- **Git Commits:** X (one per session)

## One-Time Setup Checklist

Before starting Phase 6:

```bash
# 1. Create .port-plan/phase-6/ subdirectory
mkdir -p .port-plan/phase-6/

# 2. Create the three state documents
touch .port-plan/phase-6-plan.md
touch .port-plan/phase-6-progress-log.md
touch .port-plan/phase-6-decision-log.md

# 3. Create deep-dive strategy documents
touch phase-6/api-surface.md
touch phase-6/cli-flows.md

# 4. Create contract tests (in mocked-service/)
mkdir -p codex-ts/tests/mocked-service/phase-6

# 5. (optional) Create perpetual loop script
touch .port-plan/phase-6-loop.sh
chmod +x .port-plan/phase-6-loop.sh

# 6. Create standard prompt (if running loop)
touch .port-plan/phase-6-standard-prompt.txt
```

## Expected Completion State

When Phase 6 is complete, you should have:

```
.port-plan/
├── phase-6-plan.md                     ✅ Complete with all objectives
├── phase-6-progress-log.md             ✅ Final session with "Phase Complete" note
├── phase-6-decision-log.md             ✅ All P6D-### decisions logged
├── phase-6-standard-prompt.txt         ✅ (if used)

phase-6/
├── api-surface.md                      ✅ Complete public API documented
├── cli-flows.md                        ✅ All CLI workflows documented
└── tool-roadmap.md                     ✅ (if created)

codex-ts/
├── src/cli/                            ✅ All features implemented
├── tests/mocked-service/phase-6/       ✅ All contracts tested
└── [quality gate passing]              ✅ format/lint/typecheck/build/test all green
```

## How to Run the Perpetual Loop (Optional)

If executing multiple Phase 6 sessions:

```bash
cd /Users/leemoore/code/codex-port-02

# Set environment variables
export PROMPT_FILE="${PWD}/.port-plan/phase-6-standard-prompt.txt"
export SLEEP_SECONDS=30

# Run the loop
bash .port-plan/phase-6-loop.sh
```

Each session will:
1. Extract prompt from PROMPT_FILE
2. Run `codex exec`
3. Auto-commit changes to git
4. Sleep 30 seconds
5. Repeat

## Troubleshooting

### "Agent lost context / repeated work"
- Check phase-6-progress-log.md was updated at last session end
- Verify standard-prompt.txt tells agent to read the logs
- Add explicit "What's Next" bullets to progress log

### "Scope creep / work on out-of-scope tasks"
- Review guardrails section at top of progress-log.md
- Add explicit "OUT OF SCOPE FOR PHASE 6" markers
- Update standard prompt to mention guardrails

### "Tests diverging from requirements"
- Create mocked-service tests BEFORE implementation
- Write test contract, then implement
- Never implement without a test first

### "Quality gate failures at end of phase"
- Run full chain earlier and more often
- Don't batch fixes—fix immediately when failures appear
- Restart full chain if any stage fails

## Reference Repositories

### Bubbletea-TS (Reference Implementation)
- Location: `/Users/leemoore/code/bubbletea-ts/bubbletea-ts/`
- Key files: `.port-plan/` directory
- Study: plan.md, progress-log.md, decision-log.md for patterns

### Codex-Port (Current Project)
- Location: `/Users/leemoore/code/codex-port-02/`
- Phase 1-5: Already complete (21 modules ported)
- Phase 6: Your target (CLI integration & library API)

## Success Indicators

When Phase 6 is done correctly, you will have:

1. ✅ Complete decision log (20-30 decisions documented)
2. ✅ Complete progress log (10-20 sessions documented)
3. ✅ 100% mocked-service test coverage of critical paths
4. ✅ 0 lint errors
5. ✅ 0 type errors
6. ✅ All tests passing
7. ✅ Public API fully documented
8. ✅ Perfect git history (one commit per session)

This mirrors bubbletea's completion: 64 sessions, 934 tests, 0 errors, clean handoff.

