# Phase 4.2 Checklist

**Status:** Not Started
**Reference Design:** `MESSAGES_API_INTEGRATION_DESIGN_CODEX.md`

---

## Prerequisites

- [x] Phase 4.1 complete (Responses + Chat working)
- [x] Codex-High design doc complete
- [x] Review design document thoroughly
- [x] Review workplan (WORKPLAN.md)

---

## Stage 1: Foundation & Types ✅ COMPLETE

- [x] Create src/core/client/messages/ directory
- [x] Create messages/types.ts
- [x] Define MessagesApiRequest interface
- [x] Define AnthropicMessage interface
- [x] Define AnthropicContentBlock union
- [x] Define AnthropicTool interface
- [x] Define AnthropicSseEvent union
- [x] Create messages/types.test.ts
- [x] Write type validation tests (21 tests - exceeded target!)
- [x] Verify tests pass

---

## Stage 2: Tool Format Conversion ✅ COMPLETE

- [x] Create messages/tool-bridge.ts
- [x] Create messages/tool-bridge.test.ts
- [x] Write tests TC-01 through TC-10 (15 tests total)
- [x] Implement createToolsJsonForMessagesApi()
- [x] Implement tool result converter (createToolResultBlock)
- [x] Implement validation (validateToolName)
- [x] Verify all 15 tests pass

---

## Stage 3: Request Builder

- [ ] Create messages/request-builder.ts
- [ ] Create messages/request-builder.test.ts
- [ ] Write tests RF-01 through RF-15 (15 tests)
- [ ] Implement buildMessagesRequest()
- [ ] Implement message array construction
- [ ] Implement system prompt injection
- [ ] Implement tool inclusion
- [ ] Implement parameter mapping
- [ ] Verify all 15 tests pass

---

## Stage 4: SSE Parser

- [ ] Create messages/sse-parser.ts
- [ ] Create messages/fixtures/ directory
- [ ] Create fixture: text-only.sse
- [ ] Create fixture: thinking-text.sse
- [ ] Create fixture: tool-use.sse
- [ ] Create fixture: error.sse
- [ ] Create messages/sse-parser.test.ts
- [ ] Write SSE parsing tests (15 tests)
- [ ] Implement SSE parser
- [ ] Verify all 15 tests pass

---

## Stage 5: Streaming Adapter (CRITICAL)

- [ ] Create messages/adapter.ts
- [ ] Create messages/adapter.test.ts
- [ ] Write tests SE-01 through SE-25 (25 tests)
- [ ] Implement MessagesStreamAdapter class
- [ ] Implement state machine (text/reasoning/tool buffers)
- [ ] Implement event mapping logic
- [ ] Implement tool call correlation
- [ ] Implement handleContentDelta()
- [ ] Implement handleContentStop()
- [ ] Verify all 25 tests pass

---

## Stage 6: Response Parsing

- [ ] Create messages/response-parser.ts
- [ ] Create messages/response-parser.test.ts
- [ ] Write tests RP-01 through RP-20 (20 tests)
- [ ] Implement response parsing functions
- [ ] Implement content block parsing
- [ ] Implement usage/rate limit parsing
- [ ] Verify all 20 tests pass

---

## Stage 7: Transport Layer

- [ ] Create messages/transport.ts
- [ ] Create messages/transport.test.ts
- [ ] Implement fetch wrapper
- [ ] Implement header construction (x-api-key, anthropic-version)
- [ ] Implement error normalization
- [ ] Implement rate limit parsing
- [ ] Write transport tests (12 tests)
- [ ] Verify all 12 tests pass

---

## Stage 8: Integration

- [ ] Update core/client/model-provider-info.ts (add WireApi.Messages)
- [ ] Update core/client/client.ts (add Messages case)
- [ ] Create messages/index.ts (export streamMessages)
- [ ] Wire request → transport → parser → adapter
- [ ] Write integration tests IT-01 through IT-10 (10 tests)
- [ ] Verify all 10 tests pass

---

## Stage 9: Tool Round-Trip

- [ ] Implement tool_result preparation
- [ ] Implement follow-up request logic
- [ ] Write round-trip tests (10 tests)
- [ ] Verify tool calling works end-to-end
- [ ] Verify all tests pass

---

## Stage 10: Error Handling

- [ ] Implement error normalization
- [ ] Implement retry logic
- [ ] Write error tests EH-01 through EH-15 (15 tests)
- [ ] Verify all 15 tests pass

---

## Stage 11: Final Integration

- [ ] Run full test suite (115+ tests)
- [ ] Verify all 3 APIs work (Responses, Chat, Messages)
- [ ] Create PROVIDER_GUIDE.md
- [ ] Create API_COMPARISON.md
- [ ] Update PORT_LOG_MASTER.md
- [ ] Update STATUS.md
- [ ] Commit and push
- [ ] Phase 4.2 COMPLETE

---

## Test Summary

**Target: 115+ tests**
- Types: 10
- Tool conversion: 15
- Request building: 15
- SSE parsing: 15
- Streaming adapter: 25
- Response parsing: 20
- Transport: 12
- Integration: 10
- Tool round-trip: 10
- Error handling: 15

**Total: 147 tests**
