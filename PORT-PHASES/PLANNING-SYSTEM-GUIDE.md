# Planning & Execution System Guide

**Purpose:** Documentation of the phased planning and agent execution system used for the Codex TypeScript port.

**Date:** November 8, 2025
**Version:** 1.0

---

## Overview

This document describes the planning and execution system used to coordinate multiple stateless AI coding agents across a large, multi-month porting and development project. The system enables consistent, traceable, resumable work through structured documentation and standardized artifacts.

**Key Principles:**
- Stateless agents (no memory between sessions)
- Persistent state via markdown logs
- Clear handoff between sessions
- Progressive refinement
- Quality standards enforced

---

## How the System Works

### Agent Model

**Characteristics:**
- **Stateless:** Each session starts fresh (no memory of previous work)
- **One-shot:** Session does work, ends, results committed
- **Resumable:** Next session reads logs to continue
- **Coordinated:** Multiple agents can work on different phases simultaneously

**Implications:**
- State must be externalized (markdown files)
- Instructions must be complete and self-contained
- Progress tracking critical for resumption

### Workflow Cycle

```
Planning → Documentation → Execution → Logging → Review → Repeat

1. PLANNING
   - Define phase scope
   - Break into tasks
   - Identify dependencies
   - Set success criteria

2. DOCUMENTATION
   - Create phase directory
   - Write README (overview)
   - Write CHECKLIST (granular tasks)
   - Write STATUS (progress tracking)
   - Write QUICK_START (session kickoff prompt)

3. EXECUTION
   - Agent reads all docs
   - Follows checklist
   - Implements features
   - Runs tests

4. LOGGING
   - Agent updates CHECKLIST (checks off tasks)
   - Agent updates STATUS (session log)
   - Agent commits work
   - Agent reports summary

5. REVIEW
   - Human reviews output
   - Validates quality
   - Identifies issues
   - Plans next phase

6. REPEAT
   - Next session resumes from logs
   - Or next phase begins
```

### State Management

**Problem:** Agents are stateless
**Solution:** Markdown logs as persistent memory

**Logs serve as:**
- Memory (what's done, what's next)
- Checklist (what remains)
- History (what happened, decisions made)
- Handoff (between sessions, between agents)

---

## Phase Structure

### Directory Layout

```
PORT-PHASES/
├── README.md                    # Navigation guide
├── PLANNING-SYSTEM-GUIDE.md    # This document
├── phase-1/
│   ├── README.md               # Phase overview
│   ├── CHECKLIST.md            # Detailed tasks
│   ├── STATUS.md               # Progress log
│   ├── DECISIONS.md            # Technical decisions
│   ├── KICKOFF.md or QUICK_START.txt  # Session prompt
│   └── [other phase-specific docs]
├── phase-2/
│   └── ...
└── ...
```

### Artifact Purpose

**README.md** (Phase Overview)
- What this phase accomplishes
- Why it's needed
- What modules/features included
- Dependencies on other phases
- Success criteria
- Estimated scope

**CHECKLIST.md** (Granular Tasks)
- Step-by-step tasks for agent
- Checkbox format for tracking
- Grouped by module or feature
- Specific enough to execute
- ~100-200 tasks per phase

**STATUS.md** (Progress Tracking)
- Current completion percentage
- Module status table
- Session logs (what was done each session)
- Blockers and issues
- Next steps

**DECISIONS.md** (Technical Choices)
- Why certain approaches chosen
- Alternatives considered
- Trade-offs documented
- Rationale preserved

**QUICK_START.txt** (Session Kickoff Prompt)
- Complete prompt for new agent session
- All context needed
- File reading order
- Workflow instructions
- Before-ending checklist

---

## Required Artifacts Per Phase

### Minimum (Every Phase)

**1. README.md**
```markdown
# Phase N: [Name]

## Overview
[What this phase does]

## Goals
[Numbered list of objectives]

## Modules/Features
[What's being built]

## Success Criteria
[How to know phase is complete]
```

