# Script-Based Tool Harness Design for Codex TypeScript
*Design Version: 1.0 – Date: November 6, 2025*
*Authors: Merged consultation from Codex, Codex-CLI, and GPT-5-Pro*

---

## Executive Summary

This document designs a secure, script-based tool harness which allows language models to embed and execute TypeScript snippets that call Codex tools programmatically, within a hardened sandbox. The harness is additive to existing structured tool calls and integrates cleanly across OpenAI Responses, Chat Completions, and Anthropic Messages APIs.

**Recommendation highlights:**

- **Runtime:** Default to QuickJS (`quickjs-emscripten`) for portability, zero native dependencies, and good isolation. Provide isolated-vm (V8) as optional runtime for high-security environments or workloads requiring >128MB heap.
- **Security:** Strict isolation via WASM sandbox, no Node.js APIs, no require/import, frozen intrinsics (Object, Array, Function, Promise), time/memory/output limits, denial of orphaned promises, tool-scoped approvals, and comprehensive auditing.
- **Integration:** Detect `<tool-calls>` blocks (and fenced alternatives) in assistant messages, stream progress as tools complete, return normalized "script" tool output, and preserve all non-code text (including thinking blocks) in original order.
- **Promise lifecycle:** Track all tool Promises via PromiseTracker; enforce resolution before script completion or explicit cancellation; abort unresolved Promises when scripts end.
- **Performance:** Reuse workers with fresh contexts per run; overhead target < 100ms for simple scripts; pool workers sized to CPU cores.

**Feasibility:** High. The proposal reuses existing tool orchestration and approval logic, adds a pluggable runtime adapter, and maintains compatibility with conversation history semantics.

**Implementation estimate:** 13 engineer-weeks total (6 implementation, 3.5 testing, 2 security review, 1.5 documentation). Work parallelizable across components.

**Recommendation:** Adopt with phased rollout (dry-run alpha → beta → GA after security signoff).

---

## 1. Security Analysis

### 1.1 Threat Model & Mitigations

| Threat | Attack Vector | Impact | Mitigations |
|--------|---------------|--------|-------------|
| **Sandbox escape** | Script mutates `Object.prototype`, accesses `Function.constructor`, or stomps injected objects | Execute arbitrary host code | Freeze and deep-clone all injected objects, run in fresh QuickJS runtime per execution, seal Object/Array/Function/Promise, disable eval, enforce WASM boundary |
| **Host access** | Attempts `require`, `import`, `process`, `fs`, WASI syscalls | Data exfiltration, system compromise | QuickJS WASM without stdlib bindings, sealed global, AST scan for banned identifiers, membrane proxies for all tool exposure |
| **Infinite loops** | `while(true){}` or microtask flooding | CPU exhaustion, DoS | `JS_SetInterruptHandler` watchdog (every 2ms or 1k opcodes) + wall-clock timer (30s default), hard-kill worker on double timeout |
| **Memory exhaustion** | `new Array(1e9)`, object churn | Host crash | `runtime.setMemoryLimit(96MB)`, `setMaxStackSize(512KB)`, worker RSS monitoring, abort above limit |
| **Prototype pollution** | Store state on shared objects across runs | Persistent compromise | No worker reuse unless context reset validated, use structuredClone for return values, fresh runtime per script |
| **Tool abuse** | Call tools.exec without approval | Privilege escalation | Tool facade routes through Tool Orchestrator, existing approval prompts fire, audit log with script ID |
| **Network egress** | Try to use fetch/WebSocket | Policy violation | QuickJS build excludes networking, no fetch polyfill, only approved tools.http if explicitly enabled |
| **Orphaned promises** | Launch async tool and exit early | Resource leak | PromiseTracker with AbortControllers, unresolved promises aborted on completion, 250ms grace then force-reject |
| **Code injection** | Crafted return values break serialization | Host crash | Strict JSON serialization with safeStringify (depth limit 8), output cap 128KB, escape control chars |

### 1.2 Runtime Selection & Justification

**Primary Runtime: QuickJS** (`quickjs-emscripten` async module)

**Why QuickJS:**
- **Zero native dependencies** - Works in Docker, Electron, browsers, edge workers
- **No build toolchain** - npm install just works, no node-gyp pain
- **Portable** - Same code runs on ARM/x86, Windows/Linux/macOS
- **Lightweight** - ~800KB WASM, minimal memory footprint
- **Good isolation** - WASM sandbox + worker threads = defense in depth
- **Async/await support** - Native via Asyncify
- **Adequate security** - For controlled LLM outputs (not public multi-tenant)

**Why NOT isolated-vm:**
- Requires native build (blocks deployment in many environments)
- Node version updates break it (recompilation needed)
- Heavier (~5MB + native deps)
- Platform-specific build issues (ARM, Windows)

**Optional Fallback: isolated-vm** (V8 isolates)

**When to use:**
- High-security requirements (financial, medical, regulated industries)
- Workloads needing >128MB heap
- Enterprise customers demanding V8 guarantees
- **Enabled via:** `scriptHarness.runtime: "isolated-vm"` config

**Both runtimes share same `ScriptRuntimeAdapter` interface** - can switch without code changes.

### 1.3 Sandboxing Configuration

**Worker Thread Strategy:**
- Dedicated worker per execution using Node.js `worker_threads`
- Worker pre-loads QuickJS WASM once, handles N scripts sequentially
- Pool size: min(2, CPU cores) workers (configurable)
- Termination: worker can be killed without affecting host

**Resource Limits (defaults, configurable per-provider):**
- `timeoutMs: 30000` (30 seconds)
- `memoryMb: 96`
- `maxStackBytes: 524288` (512KB)
- `maxSourceBytes: 20000` (20KB script length)
- `maxReturnBytes: 131072` (128KB)
- `maxToolInvocations: 32` per script
- `maxConcurrentToolCalls: 4`

