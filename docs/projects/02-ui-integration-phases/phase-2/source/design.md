# Phase 2: Technical Design

**Phase:** Tool Integration
**Goal:** Add tool execution, approval flow, and tool result handling to conversation loop

---

## Integration Overview

(From TECH-APPROACH Section 3)

Phase 2 adds tool execution to the conversation flow. Models can now request tools (exec, readFile, applyPatch, etc.), CLI prompts user for approval, tools execute, results return to model. This activates the ToolRouter and approval system from the port for the first time. The conversation loop from Phase 1 remains unchanged—we're adding a branch point where Session detects tool calls and routes to ToolRouter instead of just returning to CLI.

---

## Actual Signatures (from ported code)

### ToolRegistry

Location: `codex-ts/src/tools/registry.ts`

```typescript
interface ToolMetadata {
  name: string;
  description: string;
  requiresApproval: boolean;
  schema?: Record<string, unknown>;
}

interface RegisteredTool<TParams = unknown, TResult = unknown> {
  metadata: ToolMetadata;
  execute: ToolFunction<TParams, TResult>;
}

class ToolRegistry {
  get(name: string): RegisteredTool | undefined
  has(name: string): boolean
  getToolNames(): string[]
}

// Global instance
export const toolRegistry = new ToolRegistry();
```

### Tool Handler Pattern

```typescript
// Each tool handler signature
type ToolFunction<TParams, TResult> = (
  params: TParams,
  options?: ToolOptions
) => Promise<TResult>;

// Example: exec tool
import {processExecToolCall, type ExecParams} from '../core/exec';

await processExecToolCall(
  {command: ['npm', 'test'], cwd: process.cwd()},
  {sandboxPolicy: 'none'}
);
```

### FunctionCall Types

Location: `codex-ts/src/protocol/items.ts`

```typescript
// Model requests tool
interface FunctionCall {
  type: 'function_call';
  id: string;
  name: string;
  arguments: string; // JSON stringified
}

// Tool returns result
interface FunctionCallOutput {
  type: 'function_call_output';
  call_id: string;
  output: string;
}
```

### Approval Callback Signature

```typescript
// CLI provides this function to Session/ToolRouter
type ApprovalCallback = (
  toolName: string,
  args: unknown
) => Promise<boolean>;

// Usage in ToolRouter
if (tool.metadata.requiresApproval) {
  const approved = await approvalCallback(toolName, params);
  if (!approved) {
    return {
      type: 'function_call_output',
      call_id: functionCall.id,
      output: JSON.stringify({error: 'User denied approval'})
    };
  }
}
```

---

## CLI Approval Implementation

### readline for Approval Prompts

```typescript
// src/cli/approval.ts
import * as readline from 'readline/promises';

export async function promptApproval(
  toolName: string,
  args: unknown
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`\nTool call: ${toolName}`);
  console.log(`Arguments: ${JSON.stringify(args, null, 2)}`);

  const answer = await rl.question('Approve? (y/n): ');
  rl.close();

  return answer.toLowerCase() === 'y';
}
```

### Display Tool Execution

```typescript
// src/cli/display.ts (add to existing file)

export function renderToolCall(call: FunctionCall) {
  console.log(`\n🔧 Tool: ${call.name}`);
  const args = JSON.parse(call.arguments);
  console.log(`   Args: ${JSON.stringify(args, null, 2)}`);
}

export function renderToolResult(output: FunctionCallOutput) {
  const result = JSON.parse(output.output);
  console.log(`✓ Result: ${result.stdout || result.content || JSON.stringify(result)}\n`);
}
```

---

## Tool Detection and Routing

**How Session detects tool calls:**

