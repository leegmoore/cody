# IMMEDIATE FIX: Remove Tool Execution Mocking

**Priority:** CRITICAL
**Issue:** Tool execution is currently mocked in fixtures, violating the "no mocks except LLMs" rule

---

## THE PROBLEM

**Current state:**
- TC-HP-05 fixture includes `function_call_output` events
- These outputs are FAKE (pre-written in JSON)
- ToolWorker is NOT actually executing tools
- We have ZERO confidence that tool execution works

**The violation:**
```json
// tests/fixtures/openai/tool-call-output-message.json
{
  "chunks": [
    "...function_call...",
    "...function_call_output...",  // ← THIS IS MOCKED (WRONG)
    "...message..."
  ]
}
```

**What should happen:**
1. LLM emits `function_call` (from fixture - OK)
2. ToolWorker sees function_call in Redis
3. ToolWorker executes REAL tool (readFile, exec, etc.)
4. ToolWorker emits REAL `function_call_output` to Redis
5. Adapter continues (or LLM gets called again with tool output)

---

## THE FIX

### **Task 1: Remove Mocked Tool Outputs from Fixtures**

**Files to modify:**
- `tests/fixtures/openai/tool-call-output-message.json`

**Change:**

**Remove these chunks:**
```json
"event: item_start (function_call_output)",
"event: item_delta (function_call_output)",
"event: item_done (function_call_output)"
```

**Remove from expected_response:**
```json
{
  "type": "function_call_output",
  // ... this entire object
}
```

**Keep only:**
- function_call item
- message item (final response after tool execution)

**The fixture should represent TWO LLM calls:**
1. Initial call → function_call
2. Second call (after tool execution) → message

---

### **Task 2: Ensure ToolWorker is Running in Tests**

**File:** `tests/harness/core-harness.ts`

**Verify in `setup()` method:**

```typescript
async setup() {
  // ... existing setup ...

  // Start PersistenceWorker
  this.worker = new PersistenceWorker(this.workerOptions);
  await this.worker.start();

  // ADD THIS: Start ToolWorker
  this.toolWorker = new ToolWorker(); // Import from src/workers/tool-worker.ts
  await this.toolWorker.start();
}
```

**Add to `cleanup()`:**
```typescript
async cleanup() {
  await this.worker?.stop();
  await this.toolWorker?.stop(); // ADD THIS
  // ... rest of cleanup
}
```

**Add to `reset()`:**
```typescript
async reset() {
  await this.worker?.stop();
  await this.toolWorker?.stop(); // ADD THIS

  // ... cleanup Redis/Convex ...

  this.worker = new PersistenceWorker(this.workerOptions);
  await this.worker.start();

  this.toolWorker = new ToolWorker(); // ADD THIS
  await this.toolWorker.start();
}
```

---

### **Task 3: Mock ONLY Tool Implementation (Not Tool Worker)**

The ToolWorker should run and emit events. But the actual tool implementations (readFile, exec) should be mocked for safety.

**File:** `src/workers/tool-worker.ts` (or wherever tool registry is)

**Current approach (if it exists):**
```typescript
// WRONG - entire worker bypassed
const mockToolWorker = {
  start: () => {},
  processToolCall: () => {/* returns fake output */}
};
```

**Correct approach:**
```typescript
// RIGHT - real worker, mocked tool handlers

import {ToolRegistry} from 'codex-ts/src/tools/registry';

// In test setup:
const toolRegistry = new ToolRegistry();

// Mock individual tools
toolRegistry.register('readFile', async (args) => {
  // Don't actually read file, return mock content
  return {
    success: true,
    output: '# Mocked README\n\nThis is mock file content.'
  };
});

toolRegistry.register('exec', async (args) => {
  // Don't actually execute shell command
  return {
    success: true,
    output: 'mocked-file.txt\nmocked-dir/'
  };
});

// Pass this registry to ToolWorker
const toolWorker = new ToolWorker({toolRegistry});
```

