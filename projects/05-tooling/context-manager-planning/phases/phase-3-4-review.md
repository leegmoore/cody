# Phase 3 & 4 Specification Review

**Review Date:** 2025-12-03
**Reviewer:** Planning Agent (Claude Opus 4.5)
**Documents Reviewed:**
- Phase 3: `phase-3-batch-processing.md`
- Phase 4: `phase-4-openrouter-client.md`
- Feature Spec: `01-message-compression.feature.md`
- Tech Design: `02-message-compression.tech-design.md`
- Implemented Code: `coding-agent-manager/src/services/*`

---

## Executive Summary

**Overall Assessment: NEEDS WORK**

Both specifications are functional but incomplete. They provide high-level guidance but lack the detail necessary for a coding agent to implement without guessing. The most significant gaps are:

1. Missing test specifications with concrete inputs/outputs/assertions
2. Incomplete algorithm specification for batch processing retry logic
3. Missing AbortSignal integration details for timeout handling
4. No specification for how `compressMessages()` integrates with the batch processor

These issues are not blocking but will likely cause implementation friction and potential back-and-forth clarification.

---

## Issues by Severity

### BLOCKING (0 issues)

None. The specifications are implementable, but require developer interpretation.

### SHOULD FIX (8 issues)

#### SF-1: Phase 3 - Missing Test Specifications

**Location:** `phase-3-batch-processing.md`, TDD Red section

**Problem:** The spec lists test condition references (TC-01, TC-02, TC-06, TC-07, TC-13) but provides no concrete test specifications. A coding agent needs:
- Input data (mock tasks, mock client responses)
- Expected outputs (task states, result values)
- Assertions to verify

**Current:**
```markdown
### TC-01: Basic Compression Band
### TC-02: Heavy Compression Band
### TC-06: Compression Timeout and Retry
### TC-07: Maximum Retry Exceeded
### TC-13: Parallel Batch Processing
```

**Required:** Full test specifications like those in Phase 2's `compression-core.test.ts`.

**Suggested Fix:** Add complete test case specifications:

```markdown
### TC-01: Basic Compression Band

**Setup:**
- 3 compression tasks at "compress" level (35% target)
- Mock OpenRouterClient returns `{"text": "compressed"}` for all

**Input:**
```typescript
const tasks: CompressionTask[] = [
  { messageIndex: 0, level: "compress", originalContent: "x".repeat(200), estimatedTokens: 50, attempt: 0, timeoutMs: 5000, status: "pending" },
  { messageIndex: 1, level: "compress", originalContent: "x".repeat(400), estimatedTokens: 100, attempt: 0, timeoutMs: 5000, status: "pending" },
  { messageIndex: 2, level: "compress", originalContent: "x".repeat(600), estimatedTokens: 150, attempt: 0, timeoutMs: 5000, status: "pending" },
];
```

**Expected:**
- All 3 tasks have status: "success"
- All 3 tasks have result: "compressed"
- Mock client.compress() called 3 times with level "compress"

**Assertions:**
```typescript
expect(results.filter(t => t.status === "success")).toHaveLength(3);
expect(mockClient.compress).toHaveBeenCalledTimes(3);
expect(mockClient.compress).toHaveBeenCalledWith(expect.any(String), "compress", false);
```
```

---

#### SF-2: Phase 3 - Incomplete Retry Algorithm

**Location:** `phase-3-batch-processing.md`, TDD Green section

**Problem:** The retry logic is described at a high level but lacks critical details:
- When does a task move from pending to the next batch?
- How is "failed" determined (exception? specific error type?)
- Is there a distinction between timeout and API error?
- What happens if a task succeeds on retry?

**Current:**
```markdown
- Failed tasks: increment attempt, increase timeout, add to next batch
- After max attempts: mark failed, log warning
```

**Suggested Fix:** Provide explicit state machine:

```markdown
### Retry State Machine

**States:** pending -> (processing) -> success | retry | failed

**Transitions:**
1. pending -> processing: Task picked up for current batch
2. processing -> success: `client.compress()` returns without throwing
3. processing -> retry: `client.compress()` throws OR times out, AND attempt < maxAttempts
4. processing -> failed: `client.compress()` throws OR times out, AND attempt >= maxAttempts

**On retry transition:**
- task.attempt++
- task.timeoutMs = TIMEOUT_PROGRESSION[task.attempt] (capped at last value)
- task.status remains "pending" (goes to next batch)

**On failed transition:**
- task.status = "failed"
- task.error = error message
- Log warning: `Compression failed after ${maxAttempts} attempts: ${error}`
```

---

#### SF-3: Phase 3 - Missing AbortSignal Integration

