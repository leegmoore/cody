# Codex TypeScript: Product Vision & Development Plan

**Version:** 1.0
**Date:** November 7, 2025
**Status:** Active Development

---

## Project Summary

The Codex TypeScript port converts the Rust-based Codex agent into a pure TypeScript library (`@openai/codex-core`) while adding capabilities for memory management, tool composition, and multi-provider integration.

**Core Objectives:**
- Port Codex functionality to TypeScript for broader platform support
- Support multiple LLM providers (OpenAI, Anthropic) through unified interface
- Enable compositional tool calling via sandboxed script execution
- Implement multi-tier memory compression for extended conversation capacity
- Provide intelligent context assembly with dynamic injection

**Current Status:** Phase 4 (Client Integration & Tool System)

---

## The Rust Port: Foundation & Enhancement Strategy

### Approach

Port modules faithfully from Rust while introducing enhancements at specific integration points. The Rust architecture provides the proven foundation, while targeted additions address capabilities not present in the original implementation.

**Rust Codebase:**
- ~40 workspace modules
- Protocol layer (types, events, operations)
- Core engine (configuration, conversation, persistence)
- Execution layer (commands, file operations, sandboxing)
- Client layer (LLM communication)
- Tool system (built-in tools + MCP integration)

### Port Phases

**Completed:**
- Phase 1: Protocol types (283 tests)
- Phase 2: Configuration & persistence (87 tests)
- Phase 3: Execution & tools (163 tests)
- Phase 4.0-4.3: Multi-provider client (OpenAI + Anthropic)
- Phase 4.4: Script harness core (QuickJS sandbox)
- Phase 4.5: Tool optimization & migration
- Phase 4.6: Additional tools + tool packs

**Planned:**
- Phase 5: Authentication & remaining core modules
- Phase 6: Core orchestration (conversation-manager, codex)
- Phase 7+: Memory system enhancements

### Enhancement Integration Points

Enhancements integrate at boundaries without disrupting core architecture:
- Client layer: Messages API via WireApi enum extension
- Response processing: Script detection before tool routing
- History system: Strategy pattern for swappable implementations
- Context assembly: Injection points for dynamic content
- Tool execution: Sandbox wraps existing implementations

---

## Enhancement 1: Multi-Provider Client

### Design

Extend provider abstraction to support three LLM APIs while preserving each API's native capabilities and normalizing to common event stream.

### Supported APIs

**OpenAI Responses API:**
- Semantic streaming (structured events)
- Native tool calling format
- Reasoning controls (effort, summary)
- Structured output support

**OpenAI Chat Completions:**
- Delta streaming (incremental tokens)
- Function calling (wrapped format)
- Aggregation adapter (deltas → complete messages)

**Anthropic Messages API:**
- Content block streaming
- Tool use with unique IDs
- Thinking blocks (extended reasoning)
- Multi-modal content support

### Architecture

```typescript
enum WireApi {
  Responses,  // OpenAI semantic
  Chat,       // OpenAI classic
  Messages,   // Anthropic
}
```

Each API:
- Builds requests in native format
- Parses responses in native structure
- Adapts to unified ResponseEvent stream
- Converts tools to API-specific schema

**Benefits:**
- Single codebase supports multiple providers
- Each API uses optimal request/response patterns
- Models access provider-specific features
- Consistent interface for application code

**Status:** Complete (Phase 4.1-4.2)

---

## Enhancement 2: Script-Based Tool Execution

### Motivation

Traditional structured tool calls require one LLM round-trip per tool invocation. For multi-step workflows, this fragments context and increases latency. Script execution enables complex tool compositions in single turns.

### Architecture

**Detection:** Scan assistant responses for `<tool-calls>` XML blocks
**Extraction:** Parse and validate TypeScript code
**Execution:** QuickJS WASM sandbox (worker threads)
**Tool Access:** Frozen proxy exposing approved tools
**Approval Integration:** Scripts pause for user approval (Asyncify)
**Promise Management:** Track async calls, abort orphaned promises

