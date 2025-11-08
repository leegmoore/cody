# Codex Enhancement 03: Compression Gradient Memory System

**Enhancement:** Multi-Fidelity History with Infinite Retention
**Status:** Design Complete, Implementation Planned (Phase 7)
**Date:** November 7, 2025

---

## Overview

This enhancement extends Codex's conversation history system to support multiple history management strategies, including a novel compression gradient approach that enables extended conversations within fixed token budgets through intelligent fidelity selection.

The system maintains conversation history at multiple compression levels, automatically selects appropriate fidelity based on recency, and provides tools for models to retrieve higher-detail versions of older content when needed.

---

## History Management Strategies

The conversation system supports three distinct strategies for managing conversation history, selectable per session based on use case requirements.

### Strategy 1: Standard (Codex Default)

**Model:** Traditional conversation with full message retention until context budget exceeded.

**Behavior:**
```
Turns 1-N stored as complete ResponseItem arrays
When token budget exceeded:
  - Remove oldest turns
  - Or fail with context limit error
```

**Characteristics:**
- Messages stored exactly as exchanged
- Tool calls retain full detail (arguments, outputs)
- All reasoning/thinking preserved
- Simple, predictable behavior

**Limitations:**
- Hard cap on conversation length (~50-200 turns depending on verbosity)
- Loss of context when limit hit
- No graduated retention

**Use cases:**
- Short-to-medium conversations
- When full fidelity always needed
- Standard coding tasks

**Implementation:** Direct port of Rust conversation_history

### Strategy 2: Continuous One-Shot

**Model:** Epic/specification + task list + log file, executed via repeated single-turn invocations until completion.

**Behavior:**
```
Session state:
  - Epic/spec (fixed, <5k tokens)
  - Task list (updated each turn)
  - Log file (append-only)

Each turn:
  - Model receives: epic + tasks + log
  - Model processes, updates log
  - Model exits unless:
    - Explicitly announces "done"
    - Requests user input
    - Encounters blocker
  - Harness checks state, loops

No conversation history accumulated.
```

