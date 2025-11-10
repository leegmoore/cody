# Phase 4: Manual Test Script

**Goal:** Verify all four authentication methods work correctly and OAuth × provider validation enforced

**Prerequisites:**
- Phase 3 complete (provider switching works)
- API keys available (OpenAI, Anthropic)
- Optional: Real OAuth tokens (ChatGPT, Claude) for full validation

---

## Setup

**1. Verify API keys:**
```bash
# Check keys in config
cat ~/.cody/config.toml
# Should have openai_api_key and anthropic_api_key

# Or check environment
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY
```

**2. Check OAuth token availability (optional):**
```bash
# ChatGPT token
ls ~/.cody/oauth/chatgpt.json

# Claude token  
ls ~/.claude/credentials.json
# (Path may vary - check ~/.claude/config/, ~/.config/claude/)
```

---

## Test 1: OpenAI API Key Auth

**Objective:** Verify API key auth works with OpenAI providers

**Steps:**
1. Set auth method:
   ```bash
   cody set-auth openai-api-key
   ```
   **Expected:** Prints "✓ Auth method set to openai-api-key"

2. Verify status:
   ```bash
   cody login
   ```
   **Expected:**
   - Shows → openai-api-key (current)
   - Shows ✓ next to openai-api-key (token available)

3. Test with Responses API:
   ```bash
   cody set-provider openai --api responses
   cody new
   cody chat "test message"
   ```
   **Expected:** Conversation works, response received

4. Test with Chat API:
   ```bash
   cody set-api chat
   cody new
   cody chat "test message"
   ```
   **Expected:** Conversation works (API key works with both OpenAI APIs)

**Success criteria:**
- [ ] Auth method set successfully
- [ ] Token available (login shows ✓)
- [ ] Works with Responses API
- [ ] Works with Chat API

---

## Test 2: Anthropic API Key Auth

**Objective:** Verify API key auth works with Anthropic

**Steps:**
1. Set auth method:
   ```bash
   cody set-auth anthropic-api-key
   ```
   **Expected:** Prints "✓ Auth method set to anthropic-api-key"

2. Verify status:
   ```bash
   cody login
   ```
   **Expected:**
   - Shows → anthropic-api-key (current)
   - Shows ✓ next to anthropic-api-key

3. Test with Messages API:
   ```bash
   cody set-provider anthropic --api messages
   cody new
   cody chat "test message"
   ```
   **Expected:** Conversation works, Claude responds

**Success criteria:**
- [ ] Auth method set successfully
- [ ] Token available
- [ ] Works with Messages API

---

## Test 3: ChatGPT OAuth (If Available)

**Objective:** Verify ChatGPT OAuth token retrieval and usage

**Prerequisites:** Logged into ChatGPT Pro CLI (token in ~/.cody)

**Steps:**
1. Set auth method:
   ```bash
   cody set-auth oauth-chatgpt
   ```
   **Expected:** Prints "✓ Auth method set to oauth-chatgpt", "✓ Token available for openai"

2. Verify status:
   ```bash
   cody login
   ```
   **Expected:**
   - Shows → oauth-chatgpt (current)
   - Shows ✓ next to oauth-chatgpt (token found in keyring)

3. Test with Responses API:
   ```bash
   cody set-provider openai --api responses
   cody new
   cody chat "test message"
   ```
   **Expected:** Conversation works using OAuth token

4. Test with Chat API:
   ```bash
   cody set-api chat
   cody new
   cody chat "test message"
   ```
   **Expected:** Conversation works (OAuth valid for both OpenAI APIs)

**Success criteria:**
- [ ] OAuth token retrieved from keyring
- [ ] Works with Responses API
- [ ] Works with Chat API
- [ ] No errors

**If token not available:** Skip this test, verify error message is helpful:
```bash
cody set-auth oauth-chatgpt
cody new
# Should error with: "ChatGPT OAuth token not found. Log in via ChatGPT Pro CLI..."
```

---

## Test 4: Claude OAuth (If Available)

**Objective:** Verify Claude OAuth token retrieval and usage

**Prerequisites:** Logged into Claude Code (token in ~/.claude)

**Steps:**
1. Set auth method:
   ```bash
   cody set-auth oauth-claude
   ```
   **Expected:** Prints "✓ Auth method set to oauth-claude", "✓ Token available for anthropic"

2. Verify status:
   ```bash
   cody login
   ```
   **Expected:**
   - Shows → oauth-claude (current)
   - Shows ✓ next to oauth-claude (token found)

3. Test with Messages API:
   ```bash
   cody set-provider anthropic --api messages
   cody new
   cody chat "test message"
   ```
   **Expected:** Conversation works using Claude OAuth token

**Success criteria:**
- [ ] OAuth token retrieved from keyring
- [ ] Works with Messages API
- [ ] No errors

**If token not available:** Verify error message:
```bash
cody set-auth oauth-claude
cody new
# Should error with: "Claude OAuth token not found. Searched: [paths]. Log in via Claude Code..."
```

---

## Test 5: Auth Method Switching

**Objective:** Verify can switch between methods seamlessly

**Steps:**
1. Start with API key:
   ```bash
   cody set-auth openai-api-key
   cody set-provider openai --api responses
   cody new
   cody chat "test 1"
   ```
   **Expected:** Works

