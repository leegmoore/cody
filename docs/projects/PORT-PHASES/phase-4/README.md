# Phase 4: Model Integration & MCP

## Overview

Phase 4 adds LLM communication and MCP server support. This phase connects the agent to AI models and external tools.

## Goals

1. **Model clients** - Communicate with OpenAI, Anthropic, Ollama
2. **Chat completions** - Handle streaming responses
3. **MCP integration** - Connect to MCP servers
4. **ChatGPT integration** - ChatGPT-specific features

## Modules to Port

### Model Communication

1. **core/client** - Model client interface
2. **core/chat_completions** - Chat completion handling
3. **backend-client** - OpenAI/Anthropic API client
4. **ollama/client** - Ollama local model client (complete ollama module)
5. **chatgpt** - ChatGPT-specific integration

### MCP Support

6. **mcp-types** - MCP type definitions
7. **mcp-server** - MCP server management
8. **rmcp-client** - RMCP client implementation
9. **core/mcp** - MCP integration in core

## Porting Order

**Start with:**
1. mcp-types (type definitions)
2. ollama/client (complete ollama)
3. core/client (model client interface)
4. core/chat_completions (streaming handler)

**Then:**
5. backend-client (API communication)
6. chatgpt (ChatGPT features)
7. rmcp-client (MCP client)
8. mcp-server (MCP server management)
9. core/mcp (integration)

## Success Criteria

- [ ] Can communicate with OpenAI API
- [ ] Can communicate with Anthropic API
- [ ] Can communicate with Ollama locally
- [ ] Can connect to MCP servers
- [ ] Streaming responses work
- [ ] 100% test pass rate

## Next Phase Preview

Phase 5 will add auth (login, keyring-store, core/auth) and CLI interface.
Then final integration phase for core/codex, core/codex-conversation, core/conversation-manager.
