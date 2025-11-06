# Anthropic Messages API Integration Design for Codex TypeScript Client
*Date: November 6, 2025*

## Executive Summary
- Extend the provider abstraction with `WireApi.Messages` and corresponding configuration so Anthropic Claude models can be selected alongside existing OpenAI Responses and Chat integrations.
- Introduce a dedicated `MessagesClient` pipeline (request builder, authenticated transport, streaming parser, adapter) that preserves Anthropic-native concepts—thinking blocks, tool use semantics, beta controls—while conforming to the shared `ResponseStream`.
- Expand the tool harness with `create_tools_json_for_messages_api()` and a bidirectional converter that maps Codex `ToolSpec` definitions and outputs to Anthropic’s `tool_use` / `tool_result` blocks.
- Normalize streaming semantics by translating Anthropic SSE events into the established `ResponseEvent` variants and, where necessary, adding a scoped `ReasoningContentDelta` usage contract for thinking blocks without altering existing consumers.
- Deliver a comprehensive Vitest suite (≈115 new tests across six categories) plus shared fixtures to lock down request shaping, SSE parsing, tool flows, error handling, and integration parity.
- Estimated complexity: 8–10 engineer-days, assuming one engineer leads the design/implementation and another reviews and pairs on the streaming adapter.

## Detailed Design

### 1. Architecture

#### 1.1 Overview
The TypeScript client keeps the Rust layout: `ModelClient.stream()` dispatches by `WireApi`. Adding Anthropic introduces a third path that must still feed the unified `ResponseStream`. We mirror the Rust composition—small provider-specific modules feeding a common adapter—so parity tests remain straightforward.

#### 1.2 WireApi Extension
- Extend the existing `WireApi` enum (under `codex-ts/src/core/model-provider-info.ts`, port in progress) with `Messages`.
- Update `ModelProviderInfo` to capture Anthropic defaults (`anthropicVersion`, `toolChoice`, `maxOutputTokens`, `connectTimeoutMs`, etc.).
- Ensure TOML configuration loader and runtime config guardrail treat `Messages` as a first-class value so CLI/demos can select Claude models.

#### 1.3 File Structure
New/modified files inside `codex-ts/src/`:

```
core/
  client/
    model-client.ts               # extends switch with Messages
    messages/
      index.ts                     # exports streamMessages()
      request-builder.ts           # builds MessagesApiRequest payloads
      transport.ts                 # configures fetch + headers
      sse-parser.ts                # reads streaming EventSource
      adapter.ts                   # converts SSE frames → ResponseEvent
      tool-bridge.ts               # tool spec conversion + result mapper
      fixtures/                    # test fixtures for SSE frames
  tools/
    spec.ts                        # add messages converter
protocol/
  streams/
    response-event.ts              # ensure TS equivalent contains ReasoningContentDelta etc.
tests/
  messages/
    request-builder.test.ts
    sse-parser.test.ts
    adapter.test.ts
    tool-bridge.test.ts
    errors.test.ts
    integration.test.ts
```

Shared utilities (e.g., SSE mock server) live under `codex-ts/test-support`.

#### 1.4 Class and Interface Design
- `MessagesRequestBuilder`: pure function accepting `Prompt`, provider config, and runtime options; returns `MessagesApiRequest`.
- `MessagesTransport`: wraps `fetch`, applying `x-api-key`, `anthropic-version`, optional `anthropic-beta`, `client` metadata, and request body streaming flags.
- `MessagesSseParser`: consumes the `ReadableStream<Uint8Array>` returned by `fetch`, chunking into SSE events (`message_start`, `content_block_delta`, etc.).
- `MessagesStreamAdapter`: state machine that interprets parser output and emits `ResponseEvent`.
- `MessagesToolBridge`: exports `createToolsJsonForMessagesApi` and `MaterializeToolResult` to go from Codex tool outputs to Anthropic `tool_result`.
- `AnthropicToolCallTracker`: lightweight map of `tool_use` IDs to pending `CustomToolCall` items, enabling correlation when results return.

#### 1.5 Integration Points
- `ModelClient.stream(prompt)` extends its switch:
  - `WireApi.Messages`: call `streamMessages(prompt, providerInfo, httpClientOptions)`.
  - Other branches unchanged.
- `ModelFamily` metadata gains optional `supports_messages_api` flag to drive CLI capability prompts.
- Rate limit handling: reuse `RateLimitSnapshot` aggregator; pass anthropic headers via `ResponseEvent::RateLimits`.
- Config loader ensures `provider.auth.api_key` accepts `ANTHROPIC_API_KEY` env fallback.

#### 1.6 Data Flow

```
Prompt → ModelClient.stream()
        → ProviderRouter (WireApi switch)
            → MessagesRequestBuilder (Prompt → MessagesApiRequest)
            → MessagesTransport (fetch POST /v1/messages?stream=true)
            → MessagesSseParser (yield AnthropicEvent)
            → MessagesStreamAdapter (AnthropicEvent → ResponseEvent)
            → mpsc channel → ResponseStream consumer
             ↘ ToolBridge (on tool_use/tool_result events)
```

