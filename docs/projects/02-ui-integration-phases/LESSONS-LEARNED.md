# Lessons Learned - Project 02 Phase 1-2

**Date:** November 13, 2025
**Context:** Issues discovered during Phase 1-2 manual testing

---

## Issues Found

### Issue 1: Incomplete Response Mapping
**Location:** `codex-ts/src/core/client/responses/client.ts` - `mapOutputToResponseItems()`

**Problem:** Function only maps `type: "message"` items. Silently filters out:
- `type: "reasoning"` (thinking blocks)
- `type: "function_call"` (tool calls)

**Result:** API returns 2 items → Mapper returns 0 items → No response displayed

**Root cause:** Phase 1 created incomplete mapper, Phase 2 assumed it worked, tests never exercised it.

---

### Issue 2: No Tool Usage Instructions
**Location:** `codex-ts/src/core/client/responses/client.ts` - system prompt

**Problem:** System prompt is just "You are Cody, a helpful AI assistant." - no guidance on:
- When to use tools
- How to structure tool calls
- What tools are available beyond schemas

**Result:** Model may not use tools effectively or may format calls incorrectly.

---

### Issue 3: Empty Tool Parameter Schemas
**Location:** Tool registry / tool spec generation

**Problem:** Tools sent to API have `"properties": {}` - no parameter definitions.

**Result:** Model doesn't know what parameters tools accept, leading to malformed calls.

---

## Core Lesson: Mock at the Right Boundary

**What we did wrong:**

```typescript
// Our test approach
const mockClient = createMockClient([
  [{type: "function_call", name: "exec", ...}]  // Pre-formed ResponseItem
]);
```

**Why this failed:**
- Bypassed the client's mapping layer entirely
- Never tested: API JSON → ResponseItem conversion
- Bug in mapping function went undetected

**What we should have done:**

**Option A: Mock at HTTP boundary**
```typescript
// Mock fetch() to return raw API JSON
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: async () => JSON.stringify({
    output: [
      {type: "function_call", name: "exec", arguments: "..."}
    ]
  })
});

// Now test the REAL client
const client = new ResponsesClient({...});
const items = await client.sendMessage(prompt);
// This tests the full mapping logic
```

**Option B: Add integration tests with real API**
```typescript
// Use actual API with cheap model
const client = new ResponsesClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini"  // Cheap model
});

const items = await client.sendMessage({
  input: [{role: "user", content: "read /tmp/test.txt"}],
  tools: toolRegistry.getToolSpecs()
});

// Verify real API responses map correctly
expect(items).toContainEqual(
  expect.objectContaining({type: "function_call"})
);
```

---

## Service-Mocked Testing Guidelines (Updated)

### 1. Identify the Right Boundary

**Ask:** What external dependency are we actually mocking?

**For ModelClient:**
- External dependency: **HTTP API** (OpenAI/Anthropic servers)
- NOT the client wrapper code itself
- Mock at HTTP (fetch/axios), not at ModelClient interface

**General rule:** Mock the I/O operation (network, filesystem, process), not the business logic wrapper.

---

### 2. Test the Adapter Layer

**Adapters** (API response → internal types) are critical and fragile:

```
Raw API JSON → Parsing/Mapping → Internal Types
     ↑              ↑                  ↑
  External      MUST TEST         Internal
  (mock this)   (this layer)      (assume works)
```

**For each adapter:**
1. Mock the raw input (actual API format)
2. Exercise the parsing/mapping logic
3. Verify output format matches internal types

**Example:**
```typescript
describe('ResponsesClient adapter', () => {
  it('maps function_call items correctly', async () => {
    // Mock fetch to return actual Responses API format
    global.fetch = mockApiResponse({
      output: [
        {
          type: "function_call",
          name: "exec",
          call_id: "call-123",
          arguments: JSON.stringify({cmd: ["test"]})
        }
      ]
    });

    const client = new ResponsesClient({...});
    const items = await client.sendMessage(prompt);

    // Verify mapping worked
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "function_call",
      name: "exec",
      call_id: "call-123"
    });
  });

  it('maps reasoning items correctly', async () => {
    global.fetch = mockApiResponse({
      output: [{type: "reasoning", summary: [...]}]
    });

    const items = await client.sendMessage(prompt);
    expect(items[0].type).toBe("reasoning");
  });
});
```

