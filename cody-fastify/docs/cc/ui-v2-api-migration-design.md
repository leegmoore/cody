# UI Migration to v2 API - Technical Design

**Version:** 1.1
**Status:** Design Phase
**Purpose:** Port existing vanilla JS UI from v1 API to Core 2.0 v2 API

---

## Executive Summary

- Migrate the browser UI to the Core 2.0 v2 API surface (`/api/v2/threads`, `/api/v2/submit`, `/api/v2/stream/:runId`, `/api/v2/runs/:id`) and delete every v1 dependency; there is no hybrid fallback.
- Reuse the canonical `ResponseReducer` in the browser to process StreamEvents, then render directly from the reducer's `Response.output_items` array for both live streaming and history.
- Treat tool calls uniformly as `function_call`/`function_call_output` items (including `name === "exec"`), removing the legacy `exec_command_*` UI path.
- Extend `renderResponseItems()` with explicit `error` and `cancelled` item handling so failed or cancelled runs surface clearly in the chat transcript.
- Load prior history via `GET /api/v2/threads/:id`, flattening each run's `output_items` through the same renderer used for live updates to keep a single code path and consistent visuals.

---

## Strategy

1. **Ship the full v2 API surface** in the Fastify layer (threads CRUD + run inspection) so the UI can exclusively rely on v2 terminology (`threadId`, `runId`).
2. **Bundle shared core logic** (`src/core/reducer.ts`) for browser consumption with esbuild so both server and client interpret StreamEvents identically.
3. **Unify rendering** by iterating over `Response.output_items` for every view (streams, history, tool cards, thinking blocks, error states) instead of mapping v2 events back to bespoke v1 events.
4. **Remove v1-only components** (routes, adapters, exec-command UI, “conversation” nomenclature) during the migration to reduce maintenance overhead.

---

## Current UI Architecture (v1 reference)

| File | Purpose |
|------|---------|
| `public/index.html` | Static layout (sidebar, chat surface, modals) |
| `public/js/app.js` | Lifecycle hooks, conversation management, send message |
| `public/js/stream.js` | SSE connection + event fan-out |
| `public/js/ui.js` | DOM helpers for chat bubbles, tool cards, thinking blocks |
| `public/js/state.js` | Client-side state (current conversation, event source, caches) |

The existing implementation consumes custom SSE events from `/api/v1/turns/:id/stream-events` (15 event types) and invokes specialized UI handlers (`agent_message`, `tool_call_begin`, `exec_command_*`, etc.). Conversation CRUD lives under `/api/v1/conversations*`.

---

## Target v2 API Surface

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `POST /api/v2/threads` | Create a thread | Returns `{threadId}` plus metadata |
| `GET /api/v2/threads` | List threads | Supports pagination + sorting |
| `GET /api/v2/threads/:id` | Fetch thread metadata + `runs: Response[]` | Each run contains `output_items` snapshot |
| `PATCH /api/v2/threads/:id` | Update title/metadata | Optional for UI MVP |
| `DELETE /api/v2/threads/:id` | Remove a thread | Soft-delete semantics |
| `POST /api/v2/submit` | Start a run inside a thread | Returns `{runId}` |
| `GET /api/v2/stream/:runId` | SSE stream of canonical StreamEvents | Input to `ResponseReducer` |
| `GET /api/v2/runs/:id` | Inspect a run outside of streaming | Used for retries/debug |

All UI code will call only these endpoints; v1 routes are removed after this migration.

---

## Migration Challenges & Solutions

1. **Event schema mismatch → ResponseReducer snapshots**: Canonical StreamEvents (`response_start`, `item_*`, `response_*`) ship lower-level deltas than the UI currently expects. By bundling and instantiating the shared `ResponseReducer` in the browser, every SSE payload is applied to the reducer and the UI simply renders the resulting `Response` object. This eliminates bespoke adapters and guarantees parity with the server implementation that already passes 22 reducer tests.
2. **Tool call modeling (including `exec`)**: v1 differentiated `tool_call_*` and `exec_command_*`. In v2, everything—including shell execution—is delivered as `function_call`/`function_call_output` items. The UI now inspects `item.name` (`exec`, `readFile`, etc.) for styling, but does not branch on separate event types.
3. **Failure/cancellation visibility**: New canonical events `item_error`, `item_cancelled`, `response_error`, and `response_status === 'error'|'cancelled'` need UI affordances. We extend `renderResponseItems()` to include `error`/`cancelled` cards so partial failures or user cancellations are rendered inline instead of silently dropping.
4. **History hydration without v1 conversations**: `GET /api/v2/threads/:id` returns an ordered array of runs, each already shaped like a `Response`. We flatten `runs.flatMap(run => run.output_items)` (preserving run grouping for timestamps) and run them through the same renderer used during streaming, ensuring history and live views stay in sync.

---

## Technical Design

### Client-Side Streaming Pipeline

```
EventSource (/api/v2/stream/:runId)
  ↓ StreamEvent (response_start, item_delta, ...)
ResponseReducer.apply(event)
  ↓
Reducer snapshot(): Response
  ↓
renderResponseItems(Response.output_items)
```

Implementation notes:
- `ResponseReducer` is bundled for browsers via esbuild (`scripts/bundle-client-libs.ts`) and imported as `import {ResponseReducer} from './reducer.bundle.js';`.
- Every new run instantiates a fresh reducer. Incoming SSE payloads are parsed JSON objects passed directly to `reducer.apply(event)`.
- After each apply, the UI calls `const response = reducer.snapshot();` and paints from `response.output_items` plus `response.status`/`response.error`.

### Bundling `ResponseReducer`

