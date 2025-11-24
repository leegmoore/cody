# Guide to Iterative Agentic Coding - Prompting for Small Slices

**Version:** 1.0
**Purpose:** Methodology for interactive, iterative development with AI coding agents
**Context:** Post-planning phase work where you're tackling small features, bug fixes, and incremental improvements

---

## The Iterative Agentic Coding Mode

### **What It Is**

**Iterative agentic coding** is a development mode where:
- You review current state
- Identify the next 1-2 small work slices (features, bug fixes, refactors)
- Write a focused prompt for that specific work
- Agent executes
- You evaluate results
- You decide the next slice based on what you learned

**Contrast with assembly-line mode:**
- Assembly-line: Plan entire project upfront, create standardized prompts, execute phases sequentially
- Iterative: Discover requirements as you go, adapt based on findings, smaller feedback loops

**When to use each:**
- **Assembly-line:** Porting known systems, implementing spec'd features, predictable work
- **Iterative:** Exploration, bug fixing, integration work, learning as you go

---

### **The Value**

**Flexibility:**
- Adapt to discoveries (bugs, missing features, design flaws)
- Change direction based on results
- Don't commit to long plans that might be wrong

**Speed:**
- Smaller slices = faster feedback
- Failures caught early
- Less waste from wrong directions

**Learning:**
- Each iteration reveals unknowns
- Compound understanding
- Better decisions as you go

---

### **The Risk**

**Without discipline, iterative mode degrades:**

1. **Prompt drift** - Each prompt gets vaguer
2. **Context loss** - Agent doesn't understand cumulative progress
3. **Integration gaps** - Components built in isolation don't connect
4. **Testing decay** - "I'll test it later" → never tested
5. **Documentation rot** - No one documents small changes

**The challenge:** Maintain quality and coherence while moving fast and adapting.

---

## Core Principle: Distributional Convergence

**Foundation concept from Anthropic's research:**

> "During sampling, models predict tokens based on statistical patterns in training data. Safe design choices–those that work universally and offend no one–dominate training data. Without direction, models sample from this high-probability center."

### **What This Means for Code**

**Agents converge to:**
- Generic solutions (most common in training data)
- Minimal implementations (shortest code that works)
- Safe patterns (try/catch everything, mock everything, basic error messages)
- Copy-paste from similar code (highest probability match)

**Even when they know better approaches.**

**Why:** Training data is dominated by mediocre code. Excellent code is rare. Probability drives sampling.

---

### **Fighting Convergence in Iterative Mode**

**Every prompt must actively steer AWAY from defaults:**

**1. Explicit Avoidances**
```markdown
**DO NOT:**
- Mock Redis/Convex (convergent default: mock everything)
- Use generic variable names (convergent default: data, result, handler)
- Copy v1 code verbatim (convergent default: reuse existing)
```

**2. Concrete Alternatives**
```markdown
**DO:**
- Use real Redis connection (test integration, not units)
- Use domain names (threadId, runId, StreamEvent)
- Adapt v1 patterns to v2 architecture (port concepts, not code)
```

**3. Code Scaffolds**
Show the SPECIFIC pattern you want (makes it high-probability in this context):
```typescript
// Example: Tool integration in v2 adapter
const reqBody = {
  model: this.model,
  tools: formatToolSchemas(this.toolRegistry.getAll()), // ← This pattern
  tool_choice: "auto"
};
```

**Without these:** Agent converges to generic, minimal, safe solutions.

**With these:** Agent follows your specific, robust, integrated patterns.

---

## The TDD Integration Testing Foundation

**Non-negotiable in iterative mode:**

### **Test-Driven Development (TDD)**

**The workflow:**
```
1. Write test (fails - red)
2. Implement minimal code (passes - green)
3. Refactor (stays green)
4. Repeat
```

**Why critical in iterative mode:**
- Small slices = easy to test
- Tests document intent
- Tests prevent regression as you iterate
- Tests catch integration issues immediately

