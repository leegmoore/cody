# Claude Code Session File Format Specification

**Document Version**: 1.0
**Analysis Date**: 2025-12-02
**Sessions Analyzed**: 5
**Total Lines Analyzed**: 10,054

---

## 1. Executive Summary

Key findings from reverse-engineering the Claude Code session JSONL format:

- **Entry Types**: 6 distinct types found: `user`, `assistant`, `file-history-snapshot`, `queue-operation`, `summary`, `system`
- **Streaming Pattern**: Multiple JSONL entries share the same `message.id` during streaming; final entry has non-null `stop_reason`
- **UUID Chain**: All `user` and `assistant` entries form a linked list via `uuid` and `parentUuid` fields; `file-history-snapshot` entries have null UUIDs
- **Turn Detection**: User text-only entries (no `tool_result`) mark new turns; user entries with `tool_result` are tool responses within a turn
- **Tool Pairing**: Perfect 1:1 pairing between `tool_use` and `tool_result` blocks, linked via `tool_use_id`
- **Message Deduplication**: Select entries where `stop_reason` is non-null OR where `output_tokens` is highest for a given `message.id`
- **Version Field**: Claude Code version present in all user/assistant entries (observed: 2.0.33, 2.0.36, 2.0.37, 2.0.42)
- **Content Polymorphism**: User `message.content` can be either a string (for meta messages) or an array of content blocks
- **Synthetic Messages**: Model `<synthetic>` indicates placeholder responses, not actual API calls

---

## 2. Session Inventory

| Session ID | Lines | user | assistant | file-history-snapshot | queue-operation | summary | system | Est. Turns | Tool Calls |
|------------|-------|------|-----------|----------------------|-----------------|---------|--------|------------|------------|
| 2dd55926-505e-4a0b-bc2b-35211c9a6081 | 3081 | 1148 | 1637 | 296 | 0 | 0 | 0 | 235 | 856 |
| 59d9022a-1e03-4856-9c1a-5157f8907dfb | 2479 | 910 | 1253 | 302 | 10 | 4 | 0 | 5 | 674 |
| 5e1bfc04-f109-436b-a4cd-a7608e81338e | 1608 | 604 | 816 | 163 | 20 | 1 | 4 | 29 | 430 |
| cd3c64cc-6046-42ac-8b2f-c2ee3727ef34 | 1524 | 491 | 810 | 210 | 8 | 3 | 2 | 5 | 291 |
| 43858ada-91c2-4f63-90c7-ffa8dae8a149 | 1362 | 496 | 623 | 241 | 2 | 0 | 0 | 178 | 247 |

**Notes**:
- "Est. Turns" = user entries with text content only (no tool_result)
- "Tool Calls" = total tool_use blocks across all assistant entries

---

## 3. Entry Type Specifications

### 3.1 `user` Entry Type

User entries represent user input or tool results being returned to Claude.

