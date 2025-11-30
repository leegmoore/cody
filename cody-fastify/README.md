# Cody Fastify

Fastify-based harness for Codex Core 2.0. It exposes streaming LLM endpoints, persists run snapshots to Convex, executes tool calls, and serves a small client bundle for hydrating server-sent events (SSE).

## Architecture at a Glance
- **Fastify API (TypeScript + Zod)** – `/api/v2` routes for submit/stream/thread/run-status and a `/health` probe. Static assets are served from `public/`.
- **Model adapters** – `OpenAIStreamAdapter` (Responses API) and `AnthropicStreamAdapter` (Messages API) translate provider chunks into canonical `StreamEvent` objects and publish them to Redis Streams.
- **Redis Streams** – transport for streaming events (`codex:run:<runId>:events`) consumed by:
  - **SSE delivery** (`GET /api/v2/stream/:runId`) for clients.
  - **PersistenceWorker** to reduce streams into run snapshots and upsert into Convex.
  - **ToolWorker** to execute function calls / scripts emitted by the model and write results back to the stream.
- **Convex** – primary store for threads and run snapshots (`convex/schema.ts` defines tables `threads`, `messages`, `legacyMessages`).
- **Client stream cache (legacy /api/v1 code path)** – Redis-backed turn store for conversation/turn/message handlers; the routes exist in `src/api/routes/*` but are not currently mounted in `src/server.ts`.
- **Observability** – optional OpenTelemetry export via Traceloop/Langfuse when `LANGFUSE_PUBLIC_KEY/SECRET_KEY` are set.

## API Surface (mounted in `src/server.ts`)
- `GET /health` – liveness probe.
- `POST /api/v2/submit`  
  Body: `{ prompt: string, model?: string, providerId?: string, runId?, turnId?, threadId?, agentId? }`  
  Returns `202 { runId }`. Starts a run by streaming through the selected adapter; defaults to `providerId=openai`, `model=gpt-5-mini` unless overridden.
- `GET /api/v2/stream/:runId` – SSE endpoint. Query: `from`, `blockMs` (default 5000), `batchSize` (default 50). Emits canonical `StreamEvent` payloads with `event` set to the inner payload type.
- `GET /api/v2/runs/:id` – returns the persisted run snapshot (shape `ResponseSchema`).
- Threads (Convex-backed):
  - `GET /api/v2/threads` (pagination via `limit`, `cursor`)
  - `POST /api/v2/threads`
  - `GET /api/v2/threads/:id`
  - `PATCH /api/v2/threads/:id`
  - `DELETE /api/v2/threads/:id`

> Legacy v1 routes for conversations/messages/turns exist under `src/api/routes`, but they are **not registered** in `src/server.ts`. If you need `/api/v1` behavior (used by the Playwright specs in `tests/e2e/conversations.spec.ts`, etc.), add the registrations in `createServer` with a `/api/v1` prefix and ensure `codexRuntime` is decorated.

## Data Flow
1) Client calls **`POST /api/v2/submit`** with a prompt.  
2) The chosen adapter (OpenAI/Anthropic) streams vendor chunks, normalizes them to `StreamEvent`s, and writes them to Redis Streams.  
3) Clients consume live events via **`GET /api/v2/stream/:runId`**.  
4) **ToolWorker** listens for `function_call` events, executes tools (via `codex-ts` registry + script harness), and appends `function_call_output` events.  
5) **PersistenceWorker** reduces the stream with `ResponseReducer` and persists snapshots to Convex (`convex/messages.persist`).  
6) Run status can be fetched via **`GET /api/v2/runs/:id`**; thread metadata is available via `/api/v2/threads`.  

## Prerequisites
- **Bun ≥ 1.0** (runtime + package manager)
- **Redis** accessible at `REDIS_URL` (defaults to `redis://127.0.0.1:6379`)
- **Convex deployment** reachable via `CONVEX_URL` (required at startup; server will throw if missing)
- Provider credentials as needed:
  - `OPENAI_API_KEY` for OpenAI Responses API
  - `ANTHROPIC_API_KEY` for Anthropic Messages API
- Optional: `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` for tracing export

