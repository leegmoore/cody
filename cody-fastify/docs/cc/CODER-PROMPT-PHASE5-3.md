# CODER PROMPT: Core 2.0 Phase 5.3 - Tool Support Integration

**Generated:** 2025-01-22
**Target Model:** gpt-5.1-codex-max
**Workspace:** `/Users/leemoore/code/codex-port-02/cody-fastify`

---

## ROLE

You are a senior TypeScript/Node.js developer integrating **tool call support** into the Core 2.0 streaming adapters. Tool support exists in v1 (codex-ts) but was omitted during the Core 2.0 refactor. You will port the tool schema formatting logic from v1 and integrate it into v2 adapters to enable real LLM tool calls.

---

## PROJECT CONTEXT

**Cody Core 2.0** streaming pipeline is validated for messages and thinking blocks (22/22 mocked tests passing). Smoke tests with REAL APIs revealed that **tool calls don't work** because adapters don't pass tool schemas to LLM providers.

**Current State:**
- ✅ Core 2.0 streaming works (Redis, workers, SSE, hydration)
- ✅ Tool execution works (ToolWorker processes function_call events)
- ✅ Mocked tests with pre-defined function_call events pass
- ❌ Real LLMs never return function_call (no tools in request)
- ❌ TC-SMOKE-05 fails: timeout waiting for tool call

**What Exists in v1:**
- ✅ `createToolsJsonForResponsesApi()` - Formats tools for OpenAI Responses API
- ✅ `createToolsJsonForChatCompletionsApi()` - Formats tools for Chat/OpenRouter
- ✅ Tool registry with ToolSpec types
- ✅ Tool schema validation

**What's Missing in v2:**
- ❌ No tool schema formatting
- ❌ Adapters don't include `tools` in API requests
- ❌ No way to pass available tools to adapters

---

## CURRENT PHASE

**Phase:** Core 2.0 Phase 5.3 - Tool Support Integration
**Objective:** Port tool schema formatting from v1, integrate into v2 adapters, validate with real API smoke tests

**FUNCTIONAL OUTCOME:**
After this phase, LLMs can call tools. When a user asks "Read README.md", the LLM returns a function_call event, ToolWorker executes readFile, and the response includes the file content. TC-SMOKE-05 passes with real OpenAI API.

---

## PREREQUISITES

✅ **v1 Tool Support (Reference Implementation):**
- `codex-ts/src/core/client/tool-converters.ts` (93 lines)
  - `createToolsJsonForResponsesApi()` (lines 30-58)
  - `createToolsJsonForChatCompletionsApi()` (lines 72-93)
- `codex-ts/src/core/client/client-common.ts`
  - `ToolSpec` type definition (line 60-80)
  - `Prompt` interface includes `tools: ToolSpec[]` (line 92)

✅ **v2 Adapters (Need Tool Integration):**
- `src/core/adapters/openai-adapter.ts` (request construction at line 92)
- `src/core/adapters/anthropic-adapter.ts` (request construction)

✅ **Tool Registry:**
- `codex-ts/src/tools/registry.ts` (ToolRegistry class)
- Provides `getAll()` → returns all registered tools
- Already used by ToolWorker

✅ **Smoke Tests:**
- `tests/e2e/smoke/real-api.spec.ts` (TC-SMOKE-05 currently failing)

---

## STATE LOADING (READ THESE FIRST)

### FIRST: Understand the Problem

1. **Smoke Test Failure:** `TEST_RESULTS.md` (lines 13-18)
   - TC-SMOKE-05 fails: timeout waiting for function_call
   - Root cause: Adapter doesn't send tools array
   - Real LLM has no idea it can call functions

2. **Test Condition:** `docs/cc/test-conditions-smoke-tests.md`
   - Read TC-SMOKE-05 specification
   - Understand expected behavior (function_call → output → message)

### THEN: Review v1 Implementation

