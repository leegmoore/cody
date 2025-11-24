# Coder Prompt Structure - Core Principles

**Extracted from:** Core 2.0 implementation phases (successful prompts)
**Purpose:** Standard structure for all future coder prompts

---

## Core Structure (12-14 Sections)

Every coder prompt follows this mandatory structure:

### **1. Header Block**
```markdown
# CODER PROMPT: [Phase Name - Specific Task]

**Generated:** [Date]
**Target Model:** gpt-5.1-codex-max
**Workspace:** [Absolute path]
```

**Purpose:** Metadata for context and reproducibility

---

### **2. ROLE**
```markdown
## ROLE

You are a senior TypeScript/Node.js developer [specific responsibility].
```

**Purpose:** Set agent identity, expertise level, and perspective
**Length:** 1-2 sentences
**Key:** Be specific about what they're doing (implementing, fixing, testing)

**Good examples:**
- "implementing **custom integration test harness**"
- "fixing **integration bugs**"
- "implementing **error handling tests**"

**Bad examples:**
- "working on the project"
- "helping with testing"

---

### **3. PROJECT CONTEXT**
```markdown
## PROJECT CONTEXT

**Cody Core 2.0** is [brief description].

**Current State:**
- ✅ [What works]
- ❌ [What's broken/missing]
```

**Purpose:** High-level orientation (25k ft)
**Length:** 3-5 bullet points
**Key:** Clear what/why context, current reality check

**Always include:**
- What the system is
- What's already done (prevents rework)
- What's broken (sets expectations)

---

### **4. CURRENT PHASE**
```markdown
## CURRENT PHASE

**Phase:** [Phase Name]
**Objective:** [Concrete deliverable in 1 sentence]

**FUNCTIONAL OUTCOME:**
After this phase, [describe end-user capability enabled].
```

**Purpose:** Define scope and success
**Length:** 3-4 lines
**Key:** Functional outcome (what capability, not how implemented)

**Good functional outcomes:**
- "we can submit prompts via API and verify events flow through Redis"
- "system handles errors gracefully with clear error messages"

**Bad functional outcomes:**
- "code is written"
- "tests exist"

---

### **5. PREREQUISITES**
```markdown
## PREREQUISITES

✅ **[Category]:**
- [Specific item with file path]
- [Specific item with status]

✅ **[Category]:**
- [Items...]
```

**Purpose:** Define foundation, reduce uncertainty
**Length:** 3-6 bullet groups
**Key:** Checkmarks (✅) show what's DONE, explicit paths

**Categories:**
- Code that exists
- Design docs complete
- Local environment requirements

---

### **6. STATE LOADING (READ THESE FIRST)**
```markdown
## STATE LOADING (READ THESE FIRST)

### FIRST: Load [Planning Docs]

1. **[Doc Name]:** `path/to/doc.md`
   - [What to extract from it]
   - [Specific sections to read]

2. **[Doc Name]:** `path/to/doc.md`
   - [What to extract]

### THEN: Review [Implementation]

3. **[File]:** `path/to/file.ts`
   - [What to understand]

4. **[File]:** `path/to/file.ts`
   - [What to look for]
```

**Purpose:** Force agent to load context in correct order
**Length:** 4-6 documents, numbered
**Key:** FIRST/THEN structure (planning before implementation)

**Critical pattern:**
- FIRST: Requirements, test conditions, architecture (the "why")
- THEN: Existing code, schemas, implementation (the "how")

**This implements "smooth descent" - understand intent before diving into code**

---

### **7. TASK SPECIFICATION**
```markdown
## TASK SPECIFICATION

Implement [overall goal] in **N phases**:

### **Phase N: [Name] ([Difficulty] - [Time])**

[Brief description]

**Deliverables:**

1. **[Component]** (`path/to/file`) - ~N lines
   - [Specific responsibility]
   - [Key methods/features]
   - [Integration points]

2. **[Component]** - ~N lines
   - [Details]

**Effort Estimate:** ~N lines total
```

**Purpose:** Break work into concrete deliverables
**Length:** 1-3 subphases with estimates
**Key:** Line estimates, file paths, clear boundaries

**Pattern observed:**
- Phase 1: Infrastructure/scaffold
- Phase 2: Core logic
- Phase 3: Tests/integration

---

