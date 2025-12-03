# Claude Code Session File Format Specification

**Analysis Date:** 2025-12-02
**Analyzed Sessions:** 5
**Claude Code Versions Observed:** 2.0.36, 2.0.37, 2.0.50, 2.0.53, 2.0.54

---

## Executive Summary

1. **JSONL format**: Each line is a self-contained JSON object representing an entry
2. **Entry types**: `user`, `assistant`, `summary`, `file-history-snapshot`, `queue-operation`, `system` (6 types observed)
3. **UUID chain**: `user` and `assistant` entries form a linked list via `uuid`/`parentUuid`; other types have null UUIDs
4. **Streaming pattern**: Multiple entries can share the same `message.id`; each entry represents a NEW content block (append model, not snapshot)
5. **Version differences**: Older versions (2.0.36-37) include `stop_reason` on all streaming entries; newer versions (2.0.50+) use `null` until final
6. **Tool pairing**: Perfect 1:1 correspondence between `tool_use` blocks and `tool_result` blocks across all sessions
7. **Turn detection**: Human turns have `message.content` as string or `[{type: "text", ...}]`; tool results have `[{type: "tool_result", ...}]`
8. **Summary entries**: Located at file start, reference conversation via `leafUuid` pointing to a message entry
9. **Compaction**: `system` type with `subtype: "compact_boundary"` marks manual compaction; followed by summary injection
10. **Session metadata**: Entries contain `sessionId`, `version`, `cwd`, `gitBranch`, `timestamp`

---

## 1. Session Inventory

| Session ID | Lines | Version(s) | User | Assistant | Summary | FileHistory | QueueOp | System | Human Turns | Tool Calls |
|------------|-------|------------|------|-----------|---------|-------------|---------|--------|-------------|------------|
| 4114a883-cd70-4f57-bbc9-aa3a376f00bc | 604 | 2.0.50 | 225 | 303 | 22 | 38 | 16 | 0 | 42 | 183 |
| cad6d512-e91e-43b2-9cc9-cc462722dcaa | 590 | 2.0.36-37 | 237 | 302 | 1 | 43 | 6 | 1 | 58 | 179 |
| d64be32b-0d12-4ce5-9c03-25a1b0903ddb | 576 | 2.0.53-54 | 178 | 346 | 1 | 51 | 0 | 0 | 54 | 124 |
| 2832d203-281a-400a-9f5e-7b44765d3bbe | 552 | 2.0.54 | 183 | 327 | 1 | 39 | 2 | 0 | 35 | 148 |
| 398e5a9a-6775-4265-b830-e3153bf4ed80 | 528 | 2.0.36 | 99 | 211 | 195 | 23 | 0 | 0 | 19 | 80 |

**Notable characteristics:**
- Session 5 (398e5a9a) has 195 summary entries at file start - appears to be a resumed/continued session
- Session 2 (cad6d512) contains the only `system` entry (compact_boundary type)
- Sessions 3 and 4 use newer versions with `thinking` content blocks
- Session 1 has only 1 thinking block; sessions 3-5 have extensive thinking

---

## 2. Entry Type Specifications

### 2.1 `user` Entry Type

**Purpose:** Represents user input (human messages or tool results)

**Required fields:**
- `type`: `"user"`
- `uuid`: string (UUID v4)
- `parentUuid`: string | null (null for first entry)
- `message`: object with `role` and `content`
- `sessionId`: string (session UUID)
- `timestamp`: ISO 8601 string
- `cwd`: string (working directory)
- `version`: string (Claude Code version)
- `isSidechain`: boolean (always false in observed data)
- `userType`: `"external"` (only value observed)
- `gitBranch`: string

**Optional fields:**
- `toolUseResult`: object | string (present when entry contains tool_result)
- `thinkingMetadata`: object with `{level, disabled, triggers}`
- `todos`: array (always empty in observed data)
- `isMeta`: boolean (true for system-injected messages)
- `slug`: string (human-readable session identifier)
- `isCompactSummary`: boolean (true for compaction summary injection)
- `isVisibleInTranscriptOnly`: boolean (display hint)
- `logicalParentUuid`: string (used after compaction)

