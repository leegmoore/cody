# Phase 6 Implementation Guidance: Applying Bubbletea Lessons

## Context

The bubbletea-ts autonomous loop successfully completed 64 sessions porting ~30 Go modules into TypeScript. This document extracts directly applicable patterns for Phase 6 (Codex CLI Integration & Library API Finalization) of the codex-port project.

## 1. External Memory System (DIRECTLY APPLICABLE)

### The Three-Level State System

Bubbletea proved this pattern works across 64+ sessions:

```
.port-plan/
├── plan.md              # Reference oracle (stable)
├── progress-log.md      # Session history & next actions (mutable)
├── decision-log.md      # Durable architectural choices (immutable)
├── standard-prompt.md   # Agent restart template
└── phase-6/             # Phase-specific deep-dives
    ├── api-surface.md   # Public API spec
    ├── cli-flows.md     # Expected user workflows
    └── tool-roadmap.md  # Tool integration plan
```

### Why This Works

1. **No in-memory state required** - Agent restarts with full context
2. **Prevents context loss** - All decisions/progress explicitly documented
3. **Enables auditing** - Git history + decision log create perfect traceability
4. **Scales linearly** - Each session reads same files, size doesn't matter

### For Phase 6

Create immediately at phase start:

**phase-6-plan.md** (similar to bubbletea's plan.md):
- High-level objectives (what is the public API?)
- Scope constraints (what's NOT included?)
- Guiding principles (tests-first, spec-driven)
- Module-by-module breakdown
- Exit criteria (what does "complete" mean?)

**phase-6-progress-log.md** (reverse-chronological):
- Session template with Done/Next/Blockers sections
- Sticky guardrails (scope, dependencies, platforms)
- Test parity checklist
- What's Next prioritized list

**phase-6-decision-log.md** (immutable table):
- Decision ID (P6D-001, P6D-002, etc.)
- Date, title, rationale, status
- Examples: API naming, tool approval flow, config schema

## 2. Tests-First with Upstream Oracles (DIRECTLY APPLICABLE)

### Bubbletea Pattern

```
1. Identify Go test (e.g., mouse_test.go)
2. Author Go test fixtures
3. Commit Go test to Go repo
4. Translate Go test 1:1 to Vitest
5. Run Vitest (expect failures)
6. Implement TypeScript to pass Vitest
7. Confirm both test suites pass
```

### Why It Works

- **Two-way sync**: If upstream changes, tests guide the update
- **Prevents drift**: TypeScript can't diverge without test failure
- **Builds confidence**: Tests are oracle, not just safety net

### For Phase 6

**Existing Contracts to Test-Drive:**

1. **ConversationManager**
   - Read current tests: `codex-ts/src/core/conversation-manager.ts`
   - Document public API surface
   - Add contract tests in `codex-ts/tests/mocked-service/`
   - Example: `createConversation(config)` contract test

2. **Conversation API**
   - Test: `sendMessage(text)` behavior
   - Test: `nextEvent()` behavior
   - Test: event sequence contracts (agent_message → task_complete)
   - Test: error cases (ProgramKilledError, etc.)

3. **CLI Integration**
   - Test: `cody new` creates conversation
   - Test: `cody chat "message"` sends and displays response
   - Test: `cody list` shows saved conversations
   - Test: approval flow (tool execution)

**Workflow:**

```bash
# 1. Create mocked-service test (expect failures)
npm test -- run tests/mocked-service/phase-6-conversation-api.test.ts

# 2. Implement the feature
# (edit src/core/conversation-manager.ts)

# 3. Re-run test (expect pass)
npm test -- run tests/mocked-service/phase-6-conversation-api.test.ts

# 4. Full suite
npm test
```

## 3. Perpetual Loop with Auto-Commit (OPTIONAL BUT RECOMMENDED)

### Bubbletea's Loop Script

```bash
while true; do
  prompt_content=$(extract_prompt)
  codex exec --model gpt-5.1-codex -- <<<"$prompt_content"
  
  git add -A
  git commit -m "Session ${session_num}: Auto-commit"
  
  sleep 30
done
```

### Adaptation for Phase 6

**NOT REQUIRED** if executing single session, but helpful if running multiple sessions:

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="${PROMPT_FILE:-${SCRIPT_DIR}/phase-6-standard-prompt.txt}"
SLEEP_SECONDS="${SLEEP_SECONDS:-30}"

trap 'echo "Caught signal, exiting."; exit 0' INT TERM

extract_prompt() {
  if grep -q '^```' "$PROMPT_FILE"; then
    awk 'BEGIN {in_block=0} /^```/ {in_block=!in_block; next} in_block {print}' "$PROMPT_FILE"
  else
    cat "$PROMPT_FILE"
  fi
}

while true; do
  prompt_content="$(extract_prompt)"
  if [[ -z "${prompt_content//[[:space:]]/}" ]]; then
    echo >&2 "Prompt is empty. Update $PROMPT_FILE."
    exit 1
  fi

  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] Starting Phase 6 session..."

  codex exec \
    --model claude-sonnet-4.5-20250929 \
    --config model_reasoning_effort=high \
    --dangerously-bypass-approvals-and-sandbox \
    - <<<"$prompt_content"

  # Auto-commit
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  cd "$(dirname "$SCRIPT_DIR")" || exit 1
  if [[ -n $(git status --porcelain) ]]; then
    git add -A
    session_num=$(($(git log --oneline | grep -c "Phase6-Session" || echo 0) + 1))
    git commit -m "Phase6-Session ${session_num}: Auto-commit at ${timestamp}"
    echo "[$timestamp] Changes committed."
  else
    echo "[$timestamp] No changes."
  fi

  echo "[$timestamp] Sleeping ${SLEEP_SECONDS}s..."
  sleep "$SLEEP_SECONDS"
done
```

**Standard Restart Prompt (phase-6-standard-prompt.txt):**

```
You are Codex working on Codex CLI Phase 6: Library API Finalization.
Start with zero context. Immediately read:
- docs/projects/02-ui-integration-phases/phase-6/decisions.md
- .port-plan/phase-6-progress-log.md
- .port-plan/phase-6-decision-log.md

Summarize latest progress, then continue on highest-priority 
"What's Next" items while maintaining tests-first methodology.

When you finish: 
1. Update phase-6-progress-log.md with Done/Next/Blockers
2. Append any decisions to phase-6-decision-log.md
```

### If Running Loop

Benefits:
- Each session = one git commit = one recovery point
- `git log` tells exact progression
- Progress log tells exact next steps
- No human context switching between sessions

## 4. Phase-Based Quality Gates (DIRECTLY APPLICABLE)

### Bubbletea's Phase 6.5 Model

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

**Critical rule:** If ANY stage fails, restart the entire chain.

This prevents:
- Lint fixes breaking types
- Type fixes breaking tests
- Tests masking earlier issues

### For Phase 6

Before marking Phase 6 complete, run:

```bash
# From codex-ts/
npm run format && npm run lint && npx tsc --noEmit && npm run build && npm test

# Must all pass consecutively in one run
```

**Exit Criteria:**
1. ✅ `npm run format` completes without changes
2. ✅ `npm run lint` exits 0
3. ✅ `npx tsc --noEmit` exits 0
4. ✅ `npm run build` produces output
5. ✅ `npm test` all passing

**If any fails:** Fix and restart from beginning.

## 5. Guardrails System (DIRECTLY APPLICABLE)

### Bubbletea's Approach

Sticky section in progress log (never deleted):

```markdown
## Loop Guardrails (sticky)

- Keep plan/progress/decision docs in sync
- Prioritize locally executable tasks only
- Windows work OUT OF SCOPE FOR THIS LOOP
- Integration tests deferred (Sessions 58-61)
- Before editing runtime, confirm specs exist first
```

### For Phase 6

**phase-6-guardrails.md** (sticky section in progress log):

```markdown
## Phase 6 Guardrails (sticky)

### Scope
- Public API surface only (ConversationManager, Conversation, Events)
- CLI integration (cody new/chat/list/resume/auth)
- Tool approval flows
- Basic authentication (API key, OAuth structure)

OUT OF SCOPE FOR PHASE 6:
- Advanced tool routing (multi-tool dispatch)
- Persistence layer (JSONL save/resume) - defer to Phase 5
- Multi-provider switching - defer to Phase 3 completion
- REST API wrapper - Phase 7

### Execution Rules
- All CLI features test-driven (mocked-service tests first)
- Before editing runtime, confirm test contract exists
- Keep all changes in codex-ts/ (not tooling/infrastructure)
- No external dependencies without approval

### Session Protocol
1. Read phase-6-plan.md, progress-log.md, decision-log.md
2. Execute "What's Next" from progress log
3. Update progress log (Done/Next/Blockers)
4. Update decision log if architectural choice made
5. Git commit with session summary
```

## 6. Decision Log Pattern (DIRECTLY APPLICABLE)

### Bubbletea's Format

```markdown
| ID    | Date       | Title                    | Decision                  | Status |
|-------|------------|--------------------------|---------------------------|--------|
| D-054 | 2025-11-15 | Suspend bridge strategy  | Implemented Unix-only ... | Final  |
```

**Each decision includes:**
- Unique ID (for reference)
- Date (for timeline)
- Title (searchable)
- Full rationale (not just outcome)
- Status (Final/Superseded/Active)

### For Phase 6

**phase-6-decision-log.md** pattern:

```markdown
| ID    | Date       | Title                           | Decision                                          | Status |
|-------|------------|---------------------------------|---------------------------------------------------|--------|
| P6D-001 | 2025-11-16 | Tool approval mechanism         | Two-phase (preview + approve) with mock callback | Final  |
| P6D-002 | 2025-11-16 | Config schema for tool routing | TOML-based with DSL for tool patterns            | Final  |
| P6D-003 | 2025-11-16 | Event serialization for CLI    | JSON with type discriminator + timestamp          | Final  |
```

### Benefits

- **Searchable by ID**: Can reference P6D-001 in code comments
- **Immutable**: Once logged, decision is permanent record
- **Traceable**: Why was this chosen? See the decision log entry.
- **Supports refactoring**: Future phases can revisit with full context

## 7. Documented API Surface (CRITICAL FOR PHASE 6)

### Bubbletea Created This Explicitly

```markdown
## 6. Module Mapping Matrix

| Go Component | Port Target | Notes |
|---|---|---|
| tea.Program | src/program.ts | Mirror public API |
| Model, Cmd, Msg | src/types.ts | Maintain functional signatures |
| commands.go | src/commands/*.ts | Batch, Sequence, Every semantics |
```

### For Phase 6

Create **phase-6/api-surface.md** documenting PUBLIC exports:

```markdown
# Codex CLI Library API Surface

## Public Exports (@openai/codex-core)

### Main Entry
- `ConversationManager` class
  - `createConversation(config: ConversationConfig): Promise<Conversation>`
  - `resumeConversation(id: string): Promise<Conversation>`
  - `listConversations(): Promise<Conversation[]>`

### Conversation Class
- `sendMessage(text: string): Promise<void>`
- `nextEvent(): Promise<EventMsg>`
- `approveExec(decision: ApprovalDecision): Promise<void>`
- `denyExec(reason: string): Promise<void>`
- `interrupt(): Promise<void>`

### Event Messages
- `AgentMessageEvent`
- `ToolApprovalRequestEvent`
- `ToolExecutionBeginEvent`
- `TaskCompleteEvent`
- `TurnAbortedEvent`

### Configuration Types
- `ConversationConfig`
- `ModelConfig`
- `ToolRegistryConfig`

[Continue for each public interface]
```

This prevents drift and serves as the contract test blueprint.

## 8. What NOT to Copy (Bubbletea-Specific)

The following are bubbletea-specific and not applicable:

- **TTY/signal mocking infrastructure** - Codex uses stdin/stdout, not raw TTY
- **Renderer/screen management** - Codex uses text output, not ANSI rendering
- **Mouse/key input parsing** - Codex uses CLI args, not terminal events
- **Suspend/resume semantics** - Codex doesn't suspend processes

What TO copy:
- External memory system
- Tests-first methodology
- Decision log pattern
- Phase-based gating
- Guardrails system
- Perpetual loop pattern (if needed)

## 9. Summary: Phase 6 Checklist

Before starting Phase 6, create:

- [ ] `phase-6-plan.md` (comprehensive roadmap)
- [ ] `phase-6-progress-log.md` (session template established)
- [ ] `phase-6-decision-log.md` (empty, ready for decisions)
- [ ] `phase-6/api-surface.md` (public API contract)
- [ ] `phase-6/cli-flows.md` (user workflows)
- [ ] `phase-6-guardrails.md` (scope constraints)
- [ ] `phase-6-standard-prompt.txt` (if running perpetual loop)
- [ ] Mocked-service tests for ConversationManager
- [ ] Mocked-service tests for Conversation
- [ ] Mocked-service tests for CLI commands

During Phase 6:

- [ ] Tests-first for every feature (write test → implement → pass)
- [ ] Update progress log end-of-session
- [ ] Log decisions as made (don't batch at end)
- [ ] Keep guardrails visible and enforce
- [ ] Run full quality gate before declaring complete

## 10. Expected Outcome

Following these patterns from bubbletea-ts, Phase 6 should achieve:

- **Complete library API** - Fully documented public surface
- **100% mocked-service coverage** - All critical paths tested
- **Zero technical debt** - Tests passing, lint clean, types correct
- **Perfect traceability** - Every decision recorded, every change committed
- **Ready for documentation** - API surface documented, examples ready

This mirrors bubbletea's success: 64 sessions, 934 tests, 0 regressions, clean handoff.

