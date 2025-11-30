# CODER PROMPT: Thinking Card UI (Clean-Slate)

**Generated:** 2025-11-29
**Project:** 03-ui

---

## ROLE

You are a senior JavaScript/CSS developer. Your task: **Delete all existing thinking/reasoning UI code and implement a fresh ThinkingCard system from scratch.**

---

## APPLICATION OVERVIEW

This is a vanilla JS/HTML/CSS chat UI for an LLM streaming application. The UI displays user prompts, agent responses, tool calls (as tiled cards), and thinking/reasoning blocks.

The current thinking implementation is broken - two separate systems that aren't properly wired together. We're deleting everything and rebuilding cleanly.

**Note:** This is vanilla JavaScript (not TypeScript). There is no typecheck for frontend files.

---

## CURRENT STATE

- Thinking/reasoning events flow correctly from the backend
- UI has two conflicting renderers (`renderReasoningItem` and `createThinkingBlock`)
- Neither works correctly - positioning is wrong, event wiring is broken
- All existing thinking code will be deleted

---

## JOB OVERVIEW

1. **Phase 1:** Delete old code from state.js and styles.css
2. **Phase 2:** Add new CSS styles
3. **Phase 3:** Create new `thinking-card.js` module
4. **Phase 4:** Wire everything together (stream.js, ui.js deletions, ui.js imports)
5. **Phase 5:** Verify and test

**Important sequencing:** We create `thinking-card.js` (Phase 3) BEFORE modifying `ui.js` (Phase 4) because `ui.js` will import from it.

---

## DIRECTORY STRUCTURE

```
cody-fastify/public/
├── index.html
├── css/
│   └── styles.css        # Modify: delete old CSS, add new CSS
└── js/
    ├── app.js            # No changes needed
    ├── ui.js             # Modify in Phase 4: delete functions, add import, update resetToolCallState
    ├── state.js          # Modify in Phase 1: delete old state properties
    ├── stream.js         # Modify in Phase 4: add thinking event handling
    └── thinking-card.js  # NEW FILE (Phase 3)
```

---

## PHASE 1: DELETE FROM STATE.JS AND STYLES.CSS

### 1.1 Delete from `state.js`

Remove these properties from the state object:
```javascript
activeThinkingId: null,      // DELETE (line ~8)
thinkingBlocks: new Map(),   // DELETE (line ~13)
```

### 1.2 Delete from `styles.css`

Remove ALL CSS rules with these class patterns:
- `.thinking-*` (all thinking-prefixed classes)
- `.reasoning-*` (all reasoning-prefixed classes)

Search for and delete rules targeting:
- `.thinking-card`
- `.thinking-card-header`
- `.thinking-card-title`
- `.thinking-card-footer`
- `.thinking-content`
- `.thinking-status`
- `.thinking-hint`
- `.thinking-chevron`
- `.thinking-message`
- `.reasoning-item`
- `.reasoning-content`
- `.reasoning-message`
- Any hover, active, streaming, completed, expanded variants

**Note:** The CSS for these is approximately lines 255-338 in styles.css. Delete the entire section.

---

## PHASE 2: ADD NEW CSS

Add to `styles.css` (at the end, or where you deleted the old thinking CSS):

