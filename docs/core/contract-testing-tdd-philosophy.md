# Contract Testing & TDD Philosophy for In-Process Testing

**Purpose:** Define testing approach for greenfield features, library API development, and system integration where reference implementations don't exist.

**Core Principle:** Test contracts (public boundaries), not implementations (internal methods). Mock external dependencies (network, filesystem, processes). Achieve high coverage through fewer, more meaningful tests.

**Date:** November 8, 2025
**Version:** 1.0

---

## Philosophy: Why Contract Testing

### The Problem with Traditional Unit Testing

**Unit testing focuses on implementation:**
- Tests internal methods and private functions
- Tightly coupled to code structure
- Breaks when refactoring even if behavior unchanged
- High test count, low confidence in actual functionality
- Agents write implementation-specific tests that miss integration issues

**Our context:**
- Porting from Rust gave us vetted tests to port (TDD with known good tests)
- Greenfield features and innovations have no reference tests
- Need reliable TDD scaffolds that guide agents without over-specifying implementation

### Contract Testing Alternative

**Test at library boundaries (public API surface):**
- Entry points external developers use (library API)
- Entry points external systems use (REST API)
- Mock everything that crosses process/machine boundaries

**Benefits:**
- Tests verify actual functionality, not implementation details
- Refactor freely as long as contract maintained
- Full code paths exercised (contract → through implementation → return)
- Test cases obvious from contract definition
- Agents implement to satisfy contract, not mimic internal structure

**Coverage:**
- High coverage from fewer tests
- Each test exercises complete workflows
- Integration confidence without integration complexity

---

## Core Principles

### 1. Identify Contract Boundaries

**Contract = Public API entry point that external code calls**

**For libraries:**
- Class constructors (e.g., `new ConversationManager()`)
- Public methods (e.g., `manager.createConversation()`)
- Event emitters (e.g., `conversation.on('response', ...)`)
- Exported functions (e.g., `buildChatMessages()`)

**For REST APIs:**
- HTTP endpoints (e.g., `POST /conversations`)
- Request/response formats
- Authentication flows
- WebSocket connections

**Process:**
During each phase, identify what should be externally callable. Document in library spec. These become test boundaries.

**Example:**
```
Phase: Wire conversation manager
Contract identified: ConversationManager.createConversation()
Test boundary: Test from createConversation() call → verify conversation created
Mock: ModelClient API calls (external network)
```

### 2. Mock External Boundaries

**External = Crosses process or machine boundary**

**Always mock:**
- Network calls (LLM APIs, web requests)
- Filesystem operations (file I/O)
- Process spawning (exec, shell commands)
- Database connections
- External services (Redis, MCP servers)

**Never mock:**
- In-process logic (our code)
- Data transformations (pure functions)
- State management (our classes)
- Type conversions (our utilities)

**Mocking strategy:**
- Use test doubles (in-memory implementations)
- Inject dependencies (pass mock instead of real client)
- Stub external modules (mock network libraries)

**Example:**
```typescript
// Mock ModelClient for testing ConversationManager
const mockClient = {
  sendMessage: vi.fn().mockResolvedValue({
    items: [/* mock response */]
  })
};

const manager = new ConversationManager({client: mockClient});
const conv = await manager.createConversation();
await conv.sendMessage("test");

// Verify: sendMessage called, conversation stored result
expect(mockClient.sendMessage).toHaveBeenCalled();
```

**No real API call made. Full conversation flow tested.**

### 3. Tests Write Themselves from Contracts

**Once contract defined, test cases are obvious:**

**Contract:**
```typescript
class ConversationManager {
  createConversation(config: ConversationConfig): Promise<Conversation>
}
```

**Test cases automatically follow:**
1. Can create conversation with valid config
2. Created conversation has unique ID
3. Created conversation uses provided config
4. Invalid config throws appropriate error
5. Can create multiple conversations
6. Conversations are isolated from each other

**No guessing what to test—contract defines the surface, test the surface.**

**For each contract method:**
- Happy path (valid inputs → expected output)
- Error cases (invalid inputs → appropriate errors)
- Edge cases (empty, null, boundary values)
- State verification (side effects occurred correctly)

### 4. TDD Workflow: Contract-First

**Step 1: Define Contract**
```
What's the public API for this phase?
Document in library spec (signatures, behavior, errors)
```

**Step 2: Write Tests Against Contract**
```
Test each contract method:
- Create test file at contract boundary
- Mock external dependencies
- Write test cases from contract definition
- Tests fail (nothing implemented yet)
```

**Step 3: Implement to Green**
```
Write minimal code to pass tests:
- Implement contract methods
- Internal structure is flexible
- Tests guide correctness
- Refactor freely (tests stay green)
```

