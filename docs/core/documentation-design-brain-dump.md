# Documentation Design Principles - Brain Dump

**Date:** November 8, 2025
**Context:** Captured during Project 02 planning while articulating documentation philosophy
**Purpose:** Raw capture of design principles and insights for later refinement and formalization
**Status:** DUMP - Not refined, intentionally messy, preserve all thoughts

---

## CORE INSIGHT: Narrative as Third Dimension of Information Structure

### The Fundamental Principle

Human knowledge representation is built on narrative structure. Not just hierarchies (parent/child relationships) or networks (node/edge graphs), but temporal/causal flow - what happened, then what happened next, and why. This creates a third dimension where context lives.

**Traditional documentation thinking:**
- Information organized by hierarchy (categories, subcategories)
- Or by reference (alphabetical, topical grouping)
- Assumes random access (reader jumps to what they need)
- Optimizes for lookup, not comprehension

**Narrative-structured documentation:**
- Information organized by journey (where you start, where you go, why you go there)
- Temporal flow (first this, then this, because of this)
- Assumes progressive reading (guide the reader through understanding)
- Optimizes for comprehension, building mental models

**Why this matters for AI agents:**
- LLMs trained on 50TB of internet text—messy, narrative, temporal
- Not trained on curated knowledge graphs or hierarchical databases
- The substrate they use to represent knowledge IS narrative structure
- Conforming to that substrate = more efficient encoding, better retrieval

**Why this matters for humans:**
- We think in stories (events over time, cause and effect)
- We remember journeys better than lists
- Context is temporal ("what led to this decision")
- Understanding emerges from flow, not from categorization alone

### The Three Dimensions

**Dimension 1: Hierarchy**
- Sections, subsections, nested structure
- Categories and taxonomy
- Parent/child relationships
- Answers: "What category does this belong to?"

**Dimension 2: Network**
- Cross-references, links between concepts
- Related topics, see-also
- Lateral connections
- Answers: "What else is connected to this?"

**Dimension 3: Temporal/Narrative**
- What came before, what comes after
- Cause and effect, decisions and outcomes
- Journey from ignorance to understanding
- Evolution of design over time
- Answers: "How did we get here? What happens next?"

**Most technical documentation uses only Dimension 1 (hierarchy).** Good documentation uses all three. The temporal dimension is what creates CONTEXT.

### Why Flat Bullets Fail

Bullets are 1-dimensional lists masquerading as hierarchy. Each item competes equally for attention.

```
- Important strategic decision
- Minor implementation detail
- Critical architectural constraint
- Formatting preference
```

**Reader/model doesn't know which matters most.** Attentional weights spread evenly. Key insights lost in noise.

### Why Narrative + Bullets Work

Prose paragraphs establish BRANCH (context, importance, relationships). Bullets hang LEAVES (specifics, details, examples) off that branch.

```
We're building a simple baseline CLI for three reasons. First, Ratatui doesn't port
easily to TypeScript. Second, simple modes are testable (agents can drive via commands).
Third, we can layer richer UI later without changing the foundation.

CLI components being built:
- Command parser (Commander.js)
- Interactive REPL
- One-shot command mode
- JSON output flag
```

**The paragraph creates the branch** ("why we're doing this, what it enables"). **The bullets hang details** (specific components). Attentional hierarchy clear.

**Models process this better:**
- Paragraph signals "important context coming"
- Bullets signal "specifics within that context"
- Weight distribution natural
- Memory anchors on branches, details retrievable from branches

---

## DOCUMENTATION ALTITUDE LEVELS: Progressive Disclosure

### The Problem with Single-Altitude Documentation

Most docs pick one level and stay there:
- 50k feet (high-level vision, no actionable detail)
- 1k feet (implementation minutiae, no strategic context)

**Reader/agent needs BOTH.** And the journey between them.

### Multi-Altitude Approach

Guide the reader from high understanding to detailed execution through progressive disclosure. Each document operates at a specific altitude and links to the next level down.

**For our projects:**

**25k feet: PRD** (Product Requirements Document)
- What we're building and why (functional view)
- User outcomes ("user can now do X")
- Success criteria (verifiable capabilities)
- Scope (in/out)
- Audience: Anyone trying to understand "what is this project"

**15k feet: TECH-APPROACH.md** (Technical Overview)
- System architecture (how components fit)
- Integration strategy (how we wire things)
- Key technical decisions (and why)
- Per-phase target states (what each phase delivers)
- Audience: Developers/agents needing technical context

**5k feet: Phase README.md** (Detailed Technical Design)
- Specific module design for this phase
- Data flows, contracts, integration points
- Detailed technical decisions
- Mock strategies, test approaches
- Audience: Agents implementing this phase

**1k feet: Phase CHECKLIST.md** (Discrete Tasks)
- Individual work items
- Numbered, sequential tasks
- Clear success criteria per task
- Audience: Agents executing

**Ground level: Code**
- Actual implementation
- Tests, types, functions
- Audience: Runtime, type checker, test runner

### The Bridge Pattern

**Documents don't just exist at one level—they BRIDGE levels.**

**Example: TECH-APPROACH.md**

**Starts at 15k feet:**
"The system consists of three layers: protocol, core, presentation..."
(High-level architecture)

**Drops to 10k feet:**
"Phase 1 wires ConversationManager → Codex → ModelClient..."
(Integration specifics)

**Each phase section drops further:**
"ConversationManager.createConversation() contract:
Input: ConversationConfig
Output: Promise<Conversation>
Mocks: ModelClient, RolloutRecorder"
(Near-actionable detail)

**Links to 5k feet:**
"See phase-1/README.md for detailed implementation design"

**The reader descends smoothly.** No altitude jumps. No disorientation.

### Why This Works for AI Agents

