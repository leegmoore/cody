# Phase 1: Technical Design

**Phase:** Basic Chat Flow
**Goal:** Wire CLI → ConversationManager → Codex → Session → ModelClient for basic conversation

---

## Integration Overview

(From TECH-APPROACH Section 2)

Phase 1 proves core conversation flow works end-to-end. Wire CLI commands to ConversationManager, Manager to Codex, Codex to Session, Session to ModelClient (Responses API only). First time these pieces talk to each other. Single provider (OpenAI Responses), single auth (API key) to minimize variables.

Integration happens in layers: CLI command parser → handler functions → ConversationManager methods. ConversationManager delegates to Codex (wiring exists from port). Codex uses ModelClient (exists from port). Our job: wire CLI → Manager, verify Manager → Codex → Client chain works.

Testing: Mock ModelClient (no real API calls). Verify conversation flow (create → send → receive → history) without network/keys/limits. Fast, deterministic, repeatable.

---

## Actual Signatures (from ported code)

### ConversationManager

Location: `codex-ts/src/core/conversation-manager.ts`

```typescript
class ConversationManager {
  constructor(authManager: AuthManager, sessionSource: unknown)
  
  async newConversation(config: Config): Promise<NewConversation>
  async getConversation(conversationId: ConversationId): Promise<CodexConversation | undefined>
  async resumeConversationFromRollout(rolloutPath: string, config: Config): Promise<NewConversation>
  async removeConversation(conversationId: ConversationId): Promise<void>
}

interface NewConversation {
  conversationId: ConversationId,
  conversation: CodexConversation,
  sessionConfigured: SessionConfiguredEvent
}
```

### CodexConversation

Location: `codex-ts/src/core/codex-conversation.ts`

```typescript
class CodexConversation {
  constructor(codex: Codex, rolloutPath: string)
  
  async submit(input: UserInput[]): Promise<void>
  async nextEvent(): Promise<{msg: EventMsg}>
  rolloutPath(): string
}
```

**For Phase 1 CLI:** We'll wrap CodexConversation.submit() with simpler sendMessage(text: string) helper.

### Config

Location: `codex-ts/src/core/config.ts`

Config is complex (ported from Rust). For Phase 1, we need minimal subset:

```typescript
interface MinimalConfig {
  provider: {
    name: 'openai' | 'anthropic',
    api: 'responses' | 'chat' | 'messages',
    model: string
  },
  auth: {
    method: 'api-key' | 'oauth-chatgpt' | 'oauth-claude',
    openai_key?: string,
    anthropic_key?: string
  }
}
```

Read from: `~/.codex/config.toml`

### AuthManager

Location: `codex-ts/src/core/auth/index.ts`

```typescript
class AuthManager {
  // Already ported, just use it
  async getApiKey(provider: string): Promise<string>
}
```

For Phase 1: Only API key auth. OAuth in Phase 4.

---

## Config File Format

Example `~/.codex/config.toml`:

```toml
[provider]
name = "openai"
api = "responses"
model = "gpt-4"

[auth]
method = "api-key"
openai_key = "sk-proj-..."
```

CLI reads this, constructs Config object, passes to ConversationManager.

If file missing: Use defaults or error. Decision: Log in DECISIONS.md.

---

## Dependency Construction Pattern

**The wiring challenge:** ConversationManager needs AuthManager and sessionSource.

```typescript
// In CLI initialization
import {AuthManager} from '../core/auth';
import {ConversationManager} from '../core/conversation-manager';
import {Config} from '../core/config';

// Load config
const config = await loadConfig('~/.codex/config.toml');

// Create AuthManager
const authManager = new AuthManager(/* ... */);

// Create sessionSource (what is this?)
const sessionSource = null; // TODO: Figure out from port

// Create ConversationManager
const manager = new ConversationManager(authManager, sessionSource);
```

**sessionSource is TODO in port.** For Phase 1: Pass `null` or minimal stub. Document in DECISIONS.md.

---

## CLI Command Implementation

### cody new

```typescript
// src/cli/commands/new.ts
import {program} from 'commander';
import {getManager} from '../manager-singleton';

program
  .command('new')
  .description('Create new conversation')
  .action(async () => {
    const manager = getManager(); // Get or create manager
    const config = await loadConfig();
    
    const {conversationId, conversation} = await manager.newConversation(config);
    
    console.log(`Created conversation: ${conversationId.toString()}`);
    
    // Store active conversation for chat command
    setActiveConversation(conversationId, conversation);
  });
```

### cody chat

```typescript
// src/cli/commands/chat.ts
program
  .command('chat <message>')
  .description('Send message to active conversation')
  .action(async (message: string) => {
    const {conversation} = getActiveConversation();
    
    // Submit message
    const input = [{type: 'text', text: message}]; // UserInput format
    await conversation.submit(input);
    
    // Wait for response
    const event = await conversation.nextEvent();
    
    // Render response
    renderEvent(event.msg);
  });
```

**Note:** CodexConversation uses event-based API (submit → nextEvent loop). CLI can wrap in simpler interface or use as-is. Document choice in DECISIONS.md.

---

## Mock Implementation Guide

### Mock ModelClient

Location: `tests/mocks/model-client.ts`

