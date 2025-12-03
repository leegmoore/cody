# Claude Code Session File Format Specification

**Document Version:** 1.0
**Analysis Date:** 2025-12-02
**Sessions Analyzed:** 5
**Claude Code Versions Observed:** 2.0.36, 2.0.37, 2.0.42, 2.0.50

---

## 1. Executive Summary

Key findings from analyzing 5 Claude Code session files:

- **Format:** JSONL (one JSON object per line), append-only log structure
- **Entry Types:** 6 distinct types - `user`, `assistant`, `queue-operation`, `file-history-snapshot`, `summary`, `system`
- **UUID Chain:** Entries form a linked list via `uuid` and `parentUuid` fields; first entry has `parentUuid: null`
- **Turn Detection:** Human turns have `message.content` as **string**; tool result turns have `message.content` as **array**
- **Streaming Pattern:** Multiple entries share same `message.id`; final entry has non-null `stop_reason`
- **Tool Pairing:** `tool_use` blocks have unique `id`; `tool_result` blocks reference via `tool_use_id` - always 1:1 paired
- **Version Differences:** v2.0.50 includes streaming intermediate entries with `stop_reason: null`; v2.0.42 only stores final messages
- **Content Types:** `text`, `tool_use`, `tool_result`, `thinking` (with `signature` field)
- **Stop Reasons:** `"end_turn"` (conversation turn complete), `"tool_use"` (tool execution needed), `"stop_sequence"` (synthetic marker), `null` (streaming intermediate)

---

## 2. Session Inventory

| Session ID | Lines | Version(s) | User | Assistant | Tool Calls | Human Turns | file-history | summary | system | queue-op |
|------------|-------|------------|------|-----------|------------|-------------|--------------|---------|--------|----------|
| 945090a1-2de6-48c4-8d29-840ab1014598 | 1168 | 2.0.50 | 434 | 466 | 257 | 90 | 174 | 86 | 0 | 8 |
| 5f1e2a34-9020-4f9a-9a4d-2ed6838acec1 | 1006 | 2.0.42 | 341 | 464 | 150 | 189 | 195 | 2 | 0 | 4 |
| 07945b52-5076-4226-9044-ad0853831562 | 788 | 2.0.37, 2.0.42 | 288 | 422 | 198 | 28 | 73 | 1 | 2 | 2 |
| 644ef223-00e7-4a77-bcad-d89361ee209c | 747 | 2.0.36 | 267 | 382 | 228 | 29 | 51 | 39 | 0 | 8 |
| 755d8acd-92e0-4c48-a4a9-38ce584522a5 | 709 | 2.0.50 | 198 | 424 | 125 | 71 | 77 | 0 | 2 | 8 |

### Stop Reason Distribution

| Session | end_turn | tool_use | stop_sequence | null |
|---------|----------|----------|---------------|------|
| 945090a1 | 19 | 179 | 1 | 267 |
| 5f1e2a34 | 245 | 219 | 0 | 0 |
| 07945b52 | 84 | 337 | 1 | 0 |
| 644ef223 | 35 | 346 | 1 | 0 |
| 755d8acd | 1 | 68 | 0 | 355 |

### Content Block Type Counts

| Session | text | tool_use | tool_result | thinking |
|---------|------|----------|-------------|----------|
| 945090a1 | 296 | 257 | 257 | 0 |
| 5f1e2a34 | 215 | 150 | 150 | 101 |
| 07945b52 | 165 | 198 | 198 | 121 |
| 644ef223 | 164 | 228 | 228 | 0 |
| 755d8acd | 121 | 125 | 125 | 180 |

---

## 3. Entry Type Specifications

### 3.1 Common Entry Fields

All entries (except `queue-operation` and some metadata entries) share these fields:

```typescript
interface CommonEntryFields {
  uuid: string;                    // Unique identifier for this entry
  parentUuid: string | null;       // UUID of previous entry (null for first entry)
  type: EntryType;                 // Entry type discriminator
  sessionId: string;               // Session UUID
  version: string;                 // Claude Code version (e.g., "2.0.50")
  timestamp: string;               // ISO 8601 timestamp
  cwd: string;                     // Working directory
  gitBranch: string;               // Current git branch
  userType: "external";            // Always "external" in observed data
  isSidechain: boolean;            // Branch indicator (always false in observed data)
}
```

### 3.2 User Entry (`type: "user"`)

User entries represent either human input or tool results.