**Location:** `phase-3-batch-processing.md`, `compressWithTimeout` implementation

**Problem:** The implementation sketch creates an AbortController but never passes the signal to the client. The OpenRouterClient.compress() signature has no signal parameter.

**Current:**
```typescript
async function compressWithTimeout(task, client) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), task.timeoutMs);

  try {
    const useThinking = task.estimatedTokens > 1000;
    const result = await client.compress(task.originalContent, task.level, useThinking);
    // ...
```

**Problem:** `controller` is created but `controller.signal` is never used.

**Suggested Fix:** Either:

1. Add signal parameter to compress():
```typescript
// In openrouter-client.ts
async compress(text: string, level: CompressionLevel, useThinking: boolean, signal?: AbortSignal): Promise<string>

// In compression-batch.ts
const result = await client.compress(task.originalContent, task.level, useThinking, controller.signal);
```

2. Or use Promise.race pattern:
```typescript
async function compressWithTimeout(task, client) {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Compression timeout")), task.timeoutMs);
  });

  try {
    const useThinking = task.estimatedTokens > 1000;
    const result = await Promise.race([
      client.compress(task.originalContent, task.level, useThinking),
      timeoutPromise,
    ]);
    return { ...task, status: "success", result };
  } catch (error) {
    return { ...task, status: "failed", error: error.message };
  }
}
```

---

#### SF-4: Phase 3 - Missing `compressMessages()` Integration

**Location:** `phase-3-batch-processing.md`

**Problem:** Phase 3 implements `processBatches()` and `compressWithTimeout()` but does not specify how `compressMessages()` in `compression.ts` should be updated to call the batch processor. Currently `compressMessages()` is stubbed and returns entries unchanged.

**Suggested Fix:** Add section:

```markdown
### Update compressMessages() Integration

After implementing batch processing, update `src/services/compression.ts`:

```typescript
import { processBatches, BatchConfig } from "./compression-batch.js";
import { OpenRouterClient } from "./openrouter-client.js";

export async function compressMessages(
  entries: SessionEntry[],
  turns: Turn[],
  bands: CompressionBand[],
  config: CompressionConfig,
  client: OpenRouterClient  // Add client parameter
): Promise<{ entries: SessionEntry[]; stats: CompressionStats }> {
  if (bands.length === 0) {
    // ... existing empty bands handling
  }

  const mapping = mapTurnsToBands(turns, bands);
  const tasks = createCompressionTasks(entries, turns, mapping, config.minTokens);

  // NEW: Process tasks through batch processor
  const batchConfig: BatchConfig = {
    concurrency: config.concurrency,
    maxAttempts: config.maxAttempts,
  };
  const completedTasks = await processBatches(tasks, client, batchConfig);

  // Apply results and calculate stats
  const compressedEntries = applyCompressionResults(entries, completedTasks);

  const stats = calculateStats(tasks, completedTasks);
  return { entries: compressedEntries, stats };
}
```
```

---

#### SF-5: Phase 4 - Missing JSON Extraction Details

**Location:** `phase-4-openrouter-client.md`, `validateResponse` section

**Problem:** The spec mentions "Strip markdown code blocks if present" but doesn't specify how. LLMs often return:
- `{"text": "..."}` (clean JSON)
- ` ```json\n{"text": "..."}\n``` ` (markdown code block)
- `Here is the compressed text:\n{"text": "..."}` (with preamble)

**Current:**
```typescript
private validateResponse(response): string {
  // Strip markdown code blocks if present
  // Parse JSON
  // Validate with CompressionResponseSchema
  // Return response.text
}
```

**Suggested Fix:**

