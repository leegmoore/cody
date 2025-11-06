# Phase 4.1 Checklist

**Status:** Not Started

---

## Setup

- [x] Phase 3 complete (execution & tools)
- [x] Phase 4 started (mcp-types, ollama complete)
- [ ] Review Phase 4.1 documentation
- [ ] Create src/core/client directory

---

## Module 1: client_common (Foundation)

- [ ] Read codex-rs/core/src/client_common.rs
- [ ] Create codex-ts/src/core/client/client-common.ts
- [ ] Port Prompt interface
- [ ] Port ResponseEvent enum
- [ ] Port ResponseStream interface
- [ ] Port ResponsesApiRequest interface
- [ ] Port tool-related types (ToolSpec, ResponsesApiTool)
- [ ] Create client-common.test.ts
- [ ] Write tests (min 15 tests)
- [ ] Verify tests pass
- [ ] Update logs

---

## Module 2: model-provider-info (Provider Pattern)

- [ ] Read codex-rs/core/src/model_provider_info.rs
- [ ] Create codex-ts/src/core/client/model-provider-info.ts
- [ ] Port WireApi enum (Responses, Chat)
- [ ] Port ModelProviderInfo interface
- [ ] Port built-in provider registry
- [ ] Port create request helper
- [ ] Create model-provider-info.test.ts
- [ ] Write tests (min 12 tests)
- [ ] Verify tests pass
- [ ] Update logs

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
