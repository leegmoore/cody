# Codex TypeScript Core API Design

## Overview

This document defines the public API for `@openai/codex-core`, a pure TypeScript library that provides programmatic access to Codex agent functionality.

## Architecture

```
@openai/codex-core (Library)
├── ConversationManager (session lifecycle)
├── Conversation (turn management)
├── ModelClient (LLM communication)
├── ToolExecutor (command/file/MCP execution)
├── Config (configuration)
└── AuthManager (authentication)
```

This library can power:
- CLI applications
- HTTP API servers
- Discord bots
- VS Code extensions
- Custom automation tools

## Core API

### ConversationManager

Manages conversation lifecycle and persistence.

**Methods:**
- `constructor(options)` - Create manager with auth and config
- `createConversation(options): Promise<Conversation>` - Start new conversation
- `resumeConversation(id, options?): Promise<Conversation>` - Resume from ID
- `getConversation(id): Conversation | null` - Get active conversation
- `forkConversation(id, options): Promise<Conversation>` - Branch conversation
- `listConversations(options?): Promise<ConversationSummary[]>` - List saved conversations
- `archiveConversation(id): Promise<void>` - Archive conversation
- `deleteConversation(id): Promise<void>` - Delete conversation

**Key Modules:** `core/conversation-manager`, `core/codex`, `core/rollout`, `protocol/*`

---

### Conversation

Manages individual conversation turns and message flow.

**Methods:**
- `sendMessage(input, options?): Promise<Turn>` - Send message, wait for completion
- `sendMessageStreaming(input, options?): AsyncGenerator<TurnEvent>` - Stream events
- `interrupt(): Promise<void>` - Cancel current turn
- `getHistory(): Promise<TurnItem[]>` - Get full conversation history
- `getConversationId(): string` - Get conversation ID
- `getRolloutPath(): string` - Get persistence path
- `approve(approvalId, approved): Promise<void>` - Respond to approval request

**Key Modules:** `core/codex-conversation`, `core/client`, `core/exec`, `core/tools`, `protocol/*`

---

### AuthManager

Handles authentication with various providers.

**Methods:**
- `constructor()` - Create auth manager
- `login(provider): Promise<AuthResult>` - Start login flow
- `logout(): Promise<void>` - Clear credentials
- `getAuth(): Promise<CodexAuth | null>` - Get current auth
- `isLoggedIn(): Promise<boolean>` - Check auth status

**Providers:** `chatgpt`, `api-key`, `ollama`, `openrouter`, `custom`

**Key Modules:** `core/auth`, `login`, `keyring-store`, `backend-client`

---

### Config

Configuration loading and management.

**Methods:**
- `Config.load(options?): Promise<Config>` - Load from all sources
- `get(key): any` - Get config value
- `set(key, value): void` - Set value (runtime only)
- `save(path?): Promise<void>` - Persist to file
- `validate(): ValidationResult` - Validate config

**Config Sources (priority order):**
1. Runtime overrides
2. Environment variables
3. Config file (~/.codex/config.toml)
4. Defaults

**Key Modules:** `core/config`, `core/config-loader`, `common/config-override`, `protocol/config-types`

---

### ToolExecutor

Executes tools (commands, files, MCP).

**Methods:**
- `executeCommand(command, options): Promise<CommandResult>` - Run shell command
- `applyPatch(patch, options): Promise<PatchResult>` - Apply file changes
- `searchFiles(query, options): Promise<FileSearchResult[]>` - Fuzzy file search
- `callMcpTool(server, tool, args): Promise<McpToolResult>` - Call MCP tool

**Key Modules:** `core/exec`, `exec`, `execpolicy`, `apply-patch`, `file-search`, `core/mcp`

---

### ModelClient

Low-level LLM communication.

**Methods:**
- `constructor(config)` - Create client for provider
- `chat(messages, options): Promise<ChatResponse>` - Send chat request
- `streamChat(messages, options): AsyncGenerator<ChatChunk>` - Stream chat

**Key Modules:** `core/client`, `core/chat_completions`, `backend-client`, `ollama/client`

---

## Event System

All streaming operations emit events matching the JSONL protocol:

```typescript
type TurnEvent =
  | { type: 'turn.started' }
  | { type: 'turn.completed', usage: TokenUsage }
  | { type: 'turn.failed', error: Error }
  | { type: 'item.started', item: TurnItem }
  | { type: 'item.updated', item: TurnItem }
  | { type: 'item.completed', item: TurnItem }
  | { type: 'approval.requested', approval: ApprovalRequest }
```

