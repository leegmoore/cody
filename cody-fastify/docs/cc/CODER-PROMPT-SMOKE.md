# CODER PROMPT: Core 2.0 Smoke Tests - Real API Integration

**Generated:** 2025-01-22
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`

---

## ROLE

You are a senior TypeScript/Node.js developer implementing **smoke tests** for the Core 2.0 streaming architecture using REAL LLM API calls. These tests validate that our mocked fixtures accurately reflect actual provider behavior and that the full pipeline works with real streaming responses.

---

## PROJECT CONTEXT

**Cody Core 2.0** has 22 passing tests with mocked LLM responses. We now need a small suite of **real API integration tests** to:
1. Validate fixtures match real provider responses
2. Catch API schema drift
3. Verify real streaming (not just mocked chunks)
4. Provide pre-deployment smoke test

**Current Coverage:**
- ✅ 16 mocked integration tests (happy path + errors + edge cases)
- ❌ 0 real API tests

---

## CURRENT PHASE

**Phase:** Core 2.0 Smoke Tests
**Objective:** Implement 6 smoke tests with REAL API calls

**FUNCTIONAL OUTCOME:**
After this phase, we can run smoke tests against real OpenAI and Anthropic APIs to validate the pipeline works with actual provider streaming, not just mocked fixtures. This provides confidence before production deployment.

---

## CRITICAL CONSTRAINTS

### **Everything is REAL (No Mocks Except Tools):**

**REAL:**
- ✅ OpenAI API calls (costs ~$0.005 per test)
- ✅ Anthropic API calls (costs ~$0.005 per test)
- ✅ Redis, Convex, Fastify, workers
- ✅ Streaming responses from providers

**MOCKED (Safety):**
- ✅ Tool implementations only (readFile, exec - don't touch real filesystem)

**Cost per full run:** ~$0.03 (acceptable for weekly runs, not CI)

---

## PREREQUISITES

✅ **Test Coverage:**
- 16 mocked tests passing
- Test harness proven

✅ **API Keys Available:**
- OPENAI_API_KEY in environment
- ANTHROPIC_API_KEY in environment

✅ **Test Conditions:**
- `docs/cc/test-conditions-smoke-tests.md`

---

## STATE LOADING (READ THESE FIRST)

1. **Smoke Test Conditions:** `docs/cc/test-conditions-smoke-tests.md`
   - Read all 6 test scenarios
   - Note: No fixtures (uses real APIs)
   - Understand validation strategy

2. **Existing Tests:** `tests/e2e/core-2.0/happy-path.spec.ts`
   - Review test structure
   - Note harness usage patterns

3. **Mock Tools:** `tests/e2e/core-2.0/mock-tools.ts`
   - Reuse for smoke tests (still mock tool implementations)

---

## TASK SPECIFICATION

Implement **6 smoke tests** with real API calls.

### **Deliverables:**

1. **Harness Enhancement** (`tests/harness/core-harness.ts`) - ~50 lines
   - Add `useRealProviders` option to constructor
   - When true, use `DefaultModelFactory` instead of `MockModelFactory`
   - Pass real API keys from environment

2. **Smoke Test Suite** (`tests/e2e/smoke/real-api.spec.ts`) - ~400 lines
   - NEW directory: tests/e2e/smoke/
   - 6 test cases: TC-SMOKE-01 through TC-SMOKE-06
   - Use harness with `useRealProviders: true`
   - Conditional skip if API keys missing
   - Serial execution (avoid rate limits)

3. **Environment Example** (`.env.test.example`) - ~10 lines
   - Document required API keys
   - Show example format
   - Note cost considerations

4. **Package Script** (`package.json`) - 1 line
   - Add `"test:smoke": "vitest run tests/e2e/smoke/"`
   - Separate from regular test suite

**Effort Estimate:** ~500 lines total

---

## WORKFLOW STEPS

1. **Modify Harness for Real Providers**
   ```typescript
   // tests/harness/core-harness.ts
   export interface Core2TestHarnessOptions {
     useRealProviders?: boolean;
   }

   constructor(options: Core2TestHarnessOptions = {}) {
     if (options.useRealProviders) {
       this.factory = new DefaultModelFactory({
         openai: {apiKey: process.env.OPENAI_API_KEY},
         anthropic: {apiKey: process.env.ANTHROPIC_API_KEY}
       });
     } else {
       this.factory = new MockModelFactory({...});
     }
   }
   ```

2. **Create Smoke Test Directory**
   ```bash
   mkdir -p tests/e2e/smoke
   touch tests/e2e/smoke/real-api.spec.ts
   ```

3. **Implement TC-SMOKE-01 (OpenAI Basic)**
   - Check for OPENAI_API_KEY
   - Submit with real provider
   - Consume real SSE stream
   - Validate response structure
   - Run: `npx vitest run tests/e2e/smoke/real-api.spec.ts -t "TC-SMOKE-01"`

4. **Verify Real Streaming**
   - Add logging to see actual events from OpenAI
   - Verify StreamEvent schema matches
   - Verify timing (real streams are slower than mocked)

5. **Implement Remaining Tests**
   - TC-SMOKE-02: Anthropic basic
   - TC-SMOKE-03: OpenAI thinking
   - TC-SMOKE-04: Anthropic thinking
   - TC-SMOKE-05: OpenAI tool call
   - TC-SMOKE-06: Cross-provider parity

6. **Add Conditional Execution**
   ```typescript
   const hasOpenAI = !!process.env.OPENAI_API_KEY;
   const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

   it.skipIf(!hasOpenAI)('OpenAI test', async () => {...});
   it.skipIf(!hasAnthropic)('Anthropic test', async () => {...});
   ```

7. **Add Serial Execution**
   ```typescript
   describe.sequential('Smoke Tests', () => {
     // Tests run one at a time (avoid rate limits)
   });
   ```

8. **Run Full Smoke Suite**
   ```bash
   npx vitest run tests/e2e/smoke/
   ```

9. **Document Results**

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **Tests must skip gracefully if keys missing**
   - Use `it.skipIf(!hasKey)` pattern
   - Don't fail if developer doesn't have API keys
   - Log skip reason

2. **Serial execution required**
   - Use `describe.sequential` or manual delays
   - Avoid rate limits (OpenAI: 500 RPM, Anthropic: 50 RPM)
   - Add 1-2 second delays between tests if needed

3. **Longer timeouts for real APIs**
   - Default test timeout: 5s (too short)
   - Smoke test timeout: 30s per test
   - Tool execution tests: 60s (account for real tool + LLM call)

4. **Flexible assertions (real responses vary)**
   - Don't assert exact content
   - Assert structure, types, lengths
   - Use regex or contains checks

5. **Document cost and usage**
   - Note token usage in TEST_RESULTS.md
   - Document cost per run
   - Recommend run frequency (weekly, not per-commit)

### **INTERRUPT PROTOCOL**

**STOP and ask if:**
- Real API responses don't match expected schema
- Rate limits hit even with serial execution
- API keys format is unclear
- Cross-provider parity test approach is ambiguous

**DO NOT:**
- Run smoke tests in CI (too expensive, too slow)
- Add to regular `npm test` (keep separate)
- Mock providers (defeats the purpose)

---

## STREAMING VALIDATION (CRITICAL)

### **Verify Real Streaming Works:**

The smoke tests MUST validate actual streaming behavior, not just final results.

**Add explicit streaming checks:**

```typescript
test('TC-SMOKE-01: OpenAI streaming', async () => {
  const {runId, streamUrl} = await harness.submit({...});

  // Track events as they arrive
  const eventTypes: string[] = [];
  const eventTimestamps: number[] = [];

  const events = await harness.consumeSSE(streamUrl, {
    onEvent: (event) => {
      eventTypes.push(event.type);
      eventTimestamps.push(event.timestamp);
    }
  });

  // Verify streaming (not batch)
  expect(eventTypes).toContain('item_delta');  // Deltas present (streaming)
  expect(eventTypes.length).toBeGreaterThan(3);  // Multiple events

  // Verify events arrived over time (not all at once)
  const firstTimestamp = eventTimestamps[0];
  const lastTimestamp = eventTimestamps[eventTimestamps.length - 1];
  const duration = lastTimestamp - firstTimestamp;

  expect(duration).toBeGreaterThan(100);  // At least 100ms streaming duration

  // Verify event order
  expect(eventTypes[0]).toBe('response_start');
  expect(eventTypes[eventTypes.length - 1]).toBe('response_done');
});
```

**This validates:**
- ✅ Real streaming (not batch response)
- ✅ Events arrive incrementally
- ✅ Event order correct
- ✅ Deltas exist (confirming streaming, not single chunk)

---

## HARNESS ENHANCEMENT FOR STREAMING VALIDATION

**Add callback support to consumeSSE:**

```typescript
// tests/harness/core-harness.ts

