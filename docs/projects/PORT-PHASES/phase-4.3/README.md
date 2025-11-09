# Phase 4.3: Backend Services & MCP

## Overview

Phase 4.3 ports backend service clients and MCP server infrastructure. These are supporting services for the core client functionality.

## Goals

1. **Backend client** - Codex backend API client (task management, rate limits)
2. **ChatGPT features** - ChatGPT-specific integrations
3. **MCP infrastructure** - MCP server management and client
4. **Core MCP integration** - Wire MCP into core

## Modules to Port

### Backend Services (OpenAI-specific)

1. **backend-client** - Codex backend API client
   - Task listing and management
   - Rate limit queries
   - Account information
   - Uses `/api/codex/` paths

2. **chatgpt** - ChatGPT-specific features
   - ChatGPT token management
   - ChatGPT backend API helpers
   - Apply command integration

### MCP Infrastructure

3. **rmcp-client** - RMCP client implementation
4. **mcp-server** - MCP server process management
5. **core/mcp** - MCP integration in core engine

## Porting Order

1. backend-client (Codex backend API)
2. chatgpt (ChatGPT features)
3. rmcp-client (MCP client)
4. mcp-server (MCP server management)
5. core/mcp (core integration)

## Success Criteria

- [ ] Can call Codex backend API
- [ ] ChatGPT features work
- [ ] Can spawn and communicate with MCP servers
- [ ] MCP tools integrate with core
- [ ] All tests passing
- [ ] Ready for Phase 5 (auth)

## Notes

**OpenAI-specific modules:**
- backend-client and chatgpt are OpenAI/ChatGPT specific
- No Anthropic equivalent needed
- Port as-is from Rust

**MCP modules:**
- Provider-agnostic (work with any LLM)
- Already have mcp-types from Phase 4
- These complete MCP support
