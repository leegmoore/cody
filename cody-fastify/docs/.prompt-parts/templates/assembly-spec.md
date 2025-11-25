# Prompt Assembly Specification

How to construct coder and verifier prompts from parts.

---

## Assembly Process

### Step 1: Gather Context

Before assembling, collect:
- Current STATE.md summary
- Current CURRENT.md focus
- Relevant NEXT.md items
- Any session-specific decisions

### Step 2: Define the Job

Decide:
- **Altitude:** ground / 500ft / 1000ft
- **Files to touch:** explicit list
- **Files NOT to touch:** explicit exclusions
- **Integration points:** where this connects

### Step 3: Assemble Coder Prompt

Concatenate in order:

```
1. roles/coder.md
2. parts/app-overview.md
3. [Filled state-summary from template]
4. [Job overview - your writing]
5. parts/directory-structure.md
6. [Job breakdown at chosen altitude - your writing using template]
7. parts/standards.md
8. parts/definition-of-done.md
9. output-formats/coder-output.md
```

### Step 4: Assemble Verifier Prompt

Concatenate in order:

```
1. roles/verifier.md
2. parts/app-overview.md
3. [Same state-summary used for coder]
4. [Same job overview]
5. parts/directory-structure.md
6. [Same job breakdown - verifier needs to know what was asked]
7. parts/standards.md (verifier checks against these)
8. parts/definition-of-done.md
9. output-formats/verifier-output.md
```

---

## Bead Creation

After assembling prompts, create beads for tracking.

### Coder Prompt Bead

```bash
bd create "[Job title] - Coder Prompt" \
  -t coder-prompt \
  --field altitude=[ground|500ft|1000ft] \
  --field status=pending
```

Attach the assembled prompt as the issue description or link to file.

### Verifier Prompt Bead

```bash
bd create "[Job title] - Verifier Prompt" \
  -t verifier-prompt \
  --field altitude=[ground|500ft|1000ft] \
  --field status=pending \
  --deps blocks:[coder-bead-id]
```

The verifier bead is blocked by the coder bead.

---

## Workflow Execution

### Dispatch to Coder

1. Coder pulls bead: `bd update [id] --status in_progress`
2. Coder reads prompt (from bead description or linked file)
3. Coder does work
4. Coder outputs using coder-output.md format
5. Coder closes bead: `bd close [id] --reason "Complete"`
6. Output saved to file and/or console

### Dispatch to Verifier

1. Verifier bead becomes unblocked when coder bead closes
2. Verifier pulls bead: `bd update [id] --status in_progress`
3. Verifier reads prompt + coder's output
4. Verifier runs checks and reviews
5. Verifier outputs using verifier-output.md format
6. Verifier closes bead with recommendation

### Planner Review

1. Planner reviews verifier output
2. If recommended: approve, merge, move on
3. If not recommended: address issues, re-dispatch, or approve with noted risks

---

## Optional: Prompt Critique Agent

Before finalizing prompts, optionally run a critique agent:

```
/critique-prompts [coder-prompt-file] [verifier-prompt-file]
```

Agent reviews:
- Prompt completeness
- Altitude appropriateness
- Standards coverage
- Potential ambiguities

Returns feedback for planner to incorporate before dispatch.

---

## File Naming Convention

Assembled prompts go in a working directory:

```
.prompt-parts/assembled/
├── [job-slug]-coder.md
├── [job-slug]-verifier.md
└── [job-slug]-output.md  (after completion)
```

Or link directly from bead description.
