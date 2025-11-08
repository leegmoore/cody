# Codex Enhancement 01: Multi-Provider API Integration

**Enhancement:** Advanced API Support for OpenAI Responses and Anthropic Messages
**Status:** Complete (Phase 4.1-4.2)
**Date:** November 7, 2025

---

## Overview

This enhancement extends Codex's client architecture to support the advanced features of OpenAI's Responses API and Anthropic's Messages API while maintaining a shared conversation representation. Both APIs offer capabilities beyond the classic Chat Completions format, and our implementation allows models to fully utilize these features while working from the same underlying message history.

---

## The Provider Abstraction

### Unified Message Storage

**Core principle:** Conversations are stored in a provider-agnostic format using `ResponseItem` types.

```typescript
type ResponseItem =
  | MessageItem
  | ReasoningItem
  | FunctionCallItem
  | ToolUseItem
  | ToolResultItem
  | ThinkingItem
  // ... etc
```

**This universal format:**
- Captures all message types across providers
- Stores in conversation history once
- Converts to provider-specific format at request time

### Provider Dispatch

```typescript
enum WireApi {
  Responses,  // OpenAI Responses API
  Chat,       // OpenAI Chat Completions
  Messages,   // Anthropic Messages API
}

// ModelClient routes based on provider
async stream(prompt: Prompt): ResponseStream {
  switch (this.provider.wireApi) {
    case WireApi.Responses:
      return this.streamResponses(prompt);
    case WireApi.Chat:
      return this.streamChat(prompt);
    case WireApi.Messages:
      return this.streamMessages(prompt);
  }
}
```

**Each path:**
1. Converts ResponseItem[] → API-specific request format
2. Sends request with API-specific features
3. Parses API-specific response stream
4. Adapts back to ResponseEvent stream

**Result:** Application code sees unified ResponseStream regardless of provider.

---

## OpenAI Responses API

### What Makes It Different

The Responses API represents OpenAI's modern approach to LLM interaction, distinct from Chat Completions in several ways:

**Semantic Streaming:**
- Events are structured and meaningful (not just delta tokens)
- `response.item.added` - Complete items arrive
- `response.output.text.delta` - Text streaming
- `response.reasoning.content.delta` - Reasoning streaming
- `response.completed` - Explicit completion

**Reasoning Controls:**
```typescript
{
  reasoning: {
    effort: "low" | "medium" | "high",
    summary: "auto" | "off" | "on"
  }
}
```
- Control computational effort
- Manage reasoning visibility
- Optimize for speed vs thoroughness

**Native Tool Format:**
```json
{
  "type": "function",
  "name": "apply_patch",
  "description": "Apply unified diff patch",
  "parameters": { ... }  // Flat structure
}
```
- Simpler than Chat's wrapped format
- Direct tool specification

**Verbosity Control:**
```typescript
{
  text: {
    verbosity: "low" | "medium" | "high"
  }
}
```
- Adjust response length
- Balance detail vs brevity

### How We Support It

**Request Building:**
```typescript
// From Prompt (universal) → ResponsesApiRequest
{
  model: config.model,
  instructions: prompt.baseInstructions,
  input: convertToResponseItems(prompt.input),
  tools: convertToolsForResponses(prompt.tools),
  reasoning: {
    effort: prompt.reasoningEffort,
    summary: prompt.reasoningSummary
  },
  text: {
    verbosity: config.verbosity
  },
  stream: true
}
```

**Streaming Adaptation:**
```typescript
// Responses events → ResponseEvent
{
  "response.item.added": { item }
    → ResponseEvent.OutputItemAdded(item)

  "response.output.text.delta": { delta }
    → ResponseEvent.OutputTextDelta(delta)

  "response.reasoning.content.delta": { delta }
    → ResponseEvent.ReasoningContentDelta(delta)

  "response.completed": { usage }
    → ResponseEvent.Completed({ usage })
}
```

**Key Features Preserved:**
- Reasoning effort configurable per turn
- Reasoning visibility controllable
- Verbosity adjustable
- Semantic events for better UI feedback
- Native tool calling efficiency

---

## Anthropic Messages API

### What Makes It Different

The Messages API is Anthropic's approach to LLM interaction, designed around content blocks and thinking capabilities:

