# Phase 4: Authentication Expansion – Task Checklist

**Status:** In Progress
**Estimated Code:** ~350 lines (CLI 110, auth layer 80, mocked tests 160)

---

## Setup & Planning

- [x] Review Phase 3 implementation (provider switching works)
- [x] Read TECH-APPROACH Section 5 (Phase 4 technical approach)
- [x] Read phase-4/source/design.md (implementation details)
- [x] Inspect ported AuthManager: `codex-ts/src/core/auth/index.ts`
- [x] Inspect KeyringStore: `codex-ts/src/core/keyring-store/index.ts`
- [x] Check for existing ChatGPT OAuth implementation (Phase 5 port)

---

## AuthManager Enhancements

### Type Definitions

- [x] Define AuthMethod type (union of 4 method strings)
- [x] Update AuthConfig interface to include method field
- [x] Export types for CLI usage

### Token Retrieval Logic

- [x] Implement getToken(provider) method:
  - [x] Check configured auth method
  - [x] Route to appropriate retrieval function
  - [x] Validate provider matches method (OAuth constraint)
  - [x] Return token string
- [x] Implement getApiKey(provider) helper:
  - [x] Read from config.auth[`${provider}_api_key`]
  - [x] Throw AuthError if missing
- [x] Implement getChatGPTOAuthToken() helper:
  - [x] Call keyring.readToken('~/.cody/oauth/chatgpt.json')
  - [x] Parse JSON, extract access_token
  - [x] Throw AuthError if missing
- [x] Implement getClaudeOAuthToken() helper (NEW):
  - [x] Try multiple paths (3 possible locations)
  - [x] Return first successful read
  - [x] Throw AuthError if all fail, list paths tried

### Method Management

- [x] Implement getSelectedMethod():
  - [x] Return config.auth.method
  - [x] Provide default if missing (openai-api-key)
- [x] Implement setMethod(method):
  - [x] Validate method is one of four valid values
  - [x] Update config
  - [x] Save config file

### Error Handling

- [x] All errors are AuthError type with helpful messages
- [x] Missing token errors suggest how to fix
- [x] Provider mismatch errors explain constraint
- [x] Document error message templates in code comments

---

## CLI Commands

### login Command

- [x] Create `src/cli/commands/login.ts`
- [x] Implement command:
  - [x] Load config and create AuthManager
  - [x] Get current method
  - [x] For each of 4 methods, check if token available
  - [x] Display table: method name, status (✓/✗), current marker (→)
  - [x] For missing tokens, show help text
- [x] Format output:
  - [x] Clear visual hierarchy
  - [x] Current method obvious
  - [x] Help text actionable

### set-auth Command

- [x] Create `src/cli/commands/set-auth.ts`
- [x] Implement command:
  - [x] Accept method argument
  - [x] Validate method name (one of four valid)
  - [x] Load config
  - [x] Update auth.method
  - [x] If API key method and key missing, prompt user
  - [x] Save config
  - [x] Verify token available (call auth.getToken())
  - [x] Print confirmation or warning
- [x] Error handling:
  - [x] Invalid method → list valid options
  - [x] Token unavailable after switch → show warning with fix

---

## Config System Updates

- [x] Extend Config type:
  - [x] Add auth.method: AuthMethod
  - [x] Keep auth.openai_api_key, auth.anthropic_api_key
- [x] Update config loader:
  - [x] Read auth.method field
  - [x] Provide default if missing (openai-api-key)
- [x] Update config writer:
  - [x] Save auth.method
  - [x] Preserve existing API keys
- [x] Validation:
  - [x] Method is valid value
  - [x] No validation of provider match here (AuthManager handles)

---

## Claude OAuth Implementation

- [x] Create `src/core/auth/claude-oauth.ts` (or add to auth-manager.ts)
- [x] Implement getClaudeOAuthToken():
  - [x] Define possible paths array
  - [x] Loop through paths, try keyring.readToken() for each
  - [x] Return first successful read
  - [x] If all fail, throw with paths listed
- [x] Token parsing:
  - [x] Read JSON file
  - [x] Extract access_token field (or equivalent)
  - [x] Handle malformed JSON gracefully
- [x] Document actual path found in DECISIONS.md

---

## Mocked-Service Tests (TDD)

- [x] Create `tests/mocked-service/phase-4-auth-methods.test.ts`
- [x] Create mock implementations:
  - [x] Stub token readers via AuthManagerOptions overrides
  - [x] Test helper: createTestConfig(method, keys)

### Token Retrieval Suite

- [x] Test 1: OpenAI API key retrieval
- [x] Test 2: Anthropic API key retrieval
- [x] Test 3: ChatGPT OAuth token retrieval
- [x] Test 4: Claude OAuth token retrieval

### Error Cases Suite

- [x] Test 5: Missing API key error
- [x] Test 6: Missing ChatGPT OAuth token error
- [x] Test 7: Missing Claude OAuth token error (all paths fail)
- [x] Test 8: Provider mismatch (ChatGPT OAuth + Anthropic)
- [x] Test 9: Provider mismatch (Claude OAuth + OpenAI)

### CLI Commands Suite

- [x] Skeleton tests exercise login/set-auth wiring

### OAuth × API Validation Suite

- [x] Initial mocked-service test for valid ChatGPT OAuth + OpenAI Responses
- [x] Initial mocked-service test for invalid ChatGPT OAuth + Anthropic provider

- [x] New tests passing
- [x] Tests run fast (<2 seconds)
- [x] No skipped tests

---

## Manual Verification

**Follow manual-test-script.md:**
- [x] Test API key auth (both providers)
- [x] Test ChatGPT OAuth (if real token available)
- [x] Test Claude OAuth (if real token available)
- [x] Test auth method switching
- [x] Test login command output
- [x] Test error cases (missing tokens, invalid methods)

---

## Quality Gates

- [x] Run: `npm run format` → no changes
- [x] Run: `npm run lint` → 0 errors
- [x] Run: `npx tsc --noEmit` → 0 errors
- [x] Run: `npm test` → all passing (1,876+ baseline + 18 new)
- [x] Combined: All checks in sequence

---

## Code Review

- [ ] Stage 1 (Traditional): Token security (no logs), keyring safety, error handling, CLI UX
- [ ] Stage 2 (Port Validation): Auth patterns match Phase 5, OAuth × API validation enforced

---

**All checks ✓ → Phase 4 test conditions complete**
