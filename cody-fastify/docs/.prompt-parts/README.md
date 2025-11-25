# .prompt-parts

Composable prompt elements for coder and verifier dispatch.

## Structure

```
.prompt-parts/
├── README.md              # This file
├── roles/
│   ├── coder.md           # Coder role definition
│   └── verifier.md        # Verifier role definition
├── parts/
│   ├── app-overview.md            # Application context
│   ├── state-summary-template.md  # Template for current state
│   ├── directory-structure.md     # Codebase layout
│   ├── standards.md               # Technical & coding standards
│   ├── definition-of-done.md      # DoD checks
│   └── job-breakdown-template.md  # Job spec at different altitudes
├── output-formats/
│   ├── coder-output.md    # How coder reports results
│   └── verifier-output.md # How verifier reports results
├── templates/
│   └── assembly-spec.md   # How to assemble full prompts
├── assembled/             # Working directory for assembled prompts
└── examples/              # Example assembled prompts
```

## Quick Start

1. Read `templates/assembly-spec.md` for the full process
2. Gather context (STATE, CURRENT, job definition)
3. Choose altitude (ground / 500ft / 1000ft)
4. Assemble coder prompt from parts
5. Assemble verifier prompt from parts
6. Create beads for tracking
7. Dispatch

## Altitude Guide

| Altitude | Detail Level | When to Use |
|----------|--------------|-------------|
| ground | Line-by-line | Precise changes, bug fixes, specific insertions |
| 500ft | Function/method | New functions, refactoring, clear scope |
| 1000ft | Component/module | Feature work, broader changes, pattern following |

## Bead Attributes

When creating beads for prompts:

- `type`: coder-prompt / verifier-prompt
- `altitude`: ground / 500ft / 1000ft
- `status`: pending / in_progress / complete