export interface ConsumeSSEOptions {
  onEvent?: (event: StreamEvent) => void;
  timeout?: number;
}

async consumeSSE(
  streamUrl: string,
  options: ConsumeSSEOptions = {}
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  const fullUrl = `${this.baseUrl}${streamUrl}`;

  return new Promise((resolve, reject) => {
    const source = new EventSource(fullUrl);

    source.onmessage = (e) => {
      const event = JSON.parse(e.data);
      events.push(event);

      // NEW: callback for streaming validation
      options.onEvent?.(event);

      if (event.type === 'response_done') {
        source.close();
        resolve(events);
      }
    };

    // ... error handling, timeout
  });
}
```

**This allows tests to observe streaming behavior in real-time.**

---

## CODE QUALITY STANDARDS

### **Mandatory Quality Gates:**

- ✅ TypeScript: Zero errors (`npx tsc --noEmit`)
- ✅ ESLint: Zero errors (`npm run lint`)
- ✅ Smoke tests: Pass with real API keys
- ✅ Smoke tests: Skip gracefully without API keys

### **Verification Command:**
```bash
npm run format && npm run lint && npx tsc --noEmit

# Only run if you have API keys
npm run test:smoke
```

---

## SESSION COMPLETION CHECKLIST

1. ✅ **Run verification command**

2. ✅ **Document smoke test results:**
   ```markdown
   ## Smoke Tests - Real API Integration

   **Status:** X/6 passing (Y skipped - missing API keys)

   | Test | Status | Tokens | Cost | Notes |
   |------|--------|--------|------|-------|
   | TC-SMOKE-01: OpenAI basic | ✅ | 15 | $0.0001 | - |
   | TC-SMOKE-02: Anthropic basic | ✅ | 18 | $0.0002 | - |
   | TC-SMOKE-03: OpenAI thinking | ✅ | 145 | $0.001 | - |
   | ... | ... | ... | ... | ... |

   **Total Cost This Run:** ~$0.02
   **Recommended Frequency:** Weekly or before releases
   ```

3. ✅ **Commit work:**
   ```bash
   git add -A
   git commit -m "feat(test): implement smoke tests with real API integration

   Added 6 smoke tests validating pipeline with real LLM providers.

   Tests use REAL APIs (not mocked):
   - TC-SMOKE-01 to TC-SMOKE-06
   - OpenAI and Anthropic
   - Validates streaming behavior, not just results
   - Catches fixture drift and schema changes

   Harness enhanced:
   - useRealProviders option for DefaultModelFactory
   - Callback support in consumeSSE for streaming validation
   - Conditional skip if API keys missing

   Cost: ~$0.02 per run (acceptable for weekly regression)

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