**Sample - Human message:**
```json
{
  "parentUuid": null,
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/leemoore/code/codex-port-02",
  "sessionId": "4114a883-cd70-4f57-bbc9-aa3a376f00bc",
  "version": "2.0.50",
  "gitBranch": "main",
  "type": "user",
  "message": {
    "role": "user",
    "content": "Hello, can you help me with something?"
  },
  "uuid": "0b4771c4-f192-4d1b-a7fb-487f91488819",
  "timestamp": "2025-11-22T17:38:25.669Z",
  "thinkingMetadata": {
    "level": "none",
    "disabled": true,
    "triggers": []
  },
  "todos": []
}
```

**Sample - Tool result:**
```json
{
  "parentUuid": "beddf463-2c5d-4983-b42d-294e1ce380a2",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/leemoore/code/codex-port-02",
  "sessionId": "4114a883-cd70-4f57-bbc9-aa3a376f00bc",
  "version": "2.0.50",
  "gitBranch": "main",
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_0124jX5QYLGcGnPjoUvtDCT5",
        "content": "<tool_use_error>File too large</tool_use_error>",
        "is_error": true
      }
    ]
  },
  "uuid": "529319c3-a4df-430a-8d4b-70923c3423eb",
  "timestamp": "2025-11-22T17:38:29.536Z",
  "toolUseResult": "Error: File too large"
}
```

### 2.2 `assistant` Entry Type

**Purpose:** Represents Claude's response (streaming chunks)

**Required fields:**
- `type`: `"assistant"`
- `uuid`: string (UUID v4)
- `parentUuid`: string (links to previous entry)
- `message`: object (Anthropic API message format)
- `sessionId`: string
- `timestamp`: ISO 8601 string
- `cwd`: string
- `version`: string
- `isSidechain`: boolean
- `userType`: `"external"`
- `gitBranch`: string
- `requestId`: string (format: `req_...`)

**message object structure:**
```typescript
{
  model: string;           // e.g., "claude-sonnet-4-5-20250929"
  id: string;              // e.g., "msg_018Lcby59CwH17NL3GnX5XZq"
  type: "message";
  role: "assistant";
  content: ContentBlock[]; // Array with exactly ONE block per entry
  stop_reason: "end_turn" | "tool_use" | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    cache_creation: {
      ephemeral_5m_input_tokens: number;
      ephemeral_1h_input_tokens: number;
    };
    output_tokens: number;
    service_tier: string;
  }
}
```

**Sample:**
```json
{
  "parentUuid": "0b4771c4-f192-4d1b-a7fb-487f91488819",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/leemoore/code/codex-port-02",
  "sessionId": "4114a883-cd70-4f57-bbc9-aa3a376f00bc",
  "version": "2.0.50",
  "gitBranch": "main",
  "message": {
    "model": "claude-sonnet-4-5-20250929",
    "id": "msg_018Lcby59CwH17NL3GnX5XZq",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll help you with that."
      }
    ],
    "stop_reason": null,
    "stop_sequence": null,
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 16467,
      "cache_read_input_tokens": 12543,
      "cache_creation": {
        "ephemeral_5m_input_tokens": 16467,
        "ephemeral_1h_input_tokens": 0
      },
      "output_tokens": 1,
      "service_tier": "standard"
    }
  },
  "requestId": "req_011CVPLQp6YfHPTYfFZSZe1f",
  "type": "assistant",
  "uuid": "cbc4ba6d-f587-42e0-96a6-0dd4a2c408f4",
  "timestamp": "2025-11-22T17:38:28.988Z"
}
```

### 2.3 `summary` Entry Type

**Purpose:** Stores conversation summaries for session listing and context recovery

**Fields:**
- `type`: `"summary"`
- `summary`: string (short summary text)
- `leafUuid`: string (UUID of the message this summary represents)
- `uuid`: null (always)
- `parentUuid`: null (always)