```typescript
interface UserEntry extends CommonEntryFields {
  type: "user";
  message: {
    role: "user";
    content: string | ToolResultContent[];  // String for human, array for tool results
  };
  toolUseResult?: ToolUseResultData;  // Present only for tool result entries
}

// Tool result content block
interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;    // References the tool_use block's id
  content: string;        // Result text
}

// Additional metadata for tool results (at entry level, not in message)
type ToolUseResultData =
  | GrepResult
  | FileReadResult
  | string;  // Error messages are stored as plain strings

interface GrepResult {
  mode: "files_with_matches" | "content" | "count";
  filenames: string[];
  numFiles: number;
  appliedLimit: number;
}

interface FileReadResult {
  type: "text";
  file: {
    filePath: string;
    content: string;
    numLines: number;
    startLine: number;
    totalLines: number;
  };
}
```

**Key Insight:** Distinguish human turns from tool results by checking `typeof message.content`:
- `string` = Human input (new turn)
- `array` = Tool result (continuation of current turn)

**Sample Human Input Entry:**
```json
{
  "parentUuid": null,
  "uuid": "1871e297-eb4f-4f4c-900b-428c744c92e1",
  "type": "user",
  "sessionId": "945090a1-2de6-48c4-8d29-840ab1014598",
  "version": "2.0.50",
  "message": {
    "role": "user",
    "content": "Hello, please help me with..."
  }
}
```

**Sample Tool Result Entry:**
```json
{
  "parentUuid": "6bfea9fa-81a9-4683-8097-c40297f1ee43",
  "uuid": "74155ff1-ac88-49b0-bf5c-46e95f46f404",
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "tool_use_id": "toolu_01WezRSpdwzjzGUPH6KRAQEL",
      "type": "tool_result",
      "content": "Found 20 files..."
    }]
  },
  "toolUseResult": {
    "mode": "files_with_matches",
    "filenames": ["file1.ts", "file2.ts"],
    "numFiles": 20,
    "appliedLimit": 20
  }
}
```

### 3.3 Assistant Entry (`type: "assistant"`)

Assistant entries contain Claude's responses, including text, tool calls, and thinking blocks.

```typescript
interface AssistantEntry extends CommonEntryFields {
  type: "assistant";
  requestId?: string;              // API request ID (e.g., "req_011CVP81jCLMp18CHwVctgod")
  isApiErrorMessage?: boolean;     // True if this is an error response
  message: AssistantMessage;
}

interface AssistantMessage {
  type: "message";
  id: string;                      // Message ID (e.g., "msg_01EndcwzueLA7JeV116WkdWL")
  model: string;                   // Model identifier or "<synthetic>"
  role: "assistant";
  content: ContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "stop_sequence" | null;
  stop_sequence: string | null;
  usage: UsageInfo;
  context_management?: {
    applied_edits: unknown[];
  } | null;
}

type ContentBlock = TextBlock | ToolUseBlock | ThinkingBlock;

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;           // Unique tool use ID (e.g., "toolu_01WezRSpdwzjzGUPH6KRAQEL")
  name: string;         // Tool name (e.g., "Grep", "Read", "Edit", "Bash")
  input: Record<string, unknown>;  // Tool-specific parameters
}

interface ThinkingBlock {
  type: "thinking";
  thinking: string;     // Extended thinking content
  signature: string;    // Cryptographic signature (base64 encoded)
}

interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  service_tier: string | null;
  cache_creation?: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  server_tool_use?: {
    web_search_requests: number;
    web_fetch_requests: number;
  };
}
```

**Sample Assistant Entry:**
```json
{
  "parentUuid": "1871e297-eb4f-4f4c-900b-428c744c92e1",
  "uuid": "be3bbae2-6b9d-47cc-9c99-53d9d0f6f783",
  "type": "assistant",
  "requestId": "req_011CVP81jCLMp18CHwVctgod",
  "message": {
    "model": "claude-sonnet-4-5-20250929",
    "id": "msg_01EndcwzueLA7JeV116WkdWL",
    "type": "message",
    "role": "assistant",
    "content": [
      {"type": "text", "text": "I'll help you with..."}
    ],
    "stop_reason": "end_turn",
    "stop_sequence": null,
    "usage": {
      "input_tokens": 2,
      "cache_creation_input_tokens": 150327,
      "cache_read_input_tokens": 12392,
      "output_tokens": 649,
      "service_tier": "standard"
    }
  }
}
```

### 3.4 System Entry (`type: "system"`)

System entries record meta-events like compaction and local commands.

```typescript
interface SystemEntry extends CommonEntryFields {
  type: "system";
  subtype: "compact_boundary" | "local_command";
  content: string;
  level: "info";
  isMeta: boolean;
  logicalParentUuid?: string;      // For compact_boundary, points to pre-compaction history
  compactMetadata?: {
    trigger: "manual" | "auto";
    preTokens: number;
  };
}
```

