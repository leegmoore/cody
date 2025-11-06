# Script-Based Tool Harness Design Consultation

**Role:** Senior Security Engineer, Principal Engineer & Runtime Architecture Expert

**Task:** Design a secure, script-based tool harness that allows LLMs to execute TypeScript code in a sandboxed runtime, calling Codex tools programmatically instead of via structured tool calls.

---

## Project Context

**Project:** Codex TypeScript Port (`@openai/codex-core`)
**Current Phase:** Phase 4 (Model Integration)
**Repository:** `/Users/leemoore/code/codex-port-02`

**Status:**
- Phase 1-3: ✅ Complete (protocol, config, execution, tools)
- Phase 4.1: ✅ Complete (OpenAI client with Responses + Chat APIs)
- Phase 4.2: 🔄 In Progress (Anthropic Messages API integration)
- Phase 4.4: ⏳ Planning (Script harness - THIS CONSULTATION)

**Total progress:** 866 tests passing (protocol, core, tools, client)

---

## Current Tool Execution Model

### Structured Tool Calls (Existing)

**Flow:**
```
Model API → ResponseItem (FunctionCall/LocalShellCall/CustomToolCall)
→ ToolRouter.build_tool_call() → Parse arguments
→ ToolRegistry → Lookup handler
→ Execute tool (apply_patch, exec, file_search, etc.)
→ ResponseInputItem (output) → Back to model
```

**Example model response:**
```json
{
  "type": "function_call",
  "name": "apply_patch",
  "arguments": "{\"patch\": \"--- a/file\\n+++ b/file\\n...\"}",
  "call_id": "call_123"
}
```

### Relevant Code

**Tool routing:**
- `codex-rs/core/src/tools/router.rs` (lines 1-100) - Routes ResponseItem → ToolCall
- `codex-rs/core/src/response_processing.rs` - Processes model responses

**Tool execution:**
- `codex-rs/core/src/tools/orchestrator.rs` - Executes tools
- `codex-rs/core/src/tools/parallel.rs` - Parallel execution
- `codex-rs/core/src/tools/handlers/` - Individual tool implementations

**TypeScript port (current):**
- `codex-ts/src/core/tools/` - Tool utilities
- `codex-ts/src/core/client/tool-converters.ts` - Format conversion
- `codex-ts/src/apply-patch/` - Patch tool
- `codex-ts/src/file-search/` - Search tool
- `codex-ts/src/core/exec/` - Execution tool

---

## Proposed Script-Based Harness

### Concept

Allow models to write TypeScript code that calls tools programmatically:

**Model response:**
```xml
<tool-calls>
const patch = await tools.applyPatch({
  patch: "--- a/file\n+++ b/file\n..."
});
const result = await tools.exec({
  command: ["npm", "test"]
});
return {
  patchApplied: patch.success,
  testsPass: result.exitCode === 0,
  message: `Tests ${result.exitCode === 0 ? 'pass' : 'fail'}`
};
</tool-calls>
```

**Execution:**
1. Detect `<tool-calls>` XML tags in model response
2. Extract TypeScript code
3. Execute in sandboxed runtime (QuickJS preferred, but recommend alternatives if better)
4. Wire in available tools as async functions
5. Provide execution context object with runtime state
6. Capture return value
7. Send back to model as tool output

**Note:** We prefer QuickJS for its lightweight nature and good sandboxing, but if you identify a superior alternative (isolated-vm, etc.) with better security, performance, or async handling, please recommend it with justification.

### Benefits

**For models:**
- ✅ Compose multiple tool calls
- ✅ Conditional logic (if patch succeeds, then...)
- ✅ Custom return formats
- ✅ Parallel execution (Promise.all)
- ✅ Error handling (try/catch)

