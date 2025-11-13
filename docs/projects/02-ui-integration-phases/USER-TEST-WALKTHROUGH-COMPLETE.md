# Cody CLI - Phase 1 & 2 User Test Walkthrough

**Purpose:** This document guides you through comprehensive testing of the Cody CLI after Phase 1 (Basic Chat) and Phase 2 (Tool Integration) implementation.

**Who This Is For:** Someone with high-level understanding of the Codex project but no detailed knowledge of the CLI interface.

**What You'll Learn:**
- How to set up and configure Cody
- How the command structure works
- The interactive REPL mode vs batch commands
- Tool execution and approval flow
- Event-driven conversation patterns
- Error handling and edge cases

**Time Required:** 30-45 minutes

---

## 0. Prerequisites & Setup

### 0.1 Verify Installation

First, check that the `cody` command is available:

```bash
cody --help
```

**Expected output:**
```
Usage: cody [options] [command]

Cody CLI

Options:
  -h, --help         display help for command

Commands:
  new                Create a new conversation (starts REPL)
  chat <message...>  Send a message (starts REPL)
  repl               Start an interactive Cody session
  help [command]     display help for command
```

If you see "command not found", you need to build and link the CLI:

```bash
cd /Users/leemoore/code/codex-port-02/codex-ts
npm run build
npm link
```

This creates a global `cody` command pointing to the compiled TypeScript.

### 0.2 Understanding the Architecture

**High-Level Structure:**

```
User Input (CLI)
    ↓
Commands (new, chat, repl)
    ↓
REPL Loop (interactive session)
    ↓
ConversationManager (orchestration)
    ↓
Codex Core (conversation engine)
    ↓
ModelClient (OpenAI/Anthropic APIs)
    ↓
Event Loop (streaming responses)
    ↓
Display (render to console)
```

**Key Concepts:**

1. **Conversations:** Each conversation has a unique ID and maintains its own history
2. **Active Conversation:** Only one conversation is "active" at a time in the REPL
3. **Events:** The system is event-driven - you submit messages and receive events back
4. **Tools:** The model can request tools (like reading files or executing commands)
5. **Approval Flow:** Dangerous tools require user approval before execution

### 0.3 Configuration

Cody looks for configuration at `~/.codex/config.toml`. For Phase 1-2 testing, the CLI uses sensible defaults:

- **Provider:** OpenAI
- **API:** Responses API
- **Model:** gpt-4 (or whatever is in OPENAI_DEFAULT_MODEL)
- **Auth:** API key from environment variable

Check your API key is set:

```bash
echo $OPENAI_API_KEY
```

If empty, set it:

```bash
export OPENAI_API_KEY="sk-your-key-here"
```

Or add to `codex-ts/.env`:

```
OPENAI_API_KEY=sk-your-key-here
```

---

## 1. Basic CLI Commands (Phase 1)

### 1.1 Understanding Command Structure

Cody has three main commands:

1. **`cody new`** - Create new conversation and enter REPL
2. **`cody chat <message>`** - Send a message (creates conversation if needed) and enter REPL
3. **`cody repl`** - Start interactive session with existing conversation

**Important:** All three commands enter the **REPL** (Read-Eval-Print Loop), an interactive mode where you can issue multiple commands without restarting the CLI.

### 1.2 Test 1: Starting a New Conversation

**Objective:** Create a conversation and understand the REPL

```bash
cody new
```

**Expected output:**
```
Cody REPL. Type 'help' for commands.
Created conversation: <UUID>
cody>
```

**What happened:**
1. Cody started the REPL
2. Created a new conversation with a unique ID (like `123e4567-e89b-12d3-a456-426614174000`)
3. Set this as the "active" conversation
4. Displayed the `cody>` prompt waiting for your input

**Try this:** Type `help` and press Enter

```
cody> help
```

**Expected output:**
```
Commands:
  new            Create a new conversation
  chat <text>    Send a message to the active conversation
  reset          Clear active conversation
  exit           Leave the REPL
```

**Try this:** Exit the REPL

```
cody> exit
```

You're back at your shell prompt.

**Key Takeaway:** The REPL is an interactive session where you can execute multiple commands. Type `exit` to leave.

### 1.3 Test 2: Sending Your First Message

**Objective:** Send a message and receive a response

Start a new session and send a message:

```bash
cody chat "Hello, can you introduce yourself?"
```

