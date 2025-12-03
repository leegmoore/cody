## Executive Summary

- Claude Code sessions are newline-delimited JSON (JSONL), each line an independent entry with a `type` and (for messages) a `message` object.
- Primary entry types observed: `user`, `assistant`, `queue-operation`, `file-history-snapshot`, `summary`, and `system`. All appear stable across sessions; no custom per-project types observed.
- Tool calling is modeled via content blocks: `assistant` entries emit `tool_use` blocks; `user` entries return `tool_result` blocks. Across all five sessions, tool uses and results pair 1:1 with no orphans.
- Streaming is represented by multiple entries sharing the same `message.id`. Intermediate chunks typically have `stop_reason: null`; finals show a non-null `stop_reason` (e.g., `end_turn` or `tool_use`), or are the last entry for that `message.id`.
- Turn boundaries are best inferred by user messages containing human `text` blocks (new turn start) and assistant `stop_reason: "end_turn"` (turn end). When `end_turn` is absent, the next user `text` message implicitly ends the turn.
- The `uuid`/`parentUuid` chain generally points to the immediately previous entry, with rare deviations. Non-message entries also participate in the chain; occasional gaps exist but are limited.
- Content blocks observed and their shapes: `text` {text}, `tool_use` {id, name, input}, `tool_result` {tool_use_id, content, is_error?}, `thinking` {thinking, signature}. `thinking` appears in sessions using the Opus family.
- Other operational entries: `file-history-snapshot` captures per-message file tracking; `queue-operation` records queued items; `summary` stores generated summaries; `system` records internal events/errors with retry/cause metadata.

## Session Inventory

| Session ID | Line count | Entry type breakdown | Turn count | Tool call count | Notable characteristics |
|---|---:|---|---:|---:|---|
| c98ff872-5542-4975-bdc0-a170c6dfeff8 | 523 | file-history-snapshot 88, user 206, assistant 217, queue-operation 12 | 20 | 123 | Model: claude-sonnet-4-5-20250929; stop_reason: end_turn 19, tool_use 83, stop_sequence 1; content: text 114, tool_use 123, tool_result 123 |
| 64aaff1e-8289-494e-b6c4-eaf0c77d0f4e | 416 | summary 260, file-history-snapshot 32, user 55, assistant 67, queue-operation 2 | 1 | 12 | Model: claude-opus-4-5-20251101; thinking 29; stop_reason: tool_use 5; content: text 27, tool_use 12, tool_result 12, thinking 29 |
| 3605c8ff-1765-40c3-952a-d03ef353e7fa | 414 | file-history-snapshot 15, user 132, assistant 263, queue-operation 4 | 1 | 116 | Model: claude-opus-4-5-20251101; thinking 117; stop_reason: tool_use 25; content: text 31, tool_use 116, tool_result 116, thinking 117 |
| 5117a753-c1be-4cc2-999c-f3036fb6f9f3 | 408 | summary 28, file-history-snapshot 59, user 142, assistant 165, queue-operation 4, system 10 | 1 | 86 | Model: claude-sonnet-4-5-20250929; stop_reason: end_turn 58, tool_use 106, stop_sequence 1; content: text 78, tool_use 86, tool_result 86, thinking 2 |
| 12b19743-c72c-4e41-aa91-08ae8c1e08fd | 408 | summary 1, file-history-snapshot 46, user 169, assistant 188, queue-operation 2, system 2 | 0 | 123 | Model: claude-opus-4-5-20251101; thinking 25; stop_reason: tool_use 20, end_turn 2, stop_sequence 1; content: text 41, tool_use 123, tool_result 123, thinking 25 |

## Entry Type Specifications

### user
- Always observed fields (these appear in every `user` entry in all five sessions): `type`, `message`, `uuid`, `parentUuid`, `timestamp`, `sessionId`, `userType`, `version`, `isSidechain`, `cwd`, `gitBranch`.
- Optional fields observed: `isMeta`, `slug`, `thinkingMetadata`, `todos`, `toolUseResult`.
- Notes
  - `message.role` is `"user"`.
  - Users can deliver tool outputs: `message.content` may contain `tool_result` blocks instead of human `text`.
  - `parentUuid` generally points to the immediately previous entry’s `uuid`.