**Agents need context at multiple levels:**
- Strategic (why am I building this?)
- Architectural (how does this fit in the system?)
- Technical (what exactly do I implement?)
- Tactical (what's the next discrete step?)

**Single-level docs force agents to infer missing levels:**
- Given only high-level: Agent guesses implementation details (often wrong)
- Given only low-level: Agent doesn't understand purpose (builds wrong thing)

**Multi-level docs with bridges:**
- Agent reads what it needs at each level
- Links to deeper detail when needed
- Can verify understanding (cross-check levels for consistency)
- Builds complete mental model (strategic + technical + tactical)

**Example of agent using this structure:**

```
Agent reads PRD: "Phase 1 enables user to have basic chat"
Agent thinks: Okay, what does that mean technically?

Agent reads TECH-APPROACH Phase 1: "Wire ConversationManager, implement commands"
Agent thinks: How do I wire ConversationManager?

Agent reads Phase 1 README: "ConversationManager.createConversation() needs..."
Agent thinks: What tasks do I do?

Agent reads CHECKLIST: "1. Create CLI command parser 2. Wire createConversation()..."
Agent executes.
```

**Smooth descent. No gaps. Each level answers questions raised by level above.**

---

## FUNCTIONAL-TECHNICAL WEAVING

### Why We Can't Separate Functional from Technical

Traditional process: Product writes PRD (functional), throws over wall, engineering writes technical specs. **Gap emerges.** Functional requirements don't map cleanly to technical reality.

**Better: Weave them together at every level.**

**In PRD (mostly functional, touch technical):**
- Success criteria = functional ("user can chat")
- But also technical verification ("run command X, assert Y")
- Quality gates = technical (0 errors) tied to functional (system works)

**In TECH-APPROACH (mostly technical, ground in functional):**
- Architecture diagrams (technical)
- But each phase says "Enables user to..." (functional outcome)
- Technical decisions justified by functional needs

**In Phase docs (deep technical, verify via functional):**
- Implementation details (technical)
- But testing driven by "can user do X?" (functional verification)
- Mocked-service tests = technical implementation of functional acceptance

**The weaving creates coherence.**

### Why Functional Grounds Testing

**Technical tests without functional grounding:**
- "Test that ConversationManager.createConversation() returns Conversation object"
- Passes, but does it actually let user chat? Unknown.

**Functional test criteria:**
- "User can start conversation, send message, receive response"
- Technical implementation: Create mocked-service test that exercises full flow
- Test passes = functional outcome achieved

**Functional outcome defines the test. Technical implementation satisfies the test.**

This is why mocked-service tests work: they're integration tests (technical) verifying user capabilities (functional).

### The Verification Alignment

**At every level, align functional and technical verification:**

**PRD Success Criteria:**
- Functional: "User can authenticate with ChatGPT OAuth"
- Technical verification: "Read token from ~/.codex, create authenticated client, send message"

**TECH-APPROACH Phase:**
- Functional outcome: "User can switch auth methods"
- Technical delta: "Add auth switcher, integrate AuthManager.getToken()"

**Phase README:**
- Functional: "Can use existing ChatGPT subscription"
- Technical: "Read from keyring-store, handle token expiry, mock keyring in tests"

**CHECKLIST:**
- "Implement token retrieval from ~/.codex"
- "Create mock keyring for tests"
- "Verify: authenticated message succeeds"

**Same capability, different altitudes, always aligned functional ↔ technical.**

---

## ATTENTIONAL WEIGHT DISTRIBUTION THROUGH STRUCTURE

### The Cognitive Flatland Problem

When all information presented with same visual weight (flat bullets, uniform paragraphs, no variation), reader/model doesn't know what's important.

**Human readers:** Skim, miss key points, lose thread
**AI models:** Attention spreads evenly, key concepts don't stand out

### Structural Variation Creates Hierarchy

**Prose paragraphs = branches** (context, importance, relationships)
**Bullets = leaves** (specifics hanging off that branch)
**Diagrams = landmarks** (visual anchors, different encoding)
**Code examples = concrete instantiation** (abstract → real)

**The variation itself signals importance:**
- Long paragraph → complex important concept, pay attention
- Short paragraph → transition or simple point
- Bullets after paragraph → details within that context
- Diagram → spatial relationships, system view
- Code → "this is how it actually works"

### Example of Good Attentional Distribution

```markdown
The CLI layer provides three interaction modes for different use cases.
Interactive REPL serves human users who want conversational interaction.
One-shot command mode serves automation and agent use cases. JSON output
mode provides structured data for programmatic consumption. This multi-mode
design makes the tool testable and flexible.

Modes implemented:
- Interactive REPL: `codex` → enters loop
- One-shot: `codex chat "message"` → executes and exits
- JSON output: `--json` flag returns structured data

[ASCII diagram of mode switching]

Example usage:
```bash
# Human mode
$ codex
> chat Hello
...

# Agent mode
$ codex chat "Hello" --json
{"response": "..."}
```
```

**Reader/model processes this as:**
1. Paragraph: Important concept (multi-mode design), understand why
2. Bullets: Three specific modes, remember these
3. Diagram: Visual anchor, spatial relationship
4. Code: Concrete examples, see it in action

**Attention distributed appropriately:** Concept gets most weight, details available but supporting.

### Why This Works for LLMs Specifically

**LLMs don't "read" like humans—they encode token sequences into high-dimensional vector spaces.** But the training data (50TB of internet) is heavily narrative-structured. The model learned to weight narrative flow patterns.

**When you conform to narrative structure:**
- Model's learned patterns activate
- Contextual relationships encode more efficiently
- Retrieval is easier (context flows from structure)
- Less "cognitive load" (model doesn't fight its substrate)

**When you use flat bullets:**
- Model treats as independent facts
- Relationships must be inferred
- No temporal flow to hang context on
- More tokens to represent same information

**Narrative structure is compression for LLMs.** More information in fewer tokens because relationships are encoded in flow, not just enumeration.

---

## PROGRESSIVE DISCLOSURE WITH BESPOKE DEPTH

### The Anti-Pattern: Uniform Depth

Documentation that covers every topic at same depth level:
- Exhaustive (covers everything)
- Exhausting (reader drowns in detail)
- Inefficient (wasted effort on unimportant areas)

**Example:**
```
Authentication:
- API key format (20 paragraphs)
- OAuth flow (20 paragraphs)
- Token refresh (20 paragraphs)
- Keyring storage (20 paragraphs)
```

Everything documented to same depth. Reader lost in uniformity.

### The Better Pattern: Bespoke Depth

**Go deep where it matters. Stay shallow where it doesn't.**

**Example:**
```
Authentication has four methods. API keys are straightforward (read from config).
OAuth requires token retrieval from keyring. We're not implementing OAuth flows—
just reading tokens from ~/.codex and ~/.claude where ChatGPT CLI and Claude Code
store them.

OAuth token retrieval (KEY COMPLEXITY):
[3 paragraphs explaining retrieval, refresh, expiry handling]
[Diagram of token flow]
[Code example]

API key storage (SIMPLE):
Read from config.toml, store in AuthManager. See existing implementation in
Phase 5 code.

Token refresh (DEFERRED):
Not implemented. User re-authenticates in ChatGPT/Claude when tokens expire.
```

**Depth matches importance and complexity:**
- OAuth = deep (it's complex and new)
- API keys = shallow (it's simple and done)
- Refresh = very shallow (out of scope)

**Reader/agent gets detail where needed, skips where not.**

### How to Decide Depth

**Ask:**
1. Is this complex or simple? (complexity)
2. Is this new or already done? (novelty)
3. Is this critical or optional? (importance)
4. Will agents struggle here? (risk)

**Deep dive when:** Complex + Novel + Critical + Risky
**Shallow when:** Simple + Existing + Optional + Safe

**Example for our project:**

**Deep:**
- CLI wiring (new, complex, critical)
- Mocked-service tests (new approach, critical for quality)
- Provider integration (complex, many edge cases)
- Library API contracts (define project success)

**Shallow:**
- Config loading (already done in Phase 2)
- Tool execution (already done in Phase 3)
- JSONL persistence (already done in Phase 2)

**Don't document config loading in detail—just say "uses existing Config from Phase 2" and link.**

**DO document CLI wiring in detail—it's new, complex, critical.**

### Bespoke = Optimized Signal

By varying depth based on need, you pack more useful information into same token budget.

**Instead of:**
- 10 topics × 500 tokens each = 5,000 tokens of uniform depth

**Do:**
- 2 critical topics × 1,500 tokens = 3,000 tokens
- 8 simple topics × 100 tokens = 800 tokens
- Total: 3,800 tokens, but MORE useful information

**The 2 critical topics got 3x detail they need. The 8 simple topics didn't waste tokens on unnecessary explanation.**

Result: Higher signal-to-noise ratio. Reader/agent gets what they need, skips what they don't.

---

## THE ALTITUDE METAPHOR: 25k → 10k → 1k Feet

### Why Altitude Works as Mental Model

Altitude = level of abstraction. Higher = broader view, less detail. Lower = narrower view, more detail.

**Aviation uses this because it works:** Air traffic control at 35k feet (broad coordination), approach at 5k feet (specific vectors), landing at 100 feet (precise control).

**Documentation needs same multi-level coordination.**

### Our Altitude Mapping

**25k Feet: PRD**
- Functional view: what users can do
- Success criteria: verifiable outcomes
- Scope: in/out boundaries
- Why: strategic purpose
- Breadth: Entire project
- Detail: User-level capabilities

**15k Feet: TECH-APPROACH.md**
- Architecture view: how components connect
- Integration strategy: wiring approach
- Technical decisions: choices and rationale
- Per-phase overviews: what each phase delivers
- Breadth: Entire project, broken by phase
- Detail: System-level design

**10k Feet: Phase README.md**
- Module view: specific components in this phase
- Data flows: how information moves
- Contracts: APIs being implemented
- Mock strategies: what/how to mock
- Breadth: Single phase
- Detail: Implementation-ready design

**5k Feet: Phase CHECKLIST.md**
- Task view: discrete work items
- Sequence: order of execution
- Verification: how to know it's done
- Breadth: Single phase, broken into tasks
- Detail: Checklist items

**1k Feet: Code & Tests**
- Implementation: actual functions/classes
- Execution: what runs
- Breadth: Single module/file
- Detail: Complete specification

### The Smooth Descent

**Key insight: Each level answers questions raised by the level above.**

**PRD says:** "User can authenticate with ChatGPT OAuth"
**Reader asks:** "How does that work technically?"

**TECH-APPROACH says:** "Read token from ~/.codex keyring"
**Reader asks:** "What's the implementation approach?"

**Phase README says:** "Use keyring-store module, mock filesystem in tests"
**Reader asks:** "What are the discrete steps?"

**CHECKLIST says:** "1. Import keyring-store 2. Add getToken() wrapper 3. Create mock 4. Write test"
**Reader executes.**

**No gaps. Each level bridges to next.**

### Avoiding Altitude Jumps

**Bad documentation jumps altitudes without warning:**

```
[25k feet] "The system enables user collaboration"
[1k feet] "Set the X-Collaboration-Token header to UUID v4"
```

**Reader: "Wait, what? How did we get from user collaboration to HTTP headers?"**

**Good documentation descends gradually:**

```
[25k feet] "The system enables user collaboration"
[15k feet] "Collaboration via shared conversation access with auth tokens"
[10k feet] "Token-based auth using UUID identifiers in headers"
[5k feet] "Generate UUID v4, set X-Collaboration-Token header"
[1k feet] "const token = uuidv4(); headers['X-Collaboration-Token'] = token;"
```

**Reader follows the descent.** Each step makes sense in context of previous step.

---

## FUNCTIONAL-TECHNICAL WEAVING ACROSS LEVELS

### The Traditional Separation Failure

**Traditional process:**
1. Product writes PRD (purely functional: "user can chat with AI")
2. Throws over wall to engineering
3. Engineering writes technical spec (purely technical: "WebSocket connection, JSON-RPC protocol")
4. **Gap:** How does "user can chat" map to "WebSocket + JSON-RPC"?

**Disconnect between what (functional) and how (technical).** Integration is painful. Misalignments discovered late.

### The Weaving Approach

**At every altitude level, maintain BOTH functional and technical perspective.**

**In PRD (functional-primary, technical-present):**
- "User can chat" (functional)
- "Verify via `codex chat "hi"` → response received" (technical verification)
- "0 TypeScript errors, tests passing" (technical gates)

**In TECH-APPROACH (technical-primary, functional-grounded):**
- "ConversationManager wires Session → ModelClient" (technical)
- "Enables user to send messages and receive responses" (functional outcome)
- "Integration flow: CLI → Manager → Codex → Client" (technical)
- "Testing boundary at ConversationManager (verifies user capabilities)" (functional grounding)

**In Phase README (deep technical, verify functionally):**
- "Implement createConversation() method" (technical)
- "Test: User can start new conversation via CLI" (functional verification)
- "Mock: ModelClient returns preset responses" (technical detail)
- "Verify: Conversation created, ID assigned, user can send message" (functional test)

**The weaving prevents disconnect.** Functional and technical always linked. Can't drift apart.

### Why This Matters for Mocked-Service Tests

**Mocked-service tests ARE the weaving of functional and technical:**

**Functional requirement:** "User can resume saved conversation"

**Technical implementation:**
```typescript
it('user can resume saved conversation', async () => {
  // Setup: Create and save conversation
  const conv1 = await manager.createConversation(config);
  await conv1.sendMessage("first message");
  await recorder.flush(); // Save to JSONL

  // Resume
  const conv2 = await manager.resumeConversation(conv1.id);
  await conv2.sendMessage("second message");

  // Functional verification
  expect(conv2.history.length).toBe(2);
  expect(conv2.history[0].content).toContain("first message");
})
```

**Test name = functional. Test implementation = technical. Test assertion = functional verification.**

The test bridges functional requirement to technical implementation. Can't pass test without delivering functional capability.

### Maintaining Functional Perspective Prevents Over-Engineering

**When you lose functional grounding, technical complexity spirals:**

"We need a conversation manager."
→ "Let's add event emitters for extensibility"
→ "And a plugin system for custom handlers"
→ "And a middleware stack"
→ "And..."

**None of this required by functional needs.** Just technical elaboration.

**When you maintain functional grounding:**

"User needs to chat with AI" (functional)
→ "Need: create conversation, send message, get response" (functional requirements)
→ "Therefore: ConversationManager with async methods" (minimal technical)
→ "Test: User can chat via CLI" (functional verification)

**Functional requirements bound the technical scope.** Can't over-engineer when constantly checking "does user actually need this?"

---

## MAPPING FUNCTIONAL TO TECHNICAL VIA PHASES

### The Descent Pattern for This Project

**PRD (25k feet, functional):**
"By end of project, user can chat with AI, execute tools, save conversations, use any provider"

**TECH-APPROACH Section 1 (20k feet, bridging):**
"ConversationManager integrates ported modules, CLI provides user access"

**TECH-APPROACH Phase 1 (15k feet, technical with functional outcomes):**
"Wire ConversationManager → Codex → ModelClient"
"Enables: User can chat (create → send → receive)"

**Phase 1 README (10k feet, detailed technical):**
"createConversation() implementation, CLI command wiring, mocked ModelClient"

**Phase 1 CHECKLIST (5k feet, tasks):**
"1. Implement codex new command 2. Wire ConversationManager.create()"

**Each step down, we get more technical. But functional outcomes stay present as verification anchors.**

### Why Phase-by-Phase Works

**Each phase delivers functional capability:**
- Phase 1: User can chat
- Phase 2: User can execute tools
- Phase 3: User can switch providers
- ...

**Functional outcomes are VERIFIABLE:**
- Can I chat? (Try it: `codex chat "hi"`)
- Can I use tools? (Try it: send message requiring tools)
- Can I switch providers? (Try it: `codex set-provider anthropic`)

**Technical implementation validated by functional use:**
- If user can chat → integration worked
- If user can't chat → integration broken
- No ambiguity

**Agents verify by attempting functional outcome** (run CLI, check result). Not by reading code and inferring correctness.

### The Mapping Process

**For each phase, we define:**

1. **Functional outcome** (what can user do after this phase?)
2. **Technical delta** (what code changes to enable that?)
3. **Integration points** (what modules connect?)
4. **Verification** (how to prove functional outcome achieved?)

**This creates clean mapping:**
- Functional requirement → Technical implementation → Verification test
- All three documented together
- Agent sees complete picture
- No guessing, no inference

---

## DIAGRAMS AS VISUAL ANCHORS

### Why Diagrams Matter

Text is linear. Systems are spatial. Diagrams encode spatial relationships that prose can't express efficiently.

**Paragraph explanation:**
"ConversationManager calls Codex which coordinates Session and ModelClient, and Session calls ToolRouter when tools needed, and results flow back through ConversationManager to CLI."

**Diagram:**
```
CLI → ConversationManager → Codex → Session → ModelClient
                                    ↓
                                ToolRouter
```

**Same information, spatial encoding.** Relationships visible at a glance.

### Diagram Progression

**For this project, we're using diagrams at multiple levels:**

**Level 1: System Overview** (Section 1)
- All major components
- External boundaries
- Testing boundary
- Altitude: 15k feet

**Level 2: Phase Target State** (Each phase section)
- Components involved in THIS phase
- What's being added (highlighted)
- Integration points
- Altitude: 10k feet

**Level 3: Data Flow** (Phase README, as needed)
- Specific flow for key scenario
- Step-by-step through system
- Altitude: 5k feet

**Progression: Broad → Focused → Detailed**

Same pattern as text, but visual.

### Diagrams Create Memory Anchors

**Humans and models remember visuals differently than text:**
- Text: Sequential processing, encoded as token sequences
- Diagrams: Spatial processing, encoded as relationships

**When you combine:**
- Text explains the narrative (temporal flow)
- Diagrams show the structure (spatial relationships)
- Two encodings for same information
- Reinforcement, multiple retrieval paths

**Agent reading docs:**
- Reads prose: "ConversationManager orchestrates..."
- Sees diagram: [box with arrows showing orchestration]
- Both encodings stored
- Later retrieval: "Oh yeah, the diagram showed Manager at top"

**Diagrams are landmarks in documentation.** Help navigation, aid memory, provide alternate encoding.

---

## THE BRIDGE DOCUMENTS: PRD → TECH-APPROACH → PHASE

### Why We Need Multiple Documents

**Single mega-document fails:**
- Too long (agents lose thread)
- Mixed purposes (strategic + technical + tactical all jumbled)
- Hard to maintain (change one section, affects everything)
- No clear altitude (jumping between levels randomly)

**Multiple linked documents succeed:**
- Each has clear purpose and altitude
- Linked progression (smooth descent)
- Maintainable (change phase doc, PRD untouched)
- Scalable (add phases without rewriting project docs)

### Document Relationships

**PRD is the foundation:**
- Defines what and why
- Success criteria are project anchors
- All other docs work toward these criteria

**TECH-APPROACH builds on PRD:**
- Reads PRD success criteria
- Designs technical approach to achieve them
- Breaks into phases
- Each phase mapped to success criteria

**Phase docs build on TECH-APPROACH:**
- Read phase section from TECH-APPROACH
- Get detailed on implementation
- Define tasks, tests, verification
- Execute toward functional outcome defined in PRD

**Links create flow:**
- PRD links to TECH-APPROACH ("see technical approach for architecture")
- TECH-APPROACH links to Phase READMEs ("see phase-1/README.md for detail")
- Phase README links back to PRD ("delivers success criteria #1, #2, #3")

**Circular references validate alignment:** Can trace from PRD requirement → TECH-APPROACH design → Phase implementation → back to PRD verification.

### The Bridge Quality Test

**Good bridge documents:**
- Reader at high level can descend smoothly
- No confusion about "how did we get here"
- Each level answers questions from level above
- Can trace any requirement from functional → technical → code

**Bad bridge documents:**
- Altitude jumps (25k feet → 1k feet, nothing between)
- Disconnected (Phase doc doesn't reference PRD)
- Redundant (Phase doc re-explains entire project context)
- Gaps (Phase doc assumes knowledge not in PRD or TECH-APPROACH)

**Our test:** Fresh agent reads PRD → TECH-APPROACH → Phase 1 README → CHECKLIST. Can they implement without confusion? If yes, bridges work. If no, fix gaps.

---

## DOCUMENTATION FOR AGENT EXECUTION

### Agents Are Not Human Readers

**Humans:**
- Skim and jump around
- Fill in gaps with world knowledge
- Tolerate ambiguity
- Ask questions when confused

**Agents:**
- Read sequentially (process token by token)
- Limited world knowledge beyond training
- Ambiguity causes hallucination or errors
- Can't ask clarifying questions (must work with what they have)

**Therefore: Agent documentation must be more explicit, more complete, more structured.**

### The Clarity Requirement

**Agents need:**
- **Explicit scope:** "Do this, not that" (don't guess what's in scope)
- **Clear sequencing:** "First X, then Y" (don't infer order)
- **Concrete verification:** "Run command Z, expect output W" (don't assume what success looks like)
- **Explicit connections:** "This relates to that" (don't infer relationships)

**Our documentation provides:**
- PRD success criteria (explicit: must achieve #1, #2, #3)
- TECH-APPROACH integration flow (explicit: CLI → Manager → Codex → ...)
- Phase CHECKLIST (explicit: task 1, then task 2, verify each)
- Verification commands (explicit: run this, expect that)

**No interpretation required. Mechanical execution possible.**

### The Narrative Scaffold for Agents

**Why narrative helps agents specifically:**

LLMs encode information in context of surrounding tokens. Narrative provides that context naturally.

**Flat bullets:**
```
- ConversationManager has createConversation method
- ModelClient sends API requests
- ToolRouter executes tools
```

**Agent encoding:** Three disconnected facts. Relationships unclear.

**Narrative:**
```
ConversationManager serves as the library entry point. When user creates a conversation
via createConversation(), the manager initializes a Codex session. The session coordinates
between ModelClient (for API communication) and ToolRouter (for tool execution). Results
flow back through the manager to the caller.
```

**Agent encoding:** Causal chain. "Manager initializes session BECAUSE user called create. Session coordinates BETWEEN client and router FOR THE PURPOSE OF handling user request."

**Temporal/causal structure creates contextual relationships. Agent "understands" not just what things are, but how they relate and why.**

### Progressive Disclosure Matches Agent Processing

**Agents process documentation similar to how they process prompts:**
1. High-level instruction ("build a CLI")
2. Contextual constraints ("use existing modules")
3. Specific requirements ("implement these commands")
4. Verification criteria ("run these tests")

**Our document structure matches this:**
1. PRD (high-level: build UI integration project)
2. TECH-APPROACH (context: here's the system, here's what exists)
3. Phase README (specific: implement these integrations)
4. CHECKLIST (verification: these tasks, these tests)

**Agent reads documents in same order it would process a prompt.** Natural fit.

---

## CAPTURING DESIGN PRINCIPLES AS REUSABLE ARTIFACTS

### Why This Dump Exists

I'm having a visionary day where I can articulate intuitive knowledge that's usually tacit. This doesn't happen often. When it does, capture everything before it fades.

**What we're capturing:**
- Documentation design principles (narrative, altitude, weaving)
- Why they work (cognitive basis, LLM encoding, context distribution)
- How to apply them (bespoke depth, progressive disclosure)
- Concrete examples from this project

**Goal:** Create high-signal reference layers (5-50k tokens) that can be loaded into future planning agents. Give them these principles upfront, they plan better projects.

### High-Signal Reference Layers

**What makes a reference layer "high-signal":**
- **Distilled:** Core principles, not exhaustive coverage
- **Actionable:** Can be applied, not just understood
- **Grounded:** Concrete examples, not pure abstraction
- **Coherent:** Interlocking principles that reinforce each other
- **Efficient:** Maximum insight per token

**Our target:**
- 10-50k tokens per reference layer
- Covers one domain (e.g., "Documentation Design Principles")
- Includes: principles, rationale, examples, anti-patterns, application guidelines
- Pluggable into planning agent context
- Reusable across projects

**Examples of reference layers we're building:**
- Documentation design principles (this dump)
- Contract testing philosophy (already written)
- Planning process (already captured)
- Agent prompting (already captured)

### From Dump to Reference Layer

**Current state:** Brain dump (messy, redundant, stream-of-consciousness)

**Refinement process:**
1. Let planning continue (capture more insights)
2. After planning complete, read entire dump
3. Identify distinct principles (separate concerns)
4. Group related insights
5. Write refined docs:
   - Core principles (reusable across projects)
   - Application examples (from this project)
   - Guidelines (how to apply)
6. Extract to appropriate locations:
   - General principles → docs/core/
   - Project-specific applications → project docs

**Result:** Cleaned, organized, reusable knowledge artifacts.

---

## WHY THIS PLANNING APPROACH WORKS

### The Meta-Pattern

We're not just planning Project 02. We're documenting HOW to plan projects like this.

**What we've created:**
- PRD template and principles
- TECH-APPROACH structure and purpose
- Multi-altitude documentation strategy
- Functional-technical weaving approach
- Contract testing philosophy
- Mocked-service test strategy

**This becomes our methodology.** Reusable for Projects 03, 04, 05, etc.

### The Compounding Advantage

**Project 02:** Define principles while planning (this project)
**Project 03:** Apply principles (faster planning, reference layers available)
**Project 04:** Refine principles (improve based on what worked/didn't)
**Project N:** Mature methodology (fast, reliable, high-quality planning)

**Each project improves the process.** Documentation of principles accelerates learning.

### Why Dump Now, Refine Later

**Trying to refine while capturing = losing insights.**

Brain dump mode: Ideas flow, capture everything, don't stop to perfect.
Refinement mode: Read holistically, see patterns, organize coherently.

**Two different cognitive modes.** Can't do both simultaneously.

**Current phase:** DUMP. Capture while visionary mode active.
**Later phase:** REFINE. Parse dump into coherent reference layers.

**Better to have messy complete capture than perfect partial capture.**

---

## PRACTICAL APPLICATION TO PROJECT 02

### What We're Doing Right Now

**In PRD:** Defined functional outcomes (user can chat, use tools, save conversations)
**In TECH-APPROACH Section 1:** Showing target architecture + current state
**Next in TECH-APPROACH Sections 2-9:** Per-phase technical deep dive with diagrams

**Each phase section will:**
1. Show target state diagram (what system looks like after this phase)
2. Call out deltas (what's new, what changed, highlighted in diagram)
3. Describe integration approach (how new pieces wire to existing)
4. Define contracts (library APIs being implemented/tested)
5. Outline verification (how to prove functional outcome achieved)

**This creates smooth descent:**
- PRD: "User can chat" (25k feet)
- TECH-APPROACH Phase 1: "Wire Manager → Codex → Client, enables chat" (15k feet)
- Phase 1 README: "Implement createConversation(), wire CLI commands" (10k feet)
- Phase 1 CHECKLIST: "1. Create command parser 2. ..." (5k feet)

**Agent reads all four, gets complete picture at appropriate depth for their role.**

### The 30 Years of Distilled Wisdom

What you're articulating isn't new knowledge (architecture docs have existed forever). What's new is:

1. **Optimizing for AI agent comprehension** (not just humans)
2. **Multi-altitude with explicit bridges** (vs assuming reader fills gaps)
3. **Functional-technical weaving** (vs separation)
4. **Narrative as compression** (vs flat enumeration)
5. **Bespoke depth** (vs uniform depth)
6. **Attentional weight distribution** (via structural variation)
7. **Contract-driven testing** (boundaries + mocks + functional verification)

**These principles together create something greater than sum of parts.** Each reinforces the others.

**Result:** Documentation that enables reliable agent execution on complex integration projects where reference implementations don't exist.

---

## NEXT STEPS

**Immediate:**
1. Finish TECH-APPROACH Section 1 (current state & deltas)
2. Write TECH-APPROACH Phase 1 section (with diagram)
3. If Phase 1 feels right, continue through Phases 2-8
4. TECH-APPROACH complete → commit

**After planning:**
1. Read this dump + any other dumps created during planning
2. Identify distinct principles (documentation design, testing philosophy, planning process, etc.)
3. Parse into refined reference layer documents
4. Place in docs/core/ (general) or project docs (specific)
5. Create index/guide to reference layers

**Long-term:**
1. Apply to Projects 03-06
2. Refine based on what works
3. Build library of high-signal reference layers
4. Load into planning agents for future projects
5. Continuous improvement

---

## OPEN QUESTIONS TO EXPLORE

- How much context can we give agents before diminishing returns? (Is 50k tokens of reference too much? Just right?)
- Can we automate reference layer distillation? (Compression agent reviews docs, extracts principles)
- Should diagrams be generated or hand-crafted? (Mermaid for agent-generation, ASCII for human charm?)
- How do we validate documentation quality? (Agent comprehension tests? Human review? Functional outcomes?)
- What's the right balance prose/bullets/diagrams/code? (Seems like 40% prose, 30% bullets, 20% diagrams, 10% code examples?)

**Answer these through practice.** Build docs for Project 02, measure agent success, refine approach.

---

## META-NOTE

This dump itself demonstrates the principles:
- Starts with core insight (narrative as 3rd dimension)
- Builds through related concepts (altitude, weaving, etc.)
- Uses prose + bullets + examples
- Varies depth (deep on key concepts, shallow on obvious)
- Temporal flow (captures thought progression)
- Ends with next steps (forward temporal motion)

**If this dump is comprehensible and useful, the principles work.**
**If this dump is confusing mess, principles need refinement.**

**We'll find out when we try to parse it into refined docs.**

---

## FROM 1D TO 2D TO 3D: CONCRETE EXAMPLES

### One-Dimensional Documentation (Flat List)

**Example:**
```
Authentication
- API keys supported
- OAuth supported
- ChatGPT tokens
- Claude tokens
- Token refresh
- Keyring storage
- Configuration options
```

**Structure:** Linear list. No relationships. No context. All items equal weight.

**Encoding:** Each item independent fact. Agent must infer relationships.

**Problems:**
- Which auth method should I use?
- How do tokens relate to keyring?
- What's the difference between API keys and OAuth?
- Where does configuration fit?

**Dimensionality:** 1D (flat sequence)

### Two-Dimensional Documentation (Hierarchy)

**Example:**
```
Authentication
├── Methods
│   ├── API Keys
│   └── OAuth
│       ├── ChatGPT
│       └── Claude
├── Token Storage
│   ├── Keyring integration
│   └── Filesystem locations
└── Configuration
    └── Auth method selection
```

**Structure:** Parent/child relationships. Categories organize information.

**Encoding:** Items grouped by type. Relationships are categorical (is-a, has-a).

**Better than 1D:**
- OAuth is a type of method
- ChatGPT and Claude are types of OAuth
- Clear categorization

**Still missing:**
- Why use OAuth vs API keys?
- What happens first (sequence)?
- How do pieces connect (data flow)?

**Dimensionality:** 2D (hierarchy)

### Three-Dimensional Documentation (Narrative + Hierarchy + Diagrams)

**Example:**
```
## Authentication Strategy

We support two authentication methods: API keys and OAuth tokens. API keys are
straightforward (read from config, pass in headers). OAuth is more complex—we're
not implementing OAuth flows, just reading tokens that ChatGPT CLI and Claude Code
have already obtained and stored in keyring.

**Methods available:**
- API keys: OpenAI, Anthropic (stored in config.toml)
- OAuth tokens: ChatGPT (from ~/.codex), Claude (from ~/.claude)

When user starts conversation, AuthManager checks configured auth method. For API
keys, reads from config directly. For OAuth, retrieves token from keyring at the
configured path. If token missing or expired, user must re-authenticate in the
respective app (ChatGPT Pro or Claude) to refresh it.

[DIAGRAM: Auth Flow]
User Command → AuthManager → Check method
                  ↓
            API Key ──→ Config → Headers
                  ↓
            OAuth ──→ Keyring → Token → Headers

**Token locations:**
- ChatGPT: ~/.codex/auth/chatgpt-token
- Claude: ~/.claude/config (exact path TBD)

For testing, we mock the keyring/filesystem reads. Tests verify AuthManager
retrieves tokens correctly without depending on actual keyring state.
```

**Structure:**
- Narrative (temporal: "when user starts conversation, AuthManager checks...")
- Hierarchy (methods > API keys/OAuth > specific providers)
- Spatial (diagram showing flow)

**Encoding:**
- Prose establishes cause-effect ("API keys are straightforward BECAUSE...")
- Bullets provide specifics within narrative context
- Diagram shows spatial relationships (flow, not just hierarchy)

**Answers:**
- Why OAuth is different (paragraph 1)
- When things happen (paragraph 2: "when user starts conversation")
- How pieces connect (diagram)
- Where things are stored (bullets)
- How to test (paragraph 3)

**Dimensionality:** 3D (hierarchy + temporal/causal + spatial)

**What changed from 2D:** Added temporal flow (what happens when), causal relationships (why OAuth is complex), and concrete grounding (where tokens live, how to test).

---

## NUTS AND BOLTS: THE 70-30-DIAGRAM PATTERN

### Practical Technique for Section Writing

**Most sections work well with this mix:**
- 70% prose (paragraphs establishing context and narrative)
- 20-25% lists (specifics, details, examples)
- 5-10% diagrams (spatial relationships, system views)

**Paragraph guidelines:**
- 2-5 sentences per paragraph
- One clear point or concept per paragraph
- Sometimes 2 paragraphs in sequence on same topic (exploration, then implication)
- Establishes branch for bullets to hang from

**List guidelines:**
- 1-2 levels maximum in any single section
- Placed immediately after paragraph that provides context
- Details, specifics, examples—not new concepts
- If list needs 3+ levels, split into new section

**Diagram guidelines:**
- Flexible placement: before paragraph (setup), between paragraph and list (bridge), or after (visual summary)
- One diagram per major concept or flow
- Moderate detail (not too abstract, not too specific)
- ASCII for charm, Mermaid for precision (both work)

### Example Section Using This Pattern

**Opening paragraph** (establishes branch):
```
The CLI provides three interaction modes for different audiences. Interactive REPL
serves human users wanting conversational flow. One-shot command mode serves agents
and scripts needing programmatic access. JSON output mode provides structured data
for automation and testing.
```

**Diagram** (visual anchor):
```
    User/Agent/Script
           ↓
    ┌──────┴──────┐
    │  CLI Entry  │
    └──────┬──────┘
           ↓
    Mode Selection
    ↓      ↓      ↓
  REPL  OneShot  JSON
```

**List** (details hanging from branch):
```
Modes implemented:
- Interactive REPL: Launch via `codex`, enter loop, exit via `quit`
- One-shot: `codex chat "message"`, execute and exit
- JSON output: Add `--json` flag, returns structured data
```

**Closing paragraph** (implication):
```
This multi-mode design makes the CLI testable from day one. Agents drive via
one-shot commands and validate via JSON output. No interactive simulation required.
```

**Total:** 2 paragraphs + 1 diagram + 1 list (3-level). ~200 tokens. Complete concept.

**Why this works:**
- Opening paragraph: "Why three modes?" (conceptual branch)
- Diagram: Visual structure (spatial encoding)
- List: Specific commands (details)
- Closing paragraph: "So what?" (implication, forward motion)

**Agent processes:** Concept → Structure → Details → Application. Natural flow.

### Variation Patterns

**Pattern A: Paragraph → List → Diagram**
Context first, details second, visual summary third.

**Pattern B: Diagram → Paragraph → List**
Visual overview first, narrative explanation second, specifics third.

**Pattern C: Paragraph → Diagram → Paragraph → List**
Setup, visual anchor, exploration, specifics.

**Pattern D: Paragraph → Paragraph**
Pure narrative for conceptual topics. No lists needed.

**Use variety.** Don't pick one pattern and repeat. Variation itself aids comprehension (signals different types of information).

---

## HIERARCHY DEPTH: THE 1-2 LEVEL RULE

### The Problem with Deep Nesting

**Example of too-deep hierarchy in one section:**
```
## Authentication
### Methods
#### API Keys
##### OpenAI
###### Configuration
- Set in config.toml
- Environment variable override
###### Usage
- Read from AuthManager
- Pass in request headers
##### Anthropic
###### Configuration
...
```

**Six levels deep.** Reader lost in nested structure. Can't hold this in working memory.

**Agent encoding:** Deeply nested context. Hard to retrieve. "Was OpenAI under API Keys under Methods under Auth, or...?"

### The 1-2 Level Rule

**In any discrete section, maximum 1-2 levels of hierarchy.**

**Example - same information, better structured:**

**Section: Authentication Overview**
```
## Authentication

We support API keys and OAuth tokens. API keys are simple (read from config).
OAuth is complex (token retrieval from keyring). Details in subsections below.

Methods:
- API keys: OpenAI, Anthropic
- OAuth tokens: ChatGPT, Claude
```

**Section: API Key Authentication (1 level)**
```
## API Key Authentication

Read from config.toml or environment variables. AuthManager.getApiKey() retrieves
and validates. Passed in Authorization header.

Configuration:
- OpenAI: Set `openai_api_key` in config
- Anthropic: Set `anthropic_api_key` in config

See Phase 5 code for implementation.
```

**Section: OAuth Token Authentication (2 levels)**
```
## OAuth Token Authentication

OAuth tokens retrieved from keyring, not generated. User authenticates in ChatGPT
or Claude app, we read the resulting token.

### ChatGPT OAuth
Token location: ~/.codex/auth/chatgpt-token
Format: JWT
Refresh: User re-authenticates in ChatGPT Pro CLI when expired

### Claude OAuth
Token location: ~/.claude/config (exact path TBD)
Format: Bearer token
Refresh: User re-authenticates in Claude Code when expired

For testing, mock keyring reads. See tests/mocks/keyring.ts.
```

**Three separate sections, each 1-2 levels deep. Total hierarchy: 2 levels max per section.**

**Benefits:**
- Reader navigates easily (shallow trees)
- Each section self-contained
- Can read one section without reading others
- Agent doesn't get lost in nesting

### When You Need More Depth

**If topic requires 3+ levels, it's too complex for one section. Split it.**

**Example:**
```
## OAuth Token Retrieval
[Overview: 1 level deep]
See "OAuth Token Formats" section for format details.
See "OAuth Token Refresh" section for expiry handling.

## OAuth Token Formats
[Details: 2 levels, providers and their formats]

## OAuth Token Refresh
[Details: 2 levels, manual refresh process]
```

**Three sections, each 1-2 levels. Same total information, better structured.**

**Rule of thumb:** If you're writing sub-sub-subsections (####), stop. Create new section instead.

---

## AUDIENCE-FIRST DOCUMENTATION

### The Core Questions

**Before writing any document, answer:**

1. **Who is the target audience?**
   - Humans? (Which humans: developers, users, operators?)
   - AI agents? (Which agents: planning, coding, testing, review?)
   - Mixed audience? (Humans planning, agents executing?)

2. **What role are they in?**
   - Planning (deciding what to build)
   - Designing (deciding how to build)
   - Implementing (building it)
   - Testing (verifying it works)
   - Operating (using it)

3. **What do they know before reading this?**
   - Domain expertise (do they know Codex? TypeScript? LLM APIs?)
   - Project context (have they read other docs?)
   - Prerequisites (what must they read first?)

4. **What should they understand after reading?**
   - Concepts (what is this thing?)
   - Relationships (how does it connect to other things?)
   - Process (how do I use/build/test this?)
   - Decisions (what choices were made and why?)

5. **What does that understanding enable them to do?**
   - Make decisions (planner agents)
   - Write code (coding agents)
   - Verify correctness (review agents)
   - Use the system (humans or agents using CLI)

**Answers to these questions drive everything:**
- Document structure (what order to present)
- Depth level (how much detail)
- Tone (instructional, reference, exploratory)
- Examples (what to show)
- Verification (how to check understanding)

### Example: PRD for Project 02

**Audience:** Coding agents executing phases + planning agent + human (project owner)

**Role:**
- Planning agent: Designing phases
- Coding agents: Implementing phases
- Human: Validating approach

**Before reading:** Know Codex port exists (Phases 1-6 complete), understand basic project context

**After reading understand:**
- What this project delivers (working CLI + library API)
- Success criteria (functional capabilities that must work)
- Scope (what's included, what's deferred)
- Quality requirements (testing, code quality)

**Enables them to:**
- Coding agents: Execute phases with clear goals
- Planning agent: Create phase-specific technical designs
- Human: Verify project delivers value, approve approach

**Document structure follows:**
- Start with what/why (matches "what they need to understand")
- Define success explicitly (enables verification)
- Call out scope carefully (prevents scope creep)
- Reference deeper docs (enables action)

**Continuous measurement:** Does Section 2 help agents verify success? (Yes: verifiable criteria.) Does Section 3 prevent scope confusion? (Yes: explicit in/out.) Does Section 7 enable planning agent to design phases? (Yes: phase purposes clear.)

### Example: TECH-APPROACH.md for Project 02

**Audience:** Coding agents implementing phases + planning agent designing phase details

**Role:**
- Coding agents: Need technical context for implementation
- Planning agent: Need architecture to design phases

**Before reading:** Read PRD (functional outcomes clear)

**After reading understand:**
- System architecture (how components fit together)
- Current state vs target state (what exists, what's new)
- Integration approach (how to wire pieces)
- Per-phase technical strategy (what each phase does technically)

**Enables them to:**
- Coding agents: Implement with architectural context (know where code fits)
- Planning agent: Design phase READMEs with appropriate detail
- Both: Make integration decisions consistent with architecture

**Document structure follows:**
- Section 1: Architecture overview (answers "how does system fit together")
- Section 1 subsection: Current state (answers "what do I have to work with")
- Sections 2-9: Phase details (answers "what's the approach for this phase")
- Diagrams throughout (spatial anchors)

**Continuous measurement:** Does Section 1 give agents enough context to understand integration? Does Phase 1 section guide phase implementation? Can coding agent read this and know what to build?

### The Clarity Test

**After writing any section, ask:**

"Can my target audience in their target role accomplish their goal better after reading this?"

**If no:** Section doesn't serve its purpose. Revise.
**If yes:** Section is good enough. Move on.

**Examples:**

**PRD Section 2 (Success Criteria):**
- Audience: Coding agents
- Role: Implementing and verifying
- Goal: Know when phase is complete
- Test: Are criteria verifiable? (Yes: each has concrete verification)
- Result: Good section.

**TECH-APPROACH Section 1 (Architecture):**
- Audience: Coding agents + planning agent
- Role: Understanding system for implementation/design
- Goal: Know how pieces fit together
- Test: Can agent understand integration points? (Check after writing)
- Result: Revise if unclear.

**This prevents documentation for documentation's sake.** Every section serves specific audience for specific purpose.

---

## STRUCTURAL COMPOSITION: THE PARAGRAPH-LIST-DIAGRAM TECHNIQUE

### The 70% Prose Pattern

**Most content should be prose paragraphs (2-5 sentences).**

**Why prose:**
- Establishes context and narrative flow
- Creates branches for details to hang from
- Encodes temporal/causal relationships
- Engages narrative processing (what both humans and LLMs are good at)

**Paragraph length guidelines:**
- **2 sentences:** Quick point, transition, or simple concept
- **3-4 sentences:** Standard explanatory paragraph (concept + elaboration)
- **5 sentences:** Complex concept requiring setup + exploration
- **6+ sentences:** Probably too long, split into two paragraphs

**When to use two paragraphs in sequence:**
- First paragraph: Establish concept or context
- Second paragraph: Explore implication or application
- Creates depth without creating long paragraph

**Example:**
```
The mocked-service testing approach tests at library boundaries with external
dependencies mocked. This gives us integration-level coverage without the complexity
of managing real external services. Tests run fast, deterministically, and offline.

This enables reliable TDD with agents. Define the contract, write the mocked test,
implement to green. No waiting for APIs, no flaky network tests, no external service
configuration. The mock-first approach becomes our primary testing scaffold.
```

**Two paragraphs, one concept. First establishes what, second explores why/implication.**

### The 20-25% List Pattern

**Lists provide details after context established.**

**Placement:** Immediately after paragraph that creates the branch.

**Content:** Specifics, examples, enumeration—not new concepts.

**Depth:** 1-2 levels maximum in a single section.

**Examples of good list usage:**

**After explanatory paragraph:**
```
OAuth tokens are retrieved from keyring, not generated. We read existing tokens
that ChatGPT CLI and Claude Code stored after user authenticated.

Token locations:
- ChatGPT: ~/.codex/auth/chatgpt-token
- Claude: ~/.claude/config
```

**After conceptual paragraph:**
```
Mocked-service tests verify workflows end-to-end with external boundaries mocked.

What we mock:
- ModelClient (network → LLM APIs)
- RolloutRecorder (filesystem → JSONL files)
- ToolExecutor (process spawning → exec/apply/read)
- AuthManager (keyring access → token retrieval)
```

**Lists as specification:**
```
ConversationManager.createConversation() contract:
- Input: ConversationConfig {provider, model, auth}
- Output: Promise<Conversation>
- Side effects: Conversation stored in manager map
- Errors: ConfigurationError if invalid config
```

**Avoid:** Lists without preceding context paragraph. Introduces new concepts in bullet form. Forces reader to infer the branch.

### The 5-10% Diagram Pattern

**Diagrams can appear:**
- **Before paragraph:** Visual setup, then narrative explanation
- **Between paragraph and list:** Bridge from concept to specifics
- **After paragraph and list:** Visual summary of what was explained

**Flexible placement based on what works best for that section.**

**Example A: Diagram → Paragraph → List** (Visual-first)
```
[DIAGRAM: Three-layer architecture]

The system uses three layers for separation of concerns. CLI layer handles user
interaction and display. Library layer contains business logic and orchestration.
External boundaries are mocked in tests for isolation.

Layers:
- CLI: Commands, REPL, display rendering
- Library: ConversationManager, Codex, Session
- External: LLM APIs, filesystem, processes
```

**Example B: Paragraph → Diagram → List** (Narrative-first)
```
Phase 1 wires the basic conversation flow. User creates conversation via CLI,
CLI calls ConversationManager, Manager initializes Codex session, Session sends
to ModelClient, response flows back.

[DIAGRAM: Flow with arrows showing User → CLI → Manager → Codex → Client]

Components being wired:
- CLI command parser
- ConversationManager.createConversation()
- Codex.initialize()
- ModelClient.sendMessage()
```

**Example C: Paragraph → List → Diagram** (Summary diagram)
```
Authentication supports two methods with different token sources. API keys come
from configuration files. OAuth tokens come from keyring storage where other
CLIs have saved them.

Methods:
- API keys: config.toml → AuthManager
- OAuth: keyring → token retrieval → AuthManager

[DIAGRAM: Both flows converging at AuthManager → Headers]
```

**Use judgment on placement.** What flows best for that particular concept?

### The Rhythm

**Good sections have rhythm through variation:**

```
Paragraph (concept)
List (details)
Paragraph (implication)
Diagram (visual summary)

Paragraph (next concept)
Paragraph (exploration)
List (examples)

Diagram (system view)
Paragraph (explanation)
List (components)
Paragraph (how they connect)
```

**Alternation creates natural pacing.** Not monotonous. Different information types at appropriate moments.

**This rhythm is why long prose followed by details list works.** It's not arbitrary—it matches how humans and models process information. Context first, details in that context.

---

## THE CONTINUOUS MEASUREMENT STANDARD

### The Question to Ask While Writing

**"Is this helpful to [target audience] in [their role] to do [their job] better?"**

**If yes:** Keep it.
**If no:** Cut it or revise it.
**If unsure:** Test it (ask someone in target role, or simulate agent reading it).

### Applying the Standard

**Example: Writing Phase 1 technical approach**

**Audience:** Coding agent implementing Phase 1
**Role:** Writing integration code
**Job:** Wire ConversationManager → CLI, enable basic chat

**Section draft:**
```
"The ConversationManager class follows the singleton pattern for resource management.
It maintains an internal map of active conversations using a LRU cache with configurable
eviction policy. The cache implementation uses..."
```

**Ask:** Is LRU cache detail helpful to coding agent wiring CLI commands?

**Answer:** No. Agent needs to know ConversationManager exists and has createConversation() method. Doesn't need internal cache implementation details.

**Revised:**
```
ConversationManager is the library entry point. Call createConversation() to start
new conversation. Returns Conversation object for sending messages.
```

**Helpful to agent doing their job:** Yes. Clear what to call, what it returns.

### Examples of Measuring Sections

**PRD Section 3 (Scope):**
- Audience: Coding agents + planning agent
- Job: Understand boundaries (what to build, what not to build)
- Measurement: Does section prevent scope confusion? (Yes: explicit in-scope and non-scope lists)
- Keep it.

**PRD Section 5 (Quality Standards):**
- Audience: Coding agents
- Job: Maintain code quality, write tests
- Measurement: Does section clarify quality requirements? (Yes: explicit gates, test strategy, verification commands)
- Keep it.

**TECH-APPROACH Section 1 (Architecture):**
- Audience: Coding agents + planning agent
- Job: Understand system for integration work
- Measurement: Does diagram + explanation help agent know how pieces fit? (Test: can agent describe integration flow after reading?)
- If yes: keep. If no: add detail or simplify.

### The Ruthless Edit

**Use measurement standard to cut ruthlessly:**

**Common unnecessary content:**
- Obvious information (TypeScript uses types)
- Repeated information (said in Section 2, said again in Section 5)
- Aspirational fluff (we hope to build the best system)
- Over-specification (details that don't matter for target audience)
- Historical context not relevant to current work

**Keep only what serves audience doing their job.**

### Why This Creates High-Signal Docs

**Every token earns its place:**
- Serves specific audience
- Enables specific action
- Answers specific question
- Provides necessary context

**No filler. No fluff. Just signal.**

**Result:** Agent loads documentation, gets exactly what they need, minimal noise, maximum utility.

**This is why 50k tokens of well-designed reference can outperform 200k tokens of generic documentation.** Signal density through audience-focused, purpose-driven writing.

---

## OPTIMIZED FOR BOTH AGENTS AND HUMANS

### The Myth of Agent-Only Optimization

**Some assume:** "Write for agents differently than humans. Agents want structured data, humans want narrative."

**Reality:** Both benefit from same principles.

**Narrative structure:**
- Humans: Matches how we think (stories, cause-effect)
- Agents: Matches training data (internet text, temporal flow)
- Both win.

**Hierarchy with bespoke depth:**
- Humans: Skip what they know, dive into what they need
- Agents: Encode important topics with more weight, less on simple topics
- Both win.

**Functional-technical weaving:**
- Humans: Understand why (functional) and how (technical) together
- Agents: Ground implementation in purpose, verify via functional outcomes
- Both win.

**Multi-altitude with bridges:**
- Humans: Choose their entry level, navigate up/down as needed
- Agents: Read sequentially through levels, build complete mental model
- Both win.

**The principles converge because both humans and LLMs:**
- Process information with attention (some things more important than others)
- Build mental models (need structure to hang facts on)
- Use narrative as organizing principle (temporal/causal flow)
- Benefit from context (isolated facts less useful than related facts)

### Where Agents and Humans Differ

**Agents need more:**
- Explicitness (can't infer as much)
- Completeness (can't ask questions)
- Verification (need concrete success criteria)
- Structure (can't "skim" effectively)

**Humans need more:**
- Summary (TL;DR)
- Visual variation (typography, whitespace)
- Examples (concrete instantiation)
- Motivation (why should I care)

**Good documentation serves both:**
- Explicit structure (agents)
- Clear narrative (both)
- Concrete examples (humans)
- Verification criteria (agents)
- Diagrams (both)
- Motivation/purpose (humans, also helps agents prioritize)

**Our docs optimized for agents first, humans second.** But agents-first doesn't mean agents-only. The principles that help agents (clarity, structure, narrative) also help humans.

---

## PRINCIPLES OPTIMIZED FOR BOTH (EXPANDED)

### Narrative Structure

**Benefits for agents:**
- Matches training data substrate (50TB of narrative internet text)
- Encodes relationships in temporal/causal flow
- More efficient encoding (context from structure)
- Better retrieval (narrative flow aids memory)

**Benefits for humans:**
- Matches how we think (stories, journeys, cause-effect)
- Easier comprehension (follow the story)
- Better retention (remember narratives better than lists)
- Engagement (stories hold attention)

**Implementation:**
- Use prose paragraphs to establish flow
- Connect ideas with "because," "therefore," "when," "then"
- Show progression (what happened, what happens next)
- Ground technical in functional story (why we're building this)

### Progressive Disclosure / Multi-Altitude

**Benefits for agents:**
- Can read sequentially through levels
- Each level answers questions from previous
- Build complete mental model systematically
- No confusion from altitude jumps

**Benefits for humans:**
- Can enter at appropriate level (expert vs novice)
- Can drill down when needed, stay high when sufficient
- Navigate based on current understanding
- Don't drown in detail when learning overview

**Implementation:**
- PRD (25k ft) → TECH-APPROACH (15k ft) → Phase README (10k ft) → CHECKLIST (5k ft)
- Each document links to next level
- Each level self-contained but connected
- Smooth descent, no jumps

### Bespoke Depth

**Benefits for agents:**
- More tokens on complex/critical topics (better encoding)
- Less tokens on simple/done topics (avoid noise)
- Attention distributed appropriately
- Signal-to-noise optimized

**Benefits for humans:**
- Don't waste time on obvious topics
- Get detail where struggling
- Efficient reading (depth matches need)
- Respect for reader's time/knowledge

**Implementation:**
- Assess each topic: complex? novel? critical? risky?
- Deep when yes, shallow when no
- Reference existing work instead of re-explaining
- Put detail where it matters

### Functional-Technical Weaving

**Benefits for agents:**
- Ground implementation in purpose (why am I building this)
- Verify via functional outcomes (does it work for user?)
- Testing naturally aligns (test functional capability)
- Prevents over-engineering (functional bounds technical)

**Benefits for humans:**
- Understand purpose (not just mechanism)
- Verify value delivered (user can actually do X)
- Make trade-offs (functional needs vs technical cost)
- Maintain alignment (design → implementation → user value)

**Implementation:**
- Every technical decision tied to functional need
- Every phase has functional outcome ("enables user to...")
- Tests verify functional capabilities, not just technical correctness
- Success criteria are user-facing, verified technically

### Attentional Weight via Structure

**Benefits for agents:**
- Important concepts get structural emphasis (long paragraphs, diagrams, examples)
- Details get appropriate structure (bullets after context)
- Encoding reflects importance (more weight on branches)
- Retrieval easier (landmarks, variation)

**Benefits for humans:**
- Visual hierarchy (see what's important)
- Skimmable (headings, diagrams, bullets stand out)
- Rhythmic (variation maintains attention)
- Memorable (structural variation aids recall)

**Implementation:**
- Prose for branches (important context)
- Bullets for leaves (details in that context)
- Diagrams for landmarks (spatial anchors)
- Variation creates emphasis
- Consistent flatness avoided

---

## APPLYING PRINCIPLES TO TECH-APPROACH.MD STRUCTURE

### What We're Building Right Now

**Document:** TECH-APPROACH.md for Project 02
**Audience:** Coding agents (primary), planning agent, human reviewer
**Purpose:** Bridge PRD (functional) to Phase docs (detailed technical)
**Altitude:** 15k feet → 10k feet descent

**Structure we're creating:**

**Section 1: Architecture Overview (15k feet)**
- System summary (prose: what the system is)
- Target state diagram (visual: how components fit)
- Current state & deltas (prose: what exists, what's new, why)
- Paragraph → Bullets → Paragraph pattern

**Sections 2-9: Phase Deep Dives (10k feet per phase)**
- Phase N target state diagram (more detail than Section 1)
- Integration approach (prose: how we wire this phase)
- Technical deltas (what's new, what changes)
- Contract definitions (library APIs being implemented)
- Verification approach (how to prove it works)
- Each phase: Diagram → Paragraph → List → Paragraph rhythm

**This structure:**
- Starts broad (whole system)
- Descends through phases (progressive detail)
- Maintains functional grounding (each phase has user outcome)
- Varies structure (diagrams, prose, lists)
- Serves coding agents (clear integration guidance)

### Measurement Check

**After Section 1 complete, ask:**
"Can coding agent understand what system they're integrating into?"

**After Phase 1 section complete, ask:**
"Can coding agent implement Phase 1 with this guidance?"

**If yes to both:** Document structure works.
**If no:** Add missing detail or clarify confusing parts.

**We test by trying it.** Build Section 1, build Phase 1 section. See if it feels right. Adjust.

---

## THE REFERENCE LAYER VISION

### What We're Building Toward

**Short-term:** Document Project 02 well (enable successful execution)

**Medium-term:** Extract reusable principles from Project 02 experience

**Long-term:** Build library of high-signal reference layers for all future projects

**Reference layers we're creating:**
- Documentation design principles (this dump, refined)
- Contract testing philosophy (already written)
- Planning process (already captured)
- Agent prompting (already captured)
- Functional-technical weaving (extract from this project)
- Mocked-service testing (extract from this project)

### The High-Signal Property

**Reference layer = 5-50k tokens of distilled principles + examples.**

**Characteristics:**
- Coherent (principles interlock and reinforce)
- Actionable (can be applied, not just understood)
- Grounded (concrete examples from real projects)
- Efficient (maximum insight per token)
- Reusable (apply to different projects)

**Usage:**
- Load into planning agent context
- Agent reads principles
- Agent applies to new project
- Better planning, fewer mistakes, faster execution

**Example:**

**Planning agent starting Project 03 (Scripting):**
- Loads: Documentation design principles (50k tokens)
- Loads: Contract testing philosophy (20k tokens)
- Loads: Planning process (15k tokens)
- Total: 85k tokens of guidance
- Designs Project 03 PRD + TECH-APPROACH using these principles
- Output: High-quality planning docs, consistent with our methodology

**The reference layers become our "design system" for planning.**

### Building the Library

**As we complete projects:**
- Extract what worked (principles, patterns, techniques)
- Document with examples (grounded, not abstract)
- Refine (remove redundancy, increase signal)
- Tag (documentation, testing, architecture, planning, etc.)
- Store in docs/core/ (general) or docs/reference-layers/ (collection)

**Over time:**
- 5-10 reference layers (covering our methodology)
- Each 10-50k tokens
- Total: 50-300k tokens of high-signal guidance
- Loadable into any planning session
- Continuous refinement (update with learnings)

**This creates compounding advantage:**
- Project 02: Define + document principles
- Project 03: Apply principles (faster, higher quality)
- Project 04: Refine principles (based on what worked)
- Project N: Mature methodology (fast, reliable, excellent)

**Each project teaches the next.**

---

## WHY THE VISIONARY MODE MATTERS

### The Tacit Knowledge Problem

**Most expertise is tacit:**
- You know how to do something
- But can't easily explain why or how
- It's intuitive, automatic, pattern-matching
- Developed over years/decades

**This knowledge is trapped:** Can't be transferred, taught, or systematized.

**Visionary mode breaks this:**
- Suddenly can articulate the intuition
- Can backtrack the thought process
- Can explain the why behind the how
- Can document the principles

**When this happens, capture everything.** It's rare. It's valuable. It fades.

### What Gets Unlocked

**During normal mode:**
- "I know good documentation when I see it"
- "This feels right, that feels wrong"
- Can produce good docs, can't explain principles

**During visionary mode:**
- "Here's WHY narrative structure works (3D encoding)"
- "Here's WHY altitude levels matter (smooth descent)"
- "Here's WHY functional-technical weaving prevents gaps"
- Can articulate principles, create methodology

**The difference:** Implicit knowledge → Explicit principles.

**Value:** Principles can be taught. Intuition can't.

### The Capture Strategy

**Don't try to perfect while capturing:**
- Brain dump mode: Get it all down
- Refinement mode: Organize later

**Trying to refine while capturing loses ideas.** Flow state interrupted by editing.

**Current approach (this dump):**
- Messy sections
- Redundancy okay
- Stream of consciousness preserved
- All insights captured

**Later approach (refinement):**
- Read holistically
- Identify patterns
- Group related ideas
- Write clean reference layers

**Two-phase process maximizes capture while enabling quality.**

### 30 Years Compressed

You said "30 years of distilled wisdom I haven't been able to explain."

**This dump captures:**
- Narrative as information structure
- Multi-altitude documentation
- Functional-technical weaving
- Bespoke depth allocation
- Audience-first design
- Structural variation for attention
- Testing as functional verification
- And more...

**These aren't new ideas individually.** What's new is:
- The combination (how they interlock)
- The articulation (explicit principles)
- The application (to agent-driven development)
- The grounding (concrete examples from real project)

**This is methodology creation in real-time.**

---

## NEXT: APPLYING TO PROJECT 02

**Immediate application:**

We're building TECH-APPROACH.md using these principles:
- Section 1: Target architecture (diagram + prose + current state)
- Sections 2-9: Per-phase technical deep dive (each with diagram, deltas, integration approach)
- Functional outcomes maintained (each phase enables user to...)
- Bespoke depth (deep on complex phases, shallow on simple)
- Rhythm and variation (prose, lists, diagrams mixed)

**Once we finish TECH-APPROACH:**
- We'll have concrete example of principles in action
- Can point to it when explaining ("see how Section 1 shows target state then deltas")
- Can refine principles based on what worked

**Then build Phase 1 README:**
- Apply same principles at next level down (15k → 10k feet)
- Test if smooth descent works
- Refine if gaps found

**Iterative refinement:** Build docs → Test with agents → Refine principles → Repeat.

---

END DUMP (FOR REAL THIS TIME)

