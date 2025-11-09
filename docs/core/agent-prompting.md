# Coding Agent Prompt Engineering Guide

**Purpose:** Best practices for writing effective prompts for AI coding agents based on lessons learned from the Codex TypeScript port project.

**Author:** Planning Agent (Claude Code)
**Date:** November 8, 2025
**Version:** 1.0

---

## Overview

AI coding agents are stateless, execute in isolation, and have no memory between sessions. Effective prompts must provide complete context, clear instructions, and explicit success criteria. This guide documents patterns that work and pitfalls to avoid.

**Key Insight:** The prompt is the agent's entire world. Everything needed must be in the prompt or in files the prompt tells them to read.

---

## Anatomy of an Effective Coding Agent Prompt

### Essential Sections (In Order)

**1. Role Definition**
**2. Project Context**
**3. Current Phase/Task**
**4. Prerequisites (What's Done)**
**5. Workspace/Location Info**
**6. State Loading Instructions (Read These Files FIRST)**
**7. Task Specification**
**8. Workflow Steps**
**9. Code Quality Standards**
**10. Session Completion Checklist (BEFORE ENDING)**
**11. Starting Point**

**Every section serves a purpose.** Omitting any reduces agent effectiveness.

---

## Section 1: Role Definition

### Purpose

Set agent's identity and expertise level. Frames how they should approach the work.

### Format

```
ROLE: You are a [expertise level] [specialization] [doing what]
```

### Examples

**Good:**
```
ROLE: You are a senior TypeScript developer porting Rust code to TypeScript.
ROLE: You are a code quality specialist cleaning up TypeScript codebases.
ROLE: You are a test infrastructure engineer fixing failing tests.
```

**Why it works:**
- Sets expertise level (senior = confident decision making)
- Specifies domain (TypeScript, not generic)
- States task type (porting, cleaning, fixing)

**Bad:**
```
ROLE: You are a developer.
ROLE: Help me with some code.
```

**Why it fails:**
- Too vague
- No expertise level
- No specialization
- Agent uncertain about approach

### Lessons Learned

**Be specific about expertise:**
- "senior" = make architectural decisions
- "specialist" = deep focus on one area
- "developer" = general implementation

**Match role to task:**
- Porting: "developer porting X to Y"
- Cleanup: "quality specialist"
- Testing: "test engineer"
- Design: "architect"

---

## Section 2: Project Context

### Purpose

Brief overview of what's being built. Provides "why" for the work.

### Format

```
PROJECT: [What it is] - [What it does] - [Why TypeScript/this approach]
```

### Example

**Good:**
```
PROJECT: Codex TypeScript port - creating @openai/codex-core, a pure TypeScript library for AI coding agents that works without subprocess overhead.
```

**Why it works:**
- What: Codex TypeScript port
- Output: @openai/codex-core library
- Why: Pure library, no subprocess
- Concise (one sentence)

**Bad:**
```
PROJECT: We're porting some code.
PROJECT: [Long 3-paragraph explanation]
```

**Why it fails:**
- Too vague OR too detailed
- Doesn't establish context efficiently

### Lessons Learned

**One sentence is ideal:**
- What's being built
- What it's called
- Why this approach

**Don't explain everything:**
- Agent will read detailed docs
- Context section is orientation only

---

## Section 3: Current Phase/Task

### Purpose

What the agent is specifically doing RIGHT NOW. Scopes the work.

### Format

```
CURRENT PHASE: Phase N - [Name] ([key characteristics])

Or for single tasks:
CURRENT TASK: [Specific deliverable] ([constraints])
```

### Examples

**Good:**
```
CURRENT PHASE: Phase 4.1 - OpenAI Client (6 modules, Responses + Chat APIs)
CURRENT PHASE: Phase 5.2 - Code Quality Cleanup (fix all lint/type/test errors)
CURRENT TASK: Migrate 4 tools from codex-port (adapt imports, types, tests)
```

**Why it works:**
- Clear scope
- Numbered (shows position in sequence)
- Key details in parentheses

**Bad:**
```
CURRENT PHASE: Do some work
TASK: Fix stuff
```

**Why it fails:**
- No scope definition
- No context
- Agent doesn't know boundaries

### Lessons Learned

**Include scope indicators:**
- Module count
- Line count estimate
- Key features/constraints

**Use phase numbers:**
- Shows progress (Phase 5 of 6)
- Implies sequence
- Motivating

---

## Section 4: Prerequisites (What's Done)

### Purpose

Tell agent what's already available. Reduces uncertainty, enables confident building on existing work.

### Format

```
PREREQUISITES:
- Phase N ✅ COMPLETE ([what it delivered])
- Phase M ✅ COMPLETE ([what it delivered])

Or:
DEPENDENCIES AVAILABLE:
- Module X (Phase N)
- Module Y (Phase M)
```

### Example

**Good:**
```
PREREQUISITES:
- Phase 4.1 ✅ COMPLETE (OpenAI client, 114 tests)
- Phase 4.2 ✅ COMPLETE (Messages API integration, 148 tests)
- Phase 4.3 ✅ COMPLETE (Backend services & MCP, 34 tests)
```

**Why it works:**
- Clear what's done
- Checkmarks (visual confirmation)
- Numbers (test counts = credibility)
- What was delivered (not just "done")

**Bad:**
```
PREREQUISITES: Earlier stuff is done
PREREQUISITES: [Lists 20 phases with no details]
```

**Why it fails:**
- Too vague OR overwhelming detail
- No confidence building

### Lessons Learned

**Prerequisites build confidence:**
- Agent knows foundation exists
- Can reference prior work
- Reduces "will this work?" anxiety

**Keep it concise:**
- Just immediate dependencies
- One line per prerequisite
- What it delivered (not how)

---

## Section 5: Workspace/Location

### Purpose

Explicit path information. Agents can't guess.

### Format

```
NOTE: Workspace is [absolute path]
(TypeScript code in [subdirectory])

Or for web agents:
NOTE: All files in repository root
TypeScript code in codex-ts/ subdirectory
```

### Example

**Good:**
```
NOTE: Workspace is /Users/user/code/project
(TypeScript port is in project-ts/ subdirectory)
```

**Why it works:**
- Absolute path (no ambiguity)
- Subdirectory noted (prevents confusion)
- Parenthetical (supplementary info)

**Lessons Learned:**

**For local agents:** Absolute paths work
**For web/Docker agents:** Relative paths only, must be in repo

**Always specify:**
- Where they are (workspace root)
- Where code is (subdirectory if applicable)

---

## Section 6: State Loading (CRITICAL)

### Purpose

Tell agent what to read FIRST to understand current state. This is their memory.

### Format

```
FIRST: Read [these files in this order]
- Read [STATUS.md] (see current progress)
- Read [CHECKLIST.md] (see what's done/remaining)
- Read [README.md] (understand phase goals)
- Read [OTHER_DOC.md] (additional context)

THEN: Read [detailed documentation]
- Read [DESIGN_DOC.md] (technical details)
```

### Example

**Good:**
```
FIRST: Read status and plan
- Read PORT-PHASES/phase-5.1/STATUS.md (current progress)
- Read PORT-PHASES/phase-5.1/CHECKLIST.md (task list)
- Read PORT-PHASES/phase-5.1/README.md (phase overview)

THEN: Read technical docs
- Read codex-ts/DEV_STANDARDS.md (code standards)
- Read .migration-staging/MIGRATION_GUIDE.md (tool migration steps)
```

**Why it works:**
- Order specified (FIRST, THEN)
- Purpose in parentheses (why read each)
- Absolute paths
- State files before technical files

**Bad:**
```
Read the docs.
Read these files: [10 files in random order]
```

**Why it fails:**
- No order (agent reads randomly)
- No purpose (unclear why)
- Overwhelming (too many files)

### Lessons Learned

**STATE FILES FIRST:**
- STATUS.md shows where they are
- CHECKLIST.md shows what's done
- These are memory - read before doing work

**Order matters:**
- Status → Checklist → README → Technical docs
- General → Specific
- Current state → Background

**Use FIRST and THEN:**
- Creates clear priority
- Prevents random reading

---

## Section 7: Task Specification

### Purpose

What to do. Should be specific, actionable, with enough detail to execute.

### Format

```
MODULES (in order):
1. [module-name] ([lines]) - [complexity]
   - What it does
   - Dependencies
   - Approach

TASKS:
1. [Specific task]
2. [Another task]
```

### Example

**Good:**
```
MODULES (in dependency order):
1. openai_model_info (87 lines) - EASY
   - Lookup table for model context windows
   - No dependencies
   - Port data structure

2. model_family (192 lines) - MEDIUM
   - Model capability metadata
   - Depends on: openai_model_info
   - Port macro patterns to TypeScript
```

**Why it works:**
- Order specified (dependency order)
- Size indicated (lines = scope understanding)
- Complexity noted (easy/medium/hard)
- What it does (purpose clear)
- Dependencies explicit
- Approach hinted

**Bad:**
```
TASKS:
- Do module A
- Do module B
- Do module C
```

**Why it fails:**
- No order
- No size/complexity
- No context
- Agent must guess approach

### Lessons Learned

**Provide:**
- Porting order (dependencies matter)
- Size (lines from source)
- Complexity assessment (easy/medium/hard)
- What it does (purpose)
- Approach hint (port as-is, simplify, stub, etc.)

**For complex modules:**
- Break into sub-sections
- Port incrementally
- Test each section

---

## Section 8: Workflow Steps

### Purpose

Explicit process to follow. Reduces decisions, ensures consistency.

### Format

```
WORKFLOW (per module):
1. [Step 1]
2. [Step 2]
...
N. [Final step]
```

### Example

**Good:**
```
WORKFLOW (per module):
1. Read Rust source: codex-rs/core/src/[MODULE].rs
2. Create test file: codex-ts/src/core/[MODULE].test.ts
3. Port tests from Rust
4. Run: npm test -- [module] (should fail)
5. Create: codex-ts/src/core/[MODULE].ts
6. Implement until tests pass
7. Verify: npm test -- [module] (all passing)
8. Check types: npx tsc --noEmit
9. Check lint: npm run lint
10. Format: npm run format
11. Commit: git add -A && git commit -m "phase: [module]"
12. Update CHECKLIST.md (check off tasks)
13. Update STATUS.md (session log)
```

**Why it works:**
- Numbered (clear sequence)
- Specific commands (no ambiguity)
- Test-driven (tests before implementation)
- Verification built in
- Logging included

**Bad:**
```
WORKFLOW:
- Write code
- Test it
- Commit
```

**Why it fails:**
- Too high-level
- No specific commands
- Missing verification
- No logging

### Lessons Learned

**TDD workflow:**
- Tests first (forces thinking about interface)
- Implementation second (driven by tests)
- Verification third (ensure quality)

**Explicit commands:**
- `npm test -- [module]` not "run tests"
- `git add -A && git commit -m "..."` not "commit your work"
- Removes decision-making

**Logging is mandatory:**
- Update CHECKLIST
- Update STATUS
- Part of workflow, not "if you remember"

---

## Section 9: Code Quality Standards

### Purpose

Explicit quality bar. Not optional, not aspirational, but required.

### Format

```
CODE QUALITY STANDARDS:

TypeScript:
- [Requirement]
- [Requirement]

ESLint:
- [Requirement]

Tests:
- [Requirement]

Format:
- [Requirement]
```

### Example

**Good:**
```
CODE QUALITY STANDARDS (MANDATORY):

TypeScript:
- Zero errors: npx tsc --noEmit must report 0 errors
- No implicit any
- Proper type annotations throughout

ESLint:
- Zero problems: npm run lint must report 0 problems
- Unused variables: Remove or prefix with _
- No explicit any types

Tests:
- All passing: npm test must show 0 failures
- No skipped: All .skip removed (implement, remove, or convert to TODO)
- Coverage: New code must have tests

Format:
- Prettier compliant: npm run format makes no changes

VERIFICATION:
Run: npm run format && npm run lint && npx tsc --noEmit && npm test
All must succeed before declaring complete.
```

**Why it works:**
- Explicit (zero errors, not "few errors")
- Measurable (commands to run)
- Non-negotiable (MANDATORY)
- Verification command (one-line check)

**Bad:**
```
CODE QUALITY:
- Try to keep errors low
- Follow lint rules when possible
- Write tests
```

**Why it fails:**
- Vague ("low" not "zero")
- Optional ("when possible")
- No verification

### Lessons Learned

**Zero-tolerance works:**
- "0 errors" clearer than "minimal errors"
- "All passing" clearer than "most passing"
- Measurable = verifiable

**Provide verification command:**
- One line that checks everything
- Agent can run before declaring done
- Objective pass/fail

**Make it mandatory:**
- Not "should" but "must"
- Not "try to" but "requirement"
- Part of success criteria

---

## Section 10: Before Ending Checklist

### Purpose

Ensure state is saved, work is committed, handoff is clean. This is mandatory, not optional.

### Format

```
BEFORE ENDING SESSION:
1. [Update log file]
2. [Update another log]
3. [Commit command]
4. [Push command]
5. [Report to user]
```

### Example

**Good:**
```
BEFORE ENDING SESSION:
1. Update PORT-PHASES/phase-N/CHECKLIST.md (check off completed tasks)
2. Update PORT-PHASES/phase-N/STATUS.md (add session log with what you did)
3. Update codex-ts/PORT_LOG_MASTER.md (overall status)
4. Run: npm run format && npm run lint && npx tsc --noEmit && npm test
5. Verify all clean (or document what's not and why)
6. git add -A
7. git commit -m "phaseN: [description of work]"
8. git push
9. Report to user:
   - Modules completed
   - Tests passing (count)
   - Quality status (type errors, lint errors)
   - What's next

If any verification fails: Fix before ending, or report blocking issue to user.
```

**Why it works:**
- Numbered (clear sequence)
- Specific files (no ambiguity)
- Exact commands (no decisions)
- Verification before commit (quality gate)
- Reporting required (communication)

**Bad:**
```
BEFORE ENDING:
- Save your work
- Update logs
```

**Why it fails:**
- Vague ("save your work" how?)
- No verification
- Easy to forget

### Lessons Learned

**This is the most critical section:**
- Agent forgets to update logs = next session lost
- Logs ARE the memory
- Make it explicit, detailed, mandatory

**Verification before commit:**
- Catch issues before they're permanent
- Don't commit broken code
- One last quality check

**Reporting required:**
- User needs to know what happened
- Metrics important (test counts)
- Next steps help continuity

---

## Section 11: Starting Point

### Purpose

Tell agent exactly where to begin. Reduces paralysis from too many options.

### Format

```
START with [specific action]

Or:
START by:
1. [First action]
2. [Second action]
Then [begin actual work]
```

### Example

**Good:**
```
START by reading STATUS.md to see current progress, then begin with openai_model_info (easiest module, good warm-up).
```

**Why it works:**
- Read state first (load memory)
- Then specific module (no choice paralysis)
- Justification (easiest = warm-up)

**Bad:**
```
START working
Get started with the modules
```

**Why it fails:**
- No specific action
- Agent must decide where to start

### Lessons Learned

**Be explicit:**
- Which file/module first
- Why that one (rationale helps)

**State before work:**
- Read STATUS before coding
- Load memory before acting

---

## Common Patterns That Work

### Pattern: Migration with Staged Files

**Problem:** Agent can't access local filesystem in Docker/web

**Solution:** Stage files in repo

```
FILES STAGED IN REPO:
Location: .migration-staging/tools-from-codex-port/
- applyPatch/ (directory with source)
- readFile.ts
- types.ts

MIGRATION GUIDE: .migration-staging/MIGRATION_GUIDE.md (complete instructions)

TASK: Copy from staging, adapt imports, write tests
```

**Why it works:**
- Files in repo (accessible)
- Migration guide in repo (self-contained)
- No external dependencies

### Pattern: Incremental Large Module

**Problem:** Module too large to port at once (3,000+ lines)

**Solution:** Break into sections

```
MODULE: core/codex (3,145 lines) - TOO LARGE

Port in 6 sections:
1. Core types (500 lines) - Port, test, commit
2. Event loop (400 lines) - Port, test, commit
3. Tool integration (600 lines) - Port, test, commit
...

CRITICAL: Don't try to port all at once.
Test each section before moving to next.
```

**Why it works:**
- Manageable chunks
- Test-as-you-go
- Progressive commits
- Agent not overwhelmed

### Pattern: Test-Driven Development

**Problem:** Implementation-first leads to interface mismatches

**Solution:** Tests before implementation

```
WORKFLOW:
1. Read Rust source
2. Create test file FIRST
3. Port tests from Rust
4. Run tests (should fail)
5. Implement until tests pass
```

**Why it works:**
- Tests define interface
- Implementation driven by tests
- Know when done (tests pass)

### Pattern: Quality Verification

**Problem:** Agent declares done with errors

**Solution:** Verification command required

```
BEFORE DECLARING COMPLETE:
Run: npm run format && npm run lint && npx tsc --noEmit && npm test

All must succeed. If any fail, phase is NOT complete.
```

**Why it works:**
- Objective (command succeeds or fails)
- Complete (all quality aspects)
- One line (easy to run)
- Gated (can't skip)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Vague Tasks

**Bad:**
```
TASK: Implement the authentication system
```

**Why it fails:**
- Too broad
- No breakdown
- Agent doesn't know where to start

**Good:**
```
TASKS:
1. Create src/core/auth/index.ts
2. Port AuthManager class from Rust
3. Implement login() method
4. Implement logout() method
5. Implement getAuth() method
6. Create tests (20 tests)
7. Verify all passing
```

**Why it works:**
- Granular (one file, one class, specific methods)
- Checkable (can verify each step)
- Complete (nothing left ambiguous)

### Anti-Pattern 2: No State Loading

**Bad:**
```
TASK: Continue working on Phase 5
```

**Why it fails:**
- Agent has no memory
- Doesn't know what's done
- May duplicate work

**Good:**
```
FIRST: Read STATUS.md to see what's already complete
THEN: Read CHECKLIST.md to see remaining tasks
TASK: Continue from where you left off
```

**Why it works:**
- Loads state first
- Agent knows current position
- Can resume exactly where stopped

### Anti-Pattern 3: Assuming Context

**Bad:**
```
Use the API key from the environment
```

**Why it fails:**
- Which environment variable?
- What if not set?
- Agent guesses

**Good:**
```
USE environment variables AS-IS:
- PERPLEXITY_API_KEY (for webSearch)
- FIRECRAWL_API_KEY (for fetchUrl)

If missing: STOP and inform user (don't try to work around)
```

**Why it works:**
- Specific variable names
- Purpose noted
- Error handling (what if missing)

### Anti-Pattern 4: No Verification

**Bad:**
```
Implement features and commit when done
```

**Why it fails:**
- No quality check
- Can commit broken code
- No validation

**Good:**
```
BEFORE COMMITTING:
1. Run: npm test (must pass)
2. Run: npx tsc --noEmit (must show 0 errors)
3. Run: npm run lint (must show 0 problems)
4. Then: git add -A && git commit
```

**Why it works:**
- Quality gates before commit
- Explicit commands
- Can't skip

---

## Handling Edge Cases

### Scenario: External File Dependencies

**Problem:** Tool files in `~/code/other-repo` (agent can't access)

**Solution:** Copy to staging area in repo

```
FILES STAGED FOR YOU:
All source files copied to: .migration-staging/[directory]/

You have everything needed in the repository.
Do NOT try to access ~/code/other-repo (you can't).
```

### Scenario: Environment Variables

**Problem:** Agent tries to hardcode or override env vars

**Solution:** Explicit instruction

```
ENVIRONMENT VARIABLES:
Pre-configured by user:
- PERPLEXITY_API_KEY
- FIRECRAWL_API_KEY

RULES:
1. USE as-is: process.env.PERPLEXITY_API_KEY
2. DO NOT modify or override
3. If missing: STOP and inform user
4. DO NOT get creative trying to work around
```

### Scenario: Model Name Specifications

**Problem:** Agent substitutes models from training data

**Solution:** Explicit model IDs with warnings

```
TEST MODELS (EXACT STRINGS, DO NOT MODIFY):
- TEST_MODEL_FLASH=google/gemini-2.0-flash-001
- TEST_MODEL_NANO=openai/gpt-5-nano
- TEST_MODEL_HAIKU=anthropic/claude-haiku-4.5

⚠️ DO NOT substitute with models from your training data.
These are the EXACT strings from OpenRouter API.
Use ONLY these model IDs.
```

### Scenario: Pre-Existing Errors

**Problem:** Agent says "not my code, not my problem"

**Solution:** Explicit responsibility

```
PRE-EXISTING ERRORS:
The codebase has 65 TypeScript errors from previous phases.

YOU ARE RESPONSIBLE for fixing these.
- Not "someone else's problem"
- Not "will fix later"
- Fix as you encounter them, or fix systematically

Phase complete only when ENTIRE codebase is clean.
```

---

## Session Resumption

### Making Sessions Resumable

**Agent has no memory.** Next session is a completely fresh start.

**Critical elements for resumption:**

**1. STATUS.md is up-to-date:**
```markdown
## Progress Overview
- Modules: 3 / 8 complete
- Tests: 87 passing

## Session Log
### 2025-11-07 - Session 2
**Completed:**
- Module X (tests passing)
- Module Y (partial - 50% done)

**Next:**
- Finish module Y
- Start module Z
```

**2. CHECKLIST.md is accurate:**
```markdown
- [x] Module X
- [ ] Module Y (partially complete)
  - [x] Create types
  - [x] Write tests
  - [ ] Implement core logic
  - [ ] Verify passing
- [ ] Module Z
```

**3. Code is committed:**
- All work pushed to branch
- Nothing lost in local state

**With these:** Next agent reads STATUS, sees "Module Y partial", reads CHECKLIST, sees exactly what's done in Y, continues from there.

### Testing Resumability

**Good test:** Can you start a session, read just STATUS + CHECKLIST, and know exactly what to do next?

**If yes:** Prompt is resumable
**If no:** Add more detail to status/checklist

---

## Prompt Length Considerations

### When to Be Detailed

**Complex phases:** More detail needed
- Multi-module (8+ modules)
- Technical complexity (new concepts)
- Integration phases (many dependencies)
- Quality phases (systematic fixes)

**Length: 100-200 lines acceptable**

### When to Be Concise

**Simple phases:** Less detail needed
- Single module
- Straightforward porting
- Well-understood task

**Length: 50-80 lines sufficient**

### Balance

**Too short:**
- Agent confused
- Asks questions
- Makes wrong assumptions

**Too long:**
- Agent may skim
- Important bits lost
- Overwhelming

**Sweet spot:** Complete but scannable
- Use sections/headers (skimmable)
- Bold critical points
- Examples where helpful

---

## Examples from Codex Port

### Excellent Prompt: Phase 4.5

**Why it worked:**
- Complete migration guide in repo
- Files staged in repo
- Exact steps (Bun→Node.js conversion)
- Code examples for tricky parts
- No external dependencies
- Agent completed successfully

### Problematic Prompt: Early Phase 4.5

**What went wrong:**
- Referenced files at `~/code/v/codex-port` (agent can't access)
- No migration guide
- Agent failed, wasted session

**Fix:**
- Copied files to `.migration-staging/`
- Created MIGRATION_GUIDE.md in repo
- Next session succeeded

**Lesson:** Everything agent needs must be in repo or prompt.

---

## Quality Standards Template

**Use this in every prompt:**

```
CODE QUALITY STANDARDS:

TypeScript:
- Run: npx tsc --noEmit → must show 0 errors
- No implicit any types
- All imports have types

ESLint:
- Run: npm run lint → must show 0 problems
- Unused variables: Remove or prefix _
- No explicit any

Tests:
- Run: npm test → all passing, 0 skipped
- New code: Comprehensive tests
- Existing code: Fix failures

Format:
- Run: npm run format → no changes

VERIFICATION COMMAND:
npm run format && npm run lint && npx tsc --noEmit && npm test

Before declaring complete, this must succeed.
```

**Adapt specifics per project, but structure stays consistent.**

---

## Conclusion

Effective coding agent prompts are:
- **Complete:** All needed context included
- **Specific:** Exact files, commands, steps
- **Ordered:** Clear sequence, prioritized reading
- **Verifiable:** Objective success criteria
- **Resumable:** State externalized in logs

**The formula:**
1. Set role and context (who/what/why)
2. Load state (read these files first)
3. Specify task (do this, in this order)
4. Provide workflow (step-by-step process)
5. Set standards (quality requirements)
6. Require logging (before ending checklist)
7. Verify quality (run these commands)

**When followed:** Agents produce high-quality work that integrates cleanly and can be resumed by any future agent.

**This is the scaffolding that makes large-scale AI-assisted development possible.**
