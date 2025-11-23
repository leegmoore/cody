# Core 2.0 Smoke Tests - Real API Integration

**Version:** 1.0
**Status:** Ready for Implementation
**Purpose:** Validate Core 2.0 pipeline with REAL LLM API calls (no mocks)
**Scope:** 6 critical tests covering each provider and capability

---

## Test Philosophy

**Everything is REAL:**
- ✅ Real OpenAI API calls (costs money)
- ✅ Real Anthropic API calls (costs money)
- ✅ Real Redis, Convex, Fastify, workers
- ✅ Real tool execution (mocked tool handlers for safety)
- ❌ NO mocks except tool implementations

**Purpose:**
- Validate mocked fixtures match real API behavior
- Catch provider API changes or schema drift
- Verify actual streaming from providers works
- Smoke test before deployment

**When to run:**
- Before major releases
- After provider API updates
- Weekly/monthly regression check
- NOT in continuous development loop (too slow, costs money)

---

## Test Conditions

### **TC-SMOKE-01: OpenAI Basic Message (Real API)**

**Given:**
- User prompt: "Say hello in one sentence"
- Model: gpt-5-mini
- Provider: openai
- **Real API key** from environment (OPENAI_API_KEY)

**Expected Result:**
- Response status: "completed"
- At least 1 message output_item
- Usage metrics populated

**Verification Points:**
- ✅ Real API call succeeds
- ✅ SSE stream from OpenAI parses correctly
- ✅ Events match StreamEvent schema
- ✅ Adapter normalization works with real chunks
- ✅ Response persists to Convex
- ✅ Hydration matches persistence

**No Fixture** - Uses real OpenAI Responses API

---

### **TC-SMOKE-02: Anthropic Basic Message (Real API)**

**Given:**
- User prompt: "Say hello in one sentence"
- Model: claude-haiku-4.5
- Provider: anthropic
- **Real API key** from environment (ANTHROPIC_API_KEY)

**Expected Result:**
- Response status: "completed"
- At least 1 message output_item
- Usage metrics populated

**Verification Points:**
- ✅ Real Anthropic API call succeeds
- ✅ Messages API chunks normalize to StreamEvents
- ✅ Provider-agnostic: Same test, different provider, same result structure
- ✅ Response persists correctly

**No Fixture** - Uses real Anthropic Messages API

---

### **TC-SMOKE-03: OpenAI Thinking + Message (Real API)**

**Given:**
- User prompt: "What is 7 * 8? Think step by step."
- Model: gpt-5-mini (with thinking enabled)
- Provider: openai

**Expected Result:**
- Response status: "completed"
- At least 2 output_items: reasoning + message
- Reasoning content contains thinking process
- Message content contains answer (56)

**Verification Points:**
- ✅ Real thinking blocks stream from OpenAI
- ✅ reasoning items created correctly
- ✅ Order preserved (thinking before message)
- ✅ Both items persist

**No Fixture** - Uses real OpenAI Responses API with thinking

---

### **TC-SMOKE-04: Anthropic Thinking + Message (Real API)**

**Given:**
- User prompt: "What is 7 * 8? Think step by step."
- Model: claude-haiku-4.5
- Provider: anthropic

**Expected Result:**
- Response status: "completed"
- At least 2 output_items: reasoning + message
- Both providers handle thinking identically (canonical format)

**Verification Points:**
- ✅ Anthropic thinking blocks normalize correctly
- ✅ Provider parity: OpenAI and Anthropic produce same structure
- ✅ Cross-provider compatibility validated

**No Fixture** - Uses real Anthropic Messages API

---

### **TC-SMOKE-05: OpenAI Tool Call (Real API)**

**Given:**
- User prompt: "Read the package.json file"
- Model: gpt-5-codex
- Provider: openai
- ToolWorker running with mocked readFile handler

**Expected Result:**
- Response status: "completed"
- 3 output_items: function_call, function_call_output, message
- function_call requests readFile
- function_call_output from ToolWorker (mocked)
- Message references file content

**Verification Points:**
- ✅ Real OpenAI returns function_call
- ✅ ToolWorker processes and emits output
- ✅ Full tool execution flow works
- ✅ LLM doesn't need to be called again (message in same turn)

**Note:** This tests single-turn tool use. Multi-step tool loops deferred.

**No Fixture** - Real API, mocked tool implementation

---

### **TC-SMOKE-06: Cross-Provider Parity Check**

**Given:**
- Same prompt: "Explain recursion in 2 sentences"
- Test with ALL 3 providers:
  - openai / gpt-5-mini
  - anthropic / claude-haiku-4.5
  - (openrouter / google/gemini-2.5-flash - if implemented)

**Expected Result:**
- All 3 produce valid Response objects
- All have same structure (provider-agnostic schema)
- All persist to Convex successfully

**Verification Points:**
- ✅ Provider adapters all normalize to canonical format
- ✅ Schema is truly provider-agnostic
- ✅ No provider-specific bugs in streaming/persistence

**No Fixture** - Real APIs for all providers

---

## Implementation Approach

### **Test File: `tests/e2e/smoke/real-api.spec.ts`**

New directory to separate smoke tests from unit/integration tests.

