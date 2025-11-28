# Implementation Plan: Script-Based Tool Execution

**Approach:** TDD throughout. Tests written before implementation. Service mocks for in-process testing.

---

## Phase 1: Agent Config Foundation

**Goal:** Registry of agent configs, wired to submit route.

### Slice 1a: Agent Config Schema & First Configs

**Deliverables:**
- `AgentConfig` TypeScript type/Zod schema
- 2-3 initial configs: `gpt-5.1-codex`, `claude-sonnet`, `claude-haiku`
- Registry class (Map by slug)

**Schema Shape:**
```typescript
interface AgentConfig {
  slug: string;                    // "gpt-5.1-codex"
  provider: "openai" | "anthropic";
  model: string;                   // "gpt-5.1-codex-mini"
  tools: string[];                 // ["shell", "readFile", "applyPatch"]
  configSchema: z.ZodObject<any>;  // Allowed parameters
  defaults: Record<string, unknown>;
  systemPrompt?: string;           // Path or content
}
```

**TDD Tests:**
```
describe('AgentRegistry', () => {
  it('returns config by slug')
  it('returns undefined for unknown slug')
  it('lists all registered slugs')
  it('config has required fields')
})
```

**Files:**
- `cody-fastify/src/core/agents/agent-config.ts` - Types and schema
- `cody-fastify/src/core/agents/agent-registry.ts` - Registry class
- `cody-fastify/src/core/agents/configs/` - Individual config files
- `cody-fastify/test-suites/service-mocks/agents/agent-registry.test.ts`

### Slice 1b: Wire to Submit Route

**Deliverables:**
- Submit route accepts `agentId` parameter
- Looks up agent config, uses provider/model
- Falls back to existing providerId/model if no agentId

**TDD Tests:**
```
describe('POST /api/v2/submit with agentId', () => {
  it('uses agent config provider when agentId provided')
  it('uses agent config model when agentId provided')
  it('falls back to providerId/model when no agentId')
  it('returns 400 for unknown agentId')
})
```

**Files:**
- `cody-fastify/src/api/routes/submit.ts` - Add agentId handling
- `cody-fastify/test-suites/service-mocks/api/submit-agent.test.ts`

---

## Phase 2: Script Harness Plumbing

**Goal:** Full plumbing for script detection → execution → output, tested with fake executor first.

### Slice 2a: Script Detection in Adapter

**Deliverables:**
- Detection logic for `<script>...</script>` in streamed content
- Accumulation of script text between tags
- Emit `script_execution` item event with script text
- **No execution yet** - just detection and event emission

**TDD Tests:**
```
describe('Script Detection', () => {
  it('detects <script> opening tag in content')
  it('accumulates content between <script> and </script>')
  it('emits script_execution item_start event')
  it('emits script_execution item_done with script text')
  it('handles script with surrounding text')
  it('handles multiple scripts in one response')
  it('ignores malformed tags')
})
```

**Implementation Notes:**
- Add to both OpenAI and Anthropic adapters
- Detection happens during content_block_delta processing
- State machine: `idle` → `accumulating` → `complete`

**Files:**
- `cody-fastify/src/core/script/detector.ts` - Detection logic
- `cody-fastify/src/core/adapters/openai-adapter.ts` - Integration
- `cody-fastify/src/core/adapters/anthropic-adapter.ts` - Integration
- `cody-fastify/test-suites/service-mocks/script/detector.test.ts`

### Slice 2b: Fake Executor & Output Event

**Deliverables:**
- Stub executor: `executeScript(code) → { result: "STUB", logs: [], operations: [] }`
- Wire adapter: after detecting script, call executor
- Emit `script_execution_output` event with result

**TDD Tests:**
```
describe('Script Execution (Stub)', () => {
  it('calls executor with detected script')
  it('emits script_execution_output item_start')
  it('emits script_execution_output item_done with result')
  it('output contains result, logs, operations fields')
})
```

**Why Fake First:**
- Tests plumbing without QuickJS complexity
- Verifies event flow end-to-end
- Can write integration tests immediately
- Swap real executor later, tests still pass

**Files:**
- `cody-fastify/src/core/script/executor.ts` - Interface + stub
- `cody-fastify/test-suites/service-mocks/script/executor-stub.test.ts`

### Slice 2c: Multi-turn Loop (Still Fake)

