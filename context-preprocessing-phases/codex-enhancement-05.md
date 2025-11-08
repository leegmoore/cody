# Codex Enhancement 05: Runtime Turn Preprocessing & Dynamic Injection

**Enhancement:** Parallel Search and Filtering with Intelligent Context Assembly
**Status:** Design Complete, Implementation Planned (Phase 7-8)
**Date:** November 7, 2025

---

## Overview

This enhancement introduces a preprocessing pipeline that executes before each turn, gathering potentially relevant context from conversation history and knowledge base through parallel searches and nano-agent filtering, then intelligently injecting curated content into the final prompt.

Operating within a tight 1-second budget, the system runs multiple retrieval strategies concurrently, filters results through small fast models, and uses a judgment model to make final injection decisions. The result is dynamically assembled context that enhances model performance without manual retrieval specification.

---

## Purpose and Constraints

### What Turn Preprocessing Does

**Executes:** Before each turn is sent to the main model
**Analyzes:** User's new prompt + recent compressed history
**Searches:** Historical turns, lessons store, reference layers
**Filters:** Via small models (remove obvious irrelevance)
**Decides:** What additional context to inject and where
**Injects:** Memory ticklers, reference layers, lessons into prompt
**Returns:** Enhanced prompt ready for main model

### Time Budget: 1 Second

**Constraint:** Preprocessing must complete in ~1 second to avoid perceived latency.

**Why 1 second:**
- User submits prompt
- Brief acceptable delay (<2s total including main model startup)
- Parallel processing maximizes work within budget
- Timeout ensures we proceed even if incomplete

**Trade-off:**
- More time = better retrieval
- Less time = better UX
- 1 second = practical balance

**Implementation:**
- All retrieval runs in parallel
- Timeout at 1000ms
- Use whatever results collected by deadline
- Incomplete searches acceptable (partial results better than none)

---

## Pipeline Architecture

### High-Level Flow

```
User submits new prompt
    ↓
┌─────────────────────────────────────────┐
│ Turn Preprocessing Triggered            │
│ Budget: 1000ms                          │
└────────────┬────────────────────────────┘
             │
    ┌────────┴────────┐
    │   PARALLEL:     │
    │   (All start    │
    │   simultaneously)│
    └────────┬────────┘
             │
    ┌────────┴─────────────────────────┐
    │                                  │
    ▼                ▼                 ▼
┌─────────┐    ┌─────────┐    ┌──────────────┐
│ Keyword │    │ Vector  │    │ Nano Agent   │
│ Search  │    │Semantic │    │ Swarm Filter │
│ 100ms   │    │ Search  │    │ 500ms        │
│         │    │ 200ms   │    │              │
└────┬────┘    └────┬────┘    └──────┬───────┘
     │              │                 │
     │ 20-30        │ 20-30           │ 10-20
     │ candidates   │ candidates      │ filtered
     │              │                 │
     └──────────────┴─────────────────┘
                    │
            Timeout at 1000ms
                    ↓
        ┌───────────────────┐
        │ Collect Results   │
        │ (50-70 items)     │
        └─────────┬─────────┘
                  ↓
        ┌───────────────────┐
        │ Final Judgment    │
        │ Model             │
        │ 200ms             │
        └─────────┬─────────┘
                  ↓
        ┌───────────────────┐
        │ Injection Decision│
        │                   │
        │ Select:           │
        │ - Reference layers│
        │ - Memory ticklers │
        │ - Lessons         │
        │ - Format/placement│
        └─────────┬─────────┘
                  ↓
        ┌───────────────────┐
        │ Assemble Context  │
        │                   │
        │ 1. System prompt  │
        │ 2. Memory layer   │
        │ 3. Announcement   │
        │ 4. History        │
        │ 5. User prompt    │
        └─────────┬─────────┘
                  ↓
        ┌───────────────────┐
        │ Send to Main Model│
        └───────────────────┘

Total: ~1.2 seconds (1s preprocessing + assembly)
```

---

## Component 1: Keyword Search

### Purpose

Fast lookup of content containing specific terms from user's prompt.

### Process

**Input:**
```
User prompt: "How should I handle auth token expiration?"
Recent compressed history: Turns 201-220 (S level)
```

**Execution:**
```
1. Extract keywords from prompt:
   ["auth", "token", "expiration", "handle"]

2. Query keyword index (built by offline processing):
   - "auth" → [lesson_auth_001, lesson_auth_003, ref_auth_impl, T-87, T-102, ...]
   - "token" → [lesson_auth_001, lesson_auth_002, ref_auth_impl, T-12, T-45, ...]
   - "expiration" → [lesson_auth_001, T-45, T-156, ...]

3. Aggregate results:
   - Deduplicate
   - Rank by number of keyword matches
   - Weight by topic importance

4. Return top 20-30 candidates
```

