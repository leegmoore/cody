# Codex Enhancement 04: Offline Memory Processing

**Enhancement:** Background Knowledge Extraction and Reference Layer Assembly
**Status:** Design Complete, Implementation Planned (Phase 8)
**Date:** November 7, 2025

---

## Overview

This enhancement introduces a background processing system that analyzes conversation history to extract knowledge, identify patterns, distill lessons, and prepare reference materials. Running periodically with large-context models at batch pricing, offline processing transforms conversation transcripts into structured knowledge that enhances future interactions.

Unlike real-time turn processing which operates under tight latency constraints, offline processing can use large context windows (1-2M tokens) and thorough analysis to build comprehensive project understanding over time.

---

## Purpose and Scope

### What Offline Processing Does

**Analyzes:** Complete conversation history using compressed versions (C/T levels) plus smoothed recent context (S).

**Extracts:**
- Conversation topics and themes
- Design patterns and conventions
- User preferences and working style
- Lessons learned (successes and failures)
- Recurring problems and solutions
- Technology stack knowledge
- Project-specific understanding

**Produces:**
- Lessons Store (tagged, searchable distilled knowledge)
- Reference Layers (pre-compiled documentation chunks)
- Topic Weights (dynamic importance scoring)
- Index Updates (keyword and semantic search)
- Admin Recommendations (suggested improvements)

**Feeds into:** Runtime turn preprocessing (Enhancement 5 - not covered here)

### What Offline Processing Does NOT Do

**Not real-time:** Runs on schedule (2x daily), not per turn
**Not interactive:** No user input during processing
**Not turn-specific:** Analyzes patterns across many turns
**Not prompt assembly:** Doesn't build the actual prompts (that's runtime)

**Scope:** Knowledge extraction and preparation only.

---

## Processing Model

### Execution Context

**When:** Scheduled intervals (default: 2x daily)
**Models:** Large context (1-2M tokens) - GPT-5, Gemini Pro, Claude Opus
**Pricing:** Batch mode where available (50% discount)
**Duration:** Minutes to hours (not time-critical)
**Parallelization:** Multiple analysis tasks run concurrently

### Input Data

**Compressed History:**
```
All turns in C/T format:
  - Turns 1-N (Tiny): ~5-50 tokens each
  - Working set in C: ~300-500 tokens each
  - Recent 10-20 in S: ~800-1200 tokens each

Total input: 50k-200k tokens
Represents: Entire conversation (potentially thousands of turns)
```

**Existing Knowledge:**
```
Previous processing outputs:
  - Lessons store (from last run)
  - Reference layers (current set)
  - Topic weights (current state)
```

**Configuration:**
```
Processing directives:
  - Which topics to focus on
  - Lesson extraction thresholds
  - Reference layer size targets
  - Admin notification rules
```

### Output Artifacts

**1. Lessons Store (Updated)**
- New lessons extracted
- Existing lessons refined/merged
- Outdated lessons removed
- Weights adjusted

**2. Reference Layers (Expanded)**
- New layers created
- Existing layers updated
- Gaps identified for admin curation

**3. Topic Weights (Recalculated)**
- Importance scores per topic
- Based on frequency, recency, user engagement
- Guides retrieval prioritization

**4. Search Indexes (Rebuilt)**
- Keyword index updated
- Vector embeddings refreshed
- Optimized for fast runtime lookup

**5. Admin Report**
- Recommendations for new reference layers
- Knowledge gaps identified
- Unusual patterns flagged
- Processing statistics

---

## Processing Tasks

### Task 1: Topic & Keyword Extraction

**Purpose:** Identify what the conversation is about, what technologies are discussed, what concepts matter.

**Process:**
```
Input: Compressed history (all turns in C/T)
  ↓
Analysis:
  - Extract nouns and noun phrases
  - Identify technology terms (React, OAuth, PostgreSQL, etc.)
  - Detect problem domains (authentication, UI, API, testing, etc.)
  - Track frequency of mentions
  - Note co-occurrence patterns
  ↓
Output:
  topics: [
    {name: "authentication", weight: 0.85, keywords: ["OAuth", "JWT", "session"]},
    {name: "testing", weight: 0.72, keywords: ["Jest", "coverage", "integration"]},
    {name: "API design", weight: 0.68, keywords: ["REST", "endpoints", "validation"]},
    ...
  ]
```

**Topic weighting factors:**
- Frequency: How often discussed
- Recency: Recent mentions weighted higher
- Depth: Length of discussions
- User engagement: Questions, follow-ups, iterations

**Keywords per topic:**
- Primary terms (direct mentions)
- Related terms (co-occurrence)
- Technical stack (frameworks, libraries, tools)

**Use:** Topic weights guide retrieval - high-weight topics surface more easily.

### Task 2: Categorization & Grouping

**Purpose:** Organize conversation into coherent themes and timeframes.

**Process:**
```
Input: Topics + compressed history
  ↓
Analysis:
  - Group turns by primary topic
  - Identify topic transitions
  - Detect project phases (setup, development, testing, deployment)
  - Note topic evolution (what's active vs dormant)
  ↓
Output:
  categories: [
    {
      topic: "authentication",
      turns: ["T-45", "T-46", "T-52", "T-87", ...],
      phase: "active",
      subTopics: ["OAuth", "session management", "token refresh"]
    },
    ...
  ]
```

**Categories enable:**
- Topic-based retrieval ("show me all auth discussions")
- Understanding project areas
- Tracking topic maturity

### Task 3: Lesson Distillation

**Purpose:** Extract reusable knowledge from experience.

**Types of lessons:**

**A. Successful Patterns:**
```
What worked:
  - Specific approaches that solved problems
  - Effective debugging strategies
  - Good design decisions
```

**B. Failed Approaches:**
```
What didn't work:
  - Attempted solutions that failed
  - Why they failed
  - What was learned
```

**C. Best Practices:**
```
Discovered conventions:
  - Code patterns that work well in this project
  - Testing approaches that catch issues
  - File organization preferences
```

**D. Problem-Solution Pairs:**
```
Recurring issues and their solutions:
  - "When token refresh fails, check expiry calculation"
  - "Email delivery issues usually SMTP config"
  - "Test flakiness often race conditions"
```

**Processing:**
```
Input: Compressed history filtered by topic
  ↓
For each topic area:
  1. Identify problem discussions
  2. Track solutions applied
  3. Note outcomes (success/failure)
  4. Extract generalizable patterns
  5. Distill to concise lesson (200-2000 tokens)
  6. Tag with topics and keywords
  ↓
Output:
  lesson: {
    id: "lesson_auth_token_refresh_001",
    topics: ["authentication", "error handling"],
    keywords: ["token", "refresh", "expiry", "race condition"],
    content: |
      Token Refresh Pattern:

      Problem: Intermittent 401s during token refresh
      Root Cause: Race condition - multiple requests refresh simultaneously
      Solution: Mutex-protected refresh with exponential backoff

      Implementation:
      - Check token expiry before each request
      - If expired, acquire lock
      - Refresh if not already refreshed by another request
      - Release lock, retry original request

      Tested: All auth flows, 500 concurrent requests, zero race failures

      Applicable when: Any auth system with background refresh
    |,
    sourceTurns: ["T-87", "T-88", "T-102"],
    weight: 0.9,
    createdAt: timestamp,
    lastUpdated: timestamp
  }
```