**Interrupt Strategy:**
- Operation counter: QuickJS interrupt handler fires every 5000 opcodes
- Host checks deadline + cancellation token on each interrupt
- Wall timer: Node setTimeout kills worker at `timeoutMs + 2s` grace period
- Double timeout = hard worker termination

**Memory Enforcement:**
- QuickJS: `setMemoryLimit(96 * 1024 * 1024)`
- Worker monitors own RSS via `process.resourceUsage()`
- Overflow throws `HarnessOutOfMemoryError`

**Input Validation (before sandbox):**
- Ensure UTF-8, strip BOM
- Balanced XML tags (reject nested/malformed)
- Banned token scan: `require`, `import`, `new Function`, `eval` outside string literals
- Lightweight tokenizer validates structure
- Script must contain at most one top-level `return` (rest auto-wrapped)

### 1.4 Hardened Runtime Environment

**Frozen Intrinsics** (executed in sandbox on initialization):
```ts
// Freeze all built-in prototypes and constructors
Object.freeze(Object.prototype);
Object.freeze(Array.prototype);
Object.freeze(Function.prototype);
Object.freeze(Promise.prototype);
Object.freeze(Map.prototype);
Object.freeze(Set.prototype);
Object.freeze(WeakMap.prototype);
Object.freeze(WeakSet.prototype);
Object.freeze(Date.prototype);
Object.freeze(RegExp.prototype);
Object.freeze(Error.prototype);

// Remove dangerous constructors
delete globalThis.eval;
delete globalThis.Function;
delete globalThis.require;
delete globalThis.module;
delete globalThis.process;
delete globalThis.import;

// Seal global scope
Object.freeze(globalThis);
```

**Exposed Globals (minimal surface):**
- `tools` - Tool proxy (read-only, frozen)
- `context` - Execution context (read-only, frozen)
- `console` - Rate-limited logging proxy (log/warn/error only)
- Standard primitives (Object, Array, String, Number, Promise, etc.) - frozen

**Denied Access:**
- No Node.js APIs (fs, child_process, http, etc.)
- No require() or import()
- No setTimeout/setInterval (no background tasks)
- No fetch/XMLHttpRequest (unless explicitly via tools.http)
- No eval or Function constructor
- No access to host process/globals

---

## 2. Architecture Design

### 2.1 Component Overview & File Structure

```
codex-ts/src/core/script-harness/
├── detector.ts              # Scans ResponseItems for <tool-calls> blocks
├── parser.ts                # Validates XML/TS, extracts script + metadata
├── orchestrator.ts          # Main entry: coordinates runtime execution
├── runtime/
│   ├── types.ts             # ScriptRuntimeAdapter interface
│   ├── quickjs-runtime.ts   # QuickJS worker lifecycle, limits
│   ├── ivm-runtime.ts       # isolated-vm adapter (optional)
│   ├── executor.ts          # Wraps script, injects context/tools
│   └── promise-tracker.ts   # Tracks host promises, enforces lifecycle
├── tool-facade.ts           # Proxies ToolRegistry with approvals + logging
├── approvals-bridge.ts      # Suspends/resumes scripts for approval prompts
├── context.ts               # Constructs execution context object
├── serializer.ts            # Emits ResponseItems into conversation history
├── hardening.ts             # Intrinsic freezing, prelude generation
├── errors.ts                # Typed error classes
└── feature-flags.ts         # Enable/disable/dry-run mode handling

Supporting changes:
├── core/client/response-processing.ts  # Add script detection before ToolRouter
├── protocol/models.ts                  # Add ScriptToolCall/Output variants
└── core/tools/registry.ts              # Expose typed handles for facade
```

### 2.2 ASCII Architecture Diagram

```
+---------------------------+       +--------------------------+
| Response Processor        |       | Tool Orchestrator (host) |
| (stream of ResponseItems) |       | - Existing approvals     |
+------------+--------------+       | - Audit logging          |
             |                      +------+-------------------+
             v                             |
      +------+-------+                     |
      | Script       |                     |
      | Detector     |                     |
      +------+-------+                     |
             |                             |
             v                             |
      +------+-------+                     |
      | Script       |                     |
      | Orchestrator |<--------------------+
      +------+-------+        approval flow
             |
     +-------+--------+
     | Runtime Pool   |
     | (QuickJS       |
     |  Workers)      |
     +-------+--------+
             |
   +---------+----------+
   | Tool Facade        |
   | + Approvals Bridge |
   | + PromiseTracker   |
   +---------+----------+
             |
             v
   +---------+----------+
   | Tool Registry      |
   | (apply-patch,      |
   |  exec, file-search)|
   +--------------------+
             |
             v
    Conversation History
    (thinking + text + script + results)
```

### 2.3 Data Flow

```
Model Response (thinking + text + <tool-calls> + text)
    ↓
ScriptDetector.scan()
    ↓
Segments: [thinking, text, script, text]
    ↓
ResponseProcessor emits:
    - ResponseItem.reasoning (thinking)
    - ResponseItem.message (text before)
    - CustomToolCall "script" (code payload)
    ↓
ScriptOrchestrator.execute()
    ├─ RuntimePool.borrow() → QuickJS worker
    ├─ Executor.inject({context, tools})
    ├─ Script runs (await tools.applyPatch, etc.)
    ├─ ToolFacade → ToolOrchestrator → Approval Bridge
    ├─ PromiseTracker monitors async calls
    └─ Return value captured
    ↓
Serializer emits:
    - ScriptToolCallOutput (return value)
    - ResponseItem.message (text after)
    ↓
Conversation History (all preserved in order)
```

### 2.4 Protocol Extensions

Add to `codex-ts/src/protocol/models.ts`:

```typescript
export type ResponseItem =
  | ... // existing variants
  | ScriptToolCall
  | ScriptToolCallOutput;

export interface ScriptToolCall {
  type: 'script_tool_call';
  id: string;
  call_id: string;
  language: 'ts' | 'js';
  source_code: string;
  source_sha256: string;
  status: 'pending' | 'executing' | 'completed' | 'error';
}

export interface ScriptToolCallOutput {
  type: 'script_tool_call_output';
  id: string;
  call_id: string;
  output_json?: string; // Serialized return value
  error?: ScriptError;
  summary?: string; // If returned object contains 'message' field
  metadata: {
    duration_ms: number;
    tool_calls_made: number;
    memory_used_mb?: number;
  };
}
```

