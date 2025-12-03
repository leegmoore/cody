# Feature and Tech Design Review: Message Compression for Session Cloning

**Reviewer:** Senior Engineer Review
**Date:** 2025-12-03
**Documents Reviewed:**
- `01-message-compression.feature.md`
- `02-message-compression.tech-design.md`

---

## Executive Summary

Overall, these are well-structured documents that demonstrate thoughtful planning for a moderately complex feature. The feature spec is clear and testable, and the tech design shows appropriate separation of concerns. However, there are several issues that need attention before implementation, ranging from specification gaps that would cause developer confusion to potential runtime bugs.

**Recommendation:** Address the "Must Fix" items, then proceed with implementation.

---

## 1. Feature Document Review

### 1.1 User Story Assessment

**Strengths:**
- Clear persona (AI Enabled Software Engineer)
- Well-articulated value proposition (reclaim context window space)
- Specific benefit (longer productive sessions)

**Minor Issue:** The phrase "configurable bands" in the user story assumes the reader knows what bands mean. Consider adding a brief definition in the story itself or ensuring it's the first thing explained in scope.

### 1.2 Acceptance Criteria Review

#### Complete and Testable
- AC-1 through AC-6 (Request Format): Clear and testable
- AC-7 through AC-14 (Compression Behavior): Mostly clear, some issues noted below
- AC-15 through AC-19 (Processing and Reliability): Clear
- AC-20 through AC-22 (Response Format): Clear
- AC-23 through AC-24 (Configuration): Clear

#### Issues Identified

**AC-9/AC-10 - Target Percentages:**
> AC-9: "approximately 10% of original message length"
> AC-10: "approximately 30-40% of original message length"

- **Problem:** "approximately" is not testable. How do we know if we achieved "approximately 10%"? Is 15% acceptable? Is 8%?
- **Recommendation:** Either define acceptable ranges (e.g., "5-15% for heavy-compress") or acknowledge that the target is aspirational and the AC is really "the prompt requests X%".

**AC-13/AC-14 - Turn Cohesion:**
> AC-13: "Turns are kept together - if a user message falls in a band, its corresponding assistant response is in the same band"
> AC-14: "Band boundaries align to turn boundaries with sensible rounding"

- **Problem:** AC-14 is vague. What is "sensible rounding"? Does a turn at 49.5% go to the 0-50% band or the 50-100% band? What about a turn at exactly 50%?
- **Recommendation:** Specify the rounding behavior explicitly. Suggest: "Turn position is calculated as `turnIndex / totalTurns`. A turn falls within a band if `bandStart <= turnPosition * 100 < bandEnd`."

**AC-19 - Thinking Mode Threshold:**
> "Messages over a token threshold (default 1000 tokens) use thinking mode"

- **Problem:** Token estimation is approximate (`ceil(text.length / 4)`). A message might be estimated at 1001 tokens but actually be 800 tokens, or vice versa. Does this matter?
- **Recommendation:** Clarify that the decision is based on estimated tokens, not actual tokens.

**Missing AC - Band Edge Cases:**
- What happens if a band specifies `start: 0, end: 0`? (Zero-width band)
- What happens if bands don't cover the full 0-100% range? (This is mentioned as valid in AC-3, but should there be an AC confirming unchanged messages remain unchanged?)
- What happens if `end < start`? (The schema handles this, but no AC documents it)

**Missing AC - Empty Message Handling:**
- What happens if a message compresses to empty string? Is this allowed, treated as failure, or is there a minimum output length?

**Missing AC - Rate Limiting:**
- No mention of OpenRouter rate limits or how they're handled. Is this intentional (out of scope) or an oversight?

### 1.3 Test Conditions Review

**Strengths:**
- Good coverage of the happy path (TC-01, TC-02, TC-03)
- Edge cases covered (TC-04 turn cohesion, TC-05 minimum threshold)
- Failure modes addressed (TC-06, TC-07, TC-15)
- Combination testing (TC-12)