**Lesson quality criteria:**
- Actionable (provides clear guidance)
- Concise (fits in 200-2000 tokens)
- Tagged (findable via topic/keyword)
- Sourced (links back to turns for detail)
- Validated (actually worked in this project)

### Task 4: Knowledge Consolidation

**Purpose:** Build structured understanding of the project, user, and domain.

**User Preferences:**
```
Extracted from conversation patterns:
  - Coding style (indentation, naming, etc.)
  - Communication style (detail level, explanation preferences)
  - Tool preferences (which tools used frequently)
  - Workflow patterns (test-first, documentation timing, etc.)
```

**Design Patterns:**
```
Project-specific patterns discovered:
  - Architecture decisions (microservices, monolith, etc.)
  - Data flow patterns (Redux, event-driven, etc.)
  - Error handling approach (exceptions, Result types, etc.)
  - Testing strategy (unit, integration, coverage targets)
```

**Technology Stack:**
```
Understanding of tech used:
  - Primary languages (TypeScript, Python, etc.)
  - Frameworks (React, Express, FastAPI, etc.)
  - Tools (npm, git, docker, etc.)
  - Integrations (databases, APIs, services)
```

**Project Context:**
```
High-level understanding:
  - What the project does (purpose)
  - Who uses it (audience)
  - Key constraints (performance, security, budget)
  - Current state (alpha, beta, production)
```

**Storage:**
```typescript
knowledge: {
  userPreferences: {
    codingStyle: {...},
    communicationStyle: {...},
    toolPreferences: {...}
  },
  projectContext: {
    purpose: string,
    architecture: string,
    techStack: string[],
    constraints: string[]
  },
  designPatterns: [
    {pattern: "error handling", approach: "...", examples: [...]}
  ]
}
```

**Use:** Reference layers, system prompt customization, tool selection.

### Task 5: Reference Layer Assembly

**Purpose:** Create pre-compiled documentation chunks ready for injection when topics become relevant.

**Reference Layer Definition:**
```
A focused documentation chunk (500-5000 tokens) on a specific topic,
prepared in advance, tagged for retrieval, ready to inject into context
when conversation touches that topic.
```

**Types of Reference Layers:**

**A. Technology References:**
```
Layer: "TypeScript Async Patterns"
Size: 2400 tokens
Content:
  - Async/await best practices
  - Promise composition patterns
  - Error handling in async code
  - Common pitfalls and solutions
  - Code examples from this project
Tags: ["TypeScript", "async", "patterns"]
```

**B. Project-Specific Patterns:**
```
Layer: "Our Authentication Flow"
Size: 1800 tokens
Content:
  - How auth is implemented in this project
  - OAuth integration approach
  - Token management strategy
  - Session handling
  - Code locations and examples
Tags: ["authentication", "OAuth", "project-specific"]
```

**C. Domain Knowledge:**
```
Layer: "API Design Principles"
Size: 3200 tokens
Content:
  - REST conventions we follow
  - Error response format
  - Versioning strategy
  - Rate limiting approach
  - Validation patterns
Tags: ["API", "design", "backend"]
```

**D. Tool Usage Guides:**
```
Layer: "Git Workflow"
Size: 800 tokens
Content:
  - Branch naming conventions
  - Commit message format
  - PR process
  - Common git commands for this project
Tags: ["git", "workflow", "process"]
```

**Assembly process:**
```
1. Identify topic areas (from topic extraction)
2. For high-weight topics without reference layer:
   - Gather all relevant turns (filtered by topic)
   - Extract concrete examples
   - Compile coherent documentation
   - Format for easy reading
   - Size to target (500-5000 tokens)
   - Tag appropriately

3. For existing layers with new material:
   - Review recent relevant turns
   - Identify new patterns/examples
   - Update layer content
   - Maintain size target

4. Flag gaps:
   - Topics discussed but no good reference layer
   - Recommend admin create/curate
```

**Admin workflow:**
```
Offline processing identifies: "Topic 'database optimization' discussed
in 15 turns but no reference layer exists. Recommend creating one covering:
- Query optimization patterns
- Index strategy
- Connection pooling
- Caching approach
```

**Admin can:**
- Approve auto-generated layer
- Manually curate/edit
- Provide external documentation
- Merge with other sources

---

## Processing Architecture

### High-Level Flow

```
Scheduled Trigger (2x daily)
    ↓
┌─────────────────────────────────────────────┐
│ Offline Processing Coordinator              │
│                                             │
│ 1. Load compressed history                  │
│    - All turns in C/T                       │
│    - Recent 10-20 in S                      │
│    - Total: 50k-200k tokens                 │
│                                             │
│ 2. Load existing knowledge                  │
│    - Lessons store                          │
│    - Reference layers                       │
│    - Topic weights                          │
│                                             │
│ 3. Dispatch analysis tasks (parallel)       │
└──────────┬──────────────────────────────────┘
           │
           ├────────────────┬───────────────┬──────────────┐
           ↓                ↓               ↓              ↓
    ┌──────────┐     ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  Topic   │     │Category &│   │ Lesson   │   │Knowledge │
    │Extraction│     │Grouping  │   │Distill   │   │Consolidate│
    └────┬─────┘     └────┬─────┘   └────┬─────┘   └────┬─────┘
         │                │               │              │
         │        (Each uses large model)│              │
         │                │               │              │
         ↓                ↓               ↓              ↓
    Topics          Categories       Lessons        Knowledge
    Weights         Timeline         Store          Base
         │                │               │              │
         └────────────────┴───────────────┴──────────────┘
                          ↓
              ┌───────────────────────┐
              │ Reference Layer       │
              │ Assembly              │
              │                       │
              │ Uses: Topics, Lessons │
              │ Produces: Layers      │
              └───────────┬───────────┘
                          ↓
              ┌───────────────────────┐
              │ Index Rebuilding      │
              │                       │
              │ - Keyword index       │
              │ - Vector embeddings   │
              │ - Topic associations  │
              └───────────┬───────────┘
                          ↓
              ┌───────────────────────┐
              │ Admin Report          │
              │                       │
              │ - Recommendations     │
              │ - Statistics          │
              │ - Gaps identified     │
              └───────────────────────┘
```

### Execution Model