**The key difference:**
- ✅ ToolWorker RUNS (processes Redis events, emits function_call_output)
- ✅ Tool handlers are MOCKED (don't touch filesystem/shell)
- ❌ NOT bypassing the worker entirely

---

### **Task 4: Update TC-HP-05 Test**

**File:** `tests/e2e/core-2.0/happy-path.spec.ts`

**Current test probably expects:**
```typescript
expect(response.output_items).toHaveLength(3); // call, output, message
```

**After fix, test should expect:**
```typescript
// Submit triggers LLM call 1 → function_call
const {runId, streamUrl} = await harness.submit({
  prompt: 'Summarize README.md',
  model: 'gpt-5-codex'
});

// Consume stream
const events = await harness.consumeSSE(streamUrl);
const response = await harness.hydrate(events);

// Should have:
// 1. function_call item (from LLM)
// 2. function_call_output item (from ToolWorker - REAL)
// 3. message item (from LLM call 2 - but this requires multi-turn fixture)

// For now, just verify tool execution happened:
expect(response.output_items).toContainEqual(
  expect.objectContaining({
    type: 'function_call',
    name: 'readFile'
  })
);

expect(response.output_items).toContainEqual(
  expect.objectContaining({
    type: 'function_call_output',
    success: true,
    output: expect.stringContaining('README') // From REAL tool execution
  })
);
```

**Note:** The final message item requires the LLM to be called AGAIN with the tool output. This is complex and might be out of scope for this fix. Focus on verifying function_call → function_call_output flow works.

---

### **Task 5: Verify ToolWorker Integration**

**After making changes, verify:**

1. **ToolWorker starts:**
   ```typescript
   // Add logging in harness setup
   console.log('[harness] ToolWorker started');
   ```

2. **ToolWorker sees function_call events:**
   ```typescript
   // Add logging in ToolWorker when it processes function_call
   console.log('[tool-worker] Processing function_call:', callId);
   ```

3. **function_call_output emitted to Redis:**
   ```bash
   # During test, check Redis stream
   redis-cli XRANGE codex:run:{runId}:events - +
   # Should see function_call_output event
   ```

4. **Test passes with REAL tool execution:**
   ```bash
   npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-05"
   ```

---

## CRITICAL CONSTRAINT

**DO NOT mock:**
- ❌ ToolWorker (must run for real)
- ❌ Tool execution flow (function_call → worker → function_call_output)
- ❌ Redis events (must be real)

**DO mock:**
- ✅ LLM API responses (OpenAI, Anthropic)
- ✅ Individual tool implementations (readFile, exec functions)
  - Mock so tests don't touch real filesystem
  - Mock so tests don't execute shell commands
  - But ToolWorker MUST run and emit real function_call_output events

---

## SUCCESS CRITERIA

After this fix:

- ✅ ToolWorker running in test harness
- ✅ Tool handlers mocked (no real file I/O or shell execution)
- ✅ ToolWorker emits REAL function_call_output events to Redis
- ✅ TC-HP-05 and TC-HP-08 pass with real tool execution flow
- ✅ function_call_output removed from fixtures
- ✅ Tests validate that tool execution pipeline works

---

## EXPECTED OUTCOME

**Some tests may fail after this change.** That's OK - it means we're exposing real bugs in tool execution integration.

Document any failures:
- Which test fails
- What error occurs
- Where in the pipeline it breaks (ToolWorker not seeing events? Not emitting output? Wrong format?)

**The goal is to validate tool execution works for real, not to keep tests passing with fake data.**

---

## STARTING POINT

1. Check if ToolWorker is imported and started in harness
2. If not, add ToolWorker lifecycle to harness
3. Remove function_call_output from tool-call-output-message.json fixture
4. Update TC-HP-05 assertions to expect REAL tool output
5. Run test, debug failures
6. Fix integration issues until test passes with REAL tool execution