2. Switch to OAuth (if available):
   ```bash
   cody set-auth oauth-chatgpt
   cody new
   cody chat "test 2"
   ```
   **Expected:** Works with OAuth token

3. Switch back to API key:
   ```bash
   cody set-auth openai-api-key
   cody new
   cody chat "test 3"
   ```
   **Expected:** Works with API key again

4. Switch providers and auth together:
   ```bash
   cody set-provider anthropic --api messages
   cody set-auth anthropic-api-key
   cody new
   cody chat "test 4"
   ```
   **Expected:** Works with Anthropic API key

**Success criteria:**
- [ ] Can switch between methods
- [ ] Each method works after switch
- [ ] Config persists across switches
- [ ] No state corruption

---

## Test 6: OAuth × Provider Validation

**Objective:** Verify OAuth methods only work with correct providers

**Test 6a: ChatGPT OAuth + OpenAI (Valid)**
```bash
cody set-auth oauth-chatgpt
cody set-provider openai --api responses
cody new
cody chat "test"
```
**Expected:** Works (ChatGPT OAuth valid for OpenAI)

**Test 6b: ChatGPT OAuth + Anthropic (Invalid)**
```bash
cody set-auth oauth-chatgpt
cody set-provider anthropic --api messages
cody new
```
**Expected:** 
- Error: "ChatGPT OAuth can only be used with OpenAI providers"
- Suggests: "Switch to OpenAI: cody set-provider openai"
- No conversation created

**Test 6c: Claude OAuth + Anthropic (Valid)**
```bash
cody set-auth oauth-claude
cody set-provider anthropic --api messages
cody new
cody chat "test"
```
**Expected:** Works (Claude OAuth valid for Anthropic)

**Test 6d: Claude OAuth + OpenAI (Invalid)**
```bash
cody set-auth oauth-claude
cody set-provider openai --api responses
cody new
```
**Expected:**
- Error: "Claude OAuth can only be used with Anthropic providers"
- Suggests: "Switch to Anthropic: cody set-provider anthropic"
- No conversation created

**Success criteria:**
- [ ] Valid combinations work
- [ ] Invalid combinations rejected before API call
- [ ] Error messages explain constraint
- [ ] Suggestions actionable

---

## Test 7: Missing Token Error Handling

**Objective:** Verify clear errors when tokens missing

**Test 7a: Missing API Key**
```bash
# Temporarily remove key from config
# Edit ~/.cody/config.toml, delete openai_api_key line

cody set-auth openai-api-key
cody set-provider openai --api responses
cody new
```
**Expected:**
- Error: "Missing API key for openai"
- Shows: "Set in config: [auth]\nopenai_api_key = \"...\""
- Or: "Run: cody set-auth openai-api-key" (triggers prompt)

**Test 7b: Missing OAuth Token**
```bash
# If you don't have real OAuth tokens, this is the normal case
cody set-auth oauth-chatgpt
cody new
```
**Expected:**
- Error: "ChatGPT OAuth token not found at ~/.cody/oauth/chatgpt.json"
- Suggests: "Log in via ChatGPT Pro CLI to refresh token"
- Alternative: "Or switch to API key: cody set-auth openai-api-key"

**Restore config after test**

**Success criteria:**
- [ ] Missing tokens detected
- [ ] Error messages clear
- [ ] Suggestions actionable (which app to log into, or use API key instead)

---

## Test 8: login Command Output

**Objective:** Verify login command provides useful status overview

**Steps:**
1. Run with mixed availability:
   ```bash
   # Assume API keys set, OAuth tokens not available
   cody login
   ```
   
   **Expected output:**
   ```
   Authentication Status:
   
   Current method: openai-api-key
   
   Available methods:
   
   → ✓ openai-api-key
   ✗ anthropic-api-key
      Set in config: [auth]
      anthropic_api_key = "..."
   
     ✗ oauth-chatgpt
      Log in via ChatGPT Pro CLI to refresh
   
     ✗ oauth-claude
      Log in via Claude Code to refresh
   ```

2. Verify visual clarity:
   - Current method has arrow (→)
   - Available methods have checkmark (✓)
   - Missing methods have X (✗) and help text
   - Easy to understand at a glance

**Success criteria:**
- [ ] Shows all four methods
- [ ] Status indicators clear (✓/✗)
- [ ] Current method highlighted (→)
- [ ] Help text for missing tokens
- [ ] Output is readable and actionable

---

## Success Checklist

**Functional verification:**
- [ ] OpenAI API key auth works (tested with Responses + Chat)
- [ ] Anthropic API key auth works (tested with Messages)
- [ ] ChatGPT OAuth works with OpenAI (if token available)
- [ ] Claude OAuth works with Anthropic (if token available)
- [ ] Auth method switching persists
- [ ] login command shows useful status
- [ ] OAuth × provider validation enforced (invalid combos rejected)
- [ ] Missing token errors clear and actionable

**Quality verification:**
- [ ] All mocked-service tests passing (18 tests)
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 errors
- [ ] Format: clean
- [ ] Combined: All checks pass

**Code review:**
- [ ] Stage 1 complete (security, errors, UX)
- [ ] Stage 2 complete (port validation, OAuth constraints)

---

**All checks ✓ → Phase 4 functional verification complete**

**Next:** Commit changes, update project logs, proceed to Phase 5