**Sample:**
```json
{
  "type": "summary",
  "summary": "Codex TypeScript Port Project Setup",
  "leafUuid": "ec618c1c-f091-43ad-af60-afb6fe42607f"
}
```

**Location:** Summaries appear at the START of the file, before the conversation entries.

### 2.4 `file-history-snapshot` Entry Type

**Purpose:** Tracks file states for undo/redo functionality

**Fields:**
- `type`: `"file-history-snapshot"`
- `messageId`: string (UUID of associated user message)
- `snapshot`: object containing:
  - `messageId`: string
  - `trackedFileBackups`: object (filename -> backup info)
  - `timestamp`: ISO 8601 string
- `isSnapshotUpdate`: boolean
- `uuid`: null (always)
- `parentUuid`: null (always)

**Sample:**
```json
{
  "type": "file-history-snapshot",
  "messageId": "bfb7016f-83a4-4513-80b0-f4f634ee28a9",
  "snapshot": {
    "messageId": "0b4771c4-f192-4d1b-a7fb-487f91488819",
    "trackedFileBackups": {
      "remove-tool-calls.js": {
        "backupFileName": null,
        "version": 1,
        "backupTime": "2025-11-22T17:40:13.002Z"
      }
    },
    "timestamp": "2025-11-22T17:38:25.676Z"
  },
  "isSnapshotUpdate": true
}
```

### 2.5 `queue-operation` Entry Type

**Purpose:** Records message queue operations (for queued user input)

**Fields:**
- `type`: `"queue-operation"`
- `operation`: `"enqueue"` | `"remove"`
- `timestamp`: ISO 8601 string
- `content`: string (queued message content)
- `sessionId`: string
- `uuid`: null (always)
- `parentUuid`: null (always)

**Sample:**
```json
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2025-11-22T17:38:52.575Z",
  "content": "do you think reading 100 fles is all you need?",
  "sessionId": "4114a883-cd70-4f57-bbc9-aa3a376f00bc"
}
```

### 2.6 `system` Entry Type

**Purpose:** Records system events (compaction boundaries)

**Fields:**
- `type`: `"system"`
- `subtype`: `"compact_boundary"` (only observed value)
- `content`: string (e.g., "Conversation compacted")
- `timestamp`: ISO 8601 string
- `uuid`: string (UUID v4) - NOTE: unlike other non-message types, this HAS a uuid
- `parentUuid`: null
- `logicalParentUuid`: string (points to last message before compaction)
- `sessionId`: string
- `version`: string
- `cwd`: string
- `gitBranch`: string
- `isSidechain`: boolean
- `userType`: `"external"`
- `isMeta`: boolean
- `level`: `"info"` (log level)
- `compactMetadata`: object with:
  - `trigger`: `"manual"` | other
  - `preTokens`: number (token count before compaction)

**Sample:**
```json
{
  "parentUuid": null,
  "logicalParentUuid": "c1511b2e-bb0d-4735-b543-0cc42d28ee0e",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/leemoore/code/codex-port-02",
  "sessionId": "cad6d512-e91e-43b2-9cc9-cc462722dcaa",
  "version": "2.0.37",
  "gitBranch": "main",
  "type": "system",
  "subtype": "compact_boundary",
  "content": "Conversation compacted",
  "isMeta": false,
  "timestamp": "2025-11-13T12:53:34.032Z",
  "uuid": "34200b5f-1fc9-41ea-97dc-51086934abd3",
  "level": "info",
  "compactMetadata": {
    "trigger": "manual",
    "preTokens": 261187
  }
}
```

---

## 3. Content Block Types

### 3.1 `text` Content Block

Found in assistant messages for text responses.

```typescript
{
  type: "text";
  text: string;
}
```

### 3.2 `tool_use` Content Block

Found in assistant messages when Claude invokes a tool.

```typescript
{
  type: "tool_use";
  id: string;       // e.g., "toolu_0124jX5QYLGcGnPjoUvtDCT5"
  name: string;     // Tool name, e.g., "Read", "Bash", "Write"
  input: object;    // Tool-specific parameters
}
```