### Security

**Isolation:**
- QuickJS WASM runtime (no Node.js access)
- Worker threads (killable, isolated)
- Frozen intrinsics (Object, Function, Promise, etc.)

**Resource Limits:**
- 30 second timeout
- 96MB memory cap
- 32 tool call limit per script
- 20KB max script size

**Tool Access:**
- Whitelist-based exposure
- Argument validation via schemas
- Approval flow preserved (existing system)

### Tool Capabilities

**File Operations:**
- readFile (indentation-aware navigation)
- listDir (recursive directory listing)
- grepFiles (ripgrep content search)
- applyPatch (unified diff with tree-sitter)
- fileSearch (fuzzy filename matching)

**Execution:**
- exec (sandboxed command execution)

**Planning:**
- updatePlan (structured task management)

**Images:**
- viewImage (image injection into conversation)

**MCP:**
- Dynamic tools from MCP servers
- MCP resource access (list, read)

**Web & Orchestration (Phase 4.7):**
- webSearch (Perplexity integration)
- fetchUrl (Firecrawl scraping)
- Document management stubs
- Prompt caching stubs
- Agent orchestration stubs

**Total:** 20+ tools

### Tool Pack System

Pre-configured tool collections for different scenarios:
- `core-codex`: Essential editing and execution tools
- `anthropic-standard`: Basic Claude tool set
- `file-ops`: File system operations only
- `research`: Search and information gathering
- `all`: Complete tool set

**Status:** Complete (Phase 4.4-4.7)

---

## Enhancement 3: Compression Gradient Memory

### Motivation

LLM context windows impose hard limits on conversation length. Traditional approaches truncate history when full, losing valuable context. Compression with intelligent fidelity selection enables extended conversations within fixed token budgets.

### Compression Tiers

**Four versions created per turn:**

**Raw (R):** Original, unmodified content
- Complete messages
- Full tool calls (arguments, outputs)
- All reasoning blocks

**Smoothed (S):** Normalized, cleaned
- Grammar and spelling corrected
- Formatting standardized
- Noise removed
- Tool calls with summarized parameters

**Compressed (C):** Summarized by LLM
- Key points and decisions
- Actions taken and results
- Tool calls: "{tool X called, result Y}"

**Tiny (T):** Ultra-compressed
- Single sentence summary
- Tool calls omitted or aggregated

**Token reduction:** R (100%) → S (60%) → C (30-40%) → T (1-5%)

### Gradient Selection

**Allocation by recency:**
- Recent turns: Full detail (Raw)
- Working memory: Clean version (Smoothed)
- Background: Compressed summaries
- Deep history: Tiny summaries

**Example allocation (100k budget, 200 turns):**
- Turns 181-200: Raw (40k tokens, 40%)
- Turns 161-180: Smoothed (16k tokens, 16%)
- Turns 101-160: Compressed (30k tokens, 30%)
- Turns 1-100: Tiny (14k tokens, 14%)

**Recalculation:** Every 10 turns to adjust band boundaries as history grows.

### Turn Tagging

**XML element names encode turn ID and level:**
```xml
<T-183-R>
[Full turn content]
</T-183-R>
```

**Compressed blocks:**
```xml
<T-50-through-100-C>
Turn 50: [summary]. Turn 51: [summary]...
</T-50-through-100-C>
```

**System prompt informs models:**
- Turn ID format and meaning
- Compression levels available
- How to request higher fidelity

### Fidelity Retrieval

**Tool for on-demand detail:**
```typescript
tools.history.getTurn(turnId, level)
// Returns specified version
// Adds to announcement board (5 turn TTL)
```

**Use case:** Model sees compressed mention of relevant past discussion, requests full detail.

### Processing Pipeline

**After each turn:**
1. Store raw version
2. Async: Generate S/C/T versions (parallel LLM calls)
3. Complete in 1-2 seconds or continue in background
4. Failure detection and retry for incomplete processing

