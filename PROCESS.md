# PROCESS.md - How We Work

This document defines the workflow for planning and implementation of code and coding work with AI agents. Two modes are specified to provide flexibility to move between more ad hoc iterative style development, typically used for polishing and/or exploratory style coding, as well as a mode for larger process with more formal specification stages serving the needs of features that require clear design and dependency analysis and sequencing. 

---

## Context Notifications & Checkpoints

Using Opus 4.5 with 200k context window. Context consumption drives checkpoints, not clock time. Mostly with context priming and prepping for context reset, the effective range of usage is around 50k - 150k.

### Notifications (Awareness)

Notify at these thresholds - just awareness, no required action:

| Context | Note |
|---------|------|
| 75k | First notification - session progressing |
| 100k | warning, context at 50%|
| 125k | warning, context at 62% |
| 150k | warning, context at 75% need to wrap up |
| 160k | warning, you have reached the dumb zone |
| 170k | warning, you are in the dumb zone |
| 180k | warning, you are deep in the dumb zone, approaching threshold |
| 190k | warning, critical threshold |

### Checkpoints (Action Required)

| Context | Checkpoint | Purpose |
|---------|------------|---------|
| **100k** | Mid-Session | Evaluate core docs for updates. Review STATE.md, CURRENT.md. Update if needed. |
| **150k** | Pre-Cutover | Final wrap-up. Complete STATE updates. Prepare handoff. Generate summary for next session. |

### At 100k Checkpoint

- Review conversation for state changes worth capturing
- Update STATE.md if system health changed
- Update CURRENT.md with progress
- Decide: continue or fork deep dives to subagent
- Note any decisions made this session

### At 150k Checkpoint

