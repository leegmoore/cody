# Phase 4.2: Anthropic Messages API Integration

## Overview

Phase 4.2 extends the client architecture to support Anthropic's Messages API as a third provider, maintaining the common ResponseStream interface while preserving API-specific capabilities.

## Prerequisites

- [x] Phase 4.1 complete (OpenAI Responses + Chat working)
- [ ] GPT-5-Pro consultant design complete (see `/gpt-5-pro-api-consult.md`)

## Goals

1. **Extend WireApi enum** - Add Messages variant
2. **Implement Messages API client** - Request/response handling
3. **Create streaming adapter** - Anthropic SSE → ResponseEvent
4. **Add tool format converter** - ToolSpec → Anthropic tool schema
5. **Tool calling round-trip** - Full tool use flow working
6. **Preserve capabilities** - Thinking blocks, native features
7. **Comprehensive tests** - Test suite from consultant design

## Approach

**Test-Driven Development based on consultant design:**

1. **Review consultant design** - Read complete architecture document
2. **Implement tests FIRST** - Based on test specifications from consultant
3. **Implement Messages API** - Following the implementation plan
4. **Verify all 3 APIs work** - Responses, Chat, Messages all produce same output
5. **Integration tests** - Same tool calls work across all APIs

## Success Criteria

- [ ] WireApi.Messages variant added
- [ ] Messages API streaming works
- [ ] Tool calling works with Anthropic
- [ ] Thinking blocks map to reasoning events
- [ ] All tests passing (50+ new tests expected)
- [ ] All 3 APIs produce identical ResponseStream
- [ ] No regressions to Responses/Chat support
- [ ] Architecture remains clean and extensible

## Documentation

After completion, create:
- **PROVIDER_GUIDE.md** - How to add new providers
- **API_COMPARISON.md** - Differences between Responses/Chat/Messages
- **TOOL_FORMATS.md** - Tool format reference for all 3 APIs

This enables future provider additions (Google, Cohere, etc.)
