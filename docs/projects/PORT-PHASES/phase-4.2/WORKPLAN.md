# Phase 4.2 Implementation Workplan

**Based on:** `MESSAGES_API_INTEGRATION_DESIGN_CODEX.md` (Codex-High consultant design)

**Strategy:** Break the design into implementable stages with tests-first approach.

---

## Stage 1: Foundation & Types (Setup)

**Goal:** Create type definitions and basic infrastructure

**Tasks:**
1. Create directory structure: `src/core/client/messages/`
2. Create `messages/types.ts` with:
   - `MessagesApiRequest` interface
   - `AnthropicMessage` interface
   - `AnthropicContentBlock` union type
   - `AnthropicTool` interface
   - `AnthropicSseEvent` union type
3. Create test file: `messages/types.test.ts`
4. Write type validation tests (10 tests)
5. Verify tests pass

**Deliverable:** Type definitions with tests

---

## Stage 2: Tool Format Conversion (Test-First)

**Goal:** Convert ToolSpec → Anthropic tool schema

**Tasks:**
1. Create `messages/tool-bridge.ts`
2. Write tests FIRST in `tool-bridge.test.ts`:
   - TC-01 through TC-10 from design doc (10 tests)
   - Test invalid tool specs
   - Test edge cases (nested schemas, enums, $defs)
3. Implement `createToolsJsonForMessagesApi()` until tests pass
4. Implement tool result converter
5. Write tool result tests (5 tests)
6. Verify all tests pass

**Deliverable:** Tool conversion working with 15 tests

**Reference:** Design Section 3.1, Section 4 (TC tests)

---

## Stage 3: Request Builder (Test-First)

**Goal:** Build MessagesApiRequest from Prompt

**Tasks:**
1. Create `messages/request-builder.ts`
2. Write tests FIRST in `request-builder.test.ts`:
   - RF-01 through RF-15 from design doc (15 tests)
   - Test message array construction
   - Test system prompt injection
   - Test tool inclusion
   - Test parameter mapping
3. Implement `buildMessagesRequest(prompt, provider)` until tests pass
4. Verify all tests pass

**Deliverable:** Request builder with 15 tests

**Reference:** Design Section 2.1, Section 4.2 (RF tests)

---

## Stage 4: SSE Parser (Test-First)

**Goal:** Parse Anthropic SSE stream into typed events

**Tasks:**
1. Create `messages/sse-parser.ts`
2. Create test fixtures in `messages/fixtures/`:
   - `text-only.sse` (simple text response)
   - `thinking-text.sse` (thinking + text)
   - `tool-use.sse` (tool calling)
   - `error.sse` (error event)
3. Write tests FIRST in `sse-parser.test.ts`:
   - Parse message_start event
   - Parse content_block_* events
   - Parse message_delta/stop events
   - Parse ping/error events
   - Handle malformed SSE
   - (min 15 tests)
4. Implement SSE parser until tests pass
5. Verify all tests pass

**Deliverable:** SSE parser with fixtures and 15 tests

**Reference:** Design Section 2.3

---

## Stage 5: Streaming Adapter (Test-First - CRITICAL)

**Goal:** Convert Anthropic events → ResponseEvent

**Tasks:**
1. Create `messages/adapter.ts`
2. Write tests FIRST in `adapter.test.ts`:
   - SE-01 through SE-25 from design doc (25 tests)
   - Test state machine (text buffering, tool tracking)
   - Test event emission order
   - Test error handling
3. Implement `MessagesStreamAdapter` class:
   - State machine for tracking blocks
   - Event mapping logic
   - Tool call correlation
4. Implement helper: `handleContentDelta()`, `handleContentStop()`
5. Verify all tests pass

**Deliverable:** Streaming adapter with 25 tests

**Reference:** Design Section 2.3, 2.4 (event mapping table), Section 4.4 (SE tests)

---

## Stage 6: Response Parsing (Test-First)

**Goal:** Parse complete (non-streaming) responses

**Tasks:**
1. Create `messages/response-parser.ts`
2. Write tests FIRST in `response-parser.test.ts`:
   - RP-01 through RP-20 from design doc (20 tests)
   - Test content block parsing
   - Test tool_use parsing
   - Test thinking block parsing
   - Test usage/rate limits
