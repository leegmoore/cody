# Skill: plan-cody-phase

**Purpose:** Fill phase planning details (implementation specifics, tests, checklist) after project planning seeded directories.

**Input:** Phase number (user says "plan phase 1" or "plan phase 2")

**Prerequisites:**
- `plan-cody-project` skill already run (PRD, TECH-APPROACH, seeded phase directories exist)
- phase-N/source/design.md already has TECH-APPROACH section copied as starter

**Output:**
- phase-N/source/design.md (enhanced with implementation details)
- phase-N/source/test-conditions.md (functional test descriptions)
- phase-N/source/manual-test-script.md (user testing steps)
- phase-N/source/checklist.md (discrete tasks)
- phase-N/prompts/CODER.txt (assembled)
- phase-N/prompts/VERIFIER.txt (assembled)

**Workflow:** Skill loads once, plans all phases in sequence.

---

## Step 1: Read Phase Context

**Read existing files:**
- PRD.md Section 7 (this phase's overview)
- TECH-APPROACH.md Section [N+1] (this phase's technical approach - Section 2 for Phase 1, Section 3 for Phase 2, etc.)
- phase-N/source/design.md (starter with Integration Overview already present)

**Understand:**
- What's being built this phase
- What user capability it enables
- Integration approach

---

## Step 2: Add Implementation Specifics to design.md

**Current state:** design.md has Integration Overview from TECH-APPROACH

**Add Section: Actual Signatures**

Find relevant ported code. Copy actual TypeScript signatures.

**How to find:**
- Read TECH-APPROACH Component Structure diagram (shows classes)
- Read ported source in codex-ts/src/core/ and codex-ts/src/client/
- Copy class signatures, method signatures, interface definitions

**Example from Phase 1:**
```markdown
## Actual Signatures (from ported code)

### ConversationManager

Location: `codex-ts/src/core/conversation-manager.ts`

\`\`\`typescript
class ConversationManager {
  constructor(authManager: AuthManager, sessionSource: unknown)

  async newConversation(config: Config): Promise<NewConversation>
  async getConversation(conversationId: ConversationId): Promise<CodexConversation | undefined>
}

interface NewConversation {
  conversationId: ConversationId,
  conversation: CodexConversation,
  sessionConfigured: SessionConfiguredEvent
}
\`\`\`
```

**Include:**
- Constructor parameters (what dependencies needed)
- Public methods being used this phase
- Return types
- Key interfaces

**Add Section: Config/Data Formats**

Show actual file formats if relevant (TOML, JSON, etc.).

**Example from Phase 1:**
```markdown
## Config File Format

Example `~/.codex/config.toml`:

\`\`\`toml
[provider]
name = "openai"
api = "responses"
model = "gpt-4"

[auth]
method = "api-key"
openai_key = "sk-proj-..."
\`\`\`
```

**Add Section: Mock Implementation Guide**

Show how to create mocks for testing.

**Example from Phase 1:**
```markdown
## Mock Implementation Guide

### Mock ModelClient

Location: `tests/mocks/model-client.ts`

\`\`\`typescript
export function createMockClient(responses: ResponseItem[][]) {
  let callIndex = 0;
  return {
    async sendMessage(request: any): Promise<ResponseItem[]> {
      return responses[callIndex++];
    },
    getModelContextWindow: vi.fn().mockReturnValue(128000)
  };
}

// Usage
const mockClient = createMockClient([
  [{type: 'message', role: 'assistant', content: [{type: 'text', text: 'Hello!'}]}]
]);
\`\`\`
```

**Add Section: Error Handling**

List expected errors and how to handle.

**Example from Phase 1:**
```markdown
## Error Handling

### Expected Errors

**ConfigurationError:** Config file missing, invalid TOML, required fields missing

**AuthError:** API key invalid or missing

**NetworkError:** API call fails, rate limit

### Handling in CLI

\`\`\`typescript
try {
  const result = await conversation.submit(input);
} catch (err) {
  if (err instanceof ConfigurationError) {
    console.error('Configuration error:', err.message);
    process.exit(1);
  }
  // ...
}
\`\`\`
```

**Add Section: Wiring Code Example**

Show minimal working code for the integration.

**Example from Phase 1:**
```markdown
## Wiring Code Example

\`\`\`typescript
// src/cli/index.ts
import {program} from 'commander';
import {ConversationManager} from '../core/conversation-manager';

let manager: ConversationManager;

program
  .command('new')
  .action(async () => {
    const config = await loadConfig();
    const authManager = new AuthManager(/* deps */);
    manager = new ConversationManager(authManager, null);

    const {conversationId} = await manager.newConversation(config);
    console.log(\`Created: \${conversationId.toString()}\`);
  });
\`\`\`
```

**Add Section: Reference Code Locations**

Where to look in ported code when stuck.

```markdown
## Reference Code Locations

- ConversationManager: `codex-ts/src/core/conversation-manager.ts`
- Codex: `codex-ts/src/core/codex/codex.ts`
- Config: `codex-ts/src/core/config.ts`
```

**Add Section: Key Implementation Notes**

Gotchas, TODOs in port, special considerations.

**design.md now complete with implementation details.**

---

## Step 3: Write test-conditions.md

**Format:** One section per test

**Each test:**
```markdown
### Test N: [Test Name]

**Functional description:**
[What capability this test verifies. User perspective.]

**Setup:**
- [What mocks needed]
- [What state to create]

**Execute:**
- [What to call/do]

**Verify:**
- [What to assert/check]

**Implementation:** [Brief guidance on how to code this test]
```

**Example from Phase 1 Test 1:**
```markdown
### Test 1: Create Conversation

**Functional description:**
User can create a new conversation. ConversationManager returns conversation with valid ID.
Conversation is stored and retrievable.

**Setup:**
- Mock ModelClient (no responses needed for creation)
- Mock Config (openai, responses, api-key)

**Execute:**
- Create ConversationManager with mocks
- Call newConversation(config)

**Verify:**
- Returns NewConversation object
- conversationId is defined
- Can retrieve via getConversation(id)

**Implementation:** Create test file, mock setup, call newConversation, assert on return values.
```

**Write 3-6 tests covering:**
- Happy path (main functionality)
- Multi-step flow (if applicable)
- Error cases (at least one)

**Functional descriptions, not code.** Coder converts to actual tests.

---

## Step 4: Write manual-test-script.md

**Format:** Setup + numbered test cases + success checklist

**Structure:**
```markdown
# Phase N: Manual Test Script

**Purpose:** Verify functional requirements through actual CLI usage
**Duration:** ~5-10 minutes

## Setup

[Prerequisites: build, config, environment]

## Test 1: [Primary Happy Path]

**Execute:**
\`\`\`bash
[exact command]
\`\`\`

**Expected output:**
\`\`\`
[what user should see]
\`\`\`

**Verify:**
- ✅ [checklist item]
- ✅ [checklist item]

**If fails:** [Troubleshooting hint]

## Test 2-N: [Other scenarios]

[Same format]

## Success Checklist

After completing all tests:
- [ ] Test 1: [capability]
- [ ] Test 2: [capability]
...

All tests pass: Phase N functional requirements verified.
```

**Example from Phase 1:** Test 1 (create conversation), Test 2 (send message), Test 3 (multi-turn context), etc.

**User will run these manually** to verify CLI actually works beyond automated tests.

---

## Step 5: Write checklist.md

**Format:** Grouped tasks with checkboxes

**Groups:**
- Setup (directories, dependencies)
- [Component A] (subtasks for this component)
- [Component B] (subtasks)
- Testing (mocked-service tests)
- Functional Verification (manual testing)
- Quality Gates (format, lint, type, tests)
- Documentation (update DECISIONS.md)
- Final (all complete, ready for verification)

**Each task:**
- Discrete action (not "implement feature" but "create file X", "implement method Y")
- Checkable (done or not done, no ambiguity)
- ~20-60 tasks depending on phase complexity

**Example from Phase 1:** 50+ tasks grouped into Setup, Config Loading, ModelClient Construction, etc.

**Coder checks off as they work.**

---

## Step 6: Run Assembly Script

Generate complete prompts from source artifacts:

```bash
node scripts/assemble-prompt.js --phase N --type coder
node scripts/assemble-prompt.js --phase N --type verifier
```

**Outputs:**
- phase-N/prompts/CODER.txt (~5-10k tokens)
- phase-N/prompts/VERIFIER.txt (~200-300 tokens)

**Verify:** Files created, token counts reasonable.

---

## Step 7: Review with User

**Show user:**
- phase-N/prompts/CODER.txt (skim, check completeness)
- phase-N/source/design.md (review implementation specifics)
- phase-N/source/checklist.md (verify task breakdown)

**Ask:**
- Missing any crucial details?
- Implementation specifics clear?
- Test conditions adequate?

**Refine if needed, reassemble.**

---

## Step 8: Move to Next Phase

**Ask:** "Plan next phase? (Phase N+1)"

If yes: Repeat Steps 1-7 for next phase.
If no: Phase planning complete for now.

**Skill stays loaded** - can plan multiple phases in one session.

---

## Principles Being Applied

**Progressive disclosure (whiteboard principle):**
- TECH-APPROACH gives overview + flow
- design.md adds implementation specifics
- Don't dump all at once, build understanding in layers

**Bespoke depth:**
- Complex phases: Full treatment (critical path, detailed connections)
- Simple phases: Essentials only (approach, deltas, verification)

**Functional-technical weaving:**
- Test conditions: Functional descriptions → technical implementation
- Manual tests: User actions → verify capabilities
- Success criteria: Functional outcomes → technical verification

**Actual code over descriptions:**
- Show real TypeScript signatures (not "ConversationManager has methods")
- Show actual config format (not "config contains provider info")
- Show working mock code (not "create mock that returns responses")

**TDD scaffold:**
- Test conditions written before implementation
- Mocks specified clearly
- Verification built into workflow

---

END SKILL: plan-cody-phase
