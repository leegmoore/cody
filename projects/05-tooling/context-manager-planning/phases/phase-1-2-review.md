# Phase 1-2 Specification Review

## Executive Summary

**Overall Assessment: NEEDS WORK**

Both phase specifications are well-structured but incomplete for a developer to implement without ambiguity. Phase 1 is missing critical details about test fixtures and has inconsistencies with the tech design. Phase 2 has weak test specifications and implementation gaps that would cause confusion during TDD execution.

The core concepts are sound. The issues are primarily in specification completeness, not architectural direction.

---

## Issues by Severity

### Blocking Issues

These would prevent successful implementation or cause significant rework.

#### B-1: Phase 1 - Test Fixtures Underspecified

**Location:** Phase 1, Section 7 (Test Fixtures)

**Problem:** The test fixtures are described only by name without content structure. A developer cannot create these files without guessing at the JSONL format.

**What's Missing:**
- No sample JSONL structure showing what a "turn" looks like
- No specification of the `SessionEntry` schema expected in fixtures
- No definition of what distinguishes a "user" entry from an "assistant" entry (is it `type`, `role`, `message.role`?)
- No sample content for `session-mixed-lengths.jsonl` to illustrate the "varying token lengths"
- No description of what goes in `expected/` directory

**Impact:** Developer will create fixtures that don't match the actual parsing logic, causing all tests to fail with confusing errors.

**Fix Required:** Add complete example JSONL content for at least one fixture, showing:
1. The exact JSON structure of a SessionEntry
2. How turns are delimited
3. Example content for short (<20 tokens), medium, and long (>1000 tokens) messages

---

#### B-2: Phase 1 - Missing `applyCompressionResults` in Stub List

**Location:** Phase 1, Section 5 (Services)

**Problem:** Tech design section 5 specifies `applyCompressionResults(entries, results): SessionEntry[]` in `compression.ts`, but Phase 1 only says "7 stubbed functions" without listing them.

**Impact:** Developer might miss this function or implement with wrong signature.

**Fix Required:** Enumerate all 7 functions with signatures:
```
1. compressMessages(entries, turns, bands, config): Promise<{entries, stats}>
2. mapTurnsToBands(turns, bands): TurnBandMapping[]
3. createCompressionTasks(entries, turns, mapping): CompressionTask[]
4. estimateTokens(text): number
5. extractTextContent(entry): string
6. applyCompressedContent(entry, text): SessionEntry
7. applyCompressionResults(entries, results): SessionEntry[]
```

---

#### B-3: Phase 2 - No Test Code Provided

**Location:** Phase 2, entire document

**Problem:** Phase 2 references "phase-02-tdd-red-core.md (archived)" for full test code, but this file doesn't exist. The test descriptions are too vague to implement.

For example, "TC-03: Multiple Non-Contiguous Bands" - what does this test actually assert? What fixture does it use? What are the expected results?

**Impact:** Developer cannot write tests without inventing the specifications, defeating the purpose of TDD.

**Fix Required:** Either:
1. Create the referenced archive file with full test code, OR
2. Include complete test code inline in Phase 2 (preferred for a single-file spec)

---

#### B-4: Phase 2 - Turn Mapping Algorithm Incomplete

**Location:** Phase 2, "TDD Green" Section 3

**Problem:** The algorithm states:
```
turnPosition = (turnIndex / totalTurns) * 100
Include if: band.start <= turnPosition < band.end
```

But this has an edge case: for 10 turns, turn index 10 doesn't exist (0-9), and turn 9 would have position 90%, never reaching 100%. This means a band `[90, 100]` would never include the last turn.

Tech design section 5 clarifies this:
> Example: 10 turns, band [0, 50]
>   Turn 0: 0% -> in band
>   Turn 4: 40% -> in band
>   Turn 5: 50% -> NOT in band

But Phase 2 doesn't include this clarification.

**Impact:** Developer might implement differently, causing turn 9 to be included or excluded inconsistently.

**Fix Required:** Add explicit edge case handling and examples:
- For N turns, indices are 0 to N-1
- Position formula: `(index / total) * 100` where `total = N` (not N-1)
- Example: 10 turns, last turn (index 9) has position 90%, which falls in band [90, 100)
- Wait, this contradicts tech design. Clarify which interpretation is correct.