**Step 4: Verify Coverage**
```
All contract methods tested
All error cases covered
All edge cases handled
Mock boundaries verified
```

**Result:** Reliable TDD scaffold that agents can follow mechanically.

---

## Integration with Library & API Specifications

### Natural Alignment

**Library API definition drives testing:**

**When we document:**
```markdown
### ConversationManager API

createConversation(config): Promise<Conversation>
- Creates new conversation with provided configuration
- Returns: Conversation instance with unique ID
- Throws: ConfigurationError if config invalid
```

**Tests write themselves:**
```typescript
describe('ConversationManager', () => {
  describe('createConversation', () => {
    it('creates conversation with valid config', async () => {
      // Test contract behavior
    });

    it('throws ConfigurationError for invalid config', async () => {
      // Test contract error case
    });
  });
});
```

**Same for REST API:**

**When we document:**
```markdown
POST /conversations
Request: {config: ConversationConfig}
Response: {conversationId: string}
Errors: 400 if config invalid, 401 if not authenticated
```

**Tests obvious:**
- Valid request → 200 with conversationId
- Invalid config → 400 with error message
- Missing auth → 401
- Created conversation is accessible

### The Link

**Library spec = Contract definition = Test specification**

1. During phase planning, identify contract boundaries
2. Document in library spec (what external callers use)
3. Test cases derived directly from spec
4. Agents implement to pass contract tests
5. Refactor freely (contract stable, tests stable)

**This creates rock-solid scaffolding:**
- Agents know exactly what to test (the contract)
- Agents know exactly what to mock (external boundaries)
- Tests verify actual functionality (end-to-end through contract)
- No ambiguity, no guessing, no implementation coupling

---

## Benefits for AI Agents

### 1. Clear Test Targets

**Instead of:** "Write tests for this class"
**We say:** "Test the ConversationManager.createConversation() contract. Mock ModelClient. Verify conversation created with correct config."

**Agent knows:**
- What to test (the contract method)
- What to mock (ModelClient)
- What to verify (conversation exists with config)

**No interpretation needed. Mechanical execution.**

### 2. Test Structure Follows Contract Structure

**Agents match test describe blocks to contract:**
```typescript
// Contract
class ConversationManager {
  createConversation()
  getConversation()
  resumeConversation()
}

// Tests
describe('ConversationManager', () => {
  describe('createConversation', () => {/* tests */});
  describe('getConversation', () => {/* tests */});
  describe('resumeConversation', () => {/* tests */});
});
```

**Pattern recognition. Agents excel at this.**

### 3. Mocking is Explicit

**Instead of:** "Test conversation creation"
**We say:** "Mock ModelClient with in-memory stub. Test ConversationManager.createConversation() doesn't make real API calls."

**Agent knows:**
- Create mock: `const mockClient = {sendMessage: vi.fn()}`
- Inject: `new ConversationManager({client: mockClient})`
- Verify: `expect(mockClient.sendMessage).toHaveBeenCalled()`

**Clear instructions. Repeatable pattern.**

### 4. Full Path Coverage Without Complexity

**Single test exercises complete workflow:**
```typescript
it('creates conversation and sends message', async () => {
  const mockClient = createMockClient();
  const manager = new ConversationManager({client: mockClient});

  const conv = await manager.createConversation(config);
  const response = await conv.sendMessage("test");

  // This exercised:
  // - ConversationManager initialization
  // - Conversation creation
  // - Message formatting
  // - Client integration
  // - Response processing
  // - State management

  expect(response).toBeDefined();
});
```

**20+ internal methods tested. One contract test. Agent writes simple test, gets comprehensive coverage.**

### 5. Refactoring Safety

**When we refactor internal implementation:**
- Contract tests stay unchanged (testing external behavior)
- Tests keep passing (contract preserved)
- Confidence in changes (not breaking public API)

**Agents can refactor without rewriting tests.**

---

## Practical Application

### During Phase Planning

**For each phase, document:**

**1. Contract Boundaries Introduced**
```
Phase 1: Basic Chat
New contracts:
- ConversationManager.createConversation()
- Conversation.sendMessage()
- Conversation.on('response')

External mocks needed:
- ModelClient (network → LLM API)
- RolloutRecorder (filesystem → JSONL persistence)
```

**2. Test Scenarios**
```
ConversationManager.createConversation():
- ✅ Creates with valid config
- ✅ Assigns unique conversation ID
- ✅ Stores in manager's conversation map
- ❌ Throws on invalid config
- ❌ Throws on missing required fields

Mocks: ModelClient returns mock responses
```

