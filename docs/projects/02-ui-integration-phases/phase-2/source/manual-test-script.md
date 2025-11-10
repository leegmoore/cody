# Phase 2: Manual Test Script

**Purpose:** Verify tool execution and approval flow through actual CLI usage
**Prerequisites:** Phase 2 code complete, Phase 1 working, all automated tests passing
**Duration:** ~5-10 minutes

---

## Setup

1. Ensure Phase 1 works (can create conversation and chat)

2. Have test file ready:
   ```bash
   echo "test content" > /tmp/test-file.txt
   ```

3. CLI built and available:
   ```bash
   cd codex-ts
   npm run build
   cody new  # Create conversation for testing
   ```

---

## Test 1: Tool Approval - Approve Case

**Execute:**
```bash
cody chat "Read the file at /tmp/test-file.txt"
```

**Expected interaction:**
```
🔧 Tool: readFile
   Args: {"filePath": "/tmp/test-file.txt"}
Approve? (y/n): y

✓ Result: test content
Assistant: Here is the content of the file...

**Verify:**
- ✅ Tool call displayed (tool name, args shown)
- ✅ Approval prompt appeared
- ✅ User entered 'y'
- ✅ Tool executed (file content shown)
- ✅ Model responded (may summarize file or acknowledge)

**If fails:** Check approval.ts exists. Verify ToolRegistry has tools. Check tool handlers wired.

---

## Test 2: Tool Approval - Deny Case

**Execute:**
```bash
cody chat "Run npm test in this directory"
```

**Expected interaction:**
```
🔧 Tool: exec
   Args: {"command": ["npm", "test"]}
Approve? (y/n): n

❌ Tool execution denied

Assistant: I understand you don't want me to run that command.
```

**Verify:**
- ✅ Tool call displayed
- ✅ Approval prompt appeared
- ✅ User entered 'n'
- ✅ Tool did NOT execute
- ✅ Denial message shown
- ✅ Model received denial, responded gracefully

---

## Test 3: Multiple Tools in One Conversation

**Execute:**
```bash
cody chat "Read /tmp/test-file.txt then tell me what you found"
```
(Approve when prompted)

**Then:**
```bash
cody chat "Now list files in /tmp directory"
```
(Approve when prompted)

**Verify:**
- ✅ First tool (readFile) executed
- ✅ Model saw first result, responded
- ✅ Second tool (listDir) executed
- ✅ Model saw second result, responded
- ✅ Both tool results influenced model responses

---

## Test 4: Error Handling - Tool Execution Fails

**Execute:**
```bash
cody chat "Read a file that does not exist: /tmp/nonexistent.txt"
```
(Approve when prompted)

**Expected:**
```
🔧 Tool: readFile
Approve? (y/n): y

❌ Error: File not found

Assistant: I couldn't read that file because it doesn't exist.
```

**Verify:**
- ✅ Tool attempted
- ✅ Error captured and returned
- ✅ CLI didn't crash
- ✅ Model received error message
- ✅ Model handled gracefully

---

## Success Checklist

After completing all tests:

- [ ] Test 1: Tool approval (approve) works
- [ ] Test 2: Tool approval (deny) works
- [ ] Test 3: Multiple tools in sequence work
- [ ] Test 4: Tool errors handled gracefully

**All tests pass:** Phase 2 functional requirements verified.

**Any test fails:** Document failure, investigate, fix before phase complete.

---

## Notes

**UX observations:**
- Is approval prompt clear?
- Are tool calls easy to understand?
- Do results display well?
- Any improvements for Phase 7 (Polish)?

User experience feedback helps refine UX in later phases.