**Actually, let me re-read:** Tech design says position = `(turnIndex / totalTurns) * 100`. For 10 turns, turn 9 = 90%. Band [90, 100) would include turn 9. Band [0, 50) would include turns 0-4 (positions 0, 10, 20, 30, 40). Turn 5 at position 50% is excluded because the check is `< band.end`.

This is consistent. Phase 2 just needs the explicit examples.

---

### Should Fix Issues

These would cause confusion or require developer judgment calls that should be specified.

#### S-1: Phase 1 - Schema Code Not Provided

**Location:** Phase 1, Section 3

**Problem:** States "Full v2 schema with compression bands validation. See tech design for complete code." But tech design only shows fragments, not a complete copy-pasteable schema file.

Missing from tech design:
- Import statements
- Export statements
- `validateNonOverlappingBands` function implementation
- Complete file structure

**Fix Required:** Either provide complete schema file content in Phase 1, or add the missing pieces to tech design and reference specific line numbers.

---

#### S-2: Phase 1 - Missing NotImplementedError Definition

**Location:** Phase 1, Goal statement

**Problem:** Goal says functions should throw `NotImplementedError`, but this error class isn't defined in the types. Tech design only defines `ConfigMissingError`.

**Fix Required:** Add to Phase 1, Section 2 (Errors):
```typescript
export class NotImplementedError extends Error {
  constructor(methodName: string) {
    super(`Not implemented: ${methodName}`);
    this.name = "NotImplementedError";
  }
}
```

---

#### S-3: Phase 2 - Tests Reference Missing Types

**Location:** Phase 2, test descriptions

**Problem:** Tests reference `Turn` type but Phase 1 doesn't add this type. Looking at tech design, `Turn` is used but never defined.

The `identifyTurns()` function returns `Turn[]`, but what is a `Turn`?

**Impact:** Developer cannot write tests for `mapTurnsToBands(turns, bands)` without knowing the Turn structure.

**Fix Required:** Add Turn type to Phase 1 types:
```typescript
interface Turn {
  index: number;
  startEntryIndex: number;
  endEntryIndex: number;
  userMessageIndex: number;
  assistantMessageIndex?: number;
}
```

(Or whatever the actual structure is - this needs to match existing `identifyTurns()` implementation.)

---

#### S-4: Phase 2 - `entryType` Missing from TurnBandMapping

**Location:** Phase 2, Section 4 (createCompressionTasks)

**Problem:** Phase 2 says to "create tasks for user and assistant messages" but `TurnBandMapping` only maps turnIndex to band. How does `createCompressionTasks` know which entries are user vs assistant?

The tech design mentions `entryType: "user" | "assistant"` in `CompressionTask`, but doesn't explain how this is determined.

**Fix Required:** Clarify the algorithm:
1. Use the Turn object to get userMessageIndex and assistantMessageIndex
2. For each turn in a compression band, create up to 2 tasks (one per present message)
3. Determine entryType from the entry's role/type field

---

#### S-5: Phase 2 - applyCompressedContent Behavior Underspecified

**Location:** Phase 2, Section 5

**Problem:** States "Replace text content with compressed text" but tech design is more specific:
> If entry.message.content is an array:
>   - Remove all blocks where block.type === "text"
>   - Add single new block: { type: "text", text: compressedText }
>   - Preserve non-text blocks (images, etc.) in their original positions

Phase 2 doesn't capture this nuance.

**Impact:** Developer might implement naively and break non-text content.

**Fix Required:** Copy the detailed behavior from tech design into Phase 2.

---

#### S-6: Phase 2 - Missing Test for extractTextContent

**Location:** Phase 2, TDD Red section

**Problem:** Lists `extractTextContent - string vs array content` as a test but doesn't describe what assertions to make.

**Fix Required:** Add test specification:
```
Test: extractTextContent handles string content
  Given: entry.message.content = "Hello world"
  Expect: returns "Hello world"

Test: extractTextContent handles array content
  Given: entry.message.content = [
    { type: "text", text: "Line 1" },
    { type: "image", ... },
    { type: "text", text: "Line 2" }
  ]
  Expect: returns "Line 1\nLine 2"

Test: extractTextContent handles no text blocks
  Given: entry.message.content = [{ type: "image", ... }]
  Expect: returns ""
```

---

#### S-7: Phase 1 - Verification Missing Test Commands

**Location:** Phase 1, Verification section

**Problem:** Verification criteria are manual checks. For TDD setup, there should be a failing test that proves the skeleton is in place.