### Common Environment Variables (`.env.local` example)
```
PORT=4010
HOST=0.0.0.0
REDIS_URL=redis://127.0.0.1:6379
CONVEX_URL=http://127.0.0.1:3210   # or your deployed Convex URL
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
CORE2_MODEL=gpt-5-mini
CORE2_PROVIDER_ID=openai
CORE2_PROVIDER_API=responses
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
```
`CODY_HOME` is set automatically to a temp directory if not provided.

## Setup
```bash
# install deps (uses bun.lock)
bun install

# ensure Convex is running (example local dev)
npx convex dev --url http://127.0.0.1:3210
# ensure Redis is running
redis-server --port 6379
```

## Running the Server
- **Dev (watch + bundle client lib):** `bun run dev`
- **Prod-ish (no watch):** `bun start` (runs `bun src/server.ts`). Run `bun run build:client` once to refresh `public/js/reducer.bundle.js`.
- The server fails fast if `CONVEX_URL` is absent because `convex-client` is created at import time.
- On start, the server tries to launch `PersistenceWorker`; if Convex or Redis are unavailable it logs a warning and continues without persistence.

## Background Workers
- **PersistenceWorker** (reduces streams -> Convex): auto-started by the server; can be run standalone with `bun run run:projector`.
- **ToolWorker** (executes tool calls/script harness): start manually with `bun run src/workers/tool-worker.ts` when you expect `function_call` events; keep it pointed at the same Redis/Convex instance.

## Testing
- **Unit**: `bun x vitest tests/unit/stream-hydrator.spec.ts`
- **Smoke SSE**: `bun run test:smoke` (uses Vitest against `tests/e2e/smoke/`; requires Redis + Convex + a running server or Playwright webServer)
- **Playwright e2e**: `bun run test:e2e` (starts the Fastify server via `playwright.config.ts`; requires Redis, Convex, and real model API keys; workers=1 by config).  
  - UI mode: `bun run test:e2e:ui`
  - Report viewer: `bun run test:e2e:report`
- **Pipeline probe with live OpenAI**: `bun run verify:pipeline` (streams through OpenAI, persists to Convex, tails Redis; needs `OPENAI_API_KEY`, `CONVEX_URL`, `REDIS_URL`).

## Project Layout
- `src/server.ts` – Fastify bootstrap, static hosting, route registration, error handler, worker lifecycle.
- `src/api` – routes, handlers, schemas, services, client-stream cache (legacy `/api/v1` code paths).
- `src/core` – canonical schemas, reducers, adapters, tracing, observability, Redis wrapper, persistence helpers.
- `src/workers` – long-running processes (persistence, tool execution, projector entrypoints).
- `convex/` – Convex schema and functions for threads/messages.
- `tests/` – Playwright suites, fixtures, mocks, Vitest unit tests.
- `scripts/` – helper scripts (`bundle-client-libs`, `verify_pipeline`).

