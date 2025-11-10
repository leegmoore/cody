# Phase 4: Test Conditions

**Test Framework:** Vitest (mocked-service)
**Test File:** `tests/mocked-service/phase-4-auth-methods.test.ts`
**Mocks:** `tests/mocks/keyring.ts`, `tests/mocks/config.ts`

---

## Suite 1: Token Retrieval (All Methods)

### Test 1: OpenAI API Key Retrieval
- **Setup:** Config with auth.method='openai-api-key', auth.openai_api_key='test-key-123'
- **Execute:** authManager.getToken('openai')
- **Verify:** Returns 'test-key-123'

### Test 2: Anthropic API Key Retrieval
- **Setup:** Config with auth.method='anthropic-api-key', auth.anthropic_api_key='test-key-456'
- **Execute:** authManager.getToken('anthropic')
- **Verify:** Returns 'test-key-456'

### Test 3: ChatGPT OAuth Token Retrieval
- **Setup:** Mock keyring with ~/.cody/oauth/chatgpt.json → 'chatgpt-oauth-token', auth.method='oauth-chatgpt'
- **Execute:** authManager.getToken('openai')
- **Verify:** Returns 'chatgpt-oauth-token', keyring.readToken called with correct path

### Test 4: Claude OAuth Token Retrieval
- **Setup:** Mock keyring with ~/.claude/credentials.json → 'claude-oauth-token', auth.method='oauth-claude'
- **Execute:** authManager.getToken('anthropic')
- **Verify:** Returns 'claude-oauth-token', keyring.readToken called

---

## Suite 2: Error Cases

### Test 5: Missing API Key Error
- **Setup:** Config with auth.method='openai-api-key', but openai_api_key field empty
- **Execute:** authManager.getToken('openai')
- **Verify:** Throws AuthError with message "Missing API key for openai", includes how to set it

### Test 6: Missing OAuth Token Error (ChatGPT)
- **Setup:** Mock keyring returns null (file not found), auth.method='oauth-chatgpt'
- **Execute:** authManager.getToken('openai')
- **Verify:** Throws AuthError with message "ChatGPT OAuth token not found", suggests logging into ChatGPT Pro CLI

### Test 7: Missing OAuth Token Error (Claude)
- **Setup:** Mock keyring returns null for all paths, auth.method='oauth-claude'
- **Execute:** authManager.getToken('anthropic')
- **Verify:** Throws AuthError with message "Claude OAuth token not found", lists paths searched, suggests logging into Claude Code

### Test 8: Provider Mismatch (ChatGPT OAuth + Anthropic)
- **Setup:** Mock keyring with ChatGPT token, auth.method='oauth-chatgpt'
- **Execute:** authManager.getToken('anthropic')
- **Verify:** Throws AuthError with message "ChatGPT OAuth can only be used with OpenAI providers"

### Test 9: Provider Mismatch (Claude OAuth + OpenAI)
- **Setup:** Mock keyring with Claude token, auth.method='oauth-claude'
- **Execute:** authManager.getToken('openai')
- **Verify:** Throws AuthError with message "Claude OAuth can only be used with Anthropic providers"

---

## Suite 3: CLI Commands

### Test 10: set-auth Updates Config
- **Setup:** Temp config file with method='openai-api-key'
- **Execute:** Run CLI command `cody set-auth oauth-claude` (use temp config)
- **Verify:** Config file updated, auth.method now 'oauth-claude'

### Test 11: set-auth Validates Method Name
- **Execute:** Run `cody set-auth invalid-method`
- **Verify:** Exit code 1, stderr contains "Invalid auth method", lists valid methods

### Test 12: set-auth Prompts for API Key
- **Setup:** Config with no openai_api_key set
- **Execute:** Run `cody set-auth openai-api-key` (mock stdin to provide key)
- **Verify:** Prompts user for key, saves to config

### Test 13: login Displays Status
- **Setup:** Config with some methods available, some missing
- **Execute:** Run `cody login`
- **Verify:** Stdout shows all four methods, ✓ for available, ✗ for missing, → for current

---

## Suite 4: OAuth × API Validation

**Critical: Verify OAuth methods only work with correct providers**

### Test 14: ChatGPT OAuth + Responses API (Valid)
- **Setup:** Mock keyring with ChatGPT token, config provider=openai api=responses, auth.method='oauth-chatgpt'
- **Execute:** Create conversation, send message
- **Verify:** Works (token retrieved, conversation succeeds)

### Test 15: ChatGPT OAuth + Chat API (Valid)
- **Setup:** Mock keyring with ChatGPT token, config provider=openai api=chat, auth.method='oauth-chatgpt'
- **Execute:** Create conversation, send message
- **Verify:** Works (ChatGPT OAuth valid for all OpenAI APIs)

### Test 16: Claude OAuth + Messages API (Valid)
- **Setup:** Mock keyring with Claude token, config provider=anthropic api=messages, auth.method='oauth-claude'
- **Execute:** Create conversation, send message
- **Verify:** Works (token retrieved, conversation succeeds)

### Test 17: ChatGPT OAuth + Messages API (Invalid - Wrong Provider)
- **Setup:** Mock keyring with ChatGPT token, config provider=anthropic api=messages, auth.method='oauth-chatgpt'
- **Execute:** Attempt to create conversation
- **Verify:** Throws AuthError before API call (provider mismatch caught early)

### Test 18: Claude OAuth + Responses API (Invalid - Wrong Provider)
- **Setup:** Mock keyring with Claude token, config provider=openai api=responses, auth.method='oauth-claude'
- **Execute:** Attempt to create conversation
- **Verify:** Throws AuthError (provider mismatch)

---

## Mock Strategy

**Mock KeyringStore:**
- Returns preset tokens for configured paths
- Returns null to simulate missing tokens
- No actual filesystem access

**Mock Config:**
- Use temp files or in-memory config for CLI command tests
- Avoid touching real ~/.cody/config.toml

**Mock stdin:**
- For set-auth prompting tests, mock readline to provide test input
- Verify prompt text, verify input saved to config

---

## Verification Checklist

**Automated tests pass:**
- [ ] Token retrieval tests: 4 tests (one per method)
- [ ] Error case tests: 5 tests (missing tokens, provider mismatches)
- [ ] CLI command tests: 4 tests (set-auth, login)
- [ ] OAuth × API validation: 5 tests (valid combos, invalid combos)
- [ ] Total: 18 tests, all passing in <2 seconds

**Quality gates:**
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 errors
- [ ] Format: no changes
- [ ] Combined: All checks pass

**Manual verification:**
- [ ] Follow manual-test-script.md
- [ ] Test all 4 auth methods
- [ ] Test OAuth × API validation manually (if real tokens available)

**Code review:**
- [ ] Stage 1: Token security, keyring safety, error messages
- [ ] Stage 2: Auth patterns match Phase 5, OAuth × API validation correct

---

**All checks ✓ → Phase 4 test conditions complete**