3. **v1 Tool Converters:** `codex-ts/src/core/client/tool-converters.ts`
   - Read full file (93 lines)
   - Note `createToolsJsonForResponsesApi()` format
   - Note `createToolsJsonForChatCompletionsApi()` format
   - Understand ToolSpec → API schema mapping

4. **v1 ToolSpec Type:** `codex-ts/src/core/client/client-common.ts` (lines 60-80)
   - Understand tool type variants (function, local_shell, web_search, custom)
   - Note required fields (name, description, parameters)

### THEN: Review v2 Adapters

5. **v2 OpenAI Adapter:** `src/core/adapters/openai-adapter.ts`
   - Line 92-102: Request body construction
   - Note: No `tools` field currently
   - Identify integration point

6. **v2 Anthropic Adapter:** `src/core/adapters/anthropic-adapter.ts`
   - Find request body construction
   - Note Anthropic Messages API tool format (if different)

7. **Tool Registry:** `codex-ts/src/tools/registry.ts`
   - Understand how to get all tools
   - Note ToolSpec type compatibility

---

## KNOWN ISSUES (From Smoke Tests)

**Issue 1: OpenAI Adapter Missing Tools**
- **Error:** TC-SMOKE-05 timeout - no function_call emitted
- **Root Cause:** Request body missing `tools` array (line 92 of openai-adapter.ts)
- **What v1 Has:** `tools: createToolsJsonForResponsesApi(prompt.tools)` (responses/client.ts line 15)
- **What v2 Needs:** Port tool converter, add tools to request

**Issue 2: Anthropic Adapter Missing max_tokens**
- **Error:** TC-SMOKE-02/04 fail - "max_tokens: Field required"
- **Root Cause:** Anthropic API requires max_tokens parameter
- **Fix:** Add `max_tokens: this.maxOutputTokens || 4096` to request

**Issue 3: Usage Metrics Not Captured**
- **Error:** TC-SMOKE-01 - usage.total_tokens = 0
- **Root Cause:** Adapter doesn't extract usage from response_done
- **Fix:** Parse usage from OpenAI response, emit in response_done event

---

## TASK SPECIFICATION

Port tool support from v1 and integrate into v2 adapters.

### **Phase 1: Port Tool Schema Formatting (~30 min)**

**Deliverables:**

1. **Tool Schema Formatter** (`src/core/tools/schema-formatter.ts`) - ~100 lines
   - Port `createToolsJsonForResponsesApi()` from v1
   - Port `createToolsJsonForChatCompletionsApi()` from v1
   - Import ToolSpec type from codex-ts
   - Keep logic identical (proven to work)

**Integration:** Will be called by adapters when constructing requests

---

### **Phase 2: Integrate Tools in OpenAI Adapter (~45 min)**

**Deliverables:**

1. **OpenAI Adapter Enhancement** (`src/core/adapters/openai-adapter.ts`) - ~40 lines added
   - Accept `tools?: ToolSpec[]` in StreamParams interface (line 19)
   - Import schema formatter
   - Add tools to request body (line 92):
     ```typescript
     const reqBody = {
       model: this.model,
       input: [...],
       tools: params.tools ? formatToolsForResponsesApi(params.tools) : undefined,
       tool_choice: params.tools?.length > 0 ? "auto" : undefined,
       // ... rest
     };
     ```
   - Extract usage from response and include in response_done event

---

### **Phase 3: Integrate Tools in Anthropic Adapter (~45 min)**

**Deliverables:**

1. **Anthropic Adapter Enhancement** (`src/core/adapters/anthropic-adapter.ts`) - ~40 lines added
   - Accept `tools?: ToolSpec[]` in params
   - Add `max_tokens` to request (fix TC-SMOKE-02/04)
   - Format tools for Anthropic Messages API (similar to Chat Completions)
   - Add `tools` array to request body

---

### **Phase 4: Wire Tools Through Submit Endpoint (~30 min)**

**Deliverables:**