```typescript
import {vi} from 'vitest';
import type {ResponseItem} from '../../src/protocol/items';

export function createMockClient(responses: ResponseItem[][]) {
  let callIndex = 0;
  
  return {
    async sendMessage(request: any): Promise<ResponseItem[]> {
      if (callIndex >= responses.length) {
        throw new Error('Mock exhausted - more calls than responses provided');
      }
      return responses[callIndex++];
    },
    getModelContextWindow: vi.fn().mockReturnValue(128000),
    getProvider: vi.fn().mockReturnValue({name: 'openai'}),
    // Add other ModelClient methods as needed
  };
}

// Usage
const mockClient = createMockClient([
  // First call response
  [{type: 'message', role: 'assistant', content: [{type: 'text', text: 'Hello!'}]}],
  // Second call response
  [{type: 'message', role: 'assistant', content: [{type: 'text', text: 'How are you?'}]}]
]);
```

### Mock Config

```typescript
export function createMockConfig(overrides = {}) {
  return {
    provider: {
      name: 'openai',
      api: 'responses',
      model: 'gpt-4',
      ...overrides.provider
    },
    auth: {
      method: 'api-key',
      openai_key: 'test-key-123',
      ...overrides.auth
    }
  };
}
```

---

## Error Handling

### Expected Errors

**ConfigurationError:**
- Config file missing
- Invalid TOML format
- Required fields missing (provider, model, API key)

**AuthError:**
- API key invalid
- API key missing for selected provider

**NetworkError:**
- API call fails (network timeout, 500 error)
- Rate limit exceeded

**ValidationError:**
- Message empty
- Message too long (exceeds model limit)

### Handling in CLI

```typescript
try {
  const result = await conversation.submit(input);
} catch (err) {
  if (err instanceof ConfigurationError) {
    console.error('Configuration error:', err.message);
    console.error('Check ~/.codex/config.toml');
    process.exit(1);
  } else if (err instanceof AuthError) {
    console.error('Authentication failed:', err.message);
    console.error('Verify your API key in config');
    process.exit(1);
  } else if (err instanceof NetworkError) {
    console.error('Network error:', err.message);
    console.error('Check your connection and try again');
    process.exit(1);
  } else {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}
```

---

## Wiring Code Example

### Complete minimal wiring

```typescript
// src/cli/index.ts
import {program} from 'commander';
import {ConversationManager} from '../core/conversation-manager';
import {AuthManager} from '../core/auth';
import {loadConfig} from './config';

let manager: ConversationManager;
let activeConversation: CodexConversation | null = null;

async function getManager() {
  if (!manager) {
    const config = await loadConfig();
    const authManager = new AuthManager(/* deps */);
    manager = new ConversationManager(authManager, null);
  }
  return manager;
}

program
  .command('new')
  .action(async () => {
    const mgr = await getManager();
    const config = await loadConfig();
    const {conversationId, conversation} = await mgr.newConversation(config);
    
    activeConversation = conversation;
    console.log(`Conversation: ${conversationId.toString()}`);
  });

program
  .command('chat <message>')
  .action(async (message) => {
    if (!activeConversation) {
      console.error('No active conversation. Run: cody new');
      process.exit(1);
    }
    
    await activeConversation.submit([{type: 'text', text: message}]);
    const event = await activeConversation.nextEvent();
    
    // TODO: Render event to console
    console.log('Response:', event.msg);
  });

program.parse();
```

This is minimal wiring. Coder expands with proper error handling, display rendering, etc.

---

## Reference Code Locations

**When stuck, read these:**

- ConversationManager: `codex-ts/src/core/conversation-manager.ts` (actual signatures, how it works)
- CodexConversation: `codex-ts/src/core/codex-conversation.ts` (submit/nextEvent API)
- Codex: `codex-ts/src/core/codex/codex.ts` (spawn method, what it needs)
- Config: `codex-ts/src/core/config.ts` (full config structure)
- AuthManager: `codex-ts/src/core/auth/index.ts` (auth methods)
- ModelClient interface: `codex-ts/src/client/` (what clients implement)
- ResponseItems: `codex-ts/src/protocol/items.ts` (type definitions)

**Don't guess. Read ported code when unclear.**

---

## Key Implementation Notes

**1. ConversationManager needs AuthManager:**
Must construct AuthManager before ConversationManager. Check Phase 5 port for AuthManager construction.

**2. CodexConversation uses event loop:**
submit() → nextEvent() → nextEvent() until done. Not simple request/response. CLI must handle event stream or wrap in simpler API.

**3. Config loading:**
Use existing Config module from Phase 2 port. Don't reimplement config loading. Just read TOML and construct Config object.

**4. sessionSource parameter:**
Currently `unknown` type in port (TODO). For Phase 1: pass `null`. If Codex.spawn() requires it, investigate or ask user. Document in DECISIONS.md.

**5. Display rendering:**
CodexConversation.nextEvent() returns EventMsg union (many event types). For Phase 1, handle basic types: assistant message, error. Ignore complex events (tool calls come in Phase 2).

---

## Testing Strategy

Write mocked-service tests that verify wiring WITHOUT testing ported modules.

**What to test:**
- CLI can construct ConversationManager (wiring correct)
- CLI can call newConversation and get conversation back
- CLI can call submit() and receive events
- Multi-turn: Second submit includes first message in history

**What NOT to test:**
- Does Codex orchestration work? (Assume yes, ported code has tests)
- Does ModelClient parse SSE correctly? (Assume yes, Phase 4 tested this)
- Does conversation history work? (Assume yes, Phase 5.1 tested this)

**Test the integration, not the ported modules.**

