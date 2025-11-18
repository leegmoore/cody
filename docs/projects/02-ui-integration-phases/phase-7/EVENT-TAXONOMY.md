# Phase 7 – Client Stream Event Taxonomy

## SSE Query Parameters

Endpoint: `/api/v1/turns/:turnId/stream-events`

| Query Param | Values | Default | Notes |
| --- | --- | --- | --- |
| `thinkingLevel` | `none` \| `full` | `full` | Back-compat flag. |
| `toolLevel` | `none` \| `full` | `none` | Back-compat flag. |
| `thinkingFormat` | `none` \| `summary` \| `full` | `full` unless `thinkingLevel=none` | `summary` omits deltas but keeps start/end. |
| `toolFormat` | `none` \| `summary` \| `full` | `none` unless `toolLevel=full` | `summary` emits start/end metadata only. |

`thinkingFormat/toolFormat` supersede the old `thinkingLevel/toolLevel` flags but remain backwards compatible.

## Event Types

### Native Codex Events (subset)

- `task_started`
- `task_complete`
- `agent_message`, `agent_message_delta`
- `agent_reasoning`, `agent_reasoning_delta`
- `exec_command_begin`, `exec_command_end`, `exec_command_output_delta`
- `mcp_tool_call_begin`, `mcp_tool_call_end`
- `error`, `turn_aborted`

### Client Stream Synthetic Events

| Event | Payload | Description |
| --- | --- | --- |
| `tool_call_begin` | `callId`, `toolName`, optional `arguments` | Mirrors Codex `function_call`. Arguments included only when `toolFormat=full`. |
| `tool_call_end` | `callId`, `status`, optional `output` | Mirrors `function_call_output`. Output included only when `toolFormat=full`. |
| `ts_exec_begin` | `execId`, optional `label`, optional `source` | Placeholder for Phase 03 scripting sandbox start. |
| `ts_exec_end` | `execId`, `status`, optional `output` | Placeholder for Phase 03 scripting sandbox completion. |
| `thinking_started` | `thinkingId` | Emitted when a reasoning block starts. |
| `thinking_delta` | `thinkingId`, `delta` | Streaming reasoning text; omitted when `thinkingFormat=summary`. |
| `thinking_completed` | `thinkingId`, `text` | Emitted when the reasoning block finishes (or the turn completes). |

### Inclusion Rules

- `toolFormat="none"` suppresses both native tool events and synthetic tool/step events.
- `toolFormat="summary"` emits `tool_call_*`/`ts_exec_*` without arguments/output payloads.
- `toolFormat="full"` emits the same events with arguments/output.
- `thinkingFormat="none"` removes all reasoning + thinking events.
- `thinkingFormat="summary"` keeps only `thinking_started`/`thinking_completed`; `thinking_delta` is omitted.
- `thinkingFormat="full"` streams every delta plus the start/end wrappers.

## Last-Event-ID Semantics

- SSE `id` header uses the pattern `<turnId>:<sequence>`, where `sequence` is the Redis sorted-set score.
- Clients should send `Last-Event-ID` using the same format; the server parses the numeric tail and performs `ZRANGEBYSCORE (seq +inf`.

## Turn Record Enhancements

The persisted `TurnRecord` now tracks:

- `activeThinkingId`: identifier for the currently streaming reasoning block.
- `pendingThinkingText`: aggregated text for the active block (used when emitting `thinking_completed` after stream flush or turn completion).

These fields are internal to the stream manager and are not exposed by the REST API.