1. **Submit Route Update** (`src/api/routes/submit.ts`) - ~30 lines
   - Get available tools from ToolRegistry
   - Pass tools array to adapter.stream(params)
   - Tools automatically included in all requests

**Integration:**
```typescript
// src/api/routes/submit.ts

import {toolRegistry} from 'codex-ts/src/tools/registry';

// In submit handler (line 140):
const availableTools = toolRegistry.getAll();  // Get all registered tools

await adapter.stream({
  prompt: body.prompt,
  runId,
  threadId: body.threadId,
  tools: availableTools,  // ← Add this
  // ...
});
```

---

### **Phase 5: Validate with Smoke Tests (~15 min)**

**Deliverables:**

1. **Smoke Test Validation**
   - Run `npm run test:smoke`
   - Verify TC-SMOKE-05 passes (tool call works)
   - Verify TC-SMOKE-01 passes (usage captured)
   - Verify TC-SMOKE-02/04 pass (max_tokens fixed)
   - Document any remaining failures

**Total Effort:** ~2-3 hours

---

## WORKFLOW STEPS

1. **Port Tool Converters**
   ```bash
   mkdir -p src/core/tools
   # Port tool-converters.ts from v1
   ```

2. **Update OpenAI Adapter**
   - Import formatToolsForResponsesApi
   - Add tools param to StreamParams
   - Add tools to request body (line 92)
   - Extract usage from response

3. **Update Anthropic Adapter**
   - Add max_tokens to request (fix immediate failure)
   - Import formatToolsForChatApi
   - Add tools to request body

4. **Wire Through Submit**
   - Import toolRegistry
   - Get all tools
   - Pass to adapter.stream()

5. **Test Each Step**
   ```bash
   # After OpenAI adapter update:
   npm run test:smoke -- -t "TC-SMOKE-05"

   # After Anthropic adapter update:
   npm run test:smoke -- -t "TC-SMOKE-02"

   # Full suite:
   npm run test:smoke
   ```

6. **Document Results**
   - Update TEST_RESULTS.md with new smoke test status
   - Note which tests now pass
   - Document any remaining issues

---

## WORKFLOW RULES

### **Mandatory Rules:**

1. **Port v1 logic, don't reinvent**
   - Copy `createToolsJsonForResponsesApi()` and `createToolsJsonForChatCompletionsApi()` from v1
   - Keep schema format identical (proven to work with OpenAI API)
   - Don't "improve" or "simplify" - port exactly

2. **Use existing ToolSpec types**
   - Import from codex-ts: `import {ToolSpec} from 'codex-ts/src/core/client/client-common.js'`
   - Don't create new tool type definitions
   - Reuse what exists and works

3. **Test after EACH adapter update**
   - Run smoke test for that provider
   - Don't wait until all adapters done
   - Verify incrementally

4. **Tools are optional in request**
   - If no tools provided, request works without tools field
   - Don't make tools required (breaks non-tool conversations)

### **INTERRUPT PROTOCOL**

**STOP and ask if:**
- ToolSpec import from codex-ts causes module resolution errors
- Anthropic tool format is unclear (different from OpenAI?)
- ToolRegistry.getAll() doesn't exist or has different signature
- Smoke tests reveal unexpected API schema requirements

**DO NOT:**
- Build tool schemas from scratch (port from v1)
- Mock tool calls in smoke tests (defeats purpose)
- Change ToolSpec types (use existing from codex-ts)
- Skip anthropic max_tokens fix (required for API to work)

---

## IMPLEMENTATION GUIDANCE

### **Tool Schema Format (OpenAI Responses API)**

**From v1 (tool-converters.ts lines 30-58):**