**Field Structure**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"user"` | Yes | Entry type discriminator |
| `uuid` | `string` | Yes | Unique identifier for this entry |
| `parentUuid` | `string \| null` | Yes | UUID of preceding entry (null for first entry) |
| `sessionId` | `string` | Yes | Session identifier |
| `timestamp` | `string (ISO 8601)` | Yes | When entry was created |
| `version` | `string` | Yes | Claude Code version (e.g., "2.0.42") |
| `cwd` | `string` | Yes | Current working directory |
| `gitBranch` | `string` | Yes | Current git branch |
| `userType` | `"external"` | Yes | Always "external" for user entries |
| `isSidechain` | `boolean` | Yes | Always `false` in observed data |
| `message` | `object` | Yes | The message content (see below) |
| `thinkingMetadata` | `object` | No | Thinking level configuration |
| `toolUseResult` | `object \| string \| array \| null` | No | Detailed tool result data (present for tool_result entries) |
| `isMeta` | `boolean` | No | If `true`, indicates metadata/system message |

**Message Object Structure**:

```typescript
interface UserMessage {
  role: "user";
  content: string | ContentBlock[];  // String for meta messages, array otherwise
}
```

**Content Block Types (in array)**:
- `text` - User's text input
- `tool_result` - Response to a tool call

**Sample Entry (Text Input)**:
```json
{
  "parentUuid": null,
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/leemoore/code/codex-port-02",
  "sessionId": "59d9022a-1e03-4856-9c1a-5157f8907dfb",
  "version": "2.0.33",
  "gitBranch": "main",
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "text",
        "text": "Please review the codebase"
      }
    ]
  },
  "uuid": "b74c3ba3-9738-46db-b66c-3e3053a4e4b3",
  "timestamp": "2025-11-05T13:17:26.074Z",
  "thinkingMetadata": {
    "level": "none",
    "disabled": true,
    "triggers": []
  }
}
```

**Sample Entry (Tool Result)**:
```json
{
  "parentUuid": "8f7775e2-454d-4d76-a53c-c81de0619147",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/leemoore/code/codex-port-02",
  "sessionId": "2dd55926-505e-4a0b-bc2b-35211c9a6081",
  "version": "2.0.36",
  "gitBranch": "main",
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "tool_use_id": "toolu_01P79qSvT4qVvKt3zZ3pVSwU",
        "type": "tool_result",
        "content": "     1\t# File content here..."
      }
    ]
  },
  "uuid": "5746886f-b429-4b59-83fe-ab75ce1a0b68",
  "timestamp": "2025-11-05T13:17:30.123Z",
  "toolUseResult": {
    "type": "text",
    "file": {
      "filePath": "/path/to/file.md",
      "content": "...",
      "numLines": 177,
      "startLine": 1,
      "totalLines": 177
    }
  }
}
```

**Sample Entry (Meta Message)**:
```json
{
  "parentUuid": "302d8b7f-8f4e-492e-b01d-bd078487a75c",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/leemoore/code/codex-port-02",
  "sessionId": "2dd55926-505e-4a0b-bc2b-35211c9a6081",
  "version": "2.0.36",
  "gitBranch": "main",
  "type": "user",
  "message": {
    "role": "user",
    "content": "Caveat: The messages below were generated by the user while running local commands. DO NOT respond to these messages or otherwise consider them in your response unless the user explicitly asks you to."
  },
  "isMeta": true,
  "uuid": "8fd5c8c1-ba62-4d87-9f3e-159abb83353e",
  "timestamp": "2025-11-08T00:30:43.731Z"
}
```

---

### 3.2 `assistant` Entry Type

Assistant entries represent Claude's responses. Multiple entries may share the same `message.id` during streaming.

**Field Structure**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"assistant"` | Yes | Entry type discriminator |
| `uuid` | `string` | Yes | Unique identifier for this entry |
| `parentUuid` | `string` | Yes | UUID of preceding entry |
| `sessionId` | `string` | Yes | Session identifier |
| `timestamp` | `string (ISO 8601)` | Yes | When entry was created |
| `version` | `string` | Yes | Claude Code version |
| `cwd` | `string` | Yes | Current working directory |
| `gitBranch` | `string` | Yes | Current git branch |
| `userType` | `"external"` | Yes | Always "external" |
| `isSidechain` | `boolean` | Yes | Always `false` in observed data |
| `message` | `object` | Yes | The message content (see below) |
| `requestId` | `string` | Yes | API request identifier |
| `isApiErrorMessage` | `boolean` | No | Present for synthetic/error messages |

**Message Object Structure**:

```typescript
interface AssistantMessage {
  id: string;                    // Message ID (shared across streaming entries)
  model: string;                 // Model identifier or "<synthetic>"
  type: "message";               // Always "message"
  role: "assistant";             // Always "assistant"
  content: ContentBlock[];       // Array of content blocks
  stop_reason: "end_turn" | "tool_use" | "stop_sequence" | null;
  stop_sequence: string | null;  // Usually null, empty string for stop_sequence
  usage: UsageObject;
  context_management: { applied_edits: [] } | null;
  container?: null;              // Observed as null when present
}

interface UsageObject {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  service_tier: "standard" | null;
  cache_creation: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  server_tool_use?: {           // Present in synthetic messages
    web_search_requests: number;
    web_fetch_requests: number;
  };
}
```