### 2.5 Context Injection

**Context object exposed to sandbox** (read-only, frozen):

```typescript
interface ScriptContext {
  // Identity
  conversationId: string;
  sessionId: string;
  turnId: string;
  scriptId: string;

  // Environment
  workingDirectory: string;
  provider: string;  // "openai" | "anthropic" | "ollama"
  model: string;

  // Sandbox limits
  sandbox: {
    timeoutMs: number;
    memoryMb: number;
    remainingToolBudget: number;
    maxConcurrentToolCalls: number;
    mode: 'disabled' | 'dry-run' | 'enabled';
  };

  // Capabilities
  capabilities: {
    tools: string[];  // Exposed tool names
  };

  // Approvals
  approvals: {
    required: boolean;
    lastRequestId?: string;
  };

  // Telemetry
  telemetry: {
    emitProgress(message: string, kind?: 'info' | 'warn'): void;
  };
}
```

**Injection:**
- Context is deep-frozen before injection
- Immutable inside sandbox (attempts to mutate throw)
- `context.telemetry.emitProgress` is host callback
- Validates string length, feeds ResponseEvent text deltas
- Rate limited: 1 event per 500ms, max 50 events per script

### 2.6 Model Output Integration

**Critical:** Models freely combine thinking, text, and scripts. ALL components preserved in conversation history.

**Example response:**
```xml
Let me fix the failing tests.

<thinking>
I'll search for test files, run them in parallel to identify failures,
then apply patches. This is the most efficient approach.
</thinking>

Starting the fix process now.

<tool-calls>
const tests = await tools.fileSearch({pattern: "*.test.ts", limit: 10});
const results = await Promise.all(
  tests.map(t => tools.exec({command: ["npm", "test", t.path]}))
);
const failed = results.filter(r => r.exitCode !== 0);
if (failed.length > 0) {
  const patch = generatePatch(failed);
  await tools.applyPatch({patch});
}
return {
  totalTests: tests.length,
  failed: failed.length,
  fixed: failed.length
};
</tool-calls>

All 3 failing tests have been fixed and are now passing!
```

**History integration:**
1. Text: "Let me fix..." → `ResponseItem.message`
2. Thinking block → `ResponseItem.reasoning`
3. Text: "Starting..." → `ResponseItem.message` (continued)
4. Script execution → `ResponseItem.script_tool_call` + `ResponseItem.script_tool_call_output`
5. Text: "All 3..." → `ResponseItem.message` (continued)

**All components appear in chronological order. Next turn has access to complete context (thinking + text + tool results).**

---

## 3. Tool Binding API

### 3.1 Sandbox-Visible TypeScript Interface

```typescript
// Available in sandbox as global 'tools'
declare const tools: {
  // File operations
  applyPatch(args: ApplyPatchArgs): Promise<PatchResult>;
  fileSearch(args: FileSearchArgs): Promise<FileSearchResult[]>;

  // Command execution (approval-gated)
  exec(args: ExecArgs & {
    approvalContext?: string; // Optional context for approval UI
  }): Promise<ExecResult>;

  // MCP tools (dynamically added, namespaced)
  mcp?: Record<string, (args: unknown) => Promise<unknown>>;

  // Explicitly detached tasks (disabled by default)
  spawn?: {
    exec(args: ExecArgs): { id: string; done: Promise<ExecResult> };
    cancel(id: string): Promise<boolean>;
  };

  // Optional network (if policy allows)
  http?: (args: HttpRequestArgs) => Promise<HttpResponse>;
};

// Type definitions matching existing tools
interface ApplyPatchArgs {
  patch: string;
}

interface PatchResult {
  success: boolean;
  summary?: string;
  changes?: Array<{path: string; kind: 'add'|'delete'|'update'}>;
}

interface ExecArgs {
  command: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  duration_ms: number;
}

interface FileSearchArgs {
  pattern: string;
  limit?: number;
  excludePatterns?: string[];
}

interface FileSearchResult {
  path: string;
  score: number;
  indices?: number[];
}
```

**Implementation:**
- `tools` is a frozen Proxy
- Property access validates against allowlist
- Unknown tools throw `ToolNotFoundError` synchronously
- All methods return host-backed Promises
- Arguments validated against JSON schemas (reuse existing tool schemas)
- Results are deep-frozen plain objects (immutable)

### 3.2 Promise Lifecycle & Async Handling

**PromiseTracker Design:**

```typescript
class PromiseTracker {
  private pending = new Map<string, {
    promise: Promise<any>;
    abort: AbortController;
    toolName: string;
    startTime: number;
  }>();

  register(toolName: string, promise: Promise<any>, abort: AbortController): string {
    const id = `tool_${this.pending.size}`;
    this.pending.set(id, { promise, abort, toolName, startTime: Date.now() });

    promise.finally(() => this.pending.delete(id));

    return id;
  }

  async ensureAllSettled(gracePeriodMs = 250): Promise<void> {
    if (this.pending.size === 0) return;

    // Abort all pending
    for (const [id, entry] of this.pending) {
      entry.abort.abort(new Error('Script completed with pending promises'));
    }

    // Grace period for cleanup
    await Promise.race([
      Promise.allSettled(Array.from(this.pending.values()).map(e => e.promise)),
      new Promise(resolve => setTimeout(resolve, gracePeriodMs))
    ]);

    // Force-reject any still pending
    if (this.pending.size > 0) {
      const leaked = Array.from(this.pending.keys());
      throw new DetachedPromiseError(`Orphaned promises: ${leaked.join(', ')}`);
    }
  }
}
```

**Critical Scenarios:**

