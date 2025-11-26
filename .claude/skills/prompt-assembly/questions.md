# Prompt Assembly Questions

Gather these before assembling prompts.

---

## 1. Project

Which project is this for?
- `01-api` - API iterative work
- `02-ui` - UI work
- Other: ___

## 2. Job Name

Short name for filenames (kebab-case, e.g., "thinking-support", "tool-timeout"):

___

## 3. Job Overview

What does this work accomplish? (1-2 sentences)

___

## 4. Current State

Brief description of where we are now (1-3 sentences):

___

---

## 5. Technical Specification

The meat of the prompt. Can include:
- What needs to be done
- How to do it (at appropriate level of detail)
- Prerequisites / dependencies
- Workflow steps
- Implementation guidance
- Constraints specific to this job

**Do you have a tech spec already?**

### If YES:
- File path: ___

### If NO - describe the work:

**What needs to be done?**

___

**How should it be done?** (appropriate detail level)

___

**Key files involved:**
- ___
- ___

---

## 6. Definition of Done - Job-Specific Items

Standard items are always included (tests, format, lint, typecheck).

**Additional job-specific items:**
- [ ] ___
- [ ] ___
- [ ] ___

---

## 7. Optional Fields

### Why we need this (project context)
What's the purpose? Why now?

___

### Known Issues
Any bugs or errors this work should address?

___

### Specific Avoidances
What should the agent NOT do?
- ___
- ___

---

## Config JSON Format

```json
{
  "project": "01-api",
  "jobName": "example-job",
  "jobOverview": "What this work accomplishes",
  "stateSummary": "Current state of the system",
  "techSpec": "Full technical specification...",
  "keyFiles": [
    "src/file1.ts",
    "src/file2.ts"
  ],
  "dodItems": [
    "Job-specific DoD item 1",
    "Job-specific DoD item 2"
  ],
  "projectWhy": "Optional: why we need this work",
  "knownIssues": "Optional: known issues",
  "avoidances": [
    "Optional: things to avoid"
  ]
}
```
