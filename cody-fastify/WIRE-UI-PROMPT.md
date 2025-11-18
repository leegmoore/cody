# Wire Static UI to Fastify Server

## ROLE

You are a TypeScript/JavaScript developer integrating a vanilla JS web UI into an existing Fastify REST API server.

## PRODUCT

**Cody** is an AI coding agent framework with a Fastify REST API backend and web-based chat interface. The API provides conversation management, real-time event streaming (SSE), and tool execution capabilities powered by the Codex TypeScript runtime. The web UI provides a browser-based chat interface for interacting with Codex agents.

## PROJECT CONTEXT

**Project:** Cody Fastify - REST API + Web UI Integration
**Current State:** Fastify REST API is complete and tested (39/56 tests passing). A static HTML/JS chat interface has been created but is not yet served by Fastify and contains mock data instead of real API calls.

**What exists:**
- Complete Fastify REST API at `/api/v1/*` (conversations, messages, turns)
- Redis-backed event streaming for SSE
- Static HTML UI file with all visual components and event handlers built
- Full event consumption and rendering logic in vanilla JavaScript

**What needs to happen:**
- Serve the static UI file from Fastify at the root path (`/`)
- Remove mock data from the UI JavaScript
- Enable real API calls to create conversations and stream events
- Verify the integration works end-to-end

## CURRENT TASK

Wire the existing static HTML UI into Fastify and connect it to the live Codex API. This enables browser-based interaction with Codex agents instead of requiring terminal/CLI usage.

**Functional Outcome:** After this task, a user can navigate to `http://localhost:4010/` in their browser, see a chat interface, send messages to a Codex agent, and receive real-time responses with tool execution visibility—all without using the CLI.

## PREREQUISITES

- ✅ Fastify server implemented (`src/server.ts`)
- ✅ REST API routes functional (`src/api/routes/*`)
- ✅ Redis event streaming working (`src/api/client-stream/*`)
- ✅ Static UI file created (`public/index.html`)
- ✅ Bun runtime available
- ✅ OpenAI API key configured in `.env`

## WORKSPACE

**Location:** `/Users/leemoore/code/codex-port-02/cody-fastify`

**Key Files:**
- `src/server.ts` - Fastify server setup (needs static plugin registration)
- `public/index.html` - Static UI file (needs mock data removed)
- `package.json` - Dependencies (needs @fastify/static added)
- `.env` - Environment variables (already has API keys)

## TASKS

### Task 1: Install Static File Plugin

**Complexity:** TRIVIAL (~1 minute)

Install the @fastify/static plugin:

```bash
cd /Users/leemoore/code/codex-port-02/cody-fastify
bun add @fastify/static
```

Verify installation by checking `package.json` - should see `"@fastify/static"` in dependencies.

### Task 2: Register Static Plugin in Server

**Complexity:** EASY (~10 lines)
**File:** `src/server.ts`

**Step 1:** Add imports at the top of the file (after existing imports):
```typescript
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
```

**Step 2:** Inside the `createServer()` function, add static file serving.

**Exact location:** After the CORS registration (line 19: `await app.register(cors, { origin: "*" });`) and before the health check route (line 32: `app.get("/health", ...)`).

**Code to add:**
```typescript
  // Serve static files from public directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  await app.register(fastifyStatic, {
    root: join(__dirname, "..", "public"),
    prefix: "/"
  });
```

**Why this works:** `__dirname` is the `src/` directory, so `join(__dirname, "..", "public")` points to the `public/` directory at the project root.

**Verification:** Run `bun run dev`, visit `http://localhost:4010/` - should see the UI load.

### Task 3: Remove Mock Data from UI

**Complexity:** MEDIUM (~3 sections to modify)
**File:** `public/index.html`

This task removes all mock/demo data and enables real API calls.

#### 3.1 Clear Mock Conversation History

**Location:** Inside the `<div id="chatHistory">` element (starts around line 254, ends around line 433)