**3. Mock Implementation**
```
Where to create mocks:
- tests/mocks/model-client.ts
- tests/mocks/rollout-recorder.ts

Mock behavior:
- ModelClient: Returns predefined responses, no network
- RolloutRecorder: Writes to in-memory buffer, no filesystem
```

### During Test Writing (Agent)

**Agent receives:**
- Contract definition (from library spec)
- Test scenarios (from phase planning)
- Mock locations (from planning)

**Agent writes:**
```typescript
// tests/integration/conversation-manager.test.ts

import {ConversationManager} from '../src/core/conversation-manager';
import {createMockClient} from './mocks/model-client';
import {createMockRecorder} from './mocks/rollout-recorder';

describe('ConversationManager Contract', () => {
  let mockClient;
  let mockRecorder;
  let manager;

  beforeEach(() => {
    mockClient = createMockClient();
    mockRecorder = createMockRecorder();
    manager = new ConversationManager({
      client: mockClient,
      recorder: mockRecorder
    });
  });

  describe('createConversation', () => {
    it('creates conversation with valid config', async () => {
      const config = {provider: 'openai', model: 'gpt-4'};
      const conv = await manager.createConversation(config);

      expect(conv).toBeDefined();
      expect(conv.id).toMatch(/^conv_/);
      expect(manager.getConversation(conv.id)).toBe(conv);
    });

    it('throws ConfigurationError for invalid config', async () => {
      await expect(
        manager.createConversation({} as any)
      ).rejects.toThrow('ConfigurationError');
    });
  });

  describe('sendMessage', () => {
    it('sends message and receives response', async () => {
      const conv = await manager.createConversation(validConfig);
      const response = await conv.sendMessage("Hello");

      expect(mockClient.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({content: "Hello"})
          ])
        })
      );
      expect(response.items.length).toBeGreaterThan(0);
    });
  });
});
```

**Agent followed:**
- Test at contract boundary (ConversationManager, Conversation)
- Mocked externals (ModelClient, RolloutRecorder)
- Verified contract behavior (conversation created, message sent)
- Full workflow tested (create → send → verify)

**No unit tests of internal methods. Just contract verification.**

### During Implementation (Agent)

**Agent implements to green:**
- Make contract tests pass
- Internal structure up to agent
- Can refactor as needed
- Tests guide correctness

**Coverage emerges naturally:**
- Contract test calls public method
- Public method calls internal methods
- Internal methods tested indirectly
- Coverage report shows 80-90% from contract tests alone

---

## Key Principles Summary

**1. Test contracts, not implementations**
- Public API surface = test surface
- Internal methods tested indirectly
- Refactoring doesn't break tests

**2. Mock external boundaries**
- Network, filesystem, processes = always mocked
- In-process logic = never mocked
- Clear boundary definition

**3. Tests derive from contract definitions**
- Once API documented, test cases obvious
- Agents follow mechanical process
- No creative interpretation needed

**4. TDD scaffold from contracts**
- Define contract → write tests → implement
- Tests guide implementation
- Green tests = contract satisfied

**5. High coverage from fewer tests**
- Each contract test exercises full path
- Integration confidence without integration complexity
- Focus effort on meaningful scenarios

**6. Library/API specs drive test specs**
- Natural alignment between API definition and test definition
- Contract changes → test changes (explicit)
- Documentation and testing coupled intentionally

---

## Relationship to Other Testing

### Unit Tests

**When to write:**
- Complex algorithms needing isolated verification
- Edge case exploration in pure functions
- Performance-critical code paths

**When to skip:**
- Simple delegation or glue code
- Code already covered by contract tests
- Internal implementation details

**At this stage: Focus on contract tests. Unit tests optional.**

### Integration Tests

**Contract tests ARE integration tests:**
- Test through public API (integration point)
- Exercise full code paths (integrated behavior)
- Verify contracts between components

**Difference from traditional integration:**
- Mock external services (not full end-to-end)
- In-process only (fast, deterministic)
- Focus on contract verification

### End-to-End Tests

**Separate from contract tests:**
- Use real external services
- Cross process/machine boundaries
- Slower, more fragile
- Fewer tests (smoke tests, critical paths)

**Contract tests replace most E2E needs:**
- Same coverage, mocked boundaries
- Fast, reliable, deterministic
- Run in CI without external dependencies

---

## Application to Our Projects

### Port Projects (Phase 1-6)

**Approach:** Port existing tests first (TDD with reference)
- Tests already vetted in production
- Known good implementation to match
- Agents port tests → port implementation → green

**Contract testing not primary** (reference tests available)

### Innovation Projects (UI Integration, Scripting, Gradient, etc.)