**Content Block Types**:

1. **text** - Text response
```json
{
  "type": "text",
  "text": "I'll review the codebase..."
}
```

2. **tool_use** - Tool invocation
```json
{
  "type": "tool_use",
  "id": "toolu_01P79qSvT4qVvKt3zZ3pVSwU",
  "name": "Read",
  "input": {
    "file_path": "/path/to/file.md"
  }
}
```

3. **thinking** - Extended thinking block
```json
{
  "type": "thinking",
  "thinking": "Let me analyze this request...",
  "signature": "EpYKCkYICRgC..."
}
```

**stop_reason Values**:

| Value | Meaning |
|-------|---------|
| `null` | Streaming chunk (not final) |
| `"end_turn"` | Claude finished responding, waiting for user |
| `"tool_use"` | Claude called a tool, waiting for result |
| `"stop_sequence"` | Response stopped at a stop sequence |

**Sample Entry (Complete Response)**:
```json
{
  "parentUuid": "b74c3ba3-9738-46db-b66c-3e3053a4e4b3",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/leemoore/code/codex-port-02",
  "sessionId": "2dd55926-505e-4a0b-bc2b-35211c9a6081",
  "version": "2.0.36",
  "gitBranch": "main",
  "type": "assistant",
  "timestamp": "2025-11-05T13:17:28.955Z",
  "message": {
    "model": "claude-sonnet-4-5-20250929",
    "id": "msg_01Jirmmw8KVW2bWfMj1Gdgdm",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll read the file..."
      },
      {
        "type": "tool_use",
        "id": "toolu_01P79qSvT4qVvKt3zZ3pVSwU",
        "name": "Read",
        "input": {
          "file_path": "/path/to/file.md"
        }
      }
    ],
    "stop_reason": "tool_use",
    "stop_sequence": null,
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 5031,
      "cache_read_input_tokens": 12180,
      "cache_creation": {
        "ephemeral_5m_input_tokens": 5031,
        "ephemeral_1h_input_tokens": 0
      },
      "output_tokens": 2049,
      "service_tier": "standard"
    },
    "context_management": null
  },
  "requestId": "req_011CUpokuTLfbeQmHyJy2uBh",
  "uuid": "8f7775e2-454d-4d76-a53c-c81de0619147"
}
```

---

### 3.3 `file-history-snapshot` Entry Type

Tracks file state for undo/restore functionality.

**Field Structure**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"file-history-snapshot"` | Yes | Entry type discriminator |
| `messageId` | `string` | Yes | UUID of related user/assistant entry |
| `snapshot` | `object` | Yes | File state snapshot |
| `isSnapshotUpdate` | `boolean` | Yes | Whether this updates an existing snapshot |

**Snapshot Object**:
```typescript
interface Snapshot {
  messageId: string;
  trackedFileBackups: Record<string, FileBackup>;
  timestamp: string;
}

interface FileBackup {
  backupFileName: string | null;  // null if not backed up
  version: number;
  backupTime: string;
}
```

**Notes**:
- These entries have `uuid: null` and `parentUuid: null`
- They are metadata entries, not part of the conversation chain
- `isSnapshotUpdate: true` indicates incremental update vs fresh snapshot

---

### 3.4 `queue-operation` Entry Type

Records user input queue operations (enqueue/remove of messages while Claude is responding).

**Field Structure**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"queue-operation"` | Yes | Entry type discriminator |
| `operation` | `"enqueue" \| "remove"` | Yes | Queue operation type |
| `timestamp` | `string (ISO 8601)` | Yes | When operation occurred |
| `content` | `string` | Yes | The queued message content |
| `sessionId` | `string` | Yes | Session identifier |

**Sample Entry**:
```json
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2025-11-05T23:20:54.340Z",
  "content": "please stop putting duration in",
  "sessionId": "59d9022a-1e03-4856-9c1a-5157f8907dfb"
}
```

---

### 3.5 `summary` Entry Type

Stores conversation summaries (likely for context compression).

