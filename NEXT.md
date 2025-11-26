# NEXT.md - Work Queue

**Last Updated:** 2025-11-26

Phased roadmap for cody-fastify development.

---

## Phases

### Phase 1: Test Foundation (CURRENT)

**Status:** In Progress

1. **Evaluate test harness strategy**
   - Audit current harness for mock corruption
   - Decide: new approach OR refactor with clean mocks

2. **Baseline 2 tests**
   - Test 1: Basic turn (no tools) - submit → stream → persist
   - Test 2: Turn with tool call - submit → tool execution → persist
   - Both must use real Redis, Convex, workers (mock only LLM responses)

**Done when:** 2 baseline tests passing, pattern established for future tests

---

### Phase 2: OpenAI Full Support

**Status:** Not Started
**Depends on:** Phase 1 complete

3. **Add test: multi-turn history** (will fail initially)
   - Turn 1: "What's 2+2?"
   - Turn 2: "What about that number plus 3?"
   - Verify turn 2 has context from turn 1

4. **Implement OpenAI history support**
   - Load previous turns from Convex
   - Convert OutputItems → ResponseItems for input array
   - Include reasoning items in history
   - Reference: codex-ts conversation-history implementation

5. **Add test: thinking display**
   - Request with reasoning enabled
   - Verify reasoning OutputItems in response
   - Verify UI displays thinking bubbles

6. **Implement thinking support**
   - Complete UI rendering for reasoning items
   - Test streaming and refresh paths

**Done when:** OpenAI multi-turn with thinking works end-to-end

---

### Phase 3: UI Refinement

**Status:** Not Started
**Depends on:** Phase 2 complete

7. **Iterate UI with tested API**
   - Thinking bubbles working and polished
   - History context visible in conversations
   - Tool calls displaying correctly

8. **UI enhancements** (staying vanilla JS)
   - Model selection dropdown
   - File tree population (left sidebar)
   - File viewer page with compact chat
   - Live file updates
   - Consider iframe approach for modularity

**Done when:** UI supports all API features, feels polished

---

### Phase 4: Anthropic Full Support

**Status:** Not Started
**Depends on:** Phase 2 complete (OpenAI baseline)

9. **Test: 1-turn no tools** → Fix if needed
10. **Test: 1-turn with tool calls** → Fix if needed
11. **Test: multi-turn with history** → Fix if needed
    - Verify reasoning filtered out (not sent to Anthropic)
12. **Test: thinking display** → Fix if needed

**Pattern:** Add test, verify it fails correctly, implement, verify pass

**Done when:** Anthropic Messages API works same as OpenAI (minus reasoning in history)

---

### Phase 5: Additional Providers

**Status:** Future
**Depends on:** Phases 2 & 4 complete

13. **Chat Completions API support**
    - Same test progression (basic → tools → history → thinking)
    - Adapt for stateless Chat Completions format

14. **OpenRouter support**
    - Same test progression
    - Handle provider routing

**Done when:** All major APIs supported with full feature parity

---

## Sidelined Work

Items deferred to later:

- **Model/Provider Configuration** - runtime model selection UI
- **Tool Scoping** - per-agent/thread tool policies
- **Legacy v1 Routes** - cleanup or wire up
- **Beads initialization** - work tracking (deferred)

---

## Completed This Session (2025-11-26)

**Process Foundation:**
- ✓ Created STATE.md, CURRENT.md, NEXT.md, PROCESS.md, TOOLS.md
- ✓ Defined working modes (informal vs formal)
- ✓ Built prompt assembly skill with templates
- ✓ Created /core-doc-review command
- ✓ Established projects/01-api/ and projects/02-ui/ structure
- ✓ Evaluated UI framework decision → staying vanilla JS
- ✓ Documented API history handling (response-messages-api-details.md)
- ✓ Established phased roadmap

---

## Key Insights

**From this session:**
- UI at 1600 lines vanilla JS is manageable, not complex
- iframe approach could improve modularity without framework overhead
- Test baseline comes before feature work (can't verify without trustworthy tests)
- History is critical (currently missing, breaks multi-turn conversations)
- OpenAI and Anthropic handle history differently (stateful vs stateless, reasoning inclusion)

---

**See CURRENT.md for active slice.**
