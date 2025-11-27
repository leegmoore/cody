# NEXT.md - Work Queue

**Last Updated:** 2025-11-26

Phased roadmap for cody-fastify development.

---

## Phases

### Phase 1: Test Foundation ✓ COMPLETE

**Status:** Complete

1. ✓ **Test harness strategy decided**
   - New approach: `test-suites/tdd-api/`
   - Full integration, no mocks
   - Connectivity checks for infrastructure validation

2. ✓ **Baseline test implemented**
   - `simple-prompt.test.ts`: submit → stream → persist → verify
   - Uses ResponseReducer for event hydration
   - Compares hydrated response to persisted run
   - Strong types throughout

**Completed:** Test suite working, ready for Phase 2

---

### Phase 2: OpenAI Full Support ← CURRENT

**Status:** In Progress
**Depends on:** Phase 1 complete ✓

3. **Add test: tool calls** ✓ IN VERIFICATION
   - Prompt: pwd + ls shell commands
   - Verify >= 2 function_call items stream and persist
   - Verify call_id matching between function_call and function_call_output
   - Detailed hydrated vs persisted comparison
   - Spec: `projects/01-api/002-more-tdd-tests/SPEC.md`
   - **Timeout:** 20 seconds (tool calls need more time)

4. **Add test: multi-turn history** (will fail initially)
   - Turn 1: "What's 2+2?"
   - Turn 2: "What about that number plus 3?"
   - Verify turn 2 has context from turn 1

5. **Implement OpenAI history support**
   - Load previous turns from Convex
   - Convert OutputItems → ResponseItems for input array
   - Include reasoning items in history
   - Reference: codex-ts conversation-history implementation

6. **Add test: thinking display**
   - Request with reasoning enabled
   - Verify reasoning OutputItems in response
   - Verify UI displays thinking bubbles

7. **Implement thinking support**
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

**Process Foundation (morning):**
- ✓ Created STATE.md, CURRENT.md, NEXT.md, PROCESS.md, TOOLS.md
- ✓ Defined working modes (informal vs formal)
- ✓ Built prompt assembly skill with templates
- ✓ Created /core-doc-review command
- ✓ Established projects/01-api/ and projects/02-ui/ structure
- ✓ Evaluated UI framework decision → staying vanilla JS
- ✓ Documented API history handling (response-messages-api-details.md)
- ✓ Established phased roadmap

**Phase 1 Complete (afternoon):**
- ✓ Implemented tdd-api test suite
- ✓ First integration test passing (simple-prompt.test.ts)
- ✓ 4 connectivity checks (Redis, Convex, OpenAI, Fastify)
- ✓ ResponseReducer hydration with comparison assertions
- ✓ Wired up prompt-assembly skill (YAML frontmatter)
- ✓ Tracked .claude/ directory in git

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