**Parallel task processing:**
```typescript
async function runOfflineProcessing(session: Session) {
  // Load inputs
  const history = await loadCompressedHistory(session);
  const knowledge = await loadKnowledgeBase(session);

  // Run analysis tasks in parallel
  const [topics, categories, lessons, consolidated] = await Promise.all([
    extractTopics(history),
    categorizeConversation(history, topics),
    distillLessons(history, topics),
    consolidateKnowledge(history, knowledge)
  ]);

  // Sequential: Reference layers (uses outputs from above)
  const referenceLayers = await assembleReferenceLayers({
    topics,
    lessons,
    consolidated,
    existing: knowledge.referenceLayers
  });

  // Sequential: Rebuild indexes
  const indexes = await rebuildIndexes({
    history,
    lessons,
    referenceLayers,
    topics
  });

  // Generate report
  const report = generateAdminReport({
    topics,
    lessons,
    referenceLayers,
    recommendations: identifyGaps(topics, referenceLayers)
  });

  // Persist all outputs
  await saveProcessingResults({
    lessons,
    referenceLayers,
    topics,
    indexes,
    report,
    timestamp: Date.now()
  });
}
```

**Error handling:**
- Task failures logged, don't stop other tasks
- Partial results saved
- Next run retries failed tasks
- Critical failures alert admin

---

## Task Deep-Dive: Topic Extraction

### Input

**Compressed conversation history:**
```
<T-1-through-100-T>
[100 tiny summaries, ~6k tokens]
</T-1-through-100-T>

<T-101-through-200-C>
[100 compressed turns, ~35k tokens]
</T-101-through-200-C>

<T-201-through-220-S>
[20 smoothed turns, ~18k tokens]
</T-201-through-220-S>
```

**Previous topic data** (if exists):
```typescript
{
  topics: [
    {name: "authentication", weight: 0.75, lastSeen: "T-195"},
    {name: "testing", weight: 0.68, lastSeen: "T-210"},
    ...
  ]
}
```

### Analysis Prompt

**To large model:**
```
You are analyzing a software development conversation to identify topics.

Conversation history (compressed):
[history content]

Previous topics: [list with weights]

Tasks:
1. Identify all technical topics discussed
   - Technologies (languages, frameworks, tools)
   - Problem domains (auth, UI, API, testing, deployment)
   - Features (specific functionality areas)

2. Extract keywords per topic
   - Primary terms
   - Related concepts
   - Technical specifics

3. Assess topic importance based on:
   - Frequency of discussion
   - Depth of coverage
   - Recency of mentions
   - User engagement level

4. Identify topic relationships
   - Which topics often discussed together
   - Dependencies (topic A requires understanding topic B)

Output format:
{
  topics: [{name, weight, keywords, relatedTopics}],
  topicTimeline: [{topic, turns, startTurn, endTurn}]
}
```

### Output Structure

```typescript
{
  topics: [
    {
      name: "authentication",
      weight: 0.85,
      keywords: ["OAuth", "JWT", "token", "session", "refresh"],
      relatedTopics: ["security", "API design"],
      firstMentioned: "T-12",
      lastMentioned: "T-218",
      totalTurns: 45,
      phase: "active",  // active | dormant | completed
      summary: "OAuth implementation with token refresh and session management"
    },
    {
      name: "database optimization",
      weight: 0.62,
      keywords: ["PostgreSQL", "indexes", "query", "performance"],
      relatedTopics: ["API design", "caching"],
      firstMentioned: "T-87",
      lastMentioned: "T-156",
      totalTurns: 18,
      phase: "completed",
      summary: "Query optimization and index strategy for API endpoints"
    },
    ...
  ],
  topicTimeline: [
    {topic: "authentication", turns: ["T-12", "T-13", "T-45", ...], density: "high"},
    {topic: "testing", turns: ["T-5", "T-23", "T-67", ...], density: "medium"},
    ...
  ]
}
```

**Storage:**
- Persistent across runs
- Updated incrementally (new topics added, weights adjusted)
- Used by retrieval to prioritize results

---

## Task Deep-Dive: Lesson Distillation

### Input

**Compressed history filtered by topic:**
```
Topic: "authentication"
Relevant turns: T-12, T-13, T-45, T-46, T-87, T-88, ...

<T-12-C>
Set up basic auth scaffolding. Added user/password validation.
</T-12-C>

<T-13-C>
Implemented JWT token generation. Tests passing.
</T-13-C>

<T-45-C>
User reported tokens expiring too quickly. Investigated, found
expiry calculation bug. Fixed, verified.
</T-45-C>

<T-46-C>
Added token refresh endpoint. Implemented refresh token rotation.
</T-46-C>

<T-87-S>
Token refresh sometimes fails with 401. Analyzed code, found race
condition - concurrent requests both try to refresh. Implemented
mutex-protected refresh with exponential backoff. Tested with 500
concurrent requests, all succeed now.
</T-87-S>

[... more auth-related turns]
```

### Analysis Process

**Step 1: Pattern Identification**
```
Scan turns for:
  - Problems encountered
  - Solutions applied
  - Outcomes (success/failure)
  - Iterations (problem → attempt → fail → retry → success)
```

**Step 2: Extract Problem-Solution Pairs**
```
Pattern detected:
  Turn 87: Problem (token refresh race)
  Turn 87: Solution (mutex + backoff)
  Turn 87: Outcome (success - 500 concurrent tests pass)

Generalizable: Yes (applies to any auth refresh scenario)
```

**Step 3: Distill to Lesson**
```
Prompt to model:
  Given this sequence of turns about token refresh, extract a reusable
  lesson that could help in future similar situations. Include:
  - Problem description
  - Root cause
  - Solution approach
  - Implementation notes
  - When applicable

Output: (lesson content shown in previous section)
```

**Step 4: Tag and Weight**
```
Topics: ["authentication", "concurrency", "error handling"]
Keywords: ["token", "refresh", "race condition", "mutex", "backoff"]
Weight: 0.9 (high - solved real problem, well-tested, generalizable)
```

### Lesson Lifecycle

**Creation:**
- Distilled from conversation
- Tagged with topics/keywords
- Weighted by relevance and quality

**Refinement:**
- Next processing run may enhance
- Merge similar lessons
- Update based on new experiences

**Retrieval:**
- Runtime preprocessing searches lessons
- High-weight lessons surface easily
- Injected when topic matches current turn

**Pruning:**
- Low-weight lessons removed after time
- Outdated lessons archived
- Superseded lessons merged

---

## Task Deep-Dive: Reference Layer Assembly

### Purpose

Create comprehensive documentation chunks on specific topics, ready for injection when needed.

### Assembly Process

**Input:**
- Topics (with weights and keywords)
- Lessons (filtered by topic)
- Conversation history (for concrete examples)
- Existing reference layers

**For each high-weight topic without reference layer:**