**Field Structure**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"summary"` | Yes | Entry type discriminator |
| `summary` | `string` | Yes | The summary text |
| `leafUuid` | `string` | Yes | UUID of the entry this summarizes up to |

**Sample Entry**:
```json
{
  "type": "summary",
  "summary": "Claude Code Repository Context Analysis",
  "leafUuid": "a4402c5e-ffa8-4ca0-89a9-c1c811d71031"
}
```

---

### 3.6 `system` Entry Type

System-level messages, primarily for compaction boundaries and informational notices.

**Field Structure**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"system"` | Yes | Entry type discriminator |
| `subtype` | `"compact_boundary" \| "informational"` | Yes | System message subtype |
| `content` | `string` | Yes | The system message |
| `uuid` | `string` | Yes | Unique identifier |
| `parentUuid` | `string \| null` | Yes | UUID of preceding entry (null for compact_boundary) |
| `logicalParentUuid` | `string` | No | For compact_boundary, points to pre-compaction entry |
| `timestamp` | `string (ISO 8601)` | Yes | When entry was created |
| `level` | `"info" \| "suggestion"` | Yes | Message severity |
| `isMeta` | `boolean` | Yes | Always `false` |
| `compactMetadata` | `object` | No | Present for compact_boundary |
| `sessionId` | `string` | Yes | Session identifier |
| `version` | `string` | Yes | Claude Code version |
| `cwd` | `string` | Yes | Current working directory |
| `gitBranch` | `string` | Yes | Current git branch |
| `userType` | `"external"` | Yes | Always "external" |
| `isSidechain` | `boolean` | Yes | Always `false` |

**compactMetadata Object**:
```typescript
interface CompactMetadata {
  trigger: "manual";      // Observed value
  preTokens: number;      // Token count before compaction
}
```

**Sample Entry (Compact Boundary)**:
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

## 4. Turn Detection Algorithm

A "turn" is defined as: user sends a message -> Claude responds (possibly with tool calls) -> tool results return -> Claude continues -> Claude stops and waits for user.

**Algorithm**:

```python
def is_new_turn(entry):
    """
    Returns True if this entry represents the START of a new user turn.
    """
    if entry.type != "user":
        return False

    # Meta messages are not turns
    if entry.get("isMeta", False):
        return False

    content = entry.message.content

    # String content = meta message, not a turn
    if isinstance(content, str):
        return False

    # Check if this is a tool_result response (not a new turn)
    has_tool_result = any(
        block.get("type") == "tool_result"
        for block in content
    )

    # New turn = has text content but no tool_result
    has_text = any(
        block.get("type") == "text"
        for block in content
    )

    return has_text and not has_tool_result


def count_turns(entries):
    """Count total turns in a session."""
    return sum(1 for entry in entries if is_new_turn(entry))
```

**Turn Boundary Indicators**:

| Condition | Indicates |
|-----------|-----------|
| `user` entry with text-only content | Start of new turn |
| `user` entry with tool_result content | Tool response within turn |
| `assistant` entry with `stop_reason: "end_turn"` | End of turn (waiting for user) |
| `assistant` entry with `stop_reason: "tool_use"` | Mid-turn (waiting for tool result) |

---

## 5. Tool Call Pairing Algorithm

Every `tool_use` block in an assistant message must have a corresponding `tool_result` block in a subsequent user message.

**Algorithm**:

```python
def pair_tool_calls(entries):
    """
    Returns list of (tool_use_entry, tool_result_entry) pairs.
    """
    # Index: tool_use_id -> (entry, tool_use_block)
    pending_tool_uses = {}
    pairs = []

    for entry in entries:
        if entry.type == "assistant":
            for block in entry.message.content:
                if block.get("type") == "tool_use":
                    tool_id = block["id"]
                    pending_tool_uses[tool_id] = (entry, block)

        elif entry.type == "user":
            content = entry.message.content
            if isinstance(content, list):
                for block in content:
                    if block.get("type") == "tool_result":
                        tool_id = block["tool_use_id"]
                        if tool_id in pending_tool_uses:
                            use_entry, use_block = pending_tool_uses.pop(tool_id)
                            pairs.append({
                                "tool_use_id": tool_id,
                                "tool_name": use_block["name"],
                                "tool_input": use_block["input"],
                                "tool_use_entry_uuid": use_entry["uuid"],
                                "tool_result_entry_uuid": entry["uuid"],
                                "tool_result_content": block["content"]
                            })

    # Any remaining in pending_tool_uses are orphaned (shouldn't happen)
    orphaned = list(pending_tool_uses.keys())

    return pairs, orphaned


def validate_tool_pairing(entries):
    """Verify all tool calls are properly paired."""
    pairs, orphaned = pair_tool_calls(entries)
    return len(orphaned) == 0
```