**Current state:** Contains ~180 lines of hardcoded HTML for mock messages, tool cards, and reasoning blocks.

**Action:** Delete everything between the opening and closing tags of `<div id="chatHistory" class="flex-1 overflow-y-auto px-6 py-4 space-y-6">` and replace with:

```html
<div id="chatHistory" class="flex-1 overflow-y-auto px-6 py-4 space-y-6">
    <div class="flex items-center justify-center h-full text-tan-600">
        <div class="text-center">
            <p class="text-lg">Start a conversation</p>
            <p class="text-sm mt-2">Type a message below to begin</p>
        </div>
    </div>
</div>
```

**Result:** Chat history starts empty with a centered "Start a conversation" message.

#### 3.2 Enable Real Conversation Creation

**Location:** The `initializeApp()` function in the `<script>` section (around line 629)

**Current state:** Function sets a mock conversation ID and initializes mock tool calls. Real API code is commented out (lines 652-677).

**Action:** Replace the entire `async function initializeApp() { ... }` function with:

```javascript
async function initializeApp() {
    try {
        const response = await fetch(`${API_BASE}/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                modelProviderId: 'openai',
                modelProviderApi: 'responses',
                model: 'gpt-5-mini'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to create conversation: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        currentConversationId = data.conversationId;
        updateStatus('Connected', 'green');

        console.log('Conversation created:', currentConversationId);
    } catch (error) {
        console.error('Failed to initialize:', error);
        updateStatus('Connection Failed', 'red');
        addSystemMessage('Failed to connect to Cody API. Check console for details.');
    }
}
```

**What this does:**
- Makes a real POST request to create a conversation
- Stores the `conversationId` for subsequent messages
- Updates UI status indicator (green = success, red = failure)
- Logs to console for debugging

#### 3.3 Remove Mock Tool Data

**Location:** The `openToolModal(callId, toolName)` function (around line 980)

**Current state:** Contains a large `mockTools` object (lines ~982-1136) with 7 hardcoded tool call outputs.

**Action:** Delete the entire `mockTools` object and its usage. Replace the entire function with:

```javascript
function openToolModal(callId, toolName) {
    const toolData = toolCallsInProgress[callId];
    if (!toolData) {
        console.warn('Tool data not found for callId:', callId);
        return;
    }

    document.getElementById('modalToolName').textContent = `${toolData.toolName}()`;

    let content = '=== Arguments ===\n';
    content += JSON.stringify(toolData.args, null, 2);
    content += '\n\n=== Output ===\n';

    if (toolData.stdout) {
        content += toolData.stdout;
    }

    if (toolData.stderr) {
        content += '\n\n=== Errors ===\n';
        content += toolData.stderr;
    }

    if (toolData.exitCode !== undefined) {
        content += `\n\nExit Code: ${toolData.exitCode}`;
    } else {
        content += '\n\n(Still executing...)';
    }

    document.getElementById('modalToolContent').textContent = content;
    document.getElementById('toolModal').classList.remove('hidden');
}
```

**What this does:**
- Uses only live tool data from `toolCallsInProgress` (populated by SSE events)
- Displays tool arguments, output (stdout/stderr), and exit code
- Shows "Still executing..." if tool hasn't completed yet

## WORKFLOW

Execute tasks in order:

1. Install @fastify/static plugin
2. Modify `src/server.ts` - add imports and register plugin
3. Test: Run `bun run dev`, visit `http://localhost:4010/`, confirm UI loads
4. Modify `public/index.html` - clear mock history (Task 3.1)
5. Modify `public/index.html` - enable real API calls (Task 3.2)
6. Modify `public/index.html` - remove mock tools (Task 3.3)
7. Test: Restart server, visit UI, send a test message
8. Verify: Message sends, SSE connects, agent responds, tool cards appear
9. Report: Summarize what works and any issues encountered

## VERIFICATION

After completing all tasks:

1. **Server starts without errors:**
   ```bash
   bun run dev
   ```
   No TypeScript errors, no crash, listens on port 4010

