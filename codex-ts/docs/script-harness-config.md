# Script Harness Configuration Guide

**Version:** 1.0.0
**Last Updated:** 2025-11-07

---

## Overview

This guide covers all configuration options for the Codex TypeScript Script Harness, including feature flags, execution limits, tool packs, and security policies.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Tool Packs](#tool-packs)
3. [Execution Limits](#execution-limits)
4. [Security & Sandboxing](#security--sandboxing)
5. [Runtime Configuration](#runtime-configuration)
6. [Performance Tuning](#performance-tuning)
7. [Examples by Scenario](#examples-by-scenario)

---

## Quick Start

### Minimal Configuration

```typescript
import { createScriptContext } from './core/script-harness/context.js'

const context = await createScriptContext({
  workdir: '/path/to/workspace',
  toolPack: 'core-codex', // Use standard Codex tools
})
```

### Full Configuration

```typescript
const context = await createScriptContext({
  workdir: '/path/to/workspace',
  toolPack: 'anthropic-standard',
  limits: {
    maxExecutionTimeMs: 30000,
    maxMemoryMb: 256,
    maxScriptSizeBytes: 1024 * 1024, // 1MB
  },
  sandboxPolicy: { mode: 'workspace-write' },
  features: {
    allowDetachedTasks: true,
    enableScriptCache: true,
  },
})
```

---

## Tool Packs

Tool packs provide pre-configured sets of tools for different use cases.

### Available Packs

#### `core-codex`
Essential tools for code editing and execution.

**Includes:**
- `exec` - Execute commands
- `applyPatch` - Apply code patches
- `readFile` - Read file contents
- `listDir` - List directories
- `grepFiles` - Search in files
- `fileSearch` - Fuzzy file search

**Use when:** Building a code editor or automation tool

```typescript
{ toolPack: 'core-codex' }
```

#### `anthropic-standard`
Basic tool set aligned with Claude's common tools.

**Includes:**
- `exec` - Execute commands
- `readFile` - Read files
- `updatePlan` - Structured planning
- `listDir` - List directories

**Use when:** Integrating with Anthropic Claude

```typescript
{ toolPack: 'anthropic-standard' }
```

#### `file-ops`
File system operations only (no execution).

**Includes:**
- `readFile` - Read files
- `listDir` - List directories
- `grepFiles` - Search in files
- `applyPatch` - Apply patches
- `fileSearch` - Fuzzy search

**Use when:** Read-only or file editing scenarios

```typescript
{ toolPack: 'file-ops' }
```

#### `research`
Research and information gathering tools.

**Includes:**
- (Currently empty - awaiting web_search implementation)

**Use when:** Research-focused applications

```typescript
{ toolPack: 'research' }
```

#### `all`
All available tools.

**Use when:** Maximum flexibility needed

```typescript
{ toolPack: 'all' }
```

### Custom Tool Packs

```typescript
import { registerToolPack } from './tools/packs.js'

// Register custom pack
registerToolPack('my-custom-pack', [
  'readFile',
  'listDir',
  'grepFiles',
])

// Use it
const context = await createScriptContext({
  workdir: '/path/to/workspace',
  toolPack: 'my-custom-pack',
})
```

### Explicit Tool Lists

```typescript
// Instead of a pack, specify exact tools
const context = await createScriptContext({
  workdir: '/path/to/workspace',
  tools: ['readFile', 'listDir'], // Explicit list
})
```

---

## Execution Limits

Control resource usage with execution limits.

### Limit Options

```typescript
interface ScriptLimits {
  /** Maximum execution time in milliseconds (default: 30000 = 30s) */
  maxExecutionTimeMs?: number

  /** Maximum memory usage in megabytes (default: 256MB) */
  maxMemoryMb?: number

  /** Maximum script size in bytes (default: 1MB) */
  maxScriptSizeBytes?: number

  /** Maximum tool calls per script (default: 100) */
  maxToolCalls?: number

  /** Maximum concurrent scripts (default: 10) */
  maxConcurrentScripts?: number
}
```

### Example Configurations

#### Development (Relaxed)
```typescript
limits: {
  maxExecutionTimeMs: 60000,  // 60 seconds
  maxMemoryMb: 512,           // 512MB
  maxToolCalls: 200,
}
```

#### Production (Strict)
```typescript
limits: {
  maxExecutionTimeMs: 10000,  // 10 seconds
  maxMemoryMb: 128,           // 128MB
  maxToolCalls: 50,
}
```

#### Testing (Very Strict)
```typescript
limits: {
  maxExecutionTimeMs: 5000,   // 5 seconds
  maxMemoryMb: 64,            // 64MB
  maxToolCalls: 20,
}
```

---

## Security & Sandboxing

### Sandbox Policies

#### Read-Only
No file writes, no execution.

```typescript
sandboxPolicy: { mode: 'read-only' }
```

#### Workspace Write
Can write within workspace, no network.

```typescript
sandboxPolicy: {
  mode: 'workspace-write',
  writableRoots: ['/path/to/workspace'],
  networkAccess: false,
}
```

#### Danger Full Access
No restrictions (development only).

```typescript
sandboxPolicy: { mode: 'danger-full-access' }
```

**⚠️ Warning:** Only use in trusted environments

---

## Runtime Configuration

### Worker Pool

```typescript
// Configure QuickJS worker pool
workerPool: {
  minWorkers: 1,
  maxWorkers: 4,  // Default: min(2, cpuCount)
  recycleAfter: 100,  // Recycle worker after 100 scripts
}
```

### Script Caching

```typescript
features: {
  enableScriptCache: true,  // Cache parsed scripts
  scriptCacheSize: 1000,    // Max 1000 cached scripts
  enableCompilationCache: true,
  compilationCacheSize: 1000,
}
```

### Detached Tasks

```typescript
features: {
  allowDetachedTasks: true,  // Enable tools.spawn()
}
```

---

## Performance Tuning

### For High Throughput

```typescript
{
  workerPool: {
    maxWorkers: 8,  // More workers
    recycleAfter: 200,
  },
  features: {
    enableScriptCache: true,
    scriptCacheSize: 2000,
    enableCompilationCache: true,
  },
  limits: {
    maxConcurrentScripts: 20,
  },
}
```

### For Low Latency

```typescript
{
  workerPool: {
    minWorkers: 2,  // Pre-warm workers
    maxWorkers: 2,
  },
  features: {
    enableScriptCache: true,
    enableCompilationCache: true,
  },
  limits: {
    maxExecutionTimeMs: 5000,  // Fail fast
  },
}
```

### For Low Memory

```typescript
{
  workerPool: {
    maxWorkers: 1,  // Minimal workers
    recycleAfter: 50,
  },
  features: {
    enableScriptCache: false,  // Disable caching
    enableCompilationCache: false,
  },
  limits: {
    maxMemoryMb: 64,
    maxConcurrentScripts: 2,
  },
}
```

---

## Examples by Scenario

### Code Editor Integration

```typescript
const context = await createScriptContext({
  workdir: editorWorkspace,
  toolPack: 'core-codex',
  sandboxPolicy: {
    mode: 'workspace-write',
    networkAccess: false,
  },
  limits: {
    maxExecutionTimeMs: 30000,
    maxToolCalls: 150,
  },
  features: {
    enableScriptCache: true,
    allowDetachedTasks: true,
  },
})
```

### CI/CD Pipeline

```typescript
const context = await createScriptContext({
  workdir: ciWorkspace,
  toolPack: 'all',
  sandboxPolicy: { mode: 'danger-full-access' }, // Trusted
  limits: {
    maxExecutionTimeMs: 300000,  // 5 minutes
    maxMemoryMb: 1024,  // 1GB
  },
})
```

### API Endpoint

```typescript
const context = await createScriptContext({
  workdir: tempWorkspace,
  toolPack: 'file-ops',  // No execution
  sandboxPolicy: { mode: 'read-only' },
  limits: {
    maxExecutionTimeMs: 5000,  // Fast timeout
    maxMemoryMb: 128,
    maxToolCalls: 20,
  },
})
```

### Research Assistant

```typescript
const context = await createScriptContext({
  workdir: workspace,
  toolPack: 'research',
  sandboxPolicy: {
    mode: 'workspace-write',
    networkAccess: true,  // Allow web search
  },
  limits: {
    maxExecutionTimeMs: 60000,
    maxToolCalls: 100,
  },
})
```

---

## Environment Variables

```bash
# Override default timeouts
CODEX_MAX_EXECUTION_TIME_MS=30000

# Worker pool size
CODEX_WORKER_POOL_SIZE=4

# Enable debug logging
CODEX_DEBUG=1

# Cache sizes
CODEX_SCRIPT_CACHE_SIZE=1000
CODEX_COMPILATION_CACHE_SIZE=1000
```

---

## Best Practices

1. **Use specific tool packs** instead of 'all' for better security
2. **Set appropriate limits** based on your use case
3. **Enable caching** for production workloads
4. **Use read-only sandbox** when possible
5. **Monitor resource usage** in production
6. **Test with strict limits** before deploying

---

## See Also

- [Error Catalog](./script-harness-errors.md)
- [Operator Guide](./script-harness-ops.md)
- [Tool API Reference](./tool-api-reference.md) (if exists)