```markdown
### JSON Extraction Algorithm

```typescript
private extractJSON(raw: string): string {
  // 1. Try to find JSON in markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 2. Try to find raw JSON object
  const jsonMatch = raw.match(/\{[\s\S]*"text"[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // 3. Return as-is (will fail Zod validation, triggering retry)
  return raw;
}

private validateResponse(raw: string): string {
  const jsonStr = this.extractJSON(raw);
  const parsed = JSON.parse(jsonStr);
  const validated = CompressionResponseSchema.parse(parsed);
  return validated.text;
}
```
```

---

#### SF-6: Phase 4 - Missing HTTP Error Handling

**Location:** `phase-4-openrouter-client.md`, `callAPI` section

**Problem:** No specification for handling HTTP errors (rate limits, 500s, auth failures).

**Suggested Fix:**

```markdown
### HTTP Error Handling

```typescript
private async callAPI(prompt: string, model: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://coding-agent-manager.local",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content ?? "";
}
```

**Error mapping for tests:**
- 401 -> "OpenRouter API error 401: Invalid API key"
- 429 -> "OpenRouter API error 429: Rate limited" (will trigger retry)
- 500 -> "OpenRouter API error 500: Internal server error" (will trigger retry)
```

---

#### SF-7: Phase 4 - Thinking Mode Model Suffix Inconsistency

**Location:** `phase-4-openrouter-client.md` and tech design

**Problem:** The spec says "uses `:thinking` suffix" but the tech design says the model is `google/gemini-2.5-flash:thinking`. The actual implementation pattern is unclear - is it:
- Append `:thinking` to any model? (`google/gemini-2.5-flash` -> `google/gemini-2.5-flash:thinking`)
- Use a separate configured model? (`modelThinking` config)

The implemented `OpenRouterClient` has both `model` and `modelThinking` properties, suggesting separate models.

**Current implementation:**
```typescript
export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  modelThinking: string;  // <-- Separate model
}
```

**Suggested Fix:** Clarify in Phase 4 spec:

```markdown
### Model Selection

The client uses two pre-configured models:
- `model`: Used for normal compression (messages <= 1000 tokens)
- `modelThinking`: Used for thinking mode (messages > 1000 tokens)

```typescript
async compress(text: string, level: CompressionLevel, useThinking: boolean): Promise<string> {
  const model = useThinking ? this.modelThinking : this.model;
  // ...
}
```

Configuration example:
```env
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_MODEL_THINKING=google/gemini-2.5-flash:thinking
```
```

---

#### SF-8: Phase 3 - Timeout Progression Array Inconsistency

**Location:** `phase-3-batch-processing.md` vs tech design

**Problem:** The timeout progression is specified differently:
- Phase 3 spec: `[5000, 10000, 15000, 15000]`
- Tech design: `[5000, 10000, 15000, 15000]` (matches)
- Tech design config: `timeoutInitial=5000`, `timeoutIncrement=5000`

These are consistent, but the relationship between the config and the array is not explicit. Is the array hardcoded or derived from config?

**Suggested Fix:** Clarify in Phase 3:

```markdown
### Timeout Calculation

Timeout is calculated from config, not hardcoded:

```typescript
function getTimeout(attempt: number, config: CompressionConfig): number {
  // attempt 0: timeoutInitial (5000)
  // attempt 1: timeoutInitial + timeoutIncrement (10000)
  // attempt 2: timeoutInitial + 2*timeoutIncrement (15000)
  // attempt 3: timeoutInitial + 2*timeoutIncrement (15000) - capped
  const maxTimeout = config.timeoutInitial + 2 * config.timeoutIncrement;
  return Math.min(
    config.timeoutInitial + attempt * config.timeoutIncrement,
    maxTimeout
  );
}
```
```

---

### NICE TO HAVE (4 issues)

#### N2H-1: Add Logging Specification

**Problem:** Both phases mention "log warning" but don't specify the logging mechanism or format.

**Suggestion:** Add:
```markdown
### Logging

Use `console.warn` for failure logging (can be replaced with proper logger later):

```typescript
console.warn(`[compression] Task ${task.messageIndex} failed after ${task.attempt} attempts: ${task.error}`);
```
```

---

#### N2H-2: Add Mock Setup Examples

**Problem:** The specs say "Mock OpenRouterClient" and "Mock global.fetch" but don't show the mock setup patterns that align with the project's existing test structure.

**Suggestion:** Add mock setup examples based on existing `compression-core.test.ts` patterns:

```typescript
// Mock OpenRouterClient for batch tests
const mockClient = {
  compress: vi.fn().mockResolvedValue("compressed text"),
};

// For timeout test
mockClient.compress.mockImplementationOnce(() =>
  new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 100))
);
```

---

#### N2H-3: Add Statistics Calculation Details

**Problem:** Phase 3 doesn't specify how to calculate `compressedTokens` and `reductionPercent` from completed tasks.

**Suggestion:** Add:
```typescript
function calculateStats(originalTasks: CompressionTask[], completedTasks: CompressionTask[]): CompressionStats {
  const successful = completedTasks.filter(t => t.status === "success");
  const failed = completedTasks.filter(t => t.status === "failed");

  const originalTokens = originalTasks.reduce((sum, t) => sum + t.estimatedTokens, 0);
  const compressedTokens = successful.reduce((sum, t) =>
    sum + estimateTokens(t.result ?? ""), 0);

  return {
    messagesCompressed: successful.length,
    messagesSkipped: originalTasks.length - completedTasks.length,
    messagesFailed: failed.length,
    originalTokens,
    compressedTokens,
    tokensRemoved: originalTokens - compressedTokens,
    reductionPercent: originalTokens > 0
      ? Math.round(((originalTokens - compressedTokens) / originalTokens) * 100)
      : 0,
  };
}
```

---

#### N2H-4: Add End-to-End Test Specification

**Problem:** Neither phase specifies how to verify the full integration (Route -> Service -> BatchProcessor -> Client). This would be helpful for Phase 5 (integration).

**Suggestion:** Add a forward reference:

```markdown
### Integration Test (Phase 5)

After Phase 4, create integration test:
- Mock only `global.fetch`
- Call `POST /api/v2/clone` with compression bands
- Verify session file written with compressed content
- Verify response statistics accurate
```

---

## Consistency Check

### Feature AC Alignment

| AC | Phase 3 | Phase 4 | Status |
|----|---------|---------|--------|
| AC-15: Parallel batches | Yes | - | OK |
| AC-16: Timeout (5s) | Yes | - | OK |
| AC-17: Retry with increased timeout | Yes | - | OK |
| AC-18: Max retries (4) | Yes | - | OK |
| AC-19: Thinking mode >1000 tokens | Yes | Yes | OK |
| AC-11: Zod validation | - | Yes | OK |
| AC-12: Malformed response retry | - | Yes | OK |
| AC-23: API key config | - | Yes | OK |

### Tech Design Alignment

| Tech Design Element | Phase 3 | Phase 4 | Status |
|---------------------|---------|---------|--------|
| `processBatches()` signature | Yes | - | OK |
| `compressWithTimeout()` signature | Yes | - | OK |
| `OpenRouterClient` class | - | Yes | OK |
| `compress()` method | - | Yes | OK |
| `buildPrompt()` method | - | Yes | OK |
| `callAPI()` method | - | Partial | Missing error handling |
| `validateResponse()` method | - | Partial | Missing extraction logic |
| Prompt template | - | Yes | OK |

### Phase 1-2 Consistency

| Element | Phase 1-2 Implementation | Phase 3-4 Spec | Status |
|---------|--------------------------|----------------|--------|
| `CompressionTask` type | Complete | References correctly | OK |
| `CompressionConfig` type | Complete | References correctly | OK |
| `estimateTokens()` | Implemented | Not needed (Phase 2) | OK |
| `createCompressionTasks()` | Implemented | Not needed (Phase 2) | OK |
| `compressMessages()` | Stub (returns unchanged) | Needs update for integration | NEEDS UPDATE |
| `OpenRouterClient` | Stub | Phase 4 implements | OK |
| `processBatches()` | Stub | Phase 3 implements | OK |

---

## Specific Corrections Required

### Phase 3 Corrections

1. **Add full test specifications** for TC-01, TC-02, TC-06, TC-07, TC-13 with inputs, outputs, and assertions.

2. **Specify retry state machine** with explicit state transitions and conditions.

3. **Fix AbortSignal integration** - either add signal parameter to `compress()` or use `Promise.race` pattern.

4. **Add `compressMessages()` integration** - show how the stub in compression.ts should be updated.

5. **Clarify timeout calculation** from config values vs hardcoded array.

### Phase 4 Corrections

1. **Add JSON extraction logic** for handling markdown code blocks and preamble text.

2. **Add HTTP error handling** with specific error cases and messages.

3. **Clarify thinking mode model selection** - two separate models vs suffix appending.

4. **Add mock setup examples** for global.fetch.

---

## Overall Assessment

**Readiness for Implementation:** 70%

The specifications provide a clear high-level direction and are aligned with the feature requirements and tech design. However, they lack the specificity needed for a coding agent to implement without interpretation.

**Risk Areas:**
1. **Test implementation** - Without concrete test specs, the agent will write tests that may not match intent
2. **Timeout handling** - The AbortSignal gap could lead to timeouts not actually working
3. **JSON parsing** - LLM output variability could cause unexpected failures

**Strengths:**
1. Clear module boundaries
2. Good alignment with feature ACs
3. Consistent with existing Phase 1-2 implementation patterns
4. Prompt template well-specified

---

## Recommendation

**Do not proceed with implementation until SHOULD FIX issues are addressed.**

Priority order for fixes:
1. SF-1: Add test specifications (highest impact)
2. SF-3: Fix AbortSignal integration (correctness)
3. SF-4: Add compressMessages() integration (completeness)
4. SF-2: Complete retry algorithm (clarity)
5. SF-5, SF-6: JSON extraction and HTTP errors (robustness)
6. SF-7, SF-8: Config clarifications (consistency)

Estimated effort to fix specs: 1-2 hours

After fixes, the specifications will be ready for a coding agent to implement Phase 3-4 in approximately 3-4 hours each.