**Step 1: Content Gathering**
```
Topic: "authentication"
Relevant:
  - Lessons: 8 lessons tagged with "authentication"
  - Turns: 45 turns discussing auth
  - Code examples: From tool calls in those turns
  - External docs: If admin provided any
```

**Step 2: Structure Design**
```
Outline:
  1. Overview (what auth approach we use)
  2. Implementation (how it works)
  3. Key files and functions
  4. Common operations
  5. Troubleshooting (lessons learned)
  6. Examples (concrete code)
```

**Step 3: Content Generation**
```
Prompt to model:
  Create comprehensive authentication reference documentation for this project.

  Available material:
  - Lessons learned: [8 lessons]
  - Relevant conversation: [selected turns]
  - Code examples: [tool call outputs]

  Target: 2000-3000 tokens
  Include: Overview, implementation details, key files, common patterns,
           troubleshooting guide, concrete examples

  Audience: Future AI agent working on this project
  Style: Concise, technical, actionable
```

**Step 4: Refinement**
```
Generated content:
  - Check size (500-5000 tokens)
  - Validate coherence
  - Ensure examples concrete
  - Verify actionable
  - Tag properly
```

**Output:**
```typescript
{
  layerId: "ref_auth_implementation",
  topic: "authentication",
  tags: ["OAuth", "JWT", "session", "project-specific"],
  size: 2400,
  content: |
    Authentication Implementation Reference

    Overview:
    This project uses OAuth 2.0 with JWT tokens. Users authenticate
    via Google or GitHub, receive access and refresh tokens, with
    automatic refresh on expiry.

    Implementation:
    - Auth service: /src/auth/
    - Token generation: /src/auth/tokens.ts (generateJWT function)
    - Refresh logic: /src/auth/refresh.ts (mutex-protected)
    - Session store: Redis with 30-day TTL

    Key Patterns:
    - Token refresh uses mutex to prevent race conditions
    - Exponential backoff on refresh failures
    - Refresh tokens rotated on each use
    - Session IDs cryptographically random

    Common Operations:
    - Add new OAuth provider: See /src/auth/providers/
    - Adjust token expiry: AUTH_TOKEN_TTL in config
    - Debug refresh issues: Check mutex lock timing

    Troubleshooting:
    - 401 during refresh: Usually race condition, check mutex
    - Expired tokens not refreshing: Verify background job running
    - Session not persisting: Check Redis connection

    Examples:
    [Concrete code snippets from project]
  |,
  createdAt: timestamp,
  lastUpdated: timestamp,
  sourceTurns: ["T-12", "T-13", "T-45", ...],
  usageCount: 0,  // How often injected (tracked)
  effectiveness: null  // Measured by user feedback
}
```

---

## Task Deep-Dive: Index Optimization

### Purpose

Maintain fast search indexes for runtime retrieval of lessons and reference layers.

### Keyword Index

**Structure:**
```typescript
{
  "OAuth": {
    lessons: ["lesson_auth_001", "lesson_auth_003"],
    referenceLayers: ["ref_auth_implementation"],
    turns: ["T-12", "T-45", "T-87"],
    weight: 0.85
  },
  "token": {
    lessons: ["lesson_auth_001", "lesson_auth_002"],
    referenceLayers: ["ref_auth_implementation"],
    turns: ["T-12", "T-13", "T-45", "T-87", ...],
    weight: 0.82
  },
  ...
}
```

**Rebuilding:**
- Extract keywords from all lessons
- Extract keywords from all reference layers
- Associate with source IDs
- Weight by topic importance

**Use:** Runtime keyword search (100ms lookup)

### Vector Embeddings

**Structure:**
```typescript
{
  id: "lesson_auth_001",
  embedding: Float32Array(1536),  // Or dimension used
  type: "lesson" | "refLayer" | "turn",
  metadata: {
    topics: string[],
    weight: number,
    tokens: number
  }
}
```

**Rebuilding:**
- Generate embeddings for new lessons
- Generate embeddings for new reference layers
- Update turn embeddings if content changed
- Store in vector database or in-memory index

**Use:** Runtime semantic search (200ms lookup)

### Topic Associations

**Structure:**
```typescript
{
  topicGraph: {
    "authentication": {
      relatedTopics: ["security", "API design"],
      strength: {
        "security": 0.8,      // Frequently co-occur
        "API design": 0.6
      }
    },
    "testing": {
      relatedTopics: ["debugging", "CI/CD"],
      strength: {...}
    }
  }
}
```

**Building:**
- Analyze co-occurrence in turns
- Calculate association strength
- Build topic graph

**Use:** When retrieving for topic A, also consider related topics

---

## Output: Lessons Store

### Storage Format

```typescript
interface Lesson {
  // Identity
  id: string;                    // "lesson_auth_token_refresh_001"
  version: number;               // Incremented on updates

  // Classification
  topics: string[];              // ["authentication", "concurrency"]
  keywords: string[];            // ["token", "refresh", "mutex", "race"]
  category: string;              // "pattern" | "gotcha" | "best-practice"

  // Content
  title: string;                 // "Token Refresh Race Condition"
  content: string;               // Full lesson (200-2000 tokens)
  summary: string;               // One-sentence (for indexing)

  // Context
  sourceTurns: string[];         // ["T-87", "T-88"]
  applicableWhen: string[];      // ["concurrent auth", "token management"]
  relatedLessons: string[];      // IDs of related lessons

  // Metadata
  weight: number;                // 0-1 (importance/relevance)
  createdAt: Date;
  lastUpdated: Date;
  usageCount: number;            // How often retrieved
  effectiveness: number | null;  // User feedback (if tracked)

  // Versioning
  previousVersions?: string[];   // Archive old versions
}
```

### Example Lessons

**Lesson 1: Technical Pattern**
```typescript
{
  id: "lesson_auth_001",
  topics: ["authentication", "error handling"],
  keywords: ["token", "refresh", "race condition", "mutex"],
  category: "pattern",
  title: "Mutex-Protected Token Refresh",
  content: `
    Problem: Concurrent requests refreshing tokens simultaneously
    Cause: Race condition in refresh logic
    Solution: Mutex-protected refresh with backoff
    Implementation: Check-lock-refresh pattern
    Result: Zero race failures under load
    Applicable: Any auth system with background refresh
  `,
  summary: "Use mutex to prevent token refresh races",
  sourceTurns: ["T-87", "T-88"],
  weight: 0.9
}
```

**Lesson 2: Gotcha/Warning**
```typescript
{
  id: "lesson_test_002",
  topics: ["testing", "debugging"],
  keywords: ["async", "timing", "flaky", "race"],
  category: "gotcha",
  title: "Async Test Timing Issues",
  content: `
    Symptom: Tests pass locally, fail in CI intermittently
    Cause: Race conditions in async test setup
    Investigation: Added explicit awaits, increased timeouts
    Solution: Ensure all setup completes before assertions
    Prevention: Use test helpers that guarantee sequencing
  `,
  summary: "Flaky tests often caused by async timing",
  sourceTurns: ["T-23", "T-145"],
  weight: 0.7
}
```

