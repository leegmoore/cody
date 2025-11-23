# CODER PROMPT: Core 2.0 Phase 5.2 - Edge Cases & Stress Tests

**Generated:** 2025-01-22
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`

---

## ROLE

You are a senior TypeScript/Node.js developer implementing **edge case and stress tests** for the Core 2.0 streaming architecture. Phase 5.1 validated error handling (6/6 passing). Now we test streaming integrity under load, unusual data patterns, and concurrent stress.

---

## PROJECT CONTEXT

**Cody Core 2.0** streaming pipeline is validated for:
- ✅ 10 happy path scenarios
- ✅ 6 error handling scenarios
- ✅ Total: 16/16 tests passing

**Current Phase:** Expand coverage to find edge case bugs in:
- Streaming mechanics (large payloads, rapid events, ordering)
- Concurrency (high load, race conditions)
- Schema validation (malformed data)

---

## CURRENT PHASE

**Phase:** Core 2.0 Phase 5.2 - Edge Cases & Stress Tests
**Objective:** Implement 6 edge case tests validating streaming integrity and concurrency

**FUNCTIONAL OUTCOME:**
After this phase, we will have validated the system handles edge cases gracefully: large responses, rapid streaming, concurrent load, out-of-order events, and schema violations. Total test coverage: 22 tests.

---

## PREREQUISITES

✅ **Previous Phases Complete:**
- 10 happy path tests passing
- 6 error handling tests passing
- Test harness stable and proven

✅ **Test Conditions Defined:**
- `docs/cc/test-conditions-phase-5.md` (Phase 5.2 section)

✅ **Local Environment:**
- Redis running on localhost:6379
- Convex dev server running

---

## STATE LOADING (READ THESE FIRST)

### FIRST: Load Test Conditions

1. **Test Conditions:** `docs/cc/test-conditions-phase-5.md`
   - Read Phase 5.2 section (6 tests: TC-ER-07 through TC-ER-12)
   - Understand edge case scenarios
   - Note verification points

2. **Existing Error Tests:** `tests/e2e/core-2.0/error-handling.spec.ts`
   - Review test structure
   - Note patterns for error assertions
   - Reuse harness setup

### THEN: Review Implementation

3. **Harness:** `tests/harness/core-harness.ts`
   - Review concurrent submission support
   - Note cleanup/reset robustness

4. **Mock Adapter:** `tests/mocks/mock-stream-adapter.ts`
   - Review fixture replay logic
   - Note how to create special fixtures (large, rapid, malformed)

---

## TASK SPECIFICATION

Implement **6 edge case tests** for Phase 5.2.

### **Deliverables:**

1. **Edge Case Fixtures** (`tests/fixtures/openai/`) - 4 new JSON files
   - `large-response.json` - 1MB+ message content (500+ deltas)
   - `rapid-stream.json` - 1000 tiny deltas (event_delay_ms: 0)
   - `out-of-order.json` - Intentionally misordered events
   - `invalid-schema.json` - Event missing required field

2. **Edge Case Test Suite** (`tests/e2e/core-2.0/edge-cases.spec.ts`) - ~500 lines
   - NEW file for edge case tests
   - 6 test cases: TC-ER-07 through TC-ER-12
   - Use same harness infrastructure
   - Focus on data integrity, concurrency, schema validation

**Effort Estimate:** ~600 lines total

---

## WORKFLOW STEPS

1. **Create Edge Case Test File**
   ```bash
   touch tests/e2e/core-2.0/edge-cases.spec.ts
   ```

2. **Implement TC-ER-12 (Invalid Schema) - Easiest**
   - Create `invalid-schema.json` fixture with missing item_id
   - Test that schema validation catches it
   - Verify clear error message

3. **Implement TC-ER-05 (Empty Content) - Already Done?**
   - This might already be in error-handling.spec.ts
   - If so, skip or move it to edge-cases.spec.ts

4. **Implement TC-ER-09 (Out-of-Order Events)**
   - Create `out-of-order.json` with item_delta before item_start
   - Test that reducer detects ordering violation
   - Verify error thrown with clear message

5. **Implement TC-ER-07 (Large Response)**
   - Create `large-response.json` with 500 deltas (2KB each = 1MB total)
   - Use script to generate (don't write 500 chunks manually):
   ```typescript
   const chunks = [
     'response_start event',
     'item_start event',
     ...Array.from({length: 500}, (_, i) =>
       `item.content.delta event with "chunk${i.toString().padStart(4, '0')}: ${generateRandomText(2000)}"`
     ),
     'item_done event',
     'response_done event'
   ];
   ```
   - Test accumulation, persistence, no memory issues

6. **Implement TC-ER-08 (Rapid Stream)**
   - Create `rapid-stream.json` with 1000 tiny deltas
   - Set event_delay_ms: 0 (no artificial delays)
   - Test no dropped events, correct accumulation

7. **Implement TC-ER-10 (High Concurrency)**
   - Submit 50 prompts in parallel using Promise.all
   - Reuse `simple-message.json` fixture for all
   - Test no crosstalk, all persist correctly
   - Test completes in reasonable time (<60s)

8. **Implement TC-ER-11 (Thread Collision)**
   - Submit 2 prompts with SAME threadId simultaneously
   - Test both complete without race conditions
   - Verify both in Convex with same thread_id

9. **Run Full Suite**
   ```bash
   npx vitest run tests/e2e/core-2.0/edge-cases.spec.ts
   ```

10. **Update TEST_RESULTS.md**

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **Create separate edge case test file**
   - Keep separate from error-handling.spec.ts
   - Logical grouping by test type

2. **Generate large fixtures programmatically**
   - Don't hand-write 500-1000 chunks
   - Use Node script to generate fixture JSON
   - Document generation script in fixture file

3. **Test data integrity, not just completion**
   - For large responses: verify content.length matches expected
   - For rapid stream: count deltas, verify all accumulated
   - For concurrency: verify no event mixing

4. **Set appropriate timeouts**
   - Large/rapid tests may take >5s default
   - Add timeout param: `test('...', async () => {...}, 30000)`
   - Concurrency test needs longer timeout

5. **Use valid models only**
   - gpt-5-mini, gpt-5-codex, claude-haiku-4.5, claude-sonnet-4.5

### **INTERRUPT PROTOCOL**

**STOP and ask if:**
- Generating large fixtures is unclear (need guidance on script)
- Out-of-order event handling requires MockAdapter changes
- Concurrency test approach is unclear
- Schema validation errors require core schema changes

**DO NOT:**
- Skip tests because fixtures are large (generate them programmatically)
- Reduce concurrency test to <20 turns (defeats purpose)
- Mock additional infrastructure
- Add arbitrary delays to hide race conditions

---

## IMPLEMENTATION GUIDANCE

### **For TC-ER-07 (Large Response):**

Generate fixture programmatically:

```typescript
// scripts/generate-large-fixture.ts
const chunks = [
  'data: {"type":"response_start",...}\n\n',
  'data: {"type":"item_start","item_type":"message",...}\n\n',
];

