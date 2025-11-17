
## Project Overview

**Codex TypeScript Port** - A systematic migration of OpenAI's Codex Rust workspace to TypeScript. This is not a rewrite but a methodical port that preserves the architecture, patterns, and behavior of the original Rust implementation while adapting to idiomatic TypeScript.

**Current Status:** Phase 2 of Project 02 (UI Integration & Library Definition)
- 21 core modules ported from Rust
- 1,895+ tests passing
- CLI foundation established (Phase 1 complete)
- Tool integration in progress (Phase 2 active)

## Core Architecture

### SQ/EQ Pattern (Submission Queue / Event Queue)

The Codex system uses an event-driven architecture for asynchronous communication between user and agent:

- **Submission Queue (SQ):** User/CLI submits `Op` (operations) to the agent
- **Event Queue (EQ):** Agent emits `EventMsg` (events) back to user/CLI
- **Discriminated unions:** Type-safe message passing with 40+ event variants
- **Event correlation:** Each event references its triggering submission via ID

This is a Codex-specific design pattern (not a Rust language feature) that enables:
- Progressive UI updates (thinking → tool execution → results → response)
- Tool approval flow (exec_approval_request → user decision → submit approval)
- Cancellation and interruption
- Streaming tool execution visibility

### Key Components

**ConversationManager** (`codex-ts/src/core/conversation-manager.ts`)
- Primary library entry point
- Creates and manages Codex conversations
- Wires together auth, persistence, model clients, tool routing

**Codex** (`codex-ts/src/core/codex/codex.ts`)
- High-level orchestration engine
- Implements SQ/EQ queue pair
- submit() operations, receive nextEvent() responses
- Spawns sessions with configuration

**Conversation** (`codex-ts/src/core/conversation.ts`)
- User-facing conversation API
- sendMessage(), nextEvent(), approveExec(), denyExec()
- Wraps Codex with simpler interface

**Protocol Types** (`codex-ts/src/protocol/protocol.ts`)
- Defines all Op and EventMsg types
- Submission, Event interfaces
- Core discriminated unions

**CLI Display** (`codex-ts/src/cli/display.ts`)
- Event rendering layer
- handleEvent() switch on EventMsg types
- Tool approval prompts, progress display

## Common Development Commands

### Setup
```bash
cd codex-ts
npm install                    # First time only
./scripts/setup-cody-alias.sh  # Link CLI globally as 'cody'
```

### Testing
```bash
npm test                       # Run all tests (1,895+ tests)
npm test -- --watch            # Watch mode during development
npm test -- run path/to/file   # Run specific test file
```

### Building
```bash
npm run build                  # TypeScript compilation to dist/
```

### Code Quality
```bash
npm run format                 # Auto-format with Prettier (required before commit)
npm run format:check           # Check formatting without changes
npm run lint                   # ESLint code quality checks
npm run type-check             # TypeScript strict checks (tsc --noEmit)
```

### CLI Usage (after setup)
```bash
cody --help                    # Show CLI help
cody new                       # Create new conversation
cody chat "message"            # Send message in conversation
cody list                      # List saved conversations
```

### Quality Verification (before marking phase complete)
```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```
All commands must succeed with 0 errors before phase completion.

## Testing Philosophy

### Mocked-Service Tests (PRIMARY)
Integration-level tests in `tests/mocked-service/` are the core quality mechanism:
- Exercise complete workflows (conversation flow, tool execution, provider switching)
- Mock external boundaries (ModelClient, RolloutRecorder, AuthManager, network, filesystem)
- Fast (<5 seconds total), deterministic, offline-runnable
- Written at library API boundaries as contracts are defined during planning
- See `docs/core/contract-testing-tdd-philosophy.md` for detailed approach

### Unit Tests (OPTIONAL)
Ported Rust tests in module directories are useful but not required going forward:
- Validate individual function behavior
- Maintained from original port
- Continue passing but new development focuses on mocked-service tests

### Test Organization
```
tests/
├── mocked-service/    # PRIMARY - integration with mocked externals
├── mocks/             # Shared mock implementations
└── unit/              # Original port tests (optional)
```

## Project Structure

### Port Organization (Phases 1-6)
The TypeScript port follows the Rust workspace structure where applicable:

```
codex-ts/src/
├── protocol/          # Core protocol types and utilities
│   ├── protocol.ts    # SQ/EQ types, Op, EventMsg
│   ├── items.ts       # Turn items, user input types
│   └── ...
├── core/              # Orchestration and business logic
│   ├── codex/         # Main orchestration engine
│   ├── conversation-manager.ts
│   ├── conversation.ts
│   ├── config.ts      # Configuration system
│   ├── auth/          # Authentication (OAuth, API keys)
│   ├── client/        # Model client adapters
│   └── rollout.ts     # Conversation persistence (JSONL)
├── tools/             # Tool system
│   ├── registry.ts    # Tool registration
│   ├── types.ts       # Tool interfaces
│   └── ...
├── utils/             # Utilities
│   ├── string.ts      # UTF-8 safe truncation
│   ├── cache.ts       # LRU caching
│   ├── tokenizer.ts   # Token counting
│   └── ...
└── cli/               # CLI layer (Project 02)
    ├── index.ts       # Entry point, Commander.js setup
    ├── display.ts     # Event rendering
    ├── runtime.ts     # CLI runtime setup
    └── state.ts       # CLI state management
```

### UI Integration Project (Project 02, Current)
Project 02 wires ported modules into a working CLI called **Cody**:

**Phases:**
1. ✅ Basic Chat Flow - Single provider, API key auth, conversation loop
2. 🔄 Tool Integration - Approval prompts, tool execution display
3. ⏳ Multi-Provider - OpenAI (Responses, Chat), Anthropic (Messages)
4. ⏳ Authentication - OAuth token retrieval (ChatGPT, Claude)
5. ⏳ Persistence & Resume - JSONL save/load, conversation history
6. ⏳ Library API Finalization - Document @openai/codex-core public surface
7. ⏳ REST API Design (Optional) - HTTP wrapper specification
8. ⏳ Integration Polish - Bug fixes, edge cases, UX refinements

## Development Standards

### TypeScript Requirements
- **Strict mode enabled:** No `any` types (use `unknown` or proper types)
- **ES Modules only:** Use `import`/`export`, not `require()`/`module.exports`
- **Modern syntax:** Target ES2022, leverage latest JavaScript features
- **Type safety:** Discriminated unions for variants, no implicit any

### Code Style
- **Formatting:** Prettier handles ALL formatting (non-negotiable)
  - Single quotes, 100 char width, 2 space indent, trailing commas, no semicolons
- **Naming:** camelCase functions, PascalCase classes/types, UPPER_SNAKE_CASE constants
- **Documentation:** JSDoc on public APIs, inline comments explain *why* not *what*

### Testing Standards
- **Baseline maintained:** Existing 1,895+ tests continue passing
- **No skipped tests:** 0 `.skip`, 0 `.todo` in suite
- **New functionality:** Add mocked-service tests at library boundaries
- **Fast execution:** All tests complete in <5 seconds

### Rust → TypeScript Patterns
```typescript
// Rust: Option<T>
// TypeScript: T | undefined
function find(id: string): User | undefined {
  return users.get(id);
}

// Rust: Result<T, E>
// TypeScript: Throw errors (preferred) or union types
function parse(input: string): Config {
  if (!validate(input)) throw new ParseError('Invalid input');
  return config;
}

// Rust: Vec<T>, HashMap<K, V>
// TypeScript: T[], Map<K, V> or Record<string, V>
const items: User[] = [];
const cache = new Map<string, Value>();
```


## Tool System Architecture

Tools use a registry pattern with approval callbacks:

```typescript
// ToolApprovalCallback injected at ConversationManager creation
type ToolApprovalCallback = (
  tool: string,
  args: unknown,
  riskLevel: SandboxRiskLevel
) => Promise<ReviewDecision>;

// Tool execution flow:
// 1. Model requests tool use
// 2. exec_approval_request event emitted
// 3. CLI displays prompt, calls approvalCallback
// 4. User approves/denies
// 5. CLI submits exec_approval operation
// 6. Tool executes if approved
// 7. exec_command_begin → exec_command_end events
// 8. Result returned to model
```

## Important Architectural Constraints

1. **Ported module stability:** Core modules from Phases 1-6 provide foundation. Changes only when integration reveals genuine issues.

2. **Provider abstraction:** WireApi enum and adapter pattern preserved. CLI is provider-agnostic—same conversation code works with OpenAI Responses, Chat Completions, Anthropic Messages.

3. **Event-driven UI:** All UI updates driven by EventMsg types from protocol. CLI layer subscribes to events, doesn't poll or directly access state.

4. **Stateless operations:** Library API designed for future REST wrapper. Async/Promise-based patterns map to HTTP request/response.

5. **Tool system unchanged:** ToolRegistry and ToolRouter from Phase 3-4 used as-is. CLI adds display layer, not tool execution changes.

## Git Workflow