**Output:**
```typescript
[
  {type: "lesson", id: "lesson_auth_001", score: 0.95, keywords: ["auth", "token", "expiration"]},
  {type: "refLayer", id: "ref_auth_impl", score: 0.88, keywords: ["auth", "token"]},
  {type: "turn", id: "T-87", score: 0.82, keywords: ["token", "auth"]},
  {type: "turn", id: "T-45", score: 0.78, keywords: ["token", "expiration"]},
  ...
]
```

**Time:** 50-100ms (in-memory index lookup)

### Index Structure

**Built by offline processing:**
```typescript
keywordIndex: Map<string, {
  lessons: {id: string, weight: number}[],
  referenceLayers: {id: string, weight: number}[],
  turns: {id: string, level: string}[],
  topicWeight: number
}>
```

**Lookup:**
```typescript
async function keywordSearch(keywords: string[]): Promise<SearchResult[]> {
  const results = new Map<string, SearchResult>();

  for (const keyword of keywords) {
    const entry = keywordIndex.get(keyword.toLowerCase());
    if (!entry) continue;

    // Add all matches
    for (const lesson of entry.lessons) {
      const existing = results.get(lesson.id) || {id: lesson.id, score: 0, keywords: []};
      existing.score += lesson.weight * entry.topicWeight;
      existing.keywords.push(keyword);
      results.set(lesson.id, existing);
    }
    // ... same for refLayers and turns
  }

  return Array.from(results.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}
```

---

## Component 2: Vector Semantic Search

### Purpose

Find semantically similar content even without exact keyword matches.

### Process

**Input:**
```
User prompt: "How should I handle auth token expiration?"
```

**Execution:**
```
1. Generate embedding for user prompt:
   embedding = await generateEmbedding(userPrompt)
   // Uses OpenAI embeddings API or similar
   // Dimension: 1536 or model-specific

2. Query vector index:
   - Cosine similarity against all stored embeddings
   - Lessons, reference layers, important turns
   - Return top K by similarity

3. Rank by similarity score

4. Return top 20-30 candidates
```

**Output:**
```typescript
[
  {type: "lesson", id: "lesson_auth_001", similarity: 0.89},
  {type: "refLayer", id: "ref_auth_impl", similarity: 0.84},
  {type: "lesson", id: "lesson_security_002", similarity: 0.76},  // Related but not exact match
  ...
]
```

**Time:** 150-200ms (vector DB query)

### Semantic Advantages

**Finds relevant content even with different wording:**
```
Prompt: "token expiration handling"
Matches:
  - Lesson about "JWT refresh logic" (semantically similar)
  - Turn discussing "session timeout" (related concept)
  - Reference on "auth lifecycle management" (broader context)
```

**Better than keyword for:**
- Synonyms (session/auth, timeout/expiration)
- Related concepts (auth + security)
- Broader context (token management encompasses expiration)

---

## Component 3: Nano Agent Swarm

### Purpose

Filter search results using small models to remove obvious non-relevance while keeping potentially useful items.

### Design

**Nano Agent:** Small, fast model (flash 2.0, haiku 4.5, gpt-5-nano)
**Task:** Binary filter (keep/discard) for subset of candidates
**Execution:** Parallel (multiple agents, each reviewing different items)

### Process

**Input:**
```
Combined candidates from keyword + vector search: ~50-70 items
User prompt: "How should I handle auth token expiration?"
Recent context: Compressed turns 201-220 (for understanding current state)
```

**Agent assignment:**
```
Candidates split across N agents (default: 5 agents)
  Agent 1: Reviews items 1-14
  Agent 2: Reviews items 15-28
  Agent 3: Reviews items 29-42
  Agent 4: Reviews items 43-56
  Agent 5: Reviews items 57-70
```

**Per-agent execution:**
```
Prompt to nano agent:
  Current task: "How should I handle auth token expiration?"

  Recent context (brief):
  [Compressed recent turns showing current work]

  Review these items and mark keep/discard:
  1. Lesson: "Mutex-Protected Token Refresh"
  2. Turn T-87: OAuth implementation
  3. Lesson: "Database Query Optimization"  (probably not relevant)
  ...

  Keep if:
  - Directly relevant to task
  - Provides useful context
  - Might help understand problem

  Discard if:
  - Obviously unrelated topic
  - Redundant with other items
  - Too generic to be useful

  Output: Array of IDs to KEEP (omit discards)
```