**Every 10 turns:**
- Recalculate gradient band boundaries
- Update allocation percentages
- Minimize cache invalidation

### Capacity

**Estimated spans:**
- 100k budget: ~200 turns
- 200k budget: ~400-500 turns
- Raw equivalent: Several million tokens compressed

**Actual capacity depends on:**
- Turn complexity
- Tool call density
- Compression effectiveness

**Status:** Design complete, implementation Phase 7

---

## Enhancement 4: Offline Memory Processing

### Purpose

Background agents with large context windows process conversation history to extract knowledge, identify patterns, and prepare reference materials for dynamic injection.

### Processing Model

**Execution:**
- Frequency: 2x daily
- Context: 1-2M tokens (C/T compressed history + S recent turns)
- Pricing: Batch mode (reduced cost)
- Models: Large context models (GPT-5, Gemini Pro)

### Extraction Tasks

**1. Topic & Category Identification**
- Identify conversation themes
- Extract keywords
- Assign topic weights
- Track evolution over time

**2. Knowledge Consolidation**
- User preferences
- Design patterns
- Technology stack understanding
- Project-specific conventions

**3. Lesson Distillation**
- What worked vs what didn't
- Solutions to recurring problems
- Patterns worth codifying
- Mistakes to avoid

**4. Reference Layer Assembly**
- Identify documentation needs (500-5000 tokens)
- Prepare technology references
- Compile pattern libraries
- Flag knowledge gaps

### Outputs

**Lessons Store:**
```typescript
{
  lessonId: string;
  topics: string[];
  keywords: string[];
  content: string;          // Distilled lesson
  sourceTurns: string[];   // Origin
  weight: number;          // Relevance (0-1)
}
```

**Reference Layers:**
- Pre-compiled documentation chunks
- Tagged by topic and technology
- Sized for efficient injection (500-5000 tokens)
- Curated by admin when needed

**Topic Weights:**
- Dynamic importance scores
- Adjusted based on conversation patterns
- Guide retrieval prioritization

**Admin Recommendations:**
- Suggested reference layers to create
- Knowledge gaps identified
- Index optimization suggestions

### Integration

Offline processing outputs feed into runtime preprocessing for dynamic context injection.

**Status:** Design complete, implementation Phase 8

---

## Enhancement 5: Runtime Turn Preprocessing

### Purpose

Before each turn executes, gather potentially relevant context from past history and knowledge base, filter using small models, and inject into prompt.

### Pipeline (1 Second Budget)

**Parallel Execution:**

**Keyword Search (100ms):**
- Search compressed history
- Search lessons store
- Search reference layers
- Returns: 20-30 candidates

**Vector Semantic Search (200ms):**
- Embedding similarity against history
- Knowledge base search
- Returns: 20-30 candidates

**Nano Agent Filter (500ms):**
- Small models (flash 2.0, haiku 4.5, gpt-5-nano)
- Each reviews subset of candidates
- Filter obvious non-relevance
- Returns: 10-20 filtered items

**Timeout at 1 Second:**
- Collect completed results
- Proceed with available data

### Final Judgment

**Small fast model reviews:**
- Latest user prompt
- Compressed recent history
- Filtered search results

**Decides:**
- Which reference layers to inject
- Which memory ticklers to include
- Which lessons to surface
- Formatting and placement

**Processing time:** ~200ms

### Injection Format

**Memory Ticklers:**
```
💭 Related Context:
- Turn 87 (3 weeks ago): OAuth implementation approach
  tools.history.getTurn("T-87", "S") for detail
```

**Reference Layers:**
```
📚 Relevant Documentation:
- TypeScript Error Handling Patterns (1.8k tokens)
- OAuth Best Practices (2.3k tokens)
```

**Distilled Lessons:**
```
💡 Project Patterns:
- Token refresh: Use exponential backoff
- Validation: Check input sanitization first
```

