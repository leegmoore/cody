# Large Feature: [NAME]

**Status:** Planning | In Progress | Complete
**Target:** [what milestone/release]
**Last Updated:** [date]

---

## Overview

*What is this feature at the highest level?*

[2-3 sentences describing the feature from user/system perspective]

---

## Why Now

*Why is this the right time to build this?*

[Context on priority, dependencies met, value unlocked]

---

## Success Criteria

*How do we know the whole feature is done?*

- [ ] [End-to-end test scenario]
- [ ] [User-visible capability]
- [ ] [Integration verified]

---

## Dependency Graph

*What depends on what? Build order.*

```
[slice-1: Foundation]
       │
       ▼
[slice-2: Core Logic] ──────┐
       │                    │
       ▼                    ▼
[slice-3: Integration]  [slice-4: Alt Path]
       │                    │
       └────────┬───────────┘
                ▼
        [slice-5: Polish]
```

---

## Slices

### Slice 1: [Name]

**What:** [One sentence]
**Done when:** [Specific criteria]
**Estimate:** [S/M/L or hours]
**Dependencies:** None

**Key files:**
- `path/to/file.ts`

---

### Slice 2: [Name]

**What:** [One sentence]
**Done when:** [Specific criteria]
**Estimate:** [S/M/L or hours]
**Dependencies:** Slice 1

**Key files:**
- `path/to/file.ts`

---

### Slice 3: [Name]

**What:** [One sentence]
**Done when:** [Specific criteria]
**Estimate:** [S/M/L or hours]
**Dependencies:** Slice 2

**Key files:**
- `path/to/file.ts`

---

*[Add more slices as needed]*

---

## Out of Scope

*What's NOT part of this feature?*

- [Related thing we're deferring]
- [Nice-to-have we're skipping]

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| [risk] | [what happens] | [how to handle] |

---

## Open Questions

*Decisions that need to be made during implementation.*

- [ ] [Question] - [options if known]
- [ ] [Question]

---

## Progress Tracking

| Slice | Status | Notes |
|-------|--------|-------|
| Slice 1 | Not Started / In Progress / Complete | |
| Slice 2 | Not Started | Blocked by Slice 1 |
| Slice 3 | Not Started | |

---

## Notes / Decisions Log

*Record decisions made during implementation.*

**[Date]:** [Decision made and why]
