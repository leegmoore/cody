# Developer Log

## 2025-11-20 - Phase 1

### Completed
- [x] Read and internalized Core 2.0 design docs (tech design, as-is, enhancement 02).
- [x] Defined canonical schemas (Response, OutputItem, StreamEvent) in `cody-fastify`.
- [x] Added typed Redis stream wrapper using Bun native client.
- [x] Implemented initial OpenAI Responses adapter → Redis event pipe.
- [x] Added verification script to exercise adapter and stream tail.
- [x] Cleaned existing ESLint errors/warnings across legacy files.
- [x] Added reducer and SSE bridge route (`/api/v1/runs/:id/events`).
- [x] Added projector scaffold + Convex mutation for run snapshots; scripts for projector.
- [x] Extended OpenAI adapter to handle function_call chunks.
- [x] Added worker-friendly projector (`runProjectorForRun`) and Convex store pathway (`messages:projectRunSnapshot`), plus Convex index on callId.

### Challenges
- Bun runtime is not installed in this environment; relied on type stubs and conservative Redis command usage.
- OpenAI Responses API streaming format is partially inferred; adapter uses safe heuristics and validation.
- Langfuse keys not present yet; tracing context generation implemented without external provider.

### Design Decisions
- Kept Redis wrapper minimal (XADD/XREAD only) with JSON-encoded `event` field to keep parsing predictable.
- Trace context generated locally (W3C traceparent format) to satisfy contract without external dependencies.
- Verification script logs and cleans up stream key; warns when Langfuse keys are absent.

### Next Steps
- Run `bun install` to ensure Bun + bun:redis types available and validate adapter end-to-end.
- Wire projector/SSE consumers to new stream events.
- Expand adapter to cover function calls and richer Responses API events once Bun runtime is available.
