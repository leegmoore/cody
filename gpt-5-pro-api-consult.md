# GPT-5-Pro API Integration Consultation

**Role:** Senior API Architect & TypeScript Expert

**Task:** Design the integration of Anthropic Messages API into the Codex TypeScript client architecture, maintaining the existing provider abstraction while allowing each API to leverage its native capabilities.

---

## Project Background

**Project:** Codex TypeScript Port
**Goal:** Port Codex from Rust to TypeScript to create `@openai/codex-core`, a pure TypeScript library for AI coding agents that works without subprocess overhead.

**Repository:** `/Users/leemoore/code/codex-port-02`

**Current Architecture:**
- **Rust source:** `codex-rs/` (original implementation)
- **TypeScript port:** `codex-ts/` (in progress)
- **Strategy:** Test-Driven Development with stateless session tracking via markdown logs

---

## Port Status (What's Complete)

### Phase 1: Protocol Layer ✅
- **Completed:** 2025-11-05
- **Modules:** 8 protocol modules (283 tests, 100% passing)
- **Location:** `codex-ts/src/protocol/`
- **Key files:**
  - `protocol/protocol.ts` - Event, EventMsg, Op types
  - `protocol/models.ts` - ResponseItem, ResponseInputItem
  - `protocol/items.ts` - TurnItem types
  - `protocol/config-types.ts` - Configuration enums

### Phase 2: Configuration & Persistence ✅
- **Completed:** 2025-11-05
- **Modules:** 4 core modules (87 tests, 100% passing)
- **Location:** `codex-ts/src/core/`
- **Key files:**
  - `core/config.ts` - Configuration management
  - `core/config-loader.ts` - TOML loading with smol-toml
  - `core/message-history.ts` - Conversation tracking
  - `core/rollout.ts` - Persistence to JSONL

### Phase 3: Execution & Tools ✅
- **Completed:** 2025-11-06
- **Modules:** 7 modules (163 tests, 100% passing)
- **Location:** `codex-ts/src/`
- **Key files:**
  - `apply-patch/` - File patch application
  - `file-search/` - Fuzzy file search
  - `execpolicy/` - Execution policies
  - `core/sandboxing/` - Platform sandboxing
  - `core/exec/` - Command execution engine
  - `core/tools/` - Tool formatting utilities

### Phase 4: Model Integration (IN PROGRESS)
- **Started:** 2025-11-06
- **Completed:** 2/9 modules (57 tests, 100% passing)
- **Location:** `codex-ts/src/`
- **Completed modules:**
  - `mcp-types/` - MCP type definitions (12 tests)
  - `ollama/` - Complete Ollama client (45 tests)
- **Next:** `core/client`, `core/chat_completions`, Anthropic Messages API

**Total Progress:** 695 tests passing across all phases

---

## Current Client Architecture (Rust - To Be Ported)

### Provider Abstraction Pattern

**Location:** `codex-rs/core/src/model_provider_info.rs`

**Key Concept:** `WireApi` enum distinguishes between protocol types:
```rust
pub enum WireApi {
    Responses,  // OpenAI /v1/responses (new, experimental)
    Chat,       // OpenAI /v1/chat/completions (classic)
}

pub struct ModelProviderInfo {
    name: String,
    base_url: Option<String>,
    wire_api: WireApi,  // ← Declares which protocol
    // ... retry config, headers, etc
}
```

### Two API Implementations

**1. Responses API Implementation**
**Location:** `codex-rs/core/src/client.rs`
**Lines:** 1,474
**Key method:** `stream_responses()`
- Uses `/v1/responses` endpoint
- Request format: `ResponsesApiRequest` struct
- Streaming: SSE events with semantic types
- Tool format: `create_tools_json_for_responses_api()`

**2. Chat Completions API Implementation**
**Location:** `codex-rs/core/src/chat_completions.rs`
**Lines:** 967
**Key method:** `stream_chat_completions()`
- Uses `/v1/chat/completions` endpoint
- Request format: messages array with roles
- Streaming: SSE with delta events
- Tool format: `create_tools_json_for_chat_completions_api()`
- **Adapter:** `AggregatedChatStream` converts deltas → complete messages

### Common Output Format

**Location:** `codex-rs/core/src/client_common.rs`

**Unified streaming interface:**
```rust
pub enum ResponseEvent {
    Created,
    OutputItemDone(ResponseItem),
    OutputItemAdded(ResponseItem),
    Completed { response_id, token_usage },
    OutputTextDelta(String),
    ReasoningSummaryDelta(String),
    // ... more event types
}

pub struct ResponseStream {
    rx_event: mpsc::Receiver<Result<ResponseEvent>>,
}
```