```css
/* ===========================================
   THINKING CARD - Clean Implementation
   =========================================== */

/* Wrapper - positions in chat flow */
.tc-wrapper {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 1rem;
    animation: tc-fade-in 0.2s ease-out;
}

@keyframes tc-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Card container */
.tc-card {
    background: linear-gradient(135deg, #fef7f0 0%, #fdf4ec 100%);
    border: 1px solid rgba(180, 130, 90, 0.25);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    max-width: 85%;
    min-width: 280px;
    box-shadow: 0 1px 3px rgba(139, 90, 43, 0.08);
    cursor: default;
}

.tc-card.tc-completed {
    cursor: pointer;
}

.tc-card.tc-completed:hover {
    border-color: rgba(180, 130, 90, 0.4);
}

/* Header */
.tc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
}

.tc-title {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.tc-icon {
    width: 1rem;
    height: 1rem;
    color: #c2410c;
    flex-shrink: 0;
}

.tc-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    color: #78350f;
}

.tc-status {
    font-size: 0.75rem;
    font-weight: 600;
    color: #92400e;
}

/* Shimmer animation for "Thinking..." */
.tc-shimmer {
    background: linear-gradient(90deg, #92400e 0%, #f59e0b 50%, #92400e 100%);
    background-size: 200% 100%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: tc-shimmer 2s ease-in-out infinite;
}

@keyframes tc-shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
}

/* Content area */
.tc-content {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 0.875rem;
    line-height: 1.35;
    color: #451a03;
    white-space: pre-wrap;
    word-break: break-word;
}

/* Streaming: up to 5 lines visible, then scrolls */
.tc-card.tc-streaming .tc-content {
    max-height: 7em;
    overflow-y: auto;
    transition: max-height 0.15s ease-out;
}

/* Completed: collapsed to 2 lines */
.tc-card.tc-completed .tc-content {
    max-height: 2.8em;
    overflow: hidden;
}

/* Completed + Expanded: show 5 lines with scroll */
.tc-card.tc-completed.tc-expanded .tc-content {
    max-height: 7em;
    overflow-y: auto;
}

/* Scrollbar styling */
.tc-content::-webkit-scrollbar {
    width: 4px;
}

.tc-content::-webkit-scrollbar-track {
    background: transparent;
}

.tc-content::-webkit-scrollbar-thumb {
    background: rgba(146, 64, 14, 0.3);
    border-radius: 2px;
}

.tc-content::-webkit-scrollbar-thumb:hover {
    background: rgba(146, 64, 14, 0.5);
}

/* Footer */
.tc-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem;
    margin-top: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.tc-card.tc-completed .tc-footer {
    opacity: 1;
}

.tc-hint {
    font-size: 0.6875rem;
    font-weight: 600;
    color: rgba(120, 53, 15, 0.6);
}

.tc-chevron {
    width: 0.875rem;
    height: 0.875rem;
    color: rgba(120, 53, 15, 0.5);
    transition: transform 0.2s ease;
}

.tc-card.tc-completed.tc-expanded .tc-chevron {
    transform: rotate(180deg);
}
```

---

## PHASE 3: CREATE `thinking-card.js`

Create new file: `cody-fastify/public/js/thinking-card.js`

```javascript
/**
 * ThinkingCard - A single thinking/reasoning display card
 */
export class ThinkingCard {
    constructor(id, runId) {
        this.id = id;
        this.runId = runId;
        this.content = '';
        this.element = null;
        this.contentEl = null;
        this.statusEl = null;
        this.isCompleted = false;
        this.isExpanded = false;
    }

    create() {
        const chatHistory = document.getElementById('chatHistory');
        if (!chatHistory) return null;

        this.element = this._buildDOM();
        this._insertAtPosition(chatHistory);
        this._bindEvents();
        this._scrollChatToBottom();

        return this;
    }

    append(text) {
        if (!text || this.isCompleted) return;

        this.content += text;
        if (this.contentEl) {
            this.contentEl.textContent = this.content;
            this._autoScrollContent();
        }
    }

    complete(finalText) {
        if (finalText !== undefined) {
            this.content = finalText;
            if (this.contentEl) {
                this.contentEl.textContent = this.content;
            }
        }

        this.isCompleted = true;

        if (this.element) {
            const card = this.element.querySelector('.tc-card');
            card?.classList.remove('tc-streaming');
            card?.classList.add('tc-completed');
        }

        if (this.statusEl) {
            this.statusEl.textContent = 'Finished';
            this.statusEl.classList.remove('tc-shimmer');
        }
    }

    toggle() {
        if (!this.isCompleted) return;

        this.isExpanded = !this.isExpanded;
        const card = this.element?.querySelector('.tc-card');

        if (this.isExpanded) {
            card?.classList.add('tc-expanded');
        } else {
            card?.classList.remove('tc-expanded');
        }
    }

    /**
     * Remove the DOM element from the page
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.contentEl = null;
        this.statusEl = null;
    }

    _buildDOM() {
        const wrapper = document.createElement('div');
        wrapper.className = 'tc-wrapper';
        wrapper.dataset.thinkingId = this.id;
        if (this.runId) {
            wrapper.dataset.runId = this.runId;
        }

        wrapper.innerHTML = `
            <div class="tc-card tc-streaming">
                <div class="tc-header">
                    <div class="tc-title">
                        <svg class="tc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                        <span class="tc-label">Thinking</span>
                    </div>
                    <span class="tc-status tc-shimmer">Thinking...</span>
                </div>
                <div class="tc-content"></div>
                <div class="tc-footer">
                    <span class="tc-hint">Click to expand</span>
                    <svg class="tc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 6 6-6"/>
                    </svg>
                </div>
            </div>
        `;

        this.contentEl = wrapper.querySelector('.tc-content');
        this.statusEl = wrapper.querySelector('.tc-status');

        return wrapper;
    }

    _insertAtPosition(chatHistory) {
        // Priority 1: Insert before tool timeline for this run
        if (this.runId) {
            const toolTimeline = chatHistory.querySelector(
                `[data-tool-timeline-id="${this.runId}"]`
            );
            if (toolTimeline) {
                chatHistory.insertBefore(this.element, toolTimeline);
                return;
            }
        }

        // Priority 2: Insert after the last user message
        // User messages have class "flex justify-end" AND a data-item-id attribute
        const userMessages = chatHistory.querySelectorAll('.flex.justify-end[data-item-id]');
        if (userMessages.length > 0) {
            const lastUserMessage = userMessages[userMessages.length - 1];
            const nextSibling = lastUserMessage.nextSibling;
            if (nextSibling) {
                chatHistory.insertBefore(this.element, nextSibling);
            } else {
                chatHistory.appendChild(this.element);
            }
            return;
        }

        // Fallback: Append to end
        chatHistory.appendChild(this.element);
    }

    _bindEvents() {
        const card = this.element?.querySelector('.tc-card');
        card?.addEventListener('click', () => {
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;
            this.toggle();
        });
    }

    _autoScrollContent() {
        // Keep thinking content scrolled to bottom during streaming
        if (!this.contentEl || this.isCompleted) return;
        this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }

    _scrollChatToBottom() {
        const chatHistory = document.getElementById('chatHistory');
        if (chatHistory) {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    }
}

/**
 * ThinkingCardManager - Manages all thinking cards for a session
 */
export class ThinkingCardManager {
    constructor() {
        this.cards = new Map();
    }

    create(id, runId) {
        if (this.cards.has(id)) {
            return this.cards.get(id);
        }

        const card = new ThinkingCard(id, runId);
        card.create();
        this.cards.set(id, card);

        return card;
    }

    append(id, text) {
        const card = this.cards.get(id);
        if (card) {
            card.append(text);
        }
    }

    complete(id, finalText) {
        const card = this.cards.get(id);
        if (card) {
            card.complete(finalText);
        }
    }

    get(id) {
        return this.cards.get(id);
    }

    /**
     * Clear all cards - removes DOM elements and clears the map
     */
    clear() {
        this.cards.forEach((card) => {
            card.destroy();
        });
        this.cards.clear();
    }
}

// Singleton instance
export const thinkingCards = new ThinkingCardManager();
```