## Repository Structure (ASCII)
```
cody-fastify/
├─ package.json
├─ bun.lock
├─ package-lock.json
├─ tsconfig.json
├─ vitest.config.ts
├─ vitest.setup.ts
├─ playwright.config.ts
├─ README.md
├─ DEVLOG.md
├─ STATUS.md
├─ TEST_RESULTS.md
├─ SLICE_1_COMPLETION_REPORT.md
├─ WIRE-UI-PROMPT.md
├─ logs/
├─ public/
│  └─ js/
│     └─ reducer.bundle.js
├─ scripts/
│  ├─ bundle-client-libs.ts
│  └─ verify_pipeline.ts
├─ src/
│  ├─ server.ts
│  ├─ api/
│  │  ├─ routes/
│  │  │  ├─ submit.ts
│  │  │  ├─ stream.ts
│  │  │  ├─ run-status.ts
│  │  │  ├─ runs.ts
│  │  │  ├─ threads.ts
│  │  │  ├─ conversations.ts
│  │  │  ├─ messages.ts
│  │  │  └─ turns.ts
│  │  ├─ handlers/
│  │  │  ├─ conversation-handlers.ts
│  │  │  ├─ message-handlers.ts
│  │  │  └─ turn-handlers.ts
│  │  ├─ schemas/
│  │  │  ├─ conversation.ts
│  │  │  ├─ message.ts
│  │  │  ├─ thread.ts
│  │  │  └─ turn.ts
│  │  ├─ services/
│  │  │  ├─ codex-runtime.ts
│  │  │  ├─ conversation-service-codex.ts
│  │  │  ├─ message-processor.ts
│  │  │  ├─ thread-service.ts
│  │  │  └─ convex-client.ts
│  │  ├─ client-stream/
│  │  │  └─ client-stream-manager.ts
│  │  ├─ errors/api-errors.ts
│  │  └─ types/turns.ts
│  ├─ core/
│  │  ├─ adapters/
│  │  │  ├─ openai-adapter.ts
│  │  │  └─ anthropic-adapter.ts
│  │  ├─ persistence/convex-writer.ts
│  │  ├─ model-factory.ts
│  │  ├─ observability.ts
│  │  ├─ redis.ts
│  │  ├─ reducer.ts
│  │  ├─ schema.ts
│  │  ├─ tools/schema-formatter.ts
│  │  └─ tracing.ts
│  ├─ client/
│  │  ├─ hydration.ts
│  │  └─ errors.ts
│  ├─ types/
│  │  ├─ fastify.d.ts
│  │  ├─ conversations.ts
│  │  └─ bun-redis.d.ts
│  ├─ util/clone.ts
│  └─ workers/
│     ├─ persistence-worker.ts
│     ├─ tool-worker.ts
│     └─ run_projector.ts
├─ convex/
│  ├─ schema.ts
│  ├─ messages.ts
│  ├─ threads.ts
│  ├─ README.md
│  ├─ tsconfig.json
│  └─ _generated/
├─ tests/
│  ├─ unit/stream-hydrator.spec.ts
│  ├─ e2e/
│  │  ├─ smoke.spec.ts
│  │  ├─ conversations.spec.ts
│  │  ├─ lifecycle.spec.ts
│  │  ├─ messages.spec.ts
│  │  ├─ turns.spec.ts
│  │  ├─ phase7-client-stream.spec.ts
│  │  ├─ ui-thinking.spec.ts
│  │  ├─ core-2.0/
│  │  ├─ smoke/
│  │  ├─ fixtures/api-client.ts
│  │  └─ utils/
│  ├─ harness/
│  │  ├─ core-harness.ts
│  │  └─ smoke-harness.ts
│  ├─ mocks/mock-stream-adapter.ts
│  └─ fixtures/
├─ docs/ (design notes, prompts, test plans)
├─ logs/ (runtime logs)
├─ test-results/ (generated)
├─ playwright-report/ (generated)
├─ convex*.log / convex_rules (3).txt
└─ stream_output.txt
```

