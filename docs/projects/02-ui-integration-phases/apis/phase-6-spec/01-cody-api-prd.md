# Cody REST API - Product Requirements Document

**Project:** Cody REST API (Phase 6 of UI Integration)
**Status:** Planning
**Date:** 2025-11-16

---

## 1. Overview

### What We're Building

Phase 6 transforms the Cody CLI from a command-line tool into a platform by adding a production-grade REST API. This API exposes the complete conversation and agent orchestration capabilities of the core library via HTTP, enabling web applications, mobile clients, and programmatic integrations to leverage the full power of the Cody harness.

The work involves wrapping the existing, well-tested ConversationManager and core library (Phases 1-5, 1,950+ tests) with a Fastify-based REST layer, integrating Redis Streams for durable event delivery, and implementing Server-Sent Events (SSE) for real-time progress updates during long-running agent sessions.

### Why It Matters

The current CLI is stateful and terminal-bound. While functional for local development, it cannot support:
- Web-based interfaces for richer UX and collaboration
- Mobile access to agent capabilities
- Multi-client monitoring of long-running sessions (hours-long autonomous coding runs)
- Programmatic integration with other tools and services
- The foundational platform architecture needed for future innovations (memory gradients, multi-agent coordination, autonomous workflow orchestration)

This phase establishes the HTTP interface that all future client applications will build upon, while preserving the battle-tested core library that makes Cody reliable.

### Deliverables

**Primary:**
1. **Fastify REST API** - Production HTTP server exposing all conversation operations
2. **EventMsg Streaming** - Durable event delivery via Redis Streams + SSE for hours-long sessions
3. **Playwright Test Suite** - Comprehensive functional tests defining API contracts
4. **API Documentation** - Complete functional and technical specifications

**Foundation for Future Phases:**
- Continuous run system (autonomous multi-turn loops)
- Multi-agent coordination (planner monitoring/controlling coder)
- Memory gradient integration (Redis-backed context management)
- Web UI and mobile clients

---

## 2. Success Criteria

### Functional Capabilities

**1. Conversation Lifecycle:**
User can create a new conversation via REST API, list all conversations with metadata, retrieve a specific conversation's state and history, delete conversations, and update conversation metadata (title, summary, tags, etc.). All operations work identically to current CLI but via HTTP.

**Verification:** Playwright tests create, list, get, update, delete conversations. All succeed with proper status codes and response formats.

**2. Message Submission & Async Execution:**
User submits a message to a conversation and immediately receives a task identifier and event stream URL. The agent processes the message asynchronously (may take seconds to hours). User can disconnect and reconnect at any time without losing progress.

**Verification:** Playwright test submits message, receives taskId + eventsUrl within 100ms, disconnects, reconnects, receives all events including those emitted while disconnected.

**3. Step-Level Event Streaming:**
During agent execution, client receives real-time EventMsg events for major steps: task started, tool execution beginning/ending, agent responses, errors, completion. Events are durable and replayable.

**Verification:** Playwright test subscribes to SSE endpoint, receives step events (exec_command_begin, exec_command_end, agent_message, task_complete) in correct order. Test disconnects mid-execution, reconnects with Last-Event-ID, receives remaining events.

**4. Conversation Metadata & Organization:**
Conversations carry rich metadata (title, summary, parent reference for branching, tags for categorization, agent role, model defaults). Clone operation creates conversation copy with parent reference. Clients can search/filter by metadata.

**Verification:** Playwright tests create conversation with metadata, retrieve and verify all fields, clone conversation and verify parent reference, filter conversations by tags/role.

**5. Multi-Provider Support:**
API works identically with OpenAI (Responses API), Anthropic (Messages API), and OpenRouter (Chat Completions). EventMsg stream format is provider-agnostic. Clients discover available providers and models via API endpoints.

**Verification:** Playwright tests run same conversation flow with all three providers, verify EventMsg streams are identical in structure, verify provider/model discovery endpoints return correct catalogs.

### Quality Gates

**1. API Contract Tests Pass:**
Complete Playwright test suite (30-50 tests estimated) covering all endpoints and streaming scenarios. All tests must pass before phase complete.

**2. Existing Library Tests Maintained:**
Current 1,950+ tests from port-02 continue passing. No regressions in core library.

