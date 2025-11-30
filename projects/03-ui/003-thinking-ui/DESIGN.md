# Thinking Card UI Design (Clean-Slate)

## Overview

This is a **clean-slate redesign** of the thinking card UI. We are deleting all existing thinking/reasoning code and building a single, clean system from scratch.

**Goals:**
1. Single code path for all thinking content
2. Correct positioning from creation (no post-hoc moving)
3. Progressive height behavior (2-lines -> 5-lines -> scroll)
4. Minimal state footprint

---

## Section 1: What Gets Deleted

### 1.1 JavaScript Functions to Delete

**File:** `/cody-fastify/public/js/ui.js`

Remove these functions entirely:

| Function | Approximate Lines | Purpose (being replaced) |
|----------|-------------------|--------------------------|
| `renderReasoningItem` | ~30 lines | History rendering of reasoning |
| `createThinkingBlock` | ~50 lines | Creates thinking DOM element |
| `ensureThinkingBlock` | ~15 lines | Get-or-create pattern |
| `handleThinkingStarted` | ~25 lines | Stream event handler |
| `handleThinkingDelta` | ~15 lines | Stream event handler |
| `handleThinkingCompleted` | ~30 lines | Stream event handler |
| `toggleThinkingExpansion` | ~10 lines | Click handler |
| `updateThinkingContent` | ~10 lines | Content update helper |
| `resolveThinkingId` | ~10 lines | ID resolution helper |

Also remove any exports of these functions.

### 1.2 CSS Classes to Delete

**File:** `/cody-fastify/public/css/styles.css`

Remove all CSS rules targeting these class patterns:

```css
/* DELETE ALL OF THESE */
.thinking-*          /* All thinking-prefixed classes */
.reasoning-*         /* All reasoning-prefixed classes */
```

Specific rules to find and delete:
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
- Any `.thinking-*` or `.reasoning-*` variants (`.streaming`, `.completed`, `.expanded`, `.initializing`)

### 1.3 State Properties to Delete

**File:** `/cody-fastify/public/js/state.js`

Remove from state object:
```javascript
thinkingBlocks: new Map(),   // DELETE
activeThinkingId: null,      // DELETE
```

### 1.4 Event Wiring to Delete

**File:** `/cody-fastify/public/js/stream.js`

Remove:
- Imports of thinking handlers from ui.js
- `dispatchThinkingEvent` function
- Any calls to thinking handlers in the event processing

---

## Section 2: New Implementation

### 2.1 Design Principles

1. **Single system** - One `ThinkingCard` class handles everything
2. **Create-in-place** - Card is inserted at correct position on creation, never moved
3. **Self-contained** - Card manages its own DOM, state, and behavior
4. **Event-driven** - Stream events directly update the card through simple methods

### 2.2 Architecture

```
Stream Events (SSE)
       |
       v
ThinkingCardManager.handleEvent(event)
       |
       +-- item_start (reasoning) --> manager.create(id, runId)
       |
       +-- item_delta --> manager.append(id, text)
       |
       +-- item_done (reasoning) --> manager.complete(id)
```

### 2.3 Visual States

```
STATE: streaming
+------------------------------------------+
|  [icon] Thinking         Thinking...     |
|  Content line 1...                       |
|  Content line 2...                       |
|  [grows up to 5 lines, then scrolls]     |
+------------------------------------------+

STATE: completed (collapsed - default)
+------------------------------------------+
|  [icon] Thinking              Finished   |
|  First 2 lines of content...             |
|                          [v] Click to... |
+------------------------------------------+

STATE: completed (expanded)
+------------------------------------------+
|  [icon] Thinking              Finished   |
|  All content visible...                  |
|  Up to 5 lines with scroll if needed     |
|                          [^] Click to... |
+------------------------------------------+
```

### 2.4 Height Behavior

| Phase | Trigger | max-height | overflow |
|-------|---------|------------|----------|
| Initial | Card created | 2.8em (2 lines) | hidden |
| Growing | Content added | grows to 7em | hidden |
| Scrolling | Content > 5 lines | 7em (fixed) | scroll |
| Completed | item_done | 2.8em (collapsed) | hidden |
| Expanded | User click | 7em | scroll |

