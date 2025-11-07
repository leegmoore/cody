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

## Next Steps for Full Phase 4.5

The following items from the original Phase 4.5 checklist are **deferred** for future work:

### Deferred Features

1. **tools.spawn** - Detached task execution
2. **Worker Pool** - QuickJS worker reuse optimization
3. **Context Reuse** - Script context recycling
4. **Script Caching** - LRU cache for parsed scripts
5. **Compilation Caching** - TS→JS transpilation cache

These optimizations are not critical for the initial tool migration and can be implemented as performance becomes a concern.

### Completed in This Phase

- ✅ Tool migration (4 new + 2 existing)
- ✅ Tool registry implementation
- ✅ ESM compatibility
- ✅ Bun → Node.js conversion
- ✅ Tree-sitter dependencies
- ✅ Documentation

## Known Limitations

1. **grepFiles** requires ripgrep (`rg`) to be installed
2. **applyPatch** requires tree-sitter WASM files to be accessible
3. No test files migrated yet (original test files are in .migration-staging)
4. Performance optimizations not implemented

## References

- Design: `SCRIPT_HARNESS_DESIGN_FINAL.md`
- Tool API: `docs/tool-api-reference.md`
- Original tools: `.migration-staging/tools-from-codex-port/`
- Backup: `codex-ts/src/apply-patch.backup/`