**For us:**
- ✅ API-agnostic (works with Responses/Chat/Messages)
- ✅ More powerful than structured calls
- ✅ Models can innovate on tool usage
- ✅ Optional feature (doesn't break existing)

---

## Security Requirements (CRITICAL)

### Threat Model

**What we must prevent:**
1. **Sandbox escapes** - Access to process, require(), filesystem outside tools
2. **Infinite loops** - Hanging execution
3. **Memory exhaustion** - Allocating unlimited memory
4. **Network access** - Arbitrary HTTP requests
5. **Prototype pollution** - Manipulating JavaScript prototypes
6. **Code injection** - Breaking out of QuickJS context
7. **Resource leaks** - Not cleaning up VM contexts

### Security Constraints

**Must enforce:**
- ✅ Execution timeout (default: 30s, configurable)
- ✅ Memory limit (default: 100MB)
- ✅ No access to Node.js APIs (fs, child_process, etc.)
- ✅ No require() or import()
- ✅ Only exposed tools callable
- ✅ No prototype manipulation
- ✅ No global state persistence between executions
- ✅ Clean VM teardown

**Tools exposure:**
- Only bind tools from ToolRegistry
- Each tool gets its own approval flow (if configured)
- No tool can access another tool's internal state
- All tool calls logged for security audit

---

## Design Questions

### 1. Runtime Choice

**Options:**
- **QuickJS** (quickjs-emscripten): Full ES2020, async/await support, sandboxed
- **Isolated-VM** (v8-based): Stronger isolation, heavier
- **VM2** (deprecated): Don't use
- **Custom interpreter**: Too much work

**Which runtime provides best security/performance trade-off?**

### 2. Tool Binding Strategy

**How to expose tools to sandbox:**

**Option A: Direct binding**
```ts
vm.global.set('tools', {
  applyPatch: (args) => handler.execute(args),
  exec: (args) => handler.execute(args)
});
```

**Option B: Proxy pattern**
```ts
vm.global.set('tools', new Proxy({}, {
  get: (target, prop) => validateAndGetTool(prop)
}));
```

**Which is more secure? How to handle async functions?**

### 3. Approval Flow Integration

**Current approval system:**
- Tools like `exec` require user approval before execution
- Approval happens in ToolOrchestrator

**With scripts:**
- Script calls `await tools.exec()` → blocks on approval
- How to surface approval request from sandbox?
- How to resume script after approval?

**Design needed:** Approval mechanism that works from sandbox

### 4. Error Handling

**Scenarios:**
- Script has syntax error
- Script calls non-existent tool
- Tool execution fails
- Script times out
- Script throws exception

**Questions:**
- Which errors are retryable vs fatal?
- How to report errors back to model?
- How to preserve partial results?
- Stack trace sanitization?

### 5. Return Value Formatting

**Model returns arbitrary shape:**
```ts
return { files: [...], testsPassed: true, summary: "..." };
```

**How to convert to ResponseInputItem?**
- Serialize as JSON string?
- Structured FunctionCallOutputPayload?
- New CustomScriptOutput type?

### 6. Streaming & Progress

**Can we stream partial results?**
- Script calls tools sequentially
- Can we emit events as each tool completes?
- Or all-or-nothing at script completion?

**If streaming:**
- How to handle script errors mid-execution?
- Can model see partial state?

### 7. Feature Flagging

**How to enable:**
- Global config (`enable_script_harness: true`)?
- Per-provider config?
- Per-turn flag?
- Always-on with detection?

**Recommendation needed.**

### 8. Testing Strategy

**Security tests:**
- Attempt sandbox escape (require, process, etc.)
- Infinite loop detection
- Memory exhaustion
- Prototype pollution
- Code injection attempts

**Functional tests:**
- Basic script execution
- Multiple tool calls (serial)
- Multiple tool calls (parallel with Promise.all)
- Error handling
- Approval flow
- Return value shapes
- Timeout enforcement

**Integration tests:**
- Works with Responses API
- Works with Chat API
- Works with Messages API
- Compatible with existing tools

**Minimum test count:** Estimate needed

---

## Technical Constraints

### Must Maintain

1. **Existing tool harness still works** - Script harness is additive, not replacement
2. **Security boundaries** - Sandbox is truly isolated
3. **Approval system respected** - Tools requiring approval still get it
4. **Cross-API compatibility** - Works with all 3 providers
5. **Performance acceptable** - Script overhead < 100ms
6. **Test coverage** - Comprehensive security + functional tests

### Can Modify

7. **Tool registration** - May need script-specific tool wrappers
8. **Response processing** - Add script detection layer
9. **Protocol types** - May need new CustomScriptCall ResponseItem variant
10. **Error types** - Add script-specific errors

---

## Reference Materials

### Codex Architecture

**Tool system:**
- `codex-rs/core/src/tools/router.rs` - Tool routing
- `codex-rs/core/src/tools/registry.rs` - Tool registry
- `codex-rs/core/src/tools/orchestrator.rs` - Tool execution
- `codex-rs/core/src/tools/handlers/` - Individual tools
- `codex-rs/core/src/response_processing.rs` - Response handling

**Current TS port:**
- `codex-ts/src/core/tools/` - Tool utilities
- `codex-ts/src/core/client/` - Client infrastructure
- `codex-ts/src/apply-patch/` - Patch tool
- `codex-ts/src/file-search/` - Search tool
- `codex-ts/src/core/exec/` - Exec tool

**Available tools to expose:**
- `applyPatch` - File modifications
- `exec` - Command execution
- `fileSearch` - Fuzzy file search
- MCP tools (if connected)
- Custom tools (extensible)

### Security Resources

**QuickJS:**
- **Package:** `quickjs-emscripten` (npm)
- **Docs:** https://github.com/justjake/quickjs-emscripten
- **Security:** Isolated VM, no Node.js access by default

**Alternative runtimes:**
- **isolated-vm:** https://github.com/laverdet/isolated-vm (V8-based)
- **Comparison needed:** Security vs performance vs complexity

---

## Deliverables Required

### 1. Security Analysis

**Provide:**
- Threat model for script execution
- Attack vectors and mitigations
- Recommended runtime (QuickJS vs isolated-vm vs other)
- Sandboxing configuration
- Resource limits (timeout, memory, CPU)
- Input validation requirements

### 2. Architecture Design

**Provide:**
- Where script detection happens (response_processing? tool router?)
- How script execution integrates with existing tool flow
- Tool binding mechanism (sync vs async)
- Approval flow design (how to pause script for approval)
- Error propagation strategy
- Return value normalization

**Include:**
- ASCII architecture diagram
- Data flow diagram
- Integration points with existing code
- File structure (where does script harness live?)

### 3. Tool Binding API

**Provide:**
- TypeScript API exposed to sandbox
- Which tools to expose (all? subset?)
- Async function handling
- Parameter validation
- Return value contracts

**Example:**
```ts
// What model sees in sandbox
const tools = {
  async applyPatch(args: {patch: string}): Promise<{success: boolean}> { ... },
  async exec(args: {command: string[]}): Promise<{exitCode: number, stdout: string}> { ... },
  // ...
};
```

### 4. Approval Flow Design

**Critical:** Scripts can call tools requiring approval.

**Design:**
- How to suspend script execution for approval
- How to surface approval request to user
- How to resume after approval/denial
- How to handle approval timeout
- Can script handle approval denial (try/catch)?

**Provide:** Complete approval integration design

### 5. Error Handling

**Provide:**
- Error types (syntax error, runtime error, timeout, tool error)
- Error message format back to model
- Partial result preservation
- Stack trace sanitization (don't leak system paths)
- Retry policy (which errors are retryable?)

### 6. Test Specifications

**Security tests (≥20):**
- Sandbox escape attempts
- Resource exhaustion tests
- Timeout enforcement
- Memory limits
- Prototype pollution attempts
- Code injection attempts

**Functional tests (≥30):**
- Basic execution
- Multiple tools (serial)
- Multiple tools (parallel)
- Error handling
- Approval flow
- Return value formats
- Timeout handling

**Integration tests (≥10):**
- Works with Responses API
- Works with Chat API
- Works with Messages API
- Compatible with existing structured calls
- Tool registry integration

**Provide:** Complete test suite specification with examples

### 7. Implementation Plan

**Step-by-step:**
1. Choose runtime and install dependencies
2. Create sandbox executor module
3. Implement tool binding layer
4. Add script detection to response processing
5. Integrate approval flow
6. Implement error handling
7. Add resource limits and security boundaries
8. Create test suite
9. Document usage and security considerations

**For each step:** Files to create, functions to implement, security checkpoints

### 8. Performance Analysis

**Provide:**
- Expected overhead (script parsing, VM initialization, execution)
- Comparison to structured tool calls
- Optimization strategies
- Caching opportunities (can we reuse VM contexts?)

### 9. Documentation Requirements

**Provide outline for:**
- User guide (how to write scripts)
- Security documentation (what's allowed/forbidden)
- Tool API reference (what tools expose)
- Error handling guide
- Migration guide (structured → script for specific use cases)

---

## Specific Technical Questions

### Runtime Selection

**QuickJS (quickjs-emscripten):**
- Pros: Lightweight, ES2020, async/await, sandboxed by default
- Cons: Limited standard library, async bridge complexity
- Security: Good isolation, no Node.js access

**isolated-vm (V8-based):**
- Pros: V8 engine, strong isolation, transfer handles
- Cons: Heavier, more complex API
- Security: Excellent isolation, proven in production

**Which should we use? Why?**

### Async Function Bridging

**Challenge:** Sandbox needs to call async Codex tools.

**QuickJS approach:**
```ts
const toolHandle = vm.newAsyncifiedFunction('applyPatch', async (argsHandle) => {
  const args = vm.dump(argsHandle);
  const result = await realApplyPatch(args);
  return vm.newString(JSON.stringify(result));
});
```

**isolated-vm approach:**
```ts
const applyPatch = new ivm.Reference(async (args) => {
  return await realApplyPatch(args);
});
context.global.setSync('tools', { applyPatch });
```

**Which is cleaner/safer? Provide complete implementation.**

### Resource Limits

**What limits to enforce:**
- Execution timeout?
- Memory limit?
- Call stack depth?
- Number of tool calls per script?
- Output size limit?

**How to enforce in chosen runtime?**

### Tool Capability Exposure

**Which tools to expose:**
- apply_patch?
- exec? (dangerous - needs extra sandboxing)
- file_search?
- MCP tools?
- web_search?

**Should some tools be forbidden in scripts? Which and why?**

### Approval Integration

**Current approval system** (from Rust):
```rust
// In tool execution
if tool_requires_approval(name) {
  send_approval_request(tool_name, args);
  wait_for_approval_response();
  if denied { return error; }
}
execute_tool();
```

**With scripts:**
```ts
// Model writes:
try {
  const result = await tools.exec({command: ["rm", "-rf", "/"]});
} catch (err) {
  // Approval denied? Tool failed?
}
```

**How to:**
- Pause script execution for approval?
- Surface approval request outside sandbox?
- Resume script after approval?
- Handle approval denial gracefully?

**Provide complete design.**

### Cross-Provider Compatibility

**All 3 APIs return text in messages:**
- Responses: `content: [{type: 'output_text', text}]`
- Chat: `content: [{type: 'output_text', text}]`
- Messages: `content: [{type: 'text', text}]`

**Detection code:**
```ts
function detectScriptToolCall(item: ResponseItem): string | null {
  if (item.type === 'message' && item.role === 'assistant') {
    const text = extractTextContent(item);
    const match = text.match(/<tool-calls>(.*?)<\/tool-calls>/s);
    return match?.[1] || null;
  }
  return null;
}
```

**Questions:**
- Is XML tag approach robust enough?
- Should we support code blocks (```ts) as alternative?
- How to handle malformed XML?
- What if model puts multiple `<tool-calls>` blocks?

---

## Consultation Scope

### In Scope (Design These)

1. ✅ Security model and threat mitigation
2. ✅ Runtime selection with justification
3. ✅ Tool binding API and implementation
4. ✅ Approval flow integration
5. ✅ Error handling strategy
6. ✅ Resource limits and enforcement
7. ✅ Test suite specification (security + functional)
8. ✅ Implementation plan
9. ✅ Performance analysis
10. ✅ Documentation outline

### Out of Scope (Acknowledge But Don't Design)

- ❌ Individual tool implementations (already exist)
- ❌ Model training/prompting strategies
- ❌ UI for script debugging
- ❌ Production monitoring/telemetry

---

## Success Criteria

Your design is successful if:

1. ✅ **Secure:** No realistic sandbox escape vectors
2. ✅ **Safe:** Resource limits prevent DoS
3. ✅ **Functional:** Models can compose tools effectively
4. ✅ **Compatible:** Works with all 3 APIs (Responses/Chat/Messages)
5. ✅ **Tested:** Comprehensive security + functional test suite
6. ✅ **Implementable:** Clear step-by-step plan
7. ✅ **Performant:** Overhead < 100ms for simple scripts
8. ✅ **Maintainable:** Clean architecture, well-documented

---

## Complexity Estimate Required

**Provide estimate:**
- Implementation time
- Test development time
- Security review time
- Documentation time

**Identify:**
- Highest risk areas
- Most complex components
- Dependencies on other phases
- Blockers or unknowns

---

## Context for Decision Making

**Why we want this:**
- More powerful tool orchestration
- Models can innovate on tool usage
- Better error recovery (try/catch in scripts)
- Competitive differentiation (unique feature)

**Concerns:**
- Security risks
- Implementation complexity
- Model reliability (will they use it correctly?)
- Maintenance burden

**Your job:** Assess feasibility, design securely, provide implementation path.

---

## Output Instructions

**Write your complete design document to:**
`/Users/leemoore/code/codex-port-02/SCRIPT_HARNESS_DESIGN.md`

(Update filename as needed for multiple consultations)

**Format:** Markdown with:
- Executive summary (feasibility, complexity, recommendation)
- Security analysis (threats, mitigations, runtime choice)
- Architecture design (diagrams, integration points)
- Tool binding API (TypeScript interfaces, examples)
- Approval flow design (complete mechanism)
- Error handling (types, propagation, recovery)
- Test specifications (security + functional, ≥60 tests)
- Implementation plan (step-by-step with checkpoints)
- Risk assessment (high/medium/low risks with mitigations)
- Performance analysis (overhead, optimizations)
- Documentation outline

**Length:** As thorough as needed - security requires detail.

---

## Begin Consultation

Design a secure, implementable script-based tool harness for Codex.

Focus on:
- **Security first** - This is runtime code execution
- **Practical approval flow** - Must work with existing system
- **Clean integration** - Doesn't break existing harness
- **Comprehensive testing** - Security boundaries well-tested
- **Clear implementation** - Developers can build from your design

**Be thorough. Security is paramount. This is high-risk, high-value work.**
