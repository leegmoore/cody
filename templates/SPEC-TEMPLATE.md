# Feature Spec: [NAME]

**Status:** Draft | Ready | In Progress | Complete
**Owner:** [who's driving this]
**Last Updated:** [date]

---

## What (Functional)

*What does the user/system get when this is done? Write from the perspective of the capability, not the implementation.*

[2-3 sentences describing the functional outcome]

**User can:**
- [capability 1]
- [capability 2]

---

## Why (Context)

*Why does this matter? What problem does it solve? What's the cost of not doing it?*

[1-2 paragraphs of context]

---

## Where (Integration)

*Where does this connect to existing code? What files/modules are involved?*

**Touches:**
- `path/to/file.ts` - [what changes]
- `path/to/other.ts` - [what changes]

**Does NOT touch:**
- `path/to/leave-alone.ts` - [why excluded]

---

## Shape (Interfaces)

*What are the contracts? Types, APIs, function signatures.*

```typescript
// Key interfaces
interface Example {
  field: type;
}

// Key functions
function doThing(input: Type): ReturnType;
```

**API changes (if any):**
- `POST /path` - [new/modified endpoint]

---

## Done When

*Specific, verifiable criteria. Not "it works" - what tests pass? What behavior is observable?*

- [ ] [Specific test passes: `npm test -- -t "test name"`]
- [ ] [Specific behavior: "User can click X and see Y"]
- [ ] [Integration verified: "Data flows from A to B to C"]

---

## Not Doing (Explicit Scope)

*What's explicitly out of scope? Prevents creep.*

- NOT: [related thing we're not doing]
- NOT: [optimization we're deferring]
- NOT: [edge case we're ignoring for now]

---

## Risks / Unknowns

*What could go wrong? What don't we know yet?*

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| [risk] | Low/Med/High | [how to handle] |

**Unknowns:**
- [thing we need to discover during implementation]

---

## Dependencies

*What needs to exist/work before this can start?*

- [x] [completed dependency]
- [ ] [pending dependency]

---

## Notes

*Additional context, links, decisions made.*

- [note]