for (let i = 0; i < 500; i++) {
  const text = `Chunk ${i}: ` + 'x'.repeat(2000);  // 2KB per chunk
  chunks.push(`data: {"type":"item_delta","item_id":"msg_1","delta":"${text}"}\n\n`);
}

chunks.push('data: {"type":"item_done",...}\n\n');
chunks.push('data: {"type":"response_done",...}\n\n');

const fixture = {
  description: "Large response ~1MB content",
  provider: "openai",
  model: "gpt-5-mini",
  chunks,
  expected_response: {
    // ... with content.length ~1MB
  }
};

fs.writeFileSync('tests/fixtures/openai/large-response.json', JSON.stringify(fixture, null, 2));
```

Or generate inline in test:
```typescript
test('TC-ER-07: Large response', async () => {
  // Generate fixture on the fly
  const largeFixture = generateLargeResponseFixture(500, 2000);
  harness.modelFactory.registerFixture({
    providerId: 'openai',
    model: 'gpt-5-mini',
    filePath: largeFixture.path,
    isDefault: true
  });

  // ... rest of test
});
```

---

### **For TC-ER-08 (Rapid Stream):**

Simple fixture with many small deltas:

```json
{
  "chunks": [
    "response_start",
    "item_start",
    // 1000 deltas
    "data: {\"type\":\"item_delta\",\"item_id\":\"msg_1\",\"delta\":\"a\"}\n\n",
    "data: {\"type\":\"item_delta\",\"item_id\":\"msg_1\",\"delta\":\"b\"}\n\n",
    // ... (generate programmatically)
  ],
  "stream_config": {
    "event_delay_ms": 0  // No delays - rapid fire
  }
}
```

Verify in test:
```typescript
expect(response.output_items[0].content).toHaveLength(1000);
```

---

### **For TC-ER-09 (Out-of-Order):**

Create fixture with wrong sequence:

```json
{
  "chunks": [
    "response_start",
    "item_delta (WRONG - no item_start yet)",  // ← Out of order
    "item_start",
    "item_done",
    "response_done"
  ]
}
```

Test should expect error:
```typescript
test('TC-ER-09: Out of order events', async () => {
  const {runId, streamUrl} = await harness.submit({...});

  // Expect hydration to fail
  await expect(
    harness.consumeSSE(streamUrl)
  ).rejects.toThrow(/item_delta.*before.*item_start/);
});
```

---

### **For TC-ER-10 (High Concurrency):**

```typescript
test('TC-ER-10: High concurrency (50 turns)', async () => {
  const submissions = await Promise.all(
    Array.from({length: 50}, (_, i) =>
      harness.submit({
        prompt: `Concurrent test ${i}`,
        model: 'gpt-5-mini',
        providerId: 'openai'
      })
    )
  );

  expect(submissions).toHaveLength(50);
  expect(new Set(submissions.map(s => s.runId)).size).toBe(50);  // All unique

  // Verify all persisted
  const results = await Promise.all(
    submissions.map(s => harness.getPersistedResponse(s.runId))
  );

  expect(results.filter(r => r !== null)).toHaveLength(50);
}, 60000);  // 60 second timeout
```

---

### **For TC-ER-11 (Thread Collision):**

```typescript
test('TC-ER-11: Thread collision (concurrent, same thread)', async () => {
  const threadId = randomUUID();

  const [sub1, sub2] = await Promise.all([
    harness.submit({
      prompt: 'Turn 1',
      model: 'gpt-5-mini',
      providerId: 'openai',
      threadId
    }),
    harness.submit({
      prompt: 'Turn 2',
      model: 'gpt-5-mini',
      providerId: 'openai',
      threadId
    })
  ]);

  expect(sub1.runId).not.toBe(sub2.runId);  // Different runs

  const [resp1, resp2] = await Promise.all([
    harness.getPersistedResponse(sub1.runId),
    harness.getPersistedResponse(sub2.runId)
  ]);

  expect(resp1.thread_id).toBe(threadId);
  expect(resp2.thread_id).toBe(threadId);  // Both same thread
  expect(resp1.turn_id).not.toBe(resp2.turn_id);  // Different turns
});
```

---

### **For TC-ER-12 (Invalid Schema):**

Create fixture with missing required field:

```json
{
  "chunks": [
    "response_start",
    "data: {\"type\":\"item_start\",\"item_type\":\"message\"}\n\n",  // Missing item_id
    "item_delta",
    "item_done",
    "response_done"
  ]
}
```

Test expects validation error:
```typescript
test('TC-ER-12: Invalid event schema', async () => {
  const {runId, streamUrl} = await harness.submit({...});

  await expect(
    harness.consumeSSE(streamUrl)
  ).rejects.toThrow(/item_id.*required/);
});
```

---

## CODE QUALITY STANDARDS

### **Mandatory Quality Gates:**

- ✅ TypeScript: Zero errors (`npx tsc --noEmit`)
- ✅ ESLint: Zero errors (`npm run lint`)
- ✅ Edge case tests: Runnable and deterministic
- ✅ Reasonable performance (concurrency test < 60s)

### **Verification Command:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npx vitest run tests/e2e/core-2.0/edge-cases.spec.ts
```

