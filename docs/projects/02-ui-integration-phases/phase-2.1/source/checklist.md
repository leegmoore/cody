# Phase 2.1 Checklist

## Setup
- [ ] Read phase-2.1/source/design.md
- [ ] Read LESSONS-LEARNED.md
- [ ] Understand current config loading (cli/config.ts)

## Issue 1: Config Loading
- [ ] Create normalizeApprovalPolicy() function
- [ ] Create normalizeSandboxMode() function
- [ ] Create normalizeReasoningEffort() function
- [ ] Create normalizeSandboxPolicy() helper if needed
- [ ] Update loadCliConfig() to call normalization functions
- [ ] Apply approval_policy from config to core.approvalPolicy
- [ ] Apply sandbox_policy from config to core.sandboxPolicy
- [ ] Apply reasoning_effort from config to core.modelReasoningEffort
- [ ] Apply reasoning_summary from config to core.modelReasoningSummary
- [ ] Write unit test: approval_policy="never" loads correctly
- [ ] Write unit test: approval_policy="on-request" loads correctly
- [ ] Write unit test: invalid approval_policy throws error
- [ ] Write unit test: sandbox_policy loads correctly
- [ ] All config loading tests pass

## Issue 2: Duplicate Tool Display
- [ ] Remove console.log from approval.ts line 10
- [ ] Remove console.log from approval.ts line 11
- [ ] Verify display.ts still shows tools (unchanged)
- [ ] Test: Tool shown once, not twice

## Issue 3: Submission Logging
- [ ] Remove console.debug("Submission:", sub) from submission-loop.ts line 27
- [ ] Remove console.debug("Submission loop started") from submission-loop.ts line 121
- [ ] Or make both conditional on CODY_DEBUG env var
- [ ] Test: No submission dumps without DEBUG

## Issue 4: Path References
- [ ] Update rollout.ts comments (~/.codex → ~/.cody)
- [ ] Update message-history.ts comments (~/.codex → ~/.cody)
- [ ] Search for other .codex references
- [ ] Update all found references

## Quality Verification
- [ ] npm run format (clean)
- [ ] npm run lint (0 errors)
- [ ] npx tsc --noEmit (0 errors)
- [ ] npm test (all pass, baseline maintained)

## Manual Testing
- [ ] Create ~/.cody/config.toml with approval_policy="never"
- [ ] Test: `cody chat "add 99 to README"` - no approval prompt
- [ ] Test: Tool executes automatically
- [ ] Test: No timeout errors
- [ ] Test: Output clean (<200 lines)
- [ ] Test: No duplicate tool displays
- [ ] Test: No "Submission:" dumps
- [ ] Update config to approval_policy="on-request"
- [ ] Test: Approval prompts DO appear
- [ ] Test: Can approve/deny successfully

## Documentation
- [ ] Update decisions.md with changes
- [ ] Document config loading enhancement
- [ ] Note UX improvements