**Gaps:**

**TC-04 - Turn Cohesion:**
- Test condition says "turn that straddles a band boundary" but turns don't straddle - messages within a turn might be on either side of a percentage point. This needs clarification.
- Better framing: "Given a turn whose calculated percentage falls at a band boundary..."

**TC-08 - Token Statistics:**
- Doesn't specify HOW to verify accuracy. The test needs to either:
  - Use known fixture data with pre-calculated token counts, OR
  - Accept that statistics are based on estimates and test the formula, not the accuracy

**Missing Test Conditions:**

- **TC-XX: Concurrent Clone Requests** - What happens if two clone requests with compression hit the same session simultaneously?
- **TC-XX: Very Large Session** - Performance characteristics with sessions having 500+ turns
- **TC-XX: Unicode/Special Characters** - Does compression preserve non-ASCII content correctly?
- **TC-XX: Partial Band Coverage** - Request with band [30-60%] only; verify 0-30% and 60-100% unchanged
- **TC-XX: Empty Message Content** - Message with empty string or whitespace-only content in compression band

---

## 2. Tech Design Review

### 2.1 Architecture Assessment

**Strengths:**
- Clean separation: Router -> Service -> Batch Processor -> Client
- V1/V2 isolation strategy is sound
- Batch processing with retry is appropriate for unreliable external API
- Shared code approach avoids duplication

**Concerns:**

**Module Boundary Issue - CompressionService vs CompressionBatchProcessor:**
The current design has `CompressionService` creating tasks and `CompressionBatchProcessor` executing them. However, the batch processor returns `CompressionTask[]` which then needs to be "applied" by `CompressionService`. This creates unnecessary coupling.

**Recommendation:** Consider having `processBatches` return a simpler result type like `Map<number, string>` (messageIndex -> compressedText) or `CompressionResult[]` with just `{ index: number, success: boolean, text?: string, error?: string }`. The task management details are internal to batch processing.

### 2.2 Interface/Signature Review

**OpenRouterClient.compress:**
```typescript
async compress(
  text: string,
  level: CompressionLevel,
  useThinking: boolean
): Promise<string>
```

**Issue:** This throws on failure, but the batch processor needs to catch and retry. The signature doesn't indicate what errors can be thrown. Consider:
- Adding JSDoc documenting thrown errors, OR
- Returning a Result type: `Promise<{ success: true, text: string } | { success: false, error: string }>`

**compressWithTimeout:**
```typescript
async function compressWithTimeout(
  task: CompressionTask,
  client: OpenRouterClient
): Promise<CompressionTask>
```

**Issue:** Mutates the task object and returns it? Or returns a new copy? This should be explicit. TypeScript won't catch accidental mutation.

**Recommendation:** Either:
- Document that it returns a NEW task with updated status, OR
- Change signature to `Promise<{ status: TaskStatus, result?: string, error?: string }>` and let caller handle task update

### 2.3 Data Flow Issues

**Token Counting Inconsistency:**
- `estimateTokens()` uses `ceil(text.length / 4)`
- But what text? Before or after extracting from content blocks?
- The tech design shows `extractTextContent()` is separate from `estimateTokens()`
- Need to clarify: Are tokens estimated on raw entry content or extracted text?

**applyCompressedContent Logic:**
```typescript
function applyCompressedContent(entry: SessionEntry, compressedText: string): SessionEntry
// - If entry.message.content is an array:
//   - Remove all blocks where block.type === "text"
//   - Add single new block: { type: "text", text: compressedText }
//   - Preserve non-text blocks (images, etc.) in their original positions
```

**Issue:** "Preserve non-text blocks in their original positions" is contradictory. If you remove text blocks and add a new one, what determines the position of the new text block? The design should specify:
- Is the new text block added at the beginning, end, or where the first text block was?
- What if there were multiple text blocks at different positions?

**Recommendation:** Simplify: "Replace all text blocks with a single text block at position 0, preserving non-text blocks in their original relative order after the text block."