### **8. WORKFLOW STEPS**
```markdown
## WORKFLOW STEPS

### **Step-by-Step Process:**

1. **[Action]**
   ```bash
   command to run
   ```

2. **[Action]**
   - [Sub-step]
   - [Sub-step]

3. **Verify [Thing]**
   ```bash
   verification command
   ```
```

**Purpose:** Explicit process, removes ambiguity
**Length:** 6-10 numbered steps
**Key:** Concrete commands, verification after each major step

**Include:**
- Directory creation
- Implementation order
- Verification commands
- Documentation updates

---

### **9. WORKFLOW RULES**
```markdown
## WORKFLOW RULES

### **Mandatory Rules:**

1. **[Constraint]**
   - [Specific requirement]
   - [What to avoid]

2. **[Constraint]**

### **INTERRUPT PROTOCOL**

**STOP and ask if:**
- [Ambiguous situation]
- [Missing information]
- [Unclear requirement]

**DO NOT:**
- [Anti-pattern]
- [Common mistake]
- [Violation]
```

**Purpose:** Define boundaries and safety
**Length:** 3-5 rules, 3-4 interrupt conditions
**Key:** What NOT to do is as important as what to do

**Critical pattern:**
- Rules are absolute ("MUST", "NEVER")
- Interrupt protocol prevents hallucination
- DO NOT list catches common failures

---

### **10. CODE QUALITY STANDARDS**
```markdown
## CODE QUALITY STANDARDS

### **Mandatory Quality Gates:**

- ✅ TypeScript: Zero errors (`npx tsc --noEmit`)
- ✅ ESLint: Zero errors (`npm run lint`)
- ✅ [Specific requirement]

### **Verification Command:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```
```

**Purpose:** Objective quality bar
**Length:** 4-5 gates + single command
**Key:** Zero-tolerance (0 errors), single verification command

**Always include:**
- Format (Prettier)
- Lint (ESLint)
- Type check (tsc --noEmit)
- Tests (appropriate command)

---

### **11. SESSION COMPLETION CHECKLIST**
```markdown
## SESSION COMPLETION CHECKLIST

### **Before ending session:**

1. ✅ **[Action]**
   ```bash
   command
   ```

2. ✅ **Document [results]:**
   - [What to document]
   - [Where to document it]

3. ✅ **Commit work:**
   ```bash
   git add -A
   git commit -m "[template message]"
   ```

4. ✅ **Report summary:**
   - [Metrics to report]
   - [Status to convey]

5. ✅ **Document Recommended Improvements:**

   Provide a detailed analysis of recommended improvements, ordered by importance:

   ```markdown
   ## Recommended Improvements - [System/Feature Name]

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
      - Current limitation:
      - Recommended fix:
      - Effort:
      - Rationale:
   ```

   Focus on:
   - Architectural improvements
   - Missing features
   - Error handling gaps
   - Performance optimizations
   - Testing gaps
   - Integration friction points

   **Base recommendations on:**
   - What you learned during implementation
   - Differences from reference implementations
   - Test results and failures
   - Real behavior observed
   - Integration challenges encountered
```

**Purpose:** Capture insights while fresh, guide future work
**Length:** 5-10 prioritized recommendations
**Key:** Based on experience from THIS implementation, not generic advice

**Critical pattern:**
- Prioritized by impact (not random order)
- Includes effort estimates (helps planning)
- Rationale explains why (not just what)
- Grounded in actual work done (not speculation)

**Why this matters:**
- Agent has unique perspective after implementation
- Observations are fresh and specific
- Identifies real friction points (not theoretical)
- Provides roadmap for next iterations

---

### **12. STARTING POINT**
```markdown
## STARTING POINT

**BEGIN by:**

1. [First specific action]
2. [Second specific action]
3. [Third specific action - usually "implement simplest test first"]

**Focus on [priority].**
```

**Purpose:** Eliminate paralysis, define entry point
**Length:** 3-5 ordered actions
**Key:** Start with simplest/easiest, build confidence

**Pattern:**
- Read docs first
- Create structure
- Implement easiest thing first
- Build momentum

---

### **13. EXPECTED OUTCOME**
```markdown
## EXPECTED OUTCOME

After this session:
- ✅ [Deliverable]
- ✅ [Deliverable]
- ✅ [Status expectation]