**Expected behavior:**
1. REPL starts
2. If no active conversation exists, one is created automatically
3. Message "Hello, can you introduce yourself?" is sent to the model
4. You see the model's response printed to console
5. REPL prompt returns

**Sample output:**
```
Cody REPL. Type 'help' for commands.
Started new conversation: 123e4567-e89b-12d3-a456-426614174000
Assistant: I'm Claude, an AI assistant created by Anthropic. I'm here to help you with
various tasks like answering questions, writing, analysis, math, coding, and more. How can
I assist you today?
cody>
```

**What's happening internally:**
1. Your message becomes a user turn in the conversation
2. Message sent to OpenAI/Anthropic API
3. API returns events (thinking, response, completion)
4. Display loop processes each event and prints output
5. When task_complete event received, REPL prompt returns

**Try this:** Send another message in the same session

```
cody> chat What's the weather like?
```

The model will respond. Notice you're in the same conversation - it has context from your previous message.

**Try this:** Exit and verify conversation persists (Phase 5 feature, may not be implemented yet)

```
cody> exit
```

### 1.4 Test 3: Multi-Turn Conversation

**Objective:** Verify conversation history is maintained across turns

```bash
cody new
```

Now send a series of messages that require context:

```
cody> chat My name is Alex
Assistant: Nice to meet you, Alex! How can I help you today?

cody> chat What did I just tell you my name was?
Assistant: You told me your name is Alex.

cody> chat If you forget my name, I'll be sad
Assistant: I understand, Alex. I'll remember your name is Alex. I wouldn't want to make
you sad!
```

**What this tests:**
- Each new message includes the full conversation history
- Model sees previous context and can reference it
- The conversation is stateful within a session

**Key Takeaway:** Cody maintains conversation history automatically. Each turn sees all previous turns.

### 1.5 Test 4: REPL Commands

**Objective:** Understand all REPL commands

Start a REPL session:

```bash
cody repl
```

Try each command:

```
cody> new
Created conversation: <UUID>

cody> chat Test message
Assistant: <response>

cody> reset
Cleared active conversation.

cody> chat Another message
Started new conversation: <UUID>
Assistant: <response>

cody> exit
```

**Commands explained:**

- **`new`** - Create a fresh conversation, replaces the active one
- **`chat <text>`** - Send message to active conversation (auto-creates if none)
- **`reset`** - Clear the active conversation (next chat will create new one)
- **`exit`** (or `quit`) - Leave REPL and return to shell

**Edge Case Test:** What happens with no active conversation?

```bash
cody repl
cody> chat Hello
```

Expected: Automatically creates a new conversation first, then sends message.

### 1.6 Test 5: Error Handling

**Objective:** Verify errors are handled gracefully

**Test 5a: Empty message**

```bash
cody repl
cody> chat
Message cannot be empty.
```

**Test 5b: Unknown command**

```
cody> unknown-command
Unknown command. Type 'help' for options.
```

**Test 5c: Invalid API key**

```bash
# Temporarily break your API key
export OPENAI_API_KEY="invalid-key"
cody chat "test"
```

Expected: Error message about authentication failure (exact message depends on implementation).

Don't forget to restore your valid key after testing!

**Key Takeaway:** Errors are caught and displayed clearly without crashing the CLI.

---

## 2. Tool Execution & Approval Flow (Phase 2)

Phase 2 adds the ability for the model to execute tools (reading files, running commands, etc.) with user approval.

### 2.1 Understanding Tools

**What are tools?**
Tools are functions the model can call to interact with your system:
- `readFile` - Read file contents
- `writeFile` - Write to a file
- `exec` - Execute shell commands
- `applyPatch` - Apply code changes
- `glob` - Find files matching patterns
- And more...

**The Approval Flow:**

```
Model requests tool
    ↓
CLI displays tool call
    ↓
CLI prompts: "Approve? (y/n):"
    ↓
User decides (y/n)
    ↓
If approved → Tool executes → Result shown → Result sent to model
If denied → Error sent to model
```

**Safety:** The approval prompt prevents the model from executing arbitrary commands without your knowledge.

### 2.2 Test 6: File Reading Tool

**Setup:** Create a test file

```bash
echo "This is test content" > /tmp/cody-test.txt
```

**Test:** Ask the model to read it

```bash
cody chat "Please read the file at /tmp/cody-test.txt and tell me what it contains"
```

**Expected interaction:**