2. **UI loads at root:**
   - Visit `http://localhost:4010/`
   - See chat interface (empty state message)
   - Status shows "Connected" (green dot)

3. **Message flow works:**
   - Type message, press Enter
   - User message appears (orange bubble)
   - Agent response arrives (white bubble)
   - Status changes: Connected → Processing → Connected

4. **Tool execution visible:**
   - Ask agent to read a file: "Read the package.json file"
   - Tool card appears showing `readFile({ path: "package.json" })`
   - Click card, modal opens showing tool arguments and output
   - Agent response includes file information

5. **No console errors:**
   - Browser DevTools Console tab shows no JavaScript errors
   - See successful API calls logged
   - See SSE events being received

## QUALITY STANDARDS

- TypeScript compiles: `bun run build` → 0 errors
- Linting passes: `bun run lint` → 0 errors (warnings OK)
- Server starts: `bun run dev` → no crashes
- UI loads: Visit `http://localhost:4010/` → page renders
- API functional: Message send/receive works end-to-end

## TROUBLESHOOTING GUIDE

**If UI doesn't load (404 at `/`):**
- Verify @fastify/static is in package.json dependencies
- Check static plugin is registered BEFORE API routes in server.ts
- Check `public/index.html` file exists
- Look at server logs for plugin registration errors

**If "Connection Failed" shows on page load:**
- Open browser DevTools Console tab
- Look for fetch error messages
- Check Network tab - is POST `/conversations` failing?
- If 400 error: Check request body format
- If 500 error: Check server logs for backend errors
- Verify `OPENAI_API_KEY` is set in `.env` file

**If messages don't send:**
- Check `currentConversationId` is set (should be logged in console)
- Look for JavaScript errors when clicking Send button
- Check Network tab for failed POST to `/messages`
- Verify `sendMessage()` function was not modified accidentally

**If SSE stream doesn't work:**
- Open Network tab, look for `/stream-events` request
- Should show "pending" or "EventStream" type
- Click on it, check Preview/Response tab for events
- If no events: Check server logs, verify message-processor is running
- If events malformed: Check SSE format (should be `id:`, `event:`, `data:` lines)

## SUCCESS CRITERIA

All of these must be true before considering the task complete:

- ✅ `bun run build` succeeds (0 errors)
- ✅ `bun run lint` succeeds (0 errors, warnings OK)
- ✅ `bun run dev` starts server without crash
- ✅ Browser loads UI at `http://localhost:4010/`
- ✅ UI shows "Connected" status on load
- ✅ Chat history is empty (no mock messages)
- ✅ Can send a message via the composer
- ✅ User message appears immediately in chat
- ✅ Agent response arrives within 5-30 seconds
- ✅ Tool cards appear if agent uses tools
- ✅ Modal opens when clicking tool cards
- ✅ No JavaScript errors in browser console

## REPORTING

After completing all tasks, report:

1. **What was changed:**
   - List of files modified
   - Number of lines added/removed per file

2. **Verification results:**
   - Did `bun run dev` start successfully?
   - Did UI load at `http://localhost:4010/`?
   - Did conversation creation work (green status)?
   - Did message send/receive work?
   - Were tool cards visible?

3. **Any issues encountered:**
   - Errors during implementation
   - Unexpected behaviors
   - Decisions made when instructions were ambiguous

4. **Next steps (if any):**
   - Features that could be improved
   - Edge cases not yet handled
   - Performance or UX observations

## FILES TO MODIFY

1. `src/server.ts` - Add static plugin (~10 lines)
2. `public/index.html` - Remove mocks, enable API (~100 lines changed)
3. `package.json` - Automatic (bun add modifies this)

**Do not modify:**
- API routes (`src/api/routes/*`)
- Handlers (`src/api/handlers/*`)
- Schemas (`src/api/schemas/*`)
- Services (`src/api/services/*`)

The API is complete. This task only wires the UI to consume it.