### 3.3 `tool_result` Content Block

Found in user messages as response to tool_use.

```typescript
{
  type: "tool_result";
  tool_use_id: string;  // Must match tool_use.id
  content: string;      // Result content
  is_error?: boolean;   // Present and true for errors
}
```

### 3.4 `thinking` Content Block

Found in assistant messages when extended thinking is enabled.

```typescript
{
  type: "thinking";
  thinking: string;     // The thinking content
  signature: string;    // Cryptographic signature (base64 encoded)
}
```

**Observation:** Thinking blocks appear in newer Claude Code versions with Opus model usage.

---

## 4. Turn Detection Algorithm

A "turn" is a user-initiated exchange (human sends message -> Claude responds, possibly with multiple tool loops).

```typescript
function isHumanTurn(entry: Entry): boolean {
  if (entry.type !== 'user') return false;

  const content = entry.message.content;

  // String content = human message
  if (typeof content === 'string') return true;

  // Array content - check first block
  if (Array.isArray(content) && content.length > 0) {
    const firstBlock = content[0];
    // text block = human message (or interrupt)
    if (firstBlock.type === 'text') return true;
    // tool_result = not a human turn
    if (firstBlock.type === 'tool_result') return false;
  }

  return false;
}

function countHumanTurns(entries: Entry[]): number {
  return entries.filter(isHumanTurn).length;
}
```

**Turn counts by session:**
- Session 1: 42 human turns
- Session 2: 58 human turns
- Session 3: 54 human turns
- Session 4: 35 human turns
- Session 5: 19 human turns

---

## 5. Tool Call Pairing Algorithm

```typescript
interface ToolPair {
  toolUse: {
    entryUuid: string;
    toolUseId: string;
    name: string;
    input: object;
  };
  toolResult: {
    entryUuid: string;
    content: string;
    isError: boolean;
  };
}

function pairToolCalls(entries: Entry[]): ToolPair[] {
  const toolUses = new Map<string, ToolPair['toolUse']>();
  const pairs: ToolPair[] = [];

  for (const entry of entries) {
    if (entry.type === 'assistant') {
      for (const block of entry.message.content) {
        if (block.type === 'tool_use') {
          toolUses.set(block.id, {
            entryUuid: entry.uuid,
            toolUseId: block.id,
            name: block.name,
            input: block.input
          });
        }
      }
    } else if (entry.type === 'user' && Array.isArray(entry.message.content)) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_result') {
          const toolUse = toolUses.get(block.tool_use_id);
          if (toolUse) {
            pairs.push({
              toolUse,
              toolResult: {
                entryUuid: entry.uuid,
                content: block.content,
                isError: block.is_error ?? false
              }
            });
          }
        }
      }
    }
  }

  return pairs;
}
```

**Tool call counts by session:**
| Session | tool_use | tool_result | Paired |
|---------|----------|-------------|--------|
| 1 | 183 | 183 | 100% |
| 2 | 179 | 179 | 100% |
| 3 | 124 | 124 | 100% |
| 4 | 148 | 148 | 100% |
| 5 | 80 | 80 | 100% |

---

## 6. Message Deduplication

Multiple JSONL entries can share the same `message.id`. This represents streaming behavior where each entry adds a new content block to the same API response.

### Version-dependent behavior:

**Older versions (2.0.36-37):**
- All entries with same `message.id` have the SAME `stop_reason` value
- All entries have the SAME `output_tokens` count
- Each entry contains one content block

**Newer versions (2.0.50+):**
- Entries have `stop_reason: null` during streaming
- Only the LAST entry for a `message.id` may have non-null `stop_reason`
- `output_tokens` may vary (though often shows 1)

### Reconstruction algorithm:

```typescript
interface ReconstructedMessage {
  messageId: string;
  model: string;
  content: ContentBlock[];
  stopReason: string | null;
  entryUuids: string[];
}

function reconstructMessages(entries: Entry[]): ReconstructedMessage[] {
  const messageMap = new Map<string, ReconstructedMessage>();

  for (const entry of entries) {
    if (entry.type !== 'assistant') continue;

    const msgId = entry.message.id;

    if (!messageMap.has(msgId)) {
      messageMap.set(msgId, {
        messageId: msgId,
        model: entry.message.model,
        content: [],
        stopReason: null,
        entryUuids: []
      });
    }

    const msg = messageMap.get(msgId)!;
    msg.entryUuids.push(entry.uuid);

    // Append content blocks (streaming append model)
    msg.content.push(...entry.message.content);

    // Update stop_reason (last non-null wins)
    if (entry.message.stop_reason) {
      msg.stopReason = entry.message.stop_reason;
    }
  }

  return Array.from(messageMap.values());
}
```

### Finding the "final" entry:

For deduplication purposes, the "final" entry for a message is:
1. The entry with non-null `stop_reason` (if any exist), OR
2. The last entry in file order with that `message.id`

```typescript
function getFinalEntry(entries: Entry[], messageId: string): Entry | null {
  const messageEntries = entries.filter(
    e => e.type === 'assistant' && e.message.id === messageId
  );

  // Prefer entry with stop_reason
  const withStopReason = messageEntries.find(e => e.message.stop_reason !== null);
  if (withStopReason) return withStopReason;

  // Otherwise, last entry
  return messageEntries[messageEntries.length - 1] ?? null;
}
```

---

## 7. UUID Chain Analysis

The `uuid`/`parentUuid` fields form a linked list for `user` and `assistant` entries only.

**Chain properties:**
- First entry: `parentUuid: null`
- Subsequent entries: `parentUuid` equals previous entry's `uuid`
- Chain is linear (no branching observed in these sessions)
- `isSidechain: false` on all observed entries

**Non-chain entry types:**
- `summary`: `uuid: null`, `parentUuid: null`
- `file-history-snapshot`: `uuid: null`, `parentUuid: null`
- `queue-operation`: `uuid: null`, `parentUuid: null`
- `system`: HAS `uuid`, `parentUuid: null`, but has `logicalParentUuid` for continuity

**Validation algorithm:**
```typescript
function validateUuidChain(entries: Entry[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const chainEntries = entries.filter(e => e.type === 'user' || e.type === 'assistant');

  let expectedParent: string | null = null;

  for (const entry of chainEntries) {
    if (entry.parentUuid !== expectedParent) {
      errors.push(
        `Entry ${entry.uuid}: expected parentUuid=${expectedParent}, got ${entry.parentUuid}`
      );
    }
    expectedParent = entry.uuid;
  }

  return { valid: errors.length === 0, errors };
}
```

---

## 8. Caveats and Edge Cases

### 8.1 Version-dependent streaming behavior
Older Claude Code versions (2.0.36-37) use a different streaming pattern than newer versions. Tools processing sessions should handle both:
- **Old:** All entries for a message have same `stop_reason` and `output_tokens`
- **New:** Entries have `null` stop_reason until final; `output_tokens` may be 1

### 8.2 Compaction boundary handling
After a manual `/compact` command:
1. A `system` entry with `subtype: "compact_boundary"` is written
2. The next `user` entry has `isCompactSummary: true` and contains the summary
3. The UUID chain continues from the system entry's `uuid`
4. `logicalParentUuid` on the system entry points to the pre-compaction message

### 8.3 Session resume/continuation
Session 5 demonstrates a heavily-summarized session with 195 summary entries at the start. This appears to be from session continuation or import functionality.

### 8.4 User interrupts
When a user interrupts Claude, a user entry with content `[{type: "text", text: "[Request interrupted by user]"}]` is injected. These should be treated as human turns for turn counting.

### 8.5 Meta messages
The `isMeta: true` flag indicates system-injected messages that should not be directly responded to. Example:
```json
{
  "message": {
    "content": "Caveat: The messages below were generated by the user while running local commands..."
  },
  "isMeta": true
}
```

### 8.6 Empty todos array
The `todos` field on user entries is always an empty array in observed data. Its purpose is unclear - possibly for future functionality.