### Context Assembly

**Final prompt structure:**
1. System prompt (base instructions)
2. Memory layer (ticklers, lessons, references)
3. Announcement board (capabilities, recent items, turn awareness)
4. Main history (gradient-selected, turn-tagged)
5. User's current prompt

**Placement reasoning:**
- Memory/Announcement vary per turn (dynamic content)
- History structure stable (cache-friendly)
- System + History cacheable
- Dynamic injection has minimal cache impact

**Status:** Design complete, implementation Phase 7-8

---

## Context Management Architecture

### Memory Hierarchy

**Working Memory (Current Turn):**
- Active messages
- Tool executions in flight
- Immediate results

**Announcement Board (5 Turn TTL):**
- Recent web fetches (with fileKeys)
- Retrieved turn detail
- Temporary reference material
- Capability reminders

**Main History (Gradient-Selected):**
- Mixed fidelity (R/S/C/T per band)
- Fixed token budget (100-200k)
- Turn-tagged for reference
- Spans hundreds of turns

**Compressed Archive (All Turns):**
- All versions stored
- Retrievable on demand
- Supports historical analysis

**Knowledge Base (Distilled):**
- Lessons learned
- Reference layers
- Topic weights
- User preferences

### Storage Design

**Per-Turn Storage:**
```typescript
{
  turnId: string;
  versions: {
    raw: ResponseItem[];
    smoothed: ResponseItem[];
    compressed: string;
    tiny: string;
  };
  metadata: {
    tokens: {raw, smoothed, compressed, tiny};
    toolCallCount: number;
    topics: string[];
  };
}
```

**Gradient Configuration:**
```typescript
{
  bands: [
    {range: [start, end], level: 'R'|'S'|'C'|'T', allocation: number}
  ];
  lastCalculated: timestamp;
}
```

---

## Development Roadmap

**Completed Phases:**
- Phase 1: Protocol layer
- Phase 2: Configuration & persistence
- Phase 3: Execution & core tools
- Phase 4.0-4.3: Multi-provider client
- Phase 4.4: Script harness core
- Phase 4.5: Tool migration & optimization
- Phase 4.6: Additional tools & tool packs

**In Progress:**
- Phase 4.7: Web search & orchestration tools

**Planned:**
- Phase 5.1: Conversation & history management
- Phase 6: Core integration
- Phase 7: Compression gradient implementation
- Phase 8: Offline processing & dynamic injection

---

## Technical Approach

### Multi-Strategy History

**Three conversation modes supported:**

**1. Regular Mode:**
- Standard conversation pattern
- Full messages until context fills
- Truncation when budget exceeded
- (Rust's current implementation)

**2. Continuous One-Shot:**
- Epic/spec + task list + log file
- Repeated single-turn executions
- No conversation history accumulation
- Agent processes until completion or user input needed

**3. Gradient Mode:**
- Compressed versions at multiple fidelity levels
- Intelligent selection per token budget
- On-demand detail retrieval
- Infinite effective history

**Implementation:** Strategy pattern allows mode selection per session.

### Cache Optimization

**Stable components (highly cacheable):**
- System prompt
- Main history structure (gradient bands stable across multiple turns)

**Variable components (updated per turn):**
- Memory layer (search results, lessons)
- Announcement board (recent items, capabilities)
- User prompt (fresh)

**Cache strategy:** Most tokens cached, dynamic injection limited to <10k variable content.

---

## Conclusion

This project provides a TypeScript implementation of Codex with extensions for multi-provider support, compositional tool execution, and intelligent memory management. The system aims to address context window limitations, tool orchestration complexity, and knowledge retention across extended conversations.

**Next Steps:**
1. Complete tool system (Phase 4.7)
2. Port conversation management (Phase 5.1)
3. Integrate core orchestration (Phase 6)
4. Implement compression system (Phase 7+)

Each phase delivers functional value while preparing for subsequent enhancements.