### 2.4 Missing Error Cases

1. **Network Errors:** What specific errors does OpenRouter return? Are there 429 (rate limit) responses to handle specially?

2. **Empty Compression Result:** What if the LLM returns `{ "text": "" }`? This passes Zod validation but is probably wrong.

3. **Massive Compression Result:** What if the LLM returns MORE text than the input? (LLMs can be weird.) Should this be detected and treated as failure?

4. **JSON Parsing Edge Cases:** What if the LLM response contains valid JSON but with extra fields? The Zod schema uses `.object()` which is permissive by default.

5. **AbortController Memory Leaks:** If many requests timeout, are AbortControllers properly cleaned up?

### 2.5 TDD Phase Assessment

The 10-phase approach is reasonable but could be tightened:

**Potential Issue - Phase 1 Verification:**
> "POST /api/v2/clone returns 501 Not Implemented"

This assumes the stub throws `NotImplementedError`. But the method inventory shows stubs should "throw new Error('Not implemented: methodName')". Need consistency - either use `NotImplementedError` class or generic Error, but be consistent.

**Potential Issue - Phase 2/3 Split:**
Phase 2 writes tests for core compression logic, Phase 3 implements. But `mapTurnsToBands()` depends on understanding how bands and turns interact, which requires a fixture. The fixture design should be specified in Phase 1 or Phase 2 prep.

**Missing Phase - Fixture Creation:**
There's no explicit phase for creating test fixtures. The existing v1 tests use fixtures in `test/fixtures/`. New fixtures will be needed for compression tests. This should be called out.

### 2.6 Configuration Review

```env
COMPRESSION_TARGET_HEAVY=10
COMPRESSION_TARGET_STANDARD=35
```

**Issue:** The feature spec says "30-40%" for standard, but config shows 35. This is fine, but the inconsistency might confuse someone reading both docs.

**Missing Configuration:**
- No config for OpenRouter base URL (assuming it's hardcoded?)
- No config for retry backoff strategy (linear as shown, but not configurable)

---

## 3. Alignment Check

### 3.1 ACs Without Clear Implementation Path

| AC | Status | Gap |
|----|--------|-----|
| AC-9 | Partial | "approximately 10%" - implementation targets a percentage but can't guarantee outcome |
| AC-10 | Partial | Same as AC-9 |
| AC-14 | Unclear | "sensible rounding" not specified in design |

### 3.2 Design Elements Without AC Traceability

| Design Element | Traceable? | Notes |
|---------------|------------|-------|
| `estimateTokens()` | AC-5, AC-19 | Covered |
| `extractTextContent()` | Implicit | Needed but not an AC |
| `applyCompressedContent()` | Implicit | Needed but not an AC |
| Lineage logging extension | Not in feature | Tech design adds compression fields to lineage, but no AC requires this |

**Recommendation:** Add an AC for lineage logging of compression operations, or explicitly note it as implementation enhancement.

### 3.3 Order of Operations Concern

The tech design shows:
1. Compress messages
2. Apply tool/thinking removal
3. Repair UUID chain

**Question:** What if compression and tool removal target the same turn? The message gets compressed, then the tools get removed from it. Is this the intended order? Consider:
- A turn in 0-50% band with both compression AND tool removal
- Compression runs, makes message smaller
- Tool removal runs, removes tool_use blocks
- Final message has compressed text + no tools

This seems correct, but it's not documented. What if someone expected tools to be removed BEFORE compression (so compression doesn't include tool text)?

**Recommendation:** Add a note in the feature doc or tech design confirming this order is intentional.

---

## 4. Critical Analysis

### 4.1 Strongest Aspects

1. **Clear V1/V2 Isolation:** The strategy to keep v1 unchanged while adding v2 is well-thought-out and minimizes regression risk.

2. **Robust Retry Logic:** The batch processing with escalating timeouts is production-grade thinking for an internal tool. This will handle flaky API responses gracefully.