**Lesson 3: Best Practice**
```typescript
{
  id: "lesson_code_003",
  topics: ["code quality", "TypeScript"],
  keywords: ["error handling", "type safety", "validation"],
  category: "best-practice",
  title: "Input Validation Pattern",
  content: `
    Pattern: Always validate external input at boundary
    Approach: Zod schemas at API endpoints, function entries
    Benefit: Type safety + runtime validation
    Implementation: Define schema, validate, use typed result
    Example: See /src/api/validation.ts
  `,
  summary: "Validate all external input at system boundaries",
  sourceTurns: ["T-34", "T-56", "T-189"],
  weight: 0.75
}
```

### Lesson Merging

**When similar lessons exist:**
```
Old lesson: "Token refresh timing"
New lesson: "Token refresh race prevention"

Merge criteria:
  - Both about token refresh
  - Overlapping keywords
  - Related source turns

Result: Single comprehensive lesson:
  "Token Refresh: Timing and Race Prevention"
  - Combined content
  - Merged keywords
  - All source turns
  - Higher weight (more evidence)
```

---

## Output: Reference Layers

### Layer Categories

**Technology Layers:**
- Language-specific (TypeScript patterns, Python idioms)
- Framework-specific (React patterns, Express middleware)
- Library-specific (How we use specific libraries)

**Project Layers:**
- Architecture overview
- Component responsibilities
- Data flow patterns
- Coding conventions

**Domain Layers:**
- Authentication approach
- API design principles
- Testing strategy
- Deployment process

**Tool Layers:**
- Git workflow
- Development environment setup
- Debugging approaches
- Common commands

### Assembly Example

**Topic:** "Testing Strategy"
**Identified as:** High weight (0.78), no existing reference layer

**Content gathering:**
```
Relevant lessons:
  - "Async test timing" (lesson_test_002)
  - "Coverage targets" (lesson_test_007)
  - "Integration test patterns" (lesson_test_009)

Relevant turns (compressed):
  - T-5: Initial test setup
  - T-23: Fixed flaky tests
  - T-67: Added integration tests
  - T-145: Improved coverage
  - T-203: E2E test framework

Code examples (from tool calls):
  - Test utilities: /test/helpers/
  - Jest configuration
  - Coverage scripts
```

**Generation:**
```
Prompt:
  Create reference documentation for our testing strategy.

  Material:
  - Lessons: [3 lessons on testing]
  - Conversation: [5 compressed turns]
  - Code locations: /test/

  Cover:
  - What testing approach we use
  - Test organization and structure
  - Running tests (commands)
  - Coverage expectations
  - Common patterns and helpers
  - Troubleshooting flaky tests

  Target: 1500-2000 tokens
  Style: Concise, actionable, with examples
```

**Generated layer:**
```typescript
{
  layerId: "ref_testing_strategy",
  topic: "testing",
  tags: ["Jest", "coverage", "integration", "E2E"],
  size: 1850,
  content: `
    Testing Strategy Reference

    Framework: Jest with TypeScript
    Coverage Target: >80% for core, >60% overall

    Organization:
    /test/
      unit/       - Pure function tests
      integration/ - API endpoint tests
      e2e/        - Full workflow tests
      helpers/    - Shared utilities
      fixtures/   - Test data

    Running Tests:
    - All: npm test
    - Unit: npm test -- unit/
    - Coverage: npm run test:coverage
    - Watch: npm test -- --watch

    Patterns:
    - Use helpers from /test/helpers/
    - Async setup: Always await in beforeEach
    - Mocking: Prefer dependency injection over global mocks
    - Assertions: Be specific (not just .toBeTruthy())

    Common Issues:
    - Flaky tests: Usually async timing (add explicit awaits)
    - Timeout: Increase for slow operations (database, network)
    - Isolation: Clean up in afterEach (close connections, clear state)

    Examples:
    [Concrete test code from project]
  `,
  sourceTurns: ["T-5", "T-23", "T-67", "T-145", "T-203"],
  createdAt: timestamp
}
```

---

## Output: Topic Weights & Dynamics

### Weight Calculation

**Factors:**
```typescript
function calculateTopicWeight(topic: Topic, history: History): number {
  // Frequency (0-1): How often discussed
  const frequency = topic.turnCount / history.totalTurns;

  // Recency (0-1): How recently discussed
  const lastSeen = history.currentTurn - topic.lastMentionTurn;
  const recency = Math.exp(-lastSeen / 100);  // Decay function

  // Depth (0-1): Average turn length for topic
  const avgDepth = topic.totalTokens / topic.turnCount / 2000;  // Normalized

  // Engagement (0-1): User questions, follow-ups
  const engagement = topic.userInteractionCount / topic.turnCount;

  // Combined
  return (frequency * 0.3 + recency * 0.3 + depth * 0.2 + engagement * 0.2);
}
```

**Weight evolution:**
```
Topic: "authentication"
  Week 1: weight 0.9 (active development)
  Week 2: weight 0.7 (still discussed, but less)
  Week 3: weight 0.5 (maintenance phase)
  Week 4: weight 0.3 (dormant)

Topic: "deployment"
  Week 1: weight 0.2 (not yet relevant)
  Week 3: weight 0.8 (deployment phase begins)
  Week 4: weight 0.9 (active deployment work)
```

**Dynamic adjustment** - weights reflect project phase and current focus.

### Use in Retrieval

**Runtime search uses weights:**
```
Query: "How should I handle auth errors?"

Keyword matches:
  - "authentication" (weight 0.85)
  - "error handling" (weight 0.72)
  - "validation" (weight 0.65)

Results ranked by weight * relevance
  1. Lesson on auth error handling (high weight topic)
  2. Reference layer on authentication
  3. Lesson on validation patterns
```

**Higher weight = higher priority** when multiple matches.

---

## Output: Admin Recommendations

### Generated Report

**After each processing run:**