```
Cody REPL. Type 'help' for commands.
Started new conversation: <UUID>

🔧 Tool: readFile
   Args: {"filePath": "/tmp/cody-test.txt"}
Approve? (y/n): y

✓ Result (call-xxx): This is test content

Assistant: The file contains: "This is test content"

cody>
```

**What happened:**

1. **Model analyzed your request** and determined it needed to read a file
2. **Tool call displayed:** Shows you what tool and arguments the model wants to use
3. **Approval prompt appeared:** CLI asked for your permission
4. **You approved (y):** Tool executed
5. **Result displayed:** Shows the tool's output (✓ for success)
6. **Result sent to model:** Model sees the file contents
7. **Model responds:** Incorporates the tool result into its response

**Key display elements:**

- `🔧 Tool: <name>` - What tool is being called
- `Args: <json>` - What arguments are being passed
- `Approve? (y/n):` - Your decision point
- `✓ Result (<id>): <output>` - Successful execution (✗ for failure)

### 2.3 Test 7: Denying a Tool

**Objective:** Verify denial flow works

```bash
cody chat "Please run the command 'ls -la /tmp'"
```

**Expected interaction:**

```
🔧 Tool: exec
   Args: {
  "command": ["ls", "-la", "/tmp"]
}
Approve? (y/n): n

✗ Result (call-xxx): User denied approval

Assistant: I understand you decided not to approve the command execution. Is there something
else I can help you with?
cody>
```

**What happened:**
1. Model requested exec tool
2. You denied (n)
3. Tool did NOT execute
4. Error result sent to model explaining denial
5. Model gracefully handled the rejection

**Key Takeaway:** You have full control. Denying a tool is safe and the model will adapt.

### 2.4 Test 8: Command Execution Tool

**Objective:** Execute a safe shell command and see output

```bash
cody chat "Run the command echo 'Hello from shell' for me"
```

**Expected interaction:**

```
🔧 Tool: exec
   Args: {
  "command": ["echo", "Hello from shell"]
}
Approve? (y/n): y

✓ Result (call-xxx): Hello from shell

Assistant: The command executed successfully and printed "Hello from shell".
cody>
```

**What this tests:**
- exec tool works
- Command output is captured
- Model receives the stdout
- Simple commands execute quickly

**Try a more complex command:**

```
cody> chat Count how many files are in /tmp
```

Model will likely request `ls /tmp | wc -l` or similar. Approve and verify it works.

### 2.5 Test 9: Multiple Tools in Sequence

**Objective:** Model uses multiple tools to complete a task

**Setup:** Create two test files

```bash
echo "File A content" > /tmp/file-a.txt
echo "File B content" > /tmp/file-b.txt
```

**Test:** Ask for a task requiring multiple steps

```bash
cody chat "Read /tmp/file-a.txt and /tmp/file-b.txt, then tell me if they have the same content"
```

**Expected flow:**

```
🔧 Tool: readFile
   Args: {"filePath": "/tmp/file-a.txt"}
Approve? (y/n): y
✓ Result: File A content

🔧 Tool: readFile
   Args: {"filePath": "/tmp/file-b.txt"}
Approve? (y/n): y
✓ Result: File B content

Assistant: I've read both files. They have different content:
- file-a.txt contains: "File A content"
- file-b.txt contains: "File B content"

cody>
```

**What this tests:**
- Model can request multiple tools
- Each tool is approved separately
- Model sees all results
- Final response incorporates all tool outputs

**Key Insight:** The conversation is a loop. Model thinks → requests tool → sees result → thinks more → requests another tool (or responds).

### 2.6 Test 10: Tool Execution Errors

**Objective:** Verify errors are handled gracefully

**Test 10a: File not found**

```bash
cody chat "Read /tmp/nonexistent-file.txt"
```

**Expected:**
```
🔧 Tool: readFile
   Args: {"filePath": "/tmp/nonexistent-file.txt"}
Approve? (y/n): y

✗ Result (call-xxx): Error: File not found or cannot be read

Assistant: It looks like the file doesn't exist or can't be accessed. The error was:
"File not found or cannot be read".
cody>
```

**Test 10b: Command fails (non-zero exit)**

```bash
cody chat "Run the command: ls /directory-that-does-not-exist"
```