**Agent 1 returns:**
```typescript
{keep: ["lesson_auth_001", "T-87", "ref_auth_impl"]}
// Discarded: "lesson_db_005" (unrelated)
```

**All agents return in parallel (~500ms):**
```
Agent 1: 10 keep, 4 discard
Agent 2: 8 keep, 6 discard
Agent 3: 7 keep, 7 discard
Agent 4: 9 keep, 5 discard
Agent 5: 6 keep, 8 discard

Total: 40 keep, 30 discard
```

**Output:**
```typescript
filteredResults: [
  {type: "lesson", id: "lesson_auth_001", score: 0.95},
  {type: "refLayer", id: "ref_auth_impl", score: 0.88},
  {type: "turn", id: "T-87", score: 0.82},
  ...
  // 10-20 highly relevant items
]
```

### Agent Pool Configuration

**Scalability:**
```
Few candidates (<30): 2-3 agents
Medium candidates (30-60): 5 agents
Many candidates (60+): 8 agents
```

**Model selection:**
- flash 2.0 (fast, cheap, good enough)
- haiku 4.5 (alternative)
- gpt-5-nano (alternative)

**Parallel execution:**
```typescript
const agentPromises = agents.map((agent, i) => {
  const subset = candidates.slice(i * chunkSize, (i + 1) * chunkSize);
  return agent.filter(subset, userPrompt, recentContext);
});

const results = await Promise.race([
  Promise.all(agentPromises),
  timeout(500)  // Hard cutoff
]);

// Use whatever completed
const filtered = results.flat().filter(Boolean);
```

**Cost:**
- 5 agents × ~1k tokens input × ~100 tokens output
- ~6k tokens total per turn
- ~$0.001-0.003 per turn at current pricing

---

## Component 4: Final Judgment Model

### Purpose

Review filtered results and make injection decisions based on token budget, relevance, and placement strategy.

### Input

```typescript
{
  userPrompt: string;
  recentHistory: string;  // Compressed turns 201-220
  filteredCandidates: SearchResult[];  // 10-20 items
  availableBudget: {
    memoryLayer: 8000,      // Tokens for memory layer
    announcement: 5000,     // Tokens for announcement board
    total: 13000
  }
}
```

### Judgment Process

**Prompt to small model:**
```
You are preparing context for an AI coding assistant.

Current task: "How should I handle auth token expiration?"

Recent context:
[Compressed recent turns showing current project state]

Available context items:
1. Lesson: "Mutex-Protected Token Refresh" (900 tokens, weight 0.9)
   Summary: Prevents race conditions in token refresh via mutex pattern
2. Reference Layer: "Authentication Implementation" (2400 tokens, weight 0.85)
   Summary: Complete auth flow documentation for this project
3. Turn T-87: OAuth implementation details (1200 tokens, level S)
   Summary: How OAuth was integrated and tested
...

Budget: 13000 tokens total (8000 memory layer, 5000 announcement)

Decide:
1. Which items to include?
2. Where to place each? (memory layer vs announcement board)
3. Format for each? (full vs summary)

Criteria:
- Direct relevance to current task (highest priority)
- Provides necessary context (not just related)
- Fits within budget
- Avoid redundancy

Output:
{
  memoryLayer: {
    referenceLayers: ["ref_auth_impl"],
    lessons: ["lesson_auth_001"],
    format: "full"
  },
  announcementBoard: {
    retrievedTurns: [],
    capabilities: ["standard reminders"],
    format: "standard"
  },
  totalTokens: 3300,
  reasoning: "Auth reference layer provides project-specific implementation context, lesson covers race condition prevention which is relevant for token handling."
}
```

**Model selection:**
- Small fast model (gpt-5-nano, flash 2.0)
- Good at reasoning about relevance
- Quick decision making
- Low cost

**Time:** ~200ms

### Decision Factors

**Relevance scoring:**
```
- Exact topic match (auth + token): High priority
- Related topic (security): Medium priority
- Distant topic (UI styling): Low priority (skip)
```

**Token efficiency:**
```
- Reference layer (2400 tokens): High info density
- Single lesson (900 tokens): Focused, actionable
- Multiple similar lessons: Pick best, skip others
- Old turn (1200 tokens): Only if unique info
```

**Placement logic:**
```
Memory layer (before history):
  - Reference layers (stable, cache-friendly placement)
  - Lessons (general knowledge)

Announcement board (after user prompt):
  - Retrieved turn detail (temporary, specific)
  - Capabilities/reminders (procedural)
  - Recent fetches (contextual)
```