---

### 3. Don't Over-Mock Integration Tests

**Anti-pattern:**
```typescript
// Too high-level - misses adapter bugs
const mockClient = {sendMessage: vi.fn(() => [fakeItems])}
```

**Better:**
```typescript
// Mock HTTP, test real client
mockFetch(rawApiJson);
const items = await realClient.sendMessage();
```

**Best:**
```typescript
// Occasional real API test (cheap model)
const items = await realClient.sendMessage(); // Actual network call
```

---

### 4. Test What the Real API Returns

**Before writing mocks, capture real API responses:**

```bash
# Call real API, save response
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -d '{"model": "gpt-4o-mini", "messages": [...], "tools": [...]}' \
  > real-response.json
```

**Then mock with actual structure:**
```typescript
const realResponse = JSON.parse(fs.readFileSync('real-response.json'));
global.fetch = vi.fn(() => ({
  ok: true,
  text: async () => JSON.stringify(realResponse)
}));
```

This ensures mocks match reality.

---

### 5. Layer Your Tests

**Layer 1: Unit tests** (existing from port)
- Individual functions, isolated
- Fast, deterministic

**Layer 2: Service-mocked tests** (what we're building)
- Mock at I/O boundaries (HTTP, filesystem, process)
- Test adapters and integration logic
- Still fast and offline

**Layer 3: Integration tests** (what we're missing)
- Real APIs with cheap models
- Occasional, manual, validates reality
- Catches assumptions about API behavior

**We had Layer 1 and partial Layer 2. We're missing Layer 3 entirely.**

---

## Specific Recommendations

### For Client Adapters

Always test:
- ✅ Message items (type: "message")
- ✅ Reasoning items (type: "reasoning")
- ✅ Function call items (type: "function_call")
- ✅ Function output items (type: "function_call_output")
- ✅ Error responses
- ✅ Empty responses
- ✅ Malformed responses

### For Tool Integration

Test at multiple levels:
- ✅ ToolRouter with mocked handlers (logic)
- ✅ Real client + mocked HTTP with tool call JSON (adapter)
- ✅ Real API call requesting tool (integration, manual/occasional)

### For System Prompts

Verify:
- ✅ Instructions mention tools
- ✅ Tool usage patterns explained
- ✅ Examples of good tool calls (if model struggles)

### For Tool Specs

Validate:
- ✅ All tools have complete parameter schemas
- ✅ Descriptions are clear
- ✅ Required vs optional fields specified
- ✅ Test by inspecting actual API request body

---

## Action Items

**For Phase 2 fixes:**

1. Fix `mapOutputToResponseItems()` to handle all Responses API output types
2. Add tool usage instructions to system prompt
3. Verify tool specs have complete parameter schemas
4. Add HTTP-level mocking for client tests (or integration tests)
5. Add debug logging (or remove after fixing issues)

**For future phases:**

1. Always test adapters at I/O boundary (mock HTTP/filesystem/process, not wrapper)
2. Include integration tests with real APIs (cheap models, key scenarios)
3. Audit ported code for completeness before assuming it works
4. Specify in prompts when ported code needs enhancement
5. Verify mocks match actual API responses (capture real responses first)

---

## Key Insight

**Service-mocked tests are only as good as the mock boundary.**

If you mock too high (at ModelClient interface), you bypass critical adapter logic and miss bugs.

**Mock at the I/O operation (fetch/fs/exec), not at the business logic wrapper.**

This way you test:
- ✅ The real adapter/mapping code
- ✅ Error handling in parsing
- ✅ Edge cases in API responses
- ✅ Integration between layers

While still keeping tests:
- ✅ Fast (no real network/API keys)
- ✅ Deterministic (controlled responses)
- ✅ Offline (no external dependencies)

---

**End of Lessons Learned**