3. Implement response parsing functions
4. Verify all tests pass

**Deliverable:** Response parser with 20 tests

**Reference:** Design Section 4.3 (RP tests)

---

## Stage 7: Transport Layer

**Goal:** HTTP client with authentication and error handling

**Tasks:**
1. Create `messages/transport.ts`
2. Implement fetch wrapper with:
   - `x-api-key` header
   - `anthropic-version` header
   - Error normalization (HTTP codes → Codex errors)
   - Rate limit header parsing
3. Create transport.test.ts
4. Write tests (min 12 tests):
   - Header construction
   - Error handling per HTTP code
   - Rate limit parsing
   - Timeout handling
5. Verify all tests pass

**Deliverable:** Transport layer with 12 tests

**Reference:** Design Section 1.7, Section 2.5

---

## Stage 8: Integration with ModelClient

**Goal:** Wire Messages API into existing client

**Tasks:**
1. Update `core/client/model-provider-info.ts`:
   - Extend WireApi enum with `Messages`
2. Update `core/client/client.ts`:
   - Add Messages case to stream() switch
   - Call streamMessages() for WireApi.Messages
3. Create `messages/index.ts`:
   - Export `streamMessages()` main function
   - Coordinate: request builder → transport → SSE parser → adapter
4. Write integration tests (10 tests from design IT-01 through IT-10)
5. Verify all tests pass

**Deliverable:** Full Messages API integration with 10 tests

**Reference:** Design Section 1.5, Section 4.7 (IT tests)

---

## Stage 9: Tool Calling Round-Trip

**Goal:** Complete tool execution cycle

**Tasks:**
1. Implement tool_result preparation in `tool-bridge.ts`
2. Implement follow-up request logic (tool results → next turn)
3. Write round-trip tests:
   - Tool call → execute → tool_result → continuation
   - Multiple tools in sequence
   - Tool errors
   - (min 10 tests, part of TC suite)
4. Verify tests pass

**Deliverable:** Tool round-trip working

**Reference:** Design Section 3.2, 3.3

---

## Stage 10: Error Handling & Advanced Features

**Goal:** Robust error handling, token mapping, cancellation

**Tasks:**
1. Implement error normalization (Anthropic errors → Codex errors)
2. Implement retry logic with backoff (250ms initial, 2x, max 6 attempts)
3. Implement rate limit header parsing
4. Implement token usage normalization (with reasoning_tokens, cache tokens)
5. Implement streaming cancellation (AbortSignal)
6. Write error handling tests (20 tests including mappings)
7. Write token usage tests (5 tests)
8. Write cancellation tests (5 tests)
9. Verify all 30 tests pass

**Deliverable:** Error handling, token mapping, cancellation with 30 tests

**Reference:** Design Sections 2.9, 2.10, 2.11

---

## Stage 11: Final Integration & Documentation

**Goal:** Complete Phase 4.2

**Tasks:**
1. Run full test suite (all 115+ tests)
2. Verify all 3 APIs work (Responses, Chat, Messages)
3. Update documentation:
   - Create PROVIDER_GUIDE.md (how to add providers)
   - Create API_COMPARISON.md (Responses vs Chat vs Messages)
   - Update PORT_LOG_MASTER.md
4. Commit and push
5. Phase 4.2 COMPLETE

**Deliverable:** Production-ready Messages API integration

---

## Test Count Target

**Total Phase 4.2 Tests:** 115+
- Tool conversion: 15 tests
- Request formatting: 15 tests
- SSE parsing: 15 tests
- Streaming adapter: 25 tests
- Response parsing: 20 tests
- Transport: 12 tests
- Integration: 10 tests
- Tool round-trip: 10 tests (part of TC)
- Error handling: 15 tests

---

## Implementation Notes

**Follow this order strictly:**
1. Types → Tool converter → Request builder (foundation)
2. SSE parser → Adapter (streaming core)
3. Response parser → Transport (HTTP layer)
4. Integration → Tool round-trip (wiring)
5. Error handling → Final (robustness)

**At each stage:**
- Tests first (TDD)
- Implement until green
- Update logs
- Commit and push

**Reference document:**
`/Users/leemoore/code/codex-port-02/MESSAGES_API_INTEGRATION_DESIGN_CODEX.md`