**Content Block Architecture:**
- Messages contain arrays of content blocks
- Each block has a specific type
- Streaming happens at block granularity

**Block Types:**
```typescript
type ContentBlock =
  | { type: "text", text: string }
  | { type: "thinking", thinking: string }  // Extended reasoning
  | { type: "tool_use", id: string, name: string, input: object }
  | { type: "tool_result", tool_use_id: string, content: string }
```

**Thinking Blocks (Extended Reasoning):**
- Model's internal reasoning process
- Streamed to client during generation
- Separate from final text output
- Can be shown/hidden based on preference
- More detailed than Responses API reasoning summaries

**Tool Use Semantics:**
```json
{
  "type": "tool_use",
  "id": "toolu_abc123",
  "name": "apply_patch",
  "input": { "patch": "..." }
}
```
- Unique IDs per invocation
- Clean input/output pairing via IDs
- Explicit tool_result blocks for responses

**System Prompt Separation:**
```typescript
{
  system: "You are an expert coding assistant...",  // Separate field
  messages: [
    {role: "user", content: "Fix the tests"},
    // ...
  ]
}
```
- System instructions separate from messages
- Cleaner conversation structure

### Streaming Events

**SSE event types:**
- `message_start` - New response beginning
- `content_block_start` - Block begins (text/thinking/tool_use)
- `content_block_delta` - Incremental content
  - `text_delta` for text blocks
  - `thinking_delta` for thinking blocks
  - `input_json_delta` for tool arguments
- `content_block_stop` - Block completed
- `message_delta` - Usage updates
- `message_stop` - Response complete

**Fine-grained control:** Application can react to each block type differently.

### How We Support It

**Request Building:**
```typescript
// From Prompt (universal) → MessagesApiRequest
{
  model: config.model,
  system: prompt.baseInstructions,  // Separate from messages
  messages: convertToAnthropicMessages(prompt.input),
  tools: convertToolsForMessages(prompt.tools),
  max_tokens: config.maxTokens,
  thinking: {  // If extended reasoning enabled
    budget_tokens: config.thinkingBudget
  },
  stream: true
}
```

**Content Block Handling:**
```typescript
// Build message array from ResponseItems
messages: [
  {
    role: "user",
    content: [
      { type: "text", text: "Fix the tests" },
      { type: "tool_result", tool_use_id: "toolu_123", content: "..." }
    ]
  },
  {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "I need to analyze..." },
      { type: "text", text: "I'll fix the validation issue" },
      { type: "tool_use", id: "toolu_456", name: "apply_patch", input: {...} }
    ]
  }
]
```

**Streaming Adaptation:**
```typescript
// Messages events → ResponseEvent
{
  "content_block_delta": { delta: {type: "text_delta", text} }
    → ResponseEvent.OutputTextDelta(text)

  "content_block_delta": { delta: {type: "thinking_delta", thinking} }
    → ResponseEvent.ReasoningContentDelta(thinking)

  "content_block_stop": { index: N } (for tool_use block)
    → ResponseEvent.OutputItemAdded(toolCallItem)

  "message_delta": { usage }
    → ResponseEvent.TokenCount(usage)

  "message_stop": { }
    → ResponseEvent.Completed()
}
```

**Key Features Preserved:**
- Thinking blocks stream and display
- Content blocks maintain structure
- Tool use IDs for clean pairing
- Multi-modal content support (images, etc.)
- System prompt separation

---

## Shared Message Representation

### The Challenge

Different APIs have different native formats:

**Responses API:**
```typescript
{
  instructions: string,
  input: ResponseItem[],
  tools: Tool[]
}
```

**Chat API:**
```typescript
{
  messages: Message[]  // Array of {role, content}
}
```

**Messages API:**
```typescript
{
  system: string,
  messages: Message[]  // Array of {role, content: Block[]}
}
```

**Yet we store conversations once.**

### The Solution: ResponseItem as Universal Format

**ResponseItem captures all message types:**
```typescript
ResponseItem.Message { role, content }           // Text messages
ResponseItem.Reasoning { summary, content }      // Reasoning/thinking
ResponseItem.FunctionCall { name, args, id }     // Tool invocations
ResponseItem.FunctionCallOutput { id, output }   // Tool results
ResponseItem.ToolUse { id, name, input }         // Anthropic tool use
ResponseItem.ToolResult { id, content }          // Anthropic tool result
```