```typescript
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {Core2TestHarness} from '../../harness/core-harness';
import {DefaultModelFactory} from '../../../src/core/model-factory';
import {installMockTools} from '../core-2.0/mock-tools';

describe('Smoke Tests - Real API Integration', () => {
  let harness: Core2TestHarness;
  let restoreTools;

  beforeAll(async () => {
    // Use REAL factory (not mock)
    harness = new Core2TestHarness({
      useRealProviders: true  // Flag to use DefaultModelFactory
    });

    // Still mock tool implementations (don't touch real filesystem)
    restoreTools = installMockTools();

    await harness.setup();
  });

  afterAll(async () => {
    restoreTools?.();
    await harness.cleanup();
  });

  // Tests require API keys in environment
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

  it.skipIf(!hasOpenAIKey)('TC-SMOKE-01: OpenAI basic message', async () => {
    const {runId, streamUrl} = await harness.submit({
      prompt: 'Say hello in one sentence',
      model: 'gpt-5-mini',
      providerId: 'openai'
    });

    const events = await harness.consumeSSE(streamUrl);
    const response = await harness.hydrate(events);

    expect(response.status).toBe('completed');
    expect(response.provider_id).toBe('openai');
    expect(response.output_items.length).toBeGreaterThan(0);
    expect(response.output_items[0].type).toBe('message');
    expect(response.usage?.total_tokens).toBeGreaterThan(0);

    const persisted = await harness.getPersistedResponse(runId);
    expect(persisted).toBeDefined();
  }, 30000);  // 30s timeout for real API

  // ... more tests
});
```

---

## Harness Modification Required

**The harness currently uses MockModelFactory.** Need to support real providers:

```typescript
// tests/harness/core-harness.ts

export interface Core2TestHarnessOptions {
  useRealProviders?: boolean;  // NEW
}

export class Core2TestHarness {
  constructor(options: Core2TestHarnessOptions = {}) {
    if (options.useRealProviders) {
      // Use DefaultModelFactory with real API keys
      this.factory = new DefaultModelFactory({
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY
        }
      });
    } else {
      // Use MockModelFactory (existing behavior)
      this.factory = new MockModelFactory({...});
    }
  }
}
```

---

## Environment Setup

### **Required Environment Variables:**

```bash
# .env.test (for smoke tests only)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...  # If testing OpenRouter

# Same as production
REDIS_URL=redis://localhost:6379
CONVEX_URL=https://your-dev-deployment.convex.cloud
```

### **Cost Considerations:**

**Per smoke test run (6 tests):**
- OpenAI (3 tests): ~$0.01 (using gpt-5-mini)
- Anthropic (2 tests): ~$0.01 (using claude-haiku-4.5)
- Total: ~$0.02 per full run

**Acceptable for:**
- Pre-release validation
- Weekly regression
- After major changes

**Too expensive for:**
- Every commit
- CI on every PR
- Developer TDD loop

---

## Test Execution Strategy

### **Run Smoke Tests Separately:**

```bash
# Don't run in regular test suite
npm test  # Runs mocked tests only

# Run smoke tests explicitly
npm run test:smoke  # Runs real API tests
```

**Add to package.json:**
```json
{
  "scripts": {
    "test:smoke": "vitest run tests/e2e/smoke/"
  }
}
```

---

## Success Criteria

**Smoke tests complete when:**
- ✅ 6 smoke tests implemented
- ✅ All pass with real API keys
- ✅ Provider parity validated (same schema across providers)
- ✅ No schema drift from mocked fixtures
- ✅ Can run on-demand (not in CI)

**After smoke tests:**
- ✅ 22 total tests (16 mocked + 6 smoke)
- ✅ Confidence that mocked tests reflect reality
- ✅ Ready for production deployment

---

## Implementation Order

1. **TC-SMOKE-01:** OpenAI basic (easiest, validates setup)
2. **TC-SMOKE-02:** Anthropic basic (validates second provider)
3. **TC-SMOKE-06:** Cross-provider parity (reuses infrastructure)
4. **TC-SMOKE-03:** OpenAI thinking (extended output)
5. **TC-SMOKE-04:** Anthropic thinking (cross-provider extended)
6. **TC-SMOKE-05:** Tool execution (most complex)

---

## Notes

### **Skip Tests If Keys Missing:**

Use Vitest's conditional skip:
```typescript
it.skipIf(!hasOpenAIKey)('OpenAI test', async () => {
  // Only runs if OPENAI_API_KEY is set
});
```

This allows smoke tests to be committed without breaking for developers who don't have API keys.

---

### **Real API Response Validation:**

Unlike mocked tests, we can't predict exact responses. Assertions should be flexible:

```typescript
// WRONG - too specific
expect(response.output_items[0].content).toBe('Hello! How can I help?');

// RIGHT - flexible
expect(response.output_items[0].content).toMatch(/hello/i);
expect(response.output_items[0].content.length).toBeGreaterThan(5);
```

---

### **Rate Limiting:**

Run smoke tests serially (not parallel) to avoid rate limits:

```typescript
describe.serial('Smoke Tests', () => {
  // Tests run one at a time
});
```

Or add delays between tests:
```typescript
afterEach(async () => {
  await sleep(1000);  // 1s between tests
});
```

---

## Expected Issues

**Possible failures:**
1. **API keys not set** - Tests skip (OK)
2. **Rate limits** - Add delays or reduce test count
3. **API schema changes** - Update our schema to match
4. **Network timeouts** - Increase test timeout to 60s

**If smoke tests fail but mocked tests pass:**
- This indicates fixture drift
- Update fixtures to match real API
- Update schema if needed
- This is VALUABLE - catching real-world changes

---

## Deliverables

1. `tests/e2e/smoke/real-api.spec.ts` - 6 smoke tests
2. `tests/harness/core-harness.ts` - Add useRealProviders option
3. `.env.test.example` - Document required API keys
4. `package.json` - Add test:smoke script
5. Update TEST_RESULTS.md with smoke test results

**No new fixtures** - smoke tests use real APIs
