# CODER PROMPT: Service Mock Tests - Slice 3 - Fix Tool Execution

**Generated:** 2025-11-24
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`
**Slice:** 3 of 7 (Tool Execution)

---

## ROLE

You are a senior TypeScript/Node.js developer fixing **real tool execution** in the Core 2.0 test suite. Your focus is getting ToolWorker to process function_call events, execute REAL tool implementations, and emit function_call_output events back to Redis.

---

## PROJECT CONTEXT

**Current State:**
- ✅ **Slice 1 Complete**: Infrastructure stable, TC-HP-01 passing
- ✅ **Slice 2 Complete**: Persistence working, TC-HP-01 through TC-HP-04 passing
- ❌ **Tool Execution Broken**: TC-HP-05 and TC-HP-08 fail
- ❌ ToolWorker not emitting function_call_output events
- ❌ Tests expect function_call_output but only see function_call

**What's Happening:**
1. MockAdapter emits function_call event to Redis ✅
2. ToolWorker SHOULD see event and execute tool ❌
3. ToolWorker SHOULD emit function_call_output ❌
4. Test times out or fails on missing output

---

## CURRENT PHASE

**Phase:** Service Mock Tests - Slice 3
**Objective:** Get ToolWorker executing REAL tools (readFile, exec) and emitting real function_call_output events.

**FUNCTIONAL OUTCOME:**
After this slice, when a mocked LLM requests a tool (readFile, exec), the ToolWorker executes the REAL tool implementation against REAL filesystem/shell, and emits a REAL function_call_output event containing actual output. Tests validate the complete tool execution pipeline without mocking any part of it except the LLM response.

---

## PREREQUISITES

✅ **Previous Slices:**
- Slice 1: Infrastructure stable
- Slice 2: Persistence working

✅ **Tool System Exists:**
- `codex-ts/src/tools/registry.ts` - Real tool registry
- `codex-ts/src/tools/handlers/` - Real tool implementations (readFile, exec, etc.)
- `src/workers/tool-worker.ts` - ToolWorker implementation

---

## KNOWN ISSUES

**Issue 1: Missing function_call_output** (CRITICAL)
- **Test**: TC-HP-08
- **Error**: Expected ['function_call', 'function_call_output'] but got ['function_call']
- **Evidence**: MockAdapter emits function_call, but no corresponding output appears
- **Diagnosis needed**: Is ToolWorker running? Seeing events? Executing tools? Emitting outputs?

**Issue 2: Tool Call Fixtures May Be Wrong**
- **Files**: `tests/fixtures/openai/simple-tool-call.json`, `tool-call-output-message.json`
- **Issue**: Fixtures might have incorrect tool arguments (path vs filePath, string vs array)
- **Fix**: Align fixture arguments with actual tool schemas from codex-ts

**Issue 3: ToolWorker Discovery Loop**
- **Question**: Does ToolWorker discover streams quickly enough?
- **Config**: discoveryIntervalMs: 200ms (should be fast enough)
- **Check**: Verify ToolWorker logs show stream discovery

---

## TASK SPECIFICATION

### **Task 1: Debug ToolWorker Execution** (~45 min)

**Add diagnostic logging to ToolWorker:**

**File:** `src/workers/tool-worker.ts`

```typescript
// In discoveryLoop after discovering new streams
console.log(`[tool-worker] Discovered stream: ${streamKey}`);

// In consumeLoop after reading events
console.log(`[tool-worker] Read ${messages.length} events from ${streamKey}`);

// When function_call detected
console.log(`[tool-worker] Processing function_call: ${call.name} (${call.call_id})`);

// After tool execution
console.log(`[tool-worker] Executed ${call.name}: success=${result.success}`);

// After emitting output
console.log(`[tool-worker] Emitted function_call_output for ${call.call_id}`);
```

**Run TC-HP-08:**
```bash
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-08"
```

**Observe logs - determine**:
- Does ToolWorker see the stream?
- Does it read the function_call event?
- Does it execute the tool?
- Does it emit the output?
- Where does the flow break?

---

### **Task 2: Verify Tool Arguments Match Schemas** (~30 min)

**The Problem:**
Tool fixtures might have wrong argument shapes (path vs filePath, string vs array).

**Files to check:**
1. `tests/fixtures/openai/simple-tool-call.json` - exec tool
2. `tests/fixtures/openai/tool-call-output-message.json` - readFile tool

**Verify against real schemas:**

**For exec tool:**
```typescript
// Check: codex-ts/src/tools/handlers/exec.ts
// Actual schema likely: { command: string[] }