**Subtypes:**
- `compact_boundary`: Marks where conversation was compacted. Contains `compactMetadata` with token count before compaction.
- `local_command`: Records slash commands like `/usage`. Content contains XML-like tags: `<command-name>`, `<command-message>`, `<command-args>`, `<local-command-stdout>`.

**Sample Compact Boundary:**
```json
{
  "type": "system",
  "subtype": "compact_boundary",
  "content": "Conversation compacted",
  "logicalParentUuid": "cdec4352-21af-4555-97f7-13c30944da82",
  "compactMetadata": {
    "trigger": "manual",
    "preTokens": 166503
  }
}
```

### 3.5 Queue Operation (`type: "queue-operation"`)

Records message queue operations (enqueue/remove for pending user messages).

```typescript
interface QueueOperationEntry {
  type: "queue-operation";
  operation: "enqueue" | "remove";
  timestamp: string;
  content: string;         // The queued message text
  sessionId: string;
}
```

**Note:** These entries do NOT have `uuid`/`parentUuid` fields - they are metadata-only.

### 3.6 File History Snapshot (`type: "file-history-snapshot"`)

Tracks file state for undo/restore functionality.

```typescript
interface FileHistorySnapshotEntry {
  type: "file-history-snapshot";
  messageId: string;           // UUID linking to the associated message
  isSnapshotUpdate: boolean;   // false = initial, true = update
  snapshot: {
    messageId: string;
    timestamp: string;
    trackedFileBackups: Record<string, FileBackup>;
  };
}

interface FileBackup {
  backupFileName: string | null;   // Hash-based backup file name
  version: number;                  // Incremental version number
  backupTime: string;              // ISO 8601 timestamp
}
```

### 3.7 Summary Entry (`type: "summary"`)

Stores conversation topic summaries for history navigation.

```typescript
interface SummaryEntry {
  type: "summary";
  summary: string;         // Short description (e.g., "Codebase Overview: TypeScript Codex Architecture")
  leafUuid: string;        // UUID of the message this summary describes
}
```

---

## 4. Turn Detection Algorithm

A "turn" is defined as: user sends a message -> Claude responds (possibly with multiple tool call loops) -> Claude finishes and waits for user.

```typescript
interface Turn {
  startEntryUuid: string;      // UUID of human user entry
  userMessage: string;         // Human input text
  assistantResponses: string[];  // UUIDs of final assistant entries
  toolCalls: ToolCallPair[];   // All tool call/result pairs in this turn
}

interface ToolCallPair {
  toolUseId: string;
  toolName: string;
  assistantEntryUuid: string;  // Entry containing tool_use
  resultEntryUuid: string;     // Entry containing tool_result
}

function detectTurns(entries: Entry[]): Turn[] {
  const turns: Turn[] = [];
  let currentTurn: Turn | null = null;

  for (const entry of entries) {
    if (entry.type === "user") {
      const content = entry.message.content;

      if (typeof content === "string") {
        // Human input - start new turn
        if (currentTurn) {
          turns.push(currentTurn);
        }
        currentTurn = {
          startEntryUuid: entry.uuid,
          userMessage: content,
          assistantResponses: [],
          toolCalls: []
        };
      } else if (Array.isArray(content)) {
        // Tool result - continue current turn
        for (const block of content) {
          if (block.type === "tool_result" && currentTurn) {
            const toolCall = currentTurn.toolCalls.find(
              tc => tc.toolUseId === block.tool_use_id && !tc.resultEntryUuid
            );
            if (toolCall) {
              toolCall.resultEntryUuid = entry.uuid;
            }
          }
        }
      }
    } else if (entry.type === "assistant" && currentTurn) {
      // Only record final version of streamed messages
      if (isFinalMessage(entry)) {
        currentTurn.assistantResponses.push(entry.uuid);

        // Record tool calls
        for (const block of entry.message.content) {
          if (block.type === "tool_use") {
            currentTurn.toolCalls.push({
              toolUseId: block.id,
              toolName: block.name,
              assistantEntryUuid: entry.uuid,
              resultEntryUuid: null  // Will be filled when result arrives
            });
          }
        }
      }
    }
  }

  if (currentTurn) {
    turns.push(currentTurn);
  }

  return turns;
}

function isFinalMessage(entry: AssistantEntry): boolean {
  // Final messages have non-null stop_reason
  return entry.message.stop_reason !== null;
}
```

---