**Both APIs produce `ResponseStream`** - this is the magic!

### How It Works Currently

**In `ModelClient::stream()`:**
```rust
pub async fn stream(&self, prompt: &Prompt) -> Result<ResponseStream> {
    match self.provider.wire_api {
        WireApi::Responses => self.stream_responses(prompt).await,
        WireApi::Chat => {
            let stream = stream_chat_completions(...).await?;
            // Adapter converts Chat deltas to Responses-like events
            let aggregated = stream.aggregate();
            // Bridge to ResponseStream
            Ok(ResponseStream { rx_event: rx })
        }
    }
}
```

### Tool Format Conversion

**Location:** `codex-rs/core/src/tools/spec.rs`

**Two converters exist:**
```rust
pub fn create_tools_json_for_responses_api(tools) -> Vec<Value>
pub fn create_tools_json_for_chat_completions_api(tools) -> Vec<Value>
```

**Pattern:** Start with Responses format, transform for Chat:
```rust
// Chat format wraps the function differently
{
  "type": "function",
  "function": { ... }  // ← Nested
}

// Responses format is flatter
{
  "type": "function",
  "name": "...",
  "description": "...",
  // ...
}
```

---

## Your Goal: Add Anthropic Messages API

### What We Want

**Extend the provider pattern to support 3 APIs:**
1. OpenAI Responses API (existing)
2. OpenAI Chat Completions API (existing)
3. **Anthropic Messages API** (NEW)

### Design Requirements

**1. Maintain Provider Abstraction**
- Extend `WireApi` enum to include `Messages`
- Each API can use its native capabilities
- Common `ResponseStream` output format

**2. API-Specific Optimizations**
- **Responses API:** Use semantic streaming, reasoning controls, native tool format
- **Chat API:** Use delta streaming with aggregation, function calling
- **Messages API:** Use Anthropic's thinking blocks, tool use format, streaming events

**3. Unified Tool Harness**
- Tool execution is the same (apply_patch, exec, file_search, etc.)
- Only tool **format** differs between APIs
- Need adapter: `create_tools_json_for_messages_api()`

**4. Common Streaming Format**
- All 3 APIs produce `ResponseStream`
- All emit `ResponseEvent` enum
- Adapters handle conversion

### What You Need to Design

**1. WireApi Extension**
```typescript
enum WireApi {
  Responses,  // OpenAI
  Chat,       // OpenAI
  Messages,   // Anthropic ← ADD THIS
}
```

**2. Messages API Streaming Adapter**
How to convert Anthropic's SSE events → `ResponseEvent`?

**3. Tool Format Converter**
How to convert `ToolSpec` → Anthropic Messages tool format?

**4. Request/Response Handling**
What's the equivalent of `ResponsesApiRequest` for Messages API?

**5. Integration Points**
How does this fit into existing `ModelClient::stream()`?

---

## API Documentation References

### OpenAI Responses API
**Official Docs:** https://platform.openai.com/docs/guides/responses-vs-chat-completions?api-mode=responses

**Key characteristics:**
- Semantic streaming (event-driven)
- Native tool calling
- Reasoning controls (effort, summary)
- Structured output support
- Request format: `ResponsesApiRequest`

**Tool format:**
```json
{
  "type": "function",
  "name": "apply_patch",
  "description": "...",
  "parameters": { JSON Schema }
}
```

### OpenAI Chat Completions API
**Official Docs:** https://platform.openai.com/docs/guides/function-calling?api-mode=chat

**Key characteristics:**
- Delta streaming (incremental text chunks)
- Function calling (wrapped format)
- Messages array with roles
- Requires aggregation adapter

**Tool format:**
```json
{
  "type": "function",
  "function": {
    "name": "apply_patch",
    "description": "...",
    "parameters": { JSON Schema }
  }
}
```

### Anthropic Messages API
**Official Docs:** https://docs.claude.com/en/api/messages
**Tool Use Docs:** https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview

**Key characteristics (from research):**
- Streaming with server-sent events
- Tool use with `tool_use` and `tool_result` content blocks
- Thinking blocks for reasoning
- Authentication: `x-api-key` header + `anthropic-version` header
- Request format: messages array with content blocks

**Tool format:**
```json
{
  "name": "apply_patch",
  "description": "...",
  "input_schema": { JSON Schema }
}
```