```markdown
# Offline Processing Report
**Session:** Project XYZ
**Run:** 2025-11-07 03:00 AM
**Duration:** 4.2 minutes
**Turns Processed:** 1-220

## Summary
- New lessons created: 3
- Lessons updated: 7
- Reference layers created: 1
- Reference layers updated: 2
- Topics tracked: 24 (5 active, 12 dormant, 7 completed)

## New Lessons
1. "API Rate Limiting Implementation" (weight: 0.82)
   - Topics: API design, performance
   - Source: Turns 201-205
   - Status: High quality, ready for use

2. "Redis Caching Strategy" (weight: 0.76)
   - Topics: caching, performance, database
   - Source: Turns 156-160
   - Status: Good, merged with existing cache lesson

3. "WebSocket Connection Management" (weight: 0.68)
   - Topics: real-time, networking
   - Source: Turns 152-154
   - Status: Adequate, monitor effectiveness

## Reference Layer Updates
- "Authentication Implementation" updated with token refresh patterns
- "API Design Principles" updated with rate limiting approach

## Topic Weight Changes
- "performance" ↑ 0.65 → 0.78 (increased discussion)
- "authentication" ↓ 0.85 → 0.72 (less active recently)
- "deployment" ↑ 0.20 → 0.65 (new focus area)

## Recommendations

### New Reference Layers Needed
1. **"Deployment Process"** (Priority: High)
   - Recent high activity (15 turns)
   - No existing reference layer
   - Suggested content: CI/CD pipeline, environment config, rollback procedure
   - Auto-generated draft available for review

2. **"Performance Optimization"** (Priority: Medium)
   - Scattered discussions (8 turns)
   - Could benefit from consolidation
   - Topics: database queries, caching, profiling

### Knowledge Gaps
- Topic "error monitoring" discussed but no clear patterns emerged yet
- Topic "logging strategy" has conflicting approaches across turns (needs reconciliation)

### Index Health
- Keyword index: 247 terms, well-distributed
- Vector index: 89 embedded items, no outliers
- Topic graph: 24 nodes, 31 edges, connected

## Next Run
Scheduled: 2025-11-07 09:00 PM
Focus: Process turns 221+ when available
```

### Admin Actions

**Based on report, admin can:**
1. Approve auto-generated reference layers
2. Curate/edit layers manually
3. Add external documentation
4. Adjust topic weights manually (if needed)
5. Merge or split lessons
6. Configure next processing focus

---

## Processing Pipeline Detail

### ASCII: Complete Processing Flow

```
Scheduler Trigger (2x daily)
    ↓
┌─────────────────────────────────────┐
│ Load Compressed History             │
│                                     │
│ Fetch from storage:                 │
│ - T-1 through T-220 (all versions)  │
│ - Select: C/T for old, S for recent│
│ Total: ~60k tokens                  │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Load Knowledge Base                 │
│                                     │
│ - Lessons store (current)           │
│ - Reference layers (current)        │
│ - Topic weights (current)           │
│ - Indexes (current)                 │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Parallel Analysis Phase             │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Topic Extraction                │ │
│ │ Model: GPT-5 (1M context)       │ │
│ │ Input: Full C/T history         │ │
│ │ Output: Topics + keywords       │ │
│ │ Time: ~60s                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Categorization                  │ │
│ │ Model: Gemini Pro (1M context)  │ │
│ │ Input: History + topics         │ │
│ │ Output: Timeline + groups       │ │
│ │ Time: ~45s                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Lesson Distillation             │ │
│ │ Model: GPT-5 (1M context)       │ │
│ │ Input: History by topic         │ │
│ │ Output: New/updated lessons     │ │
│ │ Time: ~90s                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Knowledge Consolidation         │ │
│ │ Model: Claude Opus (1M context) │ │
│ │ Input: History + existing       │ │
│ │ Output: Updated knowledge base  │ │
│ │ Time: ~75s                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ (All run in parallel, ~90s total)   │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Reference Layer Assembly            │
│                                     │
│ Model: GPT-5                        │
│ Input: Topics + lessons + history   │
│                                     │
│ For each high-weight topic:         │
│   - Check existing layer            │
│   - If none: Generate new           │
│   - If exists: Consider update      │
│   - Size to target (500-5k tokens)  │
│                                     │
│ Time: ~60s per layer, N layers      │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Index Rebuilding                    │
│                                     │
│ Keyword Index:                      │
│ - Extract from all lessons          │
│ - Extract from all ref layers       │
│ - Build lookup tables               │
│                                     │
│ Vector Index:                       │
│ - Generate embeddings (new items)   │
│ - Update vector store               │
│                                     │
│ Topic Graph:                        │
│ - Calculate co-occurrence           │
│ - Build association strengths       │
│                                     │
│ Time: ~30s                          │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Generate Admin Report               │
│                                     │
│ - Summary statistics                │
│ - Changes from last run             │
│ - Recommendations                   │
│ - Gaps identified                   │
│ - Quality metrics                   │
│                                     │
│ Time: ~10s                          │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Persist All Outputs                 │
│                                     │
│ - Lessons store → database          │
│ - Reference layers → storage        │
│ - Topic weights → config            │
│ - Indexes → search service          │
│ - Report → admin dashboard          │
│                                     │
│ Time: ~5s                           │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Cleanup & Scheduling                │
│                                     │
│ - Mark run complete                 │
│ - Schedule next run                 │
│ - Alert admin if issues             │
└─────────────────────────────────────┘

Total time: ~4-6 minutes for 220 turns
```

---

## Integration Points

### How Offline Outputs Are Used

**Lessons Store:**
```
Runtime preprocessing searches lessons
  → Finds relevant lessons for current topic
  → Injects into memory layer
  → Model sees applicable patterns/solutions
```

**Reference Layers:**
```
Runtime preprocessing detects topic
  → Looks up reference layers for topic
  → Injects appropriate layers
  → Model has project-specific docs
```

**Topic Weights:**
```
Runtime search uses weights
  → Higher weight topics rank higher
  → Guides retrieval prioritization
  → Ensures relevant content surfaces
```

**Indexes:**
```
Runtime searches (keyword + vector)
  → Fast lookup via pre-built indexes
  → Sub-100ms query time
  → Enables 1-second preprocessing budget
```

### Data Flow: Offline → Runtime

```
Offline Processing (2x daily)
    ↓
Produces: Lessons, Reference Layers, Weights, Indexes
    ↓
Stored in knowledge base
    ↓
[Hours pass, many turns happen]
    ↓
Runtime Turn Preprocessing (per turn)
    ↓
Searches knowledge base:
  - Keyword search → uses keyword index
  - Vector search → uses vector index
  - Ranking → uses topic weights
    ↓
Retrieves relevant items:
  - Lessons matching current topic
  - Reference layers for context
    ↓
Injects into prompt
    ↓
Model receives enhanced context
```

**Offline processing prepares, runtime processing uses.**

---

## Storage Architecture

### Lessons Database

**Schema:**
```typescript
LessonsCollection {
  _id: lessonId,
  version: number,
  topics: string[],
  keywords: string[],
  category: string,
  title: string,
  content: string,
  summary: string,
  sourceTurns: string[],
  weight: number,
  metadata: {
    created: Date,
    updated: Date,
    usageCount: number,
    effectiveness: number | null
  },
  // Indexes on:
  indexes: [
    {keywords: 1},
    {topics: 1},
    {weight: -1},
    {updated: -1}
  ]
}
```