3. **Test Conditions Coverage:** The 15 test conditions cover most realistic scenarios. This is better coverage than many internal tools get.

4. **Type Safety:** Zod schemas for both request/response and LLM response validation shows attention to runtime safety.

5. **Incremental TDD Phases:** The 10-phase breakdown makes the work manageable and verifiable at each step.

### 4.2 Weakest Aspects

1. **Vague Compression Targets:** "approximately 10%" is not actionable. The LLM will do what it does - the design should acknowledge this and focus on what IS controllable (the prompt).

2. **Turn Boundary Math:** The most complex part of the feature (mapping percentages to turns) has the least specification. This will cause implementation confusion.

3. **Content Block Handling:** `applyCompressedContent()` behavior with mixed content types (text + image + tool_use) is under-specified.

4. **No Performance Considerations:** For a feature that makes N external API calls (where N could be 100+ for large sessions), there's no discussion of expected latency or timeout for the overall operation.

### 4.3 Questions I Would Ask

1. **"Why parallel batches with retry instead of sequential with retry?"** Parallel is faster but harder to debug and reason about. For internal tooling, is the complexity worth it?

2. **"What's the expected P99 latency for a 100-turn session with 50% compression?"** If each compression takes 2-5 seconds and we have 50 messages with concurrency of 10, that's 10-25 seconds minimum. Is this acceptable? Should there be a progress callback?

3. **"Have you tested OpenRouter's rate limits?"** At concurrency 10, you're making 10 requests simultaneously. Does OpenRouter throttle this?

4. **"Why Gemini Flash for compression?"** Is there a reason to prefer this over Claude or GPT for summarization tasks? Has anyone tested compression quality?

5. **"What happens to images in messages?"** The design says preserve non-text blocks, but images could be large. Should they be compressed, removed, or left as-is?

### 4.4 What Developers Will Ask

1. "Where do I put the test fixtures for compression tests?"
2. "How do I mock OpenRouter in tests - at the HTTP level or at the client level?"
3. "What JSON structure should the LLM return? The schema says `{ text: string }` but the prompt isn't specified."
4. "How do I test timeout behavior without waiting 5+ seconds per test?"
5. "If a message has both text blocks and image blocks, what order do they appear in after compression?"

---

## 5. Risk Assessment

### 5.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM returns inconsistent JSON format | Medium | Medium | Zod validation + retry handles this |
| Compression produces gibberish | Low | High | Manual verification in Phase 10; consider quality checks |
| AbortController timeout doesn't actually abort | Low | Low | Test with intentionally slow responses |
| Token estimation way off | Medium | Low | Only affects thinking mode selection; not critical |

### 5.2 Integration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| V2 endpoint accidentally breaks V1 | Low | High | Separate route file; v1 tests must pass |
| Lineage log format change breaks consumers | Low | Medium | New fields are additive; existing parsers should ignore |
| OpenRouter API changes | Low | Medium | Version pin the API if possible |

### 5.3 Testing Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Flaky tests due to timeout mocking | Medium | Medium | Use deterministic timeout simulation |
| Fixtures become stale | Low | Low | Document fixture format; version fixtures |
| Phase 10 manual testing is skipped | Medium | High | Make checklist explicit; document results |

---

## 6. Recommendations

### 6.1 Must Fix Before Implementation

1. **Specify Turn-to-Band Mapping Formula**
   - Document exactly how `turnPosition = turnIndex / totalTurns * 100` maps to bands
   - Specify boundary behavior: `start <= position < end` or `start <= position <= end`
   - Add this to both feature doc (as clarification to AC-14) and tech design

2. **Define `applyCompressedContent` Behavior Precisely**
   - Specify where the compressed text block goes in a mixed content array
   - Document what happens to multiple text blocks (merge into one)
   - Add edge case: empty compressed result handling

3. **Add Compression Prompt to Tech Design**
   - The `buildPrompt()` method is critical but not specified
   - Include the actual prompt template or at least its structure
   - This is the single most important factor in compression quality