## 5. Tool Call Pairing Algorithm

Tool calls and results are linked via `tool_use.id` and `tool_result.tool_use_id`.

```typescript
interface ToolCallMatch {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  toolUseEntryUuid: string;
  toolResultEntryUuid: string;
  result: string;
  resultMetadata?: ToolUseResultData;
}

function pairToolCalls(entries: Entry[]): ToolCallMatch[] {
  const matches: ToolCallMatch[] = [];
  const pendingToolUses = new Map<string, {
    name: string;
    input: Record<string, unknown>;
    entryUuid: string;
  }>();

  for (const entry of entries) {
    if (entry.type === "assistant" && isFinalMessage(entry)) {
      for (const block of entry.message.content) {
        if (block.type === "tool_use") {
          pendingToolUses.set(block.id, {
            name: block.name,
            input: block.input,
            entryUuid: entry.uuid
          });
        }
      }
    } else if (entry.type === "user" && Array.isArray(entry.message.content)) {
      for (const block of entry.message.content) {
        if (block.type === "tool_result") {
          const toolUse = pendingToolUses.get(block.tool_use_id);
          if (toolUse) {
            matches.push({
              toolUseId: block.tool_use_id,
              toolName: toolUse.name,
              input: toolUse.input,
              toolUseEntryUuid: toolUse.entryUuid,
              toolResultEntryUuid: entry.uuid,
              result: block.content,
              resultMetadata: entry.toolUseResult
            });
            pendingToolUses.delete(block.tool_use_id);
          }
        }
      }
    }
  }

  // Any remaining in pendingToolUses are orphaned (should not happen)
  return matches;
}
```

**Verification across all 5 sessions:** Tool use and tool result counts are exactly equal, confirming 1:1 pairing.

---

## 6. Message Deduplication (Streaming)

Version 2.0.50 writes streaming intermediate entries. Multiple entries share the same `message.id`.

```typescript
interface DedupedMessage {
  messageId: string;
  finalEntryUuid: string;
  streamingEntryUuids: string[];  // Intermediate entries (to be filtered out)
  contentBlocks: ContentBlock[];
  usage: UsageInfo;
}

function deduplicateMessages(entries: AssistantEntry[]): Map<string, DedupedMessage> {
  const messageGroups = new Map<string, AssistantEntry[]>();

  // Group by message.id
  for (const entry of entries) {
    const msgId = entry.message.id;
    if (!messageGroups.has(msgId)) {
      messageGroups.set(msgId, []);
    }
    messageGroups.get(msgId)!.push(entry);
  }

  const deduped = new Map<string, DedupedMessage>();

  for (const [msgId, group] of messageGroups) {
    // Find final entry (non-null stop_reason, or highest output_tokens if all null)
    let finalEntry = group.find(e => e.message.stop_reason !== null);

    if (!finalEntry) {
      // Fallback: use entry with highest output_tokens (latest streaming state)
      finalEntry = group.reduce((prev, curr) =>
        (curr.message.usage.output_tokens > prev.message.usage.output_tokens) ? curr : prev
      );
    }

    deduped.set(msgId, {
      messageId: msgId,
      finalEntryUuid: finalEntry.uuid,
      streamingEntryUuids: group
        .filter(e => e.uuid !== finalEntry!.uuid)
        .map(e => e.uuid),
      contentBlocks: finalEntry.message.content,
      usage: finalEntry.message.usage
    });
  }

  return deduped;
}
```

**Streaming Pattern Observed:**

For a message with thinking + text + tool_use:
1. Entry 1: `stop_reason: null`, `output_tokens: 2`, content: `[thinking]`
2. Entry 2: `stop_reason: null`, `output_tokens: 2`, content: `[text]`
3. Entry 3: `stop_reason: "tool_use"`, `output_tokens: 480`, content: `[tool_use]`

Only entry 3 (final) should be used for reconstruction.

---

## 7. Caveats and Edge Cases

### 7.1 Synthetic Messages

Messages with `model: "<synthetic>"` are system-generated markers:
- Associated with `stop_reason: "stop_sequence"`
- Content typically: `"No response requested."`
- Should be filtered out when reconstructing conversation

### 7.2 Version Differences

| Feature | v2.0.36-2.0.42 | v2.0.50 |
|---------|----------------|---------|
| Streaming intermediates | Not stored | Stored with `stop_reason: null` |
| Duplicate message IDs | Rare (up to 2) | Common (up to 3+) |
| Thinking blocks | Present | Present |
| Stop_reason nulls | Rare | Common |

### 7.3 Session Crossing Versions

