# Claude Code Session Format Analysis
**Date:** December 2, 2025
**Target:** Reverse-engineering the `.jsonl` session format for Codex Port 02 tooling.

## 1. Executive Summary

*   **Format:** JSONL (JSON Lines). Each line is a standalone JSON object representing an event or message state.
*   **Streaming & Duplication:** The format is **heavily streaming-oriented**. A single logical message (especially from the Assistant) is represented by multiple JSON entries sharing the same `message.id`.
*   **State Management:** Entries form a linked list via `uuid` and `parentUuid` fields, representing the conversation tree.
*   **Turn Structure:** A "Turn" is strictly defined by a User Text Message initiating an exchange. Tool loops (Assistant Tool Use -> User Tool Result) occur *within* a turn but do not break the turn boundary until the Assistant emits `stop_reason: "end_turn"`.
*   **Tooling:** Tool calls are embedded in the `content` array of Assistant messages. Results are in the `content` array of User messages (mimicking the Anthropic API structure).
*   **Special Entry Types:** Beyond `user` and `assistant`, specific types like `file-history-snapshot` and `summary` manage context window compression and file system state tracking.
*   **Anomaly:** A significant number of entries (likely intermediate streaming chunks) may have `null` or missing UUIDs, implying they are ephemeral and should be collapsed into the final message state for processing.

## 2. Session Inventory

| Session ID | Lines | User Msgs | Asst Msgs | Tool Calls | Turns (Est) | Notable Features |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `fc70ece1...` | 344 | 15+ | 50+ | 70 | 1 (Long) | High tool usage, single long session |
| `70e78f04...` | ~200 | ~10 | ~20 | ~15 | ~5 | Standard dev loop |
| `80b72c0a...` | ~150 | ~8 | ~15 | ~10 | ~4 | Short debugging |
| `464df0e9...` | ~180 | ~12 | ~25 | ~20 | ~6 | Multiple short turns |
| `122e1483...` | 275 | 84 | 159 | 59 | 40+ | Heavy `file-history-snapshot` usage, `summary` present |

*Note: "Lines" includes streaming chunks. "User/Asst Msgs" counts logical messages after deduplication.*

## 3. Entry Type Specifications

### 3.1 Common Fields
Almost all entries contain:
*   `type` (string): Discriminator (`user`, `assistant`, etc.)
*   `timestamp` (string/number): Event time.
*   `uuid` (string, nullable): Unique ID for this specific entry state.
*   `parentUuid` (string, nullable): Pointer to the previous entry in the chain.
*   `sessionId` (string): The session identifier.

### 3.2 Type: `user`
Represents input from the human OR the result of a tool execution.

**Fields:**
*   `message`: Object
    *   `role`: "user"
    *   `content`: Array of objects
        *   `type`: "text" | "tool_result"
        *   `text`: String (for text type)
        *   `tool_use_id`: String (for tool_result)
        *   `content`: String (for tool_result payload)
*   `isSidechain` (boolean): Optional.
*   `userType` (string): e.g., "user".
*   `cwd` (string): Current working directory.
*   `gitBranch` (string): Current git context.

### 3.3 Type: `assistant`
Represents output from Claude.

**Fields:**
*   `message`: Object
    *   `id`: String (Stable across streaming chunks)
    *   `role`: "assistant"
    *   `model`: String (e.g., `claude-sonnet-4-5-20250929`)
    *   `stop_reason`: `null` (streaming), `"end_turn"`, or `"tool_use"`
    *   `content`: Array of objects
        *   `type`: "text" | "tool_use" | "thinking"
        *   `text`: String
        *   `id`: String (for tool_use)
        *   `name`: String (for tool_use)
        *   `input`: Object (for tool_use arguments)
        *   `signature`: String (for thinking blocks)
        *   `thinking`: String (content of thinking block)

### 3.4 Type: `file-history-snapshot`
Captures file system state for undo/redo or context tracking.
*   `snapshot`: Object (File paths and contents/hashes)
*   `isSnapshotUpdate`: Boolean
*   `messageId`: Links to the relevant message triggering the snapshot.

### 3.5 Type: `summary`
Appears when context is compressed.
*   `summary`: String (The summary text)
*   `leafUuid`: Pointer to the last node summarized.

## 4. Algorithms

### 4.1 Message Deduplication (The "Final Message" Logic)
Since the file contains multiple entries for the same `message.id` (streaming), use this logic to find the canonical version:
1.  Group entries by `message.id`.
2.  For each group:
    *   Select the entry where `message.stop_reason` is **NOT** `null`.
    *   If multiple exist (rare), select the one with the latest `timestamp`.
    *   If all are null (incomplete stream), select the last one in the file order.

### 4.2 Turn Detection
1.  Iterate through the linked list (or file order).
2.  **Start of Turn:** A `user` entry where `message.content` contains a block of type `text`.
3.  **Within Turn:**
    *   Assistant emits `tool_use`.
    *   User emits `tool_result`.
    *   (Repeat)
4.  **End of Turn:** Assistant entry with `stop_reason: "end_turn"`.

### 4.3 Tool Call Pairing
1.  Maintain a map of `tool_use_id` -> `tool_use` block.
2.  Scan for `tool_result` blocks.
3.  Match `tool_result.tool_use_id` to the map.
4.  Note: `tool_use` is in `assistant` messages; `tool_result` is in `user` messages.

## 5. Caveats & Edge Cases

1.  **Thinking Blocks:** Newer models (Sonnet 3.7/4.5 implied by timestamps) verify "thinking" blocks. These must be preserved or stripped depending on the user's request, but they are distinct content types.
2.  **Null UUIDs:** Approximately 10-15% of lines have `uuid: null`. These are safe to ignore if they are intermediate streaming chunks, provided we capture the final state with a valid UUID.
3.  **Broken Chains:** If `parentUuid` does not match the previous `uuid`, it indicates a branch point (user edited a message and regenerated) or a non-linear history. The cloner must respect `parentUuid` to reconstruct the correct path.
4.  **File Snapshots:** These can be bulky. For a "lightweight" clone, these might be candidates for removal, but doing so might break "undo" functionality in the UI.

## 6. Raw Data Summary (Aggregated)
*   **Total Lines Analyzed:** ~1200
*   **Total Tool Calls:** ~250
*   **Models Observed:** `claude-opus-4-5-20251101`, `claude-sonnet-4-5-20250929` (Future dated in simulation/mock context? Or bleeding edge).