Line height calculation:
- Base: 14px font, 1.35 line-height = ~19px per line
- 2 lines: ~38px = 2.8em
- 5 lines: ~95px = 7em

---

## Section 3: New Files/Functions

### 3.1 File Structure

```
/cody-fastify/public/js/
  thinking-card.js     # NEW - ThinkingCard class and manager

/cody-fastify/public/css/
  thinking-card.css    # NEW - Dedicated stylesheet (optional, can inline in styles.css)
```

### 3.2 ThinkingCard Class

**File:** `/cody-fastify/public/js/thinking-card.js`

```javascript
/**
 * ThinkingCard - A single thinking/reasoning display card
 *
 * Lifecycle:
 *   1. create() - Insert card at correct position
 *   2. append() - Stream content into card (0-N times)
 *   3. complete() - Finalize and collapse
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

    /**
     * Create and insert the card DOM at the correct position
     */
    create() {
        const chatHistory = document.getElementById('chatHistory');
        if (!chatHistory) return null;

        this.element = this._buildDOM();
        this._insertAtPosition(chatHistory);
        this._bindEvents();

        return this;
    }

    /**
     * Append streaming content
     */
    append(text) {
        if (!text || this.isCompleted) return;

        this.content += text;
        if (this.contentEl) {
            this.contentEl.textContent = this.content;
            this._autoScroll();
        }
    }

    /**
     * Mark as complete and collapse
     */
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

    /**
     * Toggle expand/collapse (only when completed)
     */
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

    // --- Private Methods ---

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
        const userMessages = chatHistory.querySelectorAll('.flex.justify-end');
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
        card?.addEventListener('click', (e) => {
            // Ignore if text is selected
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;

            this.toggle();
        });
    }

    _autoScroll() {
        if (!this.contentEl || this.isCompleted) return;

        // During streaming, keep scrolled to bottom
        this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }
}
```

### 3.3 ThinkingCardManager

```javascript
/**
 * ThinkingCardManager - Manages all thinking cards for a session
 */
export class ThinkingCardManager {
    constructor() {
        this.cards = new Map();  // id -> ThinkingCard
    }

    /**
     * Create a new thinking card
     */
    create(id, runId) {
        // Reuse existing if present
        if (this.cards.has(id)) {
            return this.cards.get(id);
        }

        const card = new ThinkingCard(id, runId);
        card.create();
        this.cards.set(id, card);

        this._scrollToBottom();
        return card;
    }

    /**
     * Append content to a card
     */
    append(id, text) {
        const card = this.cards.get(id);
        if (card) {
            card.append(text);
        }
    }

    /**
     * Complete a card
     */
    complete(id, finalText) {
        const card = this.cards.get(id);
        if (card) {
            card.complete(finalText);
        }
    }

    /**
     * Get a card by ID
     */
    get(id) {
        return this.cards.get(id);
    }

    /**
     * Clear all cards (for new session)
     */
    clear() {
        this.cards.clear();
    }

    _scrollToBottom() {
        const chatHistory = document.getElementById('chatHistory');
        if (chatHistory) {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    }
}

// Singleton instance
export const thinkingCards = new ThinkingCardManager();
```

### 3.4 CSS Styles

**Add to:** `/cody-fastify/public/css/styles.css` (or new file `thinking-card.css`)

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

/* Streaming: grows up to 5 lines, then scrolls */
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

## Section 4: Event Wiring

### 4.1 Stream Integration

**File:** `/cody-fastify/public/js/stream.js`

Add import at top:
```javascript
import { thinkingCards } from './thinking-card.js';
```

Add event dispatch in the stream handler:

```javascript
const handleEvent = (event) => {
    try {
        const parsed = JSON.parse(event.data);

        // Handle thinking events directly (before reducer)
        handleThinkingEvent(parsed, runId);

        // Continue with existing reducer logic...
        const snapshot = reducer.apply(parsed);
        // ... rest of existing code

    } catch (error) {
        console.error('Failed to process stream event', error);
    }
};

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

### 4.2 Event Flow Diagram

```
Browser EventSource
        |
        | SSE message received
        v
