# PROCESS-TEMP-DUMP.md

Temporary capture of high-signal info from research/refinement sessions. Read this to absorb insights before continuing process refinement.

---

## Beads (bd) - Git-Native Work Tracking for Agents

**Repo:** `~/code/beads` (checked out)
**What it is:** Issue tracker stored as JSONL in git, designed specifically for AI agent workflows.

### Core Value Proposition

1. **Agent memory** - Issues survive session compaction/interruption
2. **Semantic dependencies** - 4 types: blocks, related, parent-child, discovered-from
3. **Ready work detection** - `bd ready` returns only unblocked issues
4. **Multi-agent coordination** - Hash IDs prevent collision, optional Agent Mail for real-time sync
5. **Discovered work capture** - File issues found during other work with `--deps discovered-from:<id>`

### Key Commands

```bash
bd init                              # Initialize in repo
bd ready --json                      # What's unblocked and ready?
bd create "Title" -p 1 -t task --json  # Create issue
bd create "Bug" --deps discovered-from:bd-abc --json  # Link discovered work
bd update bd-xyz --status in_progress --json  # Claim work
bd close bd-xyz --reason "Done" --json  # Complete work
bd sync                              # Force export/commit/push (END OF SESSION!)
bd dep tree bd-xyz                   # View dependency graph
```

### How It Fits With Our Process

**Two complementary systems:**

| System | Purpose | Contains |
|--------|---------|----------|
| **Process docs** (STATE, CURRENT, PROCESS, CLAUDE) | Planner context | What we know, how we work, system health, principles |
| **Beads** | Work orchestration | What needs doing, dependencies, who's working on what |

**Beads is for work tracking, NOT context maintenance.**

- Doesn't replace STATE.md (system health)
- Doesn't replace CURRENT.md (active focus/slice)
- Doesn't replace PROCESS.md (how we work)
- Doesn't hold architectural knowledge or mental model

### Integration Pattern

```
PLANNER (with process docs)
    │
    ├── Understands system via STATE.md
    ├── Knows focus via CURRENT.md
    ├── Follows workflow via PROCESS.md
    │
    ├── `bd ready` → Find unblocked work
    ├── Creates spec, files issue
    └── Dispatches to SUBAGENT
             │
             ├── Gets issue context
             ├── Does work
             ├── Discovers new work → `bd create --deps discovered-from:<id>`
             ├── `bd close` when done
             └── Returns summary to planner
```

### Where To Use Beads

1. **Epic planning** - Large features as epics with child tasks (bd-abc.1, bd-abc.2)
2. **Subagent dispatch** - Each issue = clear unit of work
3. **Dependency tracking** - What blocks what
4. **Session handoffs** - `bd sync` at end, `bd ready` at start
5. **Discovered work** - Bugs/TODOs found during implementation get filed

### Where NOT To Use Beads

1. Maintaining planner mental model
2. Tracking system health (STATE.md)
3. Storing process/workflow principles
4. Architectural knowledge

### Getting Started

```bash
cd ~/code/codex-port-02/cody-fastify
bd init --quiet  # Non-interactive for agents
# Add to CLAUDE.md or AGENTS.md: "Use bd for work tracking"
```

### High-Signal Docs in Beads Repo

- `README.md` - Overview
- `AGENTS.md` - Agent workflow instructions
- `docs/QUICKSTART.md` - 2-minute tutorial
- `docs/CLI_REFERENCE.md` - All commands
- `docs/AGENT_MAIL.md` - Multi-agent coordination (optional)

---

## Other Process Refinements (This Session)

### Context Checkpoints (Refined)

**Notifications (awareness only):** 75k, 125k, 160k, 170k

**Checkpoints (action required):**
- **100k** - Mid-session: Evaluate STATE.md, CURRENT.md for updates
- **150k** - Pre-cutover: Final wrap-up, prepare handoff

### Slash Command Naming

- `/review` conflicts with built-in - need different name
- Suggested: `/docreview` or `/checkpoint-review` or just use `/checkpoint`

### Key Docs Created This Session

- `STATE.md` - Ground truth (working/broken/in-progress)
- `CURRENT.md` - Active slice
- `PROCESS.md` - Workflow, checkpoints, drift detection
- `TOOLS.md` - Extension tools design (slash commands, subagents)
- `templates/SPEC-TEMPLATE.md` - Feature spec template
- `templates/PROMPT-TEMPLATE.md` - Coder dispatch template
- `templates/LARGE-FEATURE-TEMPLATE.md` - Multi-slice breakdown

### Outstanding TODOs

- [ ] Create actual slash command files in `.claude/commands/`
- [ ] Rename `/review` command to avoid conflict
- [ ] Initialize beads in cody-fastify
- [ ] File test infrastructure work as beads epic

---

## Next Steps After Rollback

1. Read this file to absorb beads insights
2. Continue refining process docs
3. Create slash command files
4. Decide on beads initialization timing
5. Move on to actual work (test infrastructure recovery)