**[Realistic expectation about failures/issues]**
```

**Purpose:** Set realistic expectations
**Length:** 4-5 checkboxes + reality check
**Key:** What "done" means, acknowledge expected failures

**Critical pattern:**
- "Tests may fail" (if bug-finding phase)
- "At least X/Y passing" (realistic targets)
- "Foundation for [next phase]" (continuity)

---

### **14. OPTIONAL SECTIONS**

**When to include:**

**KNOWN ISSUES** - When debugging existing failures
- List specific bugs from test output
- Include error messages
- Provide fix guidance

**DEBUGGING GUIDANCE** - When work is investigative
- Commands to diagnose issues
- Where to add logging
- What to check

**IMPLEMENTATION GUIDANCE** - When patterns are complex
- Code examples for tricky parts
- Anti-patterns to avoid
- Library usage examples

**CRITICAL CONSTRAINTS** - When violations would be costly
- Model allowlist enforcement
- No mocking rules
- Security requirements

**CRITICAL IMPLEMENTATION NOTES** - When specific scenarios need detail
- Per-test-case guidance
- Special fixture requirements
- Edge case handling

---

## Key Principles Extracted

### **Principle 1: Structured Context Loading**

**Always use FIRST/THEN pattern:**
```
FIRST: Load planning docs (requirements, test conditions, architecture)
THEN: Review implementation (existing code, schemas)
```

**Why:** Agent understands INTENT before diving into code.

---

### **Principle 2: Explicit Prerequisites**

**Use checkmarks for what's DONE:**
```
✅ Test harness complete
✅ 10 tests passing
❌ 0 real API tests
```

**Why:** Agent knows what exists, doesn't rebuild what's there.

---

### **Principle 3: Concrete Deliverables**

**Always include:**
- File paths
- Line count estimates
- Specific methods/classes
- Integration points

**Why:** Agent knows exactly what to build, how big it should be.

---

### **Principle 4: Verification at Every Step**

**Pattern:**
```
1. Implement X
2. Run verification command
3. Capture output
4. Fix issues
5. Re-verify
```

**Why:** Catches bugs early, prevents building on broken foundation.

---

### **Principle 5: Realistic Expectations**

**Always acknowledge:**
- "Tests may fail" (if finding bugs)
- "Some scenarios may need deferral" (if complex)
- "At least X/Y passing" (not "all must pass")

**Why:** Prevents agent from hacking tests to pass, focuses on real work.

---

### **Principle 6: Interrupt Protocol**

**Always define:**
- When to STOP and ask
- What NOT to do
- Common failure modes

**Why:** Prevents hallucination and wrong assumptions.

---

### **Principle 7: Single Verification Command**

**Always provide:**
```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```

**One command, clear exit criteria.**

**Why:** Removes ambiguity about "is this done?"

---

### **Principle 8: Commit Message Template**

**Always provide:**
```
git commit -m "feat(scope): description

Details

Results: X/Y passing

🤖 Generated with [Claude Code]"
```

**Why:** Standardizes commits, captures metrics.

---

### **Principle 9: Start with Simplest**

**Always specify:**
- Implement easiest test first
- Build on success
- Tackle hard things last

**Why:** Builds confidence, validates infrastructure before complexity.

---

### **Principle 10: Phase Continuity**

**Every prompt references:**
- What came before (prerequisites)
- What comes after (next steps in expected outcome)

**Why:** Agent understands journey, not just task.

---

## Standard Prompt Template

```markdown
# CODER PROMPT: [Phase] - [Task]

**Generated:** [Date]
**Target Model:** gpt-5.1-codex-max
**Workspace:** [Path]

---

## ROLE
[1-2 sentences: senior dev doing X]

---

## PROJECT CONTEXT
[3-5 bullets: what system is, current state ✅/❌]

---

## CURRENT PHASE
**Phase:** [Name]
**Objective:** [1 sentence deliverable]
**FUNCTIONAL OUTCOME:** [User capability enabled]

---

## PREREQUISITES
✅ **[Category]:** [items with paths]
✅ **[Category]:** [items]

---

## STATE LOADING (READ THESE FIRST)

### FIRST: [Planning Docs]
1. **[Doc]:** `path` - [extract what]
2. **[Doc]:** `path` - [extract what]

### THEN: [Implementation]
3. **[File]:** `path` - [understand what]
4. **[File]:** `path` - [look for what]

---

## TASK SPECIFICATION
[Break into 2-3 phases with deliverables, line estimates]

---