**3. Type Safety:**
Zero TypeScript errors. Zod schemas validate all request/response payloads at runtime.

**4. Code Quality:**
ESLint passing, Prettier formatted, follows existing codebase conventions.

### Non-Functional Requirements

**1. Performance:**
- API response time <100ms for non-streaming endpoints
- SSE events delivered within 500ms of emission
- Support hours-long sessions without memory leaks

**2. Reliability:**
- Graceful handling of client disconnects
- Redis connection failures handled with retries
- ConversationManager errors propagated as proper HTTP status codes

**3. Developer Experience:**
- Clear API documentation
- Comprehensive error messages
- Request/response examples
- Zod validation provides actionable error details

---

## 3. Scope

### 3.1 In Scope

**REST API Endpoints:**

**Conversation Management:**
- POST /conversations - Create new conversation with metadata
- GET /conversations - List conversations with filtering
- GET /conversations/{id} - Get conversation details
- DELETE /conversations/{id} - Delete conversation
- PATCH /conversations/{id} - Update metadata (title, summary, tags, agentRole, models)
- POST /conversations/{id}/clone - Clone conversation (stamps parent)

**Message Submission:**
- POST /conversations/{id}/messages - Submit message, returns taskId + eventsUrl

**Event Streaming:**
- GET /tasks/{taskId}/events - SSE stream of EventMsg events
- GET /tasks/{taskId} - Get task status

**Provider Discovery:**
- GET /providers - List available providers
- GET /providers/{provider}/models - List models for provider

**Conversation Metadata Fields:**
- `conversationId` - UUID identifier
- `createdAt`, `updatedAt` - Timestamps
- `parent` - Parent conversation ID (for clones/branches)
- `title` - User-editable title
- `summary` - Auto-generated or user-provided summary
- `tags` - Array of string tags for categorization
- `agentRole` - Optional role indicator (open text field: "planner", "coder", "verifier", etc.)
- `primaryModel` - Default model for this conversation
- `secondaryModel` - Background helper model
- Session metadata from current implementation (instructions, cwd, etc.)

**Streaming Architecture:**
- EventMsg as canonical event format (40+ event types)
- Redis Streams for durable event storage
- SSE for client delivery
- Step-level events only (no token-by-token streaming)
- Async task pattern (submit → taskId → subscribe to events)

**Provider System:**
- Hardcoded Provider enum (openai, anthropic, openrouter)
- Each provider locked to one wire API (Responses, Messages, Chat)
- Curated model catalogs per provider
- Model metadata (context window, capabilities)

**Testing:**
- Playwright test suite for all API endpoints
- Mocked ModelClient for fast, deterministic tests
- Integration tests with real providers (manual validation)

### 3.2 Out of Scope (Deferred to Later Phases)

**Workspace Management:**
Grouping conversations into workspaces, multi-level hierarchies, projects under workspaces - all deferred. Workspace field exists on conversations but workspace CRUD endpoints not implemented yet.

**System Prompt Catalog:**
Managing prompts as named resources, prompt versioning, co-selection with models - all deferred. System prompts continue to be passed directly in conversation config.