**Observed Statistics**:
- Session 1: 856 tool_use, 856 tool_result (perfect pairing)
- All sessions: 0 orphaned tool calls observed

---

## 6. Message Deduplication

During streaming, multiple JSONL entries share the same `message.id`. To reconstruct the conversation, we need only the final version.

**Algorithm**:

```python
def deduplicate_messages(entries):
    """
    Returns entries with only the final version of each message.
    """
    # Group by message.id for assistant entries
    message_groups = {}
    result = []

    for entry in entries:
        if entry.type == "assistant":
            msg_id = entry.message.id
            if msg_id not in message_groups:
                message_groups[msg_id] = []
            message_groups[msg_id].append(entry)
        else:
            result.append(entry)

    # Select final entry for each message
    for msg_id, group in message_groups.items():
        # Strategy 1: Non-null stop_reason
        final_entries = [e for e in group if e.message.stop_reason is not None]
        if final_entries:
            result.append(final_entries[-1])  # Last one with stop_reason
        else:
            # Strategy 2: Highest output_tokens
            final = max(group, key=lambda e: e.message.usage.output_tokens)
            result.append(final)

    # Re-sort by original order (use uuid chain or timestamp)
    return sorted(result, key=lambda e: e.timestamp)


def is_streaming_chunk(entry):
    """Returns True if this is an intermediate streaming chunk."""
    if entry.type != "assistant":
        return False
    return entry.message.stop_reason is None
```

**Key Indicators of Final Message**:

| Field | Streaming Chunk | Final Message |
|-------|-----------------|---------------|
| `stop_reason` | `null` | `"end_turn"`, `"tool_use"`, or `"stop_sequence"` |
| `output_tokens` | Low (accumulating) | Final token count |

---

## 7. Caveats and Edge Cases

### 7.1 Content Type Polymorphism

User `message.content` can be:
- **Array**: Normal user input or tool results
- **String**: Meta messages (has `isMeta: true`)

Always check type before iterating content blocks.

### 7.2 Synthetic Messages

When `message.model` is `"<synthetic>"`:
- Not from actual API call
- `usage.input_tokens` and `output_tokens` are 0
- Used for placeholder responses
- May have `stop_reason: "stop_sequence"` with empty `stop_sequence: ""`

### 7.3 toolUseResult Field Polymorphism

The `toolUseResult` field on user entries can be:
- **Object**: Structured result with `type` ("text", "create", "update", etc.)
- **String**: Error message
- **Array**: Multiple results
- **null**: No detailed result info

### 7.4 Session ID Inconsistency

Some entries show different `sessionId` values within the same session file, particularly around `system` compact_boundary entries. This may indicate session merging or continuation.

### 7.5 UUID Chain Breaks

`system` entries with `subtype: "compact_boundary"` have:
- `parentUuid: null` (breaks the chain)
- `logicalParentUuid`: Points to the pre-compaction entry

When traversing the UUID chain, handle these breaks by using `logicalParentUuid` for logical continuity.

### 7.6 Version Evolution

Different Claude Code versions may have slightly different field structures. Observed versions:
- 2.0.33, 2.0.36, 2.0.37, 2.0.42

Session 1 shows entries from two versions (2.0.33 and 2.0.36) indicating version upgrade during session.

### 7.7 thinkingMetadata Triggers

The `thinkingMetadata.triggers` array can contain entries like:
```json
{
  "start": 10976,
  "end": 10986,
  "text": "ultrathink"
}
```
These mark positions in user input that triggered extended thinking mode.

---

## 8. Raw Data

### 8.1 Entry Type Counts by Session

