# TOOLS.md - Extension Tools

Tools to support the planning workflow.

---

## Slash Commands (.claude/commands/)

### `/core-doc-review`
**Purpose:** Core doc review - review conversation, propose updates to core docs
**When:** At checkpoints (100k, 150k) or when useful
**What it does:**
1. Review conversation for state changes, process learnings, focus shifts, decisions
2. Propose updates to STATE.md, CURRENT.md, PROCESS.md, NEXT.md
3. User approves, agent makes updates

---

## Subagents

### Code Research
**Purpose:** Explore codebase, answer questions
**Model:** Sonnet (fast) or Opus (thorough)
**Returns:** Summary, not raw files. Code maps. Key file:line references.

### Verifier
**Purpose:** Review completed work
**Model:** Sonnet or Opus
**Returns:**
- DoD checks (tests/format/lint/typecheck)
- Code review against standards
- Recommended / Not Recommended + reasoning
- Risks if approved anyway

### Mock Finder
**Purpose:** Find shims, mocks, shortcuts in code
**When:** After large changes, before commits, during audits
**Model:** Sonnet or Opus
**Looks for:**
- Mocks in non-test code
- Shims/adapters that bypass real integration
- Scaffolds that change behavior
- Shortcuts that skip real infrastructure
**Returns:** List of findings with file:line, severity, recommendation

---

## Skills

### `prompt-assembly`
**Purpose:** Assemble prompts from parts
**Location:** `.claude/skills/prompt-assembly/`
**Contains:** parts/, templates/, questions.md, assemble.js

### `tech-spec-writer`
**Purpose:** Generate technical design chunk for prompts
**Output:** Technical specification section ready to embed in coder prompt
**Scope:** Focused on implementation details, not full feature spec

---

## Directory Structure

```
.claude/
├── commands/
│   └── core-doc-review.md
└── skills/
    └── prompt-assembly/
        ├── skill.md
        ├── questions.md
        ├── assemble.js
        ├── parts/
        └── templates/

projects/
├── 01-api/prompts/          # Assembled prompts for API work
└── 02-ui/prompts/           # Assembled prompts for UI work
```

---

## Usage

**Slash commands:** `/core-doc-review` for checkpoint doc reviews

**Prompt assembly:** Say "build a prompt", "assemble a prompt", or "generate a prompt" to trigger the skill

**Subagents:** Use Task tool directly, ad hoc for now

---

## Notes

- Prompt assembly outputs to `projects/{project}/prompts/`
- Subagents are ad hoc - no formal commands yet
- Beads integration TBD
