# Script Harness Error Catalog

**Version:** 1.0.0
**Last Updated:** 2025-11-07

---

## Overview

Complete catalog of all error types, codes, causes, and remediation steps for the Codex TypeScript Script Harness.

---

## Error Categories

1. [Parsing Errors](#parsing-errors) - Syntax and validation
2. [Execution Errors](#execution-errors) - Runtime failures
3. [Timeout Errors](#timeout-errors) - Resource limits exceeded
4. [Security Errors](#security-errors) - Sandbox violations
5. [Tool Errors](#tool-errors) - Tool invocation failures
6. [System Errors](#system-errors) - Internal failures

---

## Error Format

All errors follow this structure:

```typescript
interface ScriptError {
  code: string           // Error code (e.g., "PARSE_ERROR")
  message: string        // Human-readable message
  phase: string          // "parsing" | "execution" | "timeout"
  details?: {
    line?: number        // Line number if applicable
    column?: number      // Column number if applicable
    tool?: string        // Tool name if applicable
    [key: string]: any   // Additional context
  }
}
```

---

## Parsing Errors

### `PARSE_ERROR`

**Cause:** JavaScript syntax error in script

**Example:**
```javascript
// Missing closing brace
function foo() {
  console.log("test")
// <- Error here
```

**Error:**
```json
{
  "code": "PARSE_ERROR",
  "message": "Unexpected end of input",
  "phase": "parsing",
  "details": {
    "line": 3,
    "column": 1
  }
}
```

**Remediation:**
- Fix JavaScript syntax
- Use a linter to catch errors early
- Check for missing braces, parentheses, quotes

---

### `INVALID_TOOL_REFERENCE`

**Cause:** Script references undefined tool

**Example:**
```javascript
await tools.undefinedTool()  // Tool doesn't exist
```

**Error:**
```json
{
  "code": "INVALID_TOOL_REFERENCE",
  "message": "Tool 'undefinedTool' is not defined",
  "phase": "parsing",
  "details": {
    "tool": "undefinedTool"
  }
}
```

**Remediation:**
- Check tool name spelling
- Verify tool is in selected tool pack
- Use `tools.list()` to see available tools
- Check Tool Pack configuration

---

### `SCRIPT_TOO_LARGE`

**Cause:** Script exceeds size limit

**Error:**
```json
{
  "code": "SCRIPT_TOO_LARGE",
  "message": "Script size (2048000 bytes) exceeds limit (1048576 bytes)",
  "phase": "parsing"
}
```

**Remediation:**
- Split script into smaller parts
- Increase `maxScriptSizeBytes` limit
- Remove unnecessary code/comments

---

## Execution Errors

### `RUNTIME_ERROR`

**Cause:** Unhandled exception during script execution

**Example:**
```javascript
throw new Error("Something went wrong")
```

**Error:**
```json
{
  "code": "RUNTIME_ERROR",
  "message": "Error: Something went wrong",
  "phase": "execution",
  "details": {
    "stack": "..."
  }
}
```

**Remediation:**
- Add try/catch blocks
- Check for null/undefined values
- Validate inputs before use
- Review stack trace for root cause

---

### `TOOL_CALL_FAILED`

**Cause:** Tool invocation threw an error

**Example:**
```javascript
await tools.readFile({ filePath: '/nonexistent' })
```

**Error:**
```json
{
  "code": "TOOL_CALL_FAILED",
  "message": "failed to read file: ENOENT: no such file or directory",
  "phase": "execution",
  "details": {
    "tool": "readFile",
    "params": { "filePath": "/nonexistent" }
  }
}
```

**Remediation:**
- Validate file/path exists before calling
- Check tool parameter types
- Handle errors in script:
  ```javascript
  try {
    const result = await tools.readFile({ filePath: path })
  } catch (error) {
    // Handle gracefully
  }
  ```

---

### `MAX_TOOL_CALLS_EXCEEDED`

**Cause:** Script made too many tool calls

**Error:**
```json
{
  "code": "MAX_TOOL_CALLS_EXCEEDED",
  "message": "Maximum tool calls (100) exceeded",
  "phase": "execution",
  "details": {
    "limit": 100,
    "actual": 101
  }
}
```

**Remediation:**
- Reduce tool calls in script
- Batch operations where possible
- Increase `maxToolCalls` limit
- Check for infinite loops

---

## Timeout Errors

### `EXECUTION_TIMEOUT`

**Cause:** Script exceeded execution time limit

**Error:**
```json
{
  "code": "EXECUTION_TIMEOUT",
  "message": "Script execution timeout after 30000ms",
  "phase": "timeout",
  "details": {
    "limit": 30000,
    "elapsed": 30001
  }
}
```

**Remediation:**
- Optimize script performance
- Reduce number of operations
- Increase `maxExecutionTimeMs` limit
- Use detached tasks for long operations:
  ```javascript
  const task = tools.spawn.exec({ command: ['long-running'] })
  // Don't wait for completion
  ```

---

### `MEMORY_LIMIT_EXCEEDED`

**Cause:** Script used too much memory

**Error:**
```json
{
  "code": "MEMORY_LIMIT_EXCEEDED",
  "message": "Memory limit (256MB) exceeded",
  "phase": "execution",
  "details": {
    "limit": 268435456,
    "used": 270000000
  }
}
```

**Remediation:**
- Process data in chunks
- Clear large variables when done
- Increase `maxMemoryMb` limit
- Use streaming for large files

---

## Security Errors

### `SANDBOX_VIOLATION`

**Cause:** Script attempted disallowed operation

**Example:**
```javascript
// With read-only sandbox
await tools.exec({ command: ['rm', '-rf', '/'] })
```

**Error:**
```json
{
  "code": "SANDBOX_VIOLATION",
  "message": "Write operation not allowed in read-only sandbox",
  "phase": "execution",
  "details": {
    "operation": "exec",
    "policy": "read-only"
  }
}
```

**Remediation:**
- Use appropriate sandbox policy:
  - `read-only`: No writes/execution
  - `workspace-write`: Writes in workspace only
  - `danger-full-access`: No restrictions
- Check sandbox policy matches your needs
- Request policy change if needed

---

### `PATH_TRAVERSAL_BLOCKED`

**Cause:** Script tried to access path outside workspace

**Example:**
```javascript
await tools.readFile({ filePath: '../../etc/passwd' })
```

**Error:**
```json
{
  "code": "PATH_TRAVERSAL_BLOCKED",
  "message": "Path '../../etc/passwd' is outside workspace",
  "phase": "execution",
  "details": {
    "path": "../../etc/passwd",
    "workspace": "/workspace"
  }
}
```

**Remediation:**
- Use paths within workspace
- Use absolute paths
- Check path resolution
- Don't use `..` in paths

---

## Tool Errors

### `MISSING_REQUIRED_PARAMETER`

**Cause:** Tool called without required parameter

**Example:**
```javascript
await tools.readFile()  // Missing filePath
```

**Error:**
```json
{
  "code": "MISSING_REQUIRED_PARAMETER",
  "message": "Required parameter 'filePath' missing",
  "phase": "execution",
  "details": {
    "tool": "readFile",
    "parameter": "filePath"
  }
}
```

**Remediation:**
- Check tool documentation
- Provide all required parameters
- Validate parameters before calling

---

### `INVALID_PARAMETER_TYPE`

**Cause:** Tool called with wrong parameter type

**Example:**
```javascript
await tools.readFile({ filePath: 123 })  // Should be string
```

**Error:**
```json
{
  "code": "INVALID_PARAMETER_TYPE",
  "message": "Parameter 'filePath' must be string, got number",
  "phase": "execution",
  "details": {
    "tool": "readFile",
    "parameter": "filePath",
    "expected": "string",
    "actual": "number"
  }
}
```

**Remediation:**
- Check parameter types
- Use TypeScript for type safety
- Validate inputs

---

### `MCP_RESOURCE_NOT_FOUND`

**Cause:** MCP resource doesn't exist

**Example:**
```javascript
await tools.readMcpResource({
  server: 'myserver',
  uri: 'file:///nonexistent.txt'
})
```

**Error:**
```json
{
  "code": "MCP_RESOURCE_NOT_FOUND",
  "message": "Resource 'file:///nonexistent.txt' not found on server 'myserver'",
  "phase": "execution",
  "details": {
    "server": "myserver",
    "uri": "file:///nonexistent.txt"
  }
}
```

**Remediation:**
- List resources first with `listMcpResources`
- Check URI spelling
- Verify server is connected

---

## System Errors

### `WORKER_POOL_EXHAUSTED`

**Cause:** All workers are busy

**Error:**
```json
{
  "code": "WORKER_POOL_EXHAUSTED",
  "message": "All workers busy, cannot execute script",
  "phase": "execution",
  "details": {
    "poolSize": 2,
    "busyWorkers": 2
  }
}
```

**Remediation:**
- Wait and retry
- Increase `maxWorkers` in config
- Reduce concurrent script load
- Check for stuck workers

---

### `CACHE_EVICTION`

**Cause:** Script evicted from cache (warning, not error)

**Error:**
```json
{
  "code": "CACHE_EVICTION",
  "message": "Script evicted from cache",
  "phase": "execution",
  "details": {
    "cacheSize": 1000,
    "evicted": "script-hash-abc123"
  }
}
```

**Remediation:**
- Increase cache size if frequent evictions
- This is normal for large workloads
- No action needed for occasional evictions

---

## Error Handling Best Practices

### In Scripts

```javascript
// Wrap risky operations
try {
  const result = await tools.readFile({ filePath: path })
  return result
} catch (error) {
  console.error('Failed to read file:', error.message)
  return { content: '', success: false }
}
```

### In Application Code

```typescript
import { executeScript } from './core/script-harness/orchestrator.js'

const result = await executeScript(context, script)

if (!result.ok) {
  console.error('Script failed:', result.error)

  switch (result.error.code) {
    case 'EXECUTION_TIMEOUT':
      // Retry with more time
      break
    case 'SANDBOX_VIOLATION':
      // Request policy change
      break
    case 'PARSE_ERROR':
      // Show syntax error to user
      break
    default:
      // Generic error handling
  }
}
```

---

## Debugging Tips

1. **Enable debug logging**
   ```bash
   CODEX_DEBUG=1 npm start
   ```

2. **Check error details**
   - Always log `error.details` for context
   - Stack traces show exact error location

3. **Test with strict limits**
   - Catch errors early with low limits
   - Increase limits gradually

4. **Monitor metrics**
   - Track error rates by code
   - Alert on unusual patterns

---

## See Also

- [Configuration Guide](./script-harness-config.md)
- [Operator Guide](./script-harness-ops.md)
