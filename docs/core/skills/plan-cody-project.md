# Skill: plan-cody-project

**Purpose:** Plan a Cody project by creating PRD, TECH-APPROACH, and seeding phase directories.

**Input:** Project description (what we're building, why it matters)

**Output:**
- PRD.md (7 sections)
- TECH-APPROACH.md (architecture + all phase sections)
- All phase directories seeded
- Global artifacts created

**Duration:** ~2-3 hours collaborative work

---

## Step 1: Gather Project Context

**Ask user:**
- What are we building? (1-2 sentences)
- Why does it matter? (validation? new capability?)
- What's in scope? What's explicitly out of scope?
- How many phases do you estimate? (rough guess)
- What's the end state? (working CLI? library defined? API implemented?)

**Capture notes for PRD drafting.**

---

## Step 2: Write PRD Section 1 (Overview)

**Format:** 3 paragraphs

**Paragraph 1 - What We're Building:**
```
Project [N] [describes what's being built]. This project [explains scope and approach].
```

**Paragraph 2 - Why It Matters:**
```
[Current state and gap]. This project [what it proves/enables/establishes].
```

**Paragraph 3 - Deliverables:**
```
[List concrete outputs]. The [main deliverable] serves as [dual purpose if applicable].
```

**Example from Project 02:**
```
Project 02 integrates all ported Codex modules (Phases 1-6) into a working command-line
interface called Cody and defines the library API surface for @openai/codex-core. This
project validates the Rust → TypeScript port by wiring protocol, configuration, persistence,
execution, client, tools, and orchestration layers into complete conversation flows.

The port is functionally complete but untested as an integrated system. Individual modules
have unit tests, but we haven't verified end-to-end workflows. This project proves the port
works, exposes integration issues, and establishes the library interface that external
developers will use.

Working CLI demonstrating all capabilities, documented library API defining @openai/codex-core
public surface, and optionally a REST API specification. The CLI serves as both validation
tool and reference implementation.
```

**Write this section. Show to user for approval before continuing.**

---

## Step 3: Write PRD Section 2 (Success Criteria)

**Format:** 3 subsections with numbered lists

**Functional Capabilities:**
- List 5-8 verifiable capabilities
- Format: "[Capability works]: [Description]. Verify via [concrete test/command]."
- Make each verifiable (not "system works" but "user can do X, test via Y")

**Quality Gates:**
- Code quality baseline (tsc, lint, format, tests)
- Mocked-service test coverage (integration tests at boundaries)
- Performance (qualitative or quantitative as appropriate)

**Deliverables:**
- Concrete artifacts (CLI binary, API specs, documentation)
- Each with verification criterion

**Example from Project 02 Functional #1:**
```
1. Basic operations work: Create conversation, send messages, receive responses, maintain
   multi-turn history. Verify via CLI commands (cody new, cody chat, conversation history
   persists across turns).
```

**Principle:** Functional outcome + technical verification method.

---

## Step 4: Write PRD Section 3 (Scope)

**Format:** Two subsections (In Scope, Non-Scope)

**In Scope:** Group by category, 2-4 sentence paragraph per category
- CLI Implementation: [what commands, what features]
- Provider Integration: [which providers, what capabilities]
- [Other categories as relevant]

**Non-Scope:** List what's deferred
- Format: "**[Feature]:** Deferred to [Project N or indefinitely]. [Why not in scope]."

**Example from Project 02 Non-Scope:**
```
**Script Harness:** Deferred to Project 03. This project uses structured tool calling only
(Rust-compatible). QuickJS sandbox, Promise.all parallel execution, and script-based workflows
not integrated in CLI yet.
```

**Principle:** Explicit boundaries prevent scope creep.

---

## Step 5: Write PRD Sections 4-6 (Dependencies, Quality, Constraints)

**Section 4 - Dependencies:**
- Code dependencies (what must be complete)
- External requirements (API keys, tokens, environment)
- Agent prerequisites (what to read)

**Section 5 - Quality Standards:**
- Code quality (TypeScript, ESLint, formatting)
- Testing (mocked-service PRIMARY, model integration for validation)
- Two-layer integration testing (mocked vs real APIs)
- Code review (2-stage: traditional + port validation OR domain-specific)
- Verification process (per-phase + project completion)

**Section 6 - Technical Constraints:**
- Architecture boundaries (what stays unchanged)
- Technology choices (frameworks, tools)
- Integration points (how components connect)
- Future compatibility (design for what comes next)

**Review all three with user.**

---

## Step 6: Write PRD Section 7 (Phases Overview)

**Format:** One entry per phase

**Each phase:**
```
**Phase N: [Name]**
[Technical work paragraph]. [What gets added/wired/built].

**Enables:** [User capability paragraph]. [What user can now do that they couldn't before].
```

**Sub-phase note:**
```
Phases may spawn sub-phases (N.1, N.2) when exploration reveals enhancement opportunities
or scope adjustment needed. Sub-phases documented as created.
```

**Link to detailed breakdown:**
```
See initial-plan.md for complete phase specifications.
```

**But wait - we're not using initial-plan.md anymore. Change to:**
```
See TECH-APPROACH.md for detailed technical approach per phase.
```

**Get user approval on all 7 phases before moving to TECH-APPROACH.**

---

## Step 7: Write TECH-APPROACH Section 1 (Architecture Overview)

**Format:** 3 subsections

**System Summary** (2-3 paragraphs):
- Layer description (protocol, core, presentation)
- Key characteristics (provider-agnostic, stateless, testing approach)
- Entry points and flow

**Component Structure** (ASCII diagram):
- Three layers (CLI, Library, External)
- Component boxes within layers
- Testing boundary marked
- Flow numbered or arrowed

**Current State & Deltas** (4 subsections):

Post-Port Foundation (paragraph + metrics paragraph + bullet list)
- What exists from port
- Completion metrics (modules, tests, quality)
- List of ported components by category

Core Integration Points (paragraph)
- How pieces connect (flow description)
- What's being wired for first time

What's Being Added (intro paragraph + 4 category paragraphs with bullets)
- CLI Layer (Greenfield): why, what it is, what modes, purpose
  - Bullets: Components being built
- Enhancements to Ported Code: what's being extended
  - Bullets: Specific additions
- Testing Infrastructure: new strategy
  - Bullets: Testing components
- API Specifications: what's being documented
  - Bullets: Documentation being created

**Example structure from Project 02 Section 1.**

**This gives agents the baseline before phase-specific detail.**

---

## Step 8: Write Phase Sections in TECH-APPROACH

**For EACH phase**, write section following this pattern:

**Complex phases (lots of new wiring):**

1. **Integration Approach** (2-3 paragraphs)
   - How we wire components
   - What's being activated
   - Testing strategy

2. **Phase Target State** (ASCII diagram)
   - Show NEW and ACTIVATED components
   - Highlight what's added this phase

3. **Paragraph describing diagram**
   - Walk through the flow
   - Explain what's new

4. **Tool Call Cycle / Critical Path** (if applicable)
   - Heading for focused deep-dive
   - Detailed prose on key flow
   - Focused sequence diagram (scoped to critical path)
   - Optional numbered steps

5. **Technical Deltas** (bullets)
   - New code files
   - Wiring points
   - Estimated LOC

6. **Component Structure** (paragraph + Mermaid UML)
   - Intro paragraph on key classes
   - Class diagram with public methods
   - Relationships shown

7. **Connection Points Detail** (detailed prose)
   - Each integration point gets paragraph
   - Dependency injection, data flow, etc.

8. **Complete End-to-End Sequence** (Mermaid)
   - Full flow with all components
   - Notes on mocked vs real

9. **Verification Approach**
   - Functional verification (manual testing)
   - Mocked-service testing (code example)
   - Model integration scripts (if applicable)
   - Quality gates

**Simple phases (mostly config, less wiring):**

Use subset: Integration Approach, Diagram, Deltas, Component Structure, Verification

**Apply bespoke depth** - complex phases get full treatment, simple phases get essentials.

**Example:** Phase 1 (complex), Phase 4 (simple)

---

## Step 9: Create Global Artifacts

Extract from PRD into reusable files:

**artifacts/global/product-summary.md:**
- 1 paragraph describing the product
- From PRD Section 1, What We're Building (condensed)

**artifacts/global/project-context.md:**
- PRD Sections 1-4 content
- What, Why, Success, Scope, Dependencies

**artifacts/templates/role-coder.txt:**
```
ROLE: Senior TypeScript developer implementing phases of the [Project Name]. You write clean,
tested code following TDD principles with mocked-service tests at library boundaries.
```

**artifacts/templates/role-verifier.txt:**
```
ROLE: Code quality verifier and reviewer for [Project Name] phases. You run mechanical quality
checks and perform deep code review against project standards.
```

**artifacts/templates/coder-workflow.txt:**
- Standard TDD workflow (tests first, implement, verify)
- 10 numbered steps
- Copy from what we created

---

## Step 10: Seed All Phase Directories

**For each phase (1 through N):**

Create directory structure:
```
phase-N/
├── source/
│   ├── design.md
│   ├── test-conditions.md (empty template)
│   ├── manual-test-script.md (empty template)
│   └── checklist.md (empty template)
├── prompts/ (empty, will be filled by assembly)
└── decisions.md (empty template)
```

**Seed design.md with:**
```markdown
# Phase N: Technical Design

**Phase:** [Name from PRD Section 7]
**Goal:** [From PRD Section 7 Enables paragraph]

---

## Integration Overview

[Copy TECH-APPROACH Section N Integration Approach]

---

## [Remaining sections - to be filled by plan-cody-phase skill]

Implementation specifics, signatures, mocks, errors, wiring examples -
added during phase planning.
```

**All phases seeded. Project planning complete.**

---

## Skill Output Summary

**Created:**
- PRD.md
- TECH-APPROACH.md
- artifacts/global/ (3-4 files)
- artifacts/templates/ (3 files)
- phase-1/ through phase-N/ directories (seeded)

**Next step:** Load `plan-cody-phase` skill, fill details for each phase.

---

## Key Principles Applied

- **Multi-altitude:** PRD (25k ft) → TECH-APPROACH (15k ft) → phases (10k ft detail)
- **Functional-technical weaving:** Every section maintains both perspectives
- **Progressive disclosure:** Start broad, descend through phases
- **Bespoke depth:** Complex phases detailed, simple phases lighter
- **Narrative structure:** Prose paragraphs + bullets + diagrams
- **Verifiable outcomes:** Success criteria are testable

**These principles guide every section written.**

---

END SKILL: plan-cody-project