#### 1.7 Error Handling
- HTTP layer: non-2xx responses decoded into `AnthropicError` (`type`, `status`, `error.message`, `error.type`, `request_id`, `context`) and rethrown as `ModelClientError`.
- Streaming layer: SSE `error` event surfaces as `ResponseEvent::OutputItemDone` with failure item when possible; otherwise the stream yields `Err`.
- Network drops: the adapter emits a `ModelClientError::StreamClosedUnexpectedly` preserving last `request_id`.
- Rate limits (HTTP 429) parsed for `anthropic-ratelimit-requests-remaining`, `...-tokens-remaining`, `...-tokens-limit` headers; these fields hydrate `RateLimitSnapshot`.

### 2. API Integration Details

#### 2.1 Messages API Request Model
Anthropic expects `{model, messages, max_output_tokens, system?, metadata?, tool_choice?, tools?, stream?, temperature?, top_k?, top_p?, stop_sequences?, thinking?, betas?}`.
- `messages`: array of `{role: 'user' | 'assistant', content: ContentBlock[]}`.
- `content` block types include `text`, `thinking`, `tool_use`, `tool_result`, `image`, `document`. Text blocks may contain multi-part reasoning segments.
- `tools`: array of `{name, description?, input_schema}`.
- `tool_choice`: `'auto' | 'any' | 'none' | {type: 'tool', name: string}` (per 2025 beta update supporting `none`).
- `metadata`: we will propagate Codex trace IDs.

`MessagesRequestBuilder` responsibilities:
- Convert `Prompt.input` into `messages`, splitting by role.
- Inject system instructions as `messages` entry with `role: 'assistant'` and `metadata` `system: true` to align with Anthropic guidance.
- Inline tools via `MessagesToolBridge`.
- Map `parallel_tool_calls` into `tool_choice` (`'any'` vs `'auto'` to permit sequential vs parallel) with guard for Anthropic constraint (Claude launches single tool at a time today; we enforce sequential semantics at adapter level).
- Apply `max_output_tokens` default from provider (e.g., 1024) unless prompt overrides.
- **Thinking block configuration:** Comes from `Prompt.reasoning` config (ReasoningEffort, ReasoningSummary from existing Codex protocol). Maps to Messages API `thinking.budget_tokens` parameter when present.

#### 2.2 Content Block Normalization
- `text` blocks join into `ResponseItem::message` `content` entries (type `'output_text'`).
- `thinking` blocks stream to `ResponseEvent::ReasoningContentDelta` and accumulate under `ResponseItem::reasoning.content`.
- `tool_use` blocks create `ResponseItem::custom_tool_call` with `call_id = id` and `input = JSON.stringify(input)`.
- `tool_result` blocks on assistant side map to `ResponseItem::custom_tool_call_output`.
- `image` / `document` blocks map to `ResponseItem::message` `content` entries using existing `input_image` / extended `output_image` types (requires confirming protocol supports; fallback to `other` with metadata).
- When the assistant transitions from `thinking` to `text`, we emit `ResponseEvent::ReasoningSummaryPartAdded` to signal consumers that aggregated reasoning can render.

#### 2.3 Streaming Adapter
Anthropic streaming events arrive as SSE with `event` names `message_start`, `message_delta`, `message_stop`, `content_block_start`, `content_block_delta`, `content_block_stop`, `ping`, and `error`.
- `message_start`: open new response, emit `ResponseEvent::Created`.
- `content_block_start`: push context onto adapter stack (type + id).
- `content_block_delta`: depending on block type:
  - text: emit `ResponseEvent::OutputTextDelta(delta.text)`.
  - thinking: emit `ResponseEvent::ReasoningContentDelta(delta.thinking)`.
  - tool_use: once complete, produce `ResponseItem::custom_tool_call`.
- `content_block_stop`: finalize block. For `text`, aggregate into `OutputItemAdded`.
- `message_delta`: contains usage counters; update running `TokenUsage`.
- `message_stop`: emit `ResponseEvent::Completed` with `response_id` and `TokenUsage`.
- `ping`: maintain keep-alive; no outward event.
- `error`: convert to stream error.

State machine tracks active `tool_use` entries to ensure we do not emit duplicates when full block arrives in multiple deltas.

#### 2.4 Streaming Event Mapping
| Anthropic Event | Adapter Action | ResponseEvent Mapping | Notes |
|-----------------|----------------|-----------------------|-------|
| `message_start` | Initialize response context, capture `message.id` | `Created` | Reset token counters and tool registry. |
| `content_block_start` (text) | Create mutable text buffer keyed by `block.id` | (none immediately) | Wait for deltas before emitting. |
| `content_block_delta` (text) | Append to buffer, stream delta text | `OutputTextDelta(bufferDelta)` | Maintains incremental UI updates. |
| `content_block_stop` (text) | Finalize block, emit aggregated item | `OutputItemAdded(ResponseItem::message)` | Adds to history for deterministic replay. |
| `content_block_start` (thinking) | Initialize reasoning buffer | (none immediately) | Provide context for subsequent deltas. |
| `content_block_delta` (thinking) | Append reasoning text | `ReasoningContentDelta(text)` | Consumers can surface thinking traces gated by verbosity. |
| `content_block_stop` (thinking) | Mark summary part complete | `ReasoningSummaryPartAdded` | Allows UI to render reasoning chunk boundary. |
| `content_block_start` (tool_use) | Cache metadata (`name`, `id`) | (none) | Input arrives via delta payload. |
| `content_block_delta` (tool_use) | Accumulate JSON payload | (none) | Validate incremental JSON via streaming parser. |
| `content_block_stop` (tool_use) | Emit tool call item | `OutputItemAdded(ResponseItem::custom_tool_call)` | Also register pending call for result correlation. |
| `content_block_start` (tool_result) | Prepare to capture result content | (none) | `role` may be user in subsequent turn. |
| `content_block_delta` (tool_result) | Stream tool output (text/binary) | `OutputTextDelta` or tool output aggregator | For long tool outputs we treat as text delta. |
| `content_block_stop` (tool_result) | Emit tool result item | `OutputItemDone(ResponseItem::custom_tool_call_output)` | Completes the call. |
| `message_delta` | Update usage, stop reason partials | `RateLimits` / internal usage update | Usage surfaces at completion. |
| `message_stop` | Close response, emit completion | `Completed { response_id, token_usage }` | Handles `stop_reason` field. |
| `ping` | Keep alive; track heartbeat lag | (no event) | Optionally log. |
| `error` | Surface failure | stream error → `Err` | include `request_id`, `error.type`. |