**Expected:**
```
🔧 Tool: exec
Approve? (y/n): y

✗ Result (call-xxx): ls: /directory-that-does-not-exist: No such file or directory
Exit code: 2

Assistant: The command failed with exit code 2. The error message was:
"ls: /directory-that-does-not-exist: No such file or directory"
cody>
```

**What this tests:**
- Tool failures don't crash the CLI
- Error messages are captured and shown
- Model receives error info and can explain it
- Exit codes are reported

**Key Takeaway:** Error handling is robust. Failures are communicated clearly.

---

## 3. Understanding the Event Loop

### 3.1 What Are Events?

Cody uses an **event-driven architecture**. When you send a message, you don't get a single response back. Instead, you get a **stream of events**:

**Event Types:**

1. `task_started` - Turn begins
2. `agent_message` - Complete assistant response 
3. `raw_response_item` - Individual response items (tools, results)
4. `task_complete` - Turn finished
5. `error` - Something went wrong
6. `turn_aborted` - Turn was cancelled

**Why events instead of simple request/response?**

- **Progressive updates:** See tool calls as they happen, not after everything finishes
- **Streaming:** Model responses can stream token-by-token (future feature)
- **Visibility:** Know what's happening during long-running operations
- **Cancellation:** Can interrupt mid-execution (future feature)

### 3.2 Event Flow Example

**When you run:** `cody chat "Read /tmp/test.txt"`

**Event sequence:**

```
[Internal Event] task_started
[Internal Event] raw_response_item (function_call for readFile)
    → CLI displays: 🔧 Tool: readFile
    → CLI prompts: Approve? (y/n):
    → User approves
    → Tool executes
[Internal Event] raw_response_item (function_call_output with result)
    → CLI displays: ✓ Result: ...
[Internal Event] agent_message (model's final response)
    → CLI displays: Assistant: ...
[Internal Event] task_complete
    → CLI returns to cody> prompt
```

**The display loop:**

```typescript
// Simplified from display.ts
while (!done) {
  const event = await conversation.nextEvent();
  
  if (event.type === "raw_response_item") {
    // Tool call or result - display it
  }
  else if (event.type === "agent_message") {
    // Final response - print it
  }
  else if (event.type === "task_complete") {
    done = true; // Exit loop
  }
}
```

**Key Insight:** The REPL is just looping on `nextEvent()` until `task_complete`. Each event type triggers different display behavior.

---

## 4. Batch vs Interactive Modes

### 4.1 Understanding the Modes

**All commands enter REPL**, but they differ in initial behavior:

**Mode 1: Direct REPL**
```bash
cody repl
```
- Starts REPL immediately
- No automatic actions
- You must type commands

**Mode 2: Pre-Bootstrapped REPL (new)**
```bash
cody new
```
- Starts REPL
- Automatically runs `new` command first
- Then waits for more commands

**Mode 3: Pre-Bootstrapped REPL (chat)**
```bash
cody chat "Hello"
```
- Starts REPL
- Automatically runs `chat Hello` first
- Then waits for more commands

**They all end up in the same REPL**. The difference is just what happens automatically first.

### 4.2 When to Use Each

**Use `cody repl`:**
- You want to run multiple commands in a session
- You're exploring and experimenting
- You don't have a specific first message in mind

**Use `cody new`:**
- You want to start fresh
- Clear that you're beginning a new conversation
- Explicit about creating new context

**Use `cody chat "message"`:**
- You have a specific question/task
- One-liner from shell scripts (though it enters REPL after)
- Quick interactions

**Future:** A true "one-shot" mode may be added where `cody chat "message"` sends the message and exits without entering REPL. For now, all commands enter REPL.

---

## 5. Advanced Scenarios

### 5.1 Long Conversations

**Test:** Have a conversation with 10+ turns

```bash
cody new
cody> chat Tell me a story about a robot
Assistant: <story>

cody> chat What was the robot's name?
Assistant: <recalls name from story>

cody> chat Give the robot a friend
Assistant: <adds friend to story>

... continue for 10 turns ...
```

**What to observe:**
- Response times (do they slow down with longer history?)
- Context maintenance (does model remember early details?)
- Any errors or truncation

**Expected behavior (Phase 1-2):**
- Full history sent every turn
- May hit token limits on very long conversations
- No automatic summarization yet (Phase 5 feature)

### 5.2 Complex Tool Chains

**Test:** Multi-step task requiring reasoning

```bash
echo "TODO: write tests" > /tmp/todo.txt
cody chat "Read /tmp/todo.txt, then create a file /tmp/done.txt that says the task is complete"
```