### 8.7 Multiple tool calls in one turn
A single assistant message can contain multiple `tool_use` blocks. Each gets its own JSONL entry in the streaming model. Example: Session 2 message `msg_01CY63TM8daCUfRd45x7dwWX` has 9 entries (1 text + 8 tool_use blocks).

---

## 9. Raw Data

### 9.1 Entry Type Counts

| Session | user | assistant | summary | file-history-snapshot | queue-operation | system |
|---------|------|-----------|---------|----------------------|-----------------|--------|
| 4114a883 | 225 | 303 | 22 | 38 | 16 | 0 |
| cad6d512 | 237 | 302 | 1 | 43 | 6 | 1 |
| d64be32b | 178 | 346 | 1 | 51 | 0 | 0 |
| 2832d203 | 183 | 327 | 1 | 39 | 2 | 0 |
| 398e5a9a | 99 | 211 | 195 | 23 | 0 | 0 |

### 9.2 stop_reason Value Counts

| Session | null | "tool_use" | "end_turn" |
|---------|------|------------|------------|
| 4114a883 | 277 | 24 | 2 |
| cad6d512 | 0 | 242 | 60 |
| d64be32b | 318 | 28 | 0 |
| 2832d203 | 284 | 42 | 1 |
| 398e5a9a | 0 | 143 | 68 |

### 9.3 Content Block Type Counts (Assistant)

| Session | text | tool_use | thinking |
|---------|------|----------|----------|
| 4114a883 | 119 | 183 | 1 |
| cad6d512 | 123 | 179 | 0 |
| d64be32b | 55 | 124 | 167 |
| 2832d203 | 38 | 148 | 141 |
| 398e5a9a | 35 | 80 | 96 |

### 9.4 Content Block Type Counts (User)

| Session | string | text | tool_result |
|---------|--------|------|-------------|
| 4114a883 | 36 | 6 | 183 |
| cad6d512 | 33 | 25 | 179 |
| d64be32b | 48 | 6 | 124 |
| 2832d203 | 32 | 3 | 148 |
| 398e5a9a | 19 | 0 | 80 |

### 9.5 Unique Message IDs (Assistant)

| Session | Total Entries | Unique message.id |
|---------|---------------|-------------------|
| 4114a883 | 303 | 152 |
| cad6d512 | 302 | 164 |
| d64be32b | 346 | 167 |
| 2832d203 | 327 | 143 |
| 398e5a9a | 211 | 96 |

### 9.6 Models Used

| Session | claude-sonnet-4-5-20250929 | claude-opus-4-5-20251101 |
|---------|---------------------------|-------------------------|
| 4114a883 | 303 | 0 |
| cad6d512 | 302 | 0 |
| d64be32b | 250 | 96 |
| 2832d203 | 0 | 327 |
| 398e5a9a | 211 | 0 |

---

## 10. Session File Location

Session files are stored at:
```
~/.claude/projects/<encoded-project-path>/<sessionId>.jsonl
```

Where `<encoded-project-path>` is the absolute path with `/` replaced by `-`:
```
/Users/leemoore/code/codex-port-02
  becomes
-Users-leemoore-code-codex-port-02
```

---

## 11. Cloning Considerations

When cloning a session for modification:

1. **Update `sessionId`** in all entries that have it
2. **Regenerate `uuid`** values for user/assistant entries
3. **Update `parentUuid`** to maintain the chain
4. **Update `leafUuid`** in summary entries to point to new UUIDs
5. **Update `messageId`** in file-history-snapshot entries
6. **Update `sessionId`** in queue-operation entries
7. **Consider updating `timestamp`** values
8. **Handle `logicalParentUuid`** if system entries exist

For tool call removal:
- Remove `tool_use` content blocks from assistant entries
- Remove corresponding user entries that contain only `tool_result` blocks
- Rechain the UUID linked list to skip removed entries

For thinking block removal:
- Remove `thinking` content blocks from assistant entries
- Keep the entry if other content remains; remove if empty