**Conversion happens at API boundary:**

**For Responses API:**
- ResponseItem[] used nearly directly in `input` field
- Tool calls already in expected format
- Reasoning extracted to `reasoning` parameter

**For Chat API:**
- ResponseItem[] converted to message array
- Reasoning attached to adjacent assistant messages
- Tool calls wrapped in function calling format
- Delta stream aggregated to complete messages

**For Messages API:**
- ResponseItem[] grouped by role into message array
- Each message contains content blocks
- Tool use/result mapped to specific block types
- Thinking blocks added when present
- System instructions placed in `system` field

### Example: Same History, Three Formats

**Stored in conversation_history:**
```typescript
[
  ResponseItem.Message { role: "user", content: "Fix tests" },
  ResponseItem.Reasoning { content: "Need to check validation..." },
  ResponseItem.Message { role: "assistant", content: "I'll fix it" },
  ResponseItem.FunctionCall { name: "apply_patch", args: {...}, id: "call_1" },
  ResponseItem.FunctionCallOutput { id: "call_1", output: {...} }
]
```

**Converted for Responses API:**
```typescript
{
  instructions: "[base instructions]",
  input: [
    {type: "message", role: "user", content: [{type: "input_text", text: "Fix tests"}]},
    {type: "reasoning", content: "Need to check validation..."},
    {type: "message", role: "assistant", content: [{type: "output_text", text: "I'll fix it"}]},
    {type: "function_call", name: "apply_patch", arguments: "...", call_id: "call_1"},
    {type: "function_call_output", call_id: "call_1", output: "..."}
  ]
}
```

**Converted for Chat API:**
```typescript
{
  messages: [
    {role: "system", content: "[base instructions]"},
    {role: "user", content: "Fix tests"},
    {role: "assistant", content: "I'll fix it", reasoning: "Need to check..."},
    {role: "assistant", tool_calls: [{id: "call_1", name: "apply_patch", arguments: "..."}]},
    {role: "tool", tool_call_id: "call_1", content: "..."}
  ]
}
```

**Converted for Messages API:**
```typescript
{
  system: "[base instructions]",
  messages: [
    {
      role: "user",
      content: [{type: "text", text: "Fix tests"}]
    },
    {
      role: "assistant",
      content: [
        {type: "thinking", thinking: "Need to check validation..."},
        {type: "text", text: "I'll fix it"},
        {type: "tool_use", id: "toolu_1", name: "apply_patch", input: {...}}
      ]
    },
    {
      role: "user",
      content: [{type: "tool_result", tool_use_id: "toolu_1", content: "..."}]
    }
  ]
}
```

**Same history, three native representations.**

---

## Feature Mapping Across APIs

### Reasoning/Thinking

**Responses API:**
- `reasoning.effort` parameter controls computation
- `reasoning.summary` controls visibility
- Streamed as `reasoning.content.delta` events
- Appears in response as reasoning item

**Chat API:**
- No native reasoning support
- Our adapter attaches reasoning to assistant messages
- Maps to "thoughts before response" pattern

**Messages API:**
- Native `thinking` content blocks
- Streamed as `thinking_delta` events
- Budget controlled via `thinking.budget_tokens`
- More detailed than Responses reasoning

**Our handling:**
- Store as ResponseItem.Reasoning (universal)
- Convert to API-native format on request
- Preserve model's internal process visibility

### Tool Calling

**Responses API:**
```typescript
// Request
tools: [{
  type: "function",
  name: "apply_patch",
  parameters: {...}
}]

// Response
{type: "function_call", name: "apply_patch", arguments: "...", call_id: "..."}
```
- Flat tool structure
- call_id for matching
- `tool_choice: "auto" | "required"`

**Chat API:**
```typescript
// Request
tools: [{
  type: "function",
  function: {
    name: "apply_patch",
    parameters: {...}
  }
}]

// Response
{
  tool_calls: [{id: "...", type: "function", function: {name: "...", arguments: "..."}}]
}
```
- Wrapped structure
- Parallel tool calls supported
- Function calling format