```ts
// scripts/bundle-client-libs.ts
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/core/reducer.ts'],
  outfile: 'public/js/reducer.bundle.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  sourcemap: process.env.NODE_ENV !== 'production'
});
```

`package.json` gains `"build:client": "bun run scripts/bundle-client-libs.ts"`, and the dev server ensures the bundle exists (watch mode or prebuild).

### `renderResponseItems()`

```ts
function renderResponseItems(items, {threadId, runId}) {
  items.forEach((item) => {
    switch (item.type) {
      case 'message':
        renderAgentMessage(item.id, item.content, {runId});
        break;
      case 'reasoning':
        renderThinkingBlock(item.id, item.content, {collapsed: item.completed});
        break;
      case 'function_call':
        renderToolCallStart({
          callId: item.call_id,
          name: item.name,
          args: safeJSONParse(item.arguments),
          isExec: item.name === 'exec'
        });
        break;
      case 'function_call_output':
        renderToolCallResult({
          callId: item.call_id,
          output: item.output,
          success: item.success
        });
        break;
      case 'error':
        renderErrorCard({
          id: item.id,
          title: item.label || 'Run failed',
          message: item.error?.message,
          runId
        });
        break;
      case 'cancelled':
        renderCancelledCard({
          id: item.id,
          reason: item.reason || 'Cancelled',
          runId
        });
        break;
    }
  });
}
```

- `item_error` and `item_cancelled` StreamEvents are normalized by the reducer into `error`/`cancelled` items so the UI can render failure or cancellation cards inline.
- No `exec_command_*` events remain; the renderer treats `name === 'exec'` just like any other function call, optionally applying shell-specific styling.

### Tool Calls

- Tool cards are keyed by `call_id` and updated as corresponding `function_call_output` items arrive.
- `exec` calls show command metadata in the same component (status badge, stdout/stderr). We remove the bespoke exec modal because the underlying data structure is identical to other telemetry.

### Thread History Loading

1. Fetch `GET /api/v2/threads/:threadId`.
2. The response payload is `{ thread: {...}, runs: Response[] }`.
3. For each run (oldest → newest), call `renderRunHeader(run)` (timestamp, duration) and then `renderResponseItems(run.output_items, {threadId, runId: run.id})`.
4. Because live streaming shares the same renderer, history automatically benefits from any future item types (e.g., images) without bespoke plumbing.

---

## API Implementation Plan

1. **Threads CRUD**: Wrap the Convex helpers with Fastify routes for create/list/get/update/delete, enforcing v2 schemas via Zod. Tests stub Convex to keep coverage.
2. **Run inspection**: Expose `GET /api/v2/runs/:id` to fetch a run's latest reducer snapshot, used for retries or reconnections.
3. **Submit endpoint**: Ensure `POST /api/v2/submit` accepts `{threadId, content, model, providerId, attachments}` and kicks off a run, returning `runId` and (optionally) the stream URL.
4. **Stream endpoint**: Continue serving canonical StreamEvents; no UI-specific branching is needed because the reducer handles everything.

---

## Implementation Phases

### Phase 1 – Server Foundations (1.5 days)
- Implement/verify all `/api/v2/threads*`, `/api/v2/runs/:id`, and `/api/v2/submit` routes.
- Add Zod schemas + tests for request/response payloads.
- Remove or mark deprecated `/api/v1/*` routes to avoid accidental usage.

### Phase 2 – Client Runtime (1.5 days)
- Bundle `ResponseReducer` for the browser and wire `public/js/stream.js` to create a reducer per run.
- Update `state.js`, `app.js`, and `ui.js` to use `threadId`/`runId` naming and the unified renderer.
- Replace legacy SSE handlers with the new `renderResponseItems()` pipeline, including error/cancelled cards and consolidated tool-call UI.

### Phase 3 – Cleanup & QA (1 day)
- Delete v1-only UI code paths (conversation lists, exec_command handlers, old CSS).
- Backfill end-to-end tests that submit a message, stream a run, and reload history via `/api/v2/threads/:id` to ensure parity between live and persisted views.
- Document the new architecture in `README.md` and update developer workflows (`npm run build:client`, etc.).

---

## Success Criteria

- UI bootstraps solely from `/api/v2/threads` and `/api/v2/threads/:id` to populate the sidebar and history.
- Sending a message calls `/api/v2/submit`, connects to `/api/v2/stream/:runId`, and renders streamed `output_items` (message, reasoning, tool calls, exec, error/cancelled) in real time.
- Reloading the page reproduces the full transcript by flattening stored runs without any v1 requests.
- Failure or cancellation events produce visible cards, and exec invocations reuse the shared tool-call cards.
- No references to `/api/v1/*`, `turnId`, or legacy exec handlers remain in the repository.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Divergence between reducer versions | Ship reducer bundle straight from `src/core/reducer.ts` and add a CI check that rebuilds it whenever the source changes. |
| Large thread histories causing re-render churn | Debounce `renderResponseItems()` or diff against the previous snapshot (based on `item.id`) to avoid re-appending unchanged DOM nodes. |
| Error/cancelled items missing metadata | Ensure server emits standardized payloads (`item.error.message`, `item.reason`); add fallback copy in renderer. |
| Tool call UI regressions | Cover `function_call`/`function_call_output` pairs (including `exec`) with Playwright smoke tests. |

---

## Next Steps

1. Finalize this design and circulate with Core + UI teams.
2. Schedule work to implement Phase 1 server endpoints (owners: backend).
3. Build the reducer bundle + client renderer, then QA streaming and history flows end-to-end.
4. Delete v1 code paths and update documentation/tooling accordingly.