**Tool use response:**
```json
{
  "type": "tool_use",
  "id": "toolu_...",
  "name": "apply_patch",
  "input": { ... }
}
```

**Tool result format:**
```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_...",
  "content": "..."
}
```

---

## Relevant Code Files to Review

### Rust Source (Reference Implementation)

**Core client files:**
1. `codex-rs/core/src/client.rs` - ModelClient, Responses API implementation
2. `codex-rs/core/src/chat_completions.rs` - Chat API implementation + adapter
3. `codex-rs/core/src/client_common.rs` - ResponseStream, ResponseEvent, Prompt
4. `codex-rs/core/src/model_provider_info.rs` - WireApi enum, ModelProviderInfo
5. `codex-rs/core/src/tools/spec.rs` - Tool format conversions

**Tests:**
6. `codex-rs/core/tests/suite/client.rs` - Client integration tests (1,468 lines)
7. `codex-rs/core/tests/chat_completions_sse.rs` - Chat streaming tests
8. `codex-rs/core/tests/responses_headers.rs` - Responses API tests

### TypeScript Port (Current Progress)

**Protocol types (Phase 1):**
9. `codex-ts/src/protocol/protocol.ts` - Event system
10. `codex-ts/src/protocol/models.ts` - ResponseItem types
11. `codex-ts/src/protocol/items.ts` - TurnItem types

**Core infrastructure (Phases 2-3):**
12. `codex-ts/src/core/config.ts` - Configuration
13. `codex-ts/src/core/tools/` - Tool utilities
14. `codex-ts/src/core/exec/` - Execution engine

**Completed Phase 4 modules:**
15. `codex-ts/src/mcp-types/` - MCP integration
16. `codex-ts/src/ollama/client.ts` - Ollama client example

**Project documentation:**
17. `codex-ts/PORT_LOG_MASTER.md` - Overall status
18. `codex-ts/DEV_STANDARDS.md` - Code standards
19. `PORT-PHASES/phase-4/STATUS.md` - Current phase progress

---

## Your Consulting Task

### Phase 4.1: Port Existing Client Architecture

**What needs porting (do NOT design this - just acknowledge it exists):**
- core/client (Responses API)
- core/chat_completions (Chat API + aggregation adapter)
- Tool format converters for both APIs
- Stub auth for testing

### Phase 4.2: Design Anthropic Messages API Integration

**This is where you focus your expertise.**

**Design Requirements:**

**1. Architecture Design**
- How to extend `WireApi` enum to include `Messages`
- Where does Messages API implementation live? (new file? extend client.ts?)
- How to structure the streaming adapter for Messages API
- Integration points in existing `ModelClient.stream()` method

**2. Request/Response Handling**
- Define Messages API request format (TypeScript interface)
- Define Messages API response parsing
- How to handle Anthropic's content blocks (text, tool_use, thinking)
- How to map to existing `ResponseItem` types

**3. Streaming Event Adapter**
- Anthropic SSE events → `ResponseEvent` enum mapping
- How to handle thinking blocks → reasoning events
- How to handle tool_use blocks → tool call events
- How to preserve Anthropic-specific capabilities while fitting common format

**4. Tool Format Conversion**
- Design `create_tools_json_for_messages_api()` function
- Convert internal `ToolSpec` → Anthropic tool schema
- Handle tool results (tool_result content blocks)
- Ensure tool calling round-trip works correctly

**5. Capability Preservation**
Design decisions for API-specific features:

**Responses API specific:**
- Reasoning effort/summary controls
- Semantic streaming events
- Native structured output

**Chat API specific:**
- Function calling format
- Delta aggregation strategy
- Parallel tool calls

**Messages API specific:**
- Thinking blocks (extended reasoning)
- Tool use with unique IDs
- Content block architecture
- Multiple content types per message

**How to balance:** Allow each API to shine while maintaining common interface?

**6. Comprehensive Unit Test Suite**

**Critical:** Design tests BEFORE implementation (TDD approach).

**Test categories needed:**
- **Request formatting tests** - ToolSpec → Messages API format
- **Response parsing tests** - Messages API response → ResponseItem
- **Streaming adapter tests** - SSE events → ResponseEvent
- **Tool calling round-trip tests** - Send tool → execute → return result
- **Error handling tests** - API errors, rate limits, network failures
- **Integration tests** - Full conversation with tool use
- **Compatibility tests** - Same tool works across all 3 APIs

