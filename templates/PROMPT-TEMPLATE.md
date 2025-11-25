# Coder Prompt: [TASK NAME]

---

## Context

*Just enough to understand the task. Don't dump everything.*

You're working on **cody-fastify**, a streaming-first LLM harness. [1-2 sentences of relevant context for this specific task.]

**Relevant files:**
- `path/to/main-file.ts` - [why relevant]
- `path/to/related.ts` - [why relevant]

---

## Task

*Right altitude: not too high ("implement feature"), not too low ("add line 47"). Specific but not micromanaging.*

[Clear statement of what to do]

**Steps:**
1. [First thing to do]
2. [Second thing to do]
3. [Verification step]

---

## Interfaces / Contracts

*What shapes must the code conform to?*

```typescript
// Must implement/use these types
interface Required {
  field: type;
}
```

---

## Integration Points

*Where does this connect?*

- Integrates with: `path/to/integration-point.ts:functionName`
- Called by: [what invokes this]
- Calls: [what this invokes]

---

## Constraints

*Explicit "DO NOT" list. Fight convergent defaults.*

**DO NOT:**
- Mock Redis, Convex, or workers - use real local instances
- Add new abstraction layers or adapters
- Modify files outside the scope listed above
- Skip or disable existing tests
- Add "temporary" workarounds

**DO:**
- Run existing tests after changes: `npm test -- -t "relevant tests"`
- Follow existing patterns in the codebase
- Ask if something is unclear rather than guessing

---

## Done When

*Verifiable completion criteria.*

- [ ] [Test passes: `npm test -- -t "specific test"`]
- [ ] [Behavior works: specific observable outcome]
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`

---

## Anti-Patterns to Avoid

*Specific to this task.*

- [Pattern]: [Why it's wrong for this task]
- [Pattern]: [Why it's wrong for this task]

---

## Return

*What to report back.*

1. Summary of changes made
2. Test results
3. Any issues encountered or decisions made
4. Files modified (list)