**Characteristics:**
- Fixed context size (doesn't grow)
- Stateless from model perspective (reads log each time)
- Log captures decisions and progress
- Harness manages loop

**Advantages:**
- Infinite task duration (context never fills)
- Model stays focused (re-reads epic each turn)
- Suitable for autonomous execution

**Limitations:**
- No conversation back-and-forth
- Model can't reference specific past turns
- Less suitable for interactive work

**Use cases:**
- Long-running autonomous tasks
- When task spec is clear upfront
- Batch processing scenarios

**Implementation:** New strategy class (Phase 5.2+)

### Strategy 3: Compression Gradient

**Model:** Multi-fidelity history with automatic compression at multiple levels, intelligent gradient selection by recency, and on-demand detail retrieval.

**This is the primary innovation - detailed in sections below.**

---

## Compression Gradient: Concept

### The Problem

Context windows limit conversation length. Traditional solutions:
- **Truncate:** Lose old context entirely
- **Summarize all:** Lose detail everywhere
- **RAG-style retrieval:** Requires explicit queries, doesn't preserve conversation flow

### The Solution

**Multi-level compression with graduated retention:**
- Recent turns: Full detail (Raw)
- Working memory: Clean version (Smoothed)
- Background: Summarized (Compressed)
- Deep history: Minimal (Tiny)

**Plus retrieval:** Model can request detail for any turn when needed.

**Result:** Fixed token budget, variable conversation length, intelligent fidelity management.

### Core Principles

**1. Every turn gets multiple representations:**
```
Turn 183 stored as:
  - T-183-R: Raw (100% tokens)
  - T-183-S: Smoothed (60% tokens)
  - T-183-C: Compressed (30-40% tokens)
  - T-183-T: Tiny (1-5% tokens)
```

**2. Selection varies by position:**
```
Recent turns → Higher fidelity (more tokens/turn)
Older turns → Lower fidelity (fewer tokens/turn)
```

**3. Budget is fixed:**
```
Total history must fit in 100k tokens (or configured limit)
Gradient adjusts to maintain budget as conversation grows
```

**4. Retrieval available:**
```
Model sees T-87-C (compressed)
Model requests tools.history.getTurn("T-87", "S")
Gets smoothed version temporarily
```

---

## Compression Levels: Detailed Specification

### Level R: Raw

**Definition:** Complete, unmodified conversation content as originally generated.

**Messages:**
- All text preserved exactly
- Whitespace, formatting as-is
- No corrections or modifications

**Tool Calls:**
- Full arguments (complete JSON)
- Full outputs (stdout, stderr, results)
- All metadata (duration, exit codes, errors)

**Reasoning/Thinking:**
- Complete reasoning chains
- All thinking blocks
- No summarization

**Use:** Recent turns where full context matters.

**Token ratio:** 100% of original

### Level S: Smoothed

**Definition:** Normalized and cleaned version with noise removed but content intact.

**Processing:**
- Grammar and spelling corrections
- Casing normalization (consistent capitalization)
- Whitespace cleanup (remove excessive blank lines, normalize indentation)
- Repetition removal (model sometimes repeats phrases)
- Obvious filler removed ("um", "let me see", etc.)

**Messages:**
- Meaning preserved exactly
- Just cleaned presentation
- Readable, professional version

**Tool Calls:**
- Arguments: Long values truncated (patch content → "patch (342 lines)")
- Outputs: Truncated (stdout first/last 50 lines)
- Structure preserved

**Reasoning/Thinking:**
- Key points preserved
- Verbose rambling condensed
- Conclusions intact

**Use:** Working memory turns where detail needed but presentation can be improved.

**Token ratio:** ~60% of original

### Level C: Compressed

**Definition:** LLM-generated summary preserving key decisions, actions, and outcomes.

**Generation:** Small fast model (gpt-5-nano, flash 2.0) summarizes turn.

**Prompt for compression:**
```
Summarize this conversation turn preserving:
- Key decisions made
- Actions taken
- Results achieved
- Important context
- Conclusions reached

Omit:
- Verbose explanations
- Reasoning process details
- Tool call specifics (just "tool X called, outcome Y")

Target: 30-40% of original length.
```

**Content:**
- "User asked about auth flow. I analyzed the code and found 3 issues. Fixed validation bug via patch. Tests now pass."
- Decision points captured
- Actions documented
- Results noted

**Tool Calls:**
- "{exec called: tests ran, 3 failures found}"
- "{applyPatch called: validation fix applied}"
- Outcomes preserved, details omitted

**Use:** Background context where detailed actions less relevant.

**Token ratio:** 30-40% of original

### Level T: Tiny

**Definition:** Single-sentence ultra-compressed summary.

**Generation:** Aggressive LLM summarization.

**Prompt for tiny compression:**
```
One sentence summary capturing:
- What was requested
- What was accomplished
Omit all details, tool calls, and process.
```

**Content:**
- "Fixed 3 authentication test failures."
- "Implemented OAuth token refresh flow."
- "Refactored API error handling."

**Tool Calls:**
- Omitted entirely or "{5 tools called}"

**Use:** Deep history where only high-level awareness needed.

**Token ratio:** 1-5% of original

---

## Gradient Selection

### Concept

**Not all turns need same fidelity.** Recent conversations benefit from detail. Older context often just needs summaries.

**Gradient:** Smooth transition from high to low fidelity based on position.

### Band Allocation

**Example: 100k token budget, 200 turns**

```
Position    Turns      Level   Tokens/Turn   Total    %
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recent      181-200    R       2000          40k      40%
Working     161-180    S       800           16k      16%
Background  101-160    C       500           30k      30%
Deep        1-100      T       140           14k      14%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total       1-200      Mixed   Variable      100k     100%
```

**Percentages tunable:**
- Recent band: 30-50% of budget
- Working band: 10-20%
- Background: 25-35%
- Deep: 10-20%

**As conversation grows:**
- Band sizes adjust
- Percentages stay roughly stable
- Older content shifts to lower fidelity

### Gradient Calculation

**Triggered:** Every 10 turns (or configurable interval)

**Input:**
- Current turn count (e.g., 200)
- Token budget (e.g., 100k)
- Turn metadata (tokens per turn at each level)

**Process:**
1. Determine band boundaries:
   - Recent: Last 10% of turns (20 turns)
   - Working: Next 10% (20 turns)
   - Background: Next 30% (60 turns)
   - Deep: Remaining 50% (100 turns)

2. Calculate tokens per band:
   - Recent: 40k budget / 20 turns = 2k/turn → use R (avg ~2k)
   - Working: 16k budget / 20 turns = 800/turn → use S (avg ~800)
   - Background: 30k budget / 60 turns = 500/turn → use C (avg ~500)
   - Deep: 14k budget / 100 turns = 140/turn → use T (avg ~140)

3. Store gradient configuration:
```typescript
{
  lastCalculated: timestamp,
  turnCount: 200,
  bands: [
    {range: [181, 200], level: 'R', allocation: 0.40},
    {range: [161, 180], level: 'S', allocation: 0.16},
    {range: [101, 160], level: 'C', allocation: 0.30},
    {range: [1, 100], level: 'T', allocation: 0.14}
  ]
}
```

**Next calculation (turn 210):**
- Bands shift: [191, 210], [171, 190], etc.
- Percentages stay similar
- Some turns move to lower fidelity

**Cache impact:**
- Turns in same band: No change (cached)
- Turns crossing boundary: Re-fetch at new level
- ~10-20% of history invalidated per recalc

---

## Turn Tagging System

### XML Element Encoding

**Individual turns:**
```xml
<T-183-R>
I analyzed the authentication module and found 3 security issues:
1. Token validation missing expiry check
2. Refresh token not rotated
3. Session ID predictable

I'll fix these now with a patch.
</T-183-R>
```

**Compressed ranges:**
```xml
<T-150-through-160-C>
Turn 150: Implemented rate limiting for API endpoints.
Turn 151: Added Redis caching layer for session data.
Turn 152: Fixed memory leak in WebSocket handler.
Turn 153: Deployed to staging, ran load tests.
Turn 154: Production deployment successful.
Turn 155: Monitoring shows 40% response time improvement.
Turn 156: Updated documentation for new caching approach.
Turn 157: Team review meeting, addressed feedback.
Turn 158: Refactored cache invalidation logic.
Turn 159: Added cache warming on startup.
Turn 160: Final performance validation completed.
</T-150-through-160-C>
```

**Tag format:**
- `T-{id}` = Turn identifier (sequential)
- `-{level}` = Compression level (R/S/C/T)
- `-through-{end}` = Range indicator for compressed blocks

### Model Awareness

**System prompt includes:**
```
Conversation History Format:

Your conversation history uses a multi-fidelity compression system.
Each turn is tagged with its ID and compression level:

<T-{number}-{level}>
Where level is:
  R = Raw (complete, unmodified)
  S = Smoothed (cleaned, normalized, ~60% of original)
  C = Compressed (summarized, key points only, ~30-40% of original)
  T = Tiny (one sentence, ~1-5% of original)

Recent turns appear in higher fidelity (R or S).
Older turns appear compressed (C or T).

You can retrieve higher fidelity versions using:
  tools.history.getTurn(turnId, level)

Example: To see full detail of turn 87:
  const detail = await tools.history.getTurn("T-87", "R");
```

**In practice:**
- Model sees turn IDs in history
- Understands compression levels
- Can request detail when needed
- Knows trade-offs (more detail = more tokens)

### Turn ID Assignment

**Sequential numbering:**
- T-1, T-2, T-3, ...
- Assigned at turn creation
- Immutable (never changes)
- Consistent across all compression levels

**Persistence:**
- Stored with turn metadata
- Used in all representations
- Enables cross-referencing

---

## Compression Processing Pipeline

### When Compression Happens

**After each turn completes:**

```
Turn execution finishes
  ↓
Store raw version immediately
  ↓
Kick off async compression jobs (non-blocking)
  ├─ Generate Smoothed version
  ├─ Generate Compressed version
  └─ Generate Tiny version
  ↓
Processing completes (1-2 seconds target)
  ↓
All versions stored
  ↓
Turn fully processed
```

**Parallel processing:**
- 3 compression jobs run simultaneously
- Each uses small fast model (gpt-5-nano, flash 2.0, haiku 4.5)
- Target: Complete within 2 seconds
- If delayed: Continue in background, don't block next turn

### Compression Job Details

**Smoothed Generation (Algorithmic + LLM):**
```
Input: Raw turn content
Process:
  1. Algorithmic cleanup:
     - Spell/grammar check
     - Whitespace normalization
     - Remove obvious repetition
  2. Small LLM pass:
     - "Clean this text, preserve all meaning, fix errors, remove filler"
     - Quick validation pass
  3. Tool call simplification:
     - Long arguments → truncated with summary
     - Large outputs → head/tail with total line count
Output: Smoothed version (~60% tokens)
```

**Compressed Generation (LLM Summarization):**
```
Input: Smoothed turn (or Raw if Smoothed not ready)
Prompt: |
  Summarize this turn preserving:
  - Key decisions and why
  - Actions taken (what tools called)
  - Results achieved (success/failure)
  - Important conclusions

  Format tool calls as: "{tool_name called, outcome}"
  Target: 30-40% of original length.

Process:
  - Model: gpt-5-nano or flash 2.0 (fast, cheap)
  - Temperature: 0 (deterministic)
  - Max tokens: calculated from original length

Output: Compressed version
```

**Tiny Generation (Aggressive Summarization):**
```
Input: Compressed version (or Smoothed if Compressed not ready)
Prompt: |
  One sentence summary:
  - What was requested by user
  - What was accomplished

  Omit all reasoning, tool details, process.

Process:
  - Model: flash 2.0 (ultra-fast)
  - Temperature: 0
  - Max tokens: 50

Output: Tiny version
```

### Failure Handling

**If compression fails:**
- Mark turn for retry
- Background process detects incomplete turns
- Retry with backoff
- If repeated failure: Use fallback (S=R, C=S, T=C)

**Never blocks:**
- Raw version always available immediately
- Other versions generated asynchronously
- System functional even if compression pending

---

## Gradient Assembly Process

### Retrieval Flow

**When history needed for next turn:**

```
1. Check gradient configuration
   - Which bands apply?
   - What levels for what ranges?

2. For each turn in history:
   - Determine band (based on turn number)
   - Select fidelity level (R/S/C/T per band)
   - Fetch version (from storage)

3. Assemble history:
   - Group consecutive turns at same level
   - Wrap in appropriate tags
   - Maintain chronological order

4. Return assembled history
```

**Example assembly for turns 1-200:**

```xml
<T-1-through-100-T>
Turn 1: Project initialization. Turn 2: Setup authentication scaffolding.
Turn 3: Implemented user registration. Turn 4: Added email verification.
[... 96 more tiny summaries]
</T-1-through-100-T>

<T-101-through-160-C>
Turn 101: Integrated OAuth flow with Google and GitHub providers.
Turn 102: Fixed token refresh race condition causing intermittent 401s.
Turn 103: Added comprehensive auth integration tests covering all flows.
[... 57 more compressed summaries]
</T-101-through-160-C>

<T-161-S>
User asked me to review the email verification logic. I analyzed the code
and found the verification token wasn't being properly validated for expiration.
I applied a patch adding expiry checking and updated the tests. All
verification tests passing.
</T-161-S>

<T-162-S>
User reported password reset emails not sending. I checked the email
service configuration and found the SMTP credentials were outdated. Updated
environment variables, tested email flow, confirmed working.
</T-162-S>

[... 18 more smoothed turns]

<T-181-R>
Let me check the current authentication test coverage.

<tool-calls>
const authTests = await tools.grepFiles({pattern: "describe.*auth"});
const coverage = await tools.exec({command: ["npm", "run", "test:coverage"]});
return {testCount: authTests.length, coverage: parseCoverage(coverage.stdout)};
</tool-calls>

We have 47 auth tests with 94% coverage. The uncovered code is mostly error
handling edge cases.
</T-181-R>

[... 19 more raw turns through T-200-R]
```

**Model receives:**
- Chronological history
- Clear turn IDs
- Mixed fidelity (appropriate per position)
- ~100k tokens
- Representing 200 turns

---

## Visual: Gradient in Action

### Conceptual Diagram

```
Token Budget: 100k
Turn Count: 200

    Fidelity
      High │ R R R R R R R R R R R R R R R R R R R R    ← Recent (20 turns)
           │ S S S S S S S S S S S S S S S S S S S S    ← Working (20 turns)
           │ C C C C C C C C C C C C C C C C C C C C C  ← Background
           │ C C C C C C C C C C C C C C C C C C C C C
           │ C C C C C C C C C C C C C C C C C C C C C  (60 turns)
      Low  │ T T T T T T T T T T T T T T T T T T T T T
           │ T T T T T T T T T T T T T T T T T T T T T
           │ T T T T T T T T T T T T T T T T T T T T T
           │ T T T T T T T T T T T T T T T T T T T T T
           │ T T T T T T T T T T T T T T T T T T T T T  ← Deep (100 turns)
           └────────────────────────────────────────────→
             Turn 1                              Turn 200

Total: 100k tokens across 200 turns
Raw equivalent: ~400k tokens (4x compression)
```

### As Conversation Grows

**Turn 300 (100 new turns added):**

```
    Fidelity
      High │ R R R R R R R R R R R R R R R R R R R R    ← Turns 281-300
           │ S S S S S S S S S S S S S S S S S S S S    ← Turns 261-280
           │ C C C C C C C C C C C C C C C C C C C C C  ← Turns 201-260
           │ C C C C C C C C C C C C C C C C C C C C C
      Low  │ T T T T T T T T T T T T T T T T T T T T T  ← Turns 1-200
           │ T T T T T T T T T T T T T T T T T T T T T
           │ T T T T T T T T T T T T T T T T T T T T T
           │ T T T T T T T T T T T T T T T T T T T T T
           └────────────────────────────────────────────→
             Turn 1                              Turn 300

- Turns 181-200 shifted from R to S or C (recalculated)
- Turns 1-180 shifted down one level
- New turns 281-300 in R band
- Still ~100k tokens total
```

**Gradient shifts over time** - recent stays detailed, old compresses further.

---

## Fidelity Retrieval Tool

### Interface

**tools.history.getTurn(turnId, level)**

```typescript
getTurn(params: {
  turnId: string;       // "T-87"
  level: 'R' | 'S' | 'C' | 'T';
  format?: 'tagged' | 'plain';
}): Promise<{
  turnId: string;
  level: string;
  content: string;
  tokens: number;
  availableLevels: string[];  // Which versions exist
}>
```

### Behavior

**1. Validation:**
- Turn exists? (throw if not)
- Level exists? (throw if requested version not generated yet)

**2. Retrieval:**
- Fetch specified version from storage
- Apply turn tag if format='tagged' (default)

**3. Announcement Board:**
- Add retrieved content (TTL: 5 turns)
- Show in context but separate from main history
- Rolls off after TTL unless explicitly saved

**4. Return:**
- Content with metadata
- Model receives in response
- Can use immediately

### Example Usage

**Model sees in compressed history:**
```xml
<T-87-C>
Implemented OAuth flow with token refresh logic.
</T-87-C>
```

**Model wants detail:**
```typescript
<tool-calls>
// Current task relates to OAuth
// Need to see exact implementation from turn 87
const detail = await tools.history.getTurn("T-87", "S");

// Now have smoothed version in context
// Can reference specific approach used
return {foundRelevantPattern: true, willReuseApproach: true};
</tool-calls>
```

**Result:**
- Turn 87 (smoothed) added to announcement board
- Available for 5 turns
- Model can reference without using main history budget
- After 5 turns: Rolls off, can retrieve again if needed

### Announcement Board Integration

**Location:** Between user prompt and main history

**Format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Announcement Board (Context: 5 turn TTL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 Retrieved Turn Detail:
<T-87-S>
User asked me to review the OAuth implementation. I analyzed the token
refresh flow and found the refresh timing could cause race conditions.
I refactored to use a mutex-protected refresh with exponential backoff.
All auth tests passing after the fix.
</T-87-S>
(Retrieved 1 turn ago, expires in 4 turns)

🌐 Recent Web Fetches:
- FileKey ABC123: "TypeScript async patterns" (2 turns old)

📚 Tool Capabilities:
- Retrieve any turn: tools.history.getTurn(id, level)
- Levels: R (full), S (clean), C (summary), T (tiny)
- Current history: Turns 1-200
  - Turns 181-200: Raw detail
  - Turns 161-180: Smoothed
  - Turns 101-160: Compressed
  - Turns 1-100: Tiny

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Main conversation history follows]
```

**Content:**
- Retrieved turn detail (temporary visibility)
- Recent fetches (web content)
- Capability reminders (how to use tools)
- Expires per-item based on TTL

---

## Capacity Analysis

### Token Math

**Given:**
- Token budget: 100k
- Average turn (raw): ~2k tokens
- Compression ratios: S=60%, C=35%, T=3%

**Standard approach (no compression):**
- 100k / 2k = 50 turns maximum
- Turn 51 requires truncation

**Gradient approach:**

**Scenario 1: 200 turns**
- Recent 20 (R): 20 × 2000 = 40k
- Working 20 (S): 20 × 1200 = 24k → budget 16k, use fewer or higher C ratio
- Background 60 (C): 60 × 700 = 42k → budget 30k, feasible
- Deep 100 (T): 100 × 60 = 6k → budget 14k, ample room

**Actual fit:** ~180 turns in 100k with these numbers (need tuning)

**Scenario 2: Aggressive compression**
- Assume better compression: C=25%, T=2%
- Recent 30 (R): 30 × 2000 = 60k
- Working 30 (S): 30 × 1200 = 36k → reduce to 20k band
- Background 100 (C): 100 × 500 = 50k → 15k band
- Deep 200 (T): 200 × 40 = 8k

**Total:** 360 turns in 100k budget

**Raw equivalent:** 360 × 2k = 720k tokens compressed to 100k

**Compression factor:** 7.2x

**With tuning and optimization:**
- Realistic: 200-300 turns in 100k budget
- Representing: 400k-600k raw tokens
- Compression factor: 4-6x

**With 200k budget:**
- Estimated: 400-600 turns
- Representing: 800k-1.2M raw tokens

---

## Gradient Adjustment Over Time

### Dynamic Boundary Shifting

**As conversation grows, bands shift:**

```
Turn 100:
[1-80:T] [81-90:C] [91-95:S] [96-100:R]

Turn 200:
[1-140:T] [141-170:C] [171-190:S] [191-200:R]

Turn 300:
[1-220:T] [221-270:C] [271-290:S] [291-300:R]
```

**Pattern:**
- Recent band stays ~10% of total turns
- Older content gradually compresses
- Percentages stable, boundaries shift

### Recalculation Strategy

**Why every 10 turns:**
- Balance between cache efficiency and accuracy
- Band boundaries stay roughly stable (minimal churn)
- Most of history remains at same level (cache hits)
- Only boundary regions re-fetch

**Cache impact per recalc:**
```
Turn 200 → Turn 210:
- Turns 1-170: No change (still T or C)
- Turns 171-180: Might shift S→C (10 turns refetch)
- Turns 181-190: Might shift R→S (10 turns refetch)
- Turns 191-210: Stay R (cached or new)

Cache invalidation: ~20 turns out of 210 (~10%)
```

**Tuning knobs:**
- Recalc frequency (every N turns)
- Band percentage targets
- Minimum band sizes
- Overlap tolerance

---

## Data Flow: Complete Picture

### ASCII: History Lifecycle

```
Turn Execution
      ↓
┌─────────────────────────────────────┐
│ Turn Completes                      │
│ - User prompt                       │
│ - Model response                    │
│ - Tool calls (if any)               │
│ - Results                           │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Assign Turn ID                      │
│ T-{next_sequential}                 │
│ Example: T-201                      │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Store Raw Version (Immediate)       │
│ T-201-R = complete ResponseItem[]   │
│ Available immediately               │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Kick Off Compression (Async)        │
│                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────┐ │
│ │Smoothed  │ │Compressed│ │ Tiny │ │
│ │LLM Job   │ │LLM Job   │ │ Job  │ │
│ └────┬─────┘ └────┬─────┘ └───┬──┘ │
│      │            │            │    │
│   (Parallel - 3 models running)    │
│      │            │            │    │
│      ↓            ↓            ↓    │
│   T-201-S     T-201-C      T-201-T │
│   (1-2s)      (1-2s)       (1-2s)  │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ All Versions Stored                 │
│ T-201: {R, S, C, T} complete        │
└───────────┬─────────────────────────┘
            ↓
      (Continues...)

After 10 turns (Turn 210):
            ↓
┌─────────────────────────────────────┐
│ Gradient Recalculation Triggered    │
│                                     │
│ Input:                              │
│ - Turn count: 210                   │
│ - Budget: 100k tokens               │
│ - Token stats per level             │
│                                     │
│ Calculate:                          │
│ - Band boundaries                   │
│ - Level per band                    │
│ - Token allocation                  │
│                                     │
│ Output:                             │
│ bands: [                            │
│   {range: [191,210], level: 'R'},   │
│   {range: [171,190], level: 'S'},   │
│   {range: [111,170], level: 'C'},   │
│   {range: [1,110], level: 'T'}      │
│ ]                                   │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Gradient Config Updated             │
│ Next history fetch uses new bands   │
└─────────────────────────────────────┘

Next Turn (Turn 211):
            ↓
┌─────────────────────────────────────┐
│ History Assembly Requested          │
│ (for building next prompt)          │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Apply Current Gradient              │
│                                     │
│ For turn in 1..210:                 │
│   - Lookup band for turn number     │
│   - Get level for that band         │
│   - Fetch version from storage      │
│                                     │
│ Example:                            │
│   Turn 50 → band [1,110] → level T  │
│   → fetch T-50-T                    │
│                                     │
│   Turn 175 → band [171,190] → S     │
│   → fetch T-175-S                   │
│                                     │
│   Turn 205 → band [191,210] → R     │
│   → fetch T-205-R                   │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Group & Tag                         │
│                                     │
│ Consecutive same-level turns:       │
│   <T-1-through-110-T>               │
│   [110 tiny summaries]              │
│   </T-1-through-110-T>              │
│                                     │
│   <T-111-through-170-C>             │
│   [60 compressed summaries]         │
│   </T-111-through-170-C>            │
│                                     │
│   <T-171-S>...</T-171-S>            │
│   <T-172-S>...</T-172-S>            │
│   [20 smoothed individual turns]    │
│                                     │
│   <T-191-R>...</T-191-R>            │
│   <T-192-R>...</T-192-R>            │
│   [20 raw individual turns]         │
└───────────┬─────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Return Assembled History            │
│ ~100k tokens                        │
│ Representing 210 turns              │
└─────────────────────────────────────┘
```

---

## Retrieval Workflow

### Model-Initiated Detail Request

**Scenario:** Model sees compressed turn, wants more detail

```
Model reviewing history:
  Sees: <T-87-C>Implemented OAuth flow</T-87-C>
  Needs: Exact implementation approach
  ↓
Model writes:
  <tool-calls>
  const detail = await tools.history.getTurn("T-87", "S");
  // Review detail.content to understand approach
  return {reviewedOAuthImplementation: true};
  </tool-calls>
  ↓
Tool executes:
  ↓
┌─────────────────────────────────────┐
│ getTurn Handler                     │
│                                     │
│ 1. Validate turn exists             │
│    - Check: T-87 in storage?        │
│    - Yes → continue                 │
│                                     │
│ 2. Validate level available         │
│    - Check: T-87-S generated?       │
│    - Yes → continue                 │
│                                     │
│ 3. Fetch content                    │
│    - Retrieve T-87-S from storage   │
│    - Apply tag: <T-87-S>...</T-87-S>│
│                                     │
│ 4. Add to announcement board        │
│    - Insert into board              │
│    - Set TTL: 5 turns               │
│    - Mark as "retrieved detail"     │
│                                     │
│ 5. Return to model                  │
│    {                                │
│      turnId: "T-87",                │
│      level: "S",                    │
│      content: "<T-87-S>...</T-87-S>",
│      tokens: 1200                   │
│    }                                │
└───────────┬─────────────────────────┘
            ↓
Model receives smoothed turn 87
  ↓
Uses detail to inform current work
  ↓
Next turn: Detail still in announcement board
  ↓
Turn+5: Detail rolls off (unless re-retrieved)
```

---

## Storage Architecture

### Turn Storage Structure

**Per turn stored:**
```typescript
{
  turnId: "T-183",
  timestamp: Date,

  // All versions
  versions: {
    raw: {
      items: ResponseItem[],
      tokens: number
    },
    smoothed: {
      items: ResponseItem[],
      tokens: number,
      generatedAt: Date
    },
    compressed: {
      content: string,
      tokens: number,
      generatedAt: Date,
      model: string  // Which model compressed it
    },
    tiny: {
      content: string,
      tokens: number,
      generatedAt: Date,
      model: string
    }
  },

  // Metadata
  metadata: {
    toolCallCount: number,
    userPromptLength: number,
    assistantResponseLength: number,
    topics: string[],  // For future indexing
    processingComplete: boolean
  }
}
```

### Gradient State

```typescript
{
  lastCalculated: timestamp,
  calculationTrigger: 210,  // Turn that triggered recalc
  turnCount: 210,
  tokenBudget: 100000,

  bands: [
    {
      range: [191, 210],
      level: 'R',
      targetAllocation: 0.40,  // 40% of budget
      actualTokens: 38500
    },
    {
      range: [171, 190],
      level: 'S',
      targetAllocation: 0.16,
      actualTokens: 15800
    },
    {
      range: [111, 170],
      level: 'C',
      targetAllocation: 0.30,
      actualTokens: 29200
    },
    {
      range: [1, 110],
      level: 'T',
      targetAllocation: 0.14,
      actualTokens: 6600
    }
  ],

  totalTokensUsed: 90100,  // Under budget
  compressionRatio: 6.8    // Raw equivalent / actual
}
```

---

## Implementation Considerations

### Strategy Pattern

**HistoryStrategy interface:**
```typescript
interface HistoryStrategy {
  // Record a new turn
  recordTurn(turn: Turn): Promise<void>;

  // Get history for next turn (within budget)
  getHistory(budget: TokenBudget): Promise<HistorySegment[]>;

  // Retrieve specific turn at level
  getTurn(turnId: string, level: FidelityLevel): Promise<TurnContent>;

  // Get metadata
  getStats(): HistoryStats;
}

interface HistorySegment {
  turnIds: string[];
  level: 'R' | 'S' | 'C' | 'T';
  content: ResponseItem[] | string;
  tagged: boolean;
}
```

**Implementations:**
- `RegularHistoryStrategy` - Standard Codex (Rust port)
- `GradientHistoryStrategy` - Compression system (new)
- `OneShotHistoryStrategy` - Epic + log pattern (new)

**Selection:**
```typescript
const history = new ConversationHistory({
  strategy: new GradientHistoryStrategy({
    tokenBudget: 100000,
    recalcInterval: 10,
    bandAllocations: {recent: 0.40, working: 0.16, background: 0.30, deep: 0.14}
  })
});
```

### Compression Service

**Responsible for generating versions:**
```typescript
interface CompressionService {
  compress(turn: Turn): Promise<CompressionResult>;
}

interface CompressionResult {
  smoothed: {content: ResponseItem[], tokens: number};
  compressed: {content: string, tokens: number};
  tiny: {content: string, tokens: number};
}
```

**Implementation details:**
- Model selection (which LLMs to use)
- Prompt engineering (compression instructions)
- Retry logic (if compression fails)
- Quality validation (check token targets hit)

### Gradient Calculator

**Responsible for band allocation:**
```typescript
interface GradientCalculator {
  calculate(state: HistoryState): GradientConfig;
}

interface HistoryState {
  turnCount: number;
  tokenBudget: number;
  turnStats: TurnTokenStats[];
}

interface GradientConfig {
  bands: Band[];
  totalTokensExpected: number;
}
```

**Algorithm considers:**
- Turn count distribution
- Token usage patterns (actual sizes at each level)
- Budget constraints
- Target allocations (configurable percentages)

---

## Integration with Codex Architecture

### In Turn Processing

**Standard turn flow:**
```
1. User prompt received
2. Build context (get history via strategy)
3. Send to model
4. Receive response
5. Process tool calls (if any)
6. Record turn
7. Compression processing (async)
```

**With gradient strategy:**
```
Step 2: Build context
  → strategy.getHistory(budget)
  → GradientHistoryStrategy.getHistory()
  → Apply current gradient
  → Fetch mixed-fidelity turns
  → Assemble with tags
  → Return to turn processor

Step 6: Record turn
  → strategy.recordTurn(turn)
  → Store raw immediately
  → Queue compression jobs
  → (Async processing begins)

Step 7: Check if recalc needed
  → If turn % 10 === 0:
      → Recalculate gradient
      → Update band configuration
```

### Provider Compatibility

**Gradient history works with all providers:**

**OpenAI Responses API:**
- Tagged history sent in `input` field
- Tags pass through as text content
- Model sees structure

**OpenAI Chat API:**
- Tagged history converted to message array
- Tags in message content
- Delta streaming preserves tags

**Anthropic Messages API:**
- Tagged history in message content blocks
- Content block type: text
- Tags stream with text deltas

**No API-specific adaptation needed** - tags are plain text.

---

## Example: Complete History View

### What Model Sees (Turn 210, 100k budget)

```xml
<system>
You are an expert coding assistant...

History Format: Multi-fidelity compression
- Tags: <T-{id}-{level}> where level = R|S|C|T
- Retrieve detail: tools.history.getTurn(id, level)
</system>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Announcement Board
[Recent fetches, retrieved turns, capabilities]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Conversation History (210 turns, 100k tokens):

<T-1-through-110-T>
Turn 1: Project setup. Turn 2: Auth scaffolding. Turn 3: User registration.
[... 107 more tiny summaries, ~6k tokens total]
</T-1-through-110-T>

<T-111-through-170-C>
Turn 111: Integrated OAuth with Google/GitHub. Fixed token refresh race.
Turn 112: Added comprehensive auth tests, all flows covered.
Turn 113: Deployed to staging, load tested successfully.
[... 57 more compressed summaries, ~30k tokens total]
</T-111-through-170-C>

<T-171-S>
User asked to review email verification. I analyzed the token validation
and found expiry wasn't checked. Applied patch adding expiry logic,
updated tests. All verification tests passing.
</T-171-S>

<T-172-S>
Password reset emails not sending. Checked email service config, found
outdated SMTP credentials. Updated environment, tested, confirmed working.
</T-172-S>

[... 18 more smoothed turns, ~16k tokens total]

<T-191-R>
Let me check test coverage for the authentication module.

<tool-calls>
const tests = await tools.grepFiles({pattern: "describe.*auth"});
const coverage = await tools.exec({command: ["npm", "run", "test:coverage"]});
return {count: tests.length, coverage: parseCoverage(coverage.stdout)};
</tool-calls>

We have 47 auth tests with 94% coverage. Uncovered areas are mostly
error handling edge cases.
</T-191-R>

[... 19 more raw turns through T-210-R, ~40k tokens total]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current prompt: "Add rate limiting to the auth endpoints"
```

**Total:** ~92k tokens, representing 210 turns (raw would be ~420k)

---

## Benefits & Trade-offs

### Advantages

**Extended Conversations:**
- 200+ turns in fixed budget (vs 50 without compression)
- Deep project history accessible
- No hard cutoff / truncation

**Intelligent Fidelity:**
- Recent = detail (where it matters)
- Old = summary (sufficient for context)
- Automatic management (no manual intervention)

**Retrieval Capability:**
- Model-controlled detail access
- On-demand fidelity upgrade
- Temporary detail (announcement board TTL)

**Cache Efficiency:**
- Most history cached (stable across turns)
- Recalc infrequent (every 10 turns)
- Minimal invalidation per adjustment

### Trade-offs

**Compression Quality:**
- LLM summarization can lose nuance
- Critical details might be omitted
- Requires validation and tuning

**Processing Overhead:**
- 3 compression jobs per turn
- ~1-2 seconds delay (if synchronous)
- Background processing complexity

**Storage:**
- 4 versions per turn (4x storage)
- Compression jobs cost (LLM calls)
- More data to manage

**Model Understanding:**
- Must learn compression system
- Must know when to retrieve detail
- System prompt complexity

### Mitigation Strategies

**Quality:**
- Test compression extensively
- Validate key info preserved
- Allow fallback to higher fidelity if compression poor

**Performance:**
- Async processing (non-blocking)
- Cache aggressively
- Use fast cheap models for compression

**Storage:**
- Prune very old turns (beyond deep history)
- Compress storage format
- Cost is manageable (storage cheap)

**Usability:**
- Clear documentation in system prompt
- Examples in announcement board
- Retrieval tool simple and discoverable

---

## Comparison to Alternatives

### vs RAG (Retrieval Augmented Generation)

**RAG:**
- Explicit queries required
- Retrieved chunks lack conversation context
- Model must frame query
- Discrete retrieval (not gradient)

**Compression Gradient:**
- Automatic selection (no explicit query)
- Full conversation context preserved
- Model sees flow, can request detail
- Smooth fidelity transition

**Complementary:** Can combine (RAG for external knowledge, gradient for conversation)

### vs Infinite Attention (Research)

**Infinite Attention:**
- Theoretical (not production)
- Requires model architecture changes
- Compression in model itself

**Compression Gradient:**
- Works with any model
- Compression external to model
- Production-ready approach
- Model-agnostic

### vs Simple Truncation

**Truncation:**
- Oldest turns dropped entirely
- Hard cutoff
- Context loss

**Compression Gradient:**
- Nothing dropped (all turns accessible)
- Smooth degradation
- Intelligent retention

---

## Future Directions

### Compression Improvements

**Potential enhancements:**
- Semantic segmentation (compress by topic, not just turn)
- Adaptive compression (more aggressive for verbose, less for concise)
- Multi-model compression (ensemble for quality)
- Learned compression (train on what to keep)

### Gradient Tuning

**Optimization opportunities:**
- Machine learning for band allocation
- Per-user/per-project gradient profiles
- Adaptive recalculation (more frequent if high churn)
- Compression quality feedback loop

### Retrieval Enhancements

**Additional capabilities:**
- Retrieve range: `getTurns("T-50", "T-60", "S")` for span
- Retrieve by topic: `getTurnsByTopic("authentication", "C")`
- Retrieve by keyword: `searchHistory("OAuth", maxResults: 5)`
- Smart prefetch: Predict what model might need, pre-load

---

## Success Criteria

**The compression gradient system succeeds if:**

1. **Conversations extend significantly:**
   - 200+ turns in 100k budget
   - 400+ turns in 200k budget
   - Measured against standard approach

2. **Context quality maintained:**
   - Models perform comparably to full history (when possible)
   - Compressed turns provide sufficient context
   - Retrieval mechanism fills gaps

3. **Performance acceptable:**
   - Compression completes within 2 seconds
   - Gradient recalc <100ms
   - Retrieval instant
   - No user-perceived latency

4. **Cache efficiency achieved:**
   - >80% cache hit rate after recalc
   - <20% history re-fetched per adjustment
   - Prompt caching effective

5. **Usability verified:**
   - Models understand compression system
   - Models use getTurn appropriately
   - Error rate not increased

**Measurement:** Will be conducted after implementation (Phase 7).

---

## Conclusion

The compression gradient memory system addresses LLM context window limitations through multi-level compression, intelligent fidelity selection, and on-demand detail retrieval. By storing conversation history at four fidelity levels and automatically selecting appropriate detail based on recency, the system enables extended conversations within fixed token budgets.

**Key mechanisms:**
- Automatic compression (4 versions per turn)
- Gradient selection (recent = detail, old = summary)
- Turn tagging (XML with embedded IDs)
- Retrieval tool (on-demand fidelity upgrade)
- Periodic recalculation (adapt as conversation grows)

**Expected capacity:** 200-400 turns in 100k budget, representing 400k-1M+ raw tokens through compression.

**Implementation:** Phased approach - design complete, technical implementation follows core port completion (Phase 7).
