# GPT-5-Pro API Integration Consultation - Addendum v2

**Role:** Senior API Architect & TypeScript Expert

**Context:** You previously delivered `MESSAGES_API_INTEGRATION_DESIGN.md` (523 lines) designing the Anthropic Messages API integration. The design is strong but has gaps that need addressing before implementation.

---

## What You Already Delivered (v1)

**File:** `/Users/leemoore/code/codex-port-02/MESSAGES_API_INTEGRATION_DESIGN.md`

**Strengths:**
- ✅ Clean provider abstraction via WireApi enum extension
- ✅ Comprehensive SSE event mapping table
- ✅ State machine for streaming adapter
- ✅ Tool format conversion specified
- ✅ 115+ test suite designed
- ✅ Concrete code examples with TypeScript
- ✅ Implementation plan with 6 steps

**Overall grade: A- (87/100)** - Excellent foundation, needs additions.

---

## Gaps to Address in v2

### 1. Parallel Tool Calls (CRITICAL)

**Gap:** Anthropic returns multiple `tool_use` blocks in one response. Your design mentions "parallelism" but doesn't specify implementation.

**What you need to add:**

**Questions:**
- How to track multiple `tool_use_id` mappings simultaneously?
- Does `toolArgs: Map<number, ...>` handle this? (index-based suggests yes, but clarify)
- How does the Codex tool harness handle parallel execution?
- Do all tool_result blocks go in ONE user message or separate messages?
- How to match tool results back to tool calls?

**Provide:**
- Code example showing 2 parallel tool_use blocks → 2 tool executions → 2 tool_result blocks in response
- State machine handling for N concurrent tool calls
- Test case for parallel tool execution

---

### 2. Thinking Block Configuration (IMPORTANT)

**Gap:** You mention "adapter flag to emit readable vs raw reasoning" but don't specify where this config lives.

**What you need to add:**

**Questions:**
- Where is this configured? (`ModelProviderInfo`? `Prompt`? Runtime flag?)
- How does it map to Anthropic's `thinking` content blocks?
- What's the difference between "readable" vs "raw" reasoning in this context?
- Does this relate to Codex's existing `ReasoningEffort` / `ReasoningSummary` config?

**Provide:**
- Configuration interface/field definition
- How thinking blocks are enabled/disabled
- Default behavior
- Code example showing both modes

---

### 3. System Prompt Handling (IMPORTANT)

**Gap:** Anthropic Messages API has separate `system` field (string or content blocks). Responses/Chat put system in messages array.

**What you need to add:**

**Questions:**
- How does Codex's `base_instructions` map to Messages API `system` field?
- String or content blocks format?
- Can system include tool descriptions (like Responses API does)?
- How to handle system prompt updates between turns?

**Provide:**
- System prompt conversion logic
- Code example showing `Prompt.base_instructions` → `system` field
- Comparison across all 3 APIs (Responses, Chat, Messages)

---

### 4. Error Code Mappings (IMPORTANT)

**Gap:** Section 8 mentions HTTP status codes but doesn't map Anthropic-specific errors.

**What you need to add:**

**Anthropic error types** (from their docs):
- `invalid_request_error` - Malformed request
- `authentication_error` - Invalid API key
- `permission_error` - No access to resource
- `not_found_error` - Resource doesn't exist
- `rate_limit_error` - Too many requests
- `overloaded_error` - Server overloaded
- `api_error` - Internal server error

**Provide:**
- Complete mapping table: Anthropic error type → Codex error type (EventMsg.error or exception)
- Rate limit header mappings (`anthropic-ratelimit-*` headers → `RateLimitSnapshot`)
- Retry strategy for each error type
- Code example of error normalization

---

### 5. Token Field Mappings (IMPORTANT)

**Gap:** "normalize usage" is vague. Anthropic has different token fields than OpenAI.

**What you need to add:**

**Anthropic token fields:**
- `input_tokens` - Standard input
- `output_tokens` - Standard output
- `reasoning_tokens` - NEW (thinking block tokens)
- `cache_creation_input_tokens` - Prompt cache creation
- `cache_read_input_tokens` - Prompt cache hits

**Codex TokenUsage type** (from protocol):
- `input_tokens`, `output_tokens`, `cached_input_tokens`

**Provide:**
- Exact field mapping (which Anthropic field → which Codex field)
- How to handle `reasoning_tokens` (add new field to TokenUsage or fold into output?)
- How to handle cache tokens
- Code example showing conversion

---

### 6. Authentication Integration (CRITICAL)

**Gap:** No mention of how API key gets into `x-api-key` header.

**What you need to add:**

**Questions:**
- Where does Anthropic API key come from? (`ANTHROPIC_API_KEY` env var?)
- How is it configured in `ModelProviderInfo`?
- Different from OpenAI's `Authorization: Bearer` pattern?
- How does stub auth work in Phase 4.1/4.2? (hardcoded key for tests?)

**Provide:**
- `ModelProviderInfo` configuration example for Anthropic
- Header construction code
- Stub auth strategy for Phase 4.1/4.2 testing
- Environment variable name convention