**2. CHECKLIST.md**
```markdown
# Phase N Checklist

**Status:** Not Started | In Progress | Complete

## Prerequisites
- [x] Phase N-1 complete
- [ ] Review phase plan

## Task Category 1
- [ ] Specific task
- [ ] Another task
...

## Final
- [ ] All tests passing
- [ ] Update logs
- [ ] Commit and push
```

**3. STATUS.md**
```markdown
# Phase N Status Log

**Status:** Not Started | In Progress | Complete
**Start Date:** _TBD_

## Progress Overview
- Modules: X / Y
- Tests: N passing

## Session Log
### [Date] - Session [N]
**Completed:** [what was done]
**Next:** [what's next]
```

**4. QUICK_START.txt**
```
ROLE: [What agent is doing]
PROJECT: [Context]
PHASE: [Current phase]
PREREQUISITES: [What's complete]

FIRST: Read [list of docs]
TASKS: [What to do]
WORKFLOW: [How to do it]
BEFORE ENDING: [Update logs, commit]
```

### Optional (When Needed)

**DECISIONS.md** - For phases with technical choices
**WORKPLAN.md** - For complex phases needing sub-stages
**MIGRATION_GUIDE.md** - For porting from external code

---

## Session Prompt Template

**Every QUICK_START should contain:**

```
===== COPY THIS INTO FRESH CLAUDE CODE SESSION =====

ROLE: [Developer role - TypeScript developer, etc.]

PROJECT: [Project context - what we're building]

STRATEGY: [Approach - TDD, faithful port, etc.]

CURRENT PHASE: Phase N - [Name] ([scope summary])

PREREQUISITES:
- Phase N-1 ✅ COMPLETE ([what it delivered])

NOTE: Workspace is [path]

FIRST: Read status (to know where we are)
- Read [STATUS.md path]
- Read [CHECKLIST.md path]
- Read [README.md path]

TASKS: [List of what to do]

WORKFLOW: [Step-by-step process]

BEFORE ENDING SESSION:
1. Update CHECKLIST.md (check off completed)
2. Update STATUS.md (session log)
3. Update PORT_LOG_MASTER.md (overall status)
4. git add -A && git commit -m "phaseN: [what you did]" && git push
5. Report to user: [what to report]

START with [where to begin]
```

**Key elements:**
- Role/context setting
- What's already done (prerequisites)
- What to read first (state loading)
- What to do (tasks)
- How to do it (workflow)
- What to update before ending (state persistence)

---

## Lessons Learned

### Critical Success Factors

**1. Complete Context in Prompt**
- Agent has no memory
- Prompt must contain ALL necessary info
- File reading order matters
- Missing context = confused agent

**2. Granular Checklists**
- Break work into small tasks
- Each task checkable
- Progress visible
- Agent knows what's done/remaining

**3. Log Updates Mandatory**
- Agent MUST update logs before ending
- Logs are the memory
- Without updates: Next session lost
- Enforce in "BEFORE ENDING" section

**4. Standards Enforcement**
- Code quality requirements in every phase
- Not optional, not "nice to have"
- Agent responsible for entire codebase
- Pre-existing issues must be fixed

**5. Session Resumability**
- STATUS.md must show current state
- CHECKLIST.md must show progress
- Agent reads these FIRST
- Can pick up exactly where left off

### Common Pitfalls

**Agent skips reading STATUS:**
- Starts from beginning
- Duplicates work
- **Fix:** Emphasize STATUS.md in FIRST section

**Agent doesn't update logs:**
- Next session lost
- No progress tracking
- **Fix:** Mandatory in BEFORE ENDING checklist

**Agent declares done with issues:**
- "Not my responsibility" attitude
- Leaves problems for later
- **Fix:** Explicit standards, verification command required

**Agent assumes rather than reads:**
- Skips doc reading
- Guesses what to do
- **Fix:** Clear instruction order, emphasize reading

**Incomplete prompts:**
- Missing context
- Agent can't complete work
- **Fix:** Template ensures all sections present

---

## Code Quality Standards