**Approach:** Contract-first TDD
- Define library API surface (contracts)
- Write contract tests with mocked externals
- Implement to green
- Refine as needed

**Contract testing is primary** (no reference implementation)

### Hybrid (Wire-up Projects like UI Integration)

**Mix both approaches:**
- Existing modules: Already have unit tests (keep them)
- New integration: Contract tests at boundaries
- Wiring code: Tested through contract tests
- CLI commands: Contract tests with mocked core

**Focus contract tests on new integration points.**

---

## Practical Guidelines

### Identifying Contracts in Each Phase

**Questions to ask:**
1. What will external code call in this phase?
2. What's the entry point a developer uses?
3. What crosses a process/machine boundary?
4. What would we document in API reference?

**These are your contracts. Test these.**

### Documenting Contract + Tests Together

**In phase planning (README or library spec):**

```markdown
## Contracts Introduced

### ConversationManager.createConversation()

**Contract:**
- Input: ConversationConfig {provider, model, auth}
- Output: Promise<Conversation>
- Side effects: Conversation stored in manager
- Errors: ConfigurationError if invalid

**External dependencies:**
- ModelClient (mock: return predefined responses)
- RolloutRecorder (mock: in-memory storage)

**Test scenarios:**
1. Valid config → conversation created ✓
2. Invalid config → ConfigurationError ✓
3. Multiple conversations → isolated ✓
4. Same conversation retrievable → manager.get() ✓
```

**Agent reads this → writes tests mechanically**

### Mock Creation Pattern

**Create reusable mock factories:**

```typescript
// tests/mocks/model-client.ts
export function createMockClient(responses?: MockResponse[]) {
  return {
    sendMessage: vi.fn()
      .mockResolvedValueOnce(responses?.[0] ?? defaultResponse)
      .mockResolvedValueOnce(responses?.[1] ?? defaultResponse),
    // ... other methods
  };
}

// Usage in tests
const client = createMockClient([
  {items: [/* first response */]},
  {items: [/* second response */]}
]);
```

**Reusable, configurable, clear.**

### Verification Strategy

**What to verify in contract tests:**

**1. Return values match contract:**
```typescript
const result = await contract.method(input);
expect(result).toMatchObject({expectedShape});
```

**2. Side effects occurred:**
```typescript
expect(manager.getConversation(id)).toBeDefined();
```

**3. External calls made correctly:**
```typescript
expect(mockClient.sendMessage).toHaveBeenCalledWith(
  expect.objectContaining({messages: [...]})
);
```

**4. Errors thrown appropriately:**
```typescript
await expect(contract.method(invalidInput))
  .rejects.toThrow('ExpectedError');
```

**Verify contract satisfied, not implementation details.**

---

## Why This Enables Reliable Agentic Coding

### Clear Scaffolding

**Agents receive:**
- Explicit contract definition
- Obvious test cases
- Clear mock boundaries
- Mechanical verification steps

**Agents execute:**
- No creative interpretation
- Follow defined pattern
- Tests guide implementation
- Coverage emerges naturally

### Reduced Scope Creep

**Contract bounds the work:**
- Implement this contract, nothing more
- Tests verify contract, nothing else
- Agent stays focused on defined surface

**No over-engineering, no under-specification.**

### Fast Feedback Loops

**Contract tests run fast:**
- All in-process (no external services)
- Deterministic (mocked boundaries)
- Parallel (independent test suites)

**Agents iterate quickly:**
- Write test → implement → green in minutes
- No waiting for external services
- No flaky tests from network issues

### Refactoring Confidence

**Agents can refactor without fear:**
- Tests verify contract (behavior)
- Internal changes don't break tests
- Coverage maintained automatically

**Innovation enabled** (can try different approaches safely)

---

## Summary

**Core philosophy:** Test what external code calls (contracts), mock what crosses boundaries (externals), achieve high coverage through complete path testing.

**Benefits:**
- Tests write themselves from contract definitions
- High coverage from fewer tests
- Reliable TDD scaffolds for agents
- Refactoring safety
- Fast, deterministic test runs

**Application:**
- Define contracts during phase planning
- Document in library/API specs
- Write contract tests with mocks
- Implement to green
- Refactor as needed

**Result:** Rock-solid scaffolding through complex wire-up, integration work, and iterative innovation.

**This approach has proven effective over 3 months of agentic AI coding**, particularly for projects where reference implementations don't exist and agents must build from specifications rather than port existing code.

---

## References

- Library API Specification: `docs/api/library-api.md`
- REST API Specification: `docs/api/rest-api.md`
- Quality Gates: `docs/core/quality-gates.md`
- Dev Standards: `docs/core/dev-standards.md`