- Sample (truncated):

```json
{
  "type": "user",
  "sessionId": "…",
  "userType": "external",
  "cwd": "/abs/path",
  "gitBranch": "main",
  "timestamp": "2025-11-27T14:37:29.317Z",
  "uuid": "…",
  "parentUuid": "…",
  "message": {
    "id": "msg_…",
    "role": "user",
    "model": "<absent for user>",
    "content": [
      { "type": "text", "text": "…" }
      // or: { "type": "tool_result", "tool_use_id": "toolu_…", "content": "…", "is_error": false }
    ],
    "stop_reason": null,
    "stop_sequence": null,
    "usage": { "input_tokens": …, "output_tokens": …, "service_tier": "standard", "cache_creation": {…}, "cache_read_input_tokens": … }
  }
}
```

### assistant
- Always observed fields: `type`, `message`, `uuid`, `parentUuid`, `timestamp`, `sessionId`, `userType`, `version`, `isSidechain`, `cwd`, `gitBranch`.
- Notes
  - `message.role` is `"assistant"`.
  - `message.model` is set (e.g., `claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101`, rarely `<synthetic>`).
  - Tool calls appear here via `tool_use` content blocks.
  - Streaming: multiple entries share the same `message.id` with growing `usage.output_tokens`; intermediate entries often have `stop_reason: null`.
- Sample (truncated):

```json
{
  "type": "assistant",
  "sessionId": "…",
  "timestamp": "…",
  "uuid": "…",
  "parentUuid": "…",
  "message": {
    "id": "msg_…",
    "role": "assistant",
    "model": "claude-opus-4-5-20251101",
    "content": [
      { "type": "thinking", "thinking": "…", "signature": "…" },
      { "type": "tool_use", "id": "toolu_…", "name": "exec", "input": { "arg": "…" } }
    ],
    "stop_reason": "tool_use" | "end_turn" | null,
    "usage": { "input_tokens": …, "output_tokens": …, "service_tier": "standard", "cache_creation": {…}, "cache_read_input_tokens": … }
  }
}
```

### queue-operation
- Observed fields: `type`, `operation`, `timestamp`, `content`, `sessionId`.
- Purpose: Records queue-related actions (e.g., enqueue text/items associated with a session).
- Sample:

```json
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2025-11-27T15:50:32.781Z",
  "content": "… free-form text …",
  "sessionId": "…"
}
```

### file-history-snapshot
- Observed fields: `type`, `messageId`, `snapshot`, `isSnapshotUpdate`.
- `snapshot`: `{ messageId, trackedFileBackups: object, timestamp }`
- Purpose: Captures per-message file-state for editor context/versioning.
- Sample:

```json
{
  "type": "file-history-snapshot",
  "messageId": "uuid-…",
  "isSnapshotUpdate": false,
  "snapshot": {
    "messageId": "uuid-…",
    "trackedFileBackups": {},
    "timestamp": "2025-11-24T23:58:39.166Z"
  }
}
```

### summary
- Observed fields: `type`, `summary`, `leafUuid`.
- Purpose: Generated conversation summary anchored at a particular `leafUuid` in the message graph.
- Sample:

```json
{ "type": "summary", "summary": "…", "leafUuid": "…" }
```

### system
- Observed fields (union across sessions): `type`, `timestamp`, `sessionId`, `uuid`, `parentUuid`, `userType`, `version`, `isSidechain`, `cwd`, `gitBranch`, and either:
  - error-mode: `level`, `subtype`, `error`, `cause`, `retryAttempt`, `retryInMs`, `maxRetries`, or
  - content-mode: `content` (free-form).
- Purpose: Internal system events, errors, or retries related to session processing.
- Sample (error-mode):

```json
{
  "type": "system",
  "timestamp": "…",
  "uuid": "…",
  "parentUuid": "…",
  "sessionId": "…",
  "level": "error",
  "subtype": "retry_scheduled",
  "error": "…",
  "cause": "…",
  "retryAttempt": 1,
  "retryInMs": 1500,
  "maxRetries": 3
}
```