**Without TDD:** Each iteration might break previous work. You don't discover until much later.

---

### **Integration Over Isolation**

**The principle:**
> "Test at boundaries, not in isolation. Exercise full in-process code flows, mock only external dependencies."

**What this means:**
- ✅ Test the full pipeline (API → Redis → Worker → Convex)
- ✅ Mock only LLM responses and external APIs
- ❌ Don't mock internal components (Redis, workers, reducers)

**Why critical:**

**Unit tests** (mocking everything):
```typescript
test('reducer applies event', () => {
  const mockRedis = {publish: jest.fn()};
  const reducer = new Reducer(mockRedis);
  reducer.apply(mockEvent);
  expect(mockRedis.publish).toHaveBeenCalled(); // ✅ Passes
});
```

**Problem:** This test passes even if:
- Redis serialization is broken
- Event schema is wrong
- Actual Redis doesn't work

**Integration tests** (real infrastructure):
```typescript
test('full pipeline', async () => {
  const realRedis = await connectRedis('localhost:6379');
  const {runId} = await harness.submit({prompt: 'test'});
  const events = await consumeFromRedis(runId);
  const response = await queryConvex(runId);

  expect(response.status).toBe('completed'); // ✅ Passes ONLY if everything works
});
```

**This catches:**
- Serialization bugs
- Schema mismatches
- Timing issues
- Worker integration problems

**In iterative mode:** You're constantly changing things. Integration tests catch breaks immediately. Unit tests give false confidence.

---

### **Continuous Integration Discipline**

**After EVERY iteration:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```

**All must pass before moving to next slice.**

**Why critical:**
- Iterative mode = rapid changes
- Easy to break things
- Verification gate prevents compounding errors

**Without this:** By iteration 10, you have 8 subtle breaks you don't know about.

---

## Documentation in Iterative Mode

### **The Challenge**

**Assembly-line mode:** Documentation planned upfront (PRD, tech approach, phase READMEs)

**Iterative mode:** You're discovering as you go. How do you document?

---

### **The Practice: Just-In-Time Documentation**

**Before each slice, create:**

**1. Tech Design Doc (if architecture is complex)**
```markdown
# [Feature Name] - Technical Design

## Problem
[What are we solving]