**Provide:** Complete test specifications with:
- Test descriptions
- Input data structures
- Expected outputs
- Edge cases to cover
- Mock data examples

---

## Technical Constraints

### Must Maintain

1. **Common `ResponseStream` format** - All APIs produce this
2. **Provider abstraction** - Easy to add new providers
3. **Tool execution is shared** - Only format differs
4. **100% test pass rate** - No regressions
5. **Type safety** - Strict TypeScript, no `any` types

### Can Modify

6. **Internal adapter architecture** - Refactor if needed for cleaner design
7. **Event type mappings** - Extend `ResponseEvent` if needed for Messages API
8. **Tool format converters** - Add new conversion functions
9. **Request builders** - Add Messages-specific request formatting

### Dependencies Available

- `@modelcontextprotocol/sdk` - MCP types (already integrated)
- `smol-toml` - TOML parsing (already installed)
- Native `fetch` API - HTTP client (Node.js 18+)
- Vitest - Testing framework

---

## Research Required

**Before designing, research:**

1. **Anthropic Messages API streaming format**
   - What SSE event types exist?
   - How are deltas vs complete messages handled?
   - How are thinking blocks delivered?

2. **Anthropic tool calling flow**
   - Request: How are tools defined in request?
   - Response: How does Claude indicate tool use?
   - Result: How are tool results sent back?
   - Multi-turn: How does conversation continue after tools?

3. **OpenAI Responses API comparison**
   - What are the key differences vs Messages API?
   - Can we map Messages API concepts to Responses API concepts?
   - What's lost/gained in the translation?

4. **OpenAI Chat API comparison**
   - How does Chat's function calling differ from Messages' tool use?
   - How do aggregation strategies differ?
   - What can we learn from the existing Chat → Responses adapter?

---

## Deliverables Required

### 1. Architecture Design Document

**Sections needed:**
- **Overview:** High-level architecture diagram
- **WireApi Extension:** How to add Messages to the enum
- **File Structure:** Where does Messages API code live?
- **Class/Interface Design:** New types, interfaces, adapters
- **Integration Points:** How it plugs into existing ModelClient
- **Data Flow:** Request → API → Response → Adapter → ResponseStream
- **Error Handling:** Messages API errors → common error types

### 2. Streaming Event Mapping

**Provide table:**
| Anthropic Event | ResponseEvent Mapping | Notes |
|-----------------|----------------------|-------|
| message_start | ResponseEvent::Created | ... |
| content_block_start | ? | ... |
| thinking block | ResponseEvent::ReasoningContentDelta | ... |
| tool_use block | ResponseEvent::OutputItemAdded | ... |
| ... | ... | ... |

### 3. Tool Format Specification

**Provide:**
- Input: `ToolSpec` (internal format)
- Output: Anthropic tool schema (JSON example)
- Conversion algorithm pseudocode
- Edge cases (optional params, complex schemas, etc.)

### 4. Request/Response Type Definitions

**Provide TypeScript interfaces:**
```typescript
// Messages API request format
interface MessagesApiRequest {
  model: string
  messages: Message[]
  tools?: Tool[]
  // ... what else?
}

// Messages API response format
interface MessagesApiResponse {
  // ... what fields?
}

// Tool definition format
interface AnthropicTool {
  name: string
  description?: string
  input_schema: JSONSchema
}
```

### 5. Implementation Plan

**Step-by-step:**
1. Extend WireApi enum
2. Create messages-api.ts file (or appropriate structure)
3. Implement request builder
4. Implement SSE event parser
5. Implement streaming adapter
6. Implement tool format converter
7. Integrate into ModelClient
8. Wire up tool calling round-trip

**For each step:** What files to create/modify, what functions to implement

### 6. Comprehensive Test Suite Specification

**Critical: Design tests FIRST (TDD)**

**Minimum test coverage:**
- Request formatting (15+ tests)
- Response parsing (20+ tests)
- Streaming events (25+ tests)
- Tool calling (30+ tests)
- Error handling (15+ tests)
- Integration (10+ tests)

**For each test category, specify:**
- Test description
- Setup code
- Input data
- Expected output
- Assertions to make
- Mock strategies

**Example format:**
```typescript
describe('Messages API Tool Calling', () => {
  test('converts ToolSpec to Anthropic tool format', () => {
    const toolSpec = { /* ... */ }
    const anthropicTool = convertToMessagesApiTool(toolSpec)
    expect(anthropicTool).toEqual({
      name: "apply_patch",
      description: "...",
      input_schema: { /* ... */ }
    })
  })

  // ... 29 more tool calling tests
})
```