## Message Structure Deep Dive

- Roles observed: `"user"`, `"assistant"`.
- Model values (assistant): `"claude-sonnet-4-5-20250929"`, `"claude-opus-4-5-20251101"`, occasionally `"<synthetic>"`.
- `message.id`: an opaque `"msg_…"`. Multiple entries may share an id for streaming; later entries carry higher `usage.output_tokens` and eventual non-null `stop_reason`.
- `stop_reason` values observed: `null`, `"tool_use"`, `"end_turn"`, `"stop_sequence"`.
- `stop_sequence`: present but rare; indicates a custom stop token matched.
- `content` block types and shapes:
  - `text`: `{ type: "text", text: string }`
  - `tool_use`: `{ type: "tool_use", id: "toolu_…", name: string, input: object }`
  - `tool_result`: `{ type: "tool_result", tool_use_id: "toolu_…", content: string|object, is_error?: boolean }`
  - `thinking`: `{ type: "thinking", thinking: string, signature: string }`
- `usage` keys observed: `input_tokens`, `output_tokens`, `service_tier`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `cache_creation` with ephemeral buckets; present mainly on assistant responses.

## Turn Detection Algorithm (pseudocode)

```pseudo
turns = []
inTurn = false
current = null

for each entry in session:
  if entry.type in {user, assistant} and entry.message exists:
    blocks = entry.message.content (array)
    hasUserText = (entry.message.role == "user") and any(block.type == "text" and block.text.trim() != "")
    isOnlyToolResults = (entry.message.role == "user") and blocks.length > 0 and all(block.type == "tool_result")

    if hasUserText:
      if inTurn:
        close current (end at previous entry)
      open new current turn (startIndex = i)
      inTurn = true

    if inTurn and entry.message.role == "assistant":
      for block in blocks:
        if block.type == "tool_use": record tool_use for this turn
      if entry.message.stop_reason == "end_turn":
        close current (endIndex = i); inTurn = false

    if inTurn and isOnlyToolResults:
      for block in blocks:
        if block.type == "tool_result": record tool_result for this turn

if inTurn: close current at final entry
```

Heuristics notes:
- New turn starts when a `user` message contains a non-empty `text` block.
- Turn ends on `assistant.stop_reason == "end_turn"` or implicitly when the next user `text` arrives.
- `user` messages containing only `tool_result` blocks are part of the ongoing turn, not a new turn.

## Tool Call Pairing Algorithm (pseudocode)

```pseudo
toolUseById = {}   // id -> assistant message id
toolResultById = {} // id -> array of result entries (rarely >1)

for each assistant entry:
  for block in entry.message.content:
    if block.type == "tool_use":
      toolUseById[block.id] = entry.message.id

for each user entry:
  for block in entry.message.content:
    if block.type == "tool_result":
      append block to toolResultById[block.tool_use_id]

paired = []
orphans_tool_use = []
orphans_tool_result = []

for id in union(keys(toolUseById), keys(toolResultById)):
  if id in toolUseById and id in toolResultById:
    paired.push({ id, assistantMessageId: toolUseById[id], results: toolResultById[id] })
  else if id in toolUseById:
    orphans_tool_use.push(id)
  else:
    orphans_tool_result.push(id)
```

Empirically, all five sessions had 1:1 pairing (no orphans).

## Message Deduplication (final message selection)

Goal: For a given `message.id`, pick the “final” version among streaming chunks.

Algorithm:
- Group entries by `message.id`.
- If any entry has non-null `stop_reason`, choose the last such entry (max index).
- Otherwise choose the last entry by occurrence index (highest `lastIndex`).
- Optional tie-breakers:
  - Prefer the one with largest `usage.output_tokens`.
  - Prefer the one with the most complete `content` (e.g., no partial deltas).

## UUID Chain Analysis

- Fields: `uuid`, `parentUuid` present on user/assistant/system entries; other types sometimes omit one or both.
- Patterns observed (per session):
  - c98ff872…: `parentUuidEqualsPrevCount: 422` (near-total); small non-matching count (1).
  - 64aaff1e…: `parentUuidEqualsPrevCount: 121`; non-matching 1.
  - 3605c8ff…: `parentUuidEqualsPrevCount: 394`; non-matching 1.
  - 5117a753…: `parentUuidEqualsPrevCount: 315`; non-matching 2.
  - 12b19743…: `parentUuidEqualsPrevCount: 357`; non-matching 2.
