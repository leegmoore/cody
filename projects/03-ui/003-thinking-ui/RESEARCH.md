# Thinking Card UI Research

## 1. Current Architecture

### 1.1 File Structure

The UI is built with vanilla JavaScript/HTML/CSS with the following key files:

| File | Purpose |
|------|---------|
| `/cody-fastify/public/js/ui.js` | Main UI rendering functions (1055 lines) |
| `/cody-fastify/public/js/state.js` | Centralized state management (66 lines) |
| `/cody-fastify/public/js/stream.js` | SSE event stream handling (87 lines) |
| `/cody-fastify/public/css/styles.css` | Custom styles including thinking card (339 lines) |
| `/cody-fastify/public/index.html` | Main HTML structure |

### 1.2 State Management (`state.js`)

The state object contains thinking-related properties:

```javascript
export const state = {
    // ... other state
    activeThinkingId: null,        // Currently streaming thinking block ID
    thinkingBlocks: new Map(),     // Map<thinkingId, ThinkingBlockState>
    // ...
};
```

The `thinkingBlocks` Map stores objects with this shape (defined inline in `ui.js`):
```javascript
{
    wrapper: HTMLElement,    // Outer flex container
    card: HTMLElement,       // The .thinking-card element
    content: HTMLElement,    // The .thinking-content element
    status: HTMLElement,     // The status text span
    chevron: HTMLElement,    // Expand/collapse chevron
    text: string             // Accumulated thinking text
}
```

### 1.3 Chat History Container

The chat history is a simple container:
```html
<div id="chatHistory" class="flex-1 overflow-y-auto px-6 py-4 space-y-6">
    <!-- Messages, tool calls, thinking cards appended here -->
</div>
```

All items (user messages, agent messages, tool call stacks, thinking cards) are simply appended to this container in the order they arrive.

---

## 2. Event Flow

### 2.1 Schema Events (`schema.ts`)

The canonical event types that relate to thinking/reasoning:

```typescript
// StreamEventPayloadSchema includes:
z.object({
    type: z.literal("item_start"),
    item_id: z.string(),
    item_type: z.enum([
        "message",
        "reasoning",  // <-- Thinking blocks
        "function_call",
        "function_call_output",
        // ...
    ]),
    initial_content: z.string().optional(),
    // ...
}),
z.object({
    type: z.literal("item_delta"),
    item_id: z.string(),
    delta_content: z.string(),
}),
z.object({
    type: z.literal("item_done"),
    item_id: z.string(),
    final_item: OutputItemSchema,
}),
```

The `ReasoningItemSchema` defines the final item shape:
```typescript
export const ReasoningItemSchema = z.object({
    id: z.string(),
    type: z.literal("reasoning"),
    content: z.string(),
    origin: z.enum(["agent", "system"]).default("agent"),
    correlation_id: z.string().optional(),
});
```

### 2.2 Anthropic Adapter (`anthropic-adapter.ts`)

The adapter handles Anthropic's `thinking` content blocks:

1. **content_block_start** with `type: "thinking"`:
   - Creates an `ItemAccumulator` with `type: "reasoning"`
   - Publishes `item_start` event with `item_type: "reasoning"`

2. **content_block_delta** with `delta.thinking`:
   - Extracts text from `delta.thinking`
   - Publishes `item_delta` events with the thinking content chunks

3. **content_block_stop**:
   - Publishes `item_done` with the final `ReasoningItem`

Relevant code (lines 459-461):
```typescript
} else if (blockInfo.type === "thinking") {
    const accumulator = ensureItem(items, itemId, "reasoning");
    await this.publishItemStartIfNeeded(trace, runId, accumulator);
}
```

### 2.3 Reducer (`reducer.ts`)

The `ResponseReducer` class processes stream events:

- **item_start** with `item_type: "reasoning"`:
  - Creates an `ItemBuffer` with `type: "reasoning"`
  - Calls `refreshBufferedItem()` which upserts a reasoning item to `output_items`

- **item_delta**:
  - Appends `delta_content` to the buffer's `chunks` array
  - Calls `refreshBufferedItem()` to update the item in `output_items`

- **item_done**:
  - Replaces the buffered item with the final item from the event