**Deliverables:**
- After script output, inject result into conversation
- Continue iteration (model sees result, can respond or script again)
- Proper history building with script items

**TDD Tests:**
```
describe('Script Multi-turn', () => {
  it('injects script result into conversation history')
  it('model receives result in next iteration')
  it('supports multiple script turns')
  it('preserves non-script content between scripts')
})
```

**Files:**
- `cody-fastify/src/core/adapters/` - History building updates
- `cody-fastify/test-suites/service-mocks/script/multi-turn.test.ts`

### Slice 2d: Port QuickJS Sandbox

**Deliverables:**
- Migrate from `codex-ts/src/script-harness/`:
  - `runtime/quickjs-runtime.ts`
  - `runtime/worker-pool.ts`
  - `hardening.ts`
  - `parser.ts`
  - `context.ts`
- Unit tests come with it (200+ already exist)
- Replace stub executor with real sandbox

**TDD Tests:**
- Existing unit tests from codex-ts (migrate as-is)
- Plus:
```
describe('QuickJS Integration', () => {
  it('executes simple script and returns result')
  it('handles async/await')
  it('enforces timeout limits')
  it('enforces memory limits')
  it('blocks dangerous operations (eval, require)')
})
```

**Files:**
- `cody-fastify/src/core/script/runtime/` - Migrated runtime code
- `cody-fastify/src/core/script/parser.ts` - Migrated parser
- `cody-fastify/src/core/script/hardening.ts` - Migrated security
- `cody-fastify/test-suites/service-mocks/script/quickjs/` - Migrated tests

### Slice 2e: Console/Logs Capture

**Deliverables:**
- Wire up console.log capture in sandbox
- Include in output: `{ result, logs: [...], operations: [] }`

**TDD Tests:**
```
describe('Console Capture', () => {
  it('captures console.log output')
  it('captures console.warn output')
  it('captures console.error output')
  it('logs appear in output.logs array')
  it('logs are ordered by emission time')
})
```

**Files:**
- `cody-fastify/src/core/script/runtime/console-proxy.ts`
- `cody-fastify/test-suites/service-mocks/script/console.test.ts`

---

## Phase 3: First Tool (Shell)

**Goal:** One real tool, instrumented, working end-to-end.

### Slice 3a: Shell Function Implementation

**Deliverables:**
- Implement `shell(command)` in sandbox
- Instrumented: records to operations array
- Uses existing exec tool under the hood

**TDD Tests:**
```
describe('shell() function', () => {
  it('executes command and returns stdout')
  it('captures stderr')
  it('returns exit code')
  it('records operation in operations array')
  it('operation includes fn, args, result, duration')
  it('handles timeout')
})
```

**Files:**
- `cody-fastify/src/core/script/tools/shell.ts`
- `cody-fastify/test-suites/service-mocks/script/tools/shell.test.ts`

### Slice 3b: Error Handling

**Deliverables:**
- Shell command fails → clean error in result
- Script throws → clean error in output
- Structured error format

**TDD Tests:**
```
describe('Script Error Handling', () => {
  it('returns error when shell command fails')
  it('returns error when script throws')
  it('error includes message and stack')
  it('partial results preserved on timeout')
  it('operations completed before error are recorded')
})
```

**Files:**
- `cody-fastify/src/core/script/errors.ts`
- `cody-fastify/test-suites/service-mocks/script/errors.test.ts`

---

## Phase 4: Additional Tools

**Goal:** Build out tool library, one slice per 1-2 tools.

### Slice 4a: readFile

**Deliverables:**
- `readFile(path, options?)` function
- Returns file content as string
- Options: offset, limit, mode

**TDD Tests:**
```
describe('readFile() function', () => {
  it('reads file content')
  it('respects offset and limit')
  it('records operation')
  it('handles file not found')
})
```

### Slice 4b: writeFile

**Deliverables:**
- `writeFile(path, content)` function
- Creates/overwrites file
- Returns success boolean

**TDD Tests:**
```
describe('writeFile() function', () => {
  it('writes content to file')
  it('creates parent directories')
  it('records operation')
  it('handles permission errors')
})
```

### Slice 4c: applyPatch

**Deliverables:**
- `applyPatch(file, patch)` function
- Applies unified diff
- Matches OpenAI training signature

