## Phase 7 – Client Stream Manager Test Conditions

### TC-CSM-1: Multi-worker SSE (Redis)
1. Start two Fastify instances pointing at the same Redis.
2. Create a conversation + turn.
3. Subscribe to `/turns/:id/stream-events` from worker A and worker B simultaneously.
4. Expect identical event ordering and IDs; neither worker should miss events.

### TC-CSM-2: Resume After Refresh
1. Start a long-running turn.
2. Stream from worker A until the first three events arrive, capture `Last-Event-ID`.
3. Reconnect with the header; expect the stream to resume at event N+1 with no duplicates.

### TC-CSM-3: Concurrent Subscribers with Decorators
1. Start two streams for the same turn:
   - Stream A: `toolFormat=full`, `thinkingFormat=full`.
   - Stream B: `toolFormat=none`, `thinkingFormat=summary`.
2. Verify Stream B hides tool events and emits only `thinking_started/completed`; Stream A shows full payloads.

### TC-CSM-4: Tool Failure Surfaces Error
1. Ask the agent to run a deterministic failing tool (e.g., read non-existent file).
2. Expect a `tool_completed` event with `status=failed`, followed by `error` and `turn_aborted`.
3. `/turns/:id` should report `status=error` and include the failure details.

### TC-CSM-5: Step & Thinking Events
1. Run a tool-heavy turn (multiple tools + reasoning).
2. Expect interleaved `tool_call_begin`, `tool_call_end`, `thinking_started`, `thinking_delta`, `thinking_completed`.
3. Confirm `step_completed` timestamps align with tool end times.

### TC-CSM-6: Redis Persistence Across Restart
1. Start a turn, stream a few events, then stop Fastify (leave Redis running).
2. Restart Fastify and resume streaming with the old `Last-Event-ID`.
3. Expect no data loss; `/turns/:id` still returns the full history.

### TC-CSM-7: Backpressure & Batching
1. Simulate slow SSE client (read every 2s).
2. Ensure server continues to buffer via Redis without dropping events; once client catches up, ordering remains intact.