// Fixture MUST have:
"arguments": "{\"command\": [\"ls\", \"-la\"]}"  // Array, not string
```

**For readFile tool:**
```typescript
// Check: codex-ts/src/tools/handlers/read-file.ts
// Actual schema likely: { filePath: string }

// Fixture MUST have:
"arguments": "{\"filePath\": \"README.md\"}"  // filePath, not path
```

**Action:**
1. Read actual tool handler files to verify schemas
2. Update fixtures to match
3. Ensure arguments are valid JSON strings

---

### **Task 3: Fix Tool Execution Flow** (~45 min)

Based on diagnostic findings, apply fixes:

**If ToolWorker not seeing events:**
- Check Redis stream key format matches worker pattern
- Verify worker discoveryLoop is running
- Check consumer group is created

**If ToolWorker seeing but not executing:**
- Check tool registry has the requested tool
- Verify tool arguments parse correctly
- Check for errors during tool execution

**If ToolWorker executing but not emitting:**
- Check Redis publish logic in ToolWorker
- Verify event format matches StreamEventSchema
- Check for serialization errors

**Common fix - ensure ToolWorker publishes correctly:**
```typescript
// After tool execution, must emit to Redis
await redis.publish(streamKey, {
  type: 'item_start',
  payload: {
    type: 'item_start',
    item_id: outputItemId,
    item_type: 'function_call_output'
  }
});

await redis.publish(streamKey, {
  type: 'item_done',
  payload: {
    type: 'item_done',
    item_id: outputItemId,
    final_item: {
      id: outputItemId,
      type: 'function_call_output',
      call_id: call.call_id,
      output: JSON.stringify(result),
      success: result.success,
      origin: 'tool_harness'
    }
  }
});
```

---

## WORKFLOW STEPS

1. **Add ToolWorker logging** (persistence-worker.ts)
2. **Run TC-HP-08** and observe logs
3. **Identify break point** (discovery, consumption, execution, or emission)
4. **Verify tool argument schemas**
5. **Update fixtures** if arguments wrong
6. **Fix ToolWorker** if execution/emission broken
7. **Test TC-HP-05 and TC-HP-08**
8. **Remove diagnostic logging**
9. **Verify 3 consecutive passes**
10. **Document and commit**

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **Real Tool Execution Required**
   - ToolWorker MUST execute actual tool handlers
   - readFile MUST read real files from disk
   - exec MUST execute real shell commands
   - **NO mocking** of tool implementations

2. **Control via LLM Fixtures**
   - Fixtures control WHICH tools are called
   - Fixtures control tool ARGUMENTS
   - But actual execution is REAL

3. **Safe Tool Arguments**
   - Use safe commands: ["ls", "-la"] not ["rm", "-rf"]
   - Use existing files: "README.md" not arbitrary paths
   - Verify arguments won't cause damage

### **INTERRUPT PROTOCOL**

**STOP and ask if:**
- ToolWorker needs significant refactoring to work
- Tool execution is genuinely unsafe in tests
- Tool argument schemas are ambiguous
- You need to modify tool handler implementations

**DO NOT:**
- Mock tool registry
- Mock tool handlers
- Bypass ToolWorker execution
- Fake function_call_output events

---

## CODE QUALITY STANDARDS

### **Verification Command:**
```bash
npm run format && \
npm run lint && \
npx tsc --noEmit && \
npx vitest run tests/e2e/core-2.0/happy-path.spec.ts -t "TC-HP-0[58]"
```

**Success:** Both TC-HP-05 and TC-HP-08 pass

---

## STARTING POINT

**BEGIN by:**
1. Adding diagnostic logging to ToolWorker
2. Running TC-HP-08 to see where tool execution breaks
3. Fixing identified issue
4. Verifying both tool tests pass

**Focus on:** Getting REAL tool execution working. Don't mock it. Fix it.

---

## EXPECTED OUTCOME

After this session:
- ✅ TC-HP-05 passing (readFile + message)
- ✅ TC-HP-08 passing (exec simple)
- ✅ Real tools execute (actual file reads, command execution)
- ✅ function_call_output events appear in streams
- ✅ Tests validate full tool execution pipeline

**Tool mocking verification:**
- [ ] NO tool implementations are mocked
- [x] Only LLM responses are mocked

If you mocked ANY tool implementations, you must disclose this in the completion report.