**Redundancy avoidance:**
```
If lesson covers same ground as reference layer:
  - Skip lesson (ref layer more comprehensive)

If multiple lessons on same topic:
  - Pick highest weight
  - Or most recent
  - Skip others
```

---

## Injection Assembly

### Context Structure

**Final prompt sent to main model:**

```
┌─────────────────────────────────────────────────┐
│ 1. System Prompt                                │
│    [Base instructions, capabilities]            │
│    ~2k tokens                                   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 2. Memory Layer (Dynamic Injection)             │
│                                                 │
│ 💡 Relevant Lessons:                            │
│                                                 │
│ Lesson: Mutex-Protected Token Refresh          │
│ Problem: Concurrent token refresh races        │
│ Solution: Mutex pattern with exponential backoff│
│ [Full lesson content, 900 tokens]              │
│                                                 │
│ 📚 Reference Documentation:                     │
│                                                 │
│ Authentication Implementation                   │
│ [Full reference layer, 2400 tokens]            │
│                                                 │
│ Total memory layer: ~3300 tokens               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 3. Announcement Board                           │
│                                                 │
│ 📋 Current Context (5 turn TTL):                │
│                                                 │
│ 🔧 Tool Capabilities:                           │
│ - Retrieve turn detail: tools.history.getTurn  │
│ - Compression levels: R/S/C/T                   │
│ - Current history span: Turns 1-220            │
│   (181-220: Raw, 161-180: Smoothed, etc.)      │
│                                                 │
│ 🌐 Recent Web Fetches:                          │
│ - FileKey ABC123: "JWT best practices"         │
│   (2 turns old, expires in 3 turns)            │
│                                                 │
│ Total announcement: ~1500 tokens               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 4. Main History (Gradient Selected)            │
│                                                 │
│ <T-1-through-110-T>                             │
│ [Tiny summaries, ~6k tokens]                    │
│ </T-1-through-110-T>                            │
│                                                 │
│ <T-111-through-170-C>                           │
│ [Compressed, ~30k tokens]                       │
│ </T-111-through-170-C>                          │
│                                                 │
│ <T-171-S> ... </T-171-S>                        │
│ [20 smoothed turns, ~16k tokens]                │
│                                                 │
│ <T-191-R> ... </T-191-R>                        │
│ [30 raw turns, ~40k tokens]                     │
│                                                 │
│ Total history: ~92k tokens                      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 5. User's Current Prompt                        │
│    "How should I handle auth token expiration?" │
│    ~20 tokens                                   │
└─────────────────────────────────────────────────┘

Total: ~99k tokens (within 100k budget)
```

**Breakdown:**
- System: 2k (fixed)
- Memory layer: 3.3k (dynamic)
- Announcement: 1.5k (dynamic)
- History: 92k (stable, cached)
- Prompt: 0.02k (fresh)

**Cache efficiency:**
- System + History = 94k tokens (cacheable)
- Memory + Announcement = 4.8k tokens (variable per turn)
- ~95% of prompt is cached

---

## Memory Layer Format

### Memory Ticklers

**What:** References to relevant past context with retrieval instructions.

**Format:**
```
💭 This Reminds Me Of:

Turn 87 (3 weeks ago): OAuth token refresh race condition issue
We implemented mutex-protected refresh with exponential backoff.
Testing with 500 concurrent requests showed zero race failures.

To see full implementation:
  tools.history.getTurn("T-87", "S")
```

**When used:**
- Compressed history mentions something briefly (T-87-C: "Fixed token refresh")
- Current task relates to same topic
- Full detail might be helpful

**Benefit:**
- Model aware of relevant past work
- Can retrieve detail if needed
- Doesn't consume budget unless retrieved

### Distilled Lessons

**What:** Extracted patterns and solutions from offline processing.

**Format:**
```
💡 Learned Patterns:

Token Refresh Race Conditions:
  Problem: Concurrent requests both refresh simultaneously
  Solution: Mutex pattern - acquire lock, check if already refreshed,
            refresh only if needed, release lock
  Implementation: See lesson in ref layer below
  Applicable: Any auth system with background token refresh
```

**When used:**
- Topic matches current task
- High-weight lesson (proven valuable)
- Provides actionable pattern

**Benefit:**
- Model sees what worked before
- Doesn't repeat mistakes
- Applies proven patterns

### Reference Layers

**What:** Pre-compiled documentation on specific topics.