### Established During Project

**These standards must be met in EVERY phase:**

### TypeScript Standards

**1. Zero Type Errors**
- `npx tsc --noEmit` must report 0 errors
- Includes pre-existing errors, not just new code
- No implicit `any` types allowed
- Proper type annotations required

**2. Explicit Typing**
```typescript
// ✅ Good
function processData(input: string): Result {
  return {success: true, data: input};
}

// ❌ Bad
function processData(input) {  // Implicit any
  return {success: true, data: input};
}
```

**3. No `any` Types**
```typescript
// ✅ Good
function parse(data: unknown): ParsedData {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  throw new Error('Invalid data');
}

// ❌ Bad
function parse(data: any): any {
  return JSON.parse(data);
}
```

### ESLint Standards

**1. Zero Lint Problems**
- `npm run lint` must report 0 problems
- All errors AND warnings resolved
- Includes pre-existing issues

**2. Unused Variables**
```typescript
// ✅ Good
function example(_unusedParam: string) {
  // Intentionally unused, prefixed with _
}

// ❌ Bad
function example(unusedParam: string) {
  // Lint error: unused parameter
}
```

**3. No Explicit any**
- Use proper types
- Use `unknown` if type truly unknown
- Add type guards/assertions

**4. ESM Imports Only**
```typescript
// ✅ Good
import { readFile } from 'node:fs/promises';

// ❌ Bad
const readFile = require('fs').promises.readFile;
```

### Testing Standards

**1. Zero Test Failures**
- All tests must pass
- No exceptions for "flaky" tests
- Fix or remove failing tests

**2. Zero Skipped Tests**
```typescript
// ❌ Bad
test.skip('this test is hard', () => {
  // Skipped because lazy
});

// ✅ Good - Remove if not needed
// ✅ Good - Implement if needed
// ✅ Good - If awaiting feature:
// TODO: Implement feature X before enabling this test
// test('feature X works', () => { ... })
```

**3. Test Coverage**
- New code requires tests
- Minimum 80% coverage for new modules
- Integration tests for workflows

### Formatting Standards

**1. Prettier Compliance**
- `npm run format` must make no changes
- All code already formatted
- Consistent style throughout

**2. Prettier Configuration**
```json
{
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "trailingComma": "es5"
}
```

**3. ESLint Defers to Prettier**
- No formatting rules in ESLint
- ESLint for code quality only
- Use `eslint-config-prettier`

### Git Standards

**1. Atomic Commits**
- One logical change per commit
- Clear commit messages
- Reference phase in message

**2. Commit Message Format**
```
phaseN: [description]
feat(module): [description]
fix(module): [description]
docs: [description]
chore: [description]
```

**3. Regular Commits**
- After each module
- After major task completion
- Don't wait until end of phase

---

## Verification Process

### Per-Phase Verification

**Before declaring phase complete:**

```bash
# 1. Format check
npm run format
# Should output: No file changes

# 2. Lint check
npm run lint
# Should output: 0 problems

# 3. Type check
npx tsc --noEmit
# Should output: 0 errors

# 4. Test check
npm test
# Should output: All passing, none skipped
```

**If ANY fail:**
- Phase is NOT complete
- Issues must be resolved
- Re-run verification
- Document if blocking issues need user input

### Full Codebase Responsibility

**Agent is responsible for:**
- New code added in phase
- Pre-existing code touched by changes
- Pre-existing errors that block new code
- Pre-existing errors period (in Phase 6 and quality phases)

**Agent is NOT done until:**
- Entire codebase passes all checks
- Not just "my code is clean"
- Not just "tests I wrote pass"
- EVERYTHING is clean

---

## Standards Summary

### Code Quality Checklist (Every Phase)