## Approach
[How we'll solve it - mid-altitude]

## Integration Points
[Where this connects to existing code]

## Known Issues
[Bugs this addresses OR expected challenges]
```

**Keep it SHORT (1-2 pages max).** This isn't a PhD thesis. It's a decision record.

---

**2. Test Plan (always)**
```markdown
# [Feature Name] - Test Conditions

## Test Scenarios (Functional)

**TC-1: [Scenario name]**
- Given: [Setup]
- Expected: [Outcome]
- Verifies: [What this proves]

**TC-2: [Scenario]**
...
```

**Functional descriptions, not implementation.**

**Why:** This becomes your specification. Tests derive from this.

---

**3. Combined Design + Test Doc (recommended for small slices)**
```markdown
# [Feature] - Design & Test Plan

## Design
[Approach - 1 page]

## Test Conditions
[5-10 scenarios]

## Implementation Notes
[Tricky parts, integration points]
```

**Single doc, faster to write, easier for agent to consume.**

---

### **After Each Slice, Update:**

**TEST_RESULTS.md:**
```markdown
## [Date] - [Feature Name]

**Tests:** X/Y passing
**Bugs Found:** [List]
**Changes:** [Files modified]
**Next:** [What's still needed]
```

**Running log of iterations.**

**Why:** Captures discoveries, tracks progress, prevents forgetting.

---

## Prompting for Iterative Slices

### **Standard Prompt Structure (Streamlined)**

**Use these sections (8-10 core + 2-4 optional):**

**CORE (Always):**
1. Header (generated date, workspace, target model)
2. ROLE (1-2 sentences, specific responsibility)
3. PROJECT CONTEXT (current state ✅/❌)
4. CURRENT TASK (objective + functional outcome)
5. PREREQUISITES (what exists, with paths)
6. STATE LOADING (FIRST docs, THEN code - numbered)
7. TASK SPECIFICATION (deliverables with line estimates)
8. WORKFLOW STEPS (6-10 numbered steps)
9. WORKFLOW RULES (3-5 mandatory, interrupt protocol)
10. CODE QUALITY STANDARDS (verification command)
11. SESSION COMPLETION (verify, document, commit, report)
12. EXPECTED OUTCOME (deliverables + reality check)

**OPTIONAL (Include when relevant):**
- KNOWN ISSUES (when debugging)
- IMPLEMENTATION GUIDANCE (when pattern is complex)
- DEBUGGING GUIDANCE (when investigative work)
- CRITICAL CONSTRAINTS (when violations are costly)

**Total length:** 400-800 lines for small slice, 800-1200 for complex slice

---

### **Key Differences from Assembly-Line Prompts**

**Assembly-line (large phases):**
- Break into 3 sub-phases
- Extensive implementation guidance
- Detailed code examples for every component
- 1000-1500 lines

**Iterative (small slices):**
- Single focused task
- Implementation guidance for TRICKY parts only
- Code examples where pattern is non-obvious
- 400-800 lines

**Same structure, adjusted depth.**

---

## Finding the Right Altitude

**From the article:**
> "avoiding the two extremes of low-altitude hardcoded logic like specifying exact hex codes and vague high-altitude guidance that assumes shared context"

### **The Altitude Framework**

**Too High (Vague):**
```markdown
❌ "Implement tool support"
❌ "Fix the bugs"
❌ "Make it work like v1"
```

**Agent fills gaps with convergent defaults.**

**Too Low (Micromanagement):**
```markdown
❌ "Line 47: add const toolSchemas = []"
❌ "Use exactly #7C3AED for primary color"
❌ "Create variable named exactlyThis"
```

**Agent can't adapt, becomes brittle.**

**Right Altitude (Implementable Principles):**
```markdown
✅ "Port createToolsJsonForResponsesApi() from v1 (codex-ts/src/core/client/responses/client.ts line 234). Integrate into v2 OpenAIStreamAdapter request body (line 92). Tools array must match OpenAI Responses API schema."

✅ "Add ToolWorker timeout enforcement. Use Promise.race pattern with configurable timeoutMs (default 30s). Throw clear error message on timeout. See v1 implementation in codex-ts/src/tools/executor.ts for reference."
```

**This provides:**
- WHAT to do (port function)
- WHERE it comes from (file + line)
- WHERE it goes (integration point)
- HOW to do it (pattern to use)
- WHAT to reference (existing implementation)

**But leaves:**
- Implementation details (agent decides)
- Exact code structure (agent adapts)
- Variable names (agent chooses)

---

### **Altitude Decision Matrix**

| Context | Right Altitude | Example |
|---------|----------------|---------|
| **New Pattern** | Mid-high (show structure, not details) | "Implement factory pattern. Factory interface, DefaultFactory (prod), MockFactory (test). Returns StreamAdapter." |
| **Porting Logic** | Mid (specify source, destination, adaptation needed) | "Port tool schemas from v1. Extract createToolsJson() (line 234), integrate at v2 reqBody (line 92), adapt for streaming." |
| **Bug Fix** | Mid-low (specific error, specific fix location) | "Fix UUID validation. Change item_id from z.string().uuid() to z.string() in schema.ts line 23." |
| **Integration Point** | Mid (show connection, not implementation) | "Wire ToolWorker to harness. Start in setup(), stop in cleanup(). Configure with fast polling for tests." |
| **Complex Algorithm** | Mid with scaffold (show pattern, agent fills) | "Implement timeout with Promise.race. [code scaffold showing structure]" |

**Rule of thumb:** If you're specifying exact lines of code, too low. If agent has to guess major design decisions, too high.

---

## Essential Prompt Components

### **1. Known Issues / Current Failures**

**When debugging or fixing:**

```markdown
## KNOWN ISSUES

Based on [test run / smoke tests / previous work]:

**Issue 1: [Specific error]**
- Error: "[Exact error message]"
- Root cause: [What's broken]
- Location: [File:line]
- Fix: [What to do - mid-altitude]

**Issue 2: [Specific error]**
- Error: "[Message]"
- Root cause: [Diagnosis]
- Fix: [Approach]
```

**Why essential:**
- Blocks convergent debugging (random guessing)
- Provides specific targets
- Shows diagnosis, not just symptoms

**In iterative mode:** Each slice often fixes bugs from previous slice. This section is critical.

---

### **2. Integration Points (Explicit)**

**For every component:**

```markdown
**Deliverables:**

1. **Tool Schema Formatter** (`src/core/tools/schema-formatter.ts`) - ~100 lines
   - `formatToolSchemas(tools: Tool[])` - Main export
   - Returns OpenAI-compatible tool definitions
   - **Integration:** Called by OpenAIStreamAdapter at request construction
   - **Used by:** openai-adapter.ts (line 92), anthropic-adapter.ts (line 78)
```

**Specify:**
- What calls it
- Where it's called from
- What it returns

**Why:** Prevents building isolated components. Agent knows how piece fits.

---

### **3. Code Scaffolds for Non-Obvious Patterns**

**When pattern is unusual or specific to your architecture:**

```markdown
## IMPLEMENTATION GUIDANCE

### Tool Request Integration

```typescript
// src/core/adapters/openai-adapter.ts (line 92)

const reqBody = {
  model: this.model,
  input: [...],
  tools: this.formatTools(params.availableTools), // ← Add this
  tool_choice: "auto"                              // ← And this
};
```

**Then implement formatTools():**
```typescript
private formatTools(tools: Tool[]) {
  return tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}
```
```

**Show exact integration point + pattern to implement.**

**Why:** Prevents agent from inventing structure. Shows where and how.

---

### **4. Explicit Avoidances (Fight Convergence)**

**Every prompt needs:**

```markdown
**DO NOT:**
- Mock Redis or Convex (convergent default: mock everything)
- Copy v1 code verbatim (convergent default: reuse what exists)
- Build tool schemas from scratch (convergent default: minimal working version)
- Skip tests (convergent default: "I'll test later")
```

**Why each matters:**
- Mocking: Most training data mocks everything
- Copy-paste: Highest probability is literal copy
- From scratch: Easier than understanding existing
- Skip tests: TDD is minority pattern in training data

**Without explicit avoidances:** Agent takes easiest path (convergent default).

---

### **5. State Loading (FIRST/THEN)**

**Force sequential context loading:**

```markdown
## STATE LOADING (READ THESE FIRST)

### FIRST: Understand the Problem
1. **Test Results:** `TEST_RESULTS.md`
   - Read latest smoke test failures
   - Note specific error messages
   - Understand what's broken

2. **Tech Design:** `docs/cc/tool-support-design.md`
   - Review tool integration approach
   - Note v1 vs v2 differences

### THEN: Review Implementation
3. **v1 Tool Support:** `codex-ts/src/core/client/responses/client.ts`
   - Line 234: createToolsJsonForResponsesApi()
   - Understand schema format

4. **v2 Adapter:** `src/core/adapters/openai-adapter.ts`
   - Line 92: Request body construction
   - Note where tools should integrate
```

**Pattern:**
- FIRST: Requirements, problems, design (why)
- THEN: Existing code, implementation (how)

**Why:** Agent understands intent before coding. Prevents implementing wrong solution correctly.

---

## Documentation Requirements

### **Before Each Slice**

**Minimum:** Test conditions document

```markdown
# [Feature] - Test Plan

## Scenarios

**TC-1: [Name]**
- Given: [Setup]
- Expected: [Outcome]
- Verifies: [What this proves]
```

**For complex slices:** Add tech design (1-2 pages)

**For simple slices:** Test plan is enough

---

### **Test-First Approach**

**Critical pattern:**

1. **Write functional test conditions** (what behavior, not how implemented)
2. **Give to coding agent** (implement tests first)
3. **Tests fail** (red)
4. **Agent implements feature** (to make tests pass)
5. **Tests pass** (green)
6. **Refactor if needed** (tests stay green)

**Why this matters in iterative mode:**

Each slice changes the system. Without tests:
- You don't know if slice worked
- You don't know if slice broke other things
- You can't refactor safely
- Integration gaps invisible until much later

**With tests:**
- Immediate feedback (works or doesn't)
- Regression safety (old tests catch new breaks)
- Refactor confidence (tests stay green)
- Integration validated (because tests exercise full pipeline)

---

### **Integration Tests > Unit Tests**

**Test at API boundaries, not class methods:**

```typescript
// ❌ Unit test (isolated)
test('formatTools converts Tool[] to schema', () => {
  const result = formatTools(mockTools);
  expect(result[0].function.name).toBe('readFile');
});
```

**Problem:** Tests the function, not the integration.

```typescript
// ✅ Integration test (full pipeline)
test('tool call end-to-end', async () => {
  const {runId} = await harness.submit({
    prompt: 'Read README.md',
    model: 'gpt-5-mini'
  });

  const response = await harness.hydrate(events);

  expect(response.output_items).toContainEqual(
    expect.objectContaining({
      type: 'function_call',
      name: 'readFile'
    })
  );
});
```

**This validates:**
- Tool schemas passed to API
- LLM returned function_call
- Adapter normalized correctly
- Events flowed through Redis
- Worker processed
- Full pipeline works

**In iterative mode:** You're changing multiple components per slice. Integration tests catch breaks anywhere in the chain.

---

## Prompt Template for Iterative Slices

### **Minimal Viable Prompt (400-600 lines)**

```markdown
# CODER PROMPT: [Feature/Fix Name]

**Generated:** [Date]
**Workspace:** [Path]

---

## ROLE
[1 sentence: fixing X, implementing Y]

---

## PROJECT CONTEXT
**Current State:**
- ✅ [What works]
- ❌ [What's broken/missing]

---

## CURRENT TASK
**Objective:** [1 sentence deliverable]
**Functional Outcome:** [User capability]

---

## PREREQUISITES
✅ [Relevant existing code with paths]
✅ [Tests/docs that exist]

---

## STATE LOADING (READ THESE FIRST)

### FIRST: [Requirements/Problems]
1. **[Doc]:** - [Extract what]

### THEN: [Implementation]
2. **[File]:** - [Understand what]

---

## KNOWN ISSUES (if debugging)
**Issue 1:** [Error + fix]

---

## TASK SPECIFICATION
**Deliverables:**
1. **[Component]** (`path`) - ~N lines
   - [Responsibilities]
   - **Integration:** [What calls it]

---

## WORKFLOW STEPS
1. [Action]
2. [Implement]
3. [Verify]
4-6. [Continue]

---

## WORKFLOW RULES

**DO NOT:**
- [Convergent default to avoid]

**DO:**
- [Specific alternative]

**STOP if:**
- [Ambiguity]

---

## [OPTIONAL: IMPLEMENTATION GUIDANCE - if complex]
[Code scaffolds for tricky parts]

---

## CODE QUALITY
```bash
[verification command]
```

---

## SESSION COMPLETION
1. ✅ Verify
2. ✅ Document
3. ✅ Commit
4. ✅ Report

---

## EXPECTED OUTCOME
- ✅ [Deliverable]
- ✅ [Tests passing]

[Reality check about failures]
```

---

### **Enhanced Prompt for Complex Slices (800-1200 lines)**

**Add these sections:**

- **KNOWN ISSUES** (detailed bugs with error messages)
- **IMPLEMENTATION GUIDANCE** (code scaffolds for 2-3 tricky parts)
- **DEBUGGING GUIDANCE** (if investigative)
- **CRITICAL CONSTRAINTS** (if violations costly)

**Same structure, more depth where needed.**

---

## Maintaining Quality Through Iterations

### **The Degradation Pattern**

**What happens without discipline:**

**Iteration 1:** Detailed prompt, tests first, all green
**Iteration 2:** Good prompt, tests included, mostly working
**Iteration 3:** Thinner prompt, tests mentioned, some breaks
**Iteration 4:** Vague prompt, "test it", multiple breaks
**Iteration 5:** "Just fix X", no tests, compounding issues

**Why:** Fatigue, urgency, false confidence ("last one worked, this is simple")

---

### **The Anti-Degradation Checklist**

**Before writing EVERY prompt (even iteration 20):**

1. ✅ **Do I have test conditions?** (functional spec)
2. ✅ **Do I know the integration points?** (where this connects)
3. ✅ **Have I identified convergent defaults to block?** (what NOT to do)
4. ✅ **Do I have code scaffolds for tricky parts?** (if needed)
5. ✅ **Is there a single verification command?** (quality gate)
6. ✅ **Have I set realistic expectations?** (may fail, that's OK)

**If ANY answer is no:** Prompt is underspecified. Add missing section.

---

### **The Test-First Discipline**

**Enforce this sequence:**

```
Iteration N:
1. Write test conditions (functional) ← 30 min
2. Agent implements tests (fail - red) ← 30 min
3. Agent implements feature (pass - green) ← 1-2 hours
4. Verify all tests pass ← 5 min
5. Document results ← 10 min
6. Commit ← 5 min

Total: 2-3 hours per iteration
```

**Never skip step 1** (test conditions). This is the spec.

**Never skip step 4** (verification). This catches regression.

---

## Iteration Cycle Best Practices

### **1. Keep Slices Small**

**Good slice size:** 1-3 hours of agent work
- Single feature or bug fix
- 2-5 test cases
- 100-500 lines of code

**Why:** Faster feedback, less to debug, easier to verify.

---

### **2. One Slice at a Time**

**Don't:** "Fix tools, add OpenRouter, update UI"
**Do:** "Fix tools in OpenAI adapter. [Stop] Then: Add tools to Anthropic. [Stop] Then: Add OpenRouter."

**Why:** Multiple changes = hard to diagnose failures. Serial slices = clear cause/effect.

---

### **3. Verify Before Next**

**After every slice:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```

**ALL must pass.**

**If fails:** Fix before next slice.

**Why:** Don't compound breaks. Each slice starts from green.

---

### **4. Document Discoveries**

**After every slice:**
- Update TEST_RESULTS.md
- Note bugs found
- Note what works
- Note what's next

**Why:** Context for next slice. You'll forget details.

---

### **5. Reassess Direction**

**After every 3-5 slices:**
- Review progress
- Check if direction still makes sense
- Adjust plan based on learnings

**Why:** Iterative mode is exploratory. Don't blindly execute a plan that's wrong.

---

### **6. Adaptive Scope (Critical Pattern)**

**Define minimum scope explicitly:**

```markdown
**Minimum for phase complete (ALL must pass):**
- ✅ Format, Lint, TypeScript (zero errors)
- ✅ **These specific tests passing:**
  - TC-01: [Specific test]
  - TC-02: [Specific test]
  - TC-03: [Specific test]

**Complete this scope and report back for next steps.**

Remaining tests ([list]) will be addressed based on these results.
```

**Then adapt based on results:**

**If agent completes minimum quickly and cleanly:**
→ "Good work. Now add TC-04 and TC-05 to this session."

**If agent struggles with minimum:**
→ "Stop here. Let's reassess approach before continuing."

**Why this works:**
- ✅ Clear minimum (agent knows what success is)
- ✅ No ambiguity (exactly which tests, not "any 3")
- ✅ Checkpoint for evaluation (report back)
- ✅ Flexibility to extend or stop (you decide)

**Why "do any 5 of 6" fails:**
- ❌ Agent picks easiest 5, avoids hard one
- ❌ No forcing function to tackle critical tests
- ❌ No checkpoint to assess approach

**Pattern:**
1. Define minimum scope (3-5 specific tests)
2. Agent completes and reports
3. You evaluate quality and context coherence
4. You decide: extend scope OR new session OR reassess

**Iterative mode with clear checkpoints.**

---

## Model-Specific Considerations

### **Appendix A: GPT-5 Class Models**

**Models:** gpt-5, gpt-5-mini, gpt-5-pro, gpt-5-codex, gpt-5.1 series

**Strengths:**
- Excellent at following structure
- Strong code generation
- Good at pattern matching

**Weaknesses:**
- High convergence to generic patterns
- Needs strong explicit avoidances
- Can hallucinate model names from training data

**Prompting adjustments:**
- ✅ Include more explicit avoidances
- ✅ Provide more code scaffolds
- ✅ Reinforce constraints multiple times
- ✅ Reference MODELS.md frequently

**Prompt length:** 800-1200 lines (needs more scaffolding)

---

### **Appendix B: Gemini 3 Class Models**

**Models:** google/gemini-3-pro-preview, google/gemini-2.5-pro, google/gemini-2.5-flash

**Strengths:**
- Excellent at reasoning about architecture
- Good at adapting patterns
- Strong at integration thinking

**Weaknesses:**
- Can over-engineer
- Sometimes verbose implementations
- May add unnecessary abstractions

**Prompting adjustments:**
- ✅ Emphasize "minimal implementation"
- ✅ Specify line count estimates (prevents bloat)
- ✅ Show simple patterns (prevent over-abstraction)
- ✅ "Keep it simple" reminders

**Prompt length:** 600-800 lines (needs less scaffolding, more constraints on simplicity)

---

### **Appendix C: Claude Sonnet 4.5 / Opus 4.1**

**Models:** claude-sonnet-4.5, claude-opus-4.1, claude-haiku-4.5

**Strengths:**
- Excellent at understanding context
- Strong at following nuanced instructions
- Good at multi-step reasoning
- Self-corrects when given feedback

**Weaknesses:**
- Can be overly cautious (asks too many questions)
- May not fully internalize docs on first read
- Convergence to "safe" patterns when uncertain

**Prompting adjustments:**
- ✅ Provide clear decision authority ("You decide X, Y is specified")
- ✅ Excerpts from docs (don't just point, include key parts)
- ✅ Explicit "no need to ask" for covered topics
- ✅ Code examples for non-standard patterns

**Prompt length:** 600-1000 lines (balanced - needs context but adapts well)

---

## Common Failure Modes & Fixes

### **Failure: Agent Mocks Infrastructure**

**Symptom:** Tests pass but nothing integrated

**Root cause:** Convergent default (most tests mock everything)

**Fix:**
```markdown
## CRITICAL CONSTRAINTS

**Infrastructure is REAL:**
- ❌ NO mocking Redis
- ❌ NO mocking Convex
- ❌ NO mocking workers

**Only mock:**
- ✅ LLM API responses
- ✅ Tool implementations (for safety)

Tests MUST exercise real infrastructure to validate integration.
```

---

### **Failure: Agent Skips Tests**

**Symptom:** Feature implemented, no tests

**Root cause:** TDD is minority pattern, agent defaults to "implement then maybe test"

**Fix:**
```markdown
## WORKFLOW STEPS

1. **Write tests FIRST** (based on test-conditions.md)
2. Run tests (expect failures - red)
3. Implement feature
4. Run tests (expect success - green)
5. Verify full suite passes

**Tests are written BEFORE implementation, not after.**
```

Make it step 1, not step 5.

---

### **Failure: Vague Deliverables**

**Symptom:** Agent asks clarifying questions or builds wrong thing

**Root cause:** Prompt too high-altitude

**Fix:** Add line counts, file paths, integration points, method names

**Before:**
```markdown
Implement tool support
```

**After:**
```markdown
1. **Tool Schema Formatter** (`src/core/tools/formatter.ts`) - ~100 lines
   - formatToolSchemas(tools) → OpenAI schema format
   - Called by OpenAIStreamAdapter (line 92)
   - Returns: {type: "function", function: {...}}[]
```

---

### **Failure: Integration Gaps**

**Symptom:** Components work in isolation, fail when connected

**Root cause:** Tests don't exercise integration

**Fix:** Specify integration tests, not unit tests

```markdown
## TASK SPECIFICATION

**Test Suite** (`tests/e2e/tool-support.spec.ts`)
- TC-1: Full tool call flow (prompt → function_call → execution → output → message)
- Uses REAL ToolWorker, REAL Redis, REAL adapter
- Validates end-to-end integration
```

Not: "Test formatTools() function in isolation"

---

### **Failure: No Reality Check**

**Symptom:** Agent struggles, gets stuck, doesn't ask for help

**Root cause:** Prompt implies everything is clear and should work

**Fix:** Set realistic expectations

```markdown
## EXPECTED OUTCOME

After this session:
- ✅ Tool schemas integrated in adapters
- ✅ At least 1-2 smoke tests passing (may still have issues)
- ✅ Clear documentation of remaining bugs

**TC-SMOKE-05 may still fail** if tool definitions need refinement.
That's OK - document what's needed and we'll iterate.
```

Agent knows failure is acceptable, focuses on progress not perfection.

---

## Summary: Iterative Mode Success Pattern

**1. Small slices** (1-3 hours each)

**2. Test conditions first** (always)

**3. Integration tests** (not unit tests)

**4. Right altitude prompts** (implementable principles, not hardcoded or vague)

**5. Fight convergence** (explicit avoidances, concrete alternatives, code scaffolds)

**6. Sequential state loading** (FIRST why, THEN how)

**7. Verify every iteration** (all tests pass before next slice)

**8. Document discoveries** (TEST_RESULTS.md after each)

**9. Reassess every 3-5 slices** (direction still right?)

**10. Use model strengths** (adjust prompt length and style per model)

---

## The Meta-Pattern

**Iterative agentic coding is a balancing act:**

**Too rigid** (assembly-line):
- Can't adapt to discoveries
- Waste when plan is wrong
- Slow to respond to bugs

**Too loose** (ad-hoc):
- Prompt quality degrades
- Testing skipped
- Integration gaps
- Context loss

**The sweet spot:**
- Structured prompts (fight convergence)
- Small slices (fast feedback)
- Always TDD (integration validation)
- Document as you go (maintain context)
- Reassess frequently (adapt to reality)

**This guide provides the structure to stay in the sweet spot.**

---

## Technical Notes

### **Current Development Setup**

**Primary coding agent:** gpt-5-codex

**Invocation command:**
```bash
codex -m gpt-5-codex \
  -c model_reasoning_effort="high" \
  --dangerously-bypass-approvals-and-sandbox
```

**Configuration:**
- Model: gpt-5-codex (OpenAI)
- Reasoning effort: high (enables extended thinking)
- Sandbox: bypassed for rapid iteration (use with caution)
- Approvals: bypassed (auto-approve tool execution)

**Why this configuration:**
- gpt-5-codex: Strong at code generation and refactoring
- High reasoning: Better architectural decisions
- Bypassed safety: Faster iteration in controlled environment

**Safety note:** Only use `--dangerously-bypass-approvals-and-sandbox` in isolated development environment with version control. Never in production or with untrusted code.

**Alternative configurations for different work:**
- **Debugging:** Use claude-sonnet-4.5 (better at analysis)
- **Simple fixes:** Use gpt-5-mini (faster, cheaper)
- **Architecture:** Use claude-opus-4.1 (best at system design)

**Session management:**
- Run in separate terminal sessions for parallel work
- Each session maintains independent context
- Can run UI work and backend work simultaneously