## File Index (description by file)
- `package.json` – scripts, deps, metadata.
- `bun.lock` / `package-lock.json` – dependency locks.
- `tsconfig.json` – TypeScript compiler options.
- `vitest.config.ts` / `vitest.setup.ts` – unit-test setup and env loading.
- `playwright.config.ts` – e2e setup; starts Fastify via Bun.
- `README.md` – project guide (this file).
- `DEVLOG.md`, `STATUS.md`, `TEST_RESULTS.md`, `SLICE_1_COMPLETION_REPORT.md`, `WIRE-UI-PROMPT.md` – project notes and prompts.
- `scripts/bundle-client-libs.ts` – builds `public/js/reducer.bundle.js` via esbuild.
- `scripts/verify_pipeline.ts` – live pipeline check (OpenAI → Redis → Convex).
- `src/server.ts` – Fastify bootstrap, static hosting, v2 routes, error handler, worker lifecycle.
- `src/api/routes/*.ts` – HTTP route handlers (v2: submit/stream/run-status/runs/threads; legacy v1: conversations/messages/turns).
- `src/api/handlers/*.ts` – controller logic for v1 routes.
- `src/api/schemas/*.ts` – Zod schemas for conversations/messages/threads/turns.
- `src/api/services/codex-runtime.ts` – codex-ts ConversationManager/auth wrapper.
- `src/api/services/conversation-service-codex.ts` – Convex sync + validation for conversations.
- `src/api/services/message-processor.ts` – consumes codex events, stores in Convex + client stream.
- `src/api/services/thread-service.ts` – Convex thread/run CRUD helpers.
- `src/api/services/convex-client.ts` – ConvexHttpClient init (needs `CONVEX_URL`).
- `src/api/client-stream/client-stream-manager.ts` – Redis-backed turn store for legacy v1 streaming.
- `src/api/errors/api-errors.ts` – API-friendly error classes.
- `src/api/types/turns.ts` – shared turn and event types.
- `src/core/adapters/openai-adapter.ts` / `anthropic-adapter.ts` – provider streaming adapters → StreamEvents.
- `src/core/model-factory.ts` – validates provider/model pairs, instantiates adapters; mock factory for tests.
- `src/core/redis.ts` – Redis Streams wrapper.
- `src/core/reducer.ts` – StreamEvent → Response snapshot reducer.
- `src/core/schema.ts` – canonical zod schemas/types (Response, StreamEvent, OutputItem).
- `src/core/persistence/convex-writer.ts` – persists Response snapshots to Convex.
- `src/core/observability.ts` – optional Traceloop/Langfuse init.
- `src/core/tools/schema-formatter.ts` – formats tool specs for provider APIs.
- `src/core/tracing.ts` – trace context helpers.
- `src/client/hydration.ts` – StreamHydrator for SSE/record rehydration.
- `src/client/errors.ts` – hydration error types/guards.
- `src/util/clone.ts` – deep clone helper.
- `src/workers/persistence-worker.ts` – consumes Redis streams, writes Convex snapshots.
- `src/workers/tool-worker.ts` – executes `function_call`/scripts from streams.
- `src/workers/run_projector.ts` – CLI entry to start PersistenceWorker with observability.
- `src/types/fastify.d.ts` – Fastify augmentation for modelFactory.
- `src/types/conversations.ts`, `src/types/bun-redis.d.ts` – extra typings.
- `convex/schema.ts` – Convex data model.
- `convex/messages.ts` / `convex/threads.ts` – Convex CRUD/persistence functions.
- `convex/README.md`, `convex/tsconfig.json`, `convex/_generated/*` – Convex app metadata/generated files.
- `tests/unit/stream-hydrator.spec.ts` – unit tests for StreamHydrator.
- `tests/e2e/*.spec.ts` – Playwright suites (health, conversations, lifecycle, messages, turns, streaming, UI).
- `tests/e2e/fixtures/api-client.ts` – API helper for Playwright tests.
- `tests/e2e/utils/*` – shared Playwright helpers.
- `tests/harness/core-harness.ts` / `smoke-harness.ts` – test harnesses using mock adapters/workers.
- `tests/mocks/mock-stream-adapter.ts` – mock stream adapter for tests.
- `tests/fixtures/` – test data.
- `docs/*` – design docs, prompts, test plans, skill references.
- `public/js/reducer.bundle.js` – browser bundle (generated).
- `logs/*`, `convex*.log`, `stream_output.txt`, `test-results/`, `playwright-report/` – runtime/generated artefacts.