- Interpretation:
  - The chain generally points to the immediately previous entry; isolated deviations likely correspond to interleaved non-message entries or out-of-band internal events.
  - `uuid: null` was not observed; `parentUuid` null seen rarely.

## Cross-Session Patterns

- Consistent structures: `user` and `assistant` message envelopes; content block types and keys; tool-use/result pairing; `usage` metrics.
- Variations:
  - Models differ (`sonnet-4-5-20250929` vs `opus-4-5-20251101`), with `thinking` blocks mainly appearing in Opus sessions.
  - `end_turn` prevalence varies; some sessions rely more on implicit boundaries + tool loops.
  - Operational entries (`summary`, `system`, `queue-operation`) present in varying quantities depending on workflow.
  - `stop_sequence` appears but is rare.
- Streaming:
  - Multiple entries per `message.id` are common for assistant responses; intermediate chunks have `stop_reason: null` and smaller `output_tokens`.
  - Finalization detection via non-null `stop_reason` or simply the last chunk works across all five sessions.

## Caveats and Edge Cases

- Turn detection depends on user `text` presence; sessions with tool-only interactions (no fresh user text) can yield `turns.count = 0` despite heavy tool usage.
- Some `system` entries use `content` instead of `error`/`cause` fields; treat these as optional variants of the same type.
- Rare `parentUuid` mismatches exist; do not assume a perfect singly-linked list across all entry types.
- `stop_reason: "stop_sequence"` is uncommon; treat it as a valid terminal reason.
- Tool usage can include multiple `tool_use` blocks within a single assistant message and multiple `tool_result` blocks within a single user message.

## Raw Data

### c98ff872-5542-4975-bdc0-a170c6dfeff8
- Entry types:

```json
{ "file-history-snapshot": 88, "user": 206, "assistant": 217, "queue-operation": 12 }
```

- stop_reason:

```json
{ "end_turn": 19, "tool_use": 83, "stop_sequence": 1 }
```

- content blocks:

```json
{ "text": 114, "tool_use": 123, "tool_result": 123 }
```

### 64aaff1e-8289-494e-b6c4-eaf0c77d0f4e
- Entry types:

```json
{ "summary": 260, "file-history-snapshot": 32, "user": 55, "assistant": 67, "queue-operation": 2 }
```

- stop_reason:

```json
{ "tool_use": 5 }
```

- content blocks:

```json
{ "thinking": 29, "text": 27, "tool_use": 12, "tool_result": 12 }
```

### 3605c8ff-1765-40c3-952a-d03ef353e7fa
- Entry types:

```json
{ "file-history-snapshot": 15, "user": 132, "assistant": 263, "queue-operation": 4 }
```

- stop_reason:

```json
{ "tool_use": 25 }
```

- content blocks:

```json
{ "thinking": 117, "text": 31, "tool_use": 116, "tool_result": 116 }
```

### 5117a753-c1be-4cc2-999c-f3036fb6f9f3
- Entry types:

```json
{ "summary": 28, "file-history-snapshot": 59, "user": 142, "assistant": 165, "queue-operation": 4, "system": 10 }
```

- stop_reason:

```json
{ "end_turn": 58, "tool_use": 106, "stop_sequence": 1 }
```

- content blocks:

```json
{ "text": 78, "tool_use": 86, "tool_result": 86, "thinking": 2 }
```

### 12b19743-c72c-4e41-aa91-08ae8c1e08fd
- Entry types:

```json
{ "summary": 1, "file-history-snapshot": 46, "user": 169, "assistant": 188, "queue-operation": 2, "system": 2 }
```

- stop_reason:

```json
{ "tool_use": 20, "end_turn": 2, "stop_sequence": 1 }
```

- content blocks:

```json
{ "thinking": 25, "text": 41, "tool_use": 123, "tool_result": 123 }
```