**Scenario 1: Orphaned promise**
```ts
const slow = tools.exec({command: ["sleep", "10"]}); // Not awaited!
const fast = await tools.fileSearch({pattern: "*.ts"});
return fast.length; // Script ends
// → PromiseTracker aborts slow, waits 250ms, then completes
```

**Scenario 2: Promise.race**
```ts
const winner = await Promise.race([
  tools.exec({command: ["npm", "test"]}),
  tools.exec({command: ["npm", "run", "build"]})
]);
// → Losing promise aborted automatically
// → exec tool kills child process via AbortSignal
return winner;
```

**Scenario 3: Timeout mid-execution**
```ts
for (let i = 0; i < 100; i++) {
  await tools.exec({command: ["echo", i]});
  // Iteration 80 completes at 29.5s
  // Iteration 81 starts at 29.8s
  // Timeout hits at 30s - iteration 81 mid-flight
}
// → Worker interrupt fires
// → Current exec gets AbortSignal
// → PromiseTracker cancels iteration 81
// → Returns partial results (0-80 completed)
// → Throws TimeoutError with partial data
```

**Promise Lifecycle Rules:**
1. All `tools.*` calls register with PromiseTracker
2. Awaited promises are tracked until settled
3. Non-awaited promises are aborted when script completes
4. Promise.race losers are aborted immediately
5. Tools must honor AbortSignal for graceful cancellation
6. 250ms grace period for cleanup, then force-reject

---

## 4. Approval Flow Design

### 4.1 State Machine

```
IDLE
  ↓ tool requires approval
PENDING_APPROVAL
  ├─ user approves → APPROVED → EXECUTING → COMPLETE
  └─ user denies/timeout → DENIED → throws into script
```

### 4.2 Integration with Existing System

**Flow:**
1. Script calls `await tools.exec({command: ["rm", "file.txt"]})`
2. ToolFacade inspects tool metadata
3. If approval required:
   - Emits `ApprovalRequestCreated` event (existing framework)
   - Tags with `scriptCallId` for correlation
   - Returns pending Promise (does not resolve yet)
   - Script execution pauses (Asyncify suspends stack)
4. Approval surfaces to user with:
   - Tool name
   - Sanitized arguments
   - Script context (snippet showing the call)
5. User responds:
   - **Approved:** Promise resolves with tool execution result, script resumes
   - **Denied:** Promise rejects with `ApprovalDeniedError`, script can catch
   - **Timeout:** Promise rejects with `ApprovalTimeoutError` after configured SLA

**Asyncify Mechanism:**
- QuickJS async runtime naturally suspends on awaited Promise
- Host holds Promise resolver
- When user responds, host resolves/rejects
- QuickJS resumes execution at exact await point

**Script-side error handling:**
```ts
try {
  const result = await tools.exec({command: ["rm", "-rf", "/"]});
  return {deleted: true};
} catch (err) {
  if (err.name === 'ApprovalDeniedError') {
    return {deleted: false, reason: 'User denied'};
  }
  throw err; // Other errors propagate
}
```

**Approval UI:**
- Shows script metadata (file, line number if available)
- Existing approval UI extended with script context
- Audit log includes script ID for tracking

---

## 5. Error Handling Strategy

### 5.1 Complete Error Taxonomy

| Error Type | Cause | Retryable? | Reported To Model |
|------------|-------|------------|-------------------|
| `ScriptSyntaxError` | Parser/TypeScript compilation failure | Yes (model can rewrite) | Error item with diagnostics (line/col), no host paths |
| `ScriptTimeoutError` | Wall-clock exceeded timeout | Maybe (if optimizable) | Error item mentioning timeout, includes partial outputs emitted |
| `ScriptMemoryError` | Memory cap hit | Maybe (model can simplify) | Error item encouraging task splitting |
| `ApprovalDeniedError` | User rejected tool | No (user decision) | Thrown into script; catchable; logged |
| `ApprovalTimeoutError` | No approval response within SLA | No | Thrown into script; catchable |
| `ToolExecutionError` | Tool returned error/non-zero | Depends on tool | Bubbled with stderr (truncated to 2KB) |
| `ToolNotFoundError` | Unknown tool name | Yes (model typo) | Immediate error with available tools list |
| `ToolValidationError` | Invalid arguments | Yes (model can fix) | Schema validation failure details |
| `DetachedPromiseError` | Unresolved promises when script ends | Maybe (model should await) | Lists pending tool calls |
| `HarnessInternalError` | Worker crash, unexpected failure | Yes (auto-retry once) | Generic error, retry attempted |
| `SerializationError` | Return value cannot be serialized | Yes (model can simplify) | Reason (e.g., BigInt/Symbol unsupported) |

### 5.2 Error Reporting Format

```typescript
// In ScriptToolCallOutput
{
  type: 'script_tool_call_output',
  id: 'scr_abc123',
  call_id: 'call_456',
  error: {
    code: 'ScriptTimeoutError',
    message: 'Script exceeded 30000ms time limit',
    phase: 'executing', // 'parsing' | 'executing' | 'finalizing'
    toolName?: 'exec', // If error during specific tool
    callId?: 'tool_3',
    stack: 'Error: timeout\n  at line 15 in script.ts',
    metadata: {
      elapsedMs: 30012,
      completedTools: 12,
      pendingTools: 1
    }
  },
  // Partial results if any
  output_json: '{"partialResults": [...]}',
  metadata: { duration_ms: 30012, tool_calls_made: 12 }
}
```

### 5.3 Stack Trace Sanitization

**Rules:**
- Strip all absolute host paths
- Strip internal module names
- Only show line/column relative to script
- Use virtual filename: `script.ts` or `<tool-calls>:15:3`
- Cap stack depth to 10 frames
- Remove host function names

**Example:**
```
Before: Error: Command failed
  at realApplyPatch (/Users/user/codex/src/apply-patch/apply.ts:245)
  at ToolFacade.execute (/Users/user/codex/src/core/script-harness/tool-facade.ts:89)
  at script.ts:15:3

After: Error: Command failed
  at applyPatch (script.ts:15:3)
```

