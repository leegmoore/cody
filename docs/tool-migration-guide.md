# Phase 4.5 Tool Migration Guide

## Overview

Phase 4.5 migrated 4 new tools from codex-port to codex-ts and established a centralized tool registry. This provides the foundation for the script harness to expose tools to sandboxed TypeScript scripts.

## What Was Migrated

### New Tools (4)

1. **readFile** - Read file contents with slice and indentation modes
2. **listDir** - Recursive directory listing with depth control
3. **grepFiles** - Pattern search using ripgrep
4. **applyPatch** - Enhanced version with tree-sitter heredoc parsing

### Existing Tools (2)

5. **exec** - Command execution (already existed in core/exec)
6. **fileSearch** - Fuzzy file search (already existed in file-search)

## Directory Structure

```
codex-ts/src/tools/
├── types.ts                 # Common ToolResult interface
├── index.ts                 # Tool exports
├── registry.ts              # Central tool registry
├── apply-patch/
│   ├── index.ts
│   ├── applyPatch.ts        # Main implementation
│   ├── parser.ts            # Patch parser
│   └── seekSequence.ts      # Sequence search utility
├── read-file/
│   ├── index.ts
│   └── readFile.ts
├── list-dir/
│   ├── index.ts
│   └── listDir.ts
└── grep-files/
    ├── index.ts
    └── grepFiles.ts
```

## Migration Changes

### 1. Import Updates

All imports updated to use `.js` extensions for ESM compatibility:

```typescript
// Before
import { parsePatch } from "./parser";

// After
import { parsePatch } from "./parser.js";
```

### 2. Bun → Node.js Conversions

**spawn (grepFiles)**:
```typescript
// Before (Bun)
const subprocess = spawn({
  cmd: ['rg', ...args],
  stdout: "pipe"
});

// After (Node.js)
const subprocess = spawn('rg', args, {
  stdio: ['ignore', 'pipe', 'pipe']
});
```

**Stream handling**:
```typescript
// Before (Bun Web Streams)
const text = await new Response(stream).text();

// After (Node.js Streams)
const chunks: Buffer[] = [];
for await (const chunk of stream) {
  chunks.push(Buffer.from(chunk));
}
return Buffer.concat(chunks).toString('utf8');
```

### 3. Dependencies Added

- `web-tree-sitter` - For applyPatch heredoc parsing
- `@vscode/tree-sitter-wasm` - Tree-sitter Bash grammar

## Tool Registry

The `ToolRegistry` class provides a centralized, typed interface for all tools:

```typescript
import { toolRegistry } from './tools/registry.js';

// Get tool metadata
const tool = toolRegistry.get('readFile');
console.log(tool.metadata.requiresApproval); // false

// Execute tool
const result = await tool.execute({
  filePath: 'src/index.ts',
  limit: 100
});
```

## Integration with Script Harness

The tool registry is designed to integrate with the script harness (Phase 4.4):

1. **Sandboxed Access**: Tools are exposed to scripts via frozen Proxy
2. **Approval Flow**: Tools marked `requiresApproval: true` trigger approval UI
3. **Promise Tracking**: Tool calls tracked for lifecycle management
4. **Error Handling**: Standardized error propagation to scripts

## Testing

All tools can be tested individually:

```bash
# Type check
npm run type-check

# Run tests (when test files are added)
npm test -- read-file
npm test -- list-dir
npm test -- grep-files
npm test -- apply-patch
```

## Phase 4.5 Complete Features

### Tool Migration
- ✅ Tool migration (4 new + 2 existing)
- ✅ Tool registry implementation
- ✅ ESM compatibility
- ✅ Bun → Node.js conversion
- ✅ Tree-sitter dependencies
- ✅ Documentation

### Performance Optimizations (NEW!)
- ✅ **tools.spawn** - Detached task execution implemented
- ✅ **Worker Pool** - QuickJS worker reuse (pool size = min(2, cpuCount))
- ✅ **Context Reuse** - Workers recycled after 100 scripts
- ✅ **Script Caching** - LRU cache for parsed scripts (SHA-256 hash, max 1000 entries)
- ✅ **Compilation Caching** - Script preprocessing cache (IIFE wrapping, etc.)

### Implementation Details

**tools.spawn:**
- Located in: `src/core/script-harness/tool-facade.ts`
- API: `tools.spawn.exec(toolName, args)` returns `{id, done: Promise}`
- API: `tools.spawn.cancel(id)` cancels detached task
- Detached promises NOT aborted on script completion
- Enabled via `enableSpawn: true` in config

**Worker Pool:**
- Located in: `src/core/script-harness/runtime/worker-pool.ts`
- Integrated into QuickJS runtime
- Borrow/release pattern for worker reuse
- Automatic recycling after 100 executions
- Unhealthy worker replacement

**Caching:**
- Script cache: `src/core/script-harness/runtime/script-cache.ts`
- Compilation cache: `src/core/script-harness/runtime/compilation-cache.ts`
- Both use SHA-256 hashing and LRU eviction
- Max 1000 entries per cache
- Hit rate tracking and statistics

## Known Limitations

1. **grepFiles** requires ripgrep (`rg`) to be installed
2. **applyPatch** requires tree-sitter WASM files to be accessible
3. No test files migrated yet (original test files are in .migration-staging)
4. tools.spawn disabled by default (must enable explicitly)

## References

- Design: `SCRIPT_HARNESS_DESIGN_FINAL.md`
- Tool API: `docs/tool-api-reference.md`
- Original tools: `.migration-staging/tools-from-codex-port/`
- Backup: `codex-ts/src/apply-patch.backup/`
