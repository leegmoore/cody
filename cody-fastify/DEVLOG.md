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

## 2025-11-21 - Phase 2

### Completed
- [x] Reworked Convex schema, queries, and mutations for Core 2.0 `messages` persistence plus legacy compatibility bridge.
- [x] Hardened `ResponseReducer` for idempotent replay handling and mid-stream buffering.
- [x] Added Convex persistence writer, Redis consumer group worker, and background projector entrypoint.
- [x] Extended pipeline verifier to spawn the persistence worker and validate Convex snapshots.
- [x] Ran `bun run lint` and `bun run build` after refactor set.

### Challenges
- Resolving Convex type regressions while migrating legacy message projections to the new schema.
- Normalizing loosely-typed OpenAI Responses payloads without sacrificing strict TypeScript coverage.

### Design Decisions
- Introduced a Redis consumer-group-based projector worker to guarantee at-least-once persistence with reclaim logic for stuck deliveries.
- Added helper guards (`asObject`, `getString`) to centralize adapter payload parsing and protect against schema drift.

### Next Steps
- Run `bun run verify:pipeline` with valid API credentials to exercise the full Redis → Convex persistence loop locally.
- Expand integration coverage to include SSE hydration once Projector is stable.

## 2025-11-22 - Phase 3

### Completed
- [x] Added `/api/v2/submit` Fastify route that launches the OpenAI stream adapter with request trace propagation.
- [x] Implemented `/api/v2/stream/:runId` SSE bridge with Redis tailing and OpenTelemetry span linkage per event.
- [x] Created `RunStreamClient` helper to manage SSE subscriptions (keep-alives, reconnects, graceful shutdown).
- [x] Wrote `scripts/verify_sse.ts` to exercise the new API flow end-to-end (submit + SSE drain).
- [x] Updated server registration and dependencies (`eventsource`) for the v2 surface plus bun lockfiles.

### Challenges
- Coordinating OpenTelemetry context across async Fastify request boundaries while streaming out of band.
- Ensuring SSE clients receive consistent event ordering and reconnect cursors using Redis stream IDs.

### Design Decisions
- Background the adapter run while returning `runId` immediately, logging adapter failures but surfacing initialization errors synchronously.
- Reused the canonical `StreamEvent` schema for SSE validation (server and client helper) to avoid drift.
- Defaulted verification prompt and base URL via env but kept script runnable against localhost without additional flags.

### Next Steps
- Integrate frontend UI against `RunStreamClient` to hydrate the live reducer once ready.
- Capture Langfuse trace IDs inside verification tooling once credentials are wired into the environment.

## 2025-11-22 - Phase 4

### Completed
- [x] Implemented `ToolWorker` with Redis consumer-group loops, function call dispatch, and QuickJS-backed script execution output handling.
- [x] Added `run_tool_worker.ts` entrypoint with observability bootstrapping and graceful shutdown.
- [x] Built `AnthropicStreamAdapter` mapping Messages API SSE events into canonical `StreamEvent`s.
- [x] Updated `/submit` route to select OpenAI vs Anthropic adapters based on `providerId`.
- [x] Created `scripts/verify_tools.ts` to spawn the tool worker, enqueue a synthetic function call, and assert the resulting `function_call_output`.

### Challenges
- Translating Anthropic streaming deltas for `thinking`, `text`, and `tool_use` blocks into our unified event model without official typings.
- Adapting the script harness APIs from `codex-ts` to run inside the new worker while maintaining deterministic tool budgets and error reporting.
- Ensuring idempotent handling of function call completions across Redis re-deliveries during worker startup/shutdown.

### Design Decisions
- Reused the legacy `toolRegistry` via a thin adapter to share tool definitions across structured calls and script execution.
- Defaulted the tool worker to auto-approve tools; approvals can be layered later once UI hooks exist.
- Captured Anthropic usage metrics when available but kept finish reasons and fallbacks tolerant of partial payloads.

### Next Steps
- Extend the tool worker to emit per-tool progress events for script harness invocations.
- Add verification coverage for Anthropic streaming once provider credentials are available.
- Integrate approval plumbing so dangerous tools require explicit confirmation before execution.