#### 2.5 Rate Limit & Usage Tracking
- Parse headers `anthropic-ratelimit-requests-remaining`, `anthropic-ratelimit-requests-limit`, `anthropic-ratelimit-tokens-remaining`, `anthropic-ratelimit-tokens-limit`, `anthropic-ratelimit-tokens-reset`. Convert to `RateLimitSnapshot`.
- `message_delta.usage` includes `input_tokens`, `output_tokens`, `cache_creation_input_tokens`; accumulate into existing `TokenUsage`.
- Emit `ResponseEvent::RateLimits` upon receiving headers or final usage payload.

#### 2.6 Concurrency & Backpressure
- Anthropic streams single `message` per request. We maintain adapter buffer size limit (configurable, default 8KB) to avoid unbounded memory.
- Use Node.js `ReadableStream` `pipeTo` with manual chunk reading to detect slow consumers; throttle `OutputTextDelta` dispatch via microtask queue.
- **Tool calls are sequential:** Anthropic Claude currently serializes tool execution (limitation of the Messages API, not Codex design). Multiple `tool_use` blocks may appear in one response, but Claude waits for all tool_result blocks before continuing. Our adapter tracks multiple tool_use IDs via index-based mapping, supporting parallel tracking even though execution is sequential. If future Anthropic versions enable true parallel execution, the architecture already supports it.

#### 2.7 Parallel Tool Execution Implementation
**State Management:**
```ts
// Track by index for SSE parsing, by ID for result matching
private toolByIndex: Map<number, { id: string; name: string; argsFragments: string[] }> = new Map();
private toolCallsById: Map<string, number> = new Map(); // quick lookup
```

**Execution Flow:**
1. During streaming, accumulate tool_use blocks in `toolByIndex`
2. On `message_stop`, extract all finalized tools
3. Execute in parallel: `Promise.all(tools.map(t => harness.execute(t)))`
4. Marshall results into ONE user message with multiple tool_result blocks
5. Ordering: by original content_block index (deterministic)

**Code Example:**
```ts
// After message_stop, collect all tools
const tools = Array.from(toolByIndex.values());

// Execute in parallel
const results = await Promise.all(
  tools.map(async (tc) => {
    const output = await toolHarness.execute(tc.name, JSON.parse(tc.argsFragments.join('')));
    return { tool_use_id: tc.id, content: serializeToolOutput(output) };
  })
);

// Build next user message
const userMessage: AnthropicMessage = {
  role: 'user',
  content: results.map(r => ({ type: 'tool_result', tool_use_id: r.tool_use_id, content: r.content }))
};
```

#### 2.8 System Prompt Handling
**Codex → Messages mapping:**
- Codex `base_instructions` → Anthropic `system` field (string format preferred)
- Send `system` on every request for determinism
- If system prompt changes mid-session, next request uses updated value

**Cross-API comparison:**
| API | System Prompt Location |
|-----|----------------------|
| Responses | `instructions` field |
| Chat | First message `{role: 'system', content}` |
| Messages | Top-level `system` field |

**Conversion:**
```ts
function toAnthropicSystem(baseInstructions: string | undefined): string | undefined {
  return baseInstructions?.trim() || undefined;
}
```

#### 2.9 Token Usage Normalization
**Anthropic fields → Codex TokenUsage:**
```ts
function normalizeUsage(usage?: {
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}): TokenUsageInfo {
  const u = usage ?? {};
  return {
    total_token_usage: {
      input_tokens: u.input_tokens ?? 0,
      cached_input_tokens: u.cache_read_input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
      reasoning_tokens: u.reasoning_tokens ?? 0,
    },
    last_token_usage: {
      input_tokens: u.input_tokens ?? 0,
      cached_input_tokens: u.cache_read_input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
      reasoning_tokens: u.reasoning_tokens ?? 0,
    },
  };
}
```