---

### 7. Anthropic Version Management (MEDIUM)

**Gap:** `anthropic-version: '2023-06-01'` hardcoded - should this be configurable?

**What you need to add:**

**Questions:**
- Make version configurable per provider?
- Add to `ModelProviderInfo`?
- How to handle version-specific SSE event changes?
- Default version strategy?

**Provide:**
- Configuration approach
- Version migration strategy
- Code example

---

### 8. Streaming Cancellation (MEDIUM)

**Gap:** What happens when user interrupts streaming?

**What you need to add:**

**Questions:**
- AbortController/AbortSignal support?
- How to clean up SSE connection?
- How to emit cancellation event?
- Different from Responses/Chat cancellation?

**Provide:**
- Cancellation handling code
- Event emission on cancel
- Cleanup logic

---

### 9. Retry and Backoff Strategy (MEDIUM)

**Gap:** Mentions "retry/backoff hooks (stubbed)" but Responses/Chat have full retry logic.

**What you need to add:**

**Questions:**
- Does Messages API use same retry strategy as Responses/Chat?
- Anthropic-specific retry headers?
- Exponential backoff parameters?
- Which errors are retryable vs fatal?

**Provide:**
- Retry strategy specification
- Backoff algorithm (if different from OpenAI)
- Retryable error list

---

### 10. Stop Sequences (LOW)

**Gap:** Anthropic supports `stop_sequences` parameter. Does Codex use this?

**Quick answer needed:**
- Does Codex expose stop sequences in Prompt?
- How to map to Messages API `stop_sequences` field?

---

## Reference Files

**Your v1 design:**
`/Users/leemoore/code/codex-port-02/MESSAGES_API_INTEGRATION_DESIGN.md`

**Codex auth implementation (for reference):**
- `codex-rs/core/src/auth.rs` (lines 25-175 show CodexAuth structure)
- `codex-rs/core/src/auth/storage.rs` (AuthDotJson, token storage)
- `codex-rs/login/src/lib.rs` (login flows)

**Codex error handling (for reference):**
- `codex-rs/core/src/error.rs` (error types)
- `codex-rs/core/src/client.rs` (lines 200-400 show retry logic and error handling)

**Token usage (for reference):**
- `codex-rs/core/src/protocol.rs` (TokenUsage, RateLimitSnapshot types)

**Anthropic API docs:**
- Messages API: https://docs.claude.com/en/api/messages
- Errors: https://docs.claude.com/en/api/errors
- Rate limits: https://docs.claude.com/en/api/rate-limits

---

## Output Instructions

**Write your complete v2 design document to:**
`/Users/leemoore/code/codex-port-02/MESSAGES_API_INTEGRATION_DESIGN_V2.md`

**Format:**
- Include everything from v1 (copy/paste the good parts)
- Add new sections addressing the 10 gaps above
- Update existing sections where needed
- Mark new additions with "**[V2 ADDITION]**" headers

**Structure:**
- Keep all existing sections (1-9)
- Add new subsections under relevant sections
- Add "Section 10: Authentication & Configuration" (new major section)
- Add "Section 11: Advanced Features" for parallel tools, cancellation, etc.

---

## Deliverables for v2

### Required Additions:

**1. Parallel Tool Calls Section**
- State management for N concurrent tool_use blocks
- Tool result matching strategy
- Code example with 2+ parallel tools
- Test cases

**2. Complete Error Handling Section**
- Anthropic error type → Codex error type mapping table
- Rate limit header mappings
- Retry strategy per error type
- Code examples

**3. Authentication & Configuration Section** (NEW)
- ModelProviderInfo setup for Anthropic
- API key sourcing (env var name)
- Header construction
- Stub auth for testing
- Version management

**4. Token Usage Mapping**
- Complete field mapping table
- How to handle reasoning_tokens
- Cache token handling
- Code example

**5. System Prompt Conversion**
- base_instructions → system field logic
- Format (string vs blocks)
- Cross-API comparison

**6. Enhanced Test Suite**
- Add tests for parallel tools (5+ tests)
- Add tests for error codes (10+ tests)
- Add tests for token mappings (5+ tests)
- **Updated total: 135+ tests**

### Optional Additions:

7. Streaming cancellation handling
8. Stop sequences support
9. Retry/backoff details

---

## Success Criteria for v2

Your v2 design is complete when:

1. ✅ All 10 gaps addressed with concrete solutions
2. ✅ Parallel tool calling fully specified
3. ✅ Error handling comprehensive
4. ✅ Auth integration clear
5. ✅ Token mappings complete
6. ✅ Test suite expanded to 135+ tests
7. ✅ All code examples updated
8. ✅ Ready for immediate implementation (no unknowns)

---

## Begin v2 Consultation

Please provide the comprehensive v2 design document addressing all gaps identified above.

**Focus on:**
- Parallel tool execution (critical for Anthropic)
- Complete error handling (production-ready)
- Auth integration (practical implementation)
- Enhanced test coverage (135+ tests)

**Be thorough. Fill every gap. Make it implementation-ready.**