**Session 2dd55926-505e-4a0b-bc2b-35211c9a6081**:
| Type | Count |
|------|-------|
| assistant | 1637 |
| user | 1148 |
| file-history-snapshot | 296 |

**Session 59d9022a-1e03-4856-9c1a-5157f8907dfb**:
| Type | Count |
|------|-------|
| assistant | 1253 |
| user | 910 |
| file-history-snapshot | 302 |
| queue-operation | 10 |
| summary | 4 |

**Session 5e1bfc04-f109-436b-a4cd-a7608e81338e**:
| Type | Count |
|------|-------|
| assistant | 816 |
| user | 604 |
| file-history-snapshot | 163 |
| queue-operation | 20 |
| system | 4 |
| summary | 1 |

**Session cd3c64cc-6046-42ac-8b2f-c2ee3727ef34**:
| Type | Count |
|------|-------|
| assistant | 810 |
| user | 491 |
| file-history-snapshot | 210 |
| queue-operation | 8 |
| summary | 3 |
| system | 2 |

**Session 43858ada-91c2-4f63-90c7-ffa8dae8a149**:
| Type | Count |
|------|-------|
| assistant | 623 |
| user | 496 |
| file-history-snapshot | 241 |
| queue-operation | 2 |

### 8.2 stop_reason Value Counts by Session

**Session 2dd55926-505e-4a0b-bc2b-35211c9a6081**:
| stop_reason | Count |
|-------------|-------|
| null | 1168 |
| tool_use | 369 |
| end_turn | 100 |

**Session 59d9022a-1e03-4856-9c1a-5157f8907dfb**:
| stop_reason | Count |
|-------------|-------|
| null | 1169 |
| tool_use | 81 |
| end_turn | 3 |

**Session 5e1bfc04-f109-436b-a4cd-a7608e81338e**:
| stop_reason | Count |
|-------------|-------|
| tool_use | 652 |
| end_turn | 162 |
| stop_sequence | 2 |

**Session cd3c64cc-6046-42ac-8b2f-c2ee3727ef34**:
| stop_reason | Count |
|-------------|-------|
| tool_use | 483 |
| end_turn | 327 |

**Session 43858ada-91c2-4f63-90c7-ffa8dae8a149**:
| stop_reason | Count |
|-------------|-------|
| tool_use | 332 |
| end_turn | 291 |

### 8.3 Content Block Type Counts

**Assistant Content Blocks (Session 1)**:
| Type | Count |
|------|-------|
| tool_use | 856 |
| text | 424 |
| thinking | 357 |

**User Content Blocks (Session 1, array content only)**:
| Type | Count |
|------|-------|
| tool_result | 856 |
| text | 235 |

### 8.4 Tool Name Distribution (Session 1)

| Tool | Count |
|------|-------|
| Bash | 472 |
| Read | 147 |
| Write | 109 |
| Edit | 64 |
| WebSearch | 19 |
| BashOutput | 17 |
| TodoWrite | 12 |
| KillShell | 6 |
| WebFetch | 4 |
| Task | 2 |
| Glob | 2 |
| mcp__context7__resolve-library-id | 1 |
| Grep | 1 |

### 8.5 Model Distribution

| Session | Model | Count |
|---------|-------|-------|
| 1 | claude-sonnet-4-5-20250929 | 1637 |
| 3 | claude-sonnet-4-5-20250929 | 814 |
| 3 | \<synthetic\> | 2 |
| 5 | claude-sonnet-4-5-20250929 | 623 |

---

## 9. Implementation Recommendations

### 9.1 Session Cloning

When cloning a session:
1. Generate new UUIDs for all entries
2. Update `parentUuid` references to maintain chain
3. Update `sessionId` field in all entries (including `queue-operation`)
4. Update `messageId` in `file-history-snapshot` entries
5. Update `leafUuid` in `summary` entries
6. Preserve `logicalParentUuid` in `system` compact_boundary entries (update if needed)

### 9.2 Tool Call Removal

To remove tool calls:
1. Remove `tool_use` blocks from assistant `message.content`
2. Remove corresponding user entries that have only `tool_result` content
3. Update UUID chain to skip removed entries
4. Recalculate `stop_reason` if all tool_use blocks removed from an entry

