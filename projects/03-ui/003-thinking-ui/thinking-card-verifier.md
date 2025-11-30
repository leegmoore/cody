# VERIFIER PROMPT: Thinking Card UI (Clean-Slate)

**Generated:** 2025-11-29
**Project:** 03-ui

---

## ROLE

You are a senior JavaScript/CSS developer verifying completed implementation work.

---

## TASK

Verify the thinking card clean-slate implementation:
1. All old code properly deleted
2. New implementation is correct and complete
3. Event wiring works
4. App loads and functions

**Note:** This is vanilla JavaScript - there is no typecheck for frontend files.

---

## PASS/FAIL CRITERIA

**PASS** if ALL of the following are true:
- Sections 1-5 pass (deletions, new file, CSS, integration, code quality)
- App loads without JavaScript console errors

**Section 6 (Functional Testing)** is verification/confirmation, not a blocker. If you cannot trigger thinking events to test, note "not tested" and still PASS if sections 1-5 are complete.

---

## VERIFICATION CHECKLIST

### 1. Deletions Complete

**state.js:**
- [ ] `activeThinkingId` property removed
- [ ] `thinkingBlocks` property removed

**styles.css:**
- [ ] No `.thinking-*` CSS rules remain (search for "thinking-")
- [ ] No `.reasoning-*` CSS rules remain (search for "reasoning-")

**ui.js:**
- [ ] These 9 functions are removed: `ensureThinkingBlock`, `createThinkingBlock`, `toggleThinkingExpansion`, `resolveThinkingId`, `updateThinkingContent`, `handleThinkingStarted`, `handleThinkingDelta`, `handleThinkingCompleted`, `renderReasoningItem`
- [ ] `case 'reasoning':` removed from `renderResponseItems`
- [ ] No references remain to `state.thinkingBlocks` or `state.activeThinkingId`

### 2. New File Created

**File:** `cody-fastify/public/js/thinking-card.js`

- [ ] File exists
- [ ] Exports `ThinkingCard` class
- [ ] Exports `ThinkingCardManager` class
- [ ] Exports `thinkingCards` singleton instance

**ThinkingCard class provides:**
- [ ] `create()` - builds and inserts DOM element
- [ ] `append(text)` - adds streaming content
- [ ] `complete(finalText)` - finalizes the card
- [ ] `toggle()` - expands/collapses completed card
- [ ] `destroy()` - removes DOM element from page

**ThinkingCardManager class provides:**
- [ ] `create(id, runId)` - creates and tracks a card
- [ ] `append(id, text)` - delegates to card
- [ ] `complete(id, finalText)` - delegates to card
- [ ] `get(id)` - retrieves a card
- [ ] `clear()` - removes all cards (including their DOM elements)

**Positioning behavior:**
- [ ] Card inserts after user message OR before tool timeline (not just appended to end)

### 3. New CSS Added

**styles.css:**
- [ ] `.tc-wrapper` class exists
- [ ] `.tc-card` class exists with streaming and completed states
- [ ] `.tc-content` class exists with height constraints for streaming/completed/expanded states
- [ ] `.tc-shimmer` animation exists for "Thinking..." status
- [ ] Footer becomes visible when card is completed

### 4. Integration Complete

**stream.js:**
- [ ] Imports `thinkingCards` from `thinking-card.js`
- [ ] Has function that handles thinking events (routes `item_start`/`item_delta`/`item_done` for reasoning type)
- [ ] Thinking event handling happens before or alongside reducer processing

**ui.js:**
- [ ] Imports `thinkingCards` from `thinking-card.js`
- [ ] `resetToolCallState` calls `thinkingCards.clear()` instead of old state clearing

### 5. Code Quality

Run in cody-fastify directory:
```bash
bun run format
bun run lint
```

- [ ] format produces no changes (or only whitespace/style changes)
- [ ] lint passes with no errors

### 6. Functional Testing (Verification, Not Blocking)

If you can trigger thinking events (Anthropic with thinkingBudget):

**Basic behavior:**
- [ ] Thinking card appears when reasoning starts
- [ ] Content streams into the card
- [ ] Card shows "Finished" when complete
- [ ] Completed card is collapsed, click expands it

**Positioning:**
- [ ] Card appears after user message, before tool calls (if any)

**Clear behavior:**
- [ ] `thinkingCards.clear()` removes DOM elements, not just clears the Map

If you cannot test: Note "not tested - no thinking events available" and proceed.

---

## OUTPUT FORMAT

```
## Verification Result: [PASS/FAIL]

### 1. Deletions
- state.js: [complete/issues]
- styles.css: [complete/issues]
- ui.js: [complete/issues]

### 2. New File
- thinking-card.js exists: [yes/no]
- ThinkingCard class: [complete/issues]
- ThinkingCardManager class: [complete/issues]
- Positioning logic present: [yes/no]

### 3. New CSS
- TC classes added: [yes/no]
- Height states (streaming/completed/expanded): [yes/no]
- Shimmer animation: [yes/no]

### 4. Integration
- stream.js wiring: [complete/issues]
- ui.js wiring: [complete/issues]

### 5. Code Quality
- format: [pass/fail]
- lint: [pass/fail]

### 6. Functional Testing
- Status: [tested/not tested]
- Results: [pass/issues/n/a]

### Issues Found
[List any issues, or "None"]

### Recommendations
[Any follow-up work needed, or "None - implementation is complete"]
```
