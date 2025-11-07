# Tool API Reference

This document describes all available tools in the Codex tool registry.

## Core Tools

### applyPatch

Apply a unified diff patch to files with tree-sitter heredoc parsing support.

**Parameters:**
```typescript
{
  patch: string;     // Unified diff format patch
  cwd?: string;      // Working directory (default: process.cwd())
}
```

**Returns:**
```typescript
{
  success: boolean;
  stdout: string;
  stderr: string;
}
```

**Example:**
```typescript
await tools.applyPatch({
  patch: `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
-const x = 1;
+const x = 2;`,
  cwd: '/path/to/project'
});
```

---

### readFile

Read file contents with support for slice mode and indentation-aware mode.

**Parameters:**
```typescript
{
  filePath: string;           // Absolute or relative path
  offset?: number;            // 1-indexed line number (default: 1)
  limit?: number;             // Number of lines (default: 2000)
  mode?: "slice" | "indentation";  // Read mode (default: "slice")
  workdir?: string;           // Working directory (default: process.cwd())

  // Indentation mode options:
  anchorLine?: number;        // Reference line for indentation
  maxLevels?: number;         // Max indentation levels to traverse
  includeSiblings?: boolean;  // Include sibling nodes
  includeHeader?: boolean;    // Include file header
  maxLines?: number;          // Guard limit for output
}
```

**Returns:**
```typescript
{
  content: string;   // File content with line numbers (L123: ...)
  success: boolean;
}
```

**Example:**
```typescript
// Slice mode - read lines 10-20
await tools.readFile({
  filePath: 'src/index.ts',
  offset: 10,
  limit: 10,
  mode: 'slice'
});

// Indentation mode - read function scope
await tools.readFile({
  filePath: 'src/index.ts',
  anchorLine: 45,
  mode: 'indentation',
  maxLevels: 2
});
```

---

### listDir

List directory contents recursively with depth control.

**Parameters:**
```typescript
{
  path: string;         // Directory path
  offset?: number;      // Pagination offset (default: 1)
  limit?: number;       // Max entries (default: 25)
  depth?: number;       // Max recursion depth (default: 2)
  workdir?: string;     // Working directory (default: process.cwd())
}
```

**Returns:**
```typescript
{
  content: string;      // Tree-formatted directory listing
  success: boolean;
}
```

**Example:**
```typescript
await tools.listDir({
  path: 'src/',
  depth: 3,
  limit: 100
});
```

---

### grepFiles

Search for patterns in files using ripgrep.

**Parameters:**
```typescript
{
  pattern: string;      // Regex pattern to search
  include?: string;     // Glob filter (e.g., "*.ts")
  path?: string;        // Search path (default: cwd)
  limit?: number;       // Max results (default: 100, max: 2000)
}
```

**Returns:**
```typescript
{
  content: string;      // Newline-separated file paths
  success: boolean;     // false if no matches
}
```

**Example:**
```typescript
await tools.grepFiles({
  pattern: 'function\\s+\\w+',
  include: '*.ts',
  path: 'src/',
  limit: 50
});
```

**Requirements:** Ripgrep (`rg`) must be installed and available in PATH.

---

### exec

Execute a command in a sandboxed environment (requires approval).

**Parameters:**
```typescript
{
  command: string[];       // [program, ...args]
  cwd?: string;            // Working directory
  env?: Record<string, string>;  // Environment variables
  timeoutMs?: number;      // Execution timeout
}
```

**Returns:**
```typescript
{
  exitCode: number;
  stdout: { text: string; truncatedAfterLines?: number };
  stderr: { text: string; truncatedAfterLines?: number };
  aggregatedOutput: { text: string; truncatedAfterLines?: number };
  durationMs: number;
  timedOut: boolean;
}
```

**Example:**
```typescript
await tools.exec({
  command: ['npm', 'test'],
  cwd: '/path/to/project',
  timeoutMs: 30000
});
```

---

### fileSearch

Fast fuzzy file search using globby and fuzzysort.

**Parameters:**
```typescript
{
  pattern: string;          // Fuzzy search pattern
  limit?: number;           // Max results (default: 64)
  searchDirectory?: string; // Directory to search
  exclude?: string[];       // Glob patterns to exclude
}
```

**Returns:**
```typescript
{
  matches: Array<{
    score: number;         // Relevance score (higher is better)
    path: string;          // Relative file path
    indices?: number[];    // Matched character indices
  }>;
  totalMatchCount: number;
}
```

**Example:**
```typescript
await tools.fileSearch({
  pattern: 'config',
  limit: 10,
  exclude: ['node_modules/**', '*.log']
});
```

---

## Error Handling

All tools throw errors for invalid inputs or execution failures. Common error types:

- **File not found**: Invalid file paths
- **Permission denied**: Insufficient permissions
- **Timeout**: Operation exceeded time limit (exec, grepFiles)
- **Invalid arguments**: Parameter validation failures

Always wrap tool calls in try-catch blocks for robust error handling.

## Tool Registry

Access tools programmatically through the registry:

```typescript
import { toolRegistry } from './tools/registry.js';

const tool = toolRegistry.get('readFile');
const result = await tool.execute({ filePath: 'src/index.ts' });
```

Available methods:
- `get(name: string)`: Get tool by name
- `has(name: string)`: Check if tool exists
- `getToolNames()`: List all tool names
- `getAll()`: Get all registered tools