**Format:**
```
📚 Reference Documentation:

Authentication Implementation
────────────────────────────
Overview: OAuth 2.0 with JWT tokens...
Implementation: /src/auth/ directory...
Key patterns: Mutex-protected refresh...
Common operations: Adding providers...
Troubleshooting: Race conditions...
Examples: [code snippets]

[Full reference layer content, 2400 tokens]
```

**When used:**
- Topic highly relevant
- Comprehensive context helpful
- Model likely to need multiple related facts

**Benefit:**
- Complete project-specific docs
- All related info in one place
- Concrete examples from actual code

---

## Announcement Board Details

### Purpose

Display transient information, recent fetches, and capability reminders without consuming main history budget.

### Location

**Positioned:** After user prompt, before main history

**Reasoning:**
- User prompt fresh in model's mind
- Announcement provides immediate context
- History follows with depth

### Content Sections

**1. Tool Capabilities (Static Reminder)**
```
🔧 Available Capabilities:

History Retrieval:
  tools.history.getTurn(turnId, level)
  - Levels: R (raw), S (smoothed), C (compressed), T (tiny)
  - Current span: Turns 1-220
  - Recent 30 in full detail (R)

Compression Info:
  - Your history uses multi-level compression
  - See turn tags for fidelity: <T-183-R> = full, <T-50-C> = summary
  - Request detail when needed
```

**2. Recent Web Fetches**
```
🌐 Recent Web Content (use fileKeys to access):

- FileKey ABC123: "JWT Token Best Practices" (MDN)
  Fetched: 2 turns ago, Expires: 3 turns
  Actions: tools.fetchFromFC("ABC123") or tools.writeFile("ABC123", path)

- FileKey DEF456: "OAuth 2.0 Security Considerations"
  Fetched: 1 turn ago, Expires: 4 turns
```

**3. Retrieved Turn Detail (If any)**
```
🕒 Retrieved History Detail:

<T-87-S>
[Full smoothed turn content, retrieved via tools.history.getTurn]
</T-87-S>
Retrieved: 1 turn ago, Expires: 4 turns
```

**4. File Cabinet Contents (If any)**
```
📁 File Cabinet (persistent storage):

- FileKey GHI789: "Project Architecture Decisions"
  Note: Key decisions made during initial design
  Saved: 5 days ago
```

**Total size:** Variable, typically 1-3k tokens

### TTL Management

**Per-item TTL (in turns, not time):**
```typescript
{
  type: "webFetch",
  fileKey: "ABC123",
  title: "JWT Best Practices",
  addedTurn: 218,
  ttl: 5,
  expiresAfterTurn: 223
}

// Check each turn:
if (currentTurn > item.expiresAfterTurn) {
  removeFromBoard(item);
}
```

**TTL values:**
- Web fetches: 5 turns
- Retrieved turn detail: 5 turns
- Capabilities reminder: Always present (no TTL)
- File cabinet listing: Always present

---

## Parallel Execution Details

### Timing Breakdown

**Ideal case (all complete):**
```
T=0ms:    All 3 components start
T=100ms:  Keyword search completes → 30 results
T=200ms:  Vector search completes → 30 results
T=500ms:  Nano swarm completes → 20 filtered
T=500ms:  Combine all results → 50 items (deduplicated to ~40)
T=700ms:  Judgment model completes → injection decision
T=900ms:  Context assembly completes
```

**Realistic case (with delays):**
```
T=0ms:    Start all
T=120ms:  Keyword search completes
T=250ms:  Vector search completes
T=580ms:  Nano swarm: 4/5 agents complete, 1 slow
T=1000ms: TIMEOUT - proceed with 4 agents' results
T=1200ms: Judgment model completes
T=1350ms: Assembly complete
```

**Worst case (failures):**
```
T=0ms:    Start all
T=150ms:  Keyword search completes
T=1000ms: TIMEOUT
          - Vector search: Still running (slow DB)
          - Nano swarm: 2/5 complete
T=1000ms: Proceed with partial results (keyword + 2 agents)
T=1180ms: Judgment model (with limited input)
T=1300ms: Assembly complete
```

**Timeout handling:**
```typescript
const results = await Promise.race([
  {
    keyword: keywordSearch(prompt),
    vector: vectorSearch(prompt),
    nanoFiltered: nanoSwarmFilter(candidates, prompt)
  },
  timeout(1000)
]);

// Use whatever completed
const available = {
  keyword: results.keyword || [],
  vector: results.vector || [],
  nanoFiltered: results.nanoFiltered || []
};

// Proceed with available data
const combined = combineResults(available);
```

