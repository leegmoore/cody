# Phase 4.1 Checklist

**Status:** ✅ COMPLETE

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

- [x] Create codex-ts/src/core/auth/stub-auth.ts
- [x] Create simple AuthManager stub
- [x] Create CodexAuth stub
- [x] Support ApiKey and ChatGPT modes (minimal)
- [x] Return hardcoded tokens for testing
- [x] Create stub-auth.test.ts
- [x] Write tests (21 tests - exceeded target!)
- [x] Verify tests pass
- [x] Update logs
- [x] Add TODO comments for Phase 5 replacement

---

## Module 4: core/chat_completions (Chat API)

- [x] Read codex-rs/core/src/chat_completions.rs (967 lines)
- [x] Create codex-ts/src/core/client/chat-completions.ts
- [x] Port core types (ChatMessage, ChatCompletionChunk, etc.)
- [x] Port buildChatMessages function (message building logic)
- [x] Port createChatCompletionRequest helper
- [ ] Port stream_chat_completions function (deferred to Phase 4.5+)
- [ ] Port AggregatedChatStream adapter (deferred to Phase 4.5+)
- [ ] Port SSE parsing for Chat format (deferred to Phase 4.5+)
- [ ] Port tool format converter for Chat (deferred to Phase 4.5+)
- [x] Create chat-completions.test.ts
- [x] Write tests for core types (18 tests - foundation complete)
- [x] Verify tests pass
- [x] Update logs

---

## Module 5: core/client (Responses API + ModelClient)

- [x] Read codex-rs/core/src/client.rs (1,474 lines)
- [x] Create codex-ts/src/core/client/client.ts
- [x] Port ModelClient class (core structure)
- [x] Port stream_responses function (stub - deferred to Phase 4.5+)
- [x] Port Responses API request builder (stub - deferred to Phase 4.5+)
- [ ] Port SSE parsing for Responses format (deferred to Phase 4.5+)
- [ ] Port retry logic with backoff (deferred to Phase 4.5+)
- [ ] Port rate limit handling (deferred to Phase 4.5+)
- [ ] Port error handling (deferred to Phase 4.5+)
- [x] Implement WireApi switch (Responses vs Chat)
- [x] Create client.test.ts
- [x] Write ModelClient tests (11 tests - core structure complete)
- [x] Verify tests pass
- [x] Update logs

---

## Module 6: Tool Converters

- [x] Read codex-rs/core/src/tools/spec.rs (lines 670-713)
- [x] Create codex-ts/src/core/client/tool-converters.ts
- [x] Port create_tools_json_for_responses_api
- [x] Port create_tools_json_for_chat_completions_api
- [x] Create tool-converters.test.ts
- [x] Write conversion tests (10 tests - comprehensive coverage)
- [x] Verify tests pass
- [x] Update logs

---

## Integration Tests

**Note:** Integration tests deferred to Phase 4.5+ when HTTP streaming is implemented

- [ ] Test: Responses API full conversation flow (deferred to Phase 4.5+)
- [ ] Test: Chat API full conversation flow (deferred to Phase 4.5+)
- [ ] Test: Tool calling with Responses API (deferred to Phase 4.5+)
- [ ] Test: Tool calling with Chat API (deferred to Phase 4.5+)
- [ ] Test: Streaming works for both APIs (deferred to Phase 4.5+)
- [ ] Test: Retry logic works (deferred to Phase 4.5+)
- [ ] Test: Error handling works (deferred to Phase 4.5+)
- [ ] Test: Both APIs produce equivalent ResponseStream (deferred to Phase 4.5+)

---

## Final

- [x] All modules ported (6/6 complete)
- [x] All tests passing (114 new tests - core types complete)
- [x] Update PORT_LOG_MASTER.md
- [x] Update PORT-PHASES/phase-4.1/STATUS.md
- [x] Commit and push
- [x] Ready for Phase 4.5+ (HTTP Client & Full Streaming)