```typescript
// Pseudocode from Session (check actual implementation in codex-ts/src/core/codex/session.ts)

async processMessage(message: string): Promise<ResponseItem[]> {
  // Send to ModelClient
  const items = await this.client.sendMessage(request);

  // Scan for FunctionCall items
  const toolCalls = items.filter(item => item.type === 'function_call');

  if (toolCalls.length > 0) {
    // Route to tools
    const outputs = await this.executeTools(toolCalls);
    items.push(...outputs);
  }

  return items;
}

async executeTools(calls: FunctionCall[]): Promise<FunctionCallOutput[]> {
  const outputs = [];
  for (const call of calls) {
    const tool = toolRegistry.get(call.name);
    if (!tool) {
      outputs.push({
        type: 'function_call_output',
        call_id: call.id,
        output: JSON.stringify({error: `Tool ${call.name} not found`})
      });
      continue;
    }

    // Check approval
    if (tool.metadata.requiresApproval && this.approvalCallback) {
      const args = JSON.parse(call.arguments);
      const approved = await this.approvalCallback(call.name, args);
      if (!approved) {
        outputs.push({
          type: 'function_call_output',
          call_id: call.id,
          output: JSON.stringify({error: 'User denied approval'})
        });
        continue;
      }
    }

    // Execute
    const args = JSON.parse(call.arguments);
    const result = await tool.execute(args);
    outputs.push({
      type: 'function_call_output',
      call_id: call.id,
      output: JSON.stringify(result)
    });
  }
  return outputs;
}
```

**CLI provides approval callback during Session initialization.**

---

## Mock Implementation Guide

### Mock Tool Handler

```typescript
// tests/mocks/tool-handlers.ts

export function createMockToolHandler(result: any) {
  return {
    metadata: {
      name: 'exec',
      description: 'Execute command',
      requiresApproval: true
    },
    execute: vi.fn().mockResolvedValue(result)
  };
}

// Usage
const mockExec = createMockToolHandler({
  exitCode: 0,
  stdout: 'Tests passed',
  stderr: ''
});

// Inject into registry or pass to ToolRouter
```

### Mock ModelClient with FunctionCall

```typescript
// tests/mocks/model-client.ts (enhance from Phase 1)

export function createMockClientWithToolCall(
  toolName: string,
  args: unknown
): MockModelClient {
  return {
    async sendMessage(request) {
      return [
        {
          type: 'message',
          role: 'assistant',
          content: [{type: 'text', text: 'I will execute a tool'}]
        },
        {
          type: 'function_call',
          id: 'call_123',
          name: toolName,
          arguments: JSON.stringify(args)
        }
      ];
    },
    // ... other methods
  };
}

// Usage
const mockClient = createMockClientWithToolCall('exec', {
  command: ['npm', 'test']
});
```

### Mock Approval Callback

```typescript
// In test setup
let approvalResults: boolean[] = [true, false, true]; // Pre-program responses

const mockApprovalCallback = async (toolName, args) => {
  return approvalResults.shift() ?? false;
};

// Inject into Session or wherever approval callback is used
```

---

## Wiring Approval Callback

### Where to Inject

**Session needs approval callback during construction:**

```typescript
// Check actual Session constructor in codex-ts/src/core/codex/session.ts
// Likely something like:

class Session {
  constructor(config, approvalCallback?: ApprovalCallback) {
    this.approvalCallback = approvalCallback;
  }
}
```

**CLI provides callback when creating Session/Codex:**

```typescript
// src/cli/index.ts (modify from Phase 1)
import {promptApproval} from './approval';

// When creating ConversationManager or Codex
const codex = await Codex.spawn(config, authManager, null, sessionSource, {
  approvalCallback: promptApproval  // CLI's approval function
});
```

**Exact wiring depends on actual Codex.spawn signature.** Check ported code. If unclear, try injection points and document decision.

---

## Error Handling

### Tool-Specific Errors

**ToolNotFoundError:**
- Tool name in FunctionCall not in registry
- Return FunctionCallOutput with error

**ApprovalDeniedError:**
- User says 'n' to approval prompt
- Return FunctionCallOutput with "User denied approval"

**ToolExecutionError:**
- Tool execute() throws (command fails, file not found, etc.)
- Catch error, return FunctionCallOutput with error message