---

## GATE 1: New Module Created

After Phase 3:
1. Verify `thinking-card.js` file exists
2. No need to test yet - we'll wire it up in Phase 4

**Continue to Phase 4.**

---

## PHASE 4: WIRE EVERYTHING TOGETHER

### 4.1 Update `stream.js`

**stream.js is a small file (~87 lines). Read it fully to understand the structure.**

Current imports at top:
```javascript
import { ResponseReducer } from './reducer.bundle.js';
import { state } from './state.js';
import { updateStatus, addSystemMessage, removeThinkingPlaceholder, renderResponseItems } from './ui.js';
```

**Changes to make:**

1. Add import at top (after existing imports):
```javascript
import { thinkingCards } from './thinking-card.js';
```

2. Add this function BEFORE the `streamRun` function (at module level, around line 22):
```javascript
/**
 * Route thinking-related events to ThinkingCardManager
 */
function handleThinkingEvent(event, runId) {
    const payload = event.payload;
    if (!payload) return;

    // item_start for reasoning -> create card
    if (payload.type === 'item_start' && payload.item_type === 'reasoning') {
        thinkingCards.create(payload.item_id, runId);
        return;
    }

    // item_delta -> append content (if it's a thinking card)
    if (payload.type === 'item_delta') {
        const card = thinkingCards.get(payload.item_id);
        if (card) {
            thinkingCards.append(payload.item_id, payload.delta_content);
        }
        return;
    }

    // item_done for reasoning -> complete card
    if (payload.type === 'item_done' && payload.final_item?.type === 'reasoning') {
        thinkingCards.complete(payload.item_id, payload.final_item.content);
        return;
    }
}
```

3. In the `handleEvent` function inside `streamRun` (~line 33), add the call BEFORE the reducer:
```javascript
const handleEvent = (event) => {
    try {
        const parsed = JSON.parse(event.data);

        // Handle thinking events directly (before reducer)
        handleThinkingEvent(parsed, runId);

        const snapshot = reducer.apply(parsed);
        if (!snapshot) return;

        removeThinkingPlaceholder();
        renderResponseItems(snapshot.output_items || [], {
            runId,
            threadId: context.threadId,
            status: snapshot.status,
        });
        // ... rest of existing code unchanged
    } catch (error) {
        console.error('Failed to process stream event', error);
    }
};
```

**Note about `removeThinkingPlaceholder`:** This is a separate function that removes a temporary "thinking..." placeholder. It is NOT part of the old thinking card system and should be kept.

### 4.2 Update `ui.js` - Delete Functions and Add Import

