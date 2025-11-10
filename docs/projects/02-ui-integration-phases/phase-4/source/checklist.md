# Phase 4: Authentication Expansion – Task Checklist

**Status:** Not Started
**Estimated Code:** ~350 lines (CLI 110, auth layer 80, mocked tests 160)

---

## Setup & Planning

- [ ] Review Phase 3 implementation (provider switching works)
- [ ] Read TECH-APPROACH Section 5 (Phase 4 technical approach)
- [ ] Read phase-4/source/design.md (implementation details)
- [ ] Inspect ported AuthManager: `codex-ts/src/core/auth/index.ts`
- [ ] Inspect KeyringStore: `codex-ts/src/core/keyring-store/index.ts`
- [ ] Check for existing ChatGPT OAuth implementation (Phase 5 port)

---

## AuthManager Enhancements

### Type Definitions

- [ ] Define AuthMethod type (union of 4 method strings)
- [ ] Update AuthConfig interface to include method field
- [ ] Export types for CLI usage

### Token Retrieval Logic

- [ ] Implement getToken(provider) method:
  - [ ] Check configured auth method
  - [ ] Route to appropriate retrieval function
  - [ ] Validate provider matches method (OAuth constraint)
  - [ ] Return token string
- [ ] Implement getApiKey(provider) helper:
  - [ ] Read from config.auth[`${provider}_api_key`]
  - [ ] Throw AuthError if missing
- [ ] Implement getChatGPTOAuthToken() helper:
  - [ ] Call keyring.readToken('~/.cody/oauth/chatgpt.json')
  - [ ] Parse JSON, extract access_token
  - [ ] Throw AuthError if missing
- [ ] Implement getClaudeOAuthToken() helper (NEW):
  - [ ] Try multiple paths (3 possible locations)
  - [ ] Return first successful read
  - [ ] Throw AuthError if all fail, list paths tried

### Method Management

- [ ] Implement getSelectedMethod():
  - [ ] Return config.auth.method
  - [ ] Provide default if missing (openai-api-key)
- [ ] Implement setMethod(method):
  - [ ] Validate method is one of four valid values
  - [ ] Update config
  - [ ] Save config file

### Error Handling

- [ ] All errors are AuthError type with helpful messages
- [ ] Missing token errors suggest how to fix
- [ ] Provider mismatch errors explain constraint
- [ ] Document error message templates in code comments

---

## CLI Commands

### login Command

- [ ] Create `src/cli/commands/login.ts`
- [ ] Implement command:
  - [ ] Load config and create AuthManager
  - [ ] Get current method
  - [ ] For each of 4 methods, check if token available
  - [ ] Display table: method name, status (✓/✗), current marker (→)
  - [ ] For missing tokens, show help text
- [ ] Format output:
  - [ ] Clear visual hierarchy
  - [ ] Current method obvious
  - [ ] Help text actionable

### set-auth Command

- [ ] Create `src/cli/commands/set-auth.ts`
- [ ] Implement command:
  - [ ] Accept method argument
  - [ ] Validate method name (one of four valid)
  - [ ] Load config
  - [ ] Update auth.method
  - [ ] If API key method and key missing, prompt user
  - [ ] Save config
  - [ ] Verify token available (call auth.getToken())
  - [ ] Print confirmation or warning
- [ ] Error handling:
  - [ ] Invalid method → list valid options
  - [ ] Token unavailable after switch → show warning with fix

---

## Config System Updates

- [ ] Extend Config type:
  - [ ] Add auth.method: AuthMethod
  - [ ] Keep auth.openai_api_key, auth.anthropic_api_key
- [ ] Update config loader:
  - [ ] Read auth.method field
  - [ ] Provide default if missing (openai-api-key)
- [ ] Update config writer:
  - [ ] Save auth.method
  - [ ] Preserve existing API keys
- [ ] Validation:
  - [ ] Method is valid value
  - [ ] No validation of provider match here (AuthManager handles)

---

## Claude OAuth Implementation

- [ ] Create `src/core/auth/claude-oauth.ts` (or add to auth-manager.ts)
- [ ] Implement getClaudeOAuthToken():
  - [ ] Define possible paths array
  - [ ] Loop through paths, try keyring.readToken() for each
  - [ ] Return first successful read
  - [ ] If all fail, throw with paths listed
- [ ] Token parsing:
  - [ ] Read JSON file
  - [ ] Extract access_token field (or equivalent)
  - [ ] Handle malformed JSON gracefully
- [ ] Document actual path found in DECISIONS.md

---

## Mocked-Service Tests (TDD)

- [ ] Create `tests/mocked-service/phase-4-auth-methods.test.ts`
- [ ] Create mock implementations:
  - [ ] tests/mocks/keyring.ts (createMockKeyring)
  - [ ] Test helper: createTestConfig(method, keys)

### Token Retrieval Suite

- [ ] Test 1: OpenAI API key retrieval
- [ ] Test 2: Anthropic API key retrieval
- [ ] Test 3: ChatGPT OAuth token retrieval
- [ ] Test 4: Claude OAuth token retrieval

### Error Cases Suite

- [ ] Test 5: Missing API key error
- [ ] Test 6: Missing ChatGPT OAuth token error
- [ ] Test 7: Missing Claude OAuth token error (all paths fail)
- [ ] Test 8: Provider mismatch (ChatGPT OAuth + Anthropic)
- [ ] Test 9: Provider mismatch (Claude OAuth + OpenAI)

### CLI Commands Suite

- [ ] Test 10: set-auth updates config
- [ ] Test 11: set-auth validates method name
- [ ] Test 12: set-auth prompts for API key (mock stdin)
- [ ] Test 13: login displays status

### OAuth × API Validation Suite

- [ ] Test 14: ChatGPT OAuth + Responses API (valid)
- [ ] Test 15: ChatGPT OAuth + Chat API (valid)
- [ ] Test 16: Claude OAuth + Messages API (valid)
- [ ] Test 17: ChatGPT OAuth + Messages API (invalid - wrong provider)
- [ ] Test 18: Claude OAuth + Responses API (invalid - wrong provider)

- [ ] All 18 tests passing
- [ ] Tests run fast (<2 seconds)
- [ ] No skipped tests

---

## Manual Verification

**Follow manual-test-script.md:**
- [ ] Test API key auth (both providers)
- [ ] Test ChatGPT OAuth (if real token available)
- [ ] Test Claude OAuth (if real token available)
- [ ] Test auth method switching
- [ ] Test login command output
- [ ] Test error cases (missing tokens, invalid methods)

---

## Quality Gates

- [ ] Run: `npm run format` → no changes
- [ ] Run: `npm run lint` → 0 errors
- [ ] Run: `npx tsc --noEmit` → 0 errors
- [ ] Run: `npm test` → all passing (1,876+ baseline + 18 new)
- [ ] Combined: All checks in sequence

---

## Code Review

- [ ] Stage 1 (Traditional): Token security (no logs), keyring safety, error handling, CLI UX
- [ ] Stage 2 (Port Validation): Auth patterns match Phase 5, OAuth × API validation enforced

---

**All checks ✓ → Phase 4 test conditions complete**
