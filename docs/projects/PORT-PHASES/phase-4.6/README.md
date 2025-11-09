# Phase 4.6: Remaining Tools & Tool Packs

## Overview

Phase 4.6 ports the remaining Rust tools and implements the tool pack system for easy tool set configuration.

**Prerequisites:** Phase 4.5 complete (6 tools migrated: applyPatch, exec, fileSearch, readFile, listDir, grepFiles)

## Goals

1. **Port 4 remaining Rust tools** - Complete the core tool set
2. **Tool pack system** - Named collections of tools for different use cases
3. **Tool registry enhancements** - Support pack lookup and provider-specific sets

## Tools to Port (from Rust)

### 1. view_image (92 lines)
**Source:** `codex-rs/core/src/tools/handlers/view_image.rs`
**What it does:** Validates image path and injects into conversation for model viewing
**Dependencies:** utils/image (Phase 5)
**Complexity:** Easy (validates path, calls inject_input)

### 2. plan (117 lines)
**Source:** `codex-rs/core/src/tools/handlers/plan.rs`
**What it does:** Structured plan/todo management (update_plan tool)
**Dependencies:** protocol/plan_tool (already ported)
**Complexity:** Easy (parses plan JSON, emits events)

### 3. mcp_resource (789 lines)
**Source:** `codex-rs/core/src/tools/handlers/mcp_resource.rs`
**What it does:** Access MCP server resources (not tools, but data)
**Operations:**
- list_mcp_resources - List available resources
- list_mcp_resource_templates - List templates with variables
- read_mcp_resource - Read specific resource content
**Dependencies:** MCP connection manager (Phase 4.3, stubbed)
**Complexity:** Medium (3 operations, server aggregation)

### 4. web_search (TBD)
**Source:** Feature flag only - no Rust implementation
**What it does:** Web search capability
**Status:** **User will provide API specs**
**Note:** If not ready when reached, agent should STOP and inform user

## Tool Pack System

**What it is:** Named collections of tools for different scenarios

**Implementation:**
```typescript
const TOOL_PACKS = {
  'core-codex': ['exec', 'applyPatch', 'readFile', 'listDir', 'grepFiles', 'fileSearch'],
  'anthropic-standard': ['exec', 'readFile', 'plan', 'listDir'],
  'research': ['web_search_perplexity', 'deep_research', 'phone_sme'],
  'file-ops': ['readFile', 'listDir', 'grepFiles', 'applyPatch'],
  'all': null  // Special: expose everything
};

// Usage
createToolsProxy(registry, { toolPack: 'anthropic-standard' });
```

**Tasks:**
- Define default tool packs
- Implement pack lookup in tool-facade
- Allow custom packs via config
- Document pack system

## Module Order

1. view_image (easy warm-up)
2. plan (easy)
3. mcp_resource (medium complexity)
4. web_search (wait for specs or stub)
5. Tool pack system (enhancement)

## Success Criteria

- [ ] view_image tool working
- [ ] plan tool working
- [ ] mcp_resource 3 operations working
- [ ] web_search implemented or properly stubbed
- [ ] Tool pack system functional
- [ ] All 10 tools accessible
- [ ] Tests passing for new tools
- [ ] Tool packs tested
- [ ] Ready for Phase 6