**Messages API:**
```typescript
// Request
tools: [{
  name: "apply_patch",
  input_schema: {...}  // JSON schema
}]

// Response
{type: "tool_use", id: "toolu_...", name: "apply_patch", input: {...}}
```
- Minimal tool structure
- Unique tool_use_id per invocation
- Tool results as content blocks

**Our handling:**
- Tools defined once in ToolSpec format
- Converted to API-native schema
- Tool execution results converted back
- Pairing preserved via IDs

### Structured Output

**Responses API:**
- Native structured output via `text.format`
- JSON schema validation
- Strict mode available

**Chat API:**
- Structured output via `response_format`
- JSON schema support

**Messages API:**
- No native structured output (as of current version)
- Can use tool calling for structured responses

**Our handling:**
- Prompt includes outputSchema when needed
- Convert to API-native format
- Map back to ResponseItem

---

## Request Building Process

### From Universal to API-Specific

**Input:** `Prompt` object containing:
- Conversation history as ResponseItem[]
- Available tools as ToolSpec[]
- Configuration (model, temperature, etc.)
- Optional output schema

### Responses API Conversion

**1. Build instructions:**
```typescript
instructions = prompt.baseInstructions || modelFamily.defaultInstructions
```

**2. Convert history:**
```typescript
input = prompt.input.map(item => {
  // ResponseItem → Responses API format
  // Preserve all item types
  return item; // Often minimal conversion needed
})
```

**3. Convert tools:**
```typescript
tools = prompt.tools.map(spec => ({
  type: "function",
  name: spec.name,
  description: spec.description,
  parameters: spec.schema
}))
```

**4. Add controls:**
```typescript
reasoning = {
  effort: config.reasoningEffort,
  summary: config.reasoningSummary
}
text = {
  verbosity: config.verbosity,
  format: config.outputSchema ? {schema: config.outputSchema} : undefined
}
```

**Result:** Request maximizes Responses API features.

### Messages API Conversion

**1. Build system prompt:**
```typescript
system = prompt.baseInstructions
```

**2. Group history by role:**
```typescript
messages = groupResponseItemsByRole(prompt.input).map(group => ({
  role: group.role,
  content: group.items.map(convertToContentBlock)
}))
```

**3. Convert to content blocks:**
```typescript
function convertToContentBlock(item: ResponseItem): ContentBlock {
  if (item.type === 'message') {
    return {type: "text", text: item.content};
  }
  if (item.type === 'reasoning') {
    return {type: "thinking", thinking: item.content};
  }
  if (item.type === 'function_call') {
    return {type: "tool_use", id: item.call_id, name: item.name, input: JSON.parse(item.arguments)};
  }
  if (item.type === 'function_call_output') {
    return {type: "tool_result", tool_use_id: item.call_id, content: item.output};
  }
  // ... etc
}
```

**4. Convert tools:**
```typescript
tools = prompt.tools.map(spec => ({
  name: spec.name,
  description: spec.description,
  input_schema: spec.schema  // Direct JSON schema
}))
```

**5. Add thinking controls:**
```typescript
thinking = config.thinkingBudget ? {
  budget_tokens: config.thinkingBudget
} : undefined
```

**Result:** Request uses Messages API's block structure and thinking capabilities.

---

## Response Processing

### Streaming Adaptation

**Challenge:** Each API streams differently, but application expects unified ResponseEvent stream.

**Solution:** Adapter layer per API.

### Responses API Adapter

**Events are nearly 1:1:**
```typescript
// Responses SSE → ResponseEvent (minimal adaptation)
response.item.added → OutputItemAdded
response.output.text.delta → OutputTextDelta
response.reasoning.content.delta → ReasoningContentDelta
response.completed → Completed
```

**Adapter adds:**
- Rate limit parsing
- Token usage aggregation
- Error normalization

### Chat API Adapter

**Delta aggregation required:**
```typescript
// Chat streams word-by-word deltas
{delta: {content: "The"}}
{delta: {content: " test"}}
{delta: {content: " failed"}}

// Aggregate to complete message
→ OutputTextDelta("The")
→ OutputTextDelta(" test")
→ OutputTextDelta(" failed")
→ OutputItemAdded(completeMessage)
```

