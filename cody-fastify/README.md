# Cody Fastify

Fastify API for Cody that wires directly into the `codex-ts` runtime and verifies behavior with Playwright API tests.

## Setup

```bash
bun install
```

## Environment

- `CODY_HOME` – defaults to the repo-local `../tmp-cody-home` directory. The server (and Playwright) will create and clean this folder automatically, so **do not** store anything important there. Override the path if you need a custom workspace.

**Required Environment Variables**:
- `OPENAI_API_KEY` – required for live OpenAI requests
- `ANTHROPIC_API_KEY` – required when running tests that target Anthropic providers (currently skipped while per-turn overrides are disabled)

**Tool Execution Environment Variables** (required for tool calling):
- `PERPLEXITY_API_KEY` – **required** for web search tools (web search will fail without this)
- `FIRECRAWL_API_KEY` – **required** for web fetch/crawl tools (fetch will fail without this)
- `OPENROUTER_API_KEY` – required for OpenRouter model access and agent tools
- `TEST_MODEL_FLASH`, `TEST_MODEL_NANO`, `TEST_MODEL_HAIKU` – optional, used by agent tools
- `CLAUDE_OAUTH_ACCESS_TOKEN` – optional, for Claude OAuth authentication

**API Keys**: Bun automatically loads `.env` files. You can either:

1. **Create a `.env` file** in the `cody-fastify` directory:
   ```bash
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=anthropic-key
   PERPLEXITY_API_KEY=pplx-...  # Required for web search
   FIRECRAWL_API_KEY=fc-...     # Required for web fetch
   OPENROUTER_API_KEY=sk-or-... # Required for OpenRouter/agent tools
   ```

2. **Or export environment variables** in your shell:
   ```bash
   export OPENAI_API_KEY="sk-..."
   export ANTHROPIC_API_KEY="anthropic-key"
   ```

## Development

```bash
bun run dev
```

Start the server manually with `bun run start` and visit `http://127.0.0.1:4010/health` to confirm the JSON response.

## Quality Gates

The workflow uses real Codex conversations that persist under `tmp-cody-home`, so each command assumes valid API keys are present.

```bash
bun run format
bun run lint
bun run build
bun run test:e2e
```

`bun run test:e2e` launches the Fastify server with `CODY_HOME=../tmp-cody-home`, wipes any previous Codex data in that directory, and then runs the Playwright suites end-to-end.

## Implementation Status

### ✅ Completed Features

- **Core Conversation Management**: Full CRUD operations (create, list, get, update, delete) using Codex runtime
- **Message Submission**: POST `/conversations/:id/messages` queues real Codex turns and returns turn IDs
- **Turn Status Tracking**: GET `/turns/:id` exposes turn status, results, thinking, and tool calls
- **SSE Streaming**: GET `/turns/:id/stream-events` streams real-time events with support for:
  - `thinkingLevel` filtering (none/full)
  - `toolLevel` filtering (none/full)
  - Last-Event-ID resumption
  - Keepalive comments during long gaps
  - Error event handling
- **Provider Info Exposure**: Turn status and SSE events include `modelProviderId`, `modelProviderApi`, and `model` fields
- **History Management**: GET `/conversations/:id` returns full conversation history from Codex rollouts
- **Metadata Persistence**: Title, summary, tags, and agentRole are persisted in rollout files
- **Test Infrastructure**: Playwright tests run serially to avoid rate limits

### ⚠️ Known Limitations / Skipped Tests

The following tests are intentionally skipped due to technical limitations:

- **TC-8.4** (Client Disconnect and Reconnect): Playwright's `APIRequestContext` cannot reliably simulate mid-stream disconnects. Last-Event-ID resumption is still tested indirectly via other streaming tests.
- **TC-8.5** (Multiple Subscribers): Requires multiple concurrent SSE connections to the same turn, which is not supported by the current in-memory event bridge.
- **TC-L6** (Stream Reconnection): Same limitation as TC-8.4 regarding mid-stream disconnect simulation.
- **TC-6.4** (With Model Override): Per-turn provider/model overrides are validated but not yet applied to Codex sessions. The turn record stores the requested override, but Codex uses the conversation's original config.
- **TC-L4** (Provider Override Workflow): Same limitation as TC-6.4 - provider switching mid-conversation requires changes to how Codex sessions handle config overrides.

### 🔧 Technical Notes

- **Per-Turn Overrides**: The API accepts `modelProviderId`, `modelProviderApi`, and `model` in message bodies and validates them, but Codex's `Conversation.sendMessage()` uses the conversation's config at creation time. To fully support overrides, either:
  - Codex would need to accept config overrides in the `user_turn` Op, or
  - A new conversation would need to be created with updated config (not ideal for maintaining history)
- **Event Processing**: Events are processed asynchronously via `processMessage()`, which consumes Codex events until completion. The turn store maintains an in-memory event bridge that could be replaced with Redis in production.
- **Test Execution**: Tests run serially (`workers: 1`) to prevent API rate limit issues with live LLM providers.