### 9.3 Thinking Block Removal

To remove thinking blocks:
1. Filter out `thinking` type blocks from assistant `message.content`
2. Preserve `text` and `tool_use` blocks
3. No UUID chain changes needed

### 9.4 Context Compression

To compress older turns:
1. Identify turn boundaries using algorithm in Section 4
2. Create `summary` entries for compressed content
3. Keep recent turns intact
4. Update UUID chain appropriately

---

## 10. Appendix: TypeScript Type Definitions

```typescript
// Entry Types
type EntryType = 'user' | 'assistant' | 'file-history-snapshot' |
                 'queue-operation' | 'summary' | 'system';

// Base Entry (common fields)
interface BaseEntry {
  type: EntryType;
}

// User Entry
interface UserEntry extends BaseEntry {
  type: 'user';
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  version: string;
  cwd: string;
  gitBranch: string;
  userType: 'external';
  isSidechain: boolean;
  message: UserMessage;
  thinkingMetadata?: ThinkingMetadata;
  toolUseResult?: ToolUseResult;
  isMeta?: boolean;
}

interface UserMessage {
  role: 'user';
  content: string | ContentBlock[];
}

interface ThinkingMetadata {
  level: 'none' | 'high';
  disabled: boolean;
  triggers: ThinkingTrigger[];
}

interface ThinkingTrigger {
  start: number;
  end: number;
  text: string;
}

type ToolUseResult = ToolUseResultObject | string | unknown[] | null;

interface ToolUseResultObject {
  type: 'text' | 'create' | 'update' | null;
  file?: FileResult;
}

interface FileResult {
  filePath: string;
  content: string;
  numLines: number;
  startLine: number;
  totalLines: number;
}

// Assistant Entry
interface AssistantEntry extends BaseEntry {
  type: 'assistant';
  uuid: string;
  parentUuid: string;
  sessionId: string;
  timestamp: string;
  version: string;
  cwd: string;
  gitBranch: string;
  userType: 'external';
  isSidechain: boolean;
  message: AssistantMessage;
  requestId: string;
  isApiErrorMessage?: boolean;
}

interface AssistantMessage {
  id: string;
  model: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: Usage;
  context_management: { applied_edits: unknown[] } | null;
  container?: null;
}

interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  service_tier: 'standard' | null;
  cache_creation: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  server_tool_use?: {
    web_search_requests: number;
    web_fetch_requests: number;
  };
}

// Content Blocks
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature: string;
}

// File History Snapshot Entry
interface FileHistorySnapshotEntry extends BaseEntry {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: Snapshot;
  isSnapshotUpdate: boolean;
}

interface Snapshot {
  messageId: string;
  trackedFileBackups: Record<string, FileBackup>;
  timestamp: string;
}

interface FileBackup {
  backupFileName: string | null;
  version: number;
  backupTime: string;
}

// Queue Operation Entry
interface QueueOperationEntry extends BaseEntry {
  type: 'queue-operation';
  operation: 'enqueue' | 'remove';
  timestamp: string;
  content: string;
  sessionId: string;
}

// Summary Entry
interface SummaryEntry extends BaseEntry {
  type: 'summary';
  summary: string;
  leafUuid: string;
}

// System Entry
interface SystemEntry extends BaseEntry {
  type: 'system';
  subtype: 'compact_boundary' | 'informational';
  content: string;
  uuid: string;
  parentUuid: string | null;
  logicalParentUuid?: string;
  timestamp: string;
  level: 'info' | 'suggestion';
  isMeta: boolean;
  sessionId: string;
  version: string;
  cwd: string;
  gitBranch: string;
  userType: 'external';
  isSidechain: boolean;
  compactMetadata?: CompactMetadata;
}

interface CompactMetadata {
  trigger: 'manual';
  preTokens: number;
}

// Union type for all entries
type SessionEntry =
  | UserEntry
  | AssistantEntry
  | FileHistorySnapshotEntry
  | QueueOperationEntry
  | SummaryEntry
  | SystemEntry;
```

---

*End of Specification Document*