Session 07945b52 contains entries from both v2.0.37 and v2.0.42, indicating sessions can span version upgrades.

### 7.4 Queue Operations Without UUIDs

`queue-operation` entries lack `uuid`/`parentUuid` fields and exist outside the main chain. They should be handled separately when cloning sessions.

### 7.5 File History Snapshot Message IDs

The `messageId` in `file-history-snapshot` entries may reference UUIDs from the conversation chain OR synthetic message IDs. Care needed when updating these during session cloning.

### 7.6 Thinking Block Signatures

Thinking blocks include a `signature` field containing a base64-encoded cryptographic signature. This may be used for verification and should be preserved during session manipulation.

### 7.7 Error Tool Results

When tools fail, `toolUseResult` is a plain error string rather than a structured object:
```json
{
  "toolUseResult": "Error: File not found: /path/to/missing/file"
}
```

---

## 8. Raw Data Appendix

### 8.1 Session 945090a1-2de6-48c4-8d29-840ab1014598

**Entry Type Counts:**
- assistant: 466
- user: 434
- file-history-snapshot: 174
- summary: 86
- queue-operation: 8

**Stop Reason Counts:**
- end_turn: 19
- tool_use: 179
- stop_sequence: 1
- null: 267

**Content Block Counts:**
- text: 296
- tool_use: 257
- tool_result: 257
- thinking: 0

**Version:** 2.0.50

### 8.2 Session 5f1e2a34-9020-4f9a-9a4d-2ed6838acec1

**Entry Type Counts:**
- assistant: 464
- user: 341
- file-history-snapshot: 195
- queue-operation: 4
- summary: 2

**Stop Reason Counts:**
- end_turn: 245
- tool_use: 219
- null: 0

**Content Block Counts:**
- text: 215
- tool_use: 150
- tool_result: 150
- thinking: 101

**Version:** 2.0.42

### 8.3 Session 07945b52-5076-4226-9044-ad0853831562

**Entry Type Counts:**
- assistant: 422
- user: 288
- file-history-snapshot: 73
- system: 2
- queue-operation: 2
- summary: 1

**Stop Reason Counts:**
- end_turn: 84
- tool_use: 337
- stop_sequence: 1
- null: 0

**Content Block Counts:**
- tool_use: 198
- tool_result: 198
- text: 165
- thinking: 121

**Versions:** 2.0.37 (60 entries), 2.0.42 (652 entries)

### 8.4 Session 644ef223-00e7-4a77-bcad-d89361ee209c

**Entry Type Counts:**
- assistant: 382
- user: 267
- file-history-snapshot: 51
- summary: 39
- queue-operation: 8

**Stop Reason Counts:**
- end_turn: 35
- tool_use: 346
- stop_sequence: 1
- null: 0

**Content Block Counts:**
- tool_use: 228
- tool_result: 228
- text: 164
- thinking: 0

**Version:** 2.0.36

### 8.5 Session 755d8acd-92e0-4c48-a4a9-38ce584522a5

**Entry Type Counts:**
- assistant: 424
- user: 198
- file-history-snapshot: 77
- queue-operation: 8
- system: 2

**Stop Reason Counts:**
- end_turn: 1
- tool_use: 68
- null: 355

**Content Block Counts:**
- thinking: 180
- tool_use: 125
- tool_result: 125
- text: 121

**Version:** 2.0.50

---

## 9. Implementation Recommendations

### 9.1 Session Cloning

When cloning a session:
1. Generate new `sessionId` for all entries
2. Regenerate `uuid` for each entry while maintaining `parentUuid` chain
3. Update `queue-operation` `sessionId` fields
4. Update `file-history-snapshot` `messageId` references to new UUIDs
5. Update `summary` `leafUuid` references to new UUIDs

### 9.2 Tool Call Removal

When removing tool calls:
1. Identify tool_use blocks to remove
2. Remove corresponding assistant entries (or content blocks)
3. Remove matching tool_result user entries
4. Repair `parentUuid` chain (point next entry to previous valid entry)
5. Update related `file-history-snapshot` entries

### 9.3 Thinking Block Removal

When removing thinking blocks:
1. Filter out `thinking` blocks from `message.content` arrays
2. Preserve `text` and `tool_use` blocks
3. Note: Token counts in `usage` will be inaccurate after removal

### 9.4 Session Compression

For older turns:
1. Keep `user` entries with string content (human turns)
2. Summarize assistant text responses
3. Optionally preserve tool call metadata without full results
4. Create `summary` entries for removed content
5. Insert `system` entry with `subtype: "compact_boundary"` as marker