- Final STATE.md review and update
- Complete CURRENT.md with session outcome and next steps
- Generate session summary (what was done, what's next, blockers)
- Prepare opening context for next session
- Commit or stash any code changes

---

## Context Management & Session Handoff

Two approaches for managing context resets. Both require handoff prep before the reset.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SESSION LIFECYCLE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   START ──────────────────────────────────────────────> END     │
│     │                                                    │      │
│     │  50k        100k        150k        175k          │      │
│     │   │          │           │           │            │      │
│     ▼   ▼          ▼           ▼           ▼            ▼      │
│   [Orient]    [Checkpoint]  [Wrap-up]   [Dumb Zone]  [Reset]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Before Any Reset (Handoff Prep)

1. Update STATE.md with current system health
2. Update CURRENT.md with progress and next steps
3. Commit or stash code - no uncommitted work floating
4. Note any session-specific decisions worth preserving

### Approach 1: Buffer Trim

Best for: Continuing deep in a specific thread of work.

**Process:**
1. At ~150k tokens, complete handoff prep above
2. Copy terminal buffer text to a separate file
3. Remove obvious unnecessary sections (long tool outputs, dead ends)
4. Spawn Claude Code with Sonnet, ask to strip out tool calls
5. Start new Claude Code session with trimmed text as starter prompt

**Iterate:** Repeat each time you get over 150k. Maintains conversational continuity while shedding weight.

### Approach 2: Fresh Start with PLANNER-INIT

Best for: Clean slate, new focus, or when buffer trim isn't preserving the right context.

**Process:**
1. At ~150k tokens, complete handoff prep above
2. Ensure PLANNER-INIT.md is current with any needed updates
3. Verify PROCESS, STATE, CURRENT, CLAUDE.md have everything needed
4. Start fresh Claude Code session
5. Paste PLANNER-INIT.md as first message
6. Agent reads referenced docs per PLANNER-INIT instructions

**Trade-off:** Loses conversational nuance but starts with clean, curated context.

---

## Working Modes

Two modes for different types of work. User discretion on which applies.

```
┌────────────────────────────────────────────────────────────────┐
│                      WORKING MODES                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   INFORMAL                           FORMAL                    │
│   ────────                           ──────                    │
│   Rhythm & flow                      Structure & sequence      │
│   discuss → do → reflect             spec → plan → execute     │
│   Light artifacts                    Heavy artifacts           │
│   User discretion                    User discretion           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Informal Mode

**When:**
- Ad hoc iterative development
- Good for iterative polishing
- Slowly building out a range of useful tests
- Refining UI
- Exploring / prototyping

**The loop:**
1. Discuss
2. Use task agents or subagents to research local code, web search
3. Informal planning of work
4. May or may not create design doc 

**Process**
- Conversational
- Small slices
- Follow the work where it leads

**Artifacts**
- STATE, CURRENT, NEXT - kept current
- Working commits

**Handoffs**
- Prompt-based dispatch to coders/verifiers
- Summary returns

**Minimum Standards**
- Can explain what and why
- No infrastructure mocking
- Update docs when reality changes
- Surface when stuck

### Formal Mode (sketch)

**When:**
- Tight interlocking dependencies to work through
- Defined scope needs systematic execution
- Scaffolding something new with baseline expectations
- User discretion

**More ceremony:** specs, contracts, scenarios, defined acceptance

*Formal mode will be elaborated when we need it.*

---

## Slice Lifecycle

A "slice" is a focused unit of work. 1-3 hours of human attention, variable agent effort.

### Before Starting

```
□ What's the ONE thing this slice accomplishes?
□ How do I know it's done? (specific test, behavior, artifact)
□ What am I NOT touching? (explicit scope boundary)
□ What's the integration point? (where does this connect)
□ Update CURRENT.md with slice definition
```

### During

```
□ Check-in at natural breakpoints (not clock time)
□ If agent grinding on something weird: STOP and reassess
□ If scope creeping: note it, don't chase it
□ If blocked: document blocker, switch or escalate
```

### After

```
□ Does it work? (run the verification)
□ Update STATE.md with any changes
□ Update CURRENT.md (complete or revise)
□ Commit or stash - no dangling work
□ Note any follow-up items discovered
```

---

## Subagent Patterns

### Code Research Agent
**Use for:** Understanding existing code, mapping dependencies, finding patterns
**Returns:** Summary of findings, key file:line references, code map if needed
**Model:** Sonnet or Opus depending on complexity

### Implementation Agent
**Use for:** Writing code to spec
**Receives:** Clear spec with interfaces, integration points, constraints
**Returns:** Code + test results + any issues encountered
**Model:** Sonnet

### Code Review Agent
**Use for:** Reviewing changes before commit
**Receives:** Diff + context about intent
**Returns:** Issues found, suggestions, approval/rejection
**Model:** Opus for critical, Sonnet for routine

### Web Research Agent
**Use for:** External documentation, API references, best practices
**Returns:** Distilled findings relevant to task
**Model:** Sonnet

---

## Prompt Assembly (Informal Mode)

Composable prompt structure for dispatching work to coders and verifiers.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROMPT ASSEMBLY FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   PLANNER                                                       │
│      │                                                          │
│      ├──► Assemble coder prompt ──► Create bead ──► CODER       │
│      │         (from parts)            │              │         │
│      │                                 │              ▼         │
│      │                                 │         Does work      │
│      │                                 │              │         │
│      ├──► Assemble verifier prompt ────┘              ▼         │
│      │         (from parts)                      VERIFIER       │
│      │                                               │          │
│      ◄───────────── Recommendation ──────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Prompt Structure

```
1. Role (coder / verifier)
2. Application overview
3. State summary (where we are, what's next)
4. Job overview (high level)
5. Directory structure + tech/arch perspective
6. Detailed job breakdown (with altitude attribute)
7. Technical & coding standards
8. Definition of done
9. Output format
```

### Altitude Attribute

Specifies level of detail in job breakdown. Set consciously per prompt.

**ground** - Line-level specificity
```
In src/core/reducer.ts at line 47, inside the `reduceStreamEvent` function:
- Add a case for 'thinking' event type
- Extract content from event.delta.thinking
- Append to current message's thinking array
```

**500ft** - Function/method level
```
Extend `reduceStreamEvent` in src/core/reducer.ts to handle 'thinking' events:
- New case branch for thinking event type
- Accumulate thinking deltas into message state
- Reference existing 'content' case for structure
```

**1000ft** - Component/module level
```
Add thinking event support to the reducer:
- The reducer handles stream events and builds message state
- Thinking events follow same delta pattern as content events
- Update the reducer to accumulate thinking alongside content
```

### Definition of Done

Standard completion checks (run sequentially, loop until all clean):
1. Tests pass
2. Format clean
3. Lint clean
4. Typecheck clean

### Output Formats

**Coder output:**
- DoD checklist (checked or with comments on issues)
- Issues/concerns encountered
- Recommendations for planner

**Verifier output:**
- Recommended / Not Recommended
- Reasoning
- Risks if not recommended but approved anyway

### Workflow with Beads

```
/assemble-prompts (slash command)
    ↓
Skill assembles coder prompt + verifier prompt
    ↓
Creates 2 beads (type: coder-prompt, verifier-prompt)
    ↓
Optional: /critique-prompts reviews against source
    ↓
Planner reviews beads, updates if needed
    ↓
Finalizes → dispatch to coder
    ↓
Coder completes → dispatch to verifier
    ↓
Verifier outputs recommendation
```

### Prompt Parts Location

`cody-fastify/docs/.prompt-parts/` - Composable prompt elements

### Skill Location

`.claude/skills/prompt-assembly/SKILL.md` - Requires YAML frontmatter for discovery

Trigger phrases: "build a prompt", "assemble a prompt", "assemble prompts", "generate a prompt"

---

## Orchestration & Work Tracking (Under Development)

This section covers subagent orchestration and work tracking. **Still being refined.**

### Two Complementary Systems

| System | Purpose | Contains |
|--------|---------|----------|
| **Process docs** (STATE, CURRENT, PROCESS, CLAUDE) | Planner context | Mental model, system health, how we work, principles |
| **Work tracking** (beads) | Work orchestration | What needs doing, dependencies, dispatch status |

Process docs maintain **understanding**. Work tracking maintains **what to do**.

### Beads (bd) - Git-Native Work Tracking

Beads is an issue tracker stored as JSONL in git, designed for AI agent workflows.

**Repo:** `~/code/beads`
**Docs:** `AGENTS.md`, `docs/QUICKSTART.md`, `docs/CLI_REFERENCE.md`

**Core capabilities:**
```bash
bd init                              # Initialize in repo
bd ready --json                      # What's unblocked and ready?
bd create "Title" -p 1 -t task       # Create work item
bd create "Bug" --deps discovered-from:bd-abc  # Link discovered work
bd update bd-xyz --status in_progress # Claim work
bd close bd-xyz --reason "Done"      # Complete work
bd sync                              # End of session: export/commit/push
bd dep tree bd-xyz                   # View dependency graph
```

**Dependency types:**
- `blocks` - A blocks B (B can't start until A done)
- `related` - Associated but not blocking
- `parent-child` - Epic → subtasks (bd-abc.1, bd-abc.2)
- `discovered-from` - Found during work on another issue

### Orchestration Flow

```
PLANNER (with process docs)
    │
    ├── Understands system via STATE.md
    ├── Knows focus via CURRENT.md
    ├── `bd ready` → Find unblocked work
    │
    ├── Creates SPEC (using template)
    ├── Files issue: `bd create "Implement X" --json`
    │
    └── Dispatches to SUBAGENT
             │
             ├── Gets issue context + spec
             ├── Does work
             ├── Discovers new work → `bd create --deps discovered-from:<id>`
             ├── `bd close` when done
             └── Returns summary to planner
```

### Use Cases for Beads

**Epic planning:**
- Large features as parent issues with child tasks
- `bd create "Test Infrastructure Recovery" -t epic`
- Child tasks: bd-abc.1, bd-abc.2, etc.

**Subagent dispatch:**
- Each issue = clear unit of work with context
- Issue description contains spec or link to spec
- Subagent claims with `bd update --status in_progress`

**Discovered work:**
- Bugs/TODOs found during implementation
- `bd create "Fix null check" --deps discovered-from:bd-xyz`
- Captured but not derailing current work

**Session handoffs:**
- `bd sync` at session end commits work state to git
- `bd ready` at session start shows what's unblocked
- Work survives context compaction/session restart

**Planner-to-planner handoffs:**
- When info doesn't fit baseline docs (PLANNER-INIT, STATE, CURRENT)
- Create a bead with specific context for next planner
- `bd create "Context for next session: [specific thing]" -t note`
- Next planner checks `bd ready` or specific issue

### What Beads is NOT For

- Maintaining planner mental model (use process docs)
- Tracking system health (use STATE.md)
- Storing process/workflow principles (use PROCESS.md)
- Architectural knowledge (use design docs)

Beads tracks **work items**. Process docs maintain **understanding**.

### Artifact Workflow (Proposed)

```
Planner creates:
    SPEC (templates/SPEC-TEMPLATE.md)
         │
         ▼
    Files bead: "Implement [feature]"
    Attaches spec as issue description or link
         │
         ▼
    Dispatches to Implementation Agent
         │
         ▼
    Agent works, closes bead
         │
         ▼
    Files bead: "Review [feature]"
         │
         ▼
    Dispatches to Review Agent
         │
         ▼
    Review agent approves/rejects
         │
         ▼
    Planner integrates or iterates
```

### Status

- [ ] Initialize beads in cody-fastify
- [ ] Test workflow with first real epic
- [ ] Refine based on experience
- [ ] Document slash commands for beads operations

---

## Anti-Pattern Watchlist

These are known failure modes. Watch for them actively.

### Test Scaffold Corruption
**Pattern:** Agent creates test scaffolds that change behavior to make tests pass
**Detection:** Tests pass but you didn't see the relevant code change
**Prevention:** "DO NOT modify test harness behavior. Mock ONLY external APIs."

### Shim Creep
**Pattern:** Agent adds adapters/layers to avoid integration difficulty
**Detection:** New files appearing that "translate" or "adapt" between existing components
**Prevention:** "Integrate directly. No new abstraction layers without explicit approval."

### Context Dump
**Pattern:** Agent reads every file to "understand" before doing simple task
**Detection:** Token count spiking without proportional progress
**Prevention:** Curate context. Tell agent exactly which files are relevant.

### Convergent Defaults
**Pattern:** Agent drifts toward mocking, minimal implementations, generic patterns
**Detection:** Solutions feel "cookie cutter" or over-abstracted
**Prevention:** Explicit constraints in every prompt. "DO NOT mock X. USE real Y."

### Env Var Pre-Checks
**Pattern:** Checking if env vars are set before attempting connectivity
**Detection:** `if (!process.env.X) return fail` instead of just trying the connection
**Prevention:** "Just attempt the connection. Let it fail naturally with descriptive error."

---

## Quick Reference

### Starting a Session
1. Load CLAUDE.md (automatic)
2. Check context (~35-40k orientation)
3. Read STATE.md for ground truth
4. Read CURRENT.md for active focus
5. Begin work

### Slice Checklist
- **Before:** ONE thing, done-when, not-touching
- **During:** Check-in at natural breakpoints
- **After:** Verify, update docs, commit

### Context Reset Checklist
- [ ] STATE.md updated
- [ ] CURRENT.md updated
- [ ] Code committed or stashed
- [ ] Choose approach: Buffer Trim or Fresh Start