### 5.4 Partial Results Preservation

**On error:**
1. Tool outputs already emitted remain in history
2. PromiseTracker captures completed tool results
3. Error item includes `output_json` with partial results if available
4. Model sees what succeeded before failure

---

## 6. Tool Facade Implementation

### 6.1 Proxy Design

```typescript
export function createToolsProxy(
  registry: ToolRegistry,
  approvalBridge: ApprovalBridge,
  tracker: PromiseTracker,
  config: ScriptHarnessConfig
): ScriptTools {
  const allowedTools = new Set(config.expose.tools);

  return new Proxy({}, {
    get(target, prop: string) {
      // Validate tool exists and is allowed
      if (!allowedTools.has(prop)) {
        throw new ToolNotFoundError(prop, Array.from(allowedTools));
      }

      const tool = registry.get(prop);
      if (!tool) {
        throw new ToolNotFoundError(prop);
      }

      // Return async function that routes through approval system
      return async (args: unknown) => {
        // Validate args against schema
        const validation = tool.validateArgs(args);
        if (!validation.valid) {
          throw new ToolValidationError(prop, validation.errors);
        }

        // Check tool budget
        if (tracker.getToolCallCount() >= config.limits.maxToolCalls) {
          throw new ToolBudgetExceededError(config.limits.maxToolCalls);
        }

        // Create AbortController for this call
        const abort = new AbortController();
        const toolId = tracker.register(prop, abort);

        try {
          // Check if approval needed
          if (tool.requiresApproval(args)) {
            const approved = await approvalBridge.requestApproval({
              toolName: prop,
              args,
              scriptId: tracker.scriptId,
              toolId
            });

            if (!approved) {
              throw new ApprovalDeniedError(prop);
            }
          }

          // Execute tool with AbortSignal
          const result = await tool.execute(args, { signal: abort.signal });

          tracker.markComplete(toolId);
          return Object.freeze(result); // Immutable result

        } catch (err) {
          tracker.markFailed(toolId, err);
          throw err; // Propagate to script
        }
      };
    },

    // Prevent adding/deleting properties
    set() { return false; },
    deleteProperty() { return false; }
  }) as ScriptTools;
}
```

### 6.2 Approval Bridge

```typescript
export class ApprovalBridge {
  private pending = new Map<string, {
    resolve: (approved: boolean) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    const requestId = genId('approval');

    // Emit approval request event (existing system)
    this.emitApprovalRequest({
      requestId,
      toolName: request.toolName,
      args: sanitizeForDisplay(request.args),
      scriptContext: {
        scriptId: request.scriptId,
        toolId: request.toolId
      }
    });

    // Create promise that resolves when user responds
    return new Promise((resolve, reject) => {
      // Timeout after configured SLA (default 60s)
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new ApprovalTimeoutError(request.toolName));
      }, this.config.approvalTimeoutMs);

      this.pending.set(requestId, { resolve, reject, timer });
    });
  }

  // Called by approval system when user responds
  onApprovalResponse(requestId: string, approved: boolean) {
    const entry = this.pending.get(requestId);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(requestId);
    entry.resolve(approved);
  }
}
```

---

## 7. Resource Limits & Enforcement

| Limit | Default | Enforcement Mechanism |
|-------|---------|----------------------|
| Wall-clock timeout | 30s | Timer + interrupt handler → kill worker |
| Memory | 96 MB | QuickJS `setMemoryLimit` + worker RSS monitor |
| Stack depth | 512 KB | QuickJS `setMaxStackSize` |
| Tool calls per script | 32 | Counter in PromiseTracker; exceed → `ToolBudgetExceeded` |
| Concurrent tool calls | 4 | Semaphore in PromiseTracker; queue or reject |
| Return payload size | 128 KB | `safeStringify` truncates + error |
| Progress events | 50 per script | Counter in telemetry; throttle 1/500ms |
| Script source length | 20 KB | Parser pre-check; reject before execution |
| Tool stdout/stderr | 256 KB per stream | Truncate with `...<truncated>` marker |
| Log events (console.*) | 200 total, 20/sec | Rate limiter in console proxy |

**Enforcement:**
- QuickJS limits set on runtime initialization
- Worker RSS checked every 1s
- Counters in PromiseTracker decremented/checked
- Serializer enforces output size before returning

---

## 8. Script Detection & Parsing

### 8.1 Supported Formats

**Format 1: XML tags (primary)**
```xml
<tool-calls>
const result = await tools.exec({command: ["ls"]});
return result.stdout;
</tool-calls>
```

**Format 2: Fenced code block (alternative)**
````markdown
```ts tool-calls
const result = await tools.exec({command: ["ls"]});
return result.stdout;
```
````

### 8.2 Detection Logic

```typescript
export function detectScriptBlocks(item: ResponseItem): ScriptBlock[] {
  if (item.type !== 'message' || item.role !== 'assistant') {
    return [];
  }

  const text = extractTextContent(item);
  const blocks: ScriptBlock[] = [];

  // Detect XML tags
  const xmlRegex = /<tool-calls>(.*?)<\/tool-calls>/gs;
  for (const match of text.matchAll(xmlRegex)) {
    blocks.push({
      format: 'xml',
      code: match[1].trim(),
      startIndex: match.index!,
      endIndex: match.index! + match[0].length
    });
  }

  // Detect fenced blocks
  const fenceRegex = /```ts tool-calls\n(.*?)```/gs;
  for (const match of text.matchAll(fenceRegex)) {
    blocks.push({
      format: 'fence',
      code: match[1].trim(),
      startIndex: match.index!,
      endIndex: match.index! + match[0].length
    });
  }

  return blocks;
}
```

### 8.3 Validation Rules

- Reject nested `<tool-calls>` blocks
- Reject malformed XML (unbalanced tags)
- Validate UTF-8 encoding
- Check script length <= 20KB
- Scan for banned tokens outside string literals
- Multiple blocks: execute sequentially by default (configurable)