```typescript
export function createToolsJsonForResponsesApi(tools: ToolSpec[]): unknown[] {
  return tools.map((tool) => {
    switch (tool.type) {
      case "function":
        return {
          type: "function",
          name: tool.name,
          description: tool.description,
          strict: tool.strict,
          parameters: tool.parameters,
        };
      case "local_shell":
        return {type: "local_shell"};
      case "web_search":
        return {type: "web_search"};
      case "custom":
        return {
          type: "custom",
          name: tool.name,
          description: tool.description,
          format: tool.format,
        };
    }
  });
}
```

**This is the EXACT format OpenAI expects. Port this function unchanged.**

---

### **Tool Schema Format (Chat Completions API / Anthropic)**

**From v1 (tool-converters.ts lines 72-93):**

```typescript
export function createToolsJsonForChatCompletionsApi(tools: ToolSpec[]): unknown[] {
  return tools
    .filter((tool) => tool.type === "function")  // Only function tools supported
    .map((tool) => {
      if (tool.type === "function") {
        return {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            strict: tool.strict,
            parameters: tool.parameters,
          },
        };
      }
      throw new Error("Unreachable: non-function tool after filter");
    });
}
```

**Chat Completions API only supports function tools** (no local_shell, web_search, custom).

**Anthropic uses same format** (Chat Completions compatible).

---

### **Integration Point: OpenAI Adapter**

**Current request (openai-adapter.ts line 92-102):**

```typescript
const reqBody = {
  model: this.model,
  input: [
    {
      role: "user",
      content: [{type: "input_text", text: params.prompt}],
    },
  ],
  stream: true,
  reasoning: {effort: "medium"},
};
```

**Enhanced request (ADD these fields):**

```typescript
const reqBody = {
  model: this.model,
  input: [...],
  stream: true,
  reasoning: {effort: "medium"},
  tools: params.tools ? formatToolsForResponsesApi(params.tools) : undefined,  // ← ADD
  tool_choice: params.tools?.length > 0 ? "auto" : undefined,                   // ← ADD
};
```

**If tools is undefined or empty:** Omit fields entirely (not null, not empty array).

---

### **Integration Point: Submit Route**

**Current submit handler (submit.ts line 137-151):**

```typescript
await adapter.stream({
  prompt: body.prompt,
  runId,
  turnId,
  threadId: body.threadId,
  agentId: body.agentId,
  traceContext,
});
```

**Enhanced (ADD tools):**

```typescript
import {toolRegistry} from 'codex-ts/src/tools/registry.js';

// Get all registered tools
const availableTools = toolRegistry.getAll().map(tool => tool.spec);

await adapter.stream({
  prompt: body.prompt,
  runId,
  turnId,
  threadId: body.threadId,
  agentId: body.agentId,
  traceContext,
  tools: availableTools,  // ← ADD
});
```

**This makes tools available to ALL adapter.stream() calls.**

---

### **Anthropic max_tokens Fix**

**Current Anthropic adapter likely has:**
```typescript
const reqBody = {
  model: this.model,
  messages: [...],
  stream: true,
  max_output_tokens: 4096,  // ← WRONG field name
};
```

**Fixed:**
```typescript
const reqBody = {
  model: this.model,
  messages: [...],
  stream: true,
  max_tokens: this.maxOutputTokens || 4096,  // ← CORRECT field name
  // Also add tools if provided:
  tools: params.tools ? formatToolsForChatApi(params.tools) : undefined,
};
```

**Anthropic API changed:** `max_output_tokens` → `max_tokens`

---

### **Usage Metrics Extraction (OpenAI)**

**When processing response_done chunk:**

```typescript
// openai-adapter.ts - in chunk processing loop

if (chunk.type === 'response_done') {
  const doneEvent = this.makeEvent(trace, runId, {
    type: 'response_done',
    response_id: runId,
    status: 'complete',
    usage: chunk.usage || undefined,  // ← Extract from chunk
    finish_reason: chunk.finish_reason || null
  });
  await this.redis.publish(doneEvent);
}
```

**OpenAI includes usage in response_done chunk.** Just pass it through.

---

## WORKFLOW STEPS