**Queries:**
- By keyword: Fast lookup
- By topic: Fast lookup
- By weight: Ranking
- By recency: For updates

### Reference Layers Storage

**Schema:**
```typescript
ReferenceLayersCollection {
  _id: layerId,
  topic: string,
  tags: string[],
  size: number,
  content: string,
  metadata: {
    created: Date,
    updated: Date,
    sourceTurns: string[],
    usageCount: number,
    effectiveness: number | null
  },
  // Indexes on:
  indexes: [
    {topic: 1},
    {tags: 1},
    {size: 1}
  ]
}
```

### Topic Weights Storage

**Schema:**
```typescript
TopicsCollection {
  _id: topicId,
  name: string,
  weight: number,
  keywords: string[],
  relatedTopics: {name: string, strength: number}[],
  timeline: {
    firstMention: string,
    lastMention: string,
    totalTurns: number,
    phase: 'active' | 'dormant' | 'completed'
  },
  // Indexes on:
  indexes: [
    {name: 1},
    {weight: -1},
    {'timeline.phase': 1}
  ]
}
```

### Search Indexes

**Keyword Index (in-memory):**
```typescript
Map<string, {
  lessons: string[],
  referenceLayers: string[],
  turns: string[],
  weight: number
}>
```

**Vector Index (database/service):**
```typescript
VectorCollection {
  _id: itemId,
  type: 'lesson' | 'refLayer' | 'turn',
  embedding: Float32Array,
  metadata: {
    topics: string[],
    weight: number,
    tokens: number
  }
}
```

---

## Quality Control

### Lesson Validation

**Checks before adding to store:**
- Content not empty
- Size within bounds (200-2000 tokens)
- Topics and keywords present
- Source turns exist
- No duplicates (similarity check)

**Quality scoring:**
```typescript
function scoreLessonQuality(lesson: Lesson): number {
  // Specificity: Has concrete examples
  const hasExamples = lesson.content.includes("Example:");

  // Actionability: Provides clear guidance
  const hasSteps = /\d\.|Step|First|Then/.test(lesson.content);

  // Sourcing: Multiple source turns
  const wellSourced = lesson.sourceTurns.length >= 2;

  // Conciseness: Not too verbose
  const concise = lesson.content.length < 2000;

  return [hasExamples, hasSteps, wellSourced, concise]
    .filter(Boolean).length / 4;
}
```

**Low quality lessons:**
- Flagged for review
- Not heavily weighted
- Considered for removal in future runs

### Reference Layer Validation

**Checks:**
- Size in target range (500-5000 tokens)
- Topic tag matches content
- No placeholder text
- Examples are concrete (not generic)

**Update criteria:**
```
Update layer if:
  - New relevant turns (>10 since last update)
  - New lessons extracted for topic
  - Existing content outdated (mentions old patterns)

Skip update if:
  - No new material
  - Recent update (<1 week)
  - Layer marked "stable" by admin
```

---

## Performance Characteristics

### Resource Usage

**Typical run (220 turns):**
```
Model calls:
  - Topic extraction: 1 call (GPT-5, ~60k input, ~5k output)
  - Categorization: 1 call (Gemini Pro, ~60k input, ~3k output)
  - Lesson distillation: 3-5 calls (per topic, ~10k input each, ~2k output)
  - Knowledge consolidation: 1 call (Opus, ~100k input, ~10k output)
  - Reference layer gen: 2-3 calls (per new layer, ~20k input, ~3k output)

Total tokens: ~500k-800k (input + output)
Cost: ~$2-5 at batch rates (50% off)
Duration: 4-6 minutes
```

**Scaling:**
```
500 turns: ~8-10 minutes, ~$5-10
1000 turns: ~15-20 minutes, ~$10-20

Frequency: 2x daily = ~$10-40/day depending on conversation volume
```

**Optimization:**
- Run less frequently if conversation slow
- Incremental processing (only new turns since last run)
- Skip topics with no new activity

### Incremental Processing

**Track last processed turn:**
```
lastProcessing: {
  runId: "run_20251107_0300",
  lastTurnProcessed: "T-220",
  timestamp: Date
}

Next run:
  - Process T-221 through T-current
  - Update existing lessons/layers
  - Don't re-process old turns unless:
    - New topic emerged that re-contextualizes old content
    - Manual trigger for full reprocessing
```

**Benefit:** Most runs process 10-50 new turns, not entire history.

---

## Error Handling

### Failure Scenarios

**Model API failures:**
```
Topic extraction call fails:
  → Log error
  → Use previous topic data
  → Flag for retry next run
```

**Partial completion:**
```
3 of 5 tasks complete:
  → Save completed outputs
  → Mark incomplete tasks for retry
  → Report partial success to admin
```

**Quality issues:**
```
Generated lesson fails validation:
  → Don't add to store
  → Log for manual review
  → Try with different model/prompt next run
```

**Storage failures:**
```
Can't persist results:
  → Keep in memory
  → Retry persistence
  → Alert admin if persistent
```

### Recovery Strategies

**Automatic retry:**
- Failed tasks re-attempted next run
- Exponential backoff for repeated failures
- Max 3 attempts before manual intervention

**Graceful degradation:**
- System functional without offline processing
- Runtime retrieval uses existing knowledge
- Gaps filled manually if needed

---

## Future Enhancements

### Multi-Session Learning

**Current:** Each session processed independently

**Future:** Learn across multiple projects/sessions
- Common patterns across projects
- General best practices (not project-specific)
- Technology patterns (applicable anywhere)
- User preferences (consistent across projects)

**Benefit:** New projects start with accumulated wisdom.

### Active Learning

**Current:** Passive analysis of what happened

**Future:** Identify knowledge needs proactively
- "We're using Redis but no reference layer exists"
- "User asked 3 times about X, should we create a reference?"
- Suggest experiments: "Try approach Y, compare to current approach X"

### Continuous Improvement

**Track effectiveness:**
- Which lessons are retrieved often (useful)
- Which lessons never used (remove)
- Which reference layers improve outcomes (measure)
- Optimize weights based on utility

**Feedback loop:**
```
Lesson retrieved → Used in turn → Outcome tracked → Weight adjusted
```

**Result:** Knowledge base improves over time through use.

---

## Integration with Compression Gradient

### Complementary Systems

**Compression gradient:**
- Manages token budget
- Provides access to all turns
- Enables history spanning
- Operates per-session

**Offline processing:**
- Extracts knowledge from compressed turns
- Creates reusable artifacts
- Operates across entire history
- Benefits all future sessions

**Together:**
```
Compression makes history accessible
  ↓
Offline processing extracts knowledge
  ↓
Knowledge informs future turns
  ↓
Better decisions captured in history
  ↓
Better knowledge extracted
  ↓
Continuous improvement cycle
```

### Data Dependencies