**Graceful degradation:** Partial results better than waiting indefinitely.

---

## Injection Strategy

### Placement Decisions

**Memory Layer (Before History):**

**Contents:**
- Reference layers (comprehensive docs)
- Distilled lessons (patterns and solutions)
- Memory ticklers (past turn references)

**Why here:**
- Provides context before history
- Model primed with relevant knowledge
- Guides interpretation of history

**Token budget:** ~8k

**Cache impact:**
- Memory layer changes each turn (based on prompt)
- But system prompt + history stay stable
- Minimal cache invalidation (memory is small)

**Announcement Board (After User Prompt, Before History):**

**Contents:**
- Tool capability reminders
- Recent web fetches
- Retrieved turn detail
- File cabinet listing

**Why here:**
- User prompt fresh in mind
- Announcement provides immediate context
- Procedural info (how to use tools)

**Token budget:** ~5k

**Cache impact:**
- Announcement changes frequently
- But also small (5k tokens)
- Doesn't invalidate history cache

**Optimization:**
```
Cacheable: System prompt + History (~94k)
Variable: Memory + Announcement (~8k)

Total cache hit rate: ~94%
Only 8k tokens vary per turn (cheap to change)
```

### Format Variations

**Full inclusion:**
```
📚 Reference: Authentication Implementation
[Complete 2400 token reference layer]
```

**Summary with retrieval:**
```
💭 Relevant: Turn 87 (OAuth Implementation)
Summary: Token refresh with mutex pattern, tested under load
Details available: tools.history.getTurn("T-87", "S")
```

**Judgment model decides based on:**
- How critical is full detail?
- Is summary sufficient?
- Token budget remaining?

---

## Example: Complete Preprocessing Run

### Scenario

**User prompt:** "Add rate limiting to the auth endpoints"
**Current turn:** 225
**History:** 225 turns (gradient-compressed)
**Knowledge base:** 15 lessons, 8 reference layers, 24 topics

### Execution Timeline

**T=0ms: Trigger**
```
Parallel start:
  - Keyword search for: ["rate limiting", "auth", "endpoints"]
  - Vector embedding generated and searched
  - Recent context compiled (turns 206-225, compressed)
```

**T=95ms: Keyword Search Completes**
```
Results:
  - lesson_api_005: "API Rate Limiting Implementation"
  - ref_api_design: "API Design Principles"
  - lesson_perf_002: "Redis Caching for Rate Limits"
  - T-156: Rate limiting discussion
  - T-157: Redis integration
  ... (25 total)
```

**T=210ms: Vector Search Completes**
```
Results:
  - lesson_api_005: similarity 0.91
  - ref_api_design: similarity 0.84
  - lesson_security_003: "Request Validation" (related)
  - T-145: Performance optimization
  ... (28 total)
```

**T=485ms: Nano Swarm Completes**
```
5 agents reviewed 53 combined candidates:
  Kept: 18 items
    - lesson_api_005 (all agents agreed: relevant)
    - ref_api_design (4/5 agents: relevant)
    - lesson_perf_002 (3/5 agents: potentially relevant)
    - lesson_security_003 (2/5 agents: marginal)
    ...
  Discarded: 35 items
    - lesson_ui_001 (unrelated topic)
    - T-23 (too old, not relevant)
    ...
```

**T=690ms: Judgment Model Completes**
```
Decision:
  Include in memory layer:
    - ref_api_design (2200 tokens) - Comprehensive API docs
    - lesson_api_005 (850 tokens) - Specific rate limiting pattern

  Include in announcement:
    - Standard capabilities reminder
    - No retrieved turns needed

  Skip:
    - lesson_perf_002 (related but not critical)
    - lesson_security_003 (too tangential)

  Total: 3050 tokens injected
  Budget remaining: 10k for history + user prompt
```

**T=890ms: Context Assembly Completes**
```
Assembled prompt:
  1. System: 2k
  2. Memory: 3k (ref + lesson)
  3. Announcement: 1.5k
  4. History: 92k (gradient)
  5. User: 0.02k

  Total: 98.5k tokens
```

**T=900ms: Send to Main Model**
```
Model receives complete prompt with:
  - API design reference (project-specific)
  - Rate limiting lesson (proven pattern)
  - Full conversation history
  - Tool capabilities
```

**Main model processing begins...**

---

## Cache Optimization

### Cache-Friendly Design

**Stable components:**
```
System prompt: Fixed (changes rarely)
  Cache: ✅ Across all turns

Main history structure: Stable (recalc every 10 turns)
  Cache: ✅ For 10 turn spans

Combined: ~94k tokens highly cacheable
```