**Expected flow:**
1. Model reads todo.txt
2. Sees "TODO: write tests"
3. Requests writeFile to create done.txt
4. Confirms task done

**What this tests:**
- Model can plan multi-step tasks
- Tool results inform next steps
- File operations work correctly

### 5.3 Error Recovery

**Test:** How does the model handle tool failures?

```bash
cody chat "Read /tmp/missing-file.txt and if it doesn't exist, create it with content 'Hello'"
```

**Expected:**
1. Model tries readFile → fails
2. Model adapts: requests writeFile instead
3. Creates the file
4. Confirms success

**What this tests:**
- Model can recover from errors
- Doesn't get stuck repeating failed operations
- Uses error info to adjust strategy

---

## 6. Troubleshooting

### 6.1 Common Issues

**Issue: "command not found: cody"**

**Solution:**
```bash
cd codex-ts
npm run build
npm link
```

**Issue: REPL starts but commands don't work**

**Check:**
- Is OPENAI_API_KEY set? `echo $OPENAI_API_KEY`
- Is .env file present? `ls codex-ts/.env`
- Are there TypeScript errors? `cd codex-ts && npx tsc --noEmit`

**Issue: "Error: Configuration error"**

**Check:**
- Config file location: `ls ~/.codex/config.toml`
- Config file format (valid TOML)
- Required fields present

**Issue: Approval prompt doesn't appear**

**Possible causes:**
- Model didn't request a tool (not all queries need tools)
- Tool doesn't require approval (most do, but some future tools might not)
- Display bug (check display.ts implementation)

**Issue: Tool executes but no output**

**Check:**
- Tool actually ran? (check file system changes)
- Output captured? (exec returns stdout/stderr)
- Display rendering working? (console.log statements visible?)

### 6.2 Debug Tips

**Enable verbose logging** (if implemented):
```bash
DEBUG=* cody chat "test"
```

**Check what events are being emitted:**
Add console.log in display.ts handleEvent() to see all events.

**Test with minimal conversation:**
Start fresh each time to isolate issues:
```bash
cody new
cody> chat simple test
```

**Check network:**
```bash
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"
```

Should return list of models. If error → API key issue.

---

## 7. Summary & Checklist

### 7.1 What You've Tested

By completing this walkthrough, you've verified:

**Phase 1 (Basic Chat):**
- ✅ CLI installation and setup
- ✅ REPL interactive mode
- ✅ Conversation creation (`new` command)
- ✅ Message sending (`chat` command)
- ✅ Multi-turn conversations with history
- ✅ REPL commands (new, chat, reset, exit)
- ✅ Error handling (empty messages, unknown commands, bad API keys)

**Phase 2 (Tool Execution):**
- ✅ Tool approval flow (approve and deny)
- ✅ File reading (readFile tool)
- ✅ Command execution (exec tool)
- ✅ Multiple tools in sequence
- ✅ Tool execution errors (file not found, command failures)
- ✅ Tool result display (✓ and ✗ indicators)

**Understanding:**
- ✅ Event-driven architecture
- ✅ Batch vs interactive modes
- ✅ Safety through approval prompts
- ✅ How conversation history works

### 7.2 Known Limitations (Phase 1-2)

**Not Yet Implemented:**

- **No persistence** - Conversations don't save to disk yet (Phase 5)
- **Single provider only** - Only OpenAI Responses API works (Phase 3 adds more)
- **Single auth method** - Only API keys (Phase 4 adds OAuth)
- **No streaming display** - Responses appear all at once (Phase 3 option)
- **No conversation list** - Can't see or resume past conversations (Phase 5)
- **No Rich UI** - Plain text only (Phase 7/8 optional enhancement)
- **Limited tool set** - Basic tools only, no web search or advanced features

**Intentional Design:**

- **All commands enter REPL** - No true one-shot mode yet
- **No auto-approval** - Safety first, all dangerous tools require approval
- **Full history every turn** - No compression yet, may hit token limits on very long chats

### 7.3 What's Coming Next

**Phase 3: Multi-Provider Support**
- OpenAI Chat Completions API
- Anthropic Messages API  
- Provider switching commands
- Test same conversation on different providers

**Phase 4: Authentication Expansion**
- ChatGPT OAuth tokens
- Claude OAuth tokens
- Auth method switching