---

## 9. Feature Flags & Execution Control

### 9.1 Configuration Schema

```typescript
export interface ScriptHarnessConfig {
  mode: 'disabled' | 'dry-run' | 'enabled';
  runtime: 'quickjs' | 'isolated-vm';

  limits: {
    timeoutMs: number;           // 30000
    memoryMb: number;            // 96
    maxToolCalls: number;        // 32
    maxConcurrentToolCalls: number; // 4
    maxReturnSizeBytes: number;  // 131072
    maxSourceBytes: number;      // 20480
    allowDetachedPromises: boolean; // false
    maxLogEvents: number;        // 200
    logRatePerSec: number;       // 20
  };

  expose: {
    tools: string[];             // ['applyPatch', 'exec', 'fileSearch']
    enableMcp: boolean;          // false
    enableSpawn: boolean;        // false (detached tasks)
    enableHttp: boolean;         // false
  };

  workerPool: {
    size: number;                // min(2, cpuCount)
    reuseWorkers: boolean;       // true
    maxScriptsPerWorker: number; // 100 (recycle after)
  };
}
```

### 9.2 Execution Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `disabled` | Detector replaces `<tool-calls>` with warning message; no execution; logs metric | Production default, gradual rollout |
| `dry-run` | Parser validates syntax, checks tool existence, returns validation report; no execution | Testing, security audits, beta preview |
| `enabled` | Full execution with all security boundaries | Production with feature enabled |

**Configuration precedence:**
1. Per-turn override (request metadata)
2. Per-provider config (some models allowed, others not)
3. Global config (default)

---

## 10. Test Specifications

### 10.1 Security Tests (S1-S20)

**S1.** Prototype pollution: `Object.prototype.hack = 1` fails
**S2.** Frozen tools: `tools.applyPatch = null` throws
**S3.** Banned require: `require('fs')` rejected pre-sandbox
**S4.** Banned import: `import('fs')` rejected
**S5.** Infinite loop: `while(true){}` hits timeout at 30s
**S6.** Microtask flood: recursive Promise throws timeout
**S7.** Memory exhaustion: `new Array(1e9)` throws MemoryError
**S8.** Stack overflow: deep recursion throws stack error
**S9.** eval blocked: `eval("code")` throws ReferenceError
**S10.** Function constructor: `new Function("return this")()` blocked
**S11.** Access process: `globalThis.process` is undefined
**S12.** Modify context: `context.turnId = "x"` throws
**S13.** Access proto: `context.__proto__` is frozen
**S14.** Modify Promise: `Promise.constructor = null` fails
**S15.** Worker termination: hung script terminates, host unaffected
**S16.** Cross-script isolation: script A state invisible to script B
**S17.** Orphaned promise canceled: non-awaited promise aborted
**S18.** spawn Worker: `new Worker()` throws ReferenceError
**S19.** Large return: >128KB truncated with error
**S20.** Dry-run mode: validation runs, no execution, warning emitted

### 10.2 Functional Tests (F1-F30)

**F1.** Basic execution: single applyPatch returns result
**F2.** Preserve text: before/after script maintained in history
**F3.** TypeScript: async/await compiles and runs
**F4.** Parallel: `Promise.all` on 3 tools resolves
**F5.** Promise.race: winner returns, losers canceled
**F6.** Error handling: try/catch tool failure
**F7.** Tool result composition: use output from one tool in next
**F8.** Custom return: object with nested fields serialized
**F9.** Reasoning integration: thinking + script + text ordered
**F10.** Progress events: `context.emitProgress` streams
**F11.** Approval required: exec pauses until approved
**F12.** Approval denied: throws error, script catches, continues
**F13.** Tool outputs: inserted into history correctly
**F14.** Timeout override: within allowed limits works
**F15.** MCP tool: `tools.mcp.server.tool` callable
**F16.** Worker reuse: state cleaned between runs
**F17.** Feature disabled: warning replaces script
**F18.** Dry-run: validation report, no execution
**F19.** Fenced block: ```ts tool-calls detection works
**F20.** Multiple blocks: sequential execution preserves order
**F21.** Context access: `context.workingDirectory` readable
**F22.** No return value: undefined handled gracefully
**F23.** Exec stdout/stderr: captured and returned
**F24.** Tool validation error: invalid args caught pre-execution
**F25.** Script helpers: define function inside script, call it
**F26.** Progress throttling: rate limit enforced
**F27.** Timeout with partial: completed tools returned
**F28.** Unknown tool: immediate error with suggestion
**F29.** Syntax error: compilation failure reported
**F30.** Tool budget: hitting limit throws error

### 10.3 Integration Tests (I1-I10)

**I1.** Responses API: script + text + thinking end-to-end
**I2.** Chat Completions: script block detected and executed
**I3.** Messages API: thinking + script streaming integration
**I4.** Mixed turn: structured tool call + script both work
**I5.** Approval UI: surfaces script metadata, resume works
**I6.** Timeout event: surfaces to conversation history
**I7.** Feature flag: disabled path verified
**I8.** Dry-run mode: validation runs, metrics logged
**I9.** Runtime swap: QuickJS ↔ isolated-vm parity test
**I10.** History snapshot: complete turn ordering preserved

**Total: 60 tests minimum, expandable**

---

## 11. Implementation Plan

### Week 1-2: Foundations & Runtime
**Files:**
- `core/script-harness/runtime/types.ts` - ScriptRuntimeAdapter interface
- `core/script-harness/runtime/quickjs-runtime.ts` - QuickJS worker manager
- `core/script-harness/hardening.ts` - Intrinsic freezing prelude

**Tasks:**
1. Install `quickjs-emscripten` dependency
2. Create worker pool infrastructure
3. Implement QuickJS adapter with:
   - Worker lifecycle (spawn, message passing, termination)
   - Memory limit (`setMemoryLimit`)
   - Interrupt handler (timeout detection)
   - Async function binding via Asyncify
4. Implement hardened prelude (freeze intrinsics)
5. Add basic tests (runtime creation, limits, cleanup)

**Security checkpoint:** Sandbox escape tests pass

### Week 2-3: Detection & Parsing
**Files:**
- `core/script-harness/detector.ts` - Script block detection
- `core/script-harness/parser.ts` - Validation and extraction

**Tasks:**
1. Implement XML tag detection with balanced validator
2. Implement fenced block detection (```ts tool-calls)
3. Add input validation (UTF-8, banned tokens, size limits)
4. Handle multiple blocks (sequential execution)
5. Preserve surrounding text/thinking blocks
6. Add parser tests (malformed inputs, edge cases)