**Handling in CLI:**

```typescript
try {
  await conversation.submit(input);
  const event = await conversation.nextEvent();

  // Handle events (including tool calls)
  while (event.msg.type !== 'response_complete') {
    if (event.msg.type === 'tool_call') {
      // Already handled by Session, just display
      renderToolCall(event.msg);
    } else if (event.msg.type === 'tool_result') {
      renderToolResult(event.msg);
    }

    event = await conversation.nextEvent();
  }
} catch (err) {
  console.error('Error:', err.message);
}
```

---

## Tool Execution Flow

### Complete Cycle

```typescript
// High-level flow (check actual implementation)

1. User: cody chat "run tests"
2. CLI: conversation.submit([{type: 'text', text: "run tests"}])
3. Session: Forward to ModelClient
4. ModelClient: Returns ResponseItems including FunctionCall
5. Session: Detect FunctionCall item
6. Session: Look up tool in registry
7. Session: Check requiresApproval → call CLI's approvalCallback
8. CLI: Display prompt, wait for user input, return boolean
9. Session: If approved, execute tool.execute()
10. Tool: Execute command, return result
11. Session: Wrap result in FunctionCallOutput
12. Session: Send FunctionCallOutput back to model
13. Model: See result, respond
14. Session: Return final response
15. CLI: Display to user
```

---

## Reference Code Locations

**Tool system:**
- ToolRegistry: `codex-ts/src/tools/registry.ts`
- Tool handlers: `codex-ts/src/tools/*/index.ts` (apply-patch, read-file, etc.)
- exec tool: `codex-ts/src/core/exec/index.ts`

**Protocol types:**
- FunctionCall, FunctionCallOutput: `codex-ts/src/protocol/items.ts`
- ToolOptions: `codex-ts/src/tools/types.ts`

**Session (where tools are routed):**
- Session class: `codex-ts/src/core/codex/session.ts`
- Look for tool detection/routing logic

**If stuck:** Read these files for actual implementation patterns.

---

## Key Implementation Notes

**1. Approval callback injection point:**
Check Codex.spawn() or Session constructor for where to pass approval callback. If not obvious, may need to add parameter. Document in DECISIONS.md.

**2. Tool execution is synchronous in conversation loop:**
Model requests tool → we execute → return result → model responds. Not parallel (Phase 1 constraint). Structured tool calling pattern.

**3. Display timing:**
Show tool call immediately when detected, show result when execution completes, show final model response after. User sees progress, not just final output.

**4. Error cases matter:**
User denial is normal flow (not error). Tool execution failure should be graceful (return error to model, don't crash CLI).

**5. Testing focus:**
Test approval flow (approved vs denied), test tool routing (correct tool called), test result handling (model receives output). Don't test individual tool logic (assume tools work from Phase 3 port).

---

## Integration with Phase 1 Code

**Changes to existing Phase 1 code:**

**src/cli/index.ts:**
- Import approval module
- Pass approval callback during ConversationManager/Codex creation

**src/cli/display.ts:**
- Add renderToolCall() and renderToolResult() functions
- Modify renderEvent() to handle tool-related events

**src/cli/commands/chat.ts:**
- Event loop for handling multiple events (tool calls, results, final response)
- Display each event type appropriately

**No changes to ConversationManager or Codex** - approval callback added via constructor, core logic unchanged.

---

## Testing Strategy

**Test the approval flow and tool integration, not the tools themselves.**

**What to test:**
- Approval callback gets called when tool requires approval
- Approved tools execute
- Denied tools don't execute, return denial error
- Tool results flow back to model
- CLI displays tool calls and results

**What NOT to test:**
- Does exec actually run commands? (Assume yes, Phase 3 tested exec tool)
- Does readFile actually read files? (Assume yes, Phase 4.5 tested readFile)
- Tool implementation details (not integration concern)

**Mock both ModelClient (returns FunctionCall) and tool handlers (return preset results).** Test the wiring between them.