4. **Align Token Estimation Usage**
   - Clarify that `estimateTokens` is called on the result of `extractTextContent`
   - Document that this is an estimate and the threshold decision may be imperfect

### 6.2 Should Fix (Not Blocking)

1. **Simplify Batch Processor Return Type**
   - Return `CompressionResult[]` instead of `CompressionTask[]`
   - Reduces coupling between modules

2. **Add Overall Operation Timeout**
   - Protect against runaway compression of large sessions
   - Suggest: 5 minutes max for entire clone operation

3. **Add Test Fixture Specification**
   - Document what fixtures are needed for compression tests
   - Include this in Phase 1 or as Phase 1.5

4. **Clarify Order of Operations**
   - Add note to feature doc: "Compression is applied before tool/thinking removal"
   - Document why this order was chosen

5. **Add Configuration for OpenRouter Base URL**
   - Even internal tools should be configurable for staging vs production endpoints

### 6.3 Nice to Have

1. **Progress Callback**
   - For large sessions, provide progress updates
   - Could be as simple as logging "Batch 3/10 complete"

2. **Compression Quality Metrics**
   - Track actual compression ratio vs target
   - Log for future prompt tuning

3. **Dry Run Mode**
   - `dryRun: true` parameter that calculates what would be compressed without calling LLM
   - Useful for testing and understanding compression scope

4. **Rate Limit Handling**
   - Detect 429 responses from OpenRouter
   - Implement backoff strategy

---

## Appendix: Suggested Clarifications

### A.1 Turn-to-Band Mapping (for Tech Design)

```typescript
/**
 * Maps turns to compression bands.
 *
 * Turn position is calculated as a percentage: (turnIndex / totalTurns) * 100
 * A turn is assigned to a band if: band.start <= turnPosition < band.end
 *
 * Example: 10 turns, band [0, 50]
 * - Turn 0: position = 0% -> IN band
 * - Turn 4: position = 40% -> IN band
 * - Turn 5: position = 50% -> NOT in band (50 < 50 is false)
 *
 * Edge cases:
 * - Empty session (0 turns): returns empty mapping
 * - Single turn: position = 0%, will match bands starting at 0
 */
function mapTurnsToBands(turns: Turn[], bands: CompressionBand[]): TurnBandMapping[]
```

### A.2 Content Block Handling (for Tech Design)

```typescript
/**
 * Applies compressed text to a session entry.
 *
 * For string content: replaces entire content with compressed text
 *
 * For array content:
 * 1. Find all text blocks and note their positions
 * 2. Remove all text blocks
 * 3. Insert single new text block at position of FIRST original text block
 * 4. Non-text blocks retain their relative order
 *
 * Example:
 * Input: [image, text("hello"), tool_use, text("world")]
 * Output: [image, text("compressed"), tool_use]
 *
 * If compressed text is empty string: still insert text block with empty content
 * (caller may want to detect this and treat as failure)
 */
function applyCompressedContent(entry: SessionEntry, compressedText: string): SessionEntry
```

### A.3 Compression Prompt Template (for Tech Design)

```typescript
private buildPrompt(text: string, targetPercent: number): string {
  return `Compress the following text to approximately ${targetPercent}% of its original length.
Preserve the key information, decisions, and outcomes.
Remove verbose explanations, redundant phrases, and filler content.
Maintain technical accuracy - do not change code, file paths, or technical terms.

Respond with ONLY a JSON object in this exact format:
{"text": "your compressed text here"}

Text to compress:
---
${text}
---`;
}
```

---

## Conclusion

This is a solid feature specification and technical design for internal tooling. The core architecture is sound, the TDD approach is appropriate, and the isolation of V1/V2 shows good engineering discipline.

The main areas needing attention are:
1. Precision in the turn-to-band mapping logic
2. Clarity on content block manipulation
3. Including the compression prompt template

Address the "Must Fix" items, and this feature is ready for implementation.