**Key Modules:** `exec/exec_events`, `protocol/*`

---

## Type Definitions

All types are defined in `protocol/*` modules:

**Core Types:**
- `ConversationId` - UUIDv7 conversation identifier
- `TurnItem` - Union of all turn item types
- `Event`, `EventMsg` - Protocol events
- `Op`, `Submission` - Protocol operations
- `UserInput` - Text or structured input

**Item Types:**
- `CommandExecutionItem` - Shell command execution
- `FileChangeItem` - File modifications
- `McpToolCallItem` - MCP tool invocation
- `AgentMessageItem` - Agent response
- `ReasoningItem` - Agent reasoning
- `WebSearchItem` - Web search
- `TodoListItem` - Task list
- `ErrorItem` - Error messages

**Config Types:**
- `SandboxMode` - Command execution sandboxing
- `ApprovalMode` - Approval requirements
- `ModelProviderConfig` - Model provider settings
- `McpServerConfig` - MCP server configuration

---

## Usage Examples

### Simple Conversation

```typescript
import { ConversationManager, AuthManager, Config } from '@openai/codex-core';

const auth = new AuthManager();
await auth.login('chatgpt');

const config = await Config.load();
const manager = new ConversationManager({ auth, sessionSource: 'api' });

const conversation = await manager.createConversation({
  workingDirectory: '/path/to/project',
  model: 'claude-sonnet-4',
  sandboxMode: 'workspace-write'
});

const turn = await conversation.sendMessage('Fix the failing tests');
console.log(turn.finalMessage);
```

### Streaming Progress

```typescript
const events = conversation.sendMessageStreaming('Refactor the API');

for await (const event of events) {
  if (event.type === 'item.started' && event.item.type === 'command_execution') {
    console.log('Running:', event.item.command);
  }
  if (event.type === 'item.completed' && event.item.type === 'file_change') {
    console.log('Modified:', event.item.changes.map(c => c.path));
  }
}
```

### Resume Conversation

```typescript
const conversation = await manager.resumeConversation('uuid-abc-123');
await conversation.sendMessage('Continue where we left off');
```

### Fork Conversation

```typescript
const forked = await manager.forkConversation('uuid-abc-123', {
  beforeTurnIndex: 5,
  config: { model: 'gpt-4' }
});
```

---

## REST API Mapping

This library enables easy REST API creation:

```typescript
// POST /conversations
app.post('/conversations', async (req, res) => {
  const conv = await manager.createConversation(req.body);
  res.json({ conversationId: conv.getConversationId() });
});

// POST /conversations/:id/messages
app.post('/conversations/:id/messages', async (req, res) => {
  const conv = await manager.getConversation(req.params.id);
  const turn = await conv.sendMessage(req.body.message);
  res.json(turn);
});

// GET /conversations/:id/messages (streaming)
app.get('/conversations/:id/messages', async (req, res) => {
  const conv = await manager.getConversation(req.params.id);
  const events = conv.sendMessageStreaming(req.query.message);

  res.setHeader('Content-Type', 'text/event-stream');
  for await (const event of events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
});
```

---

## Protocol Compatibility

The library maintains full compatibility with the existing JSONL protocol used by:
- `@openai/codex-sdk` (TypeScript SDK that wraps binary)
- `codex exec --experimental-json` (CLI JSON output mode)

This ensures:
- Existing SDK tests can validate the TS implementation
- Drop-in replacement for Rust binary
- Consistent behavior across all interfaces

---

## Extension Points

For custom context management and advanced use cases:

1. **Message history manipulation** - Inject context before turns
2. **Event stream middleware** - Intercept and augment events
3. **Custom tools** - Register additional tool executors
4. **Config overrides** - Programmatic config management
5. **MCP server plugins** - Add custom MCP servers

---

## Testing Strategy

The API is designed to be testable:

- **Unit tests** - Each module in isolation
- **Integration tests** - Cross-module flows
- **Golden file tests** - Compare output to Rust
- **SDK compatibility tests** - Verify protocol compatibility
- **End-to-end tests** - Full conversation flows

---

## Next Steps

Phase 1 focuses on the protocol layer that underpins this API.
Phase 2 implements ConversationManager and Conversation.
Phase 3 adds ToolExecutor functionality.
Phase 4 completes ModelClient and MCP support.
Phase 5 adds AuthManager and CLI integration.