+-------------------+
| handleEvent()     |
+-------------------+
        |
        | JSON.parse(event.data)
        v
+------------------------+
| handleThinkingEvent()  |  <-- NEW: Direct event routing
+------------------------+
        |
        +-- item_start (reasoning)
        |       |
        |       v
        |   thinkingCards.create(id, runId)
        |       |
        |       v
        |   ThinkingCard._insertAtPosition()
        |       |
        |       +-- Before tool-timeline (if exists)
        |       +-- After user message (if no tools yet)
        |       +-- Append to chat (fallback)
        |
        +-- item_delta
        |       |
        |       v
        |   thinkingCards.append(id, text)
        |       |
        |       v
        |   contentEl.textContent = accumulated
        |
        +-- item_done (reasoning)
                |
                v
            thinkingCards.complete(id)
                |
                v
            Card transitions: streaming -> completed
```

### 4.3 Rendering Exclusion

Update `renderResponseItems` to skip reasoning items (they're handled by ThinkingCard):

```javascript
function renderResponseItems(items, context) {
    for (const item of items) {
        // Skip reasoning - handled by ThinkingCardManager
        if (item.type === 'reasoning') continue;

        // ... render other item types
    }
}
```

---

## Section 5: Testing Checklist

### 5.1 Basic Functionality

- [ ] Thinking card appears when reasoning stream starts
- [ ] Content streams into card in real-time
- [ ] Status shows "Thinking..." with shimmer during streaming
- [ ] Status changes to "Finished" when complete
- [ ] Card starts collapsed after completion
- [ ] Click expands completed card
- [ ] Click again collapses card
- [ ] Chevron rotates on expand/collapse

### 5.2 Progressive Height

- [ ] Initial content shows up to 2 lines
- [ ] Card grows as content is added (up to 5 lines)
- [ ] Scrollbar appears when content exceeds 5 lines
- [ ] During streaming, content auto-scrolls to bottom
- [ ] Completed card collapses to 2 lines
- [ ] Expanded card shows up to 5 lines with scroll

### 5.3 Positioning

- [ ] Card appears immediately after user message
- [ ] Card appears before tool calls
- [ ] Tool calls that arrive after thinking don't displace the card
- [ ] Multiple runs each get their own correctly-positioned card

### 5.4 Edge Cases

- [ ] Empty thinking content (card shows, no content)
- [ ] Very short content (< 2 lines) displays correctly
- [ ] Very long content scrolls correctly
- [ ] Rapid delta events don't cause flicker
- [ ] Multiple thinking blocks in one response handled

---

## Section 6: Implementation Order

1. **Delete old code** - Remove all functions, CSS, and state listed in Section 1
2. **Add CSS** - Add the `.tc-*` styles to styles.css
3. **Create thinking-card.js** - New file with ThinkingCard class and manager
4. **Wire to stream.js** - Import manager, add handleThinkingEvent
5. **Update renderResponseItems** - Skip reasoning items
6. **Test** - Run through checklist

---

## Appendix: Quick Reference

### Classes Used
- `.tc-wrapper` - Outer positioning container
- `.tc-card` - Main card element
- `.tc-streaming` - State: actively receiving content
- `.tc-completed` - State: done, collapsed by default
- `.tc-expanded` - Modifier: expanded view (with completed)
- `.tc-header` - Header row
- `.tc-title` - Icon + label container
- `.tc-icon` - Lightbulb SVG
- `.tc-label` - "Thinking" text
- `.tc-status` - "Thinking..." / "Finished"
- `.tc-shimmer` - Animated gradient text
- `.tc-content` - Monospace content area
- `.tc-footer` - Expand hint row
- `.tc-hint` - "Click to expand" text
- `.tc-chevron` - Arrow icon

### Data Attributes
- `data-thinking-id` - Unique ID for the thinking item
- `data-run-id` - Run ID for positioning context

### Manager API
```javascript
thinkingCards.create(id, runId)  // Create and insert card
thinkingCards.append(id, text)   // Append content
thinkingCards.complete(id, text) // Finalize card
thinkingCards.get(id)            // Get card instance
thinkingCards.clear()            // Reset all cards
```
