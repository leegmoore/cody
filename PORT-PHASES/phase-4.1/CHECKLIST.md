# Phase 4.1 Checklist

**Status:** Not Started

---

## Setup

- [x] Phase 3 complete (execution & tools)
- [x] Phase 4 started (mcp-types, ollama complete)
- [x] Review Phase 4.1 documentation
- [x] Create src/core/client directory

---

## Module 1: client_common (Foundation)

- [x] Read codex-rs/core/src/client_common.rs
- [x] Create codex-ts/src/core/client/client-common.ts
- [x] Port Prompt interface
- [x] Port ResponseEvent enum
- [x] Port ResponseStream interface
- [x] Port ResponsesApiRequest interface
- [x] Port tool-related types (ToolSpec, ResponsesApiTool)
- [x] Create client-common.test.ts
- [x] Write tests (32 tests - exceeded target!)
- [x] Verify tests pass
- [x] Update logs

---

## Module 2: model-provider-info (Provider Pattern)

- [x] Read codex-rs/core/src/model_provider_info.rs
- [x] Create codex-ts/src/core/client/model-provider-info.ts
- [x] Port WireApi enum (Responses, Chat)
- [x] Port ModelProviderInfo interface
- [x] Port built-in provider registry
- [x] Port create request helper
- [x] Create model-provider-info.test.ts
- [x] Write tests (22 tests - exceeded target!)
- [x] Verify tests pass
- [x] Update logs

---

## Module 3: Stub Auth (Temporary)

- [ ] Create codex-ts/src/core/auth/stub-auth.ts
- [ ] Create simple AuthManager stub
- [ ] Create CodexAuth stub
- [ ] Support ApiKey and ChatGPT modes (minimal)
- [ ] Return hardcoded tokens for testing
- [ ] Create stub-auth.test.ts
- [ ] Write tests (min 8 tests)
- [ ] Verify tests pass
- [ ] Update logs
- [ ] Add TODO comments for Phase 5 replacement

---

## Module 4: core/chat_completions (Chat API)

- [ ] Read codex-rs/core/src/chat_completions.rs (967 lines)
- [ ] Create codex-ts/src/core/client/chat-completions.ts
- [ ] Port stream_chat_completions function
- [ ] Port AggregatedChatStream adapter (delta → complete messages)
- [ ] Port Chat API request builder
- [ ] Port SSE parsing for Chat format
- [ ] Port tool format converter for Chat
- [ ] Create chat-completions.test.ts
- [ ] Write streaming tests (min 25 tests)
- [ ] Write aggregation tests (min 10 tests)
- [ ] Write tool calling tests (min 15 tests)
- [ ] Verify tests pass
- [ ] Update logs

---

## Module 5: core/client (Responses API + ModelClient)

- [ ] Read codex-rs/core/src/client.rs (1,474 lines)
- [ ] Create codex-ts/src/core/client/client.ts
- [ ] Port ModelClient class
- [ ] Port stream_responses function
- [ ] Port Responses API request builder
- [ ] Port SSE parsing for Responses format
- [ ] Port retry logic with backoff
- [ ] Port rate limit handling
- [ ] Port error handling
- [ ] Implement WireApi switch (Responses vs Chat)
- [ ] Create client.test.ts
- [ ] Write ModelClient tests (min 20 tests)
- [ ] Write Responses API tests (min 25 tests)
- [ ] Write retry/backoff tests (min 10 tests)
- [ ] Write error handling tests (min 15 tests)
- [ ] Verify tests pass
- [ ] Update logs

---

## Module 6: Tool Converters

- [ ] Read codex-rs/core/src/tools/spec.rs (lines 670-713)
- [ ] Create codex-ts/src/core/tools/tool-converters.ts
- [ ] Port create_tools_json_for_responses_api
- [ ] Port create_tools_json_for_chat_completions_api
- [ ] Create tool-converters.test.ts
- [ ] Write conversion tests (min 20 tests)
- [ ] Verify tests pass
- [ ] Update logs

---

## Integration Tests

- [ ] Test: Responses API full conversation flow
- [ ] Test: Chat API full conversation flow
- [ ] Test: Tool calling with Responses API
- [ ] Test: Tool calling with Chat API
- [ ] Test: Streaming works for both APIs
- [ ] Test: Retry logic works
- [ ] Test: Error handling works
- [ ] Test: Both APIs produce equivalent ResponseStream

---

## Final

- [ ] All modules ported
- [ ] All tests passing (target: 150+ new tests)
- [ ] Update PORT_LOG_MASTER.md
- [ ] Update PORT-PHASES/phase-4.1/STATUS.md
- [ ] Commit and push
- [ ] Ready for Phase 4.2 (Messages API)