**Checkpoint:** Parser handles all valid/invalid inputs correctly

### Week 3-4: Tool Facade & Promise Tracking
**Files:**
- `core/script-harness/tool-facade.ts` - Tool proxy
- `core/script-harness/runtime/promise-tracker.ts` - Promise lifecycle
- `core/script-harness/context.ts` - Context object factory

**Tasks:**
1. Implement PromiseTracker with AbortController per promise
2. Implement tool Proxy with validation
3. Integrate with ToolRegistry
4. Create context factory (frozen, validated)
5. Add tool facade tests
6. Add promise lifecycle tests (orphaned, race, timeout)

**Checkpoint:** Promise lifecycle management verified

### Week 4-5: Approval Integration
**Files:**
- `core/script-harness/approvals-bridge.ts` - Approval suspend/resume

**Tasks:**
1. Integrate with existing ToolOrchestrator approval system
2. Implement Promise suspend (pending resolver)
3. Implement resume on approval
4. Implement rejection on denial/timeout
5. Add script metadata to approval UI
6. Add approval flow tests (approved, denied, timeout)

**Checkpoint:** Approval flow works end-to-end

### Week 5: Orchestration & Serialization
**Files:**
- `core/script-harness/orchestrator.ts` - Main coordinator
- `core/script-harness/serializer.ts` - ResponseItem generation
- `core/script-harness/errors.ts` - Error types

**Tasks:**
1. Implement main orchestrator (coordinates all components)
2. Implement error handling and sanitization
3. Implement response serialization (ScriptToolCall items)
4. Add protocol model extensions
5. Integrate with response processing pipeline
6. Add orchestrator tests

**Checkpoint:** End-to-end script execution works

### Week 6: Feature Flags & Integration
**Files:**
- `core/script-harness/feature-flags.ts` - Mode handling
- `core/client/response-processing.ts` - Integration point

**Tasks:**
1. Add config schema to core/config
2. Implement disabled/dry-run/enabled modes
3. Add per-provider and per-turn overrides
4. Integrate detector into response processing
5. Wire up across all 3 APIs (Responses, Chat, Messages)
6. Add integration tests

**Checkpoint:** All 3 APIs work with script harness

### Week 7-8: Testing & Security Review
**Tasks:**
1. Implement remaining security tests (20 total)
2. Implement remaining functional tests (30 total)
3. Implement integration tests (10 total)
4. Add fuzz testing for parser
5. Conduct security review
6. Red-team dry run
7. Performance benchmarking

**Checkpoint:** Security signoff before GA

### Week 9: Documentation & Rollout
**Tasks:**
1. Write user guide (syntax, examples, best practices)
2. Write security documentation (guarantees, limits, boundaries)
3. Write tool API reference
4. Write error handling guide
5. Write configuration guide
6. Write operator runbook
7. Phased rollout plan

**Deliverable:** Production-ready feature

---

## 12. Orchestrator Pseudocode (Implementation Reference)

```typescript
// core/script-harness/orchestrator.ts
export async function executeScript(
  call: { code: string; runtime?: 'quickjs' | 'isolated-vm' },
  config: ScriptHarnessConfig,
  contextSeed: ContextSeed,
  stream: ResponseStream
): Promise<ScriptResult> {

  const scriptId = genId('scr');

  // Emit start event
  stream.emit({
    type: 'custom_tool_call_progress',
    phase: 'script_started',
    scriptId
  });

  // Get runtime adapter
  const adapter = getRuntimeAdapter(call.runtime ?? config.runtime);
  const worker = await workerPool.borrow();

  try {
    // Create fresh context
    const context = await adapter.createContext(worker);

    // Initialize components
    const tracker = new PromiseTracker(config.limits, scriptId);
    const approvalBridge = new ApprovalBridge(config);
    const toolsProxy = createToolsProxy(
      toolRegistry,
      approvalBridge,
      tracker,
      config
    );
    const contextObj = createScriptContext(contextSeed, config, scriptId);
    const consoleProxy = createConsoleProxy(stream, config);

    // Inject into sandbox (all frozen)
    const globals = {
      tools: Object.freeze(toolsProxy),
      context: Object.freeze(contextObj),
      console: Object.freeze(consoleProxy)
    };

    await adapter.injectGlobals(context, globals);

    // Execute with timeout
    const result = await adapter.evaluate(
      context,
      call.code,
      config.limits.timeoutMs
    );

    // Ensure no orphaned promises
    await tracker.ensureAllSettled();

    // Normalize and cap return value
    const returnValue = capAndClone(result, config.limits.maxReturnSizeBytes);

    // Emit completion
    stream.emit({
      type: 'custom_tool_call_progress',
      phase: 'script_completed',
      scriptId,
      ok: true
    });

    return {
      ok: true,
      returnValue,
      metadata: {
        duration_ms: tracker.getElapsedMs(),
        tool_calls_made: tracker.getToolCallCount(),
        memory_used_mb: tracker.getPeakMemoryMb()
      }
    };

  } catch (err) {
    // Sanitize error
    const scriptError = sanitizeScriptError(err, scriptId);

    // Emit error event
    stream.emit({
      type: 'custom_tool_call_progress',
      phase: 'script_error',
      scriptId,
      error: briefError(scriptError)
    });

    // Get partial results if available
    const partialResults = tracker.getCompletedResults();

    return {
      ok: false,
      error: scriptError,
      partialResults,
      metadata: {
        duration_ms: tracker.getElapsedMs(),
        tool_calls_made: tracker.getToolCallCount()
      }
    };

  } finally {
    // Cleanup
    await adapter.dispose(context);
    await workerPool.release(worker);
  }
}
```