4. ✅ **Report summary:**
   - Smoke tests passing
   - Token usage and cost
   - Any schema drift found
   - Streaming validation results

---

## STARTING POINT

**BEGIN by:**

1. Reading smoke test conditions
2. Enhancing harness with useRealProviders option
3. Implementing TC-SMOKE-01 (OpenAI basic)
4. Verifying real streaming works (check event timestamps, deltas exist)
5. Implementing remaining 5 tests
6. Documenting cost and token usage

**Focus on validating STREAMING behavior, not just final results.**

---

## EXPECTED OUTCOME

After this session:
- ✅ 6 smoke tests implemented
- ✅ Real OpenAI streaming validated
- ✅ Real Anthropic streaming validated
- ✅ Provider parity confirmed
- ✅ Streaming mechanics validated (deltas, timing, order)
- ✅ Total: 28 tests (22 mocked + 6 smoke)

---

## STREAMING VALIDATION REQUIREMENTS

**Each smoke test MUST verify:**

1. **Events arrive incrementally** (not batch)
   - Check timestamps show progression
   - Verify duration > 100ms (real network latency)

2. **Deltas exist** (confirming streaming)
   - At least 1 item_delta event present
   - Content builds incrementally

3. **Event order correct**
   - response_start first
   - response_done last
   - item_start before item_delta
   - item_delta before item_done

4. **Schema compliance**
   - All events match StreamEventSchema
   - No unexpected fields
   - All required fields present

**This ensures we're testing REAL streaming, not just that the API returns a result.**