---

## SESSION COMPLETION CHECKLIST

1. ✅ **Run verification command**

2. ✅ **Update TEST_RESULTS.md:**
   ```markdown
   ## Phase 5.2: Edge Cases & Stress Tests

   **Status:** X/6 passing

   | Test | Status | Runtime | Notes |
   |------|--------|---------|-------|
   | TC-ER-07: Large response | ✅ PASS | ~8s | 1MB handled |
   | TC-ER-08: Rapid stream | ✅ PASS | ~6s | 1000 deltas |
   | TC-ER-09: Out-of-order | ✅ PASS | ~5s | Error caught |
   | TC-ER-10: High concurrency | ✅ PASS | ~45s | 50 turns |
   | TC-ER-11: Thread collision | ✅ PASS | ~10s | No race |
   | TC-ER-12: Invalid schema | ✅ PASS | ~5s | Validation works |

   **Total Coverage:** 22/22 tests passing (10 happy + 6 error + 6 edge)
   ```

3. ✅ **Commit work:**
   ```bash
   git add -A
   git commit -m "feat(test): implement Phase 5.2 edge case and stress tests

   Added 6 edge case tests validating streaming integrity and concurrency.

   Tests Implemented:
   - TC-ER-07: Large response (1MB+ content)
   - TC-ER-08: Rapid stream (1000 deltas)
   - TC-ER-09: Out-of-order events
   - TC-ER-10: High concurrency (50 turns)
   - TC-ER-11: Thread collision (concurrent writes)
   - TC-ER-12: Invalid event schema

   Results: X/6 passing (see TEST_RESULTS.md)
   Total Coverage: 22 tests (10 happy + 6 error + 6 edge)

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

4. ✅ **Report summary:**
   - Fixtures created
   - Tests passing
   - Performance observations (concurrency runtime, large payload handling)
   - Any new bugs found

---

## STARTING POINT

**BEGIN by:**

1. Reading Phase 5.2 test conditions
2. Creating `tests/e2e/core-2.0/edge-cases.spec.ts`
3. Implementing TC-ER-12 first (schema validation - simplest)
4. Then TC-ER-09 (out-of-order - simple)
5. Then TC-ER-11 (thread collision - medium)
6. Then TC-ER-10 (high concurrency - medium)
7. Then TC-ER-08 (rapid stream - needs fixture generation)
8. Finally TC-ER-07 (large response - needs fixture generation)

**Start with tests that don't require fixture generation, then tackle the large fixtures.**

---

## EXPECTED OUTCOME

After this session:
- ✅ 6 edge case tests implemented
- ✅ 4-6 tests passing (some may expose bugs)
- ✅ Large/rapid fixtures generated
- ✅ Concurrency validated
- ✅ Total: 22 comprehensive tests

---

## PERFORMANCE EXPECTATIONS

**Expected test durations:**
- TC-ER-07 (large): ~10-15s (streaming 1MB)
- TC-ER-08 (rapid): ~5-8s (1000 events)
- TC-ER-09 (out-of-order): ~5s (should fail fast)
- TC-ER-10 (concurrency): ~30-50s (50 parallel turns)
- TC-ER-11 (collision): ~10s (2 parallel turns)
- TC-ER-12 (schema): ~5s (should fail fast)

**Total suite:** ~60-90 seconds

If tests take significantly longer, investigate (possible deadlocks or performance issues).

---

## NOTES

**Fixture Generation:**

For large/rapid fixtures, consider creating a helper:

```typescript
// tests/fixtures/generate-stress-fixtures.ts
export function generateLargeResponseFixture(numDeltas: number, bytesPerDelta: number) {
  const chunks = [
    generateResponseStart(),
    generateItemStart('message'),
  ];

  for (let i = 0; i < numDeltas; i++) {
    const content = generateRandomText(bytesPerDelta);
    chunks.push(generateItemDelta('msg_1', content));
  }

  chunks.push(generateItemDone('msg_1', concatenatedContent));
  chunks.push(generateResponseDone());

  return {
    description: `Large response: ${numDeltas} deltas, ~${(numDeltas * bytesPerDelta / 1024 / 1024).toFixed(2)}MB`,
    provider: 'openai',
    model: 'gpt-5-mini',
    chunks,
    expected_response: {
      output_items: [{
        type: 'message',
        content: expect.stringMatching(/^Chunk 0000:/)  // Verify starts correctly
      }]
    }
  };
}
```

**Concurrency Test:**

Make sure to test actual concurrency, not sequential:
```typescript
// WRONG - sequential
for (let i = 0; i < 50; i++) {
  await harness.submit({...});
}

// RIGHT - parallel
await Promise.all(
  Array.from({length: 50}, () => harness.submit({...}))
);
```

**Schema Validation:**

If TC-ER-12 doesn't fail as expected (schema lets invalid through), this is a BUG in schema validation. Document it, don't skip the test.