The reducer's `refreshBufferedItem` method (lines 275-285):
```typescript
if (buffer.type === "reasoning") {
    const origin = (buffer.meta.origin as "agent" | "system" | undefined) ?? "agent";
    this.upsertOutputItem({
        id: buffer.id,
        type: "reasoning",
        content: buffer.chunks.join(""),
        origin,
        correlation_id: buffer.meta.correlation_id as string | undefined,
    });
}
```

### 2.4 Stream Handler (`stream.js`)

The stream handler uses `ResponseReducer` and calls `renderResponseItems`:

```javascript
const handleEvent = (event) => {
    const parsed = JSON.parse(event.data);
    const snapshot = reducer.apply(parsed);
    if (!snapshot) return;

    removeThinkingPlaceholder();
    renderResponseItems(snapshot.output_items || [], {
        runId,
        threadId: context.threadId,
        status: snapshot.status,
    });
    // ...
};
```

### 2.5 UI Rendering (`ui.js`)

The `renderResponseItems` function dispatches to type-specific renderers:

```javascript
export function renderResponseItems(items = [], context = {}) {
    items.forEach((item) => {
        switch (item.type) {
            case 'reasoning':
                renderReasoningItem(item);
                break;
            // ...
        }
    });
}
```

**However**, there's a parallel path for streaming thinking that doesn't go through `renderResponseItems`:

The exported thinking handlers (`handleThinkingStarted`, `handleThinkingDelta`, `handleThinkingCompleted`) are defined but **not currently called from `stream.js`**. The stream handler only calls `renderResponseItems`.

The `renderReasoningItem` function (lines 929-958) creates a different UI element than `createThinkingBlock`:
- Uses class `.reasoning-message` instead of `.thinking-message`
- Different HTML structure (no expand/collapse, no status indicator)
- Stored in `state.thinkingBlocks` by item ID but as a DOM element, not the block object

---

## 3. Current Thinking Card Implementation

### 3.1 HTML Structure (`createThinkingBlock` in ui.js, lines 410-455)

```html
<div class="flex justify-start thinking-message animate-fade-in" data-thinking-id="...">
    <div class="thinking-card" data-thinking-id="..." role="status" aria-live="polite">
        <div class="thinking-card-header">
            <div class="thinking-card-title">
                <svg><!-- lightbulb icon --></svg>
                <span class="text-xs font-semibold tracking-wide uppercase text-brown-700">Thinking</span>
            </div>
            <span class="thinking-status text-xs font-semibold text-shimmer">Streaming</span>
        </div>
        <div class="thinking-content text-sm text-brown-900 font-mono whitespace-pre-wrap" data-expanded="false">
            <!-- Thinking text content -->
        </div>
        <div class="thinking-card-footer">
            <span class="thinking-hint text-[11px] font-semibold text-brown-600">Click to expand</span>
            <svg class="thinking-chevron"><!-- down arrow --></svg>
        </div>
    </div>
</div>
```

### 3.2 CSS Styles (`styles.css`, lines 255-338)

```css
.thinking-message {
    width: 100%;
}

.thinking-card {
    width: min(32rem, 100%);
    background: linear-gradient(140deg, #fff9f4 0%, #fde7d6 100%);
    border: 1px solid rgba(234, 173, 137, 0.6);
    border-left: 4px solid #ea580c;
    border-radius: 18px;
    padding: 0.85rem 1rem 0.75rem;
    box-shadow: 0 10px 24px rgba(74, 39, 23, 0.13);
    cursor: pointer;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.thinking-content {
    margin-top: 0.5rem;
    line-height: 1.35;
    max-height: 3.2em;           /* ~2 lines collapsed */
    overflow: hidden;
    transition: max-height 0.25s ease;
}

.thinking-content[data-expanded="true"] {
    max-height: 8.2em;           /* ~5 lines expanded */
    overflow-y: auto;
}

.thinking-card.completed {
    border-left-color: #4ade80;  /* Green left border when done */
}
```

Key observations:
- Collapsed state: `max-height: 3.2em` (approximately 2 lines)
- Expanded state: `max-height: 8.2em` (approximately 5 lines)
- Expansion is toggled by clicking the card
- Status changes from "Streaming" (with shimmer animation) to "Finished"