**Variable components:**
```
Memory layer: Changes per turn (based on prompt)
  Size: ~3-8k tokens
  Cache: ❌ Different each turn

Announcement board: Changes per turn (TTL items expire)
  Size: ~1-5k tokens
  Cache: ❌ Different each turn

Combined: ~5-10k tokens vary
```

**Cache hit rate:**
```
Total prompt: 100k tokens
Cacheable: 94k (94%)
Variable: 6k (6%)

Effective caching:
  - System + history sent once
  - Only memory + announcement sent per turn
  - Massive token savings on repeated prompts
```

### Cache Invalidation

**Events that invalidate:**
```
Every turn:
  - Memory layer (new search results)
  - Announcement board (TTL changes)
  ❌ Cache miss: 6k tokens

Every 10 turns:
  - Gradient recalculation
  - History boundaries shift
  ❌ Cache miss: 92k tokens (major invalidation)

Rarely:
  - System prompt update
  ❌ Cache miss: 2k tokens
```

**Strategy:**
- Accept 6k miss per turn (cheap)
- Minimize major invalidations (gradient recalc interval)
- Never invalidate unnecessarily

---

## Error Handling

### Search Failures

**Keyword search fails:**
```
- Use empty results
- Log error
- Continue with vector + nano swarm
```

**Vector search fails:**
```
- Use empty results
- Log error
- Continue with keyword + nano swarm
```

**Both searches fail:**
```
- No candidates for nano swarm
- Skip to judgment with empty input
- Judgment model returns "no injection" decision
- Context assembly uses only standard components
```

**Degradation:** System functional without search results, just less enhanced.

### Nano Agent Failures

**Some agents timeout:**
```
3/5 agents complete:
  - Use results from 3
  - Log timeout for 2
  - Proceed with partial filtering
```

**All agents fail:**
```
- Use unfiltered search results
- Judgment model filters instead
- More work for judgment model, but functional
```

**Model API errors:**
```
Agent call fails:
  - Catch error
  - Return empty keep list for that agent
  - Other agents continue
```

### Judgment Model Failures

**Judgment call fails:**
```
Fallback strategy:
  1. Use simple heuristic:
     - Top 2 lessons by weight
     - Top 1 reference layer by topic match
  2. Inject without optimization
  3. Log error for investigation
```

**Always functional:** Even with failures, system proceeds (just less optimized).

---

## Performance Characteristics

### Token Usage Per Turn

**Preprocessing:**
```
Keyword search: 0 tokens (index lookup)
Vector search: ~1k tokens (embedding generation)
Nano swarm: ~6k tokens (5 agents × ~1.2k each)
Judgment model: ~3k tokens (input + output)

Total: ~10k tokens per turn
```

**Cost:** ~$0.003-0.005 per turn (at current pricing)

**Compared to:**
- Main model turn: 100k+ tokens, $0.10-0.50
- Preprocessing: 1-5% of main turn cost
- Value: Enhanced context may save multiple turns

### Latency Impact

**Total added latency:**
```
Preprocessing: ~1.2s
Assembly: ~0.1s
Total overhead: ~1.3s before main model
```

**User experience:**
```
Without preprocessing:
  - User submits → model responds in ~2-5s
  - Total: 2-5s

With preprocessing:
  - User submits → preprocessing 1.3s → model responds 2-5s
  - Total: 3.3-6.3s
```

**Perceived:** Minimal (still under 7s total)

**Optimization:**
- Start main model request during preprocessing (pipeline)
- Use faster models for nano swarm
- Optimize index lookups

---

## Integration with Offline Processing

### Data Dependencies

**Offline processing produces:**
- Lessons store (preprocessor searches this)
- Reference layers (preprocessor injects these)
- Topic weights (preprocessor ranks with these)
- Keyword index (preprocessor uses for fast lookup)
- Vector index (preprocessor uses for semantic search)

**Without offline processing:**
- No lessons to retrieve
- No reference layers to inject
- No topic weights for ranking
- Searches still work (against turns only)
- System functional but less enhanced

**Recommendation:** Implement offline processing alongside or before runtime preprocessing.

### Update Coordination

**Offline processing runs:**
```
2x daily: Updates knowledge base
```

**Runtime preprocessing accesses:**
```
Every turn: Reads current knowledge base
```

**Consistency:**
```
Knowledge base versioned:
  - Atomic updates (all or nothing)
  - Runtime always sees consistent state
  - No partial updates during turn
```

