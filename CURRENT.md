# CURRENT.md - Active Slice

**Last Updated:** 2025-11-26

---

## Slice: Test Strategy & Baseline

### The ONE Thing
Evaluate test harness strategy and establish 2 baseline tests (with/without tools)

### Done When
- [ ] Test strategy decided (new approach OR refactor harness)
- [ ] 2 baseline tests implemented and passing
  - Basic turn (no tools)
  - Turn with tool call
- [ ] Tests verify real behavior (no infrastructure mocks)
- [ ] Ready to add history tests

### NOT Touching
- History implementation
- Thinking implementation
- UI code
- Other providers (Anthropic, Chat Completions, OpenRouter)

### Integration Points
- Tests use real Redis, Convex, workers
- Tests mock only LLM API responses
- Baseline establishes pattern for future tests

---

## Blockers

None.

---

## Session Notes

*Clear on session end.*

**Completed:**
- 2025-11-25: Created STATE, PROCESS, CURRENT, TOOLS, NEXT, templates, updated CLAUDE.md
- 2025-11-25 (100k): Added beads docs, refined checkpoints, renamed /doccheck
- 2025-11-26: Built prompt assembly skill, evaluated UI (staying vanilla JS), documented API details, established phased roadmap

---

**See NEXT.md for full roadmap.**