### 3.3 JavaScript Handlers (`ui.js`)

**ensureThinkingBlock** (lines 389-408):
- Returns existing block from `state.thinkingBlocks` if present and in DOM
- Otherwise creates new block via `createThinkingBlock`

**createThinkingBlock** (lines 410-455):
- Creates DOM structure
- Attaches click handler for expand/collapse
- **Appends to `chatHistory`** (line 451) - always at the end
- Returns block state object

**handleThinkingStarted** (lines 479-503):
- Generates thinking ID if not provided
- Sets `state.activeThinkingId`
- Ensures block exists, resets content and styling

**handleThinkingDelta** (lines 505-520):
- Resolves thinking ID (uses `state.activeThinkingId` as fallback)
- Appends delta to accumulated text
- Updates content element

**handleThinkingCompleted** (lines 522-544):
- Updates final text
- Changes card styling (removes `active`, adds `completed`)
- Updates status text to "Finished"
- Clears `state.activeThinkingId`

**toggleThinkingExpansion** (lines 457-466):
- Toggles `data-expanded` attribute
- Toggles `.expanded` class on card
- Rotates chevron icon

---

## 4. Current Issues

### 4.1 Positioning Problem

**The thinking card is appended at the end of chat history regardless of when it starts streaming.**

Current flow:
1. User sends message -> user message appended
2. Stream starts -> tool calls may arrive first
3. Tool call stack created and appended
4. Thinking content arrives -> thinking card appended AFTER tool calls
5. Agent message arrives -> appended after thinking card

Expected order:
```
[User Prompt]
[Thinking Card]    <- Should be here
[Tool Calls]
[Agent Response]
```

Actual order when tool calls stream before thinking:
```
[User Prompt]
[Tool Calls]
[Thinking Card]    <- Currently appears here
[Agent Response]
```

### 4.2 Dual Rendering Paths

There are two different renderers for thinking/reasoning:

1. **`renderReasoningItem`** - Called by `renderResponseItems` from stream handler
   - Creates `.reasoning-message` elements
   - Different visual style (border-left block quote)
   - No expand/collapse functionality

2. **`createThinkingBlock`** / `handleThinkingStarted`/`Delta`/`Completed`
   - Creates `.thinking-message` elements with `.thinking-card`
   - Has expand/collapse, status indicator
   - **Not currently wired to stream events**

The thinking handlers are exported but the stream handler doesn't call them directly - it uses `renderResponseItems` which calls `renderReasoningItem`.

### 4.3 Height Transition Missing Growth Phases

Current behavior:
- Collapsed: 3.2em (fixed)
- Expanded: 8.2em (fixed)

Desired behavior:
- Phase 1: Start at ~2 lines, content visible
- Phase 2: Grow with content up to 5 lines
- Phase 3: Stay at 5 lines, scroll internally

The current implementation has a binary toggle, not a progressive height expansion.

### 4.4 No Per-Turn Scoping

The current implementation uses a single `state.activeThinkingId` which could cause issues with multi-turn scenarios or rapid successive messages. There's no explicit association between a thinking block and its corresponding user prompt.

### 4.5 Tool Call Stack vs Thinking Card Order

Tool calls use a timeline system (`ensureToolTimeline`) that groups calls by `runId`:
```javascript
export function ensureToolTimeline(runId) {
    // Creates wrapper with .tool-call-stack-wrapper
    // Appends to chatHistory
}
```

This is also append-only. When the thinking card and tool calls arrive in different orders, there's no mechanism to reorder them.

---

## 5. Summary of Key Findings

1. **Thinking events** flow as: Anthropic SSE -> `anthropic-adapter.ts` -> Redis -> `stream.js` -> `ResponseReducer` -> `renderResponseItems` -> `renderReasoningItem`

2. **The dedicated thinking handlers** (`handleThinkingStarted`, etc.) exist but are **not connected** to the main stream flow

3. **Positioning is append-only** - no logic exists to insert thinking cards at specific positions

4. **Two different renderers** produce different UI for the same data type

5. **Height handling is binary** (collapsed/expanded) not progressive

6. **Tool calls and thinking cards** are both appended to chat history with no ordering logic