**Stale data acceptable:**
```
Offline runs at 3am and 9pm:
  - Knowledge current as of last run
  - May be hours old during active coding
  - Acceptable: Knowledge doesn't change that rapidly
```

---

## Filtering Quality

### Nano Agent Effectiveness

**Goal:** Remove obvious non-relevance while keeping anything possibly useful.

**Strategy:** Low false negative rate (keep if uncertain)

**Metrics:**
```
Precision: How many kept items are actually relevant?
  - Target: >50% (okay to include some marginal items)

Recall: How many relevant items were kept?
  - Target: >90% (don't discard useful items)
```

**Agent instructions emphasize:**
```
"When in doubt, KEEP the item. Only discard if obviously unrelated.
Better to include marginal content than miss something useful."
```

**Result:** Over-inclusive filter (judgment model makes final cuts).

### Judgment Model Refinement

**More sophisticated than nano agents:**
- Reviews all kept items together (sees patterns)
- Considers token budget (cost/benefit)
- Understands redundancy (skip similar items)
- Optimizes placement (memory vs announcement)

**Example decisions:**
```
Input: 20 filtered items

Judgment:
  - 3 lessons on same topic (token management)
    → Pick highest weight, skip others
  - 1 reference layer covering 2 lessons
    → Include layer, skip redundant lessons
  - 2 marginally relevant items
    → Skip (budget better spent elsewhere)

Final: 5 items injected (reference + 2 lessons + 2 ticklers)
```

---

## Measurement and Tuning

### Metrics to Track

**Preprocessing performance:**
- Time per component (keyword, vector, nano, judgment)
- Success rate (all complete within budget vs timeout)
- Result counts (candidates → filtered → injected)

**Injection effectiveness:**
- Items injected per turn
- Token usage (memory + announcement)
- Model usage of injected content (did it reference?)

**Knowledge quality:**
- Lesson retrieval frequency (which are used)
- Reference layer effectiveness (measured by outcomes)
- Topic weight accuracy (do rankings reflect utility?)

**Cost:**
- Tokens per turn (preprocessing)
- API calls (nano swarm)
- Total cost per turn

### Tuning Knobs

**Timeout:**
- Current: 1000ms
- Increase: More results, higher latency
- Decrease: Faster, fewer results

**Nano agent count:**
- Current: 5 agents
- Increase: More filtering capacity, higher cost
- Decrease: Faster, less thorough

**Budget allocation:**
- Current: 8k memory, 5k announcement
- Adjust based on usage patterns
- More memory = more lessons/refs
- More announcement = more recent context

**Recency bias:**
- Weight recent content higher in search
- Adjustable per project (some need deep history)

---

## Future Enhancements

### Predictive Prefetching

**Current:** Reactive (search based on current prompt)

**Future:** Predictive (anticipate what might be needed)
```
Based on conversation flow:
  - If discussing auth for 3 turns, prefetch security lessons
  - If pattern suggests deployment next, pre-load deployment refs
  - Warm cache before likely needed
```

### Adaptive Budgets

**Current:** Fixed budget split (8k memory, 5k announcement)

**Future:** Dynamic allocation
```
Complex topic (auth, deployment):
  - Increase memory budget (more refs needed)
  - Decrease announcement (less procedural)

Simple topic (formatting, naming):
  - Decrease memory budget (few refs)
  - Standard announcement
```

### Multi-Modal Search

**Current:** Text-based (keywords, vector on text)

**Future:** Code-aware
```
Search by:
  - Function signatures
  - Import patterns
  - Code structure
  - Error messages

Find:
  - Similar code patterns in history
  - Relevant tool call examples
  - Applicable code snippets
```

---

## Conclusion

Runtime turn preprocessing enhances every conversation by dynamically retrieving and injecting relevant context from conversation history and knowledge base. Through parallel search strategies, nano-agent filtering, and intelligent judgment, the system assembles enhanced prompts within tight latency budgets.

**Key mechanisms:**
- Parallel retrieval (keyword + vector + filtered, 1s budget)
- Nano agent filtering (remove obvious non-relevance)
- Judgment model (optimize injection decisions)
- Strategic placement (memory layer + announcement board)
- Cache-friendly design (minimal invalidation)

**Integration:**
- Uses offline processing outputs (lessons, references, indexes)
- Injects into compression gradient history (Enhancement 3)
- Operates before every turn (automatic)

**Result:** Models receive relevant project knowledge, applicable lessons, and necessary references without explicit retrieval requests. Enhanced context enables better decisions, reduces errors, and maintains project understanding across extended conversations.

**Status:** Design complete, implementation follows offline processing (Phase 7-8).