**AggregatedChatStream:**
- Buffers deltas
- Emits delta events for streaming
- Finalizes complete message on done
- Matches Responses API event pattern

### Messages API Adapter

**Content block state machine:**
```typescript
class MessagesAdapter {
  private activeBlocks: Map<number, BlockState>;

  onEvent(evt: AnthropicSSE): ResponseEvent[] {
    switch (evt.type) {
      case 'content_block_start':
        // Initialize block tracking

      case 'content_block_delta':
        if (evt.delta.type === 'text_delta')
          return [OutputTextDelta(evt.delta.text)];
        if (evt.delta.type === 'thinking_delta')
          return [ReasoningContentDelta(evt.delta.thinking)];
        if (evt.delta.type === 'input_json_delta')
          // Accumulate tool arguments

      case 'content_block_stop':
        // Finalize tool calls

      case 'message_delta':
        return [TokenCount(evt.usage)];

      case 'message_stop':
        return [Completed()];
    }
  }
}
```

**Adapter manages:**
- Text block aggregation
- Thinking block extraction
- Tool argument assembly (streamed as JSON fragments)
- Usage tracking
- Block index → content mapping

---

## Tool Calling Across APIs

### Unified Tool Specification

**ToolSpec (internal format):**
```typescript
{
  name: "apply_patch",
  description: "Apply unified diff patch to files",
  schema: {
    type: "object",
    properties: {
      patch: {type: "string"},
      cwd: {type: "string"}
    },
    required: ["patch"]
  }
}
```

### API-Specific Conversion

**Responses API:**
```typescript
{
  type: "function",
  name: "apply_patch",
  description: "Apply unified diff patch to files",
  parameters: {
    type: "object",
    properties: { patch: {type: "string"}, cwd: {type: "string"} },
    required: ["patch"]
  }
}
```

**Chat API:**
```typescript
{
  type: "function",
  function: {  // Wrapped
    name: "apply_patch",
    description: "Apply unified diff patch to files",
    parameters: {
      type: "object",
      properties: { patch: {type: "string"}, cwd: {type: "string"} },
      required: ["patch"]
    }
  }
}
```

**Messages API:**
```typescript
{
  name: "apply_patch",
  description: "Apply unified diff patch to files",
  input_schema: {  // Direct schema
    type: "object",
    properties: { patch: {type: "string"}, cwd: {type: "string"} },
    required: ["patch"]
  }
}
```

**Tool execution is identical** - only request/response formats differ.

---

## Token Usage & Rate Limits

### Unified Tracking

**All APIs return usage data:**
```typescript
{
  input_tokens: number;
  output_tokens: number;
  // API-specific fields
}
```

**Responses API:**
- `prompt_tokens` (deprecated) or `input_tokens`
- `completion_tokens` (deprecated) or `output_tokens`
- `prompt_tokens_cached` (cache hits)

**Chat API:**
- `prompt_tokens`
- `completion_tokens`
- `cached_tokens` (prompt caching)

**Messages API:**
- `input_tokens`
- `output_tokens`
- `reasoning_tokens` (thinking block tokens)
- `cache_creation_input_tokens` (cache warming)
- `cache_read_input_tokens` (cache hits)

**Our normalization:**
```typescript
{
  input_tokens: usage.input_tokens || usage.prompt_tokens,
  output_tokens: usage.output_tokens || usage.completion_tokens,
  cached_input_tokens: usage.cache_read_input_tokens || usage.cached_tokens,
  reasoning_tokens: usage.reasoning_tokens  // Messages API only
}
```

### Rate Limit Handling

**Each API has different headers:**

**Responses API:**
- Standard OpenAI headers
- `x-ratelimit-remaining-tokens`
- `x-ratelimit-remaining-requests`

**Messages API:**
- `anthropic-ratelimit-requests-remaining`
- `anthropic-ratelimit-tokens-remaining`
- `anthropic-ratelimit-requests-reset`
- `anthropic-ratelimit-tokens-reset`

**Normalized to:**
```typescript
{
  requests: {
    limit: number;
    remaining: number;
    reset_at: timestamp;
  };
  tokens: {
    limit: number;
    remaining: number;
    reset_at: timestamp;
  };
}
```

---

## Benefits of This Architecture

### For Application Developers