**Before declaring complete:**
- [ ] `npm run format` → No changes
- [ ] `npm run lint` → 0 problems
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test` → All pass, none skip
- [ ] `git status` → All committed
- [ ] CHECKLIST.md → Updated
- [ ] STATUS.md → Session logged
- [ ] PORT_LOG_MASTER.md → Updated

**If any fail:**
- [ ] Document issue
- [ ] Fix or discuss with user
- [ ] Do NOT declare complete

### Communication Standards

**Agent must report:**
- What was completed
- What tests were added/pass
- Any issues encountered
- What's next

**Agent must discuss before:**
- Declaring complete with known issues
- Skipping tests
- Leaving lint/type errors
- Making major technical decisions

**Agent must NOT:**
- Assume pre-existing errors are "not my problem"
- Skip verification steps
- Commit without updating logs
- Declare done prematurely

---

## Session Handoff Process

### At Session End

**Agent checklist:**
1. Update CHECKLIST.md (check off completed tasks)
2. Update STATUS.md (session log with details)
3. Commit all work
4. Push to branch
5. Report to user (summary, metrics, next steps)

**STATUS.md session log format:**
```markdown
### [Date] - Session [N]

**Completed:**
- Module X (Y tests)
- Feature A implemented
- Bug B fixed

**In Progress:**
- Module Z (partial)

**Blocked:**
- Issue with dependency D

**Next:**
- Complete module Z
- Start module W
```

### At Session Start

**Agent checklist:**
1. Read STATUS.md (understand current state)
2. Read CHECKLIST.md (see what's done/remaining)
3. Read README.md (understand phase goals)
4. Continue from where previous session left off
5. Do NOT restart from beginning

**If STATUS shows blocking issue:**
- Understand the block
- Attempt resolution
- Discuss with user if unclear

---

## Handling Pre-Existing Issues

### Philosophy

**In early phases:** Focus on new code quality
**In quality phases (5.2):** Fix everything
**In final phase (6):** Everything must be clean

### Approach by Phase Type

**Feature Phases (1-5.1):**
- New code must be clean
- Pre-existing issues: Note but don't block
- Exception: If pre-existing blocks new work, fix it

**Quality Phase (5.2):**
- Fix ALL lint errors (319)
- Fix ALL type errors (65)
- Fix ALL test failures (5)
- Resolve ALL skipped tests (9)
- Entire codebase clean

**Final Phase (6):**
- Maintain cleanliness from 5.2
- No new issues introduced
- Full verification required

### Resolution Guide

**Unused variables:**
- Remove if truly unused
- Prefix with _ if intentionally unused
- Use if should be used

**Explicit any:**
- Replace with proper type
- Use unknown if type unknown
- Add type guard

**Type mismatches:**
- Align types with protocol
- Add assertions where safe
- Fix source of mismatch

**Test failures:**
- Fix the test if test is wrong
- Fix the code if code is wrong
- Remove test if not applicable

**Skipped tests:**
- Remove if not needed
- Implement if lazy skip
- Convert to TODO if awaiting feature (not .skip)

---

## Documentation Standards

### README.md Requirements

**Must include:**
- Phase number and name
- Overview (2-3 paragraphs)
- Goals (numbered list)
- Modules/features (what's being built)
- Dependencies (what's required first)
- Success criteria (functional + quality)
- Porting order (if applicable)

**Should be:**
- Clear and concise
- Focused on this phase
- Self-contained (don't require reading other docs to understand)

### CHECKLIST.md Requirements

**Must include:**
- Status indicator (Not Started | In Progress | Complete)
- Prerequisites section
- Tasks grouped by module/feature
- Granular enough to track progress (not "implement X" but "create file, write function, add tests")
- Final section (verification, updates, commit)

**Checkboxes:**
- `- [ ]` for incomplete
- `- [x]` for complete
- Agent updates as work progresses

### STATUS.md Requirements

**Must include:**
- Current status
- Progress metrics (modules, tests)
- Session log section
- Module status table

**Session log must include:**
- Date
- What was completed
- What's in progress
- What's blocked
- Next steps
- Hours spent (optional)

**Updated:**
- After each session
- Before committing
- Agent's responsibility

### QUICK_START Requirements

**Must include:**
- Role definition
- Project context
- Current phase description
- Prerequisites (what's done)
- Files to read FIRST
- Tasks to complete
- Workflow steps
- BEFORE ENDING checklist (mandatory)

**Format:**
- `===== COPY THIS INTO FRESH SESSION =====` header
- Clear sections
- Explicit file paths
- No ambiguity

---

## Multi-Project Structure

### Organization

**PORT-PHASES/** - Rust port (Phases 1-6)
- Goal: Faithful TypeScript port
- Phases 1-5.2: Individual modules
- Phase 6: Final integration

**ui-integration-phases/** - Core wiring (8 phases)
- Goal: Wire ported modules into CLI
- Progressive integration
- Library + API specs evolve

**scripting-toolcalls-phases/** - Script harness (5 phases)
- Goal: Integrate script execution
- Build on core system

**history-gradient-phases/** - Compression system (5 phases)
- Goal: Multi-fidelity memory
- Requires database

**offline-memory-phases/** - Background processing (5 phases)
- Goal: Knowledge extraction
- Requires gradient system

**context-preprocessing-phases/** - Dynamic injection (5 phases)
- Goal: Intelligent context assembly
- Requires offline processing

### Project Dependencies

```
PORT-PHASES (1-6)
    ↓