### **Step-by-Step Process:**

1. **Create Tool Formatter Module**
   ```bash
   mkdir -p src/core/tools
   touch src/core/tools/schema-formatter.ts
   ```

2. **Port Tool Converters from v1**
   - Copy `createToolsJsonForResponsesApi()` from v1 (tool-converters.ts lines 30-58)
   - Copy `createToolsJsonForChatCompletionsApi()` from v1 (lines 72-93)
   - Import ToolSpec type: `import {ToolSpec} from 'codex-ts/src/core/client/client-common.js'`
   - Export both functions

3. **Add Tools to StreamParams Interface**
   ```typescript
   // src/core/adapters/openai-adapter.ts (line 19)

   interface StreamParams {
     prompt: string;
     runId?: string;
     // ... existing params
     tools?: ToolSpec[];  // ← ADD
   }
   ```

4. **Update OpenAI Adapter Request**
   - Import `formatToolsForResponsesApi` from schema-formatter
   - Add tools and tool_choice to reqBody (line 92)
   - Extract usage from response_done chunk

5. **Verify OpenAI**
   ```bash
   npm run test:smoke -- -t "TC-SMOKE-05"
   npm run test:smoke -- -t "TC-SMOKE-01"  # Verify usage
   ```

6. **Update Anthropic Adapter**
   - Fix max_tokens field name
   - Add tools array
   - Import `formatToolsForChatApi`

7. **Verify Anthropic**
   ```bash
   npm run test:smoke -- -t "TC-SMOKE-02"
   npm run test:smoke -- -t "TC-SMOKE-04"
   ```

8. **Wire Tools Through Submit**
   - Import toolRegistry
   - Get all tools
   - Pass to adapter.stream()

9. **Run Full Smoke Suite**
   ```bash
   npm run test:smoke
   ```

10. **Update TEST_RESULTS.md**
    - Document smoke test results
    - Note which tests now pass
    - Document cost/token usage

---

## CRITICAL CONSTRAINTS

### **DO NOT:**

**❌ Reinvent tool schemas** (convergent default: build from scratch)
- Port existing converters from v1
- Schema format is proven to work
- Don't "improve" or "simplify"

**❌ Mock tool calls in smoke tests** (convergent default: add fixture)
- Real LLMs must return function_call
- Smoke tests validate real provider behavior
- If test fails, fix adapter (not test)

**❌ Make tools required** (convergent default: always include)
- Tools are optional
- Only include if tools provided
- Omit field if undefined (not null or [])

**❌ Change ToolSpec types** (convergent default: create new types)
- Use existing ToolSpec from codex-ts
- Don't create parallel type system
- Maintain compatibility with v1 tool registry

---

### **DO:**

**✅ Port v1 logic exactly**
- Copy createToolsJson functions
- Keep same schema format
- Proven implementation

**✅ Test incrementally**
- OpenAI first (simpler)
- Then Anthropic
- Verify each before moving on

**✅ Fix Anthropic max_tokens**
- This is a separate bug (API requirement changed)
- Fix while adding tools

**✅ Extract usage metrics**
- OpenAI provides in response_done
- Pass through to StreamEvent
- Validates TC-SMOKE-01

---

## CODE QUALITY STANDARDS

### **Mandatory Quality Gates:**

- ✅ TypeScript: Zero errors (`npx tsc --noEmit`)
- ✅ ESLint: Zero errors (`npm run lint`)
- ✅ Smoke tests: At least 4/6 passing (OpenAI tests + Anthropic basic)
- ✅ Format: Prettier (`npm run format`)