**Single interface:**
```typescript
const client = new ModelClient(config);
const stream = await client.stream(prompt);

for await (const event of stream) {
  // Same event types regardless of provider
}
```

**Provider switching:**
```typescript
// Change provider in config
config.provider = {
  name: "Anthropic",
  wireApi: WireApi.Messages,
  model: "claude-sonnet-4.5"
};
// Same application code works
```

### For Model Capabilities

**Each model uses its API optimally:**

**GPT-5 on Responses API:**
- Reasoning effort control
- Verbosity tuning
- Semantic streaming

**Claude on Messages API:**
- Extended thinking blocks
- Content block structure
- Native tool use format

**Same conversation history feeds both** - no capability loss from abstraction.

### For System Integration

**Conversation history is provider-agnostic:**
- Single storage format
- Single retrieval interface
- Single compression pipeline (future)

**API details isolated in client layer:**
- Easy to add new providers
- Testing focuses on adapters
- Application code unaffected by API changes

---

## Implementation Details

### File Structure

```
codex-ts/src/core/client/
├── client.ts                    # Main ModelClient with dispatch
├── client-common.ts             # Shared types (ResponseEvent, Prompt)
├── model-provider-info.ts       # Provider registry with WireApi
├── chat-completions.ts          # Chat API implementation
├── responses-api.ts             # Responses API implementation (in client.ts)
├── messages/                    # Messages API implementation
│   ├── types.ts                 # Anthropic-specific types
│   ├── request-builder.ts       # Prompt → MessagesApiRequest
│   ├── sse-parser.ts            # SSE stream parsing
│   ├── adapter.ts               # Events → ResponseEvent
│   ├── tool-bridge.ts           # Tool conversion
│   └── transport.ts             # HTTP with auth
└── tool-converters.ts           # Tool schema conversion
```

### Key Components

**ModelClient:**
- Dispatches to API-specific implementation
- Manages authentication
- Handles retries and errors

**Request Builders:**
- Convert universal Prompt to API request
- Apply API-specific parameters
- Handle edge cases

**Streaming Adapters:**
- Parse SSE streams
- Maintain state machines
- Emit unified events

**Tool Converters:**
- Transform internal ToolSpec to API schema
- Handle special cases per API

---

## Testing Strategy

### Adapter Parity

**Goal:** Same input produces equivalent output across APIs (accounting for API differences).

**Tests:**
- Same prompt → all 3 APIs
- Verify event sequences similar
- Verify tool calling works identically
- Verify reasoning/thinking captured

### Feature Preservation

**Tests per API:**
- Reasoning controls work (Responses)
- Thinking blocks stream (Messages)
- Delta aggregation correct (Chat)
- Tool calling round-trip complete
- Error handling consistent

### Conversion Accuracy

**Tests:**
- ResponseItem[] → API request → accurate conversion
- API response → ResponseEvent stream → correct parsing
- Tool format conversion lossless

---

## Future Extensibility

### Adding New Providers

**Pattern to follow:**
1. Add to WireApi enum
2. Create provider directory
3. Implement request builder
4. Implement streaming adapter
5. Implement tool converter (if format differs)
6. Add to ModelClient dispatch

**Candidates:**
- Google Gemini (native API)
- Cohere
- AI21
- Custom providers

### Provider-Specific Optimizations

**When beneficial:**
- Provider has unique capability
- Capability adds value
- Can map to ResponseItem cleanly

**When to avoid:**
- Feature too provider-specific
- No clear universal mapping
- Marginal benefit

---

## Conclusion

By maintaining conversation history in a universal format (ResponseItem[]) and converting at API boundaries, we enable:
1. OpenAI models to use Responses API's advanced features (reasoning controls, verbosity, semantic streaming)
2. Anthropic models to use Messages API's native capabilities (thinking blocks, content blocks, tool use semantics)
3. Seamless provider switching without conversation loss
4. Future provider additions without core changes

The same conversation history serves all providers optimally. Each API receives requests in its preferred format, uses its native features, and the application sees a consistent interface.

This architecture supports the planned memory compression system (Enhancement 3) because compression operates on the universal ResponseItem[] format, independent of which API will eventually receive the compressed history.

**Result:** Multi-provider support without sacrificing any provider's capabilities.