**Field mapping:**
- `input_tokens` → `input_tokens`
- `output_tokens` → `output_tokens`
- `reasoning_tokens` → `reasoning_tokens`
- `cache_read_input_tokens` → `cached_input_tokens`
- `cache_creation_input_tokens` → informational only (don't count)

#### 2.10 Error Handling & Retry Strategy
**Anthropic error types → Codex:**
| Anthropic Error | HTTP | Codex Handling | Retry? |
|----------------|------|----------------|--------|
| invalid_request_error | 400 | `{type: 'error', message}` | No |
| authentication_error | 401 | `{type: 'error', message}` | No |
| permission_error | 403 | `{type: 'error', message}` | No |
| not_found_error | 404 | `{type: 'error', message}` | No |
| rate_limit_error | 429 | Retry with backoff | Yes |
| overloaded_error | 529/503 | Retry with backoff | Yes |
| api_error | 5xx | Retry with backoff | Yes |

**Rate limit headers:**
- `anthropic-ratelimit-requests-limit` → `requests.limit`
- `anthropic-ratelimit-requests-remaining` → `requests.remaining`
- `anthropic-ratelimit-requests-reset` → `requests.reset_at`
- `anthropic-ratelimit-tokens-limit` → `tokens.limit`
- `anthropic-ratelimit-tokens-remaining` → `tokens.remaining`
- `anthropic-ratelimit-tokens-reset` → `tokens.reset_at`

**Retry parameters:**
- Initial: 250ms
- Factor: 2x
- Jitter: ±20%
- Max delay: 4s
- Max attempts: 6

#### 2.11 Streaming Cancellation
```ts
export async function streamMessages(
  req: MessagesApiRequest,
  signal: AbortSignal
): AsyncGenerator<ResponseEvent> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
    signal
  });
  const reader = res.body!.getReader();
  try {
    // Parse SSE...
  } catch (err) {
    if ((err as any).name === 'AbortError') {
      yield { type: 'turn_aborted', reason: 'user_requested' };
    } else {
      yield { type: 'stream_error', error: String(err) };
    }
  } finally {
    reader.releaseLock();
  }
}
```

#### 2.12 Authentication & Configuration
**Environment variable:** `ANTHROPIC_API_KEY`

**Provider config:**
```ts
export interface AnthropicProviderConfig {
  baseUrl?: string; // default: 'https://api.anthropic.com'
  anthropicVersion?: string; // default: '2023-06-01'
  apiKey?: string; // if omitted, read from ANTHROPIC_API_KEY
  reasoningEmission?: 'none' | 'readable' | 'raw'; // default 'readable'
}
```

**Header construction:**
```ts
function anthropicHeaders(cfg: AnthropicProviderConfig): Record<string, string> {
  const key = cfg.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
  if (!key) throw new Error('Missing Anthropic API key');
  return {
    'x-api-key': key,
    'anthropic-version': cfg.anthropicVersion ?? '2023-06-01',
    'content-type': 'application/json',
  };
}
```

#### 2.13 Stop Sequences
- Optional `stop_sequences` parameter supported
- Pass-through from Codex config if exposed
- Default: unset

### 3. Tool Harness

#### 3.1 Tool Format Specification
**Input (`ToolSpec`):**
- `Function` tools with `name`, `description`, `parameters`.
- `LocalShell`, `WebSearch`, `Freeform` (custom) variants.

**Output (Anthropic tool schema):**
```json
{
  "name": "apply_patch",
  "description": "Modify files using unified diff patches.",
  "input_schema": {
    "type": "object",
    "properties": {
      "patch": { "type": "string" },
      "context": { "type": "string" }
    },
    "required": ["patch"]
  }
}
```

**Conversion Algorithm (pseudocode):**
1. For each `ToolSpec::Function`:
   - Validate JSON schema (ensure `type: object`).
   - Map to `{ name, description, input_schema: parameters }`.
2. `ToolSpec::LocalShell` → built-in `shell` tool with schema aligning to existing executor.
3. `ToolSpec::WebSearch` → `{ name: 'web_search', description, input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }`.
4. `ToolSpec::Freeform` currently unsupported by Anthropic; mark as error at configuration time.
5. Apply `strict` handling: if tool is `strict`, embed `additionalProperties: false` guard.

**Edge Cases:**
- Optional parameters: ensure `required` array matches `ToolSpec` to avoid invalid schema.
- Nested definitions: Anthropic accepts full JSON Schema Draft 2020-12 subset; preserve `$defs`.
- Tool names must be ≤ 64 chars; enforce at conversion.
- Deduplicate by tool name to avoid streaming rejection.

#### 3.2 Tool Use Lifecycle
1. Model emits `tool_use` block with `id`, `name`, `input`.
2. Adapter emits `ResponseItem::custom_tool_call` and stores call entry.
3. Executor runs tool via existing harness; result serialized as string JSON or text.
4. `MessagesToolBridge` prepares `tool_result` payload:
   - `role: 'user'`
   - `content: [{ type: 'tool_result', tool_use_id, content: resultContent, is_error }]`
5. `ModelClient` enqueues follow-up request with appended `tool_result` message.

#### 3.3 Tool Result Handling
- Translate structured JSON outputs into `content` array using `text` block (Anthropic expects string, optionally `outputs` array).
- On binary outputs (non-UTF8), base64 encode and annotate `mime_type`.
- Maintain handshake across multiple tool calls by referencing `call_id`.

### 4. Test Specifications

#### 4.1 Testing Approach
- Use Vitest with `fake-timers` for heartbeat assertions.
- Mock HTTP via `undici` `MockAgent` to intercept `fetch`.
- SSE mock implemented by feeding newline-delimited events into `ReadableStream`.
- Fixtures: JSON files capturing canonical responses for text, tool use, thinking, images, and errors.

#### 4.2 Request Formatting Tests (15)
| ID | Description | Setup & Mocks | Input | Assertions & Expected |
|----|-------------|---------------|-------|-----------------------|
| RF-01 | Minimal prompt produces base request | No tools, default provider config | `Prompt` with single user text | `model`, `messages[0].role='user'`, `stream=true`, `tool_choice='auto'` |
| RF-02 | Custom instructions render as system message | Provider supplies base instructions override | Prompt with override string | First `messages` entry marked `role:'assistant'` with metadata `system:true` |
| RF-03 | Multiple turns preserve role ordering | History with alternating user/assistant | `Prompt.input` containing two turns | `messages` array matches chronological order |
| RF-04 | Output schema enables thinking controls | `Prompt.output_schema` set | Expect `thinking` absent, `metadata` retains schema reference | Validate optional fields omitted |
| RF-05 | Tool list converts to Anthropic schema | `ToolSpec::Function` list | Prompt with two tools | `tools` array equals converter output |
| RF-06 | Strict tool disables additionalProperties | ToolSpec with `strict=true` | Single tool prompt | `input_schema.additionalProperties === false` |
| RF-07 | Parallel tool calls disabled maps to `'auto'` | `parallel_tool_calls=false` | Prompt | `tool_choice='auto'` |
| RF-08 | Parallel tool calls enabled maps to `'any'` guard | `parallel_tool_calls=true` | Prompt | `tool_choice='any'` with warning flag |
| RF-09 | Max output tokens default applied | Provider config sets default 2048 | Prompt without override | Request `max_output_tokens=2048` |
| RF-10 | Max output tokens override respected | Prompt metadata with override 4096 | Request `max_output_tokens=4096` |
| RF-11 | Temperature/top_p propagate | Provider config sets temperature, top_p | Request includes both numeric values |
| RF-12 | Stop sequences forwarded | Prompt includes `stop` array | Request `stop_sequences` matches input |
| RF-13 | Metadata includes trace identifiers | Prompt metadata contains `trace_id` | Request `metadata.trace_id` set |
| RF-14 | Tool omission when none provided | Prompt without tools | Request lacks `tools` key |
| RF-15 | Freeform tool rejected early | Prompt includes unsupported `Freeform` tool | Builder throws configuration error |

#### 4.3 Response Parsing Tests (20)
| ID | Description | Setup | Input | Expected |
|----|-------------|-------|-------|---------|
| RP-01 | Parse simple text message response | Parser seeded with message_start + text block | SSE event sequence | Output `ResponseItem::message` with text |
| RP-02 | Aggregate multi-delta text block | `content_block_delta` repeated thrice | Sequence of deltas | Combined text equals concatenation |
| RP-03 | Thinking block captured | `thinking` block events | SSE sequence | `ReasoningContentDelta` emitted, stored in reasoning item |
| RP-04 | Thinking summary boundary flagged | `content_block_stop` for thinking | SSE | `ReasoningSummaryPartAdded` emitted |
| RP-05 | Tool use block parsed | `tool_use` block with JSON payload | SSE | `ResponseItem::custom_tool_call` with name/input |
| RP-06 | Tool use incremental JSON handled | JSON arrives in two deltas | SSE | Parser reassembles valid JSON |
| RP-07 | Tool result block parsed | `tool_result` block | SSE | `ResponseItem::custom_tool_call_output` emitted |
| RP-08 | Tool result error flagged | `tool_result` with `is_error=true` | SSE | Response item includes error marker |
| RP-09 | Image block mapped | `content_block_start` type image | SSE | Response item contains `output_image` placeholder |
| RP-10 | Document block stored as attachment | Document block with `media_type` | SSE | Response item records metadata |
| RP-11 | Usage tallied from message_delta | message_delta payload with usage numbers | SSE | TokenUsage aggregated |
| RP-12 | Stop reason captured | message_stop with `stop_reason='end_turn'` | SSE | Completion event includes reason |
| RP-13 | Rate limit headers recorded | Mock response headers set | SSE | RateLimitSnapshot values match header |
| RP-14 | Ping ignored | SSE includes ping events | SSE | No ResponseEvent emitted |
| RP-15 | Error event surfaces | SSE includes error event | SSE | Stream yields failure |
| RP-16 | Unknown block type falls back to `other` | Block type `custom` | SSE | Response item `other` generated |
| RP-17 | Empty content gracefully handled | content_block_delta empty string | SSE | No redundant events emitted |
| RP-18 | Message-level metadata forwarded | message_start contains `metadata` | SSE | Response item extends metadata map |
| RP-19 | Cache fields preserved | message_delta cache tokens present | SSE | TokenUsage.cacheCreationInput tokens stored |
| RP-20 | Multi-block message ordering | text + tool + text sequence | SSE | Response items maintain chronological order |

#### 4.4 Streaming Adapter Tests (25)
| ID | Description | Setup | Input | Assertions |
|----|-------------|-------|-------|-----------|
| SE-01 | Created event emitted once per message | Basic stream | SSE sequence | Channel receives single `Created` |
| SE-02 | OutputTextDelta streaming works | Multi delta text | SSE | Number of deltas equals splits |
| SE-03 | Reasoning delta streaming works | Thinking block | SSE | Deltas match chunk content |
| SE-04 | Tool call emitted on block stop | Tool block sequence | SSE | `OutputItemAdded` for tool call |
| SE-05 | Tool result completes call | Tool result block | SSE | `OutputItemDone` references same call_id |
| SE-06 | Usage updates before completion | message_delta before stop | SSE | TokenUsage available at `Completed` |
| SE-07 | Response completed event fired exactly once | Standard sequence | SSE | Only one `Completed` emitted |
| SE-08 | Adapter resilient to interleaved ping | Ping inserted | SSE | No event drift |
| SE-09 | Adapter handles parallel tool placeholders | Two tool_use blocks sequential | SSE | Distinct call IDs tracked |
| SE-10 | Adapter flushes pending text on stream close | Unexpected close after text delta | SSE truncated | Emits aggregated message before error |
| SE-11 | Adapter surfaces network abort | Abort signal raised | SSE | Stream emits error with context |
| SE-12 | Adapter handles partial UTF-8 boundaries | Chunk split mid-codepoint | SSE bytes | Decoder merges bytes correctly |
| SE-13 | Adapter handles JSON backpressure | Deltas delayed | SSE | No state loss |
| SE-14 | Adapter handles message_stop without content | SSE with immediate stop | SSE | Completed event still emitted |
| SE-15 | Adapter resets state between messages | Two message sequences | SSE | Second message has clean state |
| SE-16 | Adapter attaches response_id from message_start | message_start includes id | SSE | Completed event includes same id |
| SE-17 | Adapter emits RateLimits event when headers available | Mock headers | SSE | RateLimits event observed |
| SE-18 | Adapter handles stream-level error event gracefully | error event mid-stream | SSE | Emits error after draining completions |
| SE-19 | Adapter handles nested documents | Document block with attachments array | SSE | Items captured |
| SE-20 | Adapter handles empty tool input object | tool_use with `{}` | SSE | Input serialized as `{}` |
| SE-21 | Adapter logs unknown events | Inject unsupported event name | SSE | Warning logged, stream continues |
| SE-22 | Adapter handles stop_reason `tool_use` requiring follow-up | message_stop reason `tool_use` | SSE | Completed emitted with follow-up flag |
| SE-23 | Adapter handles double stop gracefully | message_stop repeated | SSE | Second stop ignored |
| SE-24 | Adapter maintains ordering under concurrent listeners | Channel with buffered subscriber | SSE | Sequence preserved |
| SE-25 | Adapter exposes trace metadata to events | message metadata includes `trace_id` | SSE | Response events carry metadata |

#### 4.5 Tool Calling Tests (30)
| ID | Description | Setup | Input | Assertions |
|----|-------------|-------|-------|-----------|
| TC-01 | Converter maps basic function tool | Function tool spec | Tool list | Output schema matches expectation |
| TC-02 | Converter enforces name length | Tool name >64 chars | Tool list | Throws validation error |
| TC-03 | Converter strips unsupported Freeform | Freeform tool | Tool list | Error returned |
| TC-04 | Converter handles LocalShell mapping | LocalShell spec | Tool list | Anthropic schema with exec params |
| TC-05 | Converter handles WebSearch mapping | WebSearch tool | Tool list | Schema ensures query string |
| TC-06 | Converter preserves schema defs | Schema with `$defs` | Tool list | Output contains `$defs` |
| TC-07 | Converter enforces required list | Schema missing required | Tool list | Validation error prompt |
| TC-08 | Converter handles nested arrays | Schema with array properties | Tool list | Input schema unchanged |
| TC-09 | Converter handles enums | Schema property with enum | Tool list | Output retains enum |
| TC-10 | Tool registry deduplicates names | Duplicate tool names | Tool list | Warning and dedupe |
| TC-11 | Tool call tracker stores pending call | SSE tool_use emitted | SSE | Pending map contains call_id |
| TC-12 | Tool tracker rejects duplicate call_id | Duplicate id inserted | SSE | Error thrown |
| TC-13 | Tool result marshaler formats success | Tool output string | Result builder | Content text matches output |
| TC-14 | Tool result marshaler formats JSON output | Tool output JSON string | Result builder | Content uses JSON string |
| TC-15 | Tool result marshaler flags error status | Tool returns failure | Result builder | Sets `is_error` true |
| TC-16 | Tool result marshaler handles binary data | Output Buffer | Result builder | Base64 + mime metadata |
| TC-17 | Tool round-trip attaches call_id | tool_use + tool_result | Sequence | `tool_use_id` matches original |
| TC-18 | Tool round-trip updates Prompt history | Completed tool result | Sequence | Next request includes tool_result block |
| TC-19 | Tool choice none disables tool dispatch | Provider config sets `tool_choice='none'` | Prompt | Converter not invoked |
| TC-20 | Tool choice specific name enforced | Config selects tool | Prompt | Request `tool_choice` references name |
| TC-21 | Parallel tool requests queued sequentially | Two tool uses requested | Sequence | Tool results returned in order |
| TC-22 | Tool result size limits enforced | Large output > 32KB | Result builder | Output truncated with notice |
| TC-23 | Tool result error surfaces to ResponseEvent | Execution failure | Sequence | OutputItemDone contains failure |
| TC-24 | Tool schema caching works | Same tool reused across prompts | Sequence | Converter uses cached JSON |
| TC-25 | Tool schema cache invalidates on change | Tool metadata updated | Sequence | Converter rebuilds schema |
| TC-26 | Tool invocation metrics recorded | Tool run instrumentation | Sequence | Metrics aggregator receives call |
| TC-27 | Tool JSON validation fails gracefully | Invalid JSON from SSE | Sequence | Stream emits error and surfaces call id |
| TC-28 | Tool result merges multi-block content | tool_result delivered in multiple deltas | Sequence | Combined result matches original data |
| TC-29 | Tool result handles truncated SSE | SSE ends mid tool result | Sequence | Error emitted, pending call flagged |
| TC-30 | Tool analytics forwarded to telemetry | Telemetry spy | Sequence | Telemetry event contains tool metadata |

#### 4.6 Error Handling Tests (15)
| ID | Description | Setup | Input | Assertions |
|----|-------------|-------|-------|-----------|
| EH-01 | HTTP 401 raises auth error | Mock 401 with error body | Request attempt | Error includes `type='authentication_error'` |
| EH-02 | HTTP 429 populates rate limit snapshot | Mock 429 with headers | Request | Error carries retry after & snapshot |
| EH-03 | HTTP 500 surfaces server error | Mock 500 | Request | Error message includes server context |
| EH-04 | Malformed SSE triggers parse error | Invalid event field | Stream | Adapter raises parse exception |
| EH-05 | Timeout abort emits cancellation error | Abort controller | Request | Error flagged as timeout |
| EH-06 | Network failure mid stream | Simulate socket drop | Stream | Error includes `request_id` |
| EH-07 | Error event in SSE translated | SSE `event:error` | Stream | Response error contains `type` and `message` |
| EH-08 | Unknown error shape handled | Body missing `error` key | Request | Error fallback message generated |
| EH-09 | Tool conversion failure surfaces early | Invalid tool spec | Builder | Error thrown before HTTP call |
| EH-10 | Tool result encoding failure | Binary decode fails | Result builder | Error bubbled to caller |
| EH-11 | Rate limit headers missing safe default | 429 without headers | Request | Snapshot uses `undefined` values gracefully |
| EH-12 | Stream close without message_stop | SSE truncated | Stream | Error indicates incomplete response |
| EH-13 | JSON parse error in tool_use | Corrupted payload | Stream | Error references call_id for debugging |
| EH-14 | Thinking delta missing text field | SSE missing `text` | Stream | Error with validation message |
| EH-15 | Stop reason `max_tokens` flagged | message_stop reason `max_tokens` | Stream | Completion includes reason tag for UI |

#### 4.7 Integration Tests (10)
| ID | Description | Setup | Input | Assertions |
|----|-------------|-------|-------|-----------|
| IT-01 | Text-only conversation end-to-end | Mock SSE script | Prompt simple text | ResponseStream yields message then completion |
| IT-02 | Tool call round-trip end-to-end | SSE script with tool call + result | Prompt with tool | Tool executed via harness, results fed back |
| IT-03 | Sequential tool calls in one turn | SSE script with two tool uses | Prompt with two eligible tools | Both calls executed sequentially |
| IT-04 | Thinking displayed before final answer | SSE script with thinking + text | Prompt | Reasoning events precede message events |
| IT-05 | Rate limit headers update UI store | SSE script with headers | Prompt | ResponseStream emits RateLimits event |
| IT-06 | Error after partial response surfaces gracefully | SSE script error near end | Prompt | Final message aggregated, error emitted |
| IT-07 | Tool choice none prevents tool path | SSE script no tool use | Provider config with `tool_choice='none'` | No tool events produced |
| IT-08 | Mixed media content handled | SSE script with image + text | Prompt | ResponseItem includes image metadata |
| IT-09 | Parallel provider parity baseline | Compare Responses vs Messages via fixtures | Two prompts | Output normalized `ResponseItem` arrays equivalent save provider metadata |
| IT-10 | Retry logic preserves idempotency | Simulate retry with same request_id | Prompt | Second attempt reuses same tool pending state |

### 5. Implementation Plan
1. **Wire API Extension**: Update `core/model-provider-info.ts` to add `WireApi.Messages`, extend interfaces, ensure config loader accepts new enum value.
2. **Configuration Plumbing**: Add Anthropic-specific defaults (`anthropicVersion`, `maxOutputTokens`, `toolChoice`) to provider config, update docs and env var resolution.
3. **Tool Bridge**: Implement `createToolsJsonForMessagesApi` and validation utilities in `core/tools/spec.ts`; add unit tests for conversions.
4. **Request Builder**: Create `core/client/messages/request-builder.ts` to translate `Prompt` into `MessagesApiRequest`. Include schema validations and metadata injection.
5. **Transport Layer**: Implement `transport.ts` with authenticated `fetch`, header construction, abort handling, and error normalization (non-streaming path reused by tests).
6. **SSE Parser & Adapter**: Build `sse-parser.ts` to consume stream into typed events, and `adapter.ts` to map to `ResponseEvent`. Cover state machine + tool tracking.
7. **ModelClient Integration**: Update `model-client.ts` to route `WireApi.Messages` and wire tool round-trip bridging (send tool_result follow-up requests).
8. **Testing & Fixtures**: Craft fixtures, implement Vitest suites per Section 4, including integration harness that simulates SSE transcripts.
9. **Documentation & Samples**: Update `docs/` (e.g., provider configuration guide) with Anthropic setup, environment variable instructions.
10. **Review & Iteration**: Run targeted tests (`pnpm vitest --run messages`), gather peer review, adjust as necessary.

### 6. Test Specifications (Updated)

**Total tests: 135+** (expanded from 115)

**Test categories:**
1. Request formatting: 15 tests (RF-01 through RF-15)
2. Response parsing: 20 tests (RP-01 through RP-20)
3. Streaming adapter: 25 tests (SE-01 through SE-25)
4. Tool calling: 35 tests (TC-01 through TC-30, plus 5 parallel tool tests)
5. Error handling: 20 tests (EH-01 through EH-15, plus 5 error mapping tests)
6. Token usage: 5 tests (new)
7. Cancellation: 5 tests (new)
8. Integration: 10 tests (IT-01 through IT-10)

**New test additions:**
- Parallel tool execution (5 tests)
- Error code mappings (5 tests)
- Token field mappings (5 tests)
- Streaming cancellation (5 tests)

### 7. Risks & Mitigations
- **Streaming drift due to unbounded thinking text**: Large reasoning sections could flood UI. *Mitigation*: throttle `ReasoningContentDelta`, add configurable cap and `ReasoningSummaryPartAdded` markers for chunking.
- **Tool schema incompatibility**: Freeform or non-JSONSchema tools unsupported. *Mitigation*: validate at config load, provide actionable error.
- **Anthropic API changes (beta fields)**: Future changes may break assumptions. *Mitigation*: centralize version string and feature flags; expose provider config to override `anthropicVersion`.
- **Rate limit discrepancies**: Headers may be missing or new names. *Mitigation*: treat missing headers as optional, log warnings, maintain compatibility.
- **Parallel tool limitations**: Claude currently serializes tool use. *Mitigation*: queue tool calls even if Codex allows parallel, document behavior difference.
- **Error propagation**: SSE `error` events can arrive after partial content. *Mitigation*: flush buffered content before raising errors, include `request_id`.
- **Testing complexity**: 115 tests increase CI time. *Mitigation*: scope tests under `messages` project, leverage fixture reuse, skip heavy integration in quick smoke suite.
- **Security of API keys**: Handling new provider keys. *Mitigation*: ensure keys read from env, never logged; redaction in debug logs.

### 7. Future Extensibility
- Encapsulate provider-specific logic in `core/client/{provider}` directories so adding Google, Cohere, etc., follows same pattern (request builder, transport, adapter).
- Keep `WireApi` enumerations additive; share `ProviderCapabilities` interface listing features (tool strategies, thinking support).
- Externalize streaming parser by building generic SSE reader that maps `event` → handler map; future providers plug new maps.
- Document template for adding new provider: configuration, tool conversion, streaming mapping.
- Provide compatibility layer for future `Messages v2` by versioning `MessagesTransport` and gating features behind provider config.

## Code Examples

```ts
// core/model-provider-info.ts
export enum WireApi {
  Responses = 'responses',
  Chat = 'chat_completions',
  Messages = 'messages',
}
```

```ts
// core/client/messages/request-builder.ts
export interface MessagesApiRequest {
  model: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  tool_choice?: 'auto' | 'any' | 'none' | { type: 'tool'; name: string };
  max_output_tokens?: number;
  metadata?: Record<string, string>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream: boolean;
  thinking?: { budget_tokens?: number };
}
```

```ts
// core/client/messages/adapter.ts
export async function* streamMessages(
  readable: ReadableStream<Uint8Array>,
  ctx: MessagesAdapterContext,
): AsyncGenerator<ResponseEvent, void, unknown> {
  const parser = createSseParser(readable);
  for await (const event of parser) {
    switch (event.type) {
      case 'message_start':
        ctx.reset(event.data);
        yield { type: 'Created' };
        break;
      case 'content_block_delta':
        yield* handleContentDelta(event, ctx);
        break;
      case 'content_block_stop':
        yield* handleContentStop(event, ctx);
        break;
      case 'message_delta':
        ctx.updateUsage(event.data.usage);
        break;
      case 'message_stop':
        yield ctx.complete(event.data);
        break;
      case 'error':
        throw ctx.toError(event.data);
    }
  }
}
```

```ts
// core/tools/spec.ts
export function createToolsJsonForMessagesApi(tools: ToolSpec[]): AnthropicTool[] {
  return tools.map((tool) => {
    if (tool.type === 'function') {
      const schema = normalizeSchema(tool.parameters);
      return {
        name: tool.name,
        description: tool.description,
        input_schema: schema,
      };
    }
    if (tool.type === 'local_shell') {
      return buildShellToolSchema();
    }
    if (tool.type === 'web_search') {
      return buildWebSearchToolSchema();
    }
    throw new UnsupportedToolError(tool.type, 'Anthropic Messages does not support this tool type');
  });
}
```

```ts
// tests/messages/adapter.test.ts
test('streams thinking and text blocks in order', async () => {
  const events = sseFixture('thinking_then_text');
  const adapter = streamMessages(events, createContext());
  const emitted = await collect(adapter);
  expect(emitted.map((e) => e.type)).toEqual([
    'Created',
    'ReasoningContentDelta',
    'ReasoningSummaryPartAdded',
    'OutputTextDelta',
    'OutputItemAdded',
    'Completed',
  ]);
});
```

## References
- Anthropic Messages API streaming documentation, retrieved November 6, 2025.
- Anthropic tool use and tool result specification, retrieved November 6, 2025.
- Anthropic API request structure and beta tool choice update notes, retrieved November 6, 2025.
- Anthropic API error handling guide, retrieved November 6, 2025.
- Anthropic developer blog on rate limit headers, retrieved November 6, 2025.

