# TOOLS.md - Extension Tools Design

Tools to support the planning workflow. Implementation priority ordered by value.

---

## Slash Commands

Quick actions invoked with `/command`. Live in `.claude/commands/`.

### Priority 1: Essential

#### `/state`
**Purpose:** Display current STATE.md
**Implementation:** Simple file read and display
```markdown
# .claude/commands/state.md
Read and display the contents of STATE.md from the project root.
Show the full document - it's the ground truth for system health.
```

#### `/current`
**Purpose:** Display and optionally update CURRENT.md
**Implementation:** Read file, optionally accept updates
```markdown
# .claude/commands/current.md
Read and display CURRENT.md from the project root.
If the user provides updates, edit the Session Notes section.
This is the active focus - what we're working on RIGHT NOW.
```

#### `/checkpoint`
**Purpose:** Force a progress/context check
**Implementation:** Display context %, prompt for consolidation
```markdown
# .claude/commands/checkpoint.md
This is a checkpoint. Please:
1. Report current context usage (% of 200k)
2. Summarize what's been accomplished this session
3. List what's still in progress
4. Recommend: continue, consolidate, or prepare handoff

Based on context thresholds:
- <50%: Continue if clear path
- 50-70%: Consider consolidating or forking
- 70-80%: Wrap up current work
- >80%: Handoff mode - generate artifacts
```

#### `/doccheck`
**Purpose:** Evaluate core docs for updates based on session work (checkpoint command)
**Implementation:** Review conversation, identify changes, update docs
**Note:** Named `doccheck` to avoid conflict with built-in `/review`
```markdown
# .claude/commands/doccheck.md
Time for a doc review checkpoint. Please:

1. Review this conversation for:
   - State changes (things that now work/don't work differently)
   - Process learnings (things we should do differently)
   - Current focus shifts (what we're working on changed)
   - Decisions made (that should be recorded)

2. For each category, identify what (if anything) should be captured.

3. Propose updates to:
   - STATE.md (if system health changed)
   - CURRENT.md (if focus/progress changed)
   - PROCESS.md (if workflow learnings)

4. After user approval, make the updates.

This is the checkpoint command - use at 100k context and 150k context per PROCESS.md.
```

### Priority 2: Helpful

#### `/handoff`
**Purpose:** Prepare session handoff artifacts
**Implementation:** Generate summary, update docs, prep next session
```markdown
# .claude/commands/handoff.md
Prepare session handoff:
1. Update STATE.md with any changes from this session
2. Update CURRENT.md with current status and next steps
3. Generate a session summary (what was done, what's next, any blockers)
4. Suggest opening prompt for next session
```

#### `/slice`
**Purpose:** Define a new work slice
**Implementation:** Interactive slice definition
```markdown
# .claude/commands/slice.md
Define a new work slice. Ask for:
1. What's the ONE thing this slice accomplishes?
2. How do you know it's done? (specific test, artifact, behavior)
3. What are you NOT touching?
4. What's the integration point?

Then update CURRENT.md with the slice definition.
```

---

## Subagents

Spawned for deep work. Return summaries, not raw exploration.

### Code Research Agent
**Trigger:** Complex questions about existing code
**Model:** Sonnet (fast) or Opus (thorough)
**Prompt template:**
```markdown
You are a code research agent. Your job is to explore the codebase and return a SUMMARY of findings.

TASK: [specific question]

SCOPE: [directories/files to focus on]

RETURN FORMAT:
1. Direct answer to the question (2-3 sentences)
2. Key files involved (path:line references)
3. Code map if helpful (ASCII diagram of relationships)
4. Any surprises or concerns discovered

DO NOT return raw file contents. Summarize and synthesize.
```

### Implementation Agent
**Trigger:** Code needs to be written to spec
**Model:** Sonnet
**Prompt template:**
```markdown
You are an implementation agent. Write code to this specification.

SPEC:
[functional requirement]
[interfaces/contracts]
[integration points]

CONSTRAINTS:
- DO NOT mock [specific things]
- DO NOT add abstraction layers
- DO NOT modify files outside scope
- [other explicit constraints]

DELIVERABLES:
1. Code changes (with file paths)
2. Test results (run the relevant tests)
3. Any issues encountered or decisions made
```

### Code Review Agent
**Trigger:** Before committing significant changes
**Model:** Opus (critical) or Sonnet (routine)
**Prompt template:**
```markdown
You are a code review agent. Review these changes.

CONTEXT: [what the changes are trying to accomplish]

DIFF: [the changes]

REVIEW FOR:
1. Correctness - Does it do what it's supposed to?
2. Integration - Does it fit with existing patterns?
3. Anti-patterns - Any mocking, shims, or shortcuts that shouldn't be there?
4. Tests - Are changes tested? Do tests test real behavior?

RETURN: Issues (blocking/non-blocking), suggestions, approval/rejection
```

### Web Research Agent
**Trigger:** Need external documentation or best practices
**Model:** Sonnet
**Prompt template:**
```markdown
You are a research agent. Find information about [topic].

SPECIFIC QUESTIONS:
[list of questions]

RETURN FORMAT:
1. Answers to questions (with source links)
2. Key takeaways relevant to our project
3. Any warnings or gotchas discovered

Keep it focused. Don't return everything you find - synthesize.
```

---

## Skills (Future)

Skills are reusable prompt packages that activate specific SOPs. Lower priority than commands and subagents.

### Potential Skills

#### `spec-writer`
Activate when defining a feature spec. Loads spec template and guides through completion.

#### `prompt-writer`
Activate when creating a coder prompt. Loads prompt template with anti-pattern guards.

#### `test-auditor`
Activate when auditing test integrity. Loads checklist for detecting scaffold corruption.

#### `dependency-mapper`
Activate when planning multi-part work. Guides through dependency analysis.

---

## Implementation Notes

### Slash Command Setup
```bash
mkdir -p .claude/commands
# Create each command as a .md file
# Commands are loaded when invoked with /name
```

### Subagent Invocation
Use the Task tool with appropriate subagent_type:
- `Explore` for code research
- `general-purpose` for implementation work

### Context Budget
Each tool invocation costs tokens. Budget:
- Slash commands: ~500-1000 tokens each
- Subagent spawn: ~2000 tokens base + work
- Subagent return: summary should be <1000 tokens

---

## Priority Order

1. `/checkpoint` - Context awareness, drift prevention
2. `/doccheck` - Doc updates at checkpoints (100k, 150k)
3. `/state` and `/current` - Quick orientation
4. Code Research subagent pattern - Reduce planner context load
5. `/handoff` - Clean session transitions
6. `/slice` - Structured work definition
7. Implementation/Review agents - As needed
8. Skills - Future iteration