## Docs Catalog
- `docs/codex-core-2.0-tech-design.md` – main technical design for the streaming-first Core 2.0, phases, schemas, and topology.
- `docs/codex-core-as-is.md` – current/legacy Codex core architecture recap with component diagrams.
- `docs/codex-enhancement-02.md` – QuickJS sandboxed script-based tool execution enhancement (status complete).
- `docs/CORE_REWRITE_PROMPT.md` – master prompt for executing the Core 2.0 rewrite.
- `docs/PHASE2_CORE_REWRITE_PROMPT.md` – execution brief for Phase 2 (projector/persistence worker).
- `docs/PHASE2_REVIEW_PROMPT.md` – QA/review checklist for Phase 2 deliverables.
- `docs/PHASE2_FOLLOWUP_PROMPT.md` – stabilization tasks and blockers after Phase 2.
- `docs/PHASE2_FINAL_FIX_PROMPT.md` – final fixes and isolation housekeeping for Phase 2.
- `docs/PHASE3_CORE_REWRITE_PROMPT.md` – execution brief for Phase 3 (client integration / v2 API).
- `docs/PHASE3_REVIEW_PROMPT.md` – review standards for Phase 3 API/client integration.
- `docs/PHASE4_CORE_REWRITE_PROMPT.md` – execution brief for Phase 4 (tool execution + Anthropic).
- `docs/PHASE4_REVIEW_PROMPT.md` – QA review for Phase 4 tool/execution parity.
- `docs/PHASE5_E2E_PROMPT.md` – execution brief for Phase 5 end-to-end parity and tests.
- `docs/v2-test-plan.md` – authoritative comprehensive E2E test plan for Core 2.0.
- `docs/model-failure-modes/uncertainty-cascade.md` – identified “uncertainty cascade” LLM failure mode (metacognitive deficit).
- `docs/prompting-reference/agent-prompting-lessons.md` – article summary on agent prompting best practices.
- `docs/prompting-reference/anthropic-context-engineering.md` – Anthropic blog on effective context engineering for agents.
- `docs/prompting-reference/anthropic-emergent-misalignment.md` – research summary on emergent misalignment/reward hacking.
- `docs/prompting-reference/anthropic-ytvid-prompting-for-agents.md` – transcript notes on prompting for agents (YouTube).
- `docs/prompting-reference/claude-frontend-design-skills.md` – Claude blog on improving frontend design via skills.
- `docs/prompting-reference/gemini-3-developer-guide.md` – scraped Gemini 3 developer guide overview.
- `docs/prompting-reference/jasonai-ytvid-prompting-claude-gemini3.md` – transcript-based prompting strategies for Claude and Gemini.
- `docs/claude-skills/platform-agent-skills-quickstart.md` – quickstart for Claude platform agent skills.
- `docs/claude-skills/claude-code-skills.md` – Claude Code skills reference.
- `docs/claude-skills/platform-agent-skills-overview.md` – overview of agent skills in Claude platform.
- `docs/claude-skills/blog-skills-explained.md` – blog explaining “skills” vs prompts/projects/MCP/subagents.
- `docs/claude-skills/platform-agent-sdk-skills.md` – agent skills in the Claude SDK.
- `docs/claude-skills/blog-how-to-create-skills.md` – blog on creating skills, limitations, examples.
- `docs/claude-skills/platform-agent-skills-best-practices.md` – best practices for Claude agent skills.
- `docs/cc/ui-v2-api-migration-design.md` – design for migrating the UI to the v2 API.
- `docs/cc/CODER-PROMPT.md` – coder prompt for building the Core 2.0 integration test harness.
- `docs/cc/GUIDE-ITERATIVE-AGENTIC-CODING.md` – methodology for iterative agentic coding with small slices.
- `docs/cc/test-conditions-phase-5.md` – Phase 5 error/edge-case test conditions.
- `docs/cc/v2-happy-path-test-plan.md` – happy-path test plan for Core 2.0 pipeline.
- `docs/cc/CODER-PROMPT-SMOKE.md` – coder prompt for Core 2.0 smoke tests with real APIs.
- `docs/cc/v2-harness-gemini-assessment.md` – assessment comparing Gemini vs Claude custom harness designs.
- `docs/cc/UNMOCK-TOOLS-PROMPT.md` – directive to remove tool execution mocking (critical).
- `docs/cc/v2-harness-final-thoughts.md` – reflections comparing Gemini’s strategy with local design.
- `docs/cc/PROMPT-STRUCTURE-PRINCIPLES.md` – principles for structuring coder prompts.
- `docs/cc/v2-custom-harness-cc.md` – custom Core 2.0 harness design (Claude track).
- `docs/cc/test-conditions-smoke-tests.md` – smoke-test conditions for Core 2.0 pipeline.
- `docs/cc/CODER-PROMPT-PHASE5.md` – prompt for Phase 5.1 error-handling tests.
- `docs/cc/CODER-PROMPT-PHASE5-2.md` – prompt for Phase 5.2 edge/stress tests.
- `docs/cc/CODER-PROMPT-PHASE5-3.md` – prompt for Phase 5.3 tool support integration.
- `docs/cc/test-conditions-v2-error-scenarios.md` – v2 error-scenario test conditions.
- `docs/cc/CODER-PROMPT-PHASE4.md` – prompt for integration bug fixes (Phase 4).
- `docs/gem/CODER-PROMPT-PHASE3.md` – coder prompt for Phase 3 harness implementation (Gemini track).
- `docs/gem/v2-harness-final-strategy.md` – final unified strategy for the v2 test harness (Gemini + Claude).
- `docs/gem/v2-harness-cc-assessment.md` – Gemini assessment of Claude vs Gemini harness designs.
- `docs/gem/v2-custom-harness-gem.md` – custom harness design from the Gemini perspective.
- `docs/gem/test-conditions-v2-error.md` – error-path test conditions for v2 harness.
- `docs/gem/test-conditions-v2-happy-path.md` – happy-path test conditions for v2 harness.

46