**Offline processing NEEDS compression:**
- Can't load raw 1000-turn history (too many tokens)
- Uses C/T versions to fit in model context
- Smoothed versions for quality when needed

**Compression doesn't NEED offline processing:**
- Works standalone
- Offline enhances but isn't required

**Recommendation:** Implement compression first (Phase 7), offline later (Phase 8).

---

## Comparison to Alternatives

### vs Manual Documentation

**Manual:**
- Admin writes docs
- Static, becomes outdated
- Misses nuanced project knowledge
- Time-consuming

**Offline Processing:**
- Auto-generated from actual work
- Updated continuously
- Captures real patterns used
- Automated

**Both valuable:** Offline processing complements manual docs, doesn't replace.

### vs RAG on Documentation

**RAG:**
- Retrieves from external docs (public, generic)
- No project-specific understanding
- Search at query time

**Offline Processing:**
- Creates project-specific docs
- Deep understanding of this codebase
- Pre-prepared for injection

**Complementary:** Can use both (external + internal knowledge).

### vs Simple Logging

**Logging:**
- Records what happened
- No synthesis or patterns
- Just data

**Offline Processing:**
- Extracts meaning from logs
- Identifies patterns
- Creates actionable knowledge

---

## Success Criteria

**Offline processing is successful if:**

**1. Knowledge Quality:**
- Lessons are accurate and actionable
- Reference layers contain relevant information
- Topic weights reflect actual importance

**2. Retrieval Effectiveness:**
- Lessons surface when applicable
- Reference layers reduce redundant questions
- Topic weights improve search ranking

**3. Efficiency:**
- Processing completes in reasonable time (<10 minutes)
- Cost is acceptable (<$50/day for active projects)
- Incremental processing handles growth

**4. Maintenance:**
- Auto-generated content requires minimal curation
- Admin recommendations are useful
- Knowledge base stays current

**Measurement:** Will be conducted after implementation through user feedback and retrieval analytics.

---

## Implementation Considerations

### Model Selection

**Criteria for offline processing models:**
- Large context (1-2M tokens) - can consume full compressed history
- Strong analytical capabilities - pattern recognition, synthesis
- Batch pricing available - cost management
- Reliable - consistent quality output

**Candidates:**
- GPT-5 (strong reasoning, large context)
- Gemini Pro (large context, good analysis)
- Claude Opus (excellent at synthesis)
- o1 (strong for complex analysis)

**Selection per task:**
- Topic extraction: Need breadth (Gemini Pro)
- Lesson distillation: Need synthesis (GPT-5)
- Reference assembly: Need coherence (Claude Opus)
- Can be configured, experimented with

### Storage Backend

**Options:**
- MongoDB (document store, good for lessons/layers)
- PostgreSQL with JSONB (relational + flexible)
- Vector database (Pinecone, Weaviate) for embeddings
- Hybrid (Postgres + vector service)

**Requirements:**
- Fast keyword lookups
- Vector similarity search
- Flexible schema (knowledge structure evolves)
- Reasonable cost

**Decision:** Can be made during implementation based on deployment context.

### Scheduling

**Frequency trade-offs:**
```
More frequent (4x daily):
  + Fresher knowledge
  + Smaller incremental processing
  - Higher cost
  - More admin notifications

Less frequent (1x daily or weekly):
  + Lower cost
  + Fewer interruptions
  - Older knowledge
  - Larger processing batches
```

**Default 2x daily:**
- Morning run: Process overnight conversations
- Evening run: Process day's work
- Balance between freshness and cost

**Configurable per project:**
- Active projects: More frequent
- Maintenance projects: Less frequent
- On-demand: Manual trigger available

---

## Example: End-to-End Scenario

### Scenario: 220-Turn Conversation on Auth Implementation

**Input to offline processing:**
```
Compressed history:
  - Turns 1-100 (T): Setup, early development
  - Turns 101-200 (C): Core auth implementation
  - Turns 201-220 (S): Recent refinements

Previous knowledge:
  - 3 existing lessons (outdated)
  - No reference layer for auth
  - Topic weights: auth=0.5 (medium)
```

**Processing executes:**

**Topic Extraction finds:**
```
Primary topics:
  - "authentication" (45 turns, weight 0.85)
  - "OAuth" (32 turns, weight 0.78)
  - "token management" (28 turns, weight 0.72)

New weight for "authentication": 0.85 (up from 0.5)
```

**Lesson Distillation produces:**
```
3 new lessons:
  1. "Mutex-Protected Token Refresh" (T-87, T-88)
  2. "OAuth Provider Integration" (T-45, T-46, T-52)
  3. "Session Invalidation Strategy" (T-145, T-156)

Updates 1 existing lesson:
  - "JWT Token Generation" enhanced with rotation strategy
```

**Reference Layer Assembly creates:**
```
New layer: "Authentication Implementation" (2400 tokens)
  - OAuth flow overview
  - Token management approach
  - Key files and functions
  - Common operations
  - Troubleshooting guide
  - Code examples from turns
```

**Index Rebuilding:**
```
Keyword index updated:
  - "OAuth" → [lesson_auth_002, ref_auth_implementation, T-45, T-46, ...]
  - "token" → [lesson_auth_001, lesson_auth_002, ref_auth_implementation, ...]

Vector index updated:
  - lesson_auth_001 embedding generated
  - lesson_auth_002 embedding generated
  - ref_auth_implementation embedding generated
```

**Admin report generated:**
```
- 3 new lessons on authentication
- 1 new reference layer created
- Topic weight increased (auth now highest)
- Recommendation: Consider layer on "session management" (sub-topic)
- No critical gaps identified
```

**Next runtime turn:**
```
User asks: "How should I handle session expiration?"

Runtime preprocessing:
  - Keyword search: "session" → finds lessons + ref layer
  - Topic match: "authentication" (high weight)
  - Retrieves: "Authentication Implementation" reference layer
  - Retrieves: "Session Invalidation Strategy" lesson

Injected into memory layer:
  Model sees:
    - Reference layer with full auth context
    - Specific lesson on session handling
    - Can provide informed answer immediately
```

---

## Conclusion

Offline memory processing transforms conversation transcripts into structured, searchable, reusable knowledge. By analyzing compressed history with large-context models in batch mode, the system extracts lessons, identifies patterns, builds reference layers, and maintains topic understanding.

**Key capabilities:**
- Topic extraction and weighting (what's important)
- Lesson distillation (reusable knowledge)
- Reference layer assembly (pre-compiled docs)
- Index optimization (fast retrieval)
- Admin recommendations (guided curation)

**Integration:** Outputs feed into runtime turn preprocessing (covered separately) to enhance every conversation with accumulated project knowledge.

**Implementation:** Scheduled batch processing (2x daily), large-context models, produces persistent knowledge base that grows smarter over time.

**Status:** Design complete, implementation follows core system and compression gradient (Phase 8).