**Fix Required:** Add:
- [ ] `npm run test -- compression` runs without import errors (tests fail with NotImplementedError)
- [ ] TypeScript compiles: `npm run typecheck` passes

---

### Nice to Have Issues

Minor improvements that would make specs clearer.

#### N-1: Phase 2 - Inconsistent Test Case Numbering

**Problem:** Phase 2 lists TC-03, TC-04, TC-05, TC-10 but not TC-01, TC-02, TC-06-09. This is intentional (those are in later phases) but could confuse.

**Suggestion:** Add a note: "TC-01, TC-02, TC-06-09 are covered in Phase 4 (Batch Processing)"

---

#### N-2: Phase 1 - No Example Request/Response

**Suggestion:** Include sample curl commands for verification:
```bash
# Should return 501
curl -X POST http://localhost:3000/api/v2/clone \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "550e8400-e29b-41d4-a716-446655440000"}'

# Should return 400 (overlapping bands)
curl -X POST http://localhost:3000/api/v2/clone \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "...", "compressionBands": [{"start":0,"end":50,"level":"compress"},{"start":40,"end":60,"level":"compress"}]}'
```

---

#### N-3: Phase 2 - CompressionConfig Not Defined

**Location:** Phase 2, Section 7 (compressMessages)

**Problem:** References `CompressionConfig` type but it's not defined in Phase 1 types.

**Suggestion:** Either add to Phase 1 types or clarify that this is an implementation detail to be determined.

---

## Specific Corrections Needed

### Phase 1 Corrections

1. **Add NotImplementedError** to src/errors.ts stub
2. **Add Turn interface** to src/types.ts
3. **Enumerate all 7 compression.ts function stubs** with signatures
4. **Add CompressionConfig interface** to types
5. **Provide complete test fixture content** - at minimum, the JSONL structure
6. **Add validateNonOverlappingBands implementation** or reference
7. **Add test command verification** criterion

### Phase 2 Corrections

1. **Provide actual test code** (inline or in archive file)
2. **Add edge case examples** for turn mapping algorithm
3. **Specify Turn type structure** or reference Phase 1
4. **Clarify how entryType is determined** in createCompressionTasks
5. **Add detailed applyCompressedContent behavior** matching tech design
6. **Add test assertions for extractTextContent**
7. **Note which TCs are deferred** to later phases

---

## Consistency Check: Feature Spec Alignment

### Covered ACs
- AC-1: v2 endpoint - Phase 1 creates route
- AC-2: band specification - Phase 1 types
- AC-3: non-contiguous bands - Phase 2 TC-03
- AC-4: overlapping rejection - Phase 1 verification
- AC-8: minimum token threshold - Phase 2 TC-05
- AC-13: turn cohesion - Phase 2 TC-04
- AC-14: band boundary alignment - Phase 2 algorithm

### Deferred ACs (OK - later phases)
- AC-7: actual compression (Phase 4+)
- AC-9/10: compression levels (Phase 4+)
- AC-15-18: batch processing (Phase 4+)
- AC-19: thinking mode (Phase 6+)
- AC-20-21: response format (Phase 8+)
- AC-23-24: configuration (Phase 6+)

### Missing Coverage
- AC-5: toolRemoval/thinkingRemoval independence - needs test in Phase 8
- AC-6: v1 unchanged - Phase 1 verification exists but Phase 2 should add v1 regression test
- AC-12: Zod validation of LLM response - mentioned in tech design, not in phase specs

---

## Overall Assessment

**Phase 1: 6/10** - Good structure, but missing critical details for test fixtures and stub enumeration. A developer would need to make assumptions.

**Phase 2: 5/10** - The TDD approach is correct, but the "archived" test code reference is a blocker. The algorithm specification needs more precision.

**Recommendation:** Fix all Blocking issues before dispatching to coding agents. Should-fix issues can be addressed as clarifications during implementation, but ideally would be fixed beforehand.

---

## Appendix: Questions for Clarification

1. Does `identifyTurns()` already exist in the codebase? If so, what is its return type?
2. What is the exact JSONL structure of a session file? Is there documentation or an example file?
3. Is `SessionEntry` already defined? Where?
4. The tech design mentions `lineage-logger.ts` modifications - should these be in Phase 1 skeleton?
5. Should Phase 1 include the environment variable configuration, or is that Phase 6+?
