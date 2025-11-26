# Response & Messages API Details

Documentation of how OpenAI Responses API and Anthropic Messages API handle conversation history and what formats are used.

---

## OpenAI Responses API

### Conversation History Options

The Responses API supports **two approaches** for conversation continuity:

#### Option 1: Stateful with `previous_response_id`
```json
{
  "model": "gpt-5-mini",
  "previous_response_id": "resp_abc123",
  "input": [
    {"role": "user", "content": [{"type": "input_text", "text": "What about 3+3?"}]}
  ]
}
```

- OpenAI loads full conversation history automatically
- Smaller payloads (just current turn)
- Preserved reasoning state across turns
- Model performs ~5% better on benchmarks (TAUBench)

#### Option 2: Explicit history
```json
{
  "model": "gpt-5-mini",
  "input": [
    {"role": "user", "content": [{"type": "input_text", "text": "What's 2+2?"}]},
    {"role": "assistant", "content": [{"type": "output_text", "text": "4"}]},
    {"type": "reasoning", "summary": [...], "content": [...]},
    {"role": "user", "content": [{"type": "input_text", "text": "What about 3+3?"}]}
  ]
}
```

- Send full array of ResponseItems
- Includes messages, reasoning, tool calls, tool outputs
- **Reasoning from previous turns IS included**

### What codex-ts does

Sends explicit history with reasoning:
- Calls `getHistoryForPrompt()` to get all ResponseItems
- Sends to OpenAI as `input` array
- Reasoning items included unchanged

---

## Anthropic Messages API

### Conversation History (Required)

The Messages API is **stateless** - you must send full conversation history every time.

```json
{
  "model": "claude-sonnet-4.5",
  "messages": [
    {"role": "user", "content": "What's 2+2?"},
    {"role": "assistant", "content": "4"},
    {"role": "user", "content": "What about 3+3?"}
  ]
}
```

### No Session ID

The `message_id` returned (e.g., `"msg_013Zva2CMHLNnXjNJJKqJ2EF"`) is just an identifier for that specific response, **not a conversation session reference**. You cannot use it to say "continue from here" like OpenAI's `previous_response_id`.

### What Gets Sent

**Included in history:**
- User messages (text)
- Assistant messages (text)
- Tool calls (as tool_use blocks)
- Tool outputs (as tool_result blocks)

**NOT included:**
- Reasoning/thinking from previous turns

### What codex-ts does

Filters history when sending to Anthropic:

```typescript
// codex-ts/src/core/client/messages/request-builder.ts
function convertMessages(items: ResponseItem[]): AnthropicMessage[] {
  const messages = [];

  for (const item of items) {
    switch (item.type) {
      case "message": { /* convert */ }
      case "function_call": { /* convert to tool_use */ }
      case "function_call_output": { /* convert to tool_result */ }

      default:
        // Ignore others for now  ← reasoning falls here
        break;
    }
  }

  return messages;
}
```

**Reasoning items are explicitly ignored.**

---

## Storage Format (Convex)

Both providers store the same way - full Response object in `messages` table:

```json
{
  "runId": "550e8400-...",
  "turnId": "...",
  "threadId": "...",
  "modelId": "claude-sonnet-4.5",
  "providerId": "anthropic",
  "status": "complete",
  "outputItems": [
    {
      "id": "item-1",
      "type": "message",
      "content": "What's the weather in SF?",
      "origin": "user"
    },
    {
      "id": "item-2",
      "type": "reasoning",
      "content": "I need to check the weather...",
      "origin": "agent"
    },
    {
      "id": "item-3",
      "type": "function_call",
      "name": "get_weather",
      "arguments": "{\"location\":\"SF\"}",
      "call_id": "call_abc",
      "origin": "agent"
    },
    {
      "id": "item-4",
      "type": "function_call_output",
      "call_id": "call_abc",
      "output": "{\"temp\":58}",
      "success": true,
      "origin": "system"
    },
    {
      "id": "item-5",
      "type": "message",
      "content": "It's 58°F in San Francisco.",
      "origin": "agent"
    }
  ],
  "usage": {
    "promptTokens": 145,
    "completionTokens": 89,
    "totalTokens": 234
  }
}
```

**Same shape for both providers.** Storage is provider-agnostic.

---

## UI Rendering (Client)

### Streaming
```
StreamEvents → ResponseReducer → OutputItems → UI upsert
```

### Refresh (Non-Streaming)
```
GET /api/v2/threads/:id → Response.output_items → UI upsert
```

### Upsert Pattern

Each OutputItem acts as an upsert for its UI container:

```javascript
const existing = getRenderedElement(item.id);

if (existing) {
  updateContent(existing, item);  // UPDATE
} else {
  createContainer(item);           // INSERT
}
```

**Same rendering code** for streaming and refresh. OutputItems are idempotent.

---

## Summary Table

| Feature | OpenAI Responses | Anthropic Messages |
|---------|-----------------|-------------------|
| **Conversation state** | Stateful (optional) | Stateless |
| **History reference** | `previous_response_id` | None |
| **Explicit history** | Optional | Required |
| **Reasoning in history** | Yes (when explicit) | No |
| **Format** | ResponseItem[] as `input` | AnthropicMessage[] as `messages` |
| **Storage** | Response with OutputItems | Response with OutputItems |

---

## Implementation Status (cody-fastify)

### Current State
- Adapters only send current prompt (no history)
- Multi-turn context NOT implemented
- Each turn is independent

### What's Needed
For proper multi-turn:
1. Load previous turns from Convex
2. Convert OutputItems → provider format
3. For OpenAI: include reasoning items in input
4. For Anthropic: filter out reasoning items from messages
5. Send with current prompt

### Reference Implementation
See codex-ts:
- `src/core/conversation-history/index.ts` - history management
- `src/core/client/responses/client.ts` - OpenAI Responses format (includes reasoning)
- `src/core/client/messages/request-builder.ts` - Anthropic Messages format (excludes reasoning)
