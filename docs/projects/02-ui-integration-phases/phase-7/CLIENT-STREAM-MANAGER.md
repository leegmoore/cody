## Client Stream Manager (Redis) — Design Draft

### Goals

- Provide a single source of truth for turn/step streaming that supports multiple Fastify workers.
- Persist all turn metadata and events in Redis so SSE resume (`Last-Event-ID`) works after restarts.
- Offer decorators/adapters so clients can request different tool/thinking formats without recomputing history.
- Lay the groundwork for future notifier endpoints (websocket/webhook) that can tap into the same stream.

### Data Model

| Key | Type | Notes |
| --- | --- | ----- |
| `cs:turn:<turnId>:meta` | JSON string | Serialized `TurnRecord` (status, timestamps, result, thinking summary, toolCalls, provider). Updated atomically per event. |
| `cs:turn:<turnId>:events` | Sorted Set | Members are serialized `StreamEvent` objects. Score is the monotonically increasing event sequence. |
| `cs:turn:<turnId>:seq` | Integer | Next event sequence number. Incremented via `INCR`. |
| `cs:conv:<conversationId>:turns` | List | Optional helper for listing all turns under a conversation (used for cleanup). |
| `cs:turn:<turnId>:ttl` | Expiring key | Optional TTL marker so finished turns can be cleaned up after N hours. |

All keys share a `cs:` prefix (“client stream”). TTL defaults: 24h after `task_complete`/`turn_aborted` unless an override is provided.

### Event Flow

1. `createTurn` writes the initial metadata entry (`status=running`, `startedAt`, etc.) and seeds `seq=0`.
2. Each call to `addEvent`:
   - `INCR cs:turn:<id>:seq` to get the next sequence.
   - Apply the event to a cloned `TurnRecord` (just like the legacy in-memory logic) and overwrite `meta`.
   - `ZADD cs:turn:<id>:events seq serializedEvent`.
3. `getEvents(turnId, fromSeq)` uses `ZRANGEBYSCORE key (fromSeq +inf` to fetch events after the supplied sequence.
4. SSE IDs adopt the `<turnId>:<seq>` format, matching the persisted score so `Last-Event-ID` parsing is trivial.

### Decorators / Formats

The manager exposes `buildStream(options)` that accepts:

- `toolFormat`: `none | summary | full`
- `thinkingFormat`: `none | summary | full`
- `stepFormat`: `summary | full`

Decorators run after events are fetched from Redis but before SSE writes:

- **Tool format**
  - `none`: hide tool-specific events entirely.
  - `summary`: expose tool metadata (name, callId, status) but elide arguments/output payloads.
  - `full`: include raw inputs/outputs.
- **Thinking format**
  - `none`: suppress `thinking_started`, `thinking_delta`, `thinking_completed`.
  - `summary`: emit only `thinking_started/completed` with aggregated text.
  - `full`: forward every reasoning delta.

### Thinking & Step Events

- When the first reasoning delta for a block arrives, emit `thinking_started`.
- Aggregate deltas per block; upon completion (`task_complete` or explicit end), emit `thinking_completed` with the summary text.
- Tool calls emit `tool_call_begin` and `tool_call_end`.
- TS sandbox steps (Phase 03) will emit `ts_exec_begin`/`ts_exec_end`.
- Legacy events (`agent_message`, `exec_command_*`) continue to ship for backwards compatibility until clients migrate.

### Multi-worker & Resume

- All state lives in Redis, so any Fastify instance can service `/turns/:id` or SSE requests.
- `Last-Event-ID` uses the `<turnId>:<seq>` convention; the handler simply splits on `:` to recover the numeric sequence and performs a `ZRANGEBYSCORE`.
- For resilience, SSE handlers read in batches (e.g., 100 events) and periodically poll for new ones. No per-worker in-memory buffer is required.

### Cleanup

- When a turn reaches `completed` or `error`:
  - Set `EXPIRE cs:turn:<id>:meta <TTL>`, `cs:turn:<id>:events <TTL>`, etc.
  - Remove `turnId` from `cs:conv:<conversationId>:turns` once TTL elapses.
- Optionally expose an admin script to purge finished turns immediately or extend retention.


