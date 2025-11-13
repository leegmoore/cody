# Phase 2.1: Manual Test Script

## Preparation

**Create config:**
```bash
mkdir -p ~/.cody
cat > ~/.cody/config.toml << 'EOF'
model = "gpt-5-codex"
model_reasoning_effort = "low"
approval_policy = "never"
EOF
```

**Rebuild:**
```bash
cd /Users/leemoore/code/codex-port-02/codex-ts
npm run build
```

---

## Test 1: Auto-Approve (No Prompts)

```bash
cody chat "add the number 99 to the end of README.md"
```

**What to observe:**
- ✓ Tool display: `🔧 Tool: applyPatch`
- ✓ No "Approve? (y/n):" prompt
- ✓ Tool executes immediately
- ✓ Result shown: `✓ Result (...): Applied patch`
- ✓ Model confirms completion
- ✓ README.md has "99" appended
- ✓ No timeout/crash

**Failure indicators:**
- ✗ Approval prompt appears
- ✗ CodexInternalAgentDiedError
- ✗ File not modified
- ✗ Timeout after 60s

---

## Test 2: Clean Output

```bash
cody chat "summarize the README" 2>&1 | tee /tmp/output.txt
wc -l /tmp/output.txt
```

**What to observe:**
- Total lines <200 (was 361+)
- No "Submission: { ... }" dumps
- Tool shown once (not twice)
- Tool results visible
- Model response visible
- No unnecessary spam

**Success criteria:**
- ✓ Output focused and readable
- ✓ <200 lines total
- ✓ Single tool display per tool

---

## Test 3: Manual Approval (When Configured)

**Update config:**
```bash
cat > ~/.cody/config.toml << 'EOF'
model = "gpt-5-codex"
approval_policy = "on-request"
EOF
```

**Rebuild and test:**
```bash
npm run build
cody chat "read /etc/hosts"
```

**What to observe:**
- Approval prompt appears
- Type 'y' and press Enter
- Tool executes
- Result shown
- Model responds
- No crash

**Then test denial:**
```bash
cody chat "delete all files"
```

Type 'n' and verify:
- Tool NOT executed
- Model handles denial gracefully

**Success criteria:**
- ✓ Prompts work
- ✓ Approval executes tool
- ✓ Denial blocks tool
- ✓ No timeouts

---

## Success Checklist

- [ ] Test 1 passed (auto-approve works)
- [ ] Test 2 passed (output clean)
- [ ] Test 3 passed (manual approve works)
- [ ] No CodexInternalAgentDiedError
- [ ] Config respected
- [ ] UX improved dramatically