### **Verification Command:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npm run test:smoke
```

**Expected:** 4-5 smoke tests passing after fixes.

---

## DEBUGGING GUIDANCE

### **If TC-SMOKE-05 Still Fails After Adding Tools:**

**Check:**
1. **Tools actually in request?**
   ```typescript
   console.log('Request body:', JSON.stringify(reqBody, null, 2));
   // Verify tools array present
   ```

2. **Tool schemas valid?**
   - Check parameters format matches OpenAI spec
   - Verify function type tools included

3. **LLM response includes function_call?**
   - Check raw API response
   - May need better prompt or different model

---

### **If Anthropic Tests Still Fail:**

**Check:**
1. **max_tokens field name correct?**
   - Must be `max_tokens` (not max_output_tokens)

2. **Tools format correct for Messages API?**
   - Should match Chat Completions format
   - Anthropic uses same structure

---

## SESSION COMPLETION CHECKLIST

1. ✅ **Run verification command**
   ```bash
   npm run format && npm run lint && npx tsc --noEmit && npm run test:smoke
   ```

2. ✅ **Update TEST_RESULTS.md:**
   ```markdown
   ## Phase 5.3: Tool Support Integration

   **Smoke Test Results:** X/6 passing

   **Changes:**
   - Ported tool schema formatters from v1
   - Integrated tools in OpenAI adapter (Responses API)
   - Integrated tools in Anthropic adapter (Messages API)
   - Fixed Anthropic max_tokens requirement
   - Added usage extraction in OpenAI adapter
   - Wired tools through submit endpoint

   **Tests Now Passing:**
   - TC-SMOKE-01: OpenAI basic (usage captured)
   - TC-SMOKE-02: Anthropic basic (max_tokens fixed)
   - TC-SMOKE-04: Anthropic thinking (max_tokens fixed)
   - TC-SMOKE-05: OpenAI tool call (tools in request)

   **Remaining Issues:**
   - TC-SMOKE-03: OpenAI reasoning (may need model/config fix)
   - TC-SMOKE-06: Cross-provider (blocked by other failures)
   ```

3. ✅ **Commit work:**
   ```bash
   git add -A
   git commit -m "feat(adapters): integrate tool support from v1 to v2

   Ported tool schema formatting from codex-ts v1 and integrated into
   Core 2.0 streaming adapters. Fixes smoke test failures.

   ## Changes

   Tool Schema Formatting:
   - Ported createToolsJsonForResponsesApi() from v1
   - Ported createToolsJsonForChatCompletionsApi() from v1
   - Created src/core/tools/schema-formatter.ts

   OpenAI Adapter:
   - Added tools parameter to StreamParams
   - Include tools array in Responses API request
   - Added tool_choice: auto when tools present
   - Extract usage from response_done chunk

   Anthropic Adapter:
   - Fixed max_tokens field name (was max_output_tokens)
   - Added tools array to Messages API request
   - Tools formatted for Chat Completions compatibility

   Submit Endpoint:
   - Import toolRegistry from codex-ts
   - Get all registered tools
   - Pass to adapter.stream() calls

   ## Smoke Test Results

   Before: 0/6 passing
   After: X/6 passing (see TEST_RESULTS.md)

   TC-SMOKE-05 now validates real tool calls work end-to-end.

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

4. ✅ **Report summary:**
   - Tool formatters ported (~100 lines)
   - Adapters updated (~80 lines total)
   - Submit route updated (~30 lines)
   - Smoke tests: X/6 passing
   - Cost: ~$0.02 (real API calls)
   - Bugs fixed: tool calls, usage metrics, max_tokens

5. ✅ **Document Recommended Improvements:**

   After completing the port, provide a detailed analysis of recommended improvements to the tool calling system, ordered by importance:

   ```markdown
   ## Recommended Improvements - Tool Support System

   **Priority 1 (High Impact):**
   1. [Improvement name]
      - Current limitation: [What's suboptimal]
      - Recommended fix: [How to improve]
      - Effort: [Hours/days estimate]
      - Rationale: [Why this matters]

   **Priority 2 (Medium Impact):**
   2. [Improvement]
      - Current limitation:
      - Recommended fix:
      - Effort:
      - Rationale:

   **Priority 3 (Nice-to-Have):**
   3. [Improvement]
      - ...
   ```

   Focus on:
   - Architectural improvements (better patterns observed during port)
   - Missing features (tool_choice strategies beyond "auto")
   - Error handling gaps (tool call failures, validation)
   - Performance optimizations (caching, parallel execution)
   - Testing gaps (additional scenarios to cover)
   - Provider-specific enhancements (leverage unique capabilities)

   **Base recommendations on:**
   - What you learned porting from v1
   - Differences between v1 and v2 architecture
   - Smoke test results and failures
   - Real API behavior observed
   - Integration friction points encountered

