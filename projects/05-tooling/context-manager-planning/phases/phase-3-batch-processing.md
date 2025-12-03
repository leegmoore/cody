# Phase 3: Batch Processing (TDD)

## Goal

Implement parallel batch processing with timeout and retry logic.

## Context

**Project:** `/Users/leemoore/code/codex-port-02/coding-agent-manager/`

## Test File

`test/compression-batch.test.ts`

## TDD Red: Write Tests

### TC-01: Basic Compression Band
### TC-02: Heavy Compression Band
### TC-06: Compression Timeout and Retry
### TC-07: Maximum Retry Exceeded
### TC-13: Parallel Batch Processing

Plus test for timeout progression: `[5000, 10000, 15000, 15000]`

Mock OpenRouterClient for these tests.

## TDD Green: Implement Functions

### 1. `compressWithTimeout(task, client): Promise<CompressionTask>`

```typescript
const TIMEOUT_PROGRESSION = [5000, 10000, 15000, 15000];

async function compressWithTimeout(task, client) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), task.timeoutMs);

  try {
    const useThinking = task.estimatedTokens > 1000;
    const result = await client.compress(task.originalContent, task.level, useThinking);
    clearTimeout(timeoutId);
    return { ...task, status: "success", result };
  } catch (error) {
    clearTimeout(timeoutId);
    return { ...task, status: "failed", error: error.message };
  }
}
```

### 2. `processBatches(tasks, client, config): Promise<CompressionTask[]>`

**Algorithm:**
- Process in batches of `config.concurrency`
- Use `Promise.all` on `compressWithTimeout` calls
- Failed tasks: increment attempt, increase timeout, add to next batch
- After max attempts: mark failed, log warning
- Return all tasks with final status

## Verification

- [ ] All TC tests pass
- [ ] Timeout progression correct
- [ ] Retries work as expected
- [ ] Max retries marks as failed
- [ ] Parallel batching works
- [ ] Existing tests pass