**Continuous Runs:**
Background autonomous execution, run state machine, loop control - deferred to Phase 2.5. Current Phase 6 handles single message submission only (even if it takes hours, it's one operation).

**Token-Level Streaming:**
Real-time token-by-token deltas within a single LLM response - deferred. Phase 6 implements step-level events only (tool execution, complete messages, not streaming text within a message).

**Multi-Agent Coordination:**
Planner monitoring coder, cross-run visibility, control interfaces - deferred to Phase 2.6. Phase 6 supports independent conversations only.

**Turn Branching:**
Branch operation (clone + edit with turn divergence) - deferred. Phase 6 implements clone only (full conversation duplication).

**Advanced Provider Features:**
- Google Gemini integration (designed, not implemented)
- Multi-API support per provider (all providers locked to one API)
- Dynamic model catalog fetching (hardcoded catalogs only)
- Agent-maintained model updates (manual updates in Phase 6)

**Authentication & Multi-Tenancy:**
User management, authentication, multi-user support - completely deferred. Phase 6 is single-user, no auth required.

---

## 4. Dependencies & Prerequisites

### Code Dependencies

**Phase 5 Complete (Current State):**
- ConversationManager fully functional
- Multi-provider support (OpenAI Responses, Anthropic Messages, OpenRouter Chat)
- Tool execution with approval flow
- Persistence (JSONL rollout format)
- History compression (compact algorithm ported)
- 1,950+ tests passing, zero TypeScript errors

**External Services Required:**
- Redis 6.0+ running locally or accessible via REDIS_URL
- OpenAI API access (for testing Responses API)
- Anthropic API access (for testing Messages API)
- OpenRouter API access (optional, for testing)

**Development Environment:**
- Bun 1.1+ (primary runtime)
- Node.js 18+ (compatibility target)
- Playwright installed (for API tests)
- TypeScript, ESLint, Prettier configured

### Knowledge Prerequisites

**Developers/Agents implementing this phase should review:**
- Current PRD: `docs/projects/02-ui-integration-phases/PRD.md` (project context)
- TECH-APPROACH.md: Phases 1-5 (current architecture)
- Streaming Architecture: `apis/streaming-architecture.md` (EventMsg format, layer design)
- Provider Brainstorm: `apis/provider-model-design-brainstorm.md` (provider decisions)
- Contract Testing Philosophy: `docs/core/contract-testing-tdd-philosophy.md` (testing approach)

---

## 5. Technical Constraints

### Architectural Boundaries

**Core Library Stability:**
The ConversationManager, Session, Codex, and provider clients from Phases 1-5 are stable and well-tested. Phase 6 wraps this core with HTTP/streaming infrastructure. Changes to core library allowed only when API integration reveals genuine gaps (missing functionality, broken interfaces). Most core code remains unchanged.

**Stateless API Design:**
All REST endpoints are stateless. No server-side "active conversation" tracking. Every operation accepts explicit IDs (conversationId, taskId). Clients manage which conversation/task they're working with. This enables horizontal scaling and clean separation between API and clients.

**EventMsg as Canonical Format:**
The EventMsg protocol (40+ discriminated union event types) is the single streaming format for all clients. All providers (OpenAI, Anthropic, Google, OpenRouter) normalize to ResponseItems, which Codex/Session transforms to EventMsg. Clients receive identical event streams regardless of provider. No provider-specific streaming formats exposed.

### Technology Choices

**Web Framework: Fastify**
- Chosen for performance (Bun-optimized, faster than Express)
- Plugin ecosystem (CORS, validation, etc.)
- TypeScript-first with excellent type inference
- Proven in production (v/codex-port and team-bruce both use Fastify)

**Validation: Zod**
- Runtime schema validation prevents type gaps
- Single source of truth for request/response shapes
- Integration with Fastify via fastify-type-provider-zod
- Auto-generates TypeScript types from schemas

**Event Streaming: Redis Streams**
- Required for hours-long sessions (client reconnection)
- Durable event storage (events persisted until consumed)
- Multi-client support (multiple subscribers to same task)
- Proven scalable (handles high throughput)

**SSE for Client Delivery:**
- Standard EventSource API in browsers
- Simple HTTP GET (no WebSocket complexity)
- Automatic reconnection with Last-Event-ID
- Works through proxies and firewalls

**No WebSockets:**
Deliberately avoided due to complexity (connection management, bidirectional handshaking, proxy issues). SSE provides sufficient real-time capability with simpler infrastructure.

### Integration Points

**Fastify → ConversationManager:**
REST handlers are thin wrappers that call ConversationManager methods. Business logic stays in core library. Fastify handles HTTP concerns only (validation, error formatting, status codes).

**EventMsg → Redis Streams:**
Session/Codex emit EventMsg events during turn execution. Fastify event bridge subscribes to these events and writes to Redis Stream (`events:{taskId}`). Each event becomes one Redis Stream entry.

**Redis Streams → SSE:**
SSE endpoints read from Redis Streams using XREAD (blocking read with timeout). Transform Redis entries to SSE format. Support resume via Last-Event-ID parameter.

**Provider Adapters:**
Current multi-provider architecture (WireApi enum, adapter pattern) is refactored to hardcoded Provider enum. Each provider (openai, anthropic, openrouter) gets dedicated adapter with curated model catalog. Provider selection simplified (no API selection - provider implies API).

### Future Compatibility Constraints

**Design for Continuous Runs:**
While Phase 6 implements single message submission only, the async task pattern (submit → taskId → events) is designed to support continuous autonomous runs in Phase 2.5. Task status tracking and event streaming infrastructure will extend naturally to multi-turn autonomous loops.

**Design for Multi-Agent:**
EventMsg stream format and Redis Streams infrastructure enable cross-run visibility needed for planner-coder coordination in Phase 2.6. Phase 6 lays groundwork by making all task events accessible via REST API.

**Design for Memory Gradients:**
Redis integration in Phase 6 establishes the infrastructure for Phase 3+ memory innovations. Redis will serve as hot storage for conversation gradients, compressed chunks, and search results. Event streaming provides hooks for offline agents to process conversation history asynchronously.

---

## 6. Quality Standards

### API Contract Tests (Playwright)

**Comprehensive Functional Coverage:**
30-50 Playwright tests covering all endpoints and scenarios. Tests define API contracts via functional assertions. Each endpoint has:
- Happy path test (valid input → expected output)
- Error cases (invalid input → proper error response)
- Edge cases (empty data, large payloads, concurrent requests)

**Streaming Tests:**
Tests for SSE subscription, event delivery, disconnection/reconnection, Last-Event-ID resume. Verify events received in correct order during multi-step turns with tool execution.

**Test Execution:**
All Playwright tests pass consistently. Fast execution (<30 seconds for full suite with mocked providers). No flaky tests (deterministic with mocked ModelClient).

### Core Library Tests Maintained

**Baseline Preservation:**
Existing 1,950+ tests from Phases 1-5 continue passing. Phase 6 adds HTTP layer but does not modify core library (except minor integration points). Zero regressions.

**Command:**
```bash
cd codex-ts && npm test
```
Must succeed with 0 errors before phase complete.

### Code Quality

**TypeScript Strictness:**
Zero TypeScript errors. Strict mode enabled. No `any` types (use `unknown` with validation). All Zod schemas properly typed.

**ESLint Compliance:**
Zero ESLint errors. Warnings acceptable for pre-existing patterns. Follow established code conventions from port-02.

**Code Formatting:**
Prettier enforced via pre-commit hook or manual verification.

**Verification Command:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```

### API Design Quality

**RESTful Principles:**
- Resources clearly identified (conversations, tasks, providers)
- HTTP verbs used semantically (POST create, GET read, PATCH update, DELETE delete)
- Status codes meaningful (200, 201, 400, 404, 500, etc.)
- Idempotent operations where appropriate (GET, DELETE)

**Error Handling:**
- Structured error responses with code, message, details
- Proper HTTP status codes (400 validation, 404 not found, 500 internal)
- Actionable error messages for clients

**Documentation:**
- All endpoints documented with request/response examples
- EventMsg event types documented
- Streaming protocol explained
- Error responses cataloged

---

## 7. Out-of-Scope Confirmation

To maintain focus and deliverability, the following capabilities discussed during planning are explicitly deferred to later phases:

**Deferred to Phase 2.3+:**
- Workspace CRUD endpoints
- Multi-level workspace hierarchies
- Branch operation (clone + turn divergence)
- System prompt management API
- Turn-level operations (turn listing, turn editing)

**Deferred to Phase 2.5:**
- Continuous run system
- Run state machine (active, paused, stopped)
- Multi-turn autonomous loops
- Run control API (pause, resume, cancel)

**Deferred to Phase 2.6:**
- Multi-agent coordination
- Cross-run visibility
- Planner-coder communication
- Run injection/control from other conversations

**Deferred to Phase 3+:**
- Memory gradient integration
- Fidelity compression system
- Context preprocessing agents
- Cognitive interrupt agents
- Redis-backed memory banks

**Deferred Indefinitely:**
- Token-level streaming (real-time text deltas)
- Authentication and user management
- Multi-tenancy
- Horizontal scaling (single instance target)
- Observability (tracing, metrics)
- Production hardening (rate limiting, DDoS protection)

---

## 8. Implementation Strategy

### Incremental Development Approach

Phase 6 breaks into smaller sub-phases for risk management and fast validation:

**Phase 2.0: Wrap CLI in Fastify**
Simplest possible implementation. Fastify server shells out to existing `cody` CLI commands, parses output, returns as JSON. Proves REST API design works. Enables immediate Playwright test development.

**Deliverable:** Working REST API delegating to CLI. Playwright tests can be written against real API.

**Phase 2.1: Replace CLI with Library Calls**
Replace shell exec with direct ConversationManager method calls. Tests continue passing (API contract unchanged). Faster, cleaner, no subprocess overhead.

**Deliverable:** REST API using library directly. Same API surface, better implementation.

**Phase 2.2: Add Redis Streams + SSE**
Integrate Redis for event streaming. Implement async task pattern (submit returns taskId). EventMsg events written to Redis Streams. SSE endpoint serves events to clients.

**Deliverable:** Non-blocking API with durable event streaming. Supports hours-long sessions.

**Phase 2.3: Conversation Metadata Expansion**
Add new metadata fields to SessionMeta. Implement update and clone operations. Add filtering by metadata.

**Deliverable:** Rich conversation organization capabilities.

**Phase 2.4: Provider System Refactor**
Refactor to hardcoded Provider enum. Build ProviderAdapter pattern. Create model catalogs. Implement discovery endpoints.

**Deliverable:** Clean provider abstraction with model discovery.

---

## 9. Success Metrics

**Primary Success: API Functionality**
- All Playwright tests passing (30-50 tests)
- All existing library tests passing (1,950+)
- Zero TypeScript errors, zero ESLint errors
- Can perform every CLI operation via REST API

**Secondary Success: Platform Foundation**
- Redis integration working (events stream reliably)
- SSE streaming works for hours-long sessions
- Multiple clients can monitor same task
- EventMsg format proven across all providers

**Developer Success:**
- Clear API documentation enables client development
- Playwright tests serve as API usage examples
- Error messages are actionable
- Setup is straightforward (README instructions work)

**Validation Criteria:**
1. Can build simple web UI using only the REST API (no CLI needed)
2. Can run 2-hour coding session, client disconnects/reconnects multiple times, no data loss
3. Can switch providers mid-conversation, EventMsg stream continues seamlessly
4. Can create, organize, and manage 50+ conversations via API without confusion

---

## 10. Timeline & Effort

**Phase 2.0 (Wrap CLI):** 1-2 days
**Phase 2.1 (Library Calls):** 2-3 days
**Phase 2.2 (Redis + Streaming):** 3-4 days
**Phase 2.3 (Metadata):** 1-2 days
**Phase 2.4 (Providers):** 2-3 days

**Total Estimated:** 9-14 days focused effort

**Critical Path:** 2.0 → 2.1 → 2.2 (get streaming working)

**Note:** Timeline assumes autonomous agent execution (GPT-5-Codex on loop) with human oversight. Human time is planning (2-3 days) + monitoring/intervention (~2-4 hours/day during execution).

---

## 11. Risks & Mitigation

**Risk: Redis Integration Complexity**
- Mitigation: Start with Redis Streams only (no caching, no pub/sub). Simplest possible integration. Proven pattern from v/codex-port.

**Risk: EventMsg Format Instability**
- Mitigation: EventMsg is from stable Rust port. Format won't change. Well-tested in CLI already.

**Risk: Hours-Long Session Edge Cases**
- Mitigation: Comprehensive Playwright tests for disconnection scenarios. Redis Streams provide durability. Clear Last-Event-ID resume logic.

**Risk: Provider Abstraction Refactor**
- Mitigation: Providers already abstracted via WireApi enum. Refactor to Provider enum is renaming + slight restructure. Low risk.

**Risk: Scope Creep**
- Mitigation: Explicit out-of-scope list. Defer aggressively. Focus on API that matches current CLI capabilities only.

---

## Summary

Phase 6 transforms Cody from a CLI tool into a platform by wrapping the proven core library with a production-grade REST API. The async task pattern with EventMsg streaming via Redis Streams enables hours-long agent sessions with client reconnection. Rich conversation metadata and multi-provider support establish the foundation for future innovations. Success is measured by comprehensive Playwright tests defining clear API contracts and zero regressions in the existing library.

**Result:** A REST API that works for the real-world agent workflows already proven with CLI, ready to support web UIs, mobile clients, and autonomous orchestration systems in subsequent phases.