**TDD Tests:**
```
describe('applyPatch() function', () => {
  it('applies unified diff patch')
  it('handles add/delete/modify')
  it('records operation')
  it('handles patch failure')
})
```

### Slice 4d: strReplaceEditor

**Deliverables:**
- `strReplaceEditor(file, oldStr, newStr)` function
- Anthropic-style string replacement
- Matches Anthropic training signature

**TDD Tests:**
```
describe('strReplaceEditor() function', () => {
  it('replaces string in file')
  it('handles multiple occurrences')
  it('records operation')
  it('handles string not found')
})
```

### Slice 4e: help() - Self-Documentation

**Deliverables:**
- `help()` returns all available functions with signatures
- `help(fnName)` returns detailed docs for specific function
- Functions self-document via metadata

**TDD Tests:**
```
describe('help() function', () => {
  it('lists all available functions')
  it('includes function signatures')
  it('includes descriptions')
  it('returns specific function docs when name provided')
})
```

---

## Phase 5: Integration & Cleanup

### Slice 5a: tdd-api Integration Tests

**Deliverables:**
- Add script execution tests to tdd-api suite
- Real LLM calls with script output
- Verify full pipeline

**TDD Tests:**
```
describe('Script Execution E2E', () => {
  it('OpenAI model writes and executes script')
  it('Anthropic model writes and executes script')
  it('Multi-turn script conversation')
  it('Script with tool calls')
})
```

### Slice 5b: Remove Tool Worker (Optional)

**Deliverables:**
- Assess if tool-worker is still needed
- If not, remove dead code
- Update documentation

---

## Testing Infrastructure

### Service Mock Setup

**Create:** `cody-fastify/test-suites/service-mocks/`

**Structure:**
```
service-mocks/
├── setup.ts                    # Test setup, mock factories
├── mocks/
│   ├── redis-mock.ts          # In-memory Redis mock
│   ├── convex-mock.ts         # In-memory Convex mock
│   └── llm-mock.ts            # Configurable LLM response mock
├── agents/
│   └── agent-registry.test.ts
├── api/
│   └── submit-agent.test.ts
└── script/
    ├── detector.test.ts
    ├── executor-stub.test.ts
    ├── multi-turn.test.ts
    ├── quickjs/
    │   └── (migrated tests)
    ├── console.test.ts
    ├── errors.test.ts
    └── tools/
        ├── shell.test.ts
        ├── readFile.test.ts
        ├── writeFile.test.ts
        ├── applyPatch.test.ts
        └── help.test.ts
```

### Mock Factories

```typescript
// mocks/llm-mock.ts
export function createLLMMock(responses: MockResponse[]) {
  let callIndex = 0;
  return {
    stream: async () => {
      const response = responses[callIndex++];
      return createMockSSEStream(response);
    }
  };
}

// mocks/redis-mock.ts
export function createRedisMock() {
  const streams = new Map<string, any[]>();
  return {
    publish: async (event) => streams.get(event.run_id)?.push(event),
    read: async (runId) => streams.get(runId) ?? [],
    // etc.
  };
}
```

---

## Timeline Considerations

**Phase 1 (Agent Config):** Foundation work, relatively isolated
**Phase 2 (Plumbing):** Core complexity, fake executor makes it manageable
**Phase 3 (First Tool):** Proves the concept end-to-end
**Phase 4 (More Tools):** Parallel-able once pattern established
**Phase 5 (Integration):** Polish and verification

**Dependencies:**
- Phase 2 can start after Phase 1a (doesn't need submit wiring)
- Phase 3 requires Phase 2d (real executor)
- Phase 4 slices are independent of each other
- Phase 5 requires all prior phases

---

## Risk Mitigation

**Risk:** QuickJS migration complexity
**Mitigation:** Existing 200+ tests provide safety net. Migrate incrementally.

**Risk:** Event loop blocking from WASM
**Mitigation:** Worker pool already implemented in codex-ts. Migrate that too.

**Risk:** Script detection edge cases
**Mitigation:** Comprehensive test suite for malformed/nested/escaped tags.

**Risk:** Tool error propagation
**Mitigation:** Structured error types, test error paths explicitly.

---

## Definition of Done

Each slice is complete when:
1. Tests written and failing (TDD)
2. Implementation makes tests pass
3. No regressions in existing tests
4. Code reviewed (or self-reviewed against checklist)
5. Documentation updated if needed