### 7. Risk Assessment & Mitigation

**Identify risks:**
- What could go wrong with this integration?
- What are the tricky edge cases?
- Where might the abstraction leak?
- How to handle Messages-specific features that don't map to Responses/Chat?

**Provide mitigation strategies for each risk.**

### 8. Future Extensibility

**Design for:**
- Adding more providers (Google, Cohere, etc.)
- New API versions (Messages v2, Responses v2)
- Provider-specific features (extended thinking, multi-modal, etc.)

**Provide:** Guidelines for adding future providers

---

## Specific Questions to Answer

1. **Streaming Architecture:**
   - How do Anthropic's SSE events map to `ResponseEvent`?
   - Do we need new `ResponseEvent` variants for Messages-specific features?
   - How to handle thinking blocks elegantly?

2. **Tool Calling:**
   - Tool use IDs in Messages API - how to track them?
   - Multi-step tool calling - how does it differ from Responses/Chat?
   - Tool result formatting - how to convert back?

3. **Content Blocks:**
   - Messages API uses content block arrays - how to flatten to ResponseItem?
   - Text + tool_use + thinking in same message - how to handle?
   - Image content blocks - map to existing image handling?

4. **Error Handling:**
   - Anthropic error format vs OpenAI error format
   - Rate limiting differences
   - How to unify error handling?

5. **Testing Strategy:**
   - How to mock Anthropic SSE streams?
   - How to verify tool calling works end-to-end?
   - How to test all 3 APIs produce equivalent output?

6. **Performance:**
   - Any streaming performance differences?
   - Buffer sizes, backpressure handling?
   - Optimal adapter architecture?

---

## Output Format

**Provide your response as a structured design document with:**

### Executive Summary
- Key design decisions
- What changes to existing code
- What new code is needed
- Estimated complexity

### Detailed Design

**Section 1: Architecture**
- Diagrams (ASCII art is fine)
- File structure
- Class/interface hierarchy
- Data flow

**Section 2: API Integration**
- WireApi extension
- Messages API request builder
- Messages API response parser
- Streaming adapter design

**Section 3: Tool Harness**
- Tool format conversion
- Tool calling flow
- Tool result handling

**Section 4: Test Specifications**
- Complete test suite design
- Test data examples
- Mock strategies
- Coverage targets

**Section 5: Implementation Plan**
- Step-by-step porting guide
- Files to create/modify
- Order of operations
- Integration checkpoints

**Section 6: Risks & Mitigations**
- Identified risks
- Mitigation strategies
- Fallback plans

### Code Examples

**Provide concrete TypeScript code examples for:**
- Extended WireApi enum
- MessagesApiRequest interface
- Streaming adapter implementation (core logic)
- Tool format converter function
- Example test cases

---

## Success Criteria

Your design is successful if:

1. ✅ All 3 APIs (Responses, Chat, Messages) produce identical `ResponseStream`
2. ✅ Each API can use its native capabilities (thinking, reasoning, etc.)
3. ✅ Tool calling works identically across all 3 APIs
4. ✅ Test suite is comprehensive and can be implemented first (TDD)
5. ✅ Design is extensible for future providers
6. ✅ Implementation plan is clear enough for immediate execution
7. ✅ No regressions to existing Responses/Chat support

---

## Timeline


**We need:** Complete design before implementation starts.

**Approach:** Deep research → careful design → comprehensive test specs → implementation plan

---

## Context Window Optimization

**For this consultation:**
- Read ALL referenced files deeply
- Research ALL API documentation thoroughly
- Think through edge cases carefully
- Provide complete, actionable design
- Don't rush - quality over speed

**Your output will guide extensive of implementation work, so thoroughness is critical.**

---

## Output Instructions

**Write your complete design document to:**
`/Users/leemoore/code/codex-port-02/MESSAGES_API_INTEGRATION_DESIGN.md`

**Format:** Markdown with clear sections, code examples, and diagrams.

**Length:** As long as needed - thoroughness over brevity.

---

## Begin Consultation

Please provide your comprehensive design for integrating Anthropic Messages API into the Codex TypeScript client architecture.

Focus on:
- Clean provider abstraction
- API-specific capability preservation
- Robust streaming adapters
- Comprehensive test-first approach
- Clear implementation plan

**Go deep. Be thorough. This is high-value architecture work.**