**Phase 5: Persistence & Resume**
- Save conversations to JSONL
- List saved conversations
- Resume with full history
- History compression (auto-summarization)

**Phase 6: Library API Definition**
- Document @openai/codex-core exports
- Usage examples
- Developer documentation

**Future Projects:**
- Script-based tools (Phase 03)
- Memory gradient system (Phase 04)
- Offline processing (Phase 05)
- Turn preprocessing (Phase 06)

### 7.4 Reporting Issues

If you encounter bugs or unexpected behavior:

1. **Note exact steps to reproduce**
   - Commands you ran
   - Exact error messages
   - System info (OS, Node version)

2. **Check if it's a known limitation** (see section 7.2)

3. **Verify setup is correct**
   - API key valid
   - Build successful (npm run build)
   - Link working (which cody)

4. **Document in DECISIONS.md or create GitHub issue** (if project has one)

---

## 8. Quick Reference

### 8.1 Command Cheat Sheet

**Shell commands:**
```bash
cody --help              # Show available commands
cody new                 # Start REPL, create new conversation
cody chat "message"      # Start REPL, send message
cody repl                # Start REPL without action
```

**REPL commands:**
```
new                      # Create new conversation
chat <message>           # Send message to active conversation
reset                    # Clear active conversation
exit (or quit)           # Leave REPL
help                     # Show REPL commands
```

### 8.2 Tool Approval Quick Guide

**When prompt appears:**
```
Approve? (y/n):
```

**Type:**
- `y` or `yes` → Tool executes
- `n` or `no` → Tool blocked
- Anything else → Prompt repeats

**Safety tips:**
- Read the tool name and arguments carefully
- Approve read operations (usually safe)
- Think twice about exec, writeFile, applyPatch
- When in doubt, deny and ask the model to explain first

### 8.3 Keyboard Shortcuts

**In REPL:**
- `Ctrl+C` → Cancel current input (not implemented in error recovery yet)
- `Ctrl+D` → Exit REPL (like typing exit)
- `Up/Down arrows` → Command history (if terminal supports)

### 8.4 Environment Variables

**Required:**
```bash
export OPENAI_API_KEY="sk-..." # Or ANTHROPIC_API_KEY when Phase 3 done
```

**Optional:**
```bash
export DEBUG="*"               # Enable debug logging (if implemented)
```

---

## Appendix: Testing Checklist

Use this checklist to verify all functionality:

### Phase 1 Checklist

- [ ] Can run `cody --help` successfully
- [ ] `cody new` starts REPL and creates conversation
- [ ] `cody chat "test"` sends message and gets response
- [ ] `cody repl` enters interactive mode
- [ ] REPL `help` command shows available commands
- [ ] REPL `new` creates new conversation
- [ ] REPL `chat` sends messages
- [ ] REPL `reset` clears active conversation  
- [ ] REPL `exit` returns to shell
- [ ] Multi-turn conversation maintains context
- [ ] Empty message shows error (doesn't crash)
- [ ] Unknown command shows error (doesn't crash)
- [ ] Invalid API key shows authentication error

### Phase 2 Checklist

- [ ] Model can request readFile tool
- [ ] Approval prompt appears for readFile
- [ ] Approving (y) executes tool and shows result
- [ ] Denying (n) blocks tool and shows denial
- [ ] Model receives tool results and responds
- [ ] Model can request exec tool
- [ ] exec tool executes commands and captures output
- [ ] Model can request multiple tools in sequence
- [ ] Each tool approved independently
- [ ] Tool failures (file not found) handled gracefully
- [ ] Command failures (non-zero exit) handled gracefully
- [ ] Tool display shows 🔧 icon and args clearly
- [ ] Results display shows ✓ for success, ✗ for failure

### Integration Checklist

- [ ] Long conversations (10+ turns) work without issues
- [ ] Complex tool chains (read → analyze → write) work
- [ ] Model can recover from tool failures
- [ ] Error messages are clear and actionable
- [ ] No crashes during normal usage
- [ ] REPL responsive (commands execute promptly)

---

**End of Walkthrough**

**Total Time:** 30-45 minutes for complete testing
**Coverage:** Phase 1 (Basic Chat) + Phase 2 (Tool Integration)
**Next Steps:** Wait for Phase 3-5 implementation, then test those features

**Questions or Issues?** Review Section 6 (Troubleshooting) or Section 7.4 (Reporting Issues).