---

## 13. Performance Analysis

**Overhead Breakdown:**
- Worker borrow (cold): ~15ms (pool amortizes this)
- Worker borrow (warm): ~1-2ms
- Script parse/validate: ~5-10ms for 200-line scripts
- QuickJS context creation: ~3ms
- Hardening prelude execution: ~5ms (cached per worker)
- Script execution: <5ms before tool awaits (tool time dominates)
- Serialization: ~2-5ms

**Total overhead:** ~20-40ms for simple scripts (tools take seconds)

**Compared to structured calls:** +15% overhead, offset by ability to batch tools (fewer round trips)

**Optimizations:**
- Pool warm workers (size = CPU cores)
- Reuse workers with context reset (up to 100 scripts/worker)
- Cache transpiled TypeScript (source hash → compiled JS)
- Precompute hardening prelude
- Batch event emission (reduce IPC overhead)

**Performance targets:**
- < 100ms overhead for simple scripts
- < 5s total for scripts with 10+ tool calls
- Worker pool saturated at <10% CPU when idle

---

## 14. Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| QuickJS zero-day vulnerability | **High** | Low | Keep updated, worker isolation limits blast radius, optional isolated-vm backend for high-security |
| Approval UX complexity | Medium | Medium | Script metadata in UI, pre-approval policies, clear denial messages |
| Performance on complex scripts | Medium | Medium | Enforce 20KB size limit, recommend structured for simple sequences |
| Model misuse (huge scripts) | Medium | Low | Size caps, telemetry flags accounts, documentation on best practices |
| Promise tracking bugs | Medium | Low | Comprehensive tests (F5, F27, S17), instrumentation counters |
| Worker pool exhaustion | Low | Low | Queue or reject with clear error, configurable pool size |
| TypeScript compilation overhead | Low | Medium | Lazy compilation, cache by hash, optional JS-only mode |
| Maintenance burden | Low | Low | Encapsulated module, adapter pattern, comprehensive tests |

---

## 15. Complexity Estimate

**Implementation:** 6 engineer-weeks
- Runtime integration: 1.5 weeks
- Detection/parsing: 0.5 weeks
- Tool facade + approvals: 2 weeks
- Orchestration + serialization: 1 week
- Feature flags + config: 0.5 weeks
- Integration: 0.5 weeks

**Testing:** 3.5 engineer-weeks
- Security tests: 1.5 weeks
- Functional tests: 1.5 weeks
- Integration tests: 0.5 weeks

**Security Review:** 2 engineer-weeks
- Design review: 0.5 weeks
- Code audit: 1 week
- Red-team testing: 0.5 weeks

**Documentation:** 1.5 engineer-weeks
- User guide: 0.5 weeks
- API reference: 0.5 weeks
- Security docs: 0.25 weeks
- Operator runbook: 0.25 weeks

**Total: 13 engineer-weeks**

**Critical path:** Runtime → Tool facade → Approvals → Integration → Security review

**Parallelization:** Runtime + Parser can be built concurrently; Tests can start early with mocks

---

## 16. Documentation Outline

**1. User Guide** (`docs/script-harness.md`)
- What is the script harness (overview, benefits)
- When to use scripts vs structured tool calls
- Syntax: XML tags and fenced blocks
- Available tools API reference
- Writing effective scripts (examples: serial, parallel, error handling)
- Best practices (always await, use Promise.all, handle errors)
- Limitations and boundaries

**2. Security Model** (`docs/script-harness-security.md`)
- Sandbox guarantees (what's isolated, what's enforced)
- Resource limits (timeout, memory, tool calls)
- Prohibited APIs (require, import, eval, Node.js built-ins)
- Approval behavior (how tools get gated)
- Threat model and mitigations

**3. Tool API Reference** (`docs/script-harness-api.md`)
- Complete TypeScript interfaces for all tools
- Parameter schemas and validation rules
- Return value types
- Error codes each tool can throw
- Examples for each tool

**4. Configuration Guide** (`docs/script-harness-config.md`)
- Feature flags (disabled/dry-run/enabled)
- Runtime selection (quickjs/isolated-vm)
- Resource limits tuning
- Per-provider configuration
- Per-turn overrides

**5. Error Handling** (`docs/script-harness-errors.md`)
- Complete error catalog with codes
- Error messages and meanings
- Retry recommendations
- Debugging failed scripts
- Stack trace interpretation

**6. Operator Runbook** (`docs/script-harness-ops.md`)
- Monitoring metrics (execution time, memory, errors)
- Killing hung workers
- Rotating QuickJS versions
- Incident response (security events)
- Performance tuning

---

## 17. Success Criteria

This design succeeds if:

✅ **Secure** - No realistic sandbox escapes; comprehensive threat mitigation
✅ **Functional** - Models compose tools effectively; parallel + conditional logic works
✅ **Safe** - Resource limits prevent abuse; orphaned promises cleaned up
✅ **Compatible** - Works identically with Responses, Chat, and Messages APIs
✅ **Tested** - ≥60 tests covering security, functionality, integration
✅ **Implementable** - Clear step-by-step plan with security checkpoints
✅ **Performant** - Overhead < 100ms; doesn't slow down existing flows
✅ **Maintainable** - Clean architecture, comprehensive docs, encapsulated module
✅ **Integrated** - Approval system works seamlessly; history preserves all context
✅ **Production-ready** - Security reviewed, red-team tested, phased rollout plan

---

**End of Design Document**

*This design merges the best elements from three expert consultations to create a secure, implementable, and powerful script-based tool harness for Codex. The feature enables unprecedented tool composition capabilities while maintaining security boundaries and conversation flow integrity.*

*Ready for implementation in Phase 4.4.*