---

## STARTING POINT

**BEGIN by:**

1. Reading v1 tool-converters.ts (understand exact schema format)
2. Creating src/core/tools/schema-formatter.ts
3. Porting both converter functions exactly
4. Updating OpenAI adapter (add tools param, integrate at line 92)
5. Running TC-SMOKE-05 to verify tool calls work
6. Updating Anthropic adapter (max_tokens + tools)
7. Running TC-SMOKE-02 to verify basic Anthropic works
8. Running full smoke suite

**Focus on porting proven v1 logic, not inventing new schemas.**

---

## EXPECTED OUTCOME

After this session:
- ✅ Tool schema formatters ported from v1
- ✅ OpenAI adapter includes tools in requests
- ✅ Anthropic adapter fixed (max_tokens + tools)
- ✅ Submit endpoint wires tools through
- ✅ 4-5 smoke tests passing (up from 0/6)
- ✅ Real tool calls validated end-to-end

**Remaining failures acceptable:**
- TC-SMOKE-03 (reasoning) may need model config research
- TC-SMOKE-06 (cross-provider) may need additional fixes

**The goal is to prove tool support works with real APIs, not to achieve 6/6 perfection.**

---

## NOTES

### **ToolSpec Type Location**

```typescript
// Import from v1
import {ToolSpec} from 'codex-ts/src/core/client/client-common.js';

// ToolSpec is a discriminated union:
type ToolSpec = FunctionTool | LocalShellTool | WebSearchTool | CustomTool

interface FunctionTool {
  type: 'function';
  name: string;
  description: string;
  strict?: boolean;
  parameters: JSONSchema;  // JSON Schema object
}
```

**This type already exists and is used by ToolRegistry.** Don't recreate it.

---

### **Tool Registry Usage**

```typescript
import {toolRegistry} from 'codex-ts/src/tools/registry.js';

// Get all tools
const registeredTools = toolRegistry.getAll();  // Returns RegisteredTool[]

// Each RegisteredTool has:
{
  metadata: ToolMetadata,  // Contains name, description, requiresApproval
  spec: ToolSpec,          // The API schema
  execute: Function        // Tool implementation
}

// Extract specs only:
const specs = registeredTools.map(t => t.spec);
```

**This is what you pass to adapters.**

---

### **Cost Note**

**Each smoke test run costs ~$0.02-0.03:**
- OpenAI calls: ~$0.01 (gpt-5-mini is cheap)
- Anthropic calls: ~$0.01 (claude-haiku-4.5 is cheap)

**Run frequency:**
- After this implementation: Verify fixes
- Then: Weekly or before releases
- Not: Every commit or in CI

---

### **Success Criteria**

**Minimum for phase complete (ALL must pass):**
- ✅ Format: Clean (`npm run format`)
- ✅ Lint: Zero errors (`npm run lint`)
- ✅ TypeScript: Zero errors (`npx tsc --noEmit`)
- ✅ **These specific smoke tests passing:**
  - TC-SMOKE-01: OpenAI basic + usage metrics
  - TC-SMOKE-02: Anthropic basic with max_tokens
  - TC-SMOKE-05: OpenAI tool call end-to-end

**Complete this scope and report back for next steps.**

Remaining tests (TC-SMOKE-03, TC-SMOKE-04, TC-SMOKE-06) will be addressed in follow-up work based on these results.
