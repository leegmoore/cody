# Phase 4.1: Port Existing Client (OpenAI APIs)

## Overview

Phase 4.1 ports the existing Rust client architecture supporting OpenAI's Responses API and Chat Completions API. Uses stub auth for testing - full auth comes in Phase 5.

## Goals

1. **Port core/client** - ModelClient with Responses API support
2. **Port core/chat_completions** - Chat API with delta aggregation adapter
3. **Port client_common** - ResponseStream, ResponseEvent, Prompt types
4. **Port model_provider_info** - WireApi enum, ModelProviderInfo
5. **Port tool converters** - Format conversion for both APIs
6. **Stub auth** - Simple auth stubs for testing (replaced in Phase 5)

## Module Order

1. **client_common** - Common types (foundation)
2. **model_provider_info** - Provider pattern (WireApi enum)
3. **core/chat_completions** - Chat API + aggregation adapter
4. **core/client** - ModelClient + Responses API
5. **Tool converters** - Format conversion functions (in core/tools or separate)

## Success Criteria

- [ ] Can call OpenAI Responses API
- [ ] Can call OpenAI Chat Completions API
- [ ] Both produce common ResponseStream format
- [ ] Tool calling works for both APIs
- [ ] Streaming works correctly
- [ ] All tests passing (100+ tests expected)
- [ ] Stub auth sufficient for testing

## Preparation for Phase 4.2

This phase establishes the provider abstraction pattern that Phase 4.2 will extend with Anthropic Messages API.

**Critical:** Keep the architecture clean and extensible!