## WORKFLOW STEPS
1. [Concrete action with command]
2. [Action]
3. [Verify]
4-10. [Continue...]

---

## WORKFLOW RULES

### **Mandatory Rules:**
1. [Absolute constraint]
2. [Constraint]

### **INTERRUPT PROTOCOL**
**STOP and ask if:** [conditions]
**DO NOT:** [anti-patterns]

---

## CODE QUALITY STANDARDS

### **Mandatory Quality Gates:**
- ✅ [Gate with command]

### **Verification Command:**
```bash
[single command]
```

---

## [OPTIONAL: KNOWN ISSUES / DEBUGGING / IMPLEMENTATION GUIDANCE / CRITICAL CONSTRAINTS]

---

## SESSION COMPLETION CHECKLIST
1. ✅ Run verification
2. ✅ Document results (with template)
3. ✅ Commit (with message template)
4. ✅ Report summary

---

## STARTING POINT
**BEGIN by:**
1. [First action - usually read docs]
2. [Second - usually simplest implementation]
3. [Third - verify]

---

## EXPECTED OUTCOME
After this session:
- ✅ [Deliverable]
- ✅ [Deliverable]
- ✅ [Realistic expectation]

**[Reality check about failures/blockers]**
```

---

## What Degraded in Later Prompts

Comparing CODER-PROMPT.md (first, detailed) vs CODER-PROMPT-PHASE5-2.md (later, thinner):

### **Degradation 1: Lost Implementation Guidance**

**First prompt had:**
- Complete code examples for factory pattern
- MockAdapter implementation sketch
- Harness API specification
- Test implementation pattern

**Later prompts:**
- Generic "implement these tests"
- No code examples
- Reference other docs but don't excerpt key parts

---

### **Degradation 2: Weaker Prerequisites**

**First prompt:**
- Listed exact files that exist
- Noted what's in each file
- Clear boundaries

**Later prompts:**
- "Previous phases complete" (vague)
- "Test harness stable" (no specifics)

---

### **Degradation 3: Less Specific Deliverables**

**First prompt:**
- "Factory Pattern (src/core/model-factory.ts) - ~150 lines"
- "Test Harness Class (tests/harness/core-harness.ts) - ~200 lines"
- Specific methods listed

**Later prompts:**
- "Implement 6 tests" (no line estimates)
- "Create fixtures" (no count)

---

### **Degradation 4: Missing KNOWN ISSUES Section**

**Phase 4 prompt had:**
- 3 specific bugs with error messages
- Root cause analysis
- Fix guidance per bug

**Later prompts:**
- Reference test conditions doc
- Don't excerpt the actual conditions
- Agent has to context-switch to another doc

---

## Restoration Checklist

**For next prompt, ensure:**

1. ✅ **All 12-14 sections present**
2. ✅ **Code examples for complex patterns** (don't just reference)
3. ✅ **Specific file paths** (not "relevant files")
4. ✅ **Line count estimates** (gives scope sense)
5. ✅ **Excerpt key requirements** (don't just point to other docs)
6. ✅ **Known issues/bugs** (if applicable)
7. ✅ **Implementation guidance** (for tricky parts)
8. ✅ **Reality check in expected outcome** (acknowledge failures/blockers)

---

## Anti-Patterns to Avoid

❌ **"Review the design doc"** - Excerpt key parts instead
❌ **"Implement the tests"** - Specify which tests, in what order, with what assertions
❌ **"Fix the bugs"** - List specific bugs with error messages
❌ **"Follow best practices"** - Define specific practices
❌ **Vague deliverables** - Every deliverable needs: path, line count, methods
❌ **Missing effort estimates** - Agent can't prioritize without scope
❌ **No code examples** - Complex patterns need scaffolding
❌ **Generic "current state"** - Use ✅/❌ checkboxes with specifics

---

## Success Pattern

**The prompts that worked best:**
1. Detailed implementation guidance (code examples)
2. Specific known issues (bugs with error messages)
3. Clear deliverables (paths + line counts)
4. Realistic expectations (tests may fail, that's OK)
5. Strong interrupt protocol (when to stop and ask)

**The prompts that got thinner:**
- Lost code examples
- Vaguer deliverables
- Weaker prerequisites
- More "review this doc" pointers

**Next prompt must restore:**
- Implementation guidance
- Code scaffolds
- Specific bugs/requirements
- Detailed deliverables