### Branch Naming
```
claude/phase-2-tool-integration
claude/fix-approval-prompt
```

### Commit Format
```
type(scope): brief description

Detailed explanation if needed

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:** feat, fix, docs, test, refactor, chore

### Commit Examples
```bash
git commit -m "feat(cli): add tool approval prompt to display layer"
git commit -m "test(mocked-service): add Phase 2 tool execution contract tests"
git commit -m "fix(display): handle tool execution timeout event"
```

## External Dependencies

### LLM Providers
- OpenAI Responses API (GPT-5-Codex)
- OpenAI Chat Completions API
- Anthropic Messages API

### Authentication
- API keys: OpenAI, Anthropic, OpenRouter
- OAuth tokens: ChatGPT (~/.codex), Claude (~/.claude)
- Token refresh handled by respective CLI apps (not implemented here)

### MCP (Model Context Protocol)
- `@modelcontextprotocol/sdk` for MCP server integration
- Configuration in ~/.codex/config.toml
- See `docs/projects/02-ui-integration-phases/PRD.md` for MCP details

## Known Patterns

### Event Loop Pattern
```typescript
// Core pattern in CLI display layer
async function renderConversationUntilComplete(conversation: Conversation) {
  let done = false;
  while (!done) {
    const event = await conversation.nextEvent();
    done = handleEvent(event.msg);
  }
}
```

### Discriminated Union Handling
```typescript
// Type-safe event handling with exhaustiveness checking
function handleEvent(msg: EventMsg): boolean {
  switch (msg.type) {
    case "agent_message":
      console.log(`Assistant: ${msg.message}`);
      return false;
    case "task_complete":
      return true;
    case "turn_aborted":
      console.error(`Aborted: ${msg.reason}`);
      return true;
    default:
      // TypeScript ensures exhaustiveness if all cases covered
      const _exhaustive: never = msg;
      return false;
  }
}
```

### Async Resource Cleanup
```typescript
// Pattern for graceful shutdown
async function cleanup(conversation: Conversation) {
  try {
    await conversation.interrupt();
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}
```

## Debugging

### Tracing / Verbose Logging
Set environment variables for detailed tracing:
```bash
RUST_LOG=debug cody chat "message"  # Detailed logs
RUST_LOG=trace cody chat "message"  # Very detailed logs
```

### Test Debugging
```bash
npm test -- --reporter=verbose      # Detailed test output
npm test -- run path/to/test.ts     # Run single test file
```

### TypeScript Compilation Debugging
```bash
npx tsc --noEmit --listFiles        # Show all compiled files
npx tsc --noEmit --traceResolution  # Module resolution debugging
```

---

# Reference: Execution Agent Prompt Engineering

This guide builds upon the foundational principles established in the "Masterclass on Agentic Planning and Documentation." It assumes you have internalized those concepts—The Narrative Substrate, Multi-Altitude Structure, Functional-Technical Weaving, and the Agent Cognitive Model—and provides the operational details for engineering effective prompts for execution agents (Coders and Verifiers).

**Purpose:** To define the structure and content of prompts for Coding and Verification agents, operationalizing the core methodology for reliable agentic execution.

-----

## The Foundation: The Prompt as External Scaffold

As established in the Masterclass, execution agents (LLMs) often lack the internal "interrupt signal" to self-orient, question assumptions, or maintain continuity across stateless sessions. They execute in isolation.

**The prompt is the External Metacognitive Scaffold.** It is not merely a task description; it is the mechanism through which we explicitly manage the agent's attention, load its external memory (state), define its workflow, and enforce quality gates.

Every section in the prompt anatomy is designed to address a specific cognitive limitation and ensure reliable execution.

-----

## Part 1: The Coding Agent Prompt

The Coding Agent is responsible for implementation. Its prompt must provide complete context, clear instructions, and explicit success criteria.

### Anatomy of an Effective Coding Prompt (12 Sections)

1.  Role Definition
2.  Project Context
3.  Current Phase/Task & Functional Outcome
4.  Prerequisites (What's Done)
5.  Workspace/Location Info
6.  State Loading Instructions (Read These Files FIRST)
7.  Task Specification
8.  Workflow Steps
9.  Workflow Rules & Interrupt Protocol
10. Code Quality Standards
11. Session Completion Checklist (BEFORE ENDING)
12. Starting Point

-----

### 1\. Role Definition (Setting Perspective and Initial Weights)

**Purpose:** Set the agent's identity, expertise level, and **Perspective** (Depth Dimension). This establishes the initial **Attentional Weights** for how they approach the work.

**Guidance:** Be specific. "Senior" implies confident decision-making and architectural awareness. Match the specialization to the task.

```
ROLE: You are a senior TypeScript developer implementing the integration wiring for the Cody CLI project.
```

-----

### 2\. Project Context (High Altitude Orientation)

**Purpose:** Provide a brief overview (25k feet Altitude) of the project. This grounds the specific task in the broader strategic "why."

**Guidance:** Keep it to one sentence. This is orientation, not a deep dive.

```
PROJECT: Cody CLI Integration - Building a multi-mode CLI (REPL, one-shot, JSON) wrapper around the @openai/codex-core library.
```

-----

### 3\. Current Phase/Task & Functional Outcome (Weaving)

**Purpose:** Define the specific work for this session (1k feet Altitude). Crucially, this must maintain the **Functional-Technical Weave**.

**Guidance:** The Coder must understand *what* they are enabling for the user, not just *how* they are implementing the code. This is the verification anchor.

```
CURRENT PHASE: Phase 1 - Basic Chat Flow (Wiring CLI to ConversationManager)

FUNCTIONAL OUTCOME: After this phase, the user can start a new conversation via `cody new` and send a message via `cody chat "message"`, receiving a response from the LLM.
```

-----

### 4\. Prerequisites (What's Done)

**Purpose:** Define the existing foundation. This reduces uncertainty and allows the agent to confidently build upon prior work.

```
PREREQUISITES:
- Library Layer (Phases 1-6 of Port) ✅ COMPLETE (Core modules exist, unit tested)
- PRD & TECH-APPROACH ✅ COMPLETE (Project planning finalized)
```

-----

### 5\. Workspace/Location Info (Spatial Orientation)

**Purpose:** Provide explicit path information. Agents cannot infer the workspace structure.

```
NOTE: Workspace is /Users/user/code/cody-project
(TypeScript code is in src/ subdirectory)
```

-----

### 6\. State Loading (Operationalizing External Memory) - CRITICAL

**Purpose:** This is how we overcome the agent's statelessness. It forces the agent to load its memory (the current state of the project) *before* acting.

**Guidance:** The order is mandatory. The agent must understand the current state before diving into the technical details. This implements the **Smooth Descent**.

```
FIRST: Load Memory (Read status and plan)
- Read phase-1/STATUS.md (current progress)
- Read phase-1/CHECKLIST.md (task list)
- Read phase-1/README.md (phase overview and design - 10k ft view)

THEN: Read Technical Context
- Read TECH-APPROACH.md Section 2 (Phase 1 details - 15k ft view)
- Read docs/core/DEV_STANDARDS.md (code standards)
```

-----

### 7\. Task Specification (The Execution Plan)

**Purpose:** Detailed, actionable instructions on what to build.

**Guidance:** Apply **Bespoke Depth**. Provide more detail for complex or risky tasks. Include scope indicators (line estimates, complexity) and order tasks by dependency.

```
TASKS (In Order):
1. Implement CLI Entry Point (src/cli/index.ts) - EASY (~50 lines)
   - Initialize Commander.js
   - Define `cody new` and `cody chat` commands.

2. Implement Command Handlers (src/cli/commands/new.ts, chat.ts) - MEDIUM (~150 lines)
   - Instantiate ConversationManager.
   - Call createConversation() / sendMessage().
   - Handle response display.
```

-----

### 8\. Workflow Steps (The Execution Scaffold)

**Purpose:** Define the explicit process for completing each task. This reduces decisions and ensures consistency.

**Guidance:** Be explicit with commands. A TDD workflow is generally preferred.

```
WORKFLOW (per task):
1. Create test file: tests/mocked-service/phase-1/[TASK].test.ts
2. Write mocked-service test based on README specification.
3. Run: npm test -- [TASK] (should fail)
4. Implement the feature in src/...
5. Implement until tests pass.
6. Verify quality gates (lint, types - see Section 10).
7. Commit: git add -A && git commit -m "phase1: [task description]"
8. Update CHECKLIST.md and STATUS.md.
```

-----

### 9\. Workflow Rules & Interrupt Protocol

**Purpose:** Define mandatory operating procedures and how to handle ambiguity, addressing the agent's lack of inherent interrupts (The **Interrupt Problem**).

**Guidance:** This is crucial for safety and preventing hallucinated solutions.

```
WORKFLOW RULES:
1. Follow the workflow steps exactly. Do not skip or reorder.
2. Use only the specified libraries and patterns. Do not introduce new dependencies without approval.
3. Adhere strictly to the DEV_STANDARDS.md.

INTERRUPT PROTOCOL (When to STOP):
If you encounter any of the following, you MUST STOP immediately, report the issue to the user, and await clarification. Do NOT attempt to proceed by making assumptions.

- Ambiguous or contradictory instructions in the prompt or documentation.
- Missing prerequisites or files.
- Unexpected errors during workflow execution that you cannot resolve deterministically.
- A design choice that appears to violate the stated Functional Outcome.
```

-----

### 10\. Code Quality Standards (The Verification Anchor)

**Purpose:** Establish the mandatory, objective quality bar.

**Guidance:** Zero-tolerance works. Vague goals ("write clean code") fail. Provide a single verification command.

```
CODE QUALITY STANDARDS (MANDATORY):
- TypeScript: Zero errors (npx tsc --noEmit)
- ESLint: Zero problems (npm run lint)
- Tests: All passing, 0 skipped (npm test)
- Format: Prettier compliant (npm run format)

VERIFICATION COMMAND:
npm run format && npm run lint && npx tsc --noEmit && npm test

This command must succeed (exit code 0) before declaring any task complete.
```

-----

### 11\. Session Completion Checklist (Saving External Memory) - CRITICAL

**Purpose:** Ensure the state is saved, work is committed, and the handoff is clean. This updates the **External Memory** for the next session.

```
BEFORE ENDING SESSION (MANDATORY):
1. Update phase-1/CHECKLIST.md (check off completed tasks).
2. Update phase-1/STATUS.md (add detailed session log: what was done, what's next, any blockers).
3. Run VERIFICATION COMMAND (Section 10) one last time.
4. Commit and Push all changes.
5. Report summary to user (Modules completed, Test counts, Quality status, Next steps).
```

-----

### 12\. Starting Point (The Entry Point)

**Purpose:** Tell the agent exactly where to begin, reducing paralysis.

```
START by reading phase-1/STATUS.md to load the current state, then begin with Task 1 (Implement CLI Entry Point).
```

-----

## Part 2: The Verification Agent Prompt

The Verification Agent acts as the quality gate. Its role is not implementation, but critical analysis and validation. The Verifier prompt shares context with the Coder prompt but diverges significantly in its Role, Tasks, and Workflow.

### Anatomy of an Effective Verifier Prompt (10 Sections)

1.  Role Definition
2.  Project Context
3.  Current Phase & Functional Outcome
4.  Artifacts for Review (What was built)
5.  State Loading Instructions (Read These FIRST)
6.  Verification Scope and Tasks
7.  Workflow Steps
8.  Verification Standards & Criteria
9.  Reporting Requirements (The Deliverable)
10. Starting Point

-----

### V.1. Role Definition (The Skeptical Perspective)

**Purpose:** Establish the mindset of critical analysis, adherence to standards, and quality enforcement.

```
ROLE: You are a Senior Quality Assurance Engineer and Code Review specialist, responsible for verifying the implementation of Phase 1 (Basic Chat Flow) of the Cody CLI project. Your analysis must be rigorous, objective, and focused on adherence to documented standards and functional requirements.
```

-----

### V.2. Project Context

*(Same as Coder Prompt Section 2)*

-----

### V.3. Current Phase & Functional Outcome

**Purpose:** Define the scope of the work being verified and the functional requirements that must be met.

**Guidance:** This is the anchor for **Functional-Technical Weaving**. The Verifier must validate that the technical implementation achieves the functional outcome.

```
CURRENT PHASE: Phase 1 - Basic Chat Flow

FUNCTIONAL OUTCOME TO VERIFY: The user must be able to start a new conversation via `cody new` and send a message via `cody chat "message"`, receiving a response from the LLM.
```

-----

### V.4. Artifacts for Review

**Purpose:** Explicitly list the code and tests generated by the Coding Agent that require verification.

```
ARTIFACTS FOR REVIEW (Implementation by Coding Agent):
- src/cli/index.ts
- src/cli/commands/new.ts
- src/cli/commands/chat.ts
- tests/mocked-service/phase-1/basic-chat.test.ts
- phase-1/DECISIONS.md (If updated by the coder)
```

-----

### V.5. State Loading Instructions

**Purpose:** Load the context, standards, and requirements against which the artifacts will be verified.

**Guidance:** The Verifier must read the requirements and standards (The Intent) *before* reading the implementation code (The Reality) to avoid bias and perform an accurate gap analysis.

```
FIRST: Read Requirements and Standards (The Intent / Source of Truth)
- Read phase-1/README.md (Phase requirements and design)
- Read TECH-APPROACH.md Section 2 (Architectural context)
- Read docs/core/DEV_STANDARDS.md (Code quality requirements)
- Read docs/core/TESTING_PHILOSOPHY.md (Testing strategy)

THEN: Review Implementation Artifacts (The Reality)
- Read all files listed in "Artifacts for Review" (Section V.4).
```

-----

### V.6. Verification Scope and Tasks

**Purpose:** Define the specific verification activities required, typically broken into stages (Mechanical and Conceptual).

```
VERIFICATION TASKS:

STAGE 1: Mechanical Checks & Execution
1. Environment Setup: Verify environment setup and dependency installation.
2. Execute Verification Command: Run the VERIFICATION COMMAND (see V.8). Confirm 0 errors/failures.
3. Checklist Verification: Ensure all tasks marked complete by the Coder are actually complete and verified by tests.

STAGE 2: Conceptual Review & Analysis
1. Test Coverage Analysis:
   - Review the tests. Validate that they adequately cover the requirements defined in phase-1/README.md.
   - Identify any missing test cases, edge cases, or inadequate assertions.
   - Confirm adherence to the Mocked-Service testing strategy.

2. Code Review & Design Adherence:
   - Review the implementation code.
   - Validate adherence to DEV_STANDARDS.md (style, types, patterns).
   - Confirm the implementation matches the design specified in phase-1/README.md and TECH-APPROACH.md.
   - Review DECISIONS.md (if applicable) for soundness of choices made during implementation.
   - Identify any code smells, complexity issues, or potential bugs.

3. Functional Requirement Validation:
   - Analyze the code and tests holistically.
   - Confirm that the implementation successfully achieves the FUNCTIONAL OUTCOME (Section V.3).
```

-----

### V.7. Workflow Steps

**Purpose:** Define the explicit, sequential process for verification.

```
WORKFLOW:
1. Load State and Context (Section V.5).
2. Execute STAGE 1: Mechanical Checks.
   - If FAIL: Stop immediately and generate FAILURE REPORT.
3. Execute STAGE 2: Conceptual Review.
4. Synthesize findings and generate the Verification Report (Section V.9).
```

-----

### V.8. Verification Standards & Criteria

**Purpose:** The objective gates for passing the phase.

```
VERIFICATION STANDARDS:

VERIFICATION COMMAND:
npm run format && npm run lint && npx tsc --noEmit && npm test

PASS CRITERIA (All must be true):
- VERIFICATION COMMAND succeeds (0 errors/failures).
- Test Coverage is adequate for all requirements.
- Code adheres to all standards in DEV_STANDARDS.md.
- Implementation matches the documented design.
- Functional Outcome is achieved.

FAIL CRITERIA (Any are true):
- VERIFICATION COMMAND fails.
- Significant gaps in test coverage.
- Violations of DEV_STANDARDS.md.
- Implementation diverges from the design without documented justification.
```

-----

### V.9. Reporting Requirements (The Deliverable)

**Purpose:** Define the required output of the verification session.

**Guidance:** The report must be structured and clear, providing actionable feedback if the verification fails.

```
REPORTING REQUIREMENTS:

Generate a detailed VERIFICATION_REPORT.md with the following structure:

1. OVERALL STATUS: [PASS] or [FAIL]

2. Mechanical Check Results (Stage 1):
   - Linting: [PASS/FAIL] (Error count: X)
   - Type Checking: [PASS/FAIL] (Error count: Y)
   - Tests: [PASS/FAIL] (Tests passed: Z/Z)

3. Conceptual Review Findings (Stage 2):
   - Test Coverage Analysis: [Sufficient/Insufficient]. (Issues: List missing cases, weak assertions)
   - Code Review & Design Adherence: [Adherent/Divergent]. (Issues: List specific code smells, violations, suggestions with file/line references)
   - Functional Validation: (Summary of why the implementation does or does not meet the functional outcome).

If STATUS is FAIL: The report must contain ACTIONABLE FEEDBACK for the Coding Agent to address all identified issues.
```

-----

### V.10. Starting Point

```
START by reading the Requirements and Standards (Section V.5), then proceed with the Workflow Step 1.
```

---

# Reference: Service-Mocked Testing Methodology

This document defines our core testing philosophy, building upon the foundational principles established in the "Masterclass on Agentic Planning and Documentation." It introduces **Service-Mocked Testing** as the specific methodology that enables reliable, high-quality agentic development by balancing the comprehensiveness of integration testing with the speed of unit testing.

**Purpose:** Define the testing strategy for ensuring quality, reliability, and functional correctness in agentic development.
**Core Principle:** Test behavior at public boundaries, exercise full in-process code flows, and mock only external dependencies.

-----

## 1\. Introduction to Service-Mocked Testing

Our primary testing methodology is **Service-Mocked Testing**.

### 1.1. Definition and Positioning

**Service-Mocked Tests** are integration-level tests written at the public API boundaries of the system. They exercise the full, in-process code flow, but crucially, all external dependencies (services that cross process or machine boundaries) are mocked.

**Positioning:**

  * **Like Integration Tests:** They test the system through key entry points (the public API) and verify how internal components work together across complete workflows.
  * **Unlike Traditional Integration Tests:** They do not rely on external dependencies, avoiding slowness and flakiness.
  * **Like Unit Tests:** They run fast, deterministically, and in isolation (offline), often using the same testing frameworks (e.g., Vitest, Jest).
  * **Unlike Traditional Unit Tests:** They focus on public behavior and boundaries, not isolated internal implementation details.

We call them "Service-Mocked" tests because the defining characteristic is the explicit mocking of external services while the rest of the system runs as an integrated unit.

### 1.2. The Philosophy: Testing Behavior at Boundaries

As established in the Masterclass, **Functional-Technical Weaving** is essential for coherence. Our testing methodology is the verification mechanism for this weaving. We must verify the functional outcome (What the system does) rather than the technical implementation (How it does it).

Traditional unit testing often fails here. It focuses on implementation, leading to brittle tests tightly coupled to internal code structure. These tests break during refactoring even if behavior is unchanged, providing a false sense of security (high test count, low confidence in the integrated system).

Service-Mocked Testing focuses on the stable public boundaries—the promises the API makes to its consumers.

**Benefits:**

1.  **Behavioral Focus:** Tests verify actual system behavior and full code paths, ensuring the system works as intended from the perspective of the consumer.
2.  **Refactoring Safety:** Internal implementation can be refactored freely as long as the behavior at the public boundary is maintained.
3.  **Optimized Signal Density (Bespoke Depth):** We achieve high coverage through fewer, more meaningful tests by focusing effort on the critical entry points, optimizing the signal density of the test suite.

-----

## 2\. The Two-Layer Testing Strategy

We employ a Two-Layer strategy to balance development speed with real-world validation.

### Layer 1: Service-Mocked Tests (The Inner Loop)

  * **Focus:** Integration wiring correctness, business logic, and adherence to the public API definition.
  * **Characteristics:** Fast, deterministic, offline.
  * **Role:** The primary test layer for development and Continuous Integration (CI). Provides the rapid feedback loop necessary for TDD.
  * **Coverage:** Comprehensive coverage of all scenarios, permutations, and edge cases.

### Layer 2: Model Integration Tests (The Outer Loop)

  * **Focus:** Real-world provider behavior, configuration parameters, and actual compatibility with external services (e.g., LLM APIs).
  * **Characteristics:** Slower, uses real API calls (typically with cheap/fast models), requires network access.
  * **Role:** Final validation layer before release or when integrating new external services.
  * **Coverage:** Focused on critical paths to validate integration without excessive time or cost.

**The Balance:** Layer 1 ensures the system is correct according to our specifications. Layer 2 ensures our specifications match the reality of the external services.

-----

## 3\. Core Principles of Service-Mocked Testing

### 3.1. Identify Public Boundaries

**A Public Boundary is the API entry point that external code calls.**

  * **Libraries:** Public methods (e.g., `ConversationManager.createConversation()`), constructors, exported functions.
  * **REST APIs:** HTTP endpoints (e.g., `POST /conversations`).

During planning (at the 10k ft **Altitude**), we must identify and document the specifications and expected behaviors of these boundaries. These become the targets for our tests.

### 3.2. Define Mocking Boundaries (The Distinction)

Clarity on what to mock is essential.

**External Boundaries (ALWAYS MOCK):** Anything that crosses the process or machine boundary.

  * Network calls (LLM APIs, databases, external services).
  * Filesystem operations (File I/O).
  * Process spawning (shell commands).
  * System time (for time-dependent logic).

**Internal Logic (NEVER MOCK - The Rule of Consultation):** In-process logic within our codebase.

> **The Rule of Consultation:** Do not mock in-process logic without explicit consultation and confirmation with the user. The fundamental principle of Service-Mocked Testing is to exercise the full internal stack. Mocking internal components undermines this principle. Any deviation requires explicit approval.

**Strategy:** Use dependency injection to provide test doubles (e.g., passing a `MockModelClient` to the `ConversationManager`).

### 3.3. Tests Derive from Public Boundaries (The Scaffold)

Once the public boundary (the API definition) is established, the test cases are obvious. This provides a rigid **External Metacognitive Scaffold** for the execution agent, removing ambiguity about what to test.

**API Definition Example:**

```typescript
class ConversationManager {
  // Creates a new conversation. Throws ConfigurationError if invalid.
  createConversation(config: ConversationConfig): Promise<Conversation>
}
```

**Derived Test Cases (Mechanical Execution):**

1.  Happy Path: Can create a conversation with valid config.
2.  State Verification: Created conversation has a unique ID and is stored internally.
3.  Error Case: Invalid config throws `ConfigurationError`.

The agent does not need to interpret what to test. The API defines the surface; the agent tests the surface (happy paths, error cases, edge cases, and state verification).

### 3.4. The TDD Workflow: Boundary-First

We use a Test-Driven Development (TDD) workflow anchored to the public boundaries, providing a reliable, mechanical process for agents.

**Step 1: Define the Public Boundary** (Planning Phase)
Identify the API surface. Document signatures, behavior, and errors.

**Step 2: Write Service-Mocked Tests Against the Boundary** (Execution Phase - Coder)
Create tests at the boundary. Mock external dependencies. Write test cases derived from the API definition. *Tests should fail (Red).*

**Step 3: Implement to Green** (Execution Phase - Coder)
Write the minimal code required to pass the tests. The internal structure is flexible, exercising the full code flow. *Tests should pass (Green).*

**Step 4: Refactor** (Execution Phase - Coder/Reviewer)
Refactor the internal implementation for clarity and performance. Tests remain green, ensuring the public behavior is maintained.

-----

## 4\. Advanced Techniques

### 4.1. Handling Stateful Interactions and Behavioral Flows

Many systems involve stateful objects (like a `Conversation` object) where the sequence of operations matters. Service-Mocked tests must validate these sequences and the resulting behavioral flows. This aligns with the **Narrative Substrate**—testing the journey, not just the steps.

**Strategy:** Write multi-step tests that simulate a user flow.

```typescript
it('handles multi-turn conversation with tool execution flow', async () => {
  // Setup: Mocks configured to require a tool call
  const manager = new ConversationManager({client: mockClient});
  const conv = await manager.createConversation(config);

  // Turn 1: User message -> Model requests tool
  const response1 = await conv.sendMessage("Read the file.");
  expect(conv.state).toBe('AWAITING_TOOL'); // Verify state transition

  // Turn 2: Execute tool -> Model summarizes
  const response2 = await conv.executeTools();
  expect(conv.state).toBe('READY'); // Verify state transition

  // Verification: Ensure the full behavioral flow was orchestrated correctly
  expect(mockClient.sendMessage).toHaveBeenCalledTimes(2);
});
```

### 4.2. Mock Creation Patterns

Create reusable, configurable mock factories in a dedicated `tests/mocks/` directory to streamline test creation.

```typescript
// tests/mocks/model-client.ts
export function createMockClient(responses?: MockResponse[]) {
  const mock = { sendMessage: vi.fn() };
  // Configure mock to return the sequence of predefined responses.
  (responses || []).forEach(response => {
    mock.sendMessage.mockResolvedValueOnce(response);
  });
  return mock;
}
```

-----

## 5\. Practical Application in Planning

The responsibility for defining the testing strategy lies with the Planning Agent during the creation of the Phase README (10k ft **Altitude**).

**For each phase, the Planning Agent must document:**

**1. Public Boundaries Introduced:**

```
Phase 1: Basic Chat
New Boundaries: ConversationManager.createConversation(), Conversation.sendMessage()
```

**2. External Mocks Needed:**

```
External Mocks:
- ModelClient (Mock: Network access to LLM API)
- RolloutRecorder (Mock: Filesystem access for JSONL persistence)
```

**3. Test Scenarios (Derived from the Boundary Definition):**

```
Test Scenarios for createConversation():
- ✅ Creates with valid config (Behavioral check)
- ✅ Assigns unique conversation ID (State check)
- ❌ Throws on invalid config (Error check)
```

By providing this information in the planning documentation, the Coding Agent receives the complete scaffolding required to implement the Service-Mocked TDD workflow reliably.

-----

## 6\. Summary

The Service-Mocked Testing Methodology ensures alignment between functional requirements and technical implementation (**Weaving**). By focusing on behavior at public boundaries and mocking external services, it provides a robust **Scaffold** for agentic execution. This approach optimizes testing effort (**Bespoke Depth**) while providing the comprehensive coverage needed to ensure the resulting systems are reliable, verifiable, and maintainable.