**Delete these functions entirely from ui.js:**

| Function | Approximate Location |
|----------|---------------------|
| `ensureThinkingBlock` | ~line 389 |
| `createThinkingBlock` | ~line 410 |
| `toggleThinkingExpansion` | ~line 457 |
| `resolveThinkingId` | ~line 468 |
| `updateThinkingContent` | ~line 472 |
| `handleThinkingStarted` | ~line 479 |
| `handleThinkingDelta` | ~line 505 |
| `handleThinkingCompleted` | ~line 522 |
| `renderReasoningItem` | ~line 929 |

**Also remove any exports of these functions.** Search for `export` statements - these functions use `export function` syntax, so deleting the function deletes the export.

**In `renderResponseItems` (~line 820), find and delete the reasoning case:**
```javascript
// DELETE THIS CASE (around line 834-836):
case 'reasoning':
    renderReasoningItem(item);
    break;
```

**Add import at top of ui.js** (with other imports):
```javascript
import { thinkingCards } from './thinking-card.js';
```

**Update `resetToolCallState` (~line 84):**

Find these lines inside the `if (flushHistory)` block:
```javascript
state.thinkingBlocks.clear();
state.activeThinkingId = null;
```

Replace them with:
```javascript
thinkingCards.clear();
```

### 4.3 Verify No Stale References

Search ui.js for any remaining references to:
- `state.thinkingBlocks`
- `state.activeThinkingId`
- `renderReasoningItem`
- `handleThinking*`

There should be none after your deletions.

---

## GATE 2: Implementation Complete

After Phase 4:
1. Open browser, load the app at http://localhost:4010
2. Open console (F12) - verify no JavaScript errors
3. Run `bun run format` in cody-fastify directory
4. Run `bun run lint` in cody-fastify directory

**STOP. Verify app loads without errors and lint passes before testing.**

---

## PHASE 5: MANUAL TESTING

Test the thinking card by sending prompts to an Anthropic model with extended thinking enabled.

**Note:** The API must be called with `thinkingBudget` parameter to enable thinking. This should already be configured in your test environment.

### Test Cases

1. **Basic Display**
   - Send a prompt that triggers thinking
   - Verify thinking card appears with "Thinking..." shimmer
   - Verify content streams into the card

2. **Height Behavior**
   - During streaming: card shows up to 5 lines of content, then scrolls internally
   - After completion: card collapses to show ~2 lines
   - Click on completed card: expands to show up to 5 lines with scroll
   - Click again: collapses back to 2 lines

3. **Positioning**
   - Thinking card appears after user message
   - If tool calls exist, thinking card appears before them
   - Order should be: user message → thinking card → tool calls → agent response

4. **Completion**
   - Status changes from "Thinking..." to "Finished"
   - Footer with "Click to expand" becomes visible
   - Clicking toggles expand/collapse

---

## DEFINITION OF DONE

- [ ] State properties deleted from state.js (2 properties: `activeThinkingId`, `thinkingBlocks`)
- [ ] All old `.thinking-*` and `.reasoning-*` CSS deleted from styles.css
- [ ] New `.tc-*` CSS added to styles.css
- [ ] New `thinking-card.js` created with ThinkingCard class, ThinkingCardManager class, and singleton export
- [ ] `stream.js`: imports thinkingCards, has handleThinkingEvent function, calls it in handleEvent
- [ ] `ui.js`: 9 functions deleted, reasoning case removed from renderResponseItems
- [ ] `ui.js`: imports thinkingCards, uses `thinkingCards.clear()` in resetToolCallState
- [ ] No remaining references to deleted state properties or functions
- [ ] App loads without JavaScript console errors
- [ ] `bun run lint` passes
- [ ] `bun run format` produces no changes
- [ ] Manual testing confirms thinking cards display and function correctly

---

## OUTPUT FORMAT

```
## Summary
[What was accomplished]

## Deletions
- state.js: removed activeThinkingId, thinkingBlocks
- styles.css: removed ~[X] lines of .thinking-* and .reasoning-* CSS
- ui.js: removed 9 functions (list them), removed case 'reasoning' from renderResponseItems

## Additions
- thinking-card.js: created ([X] lines)
- styles.css: added [X] lines of .tc-* CSS
- stream.js: added import, handleThinkingEvent function (~25 lines), call in handleEvent
- ui.js: added import, replaced state clearing with thinkingCards.clear()

## Verification
- [ ] App loads without console errors
- [ ] lint: passed
- [ ] format: no changes needed

## Manual Testing
- [ ] Basic display works
- [ ] Height behavior correct
- [ ] Positioning correct
- [ ] Completion state works

## Issues Encountered
[Any issues and how they were resolved, or "None"]
```