ui-integration-phases (1-8)
    ↓
scripting-toolcalls-phases (1-5)
    ↓
history-gradient-phases (1-5)
    ↓
offline-memory-phases (1-5)
    ↓
context-preprocessing-phases (1-5)
```

**Each project builds on previous.**

---

## Example: Successful Phase Execution

### Phase 4.5 - Tool Migration

**Planning:**
- Identified: Need 4 tools from codex-port
- Created: Migration guide with exact steps
- Staged: Files in repo (.migration-staging/)
- Documented: Bun→Node.js conversion, import changes, type mappings

**Execution:**
- Agent read migration guide
- Copied files from staging
- Adapted imports, types, runtime
- Added tests
- Registered tools

**Logging:**
- CHECKLIST: All tasks checked off
- STATUS: Session log with details
- Commits: Per tool, clear messages

**Result:**
- 4 tools migrated successfully
- All tests passing
- Clean integration
- Ready for next phase

**Success factors:**
- Complete migration guide (no ambiguity)
- Files in repo (no external dependencies)
- Clear acceptance criteria
- Agent had everything needed

---

## Anti-Patterns to Avoid

**❌ Vague tasks:**
```markdown
- [ ] Implement feature X
```
**✅ Specific tasks:**
```markdown
- [ ] Create src/feature-x/index.ts
- [ ] Implement function doX()
- [ ] Add error handling
- [ ] Create tests (15 tests)
- [ ] Verify passing
```

**❌ Missing context:**
```
TASK: Port module X
```
**✅ Complete context:**
```
TASK: Port module X
Source: codex-rs/core/src/x.rs (234 lines)
Dependencies: Module Y (already ported)
Approach: Faithful port with strategy pattern
Tests: Port from codex-rs/core/tests/x.rs
```

**❌ No verification:**
```
Implement features, commit, done.
```
**✅ Verification required:**
```
Implement features, run tests, verify passing,
check types, check lint, update logs, then commit.
```

**❌ Optimistic completion:**
```
Agent: "All done! (has 10 lint errors but they're minor)"
```
**✅ Quality-gated completion:**
```
Agent: "Module complete. Running verification...
Lint shows 10 errors. Fixing... All clean. Now complete."
```

---

## Conclusion

This planning and execution system enables large-scale AI-assisted development through:
- Structured phase planning
- Complete session prompts
- Persistent state via markdown
- Quality standards enforcement
- Resumable, traceable work

**Key insight:** Stateless agents can coordinate complex projects when state is externalized and standards are clear.

**Success requires:**
- Comprehensive documentation per phase
- Complete session prompts
- Mandatory log updates
- Quality verification
- Human oversight at phase boundaries

**When followed:** Agents produce high-quality, integrated work across months-long projects.

**This system is the scaffolding that makes AI-assisted development scalable.**
