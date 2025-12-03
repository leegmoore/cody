# Phase 5: Integration (TDD)

## Goal

Implement full orchestration - `compressMessages()` and `cloneSessionV2()`.

## Context

**Project:** `/Users/leemoore/code/codex-port-02/coding-agent-manager/`

## Test File

`test/clone-v2-integration.test.ts`

## TDD Red: Write Tests

### TC-08: Token Statistics
### TC-12: Combined with Tool Removal

Plus:
- Golden file comparison test
- Lineage log format test

Mock fs, UUID, and OpenRouterClient.

## TDD Green: Implement Functions

### 1. `compressMessages()` - Full Implementation

**File:** `src/services/compression.ts`

```typescript
async function compressMessages(entries, turns, bands, config) {
  if (bands.length === 0) return { entries, stats: emptyStats() };

  const mapping = mapTurnsToBands(turns, bands);
  const tasks = createCompressionTasks(entries, turns, mapping, config.minTokens);

  if (tasks.length === 0) return { entries, stats: emptyStats() };

  const client = new OpenRouterClient({
    apiKey: process.env.OPENROUTER_API_KEY || "",
    model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
    modelThinking: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash:thinking"
  });

  const batchConfig = { concurrency: config.concurrency, maxAttempts: config.maxAttempts };
  const results = await processBatches(tasks, client, batchConfig);

  const modifiedEntries = applyCompressionResults(entries, results);
  const stats = calculateStats(results, entries.length);

  return { entries: modifiedEntries, stats };
}
```

### 2. `cloneSessionV2()` - Full Implementation

**File:** `src/services/session-clone.ts`

Add alongside existing `cloneSession()`:

```typescript
async function cloneSessionV2(request: CloneRequestV2): Promise<CloneResponseV2> {
  const sourcePath = await findSessionFile(request.sessionId);
  const sourceContent = await readFile(sourcePath, "utf-8");
  let entries = parseSession(sourceContent);
  const turns = identifyTurns(entries);
  const originalTurnCount = turns.length;

  let compressionStats: CompressionStats | undefined;

  // Apply compression if bands specified
  if (request.compressionBands && request.compressionBands.length > 0) {
    const compressionConfig = loadCompressionConfig();
    const result = await compressMessages(entries, turns, request.compressionBands, compressionConfig);
    entries = result.entries;
    compressionStats = result.stats;
  }

  // Apply removals (same as v1)
  const { entries: modifiedEntries, toolCallsRemoved, thinkingBlocksRemoved } =
    applyRemovals(entries, { toolRemoval: request.toolRemoval, thinkingRemoval: request.thinkingRemoval });

  const repairedEntries = repairParentUuidChain(modifiedEntries);
  const newSessionId = randomUUID();
  const finalEntries = repairedEntries.map(entry => ({
    ...entry,
    ...(entry.sessionId != null ? { sessionId: newSessionId } : {}),
  }));

  const outputTurnCount = identifyTurns(finalEntries).length;
  const sourceDir = path.dirname(sourcePath);
  const outputPath = path.join(sourceDir, `${newSessionId}.jsonl`);

  await writeFile(outputPath, finalEntries.map(e => JSON.stringify(e)).join("\n") + "\n", "utf-8");

  await logLineage({
    timestamp: new Date().toISOString(),
    targetId: newSessionId,
    targetPath: outputPath,
    sourceId: request.sessionId,
    sourcePath,
    toolRemoval: request.toolRemoval,
    thinkingRemoval: request.thinkingRemoval,
    compressionBands: request.compressionBands,
    compressionStats
  });

  return {
    success: true,
    outputPath,
    stats: {
      originalTurnCount,
      outputTurnCount,
      toolCallsRemoved,
      thinkingBlocksRemoved,
      compression: compressionStats
    }
  };
}
```

### 3. Update `lineage-logger.ts`

Add compression fields to `LineageEntry` and update log format.

## Verification

- [ ] TC-08 passes (accurate statistics)
- [ ] TC-12 passes (combined operations)
- [ ] All 15 test conditions pass
- [ ] Golden file test passes
- [ ] Lineage log includes compression info
- [ ] v1 tests still pass
- [ ] No TypeScript errors
