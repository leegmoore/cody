# Phase 5.1 Review: Compression Debug Log

**Reviewer:** Planning Agent
**Date:** 2024-12-04
**Specification:** `phase-5.1-compression-debug-log.md`

---

## Executive Summary

The specification is **well-structured and mostly complete**, but has **significant data access issues** that would cause implementation to fail. The core problem is that the debug logger needs data that isn't currently available at the call site in `cloneSessionV2()`.

**Verdict:** Requires specification fixes before implementation.

---

## 1. Completeness Assessment

### Present and Well-Defined
- [x] Request schema update (`debugLog: boolean`)
- [x] Debug log output format (markdown template)
- [x] File naming convention (`<target-session-id>-compression-debug.md`)
- [x] Directory structure (`clone-debug-log/`)
- [x] Manual verification steps
- [x] `.gitignore` update

### Missing or Unclear
- [ ] **How to get original entries before compression** - critical gap
- [ ] **How to get tasks with results** - tasks are internal to `compressMessages()`
- [ ] **Error handling** - what if debug log write fails?
- [ ] **Return value** - should response include debug log path?

---

## 2. Correctness Assessment

### Critical Issues

#### Issue 2.1: Data Not Available at Call Site

The specification shows:

```typescript
// From spec (session-clone.ts update)
if (request.debugLog && compressionStats && compressionStats.messagesCompressed > 0) {
  await writeCompressionDebugLog(
    request.sessionId,
    newSessionId,
    sourcePath,
    outputPath,
    entries,        // entries before compression  <-- PROBLEM
    finalEntries,   // entries after compression
    tasks,          // compression tasks with results <-- PROBLEM
    debugLogDir
  );
}
```

**Problems:**

1. **`entries` is mutated** - Line 367-383 in `session-clone.ts` shows:
   ```typescript
   let entries = parseSession(sourceContent);
   // ...
   const compressionResult = await compressMessages(entries, turns, ...);
   entries = compressionResult.entries;  // entries is reassigned
   ```
   The original `entries` array is gone. Need to save a copy before compression.

2. **`tasks` is internal** - The `compressMessages()` function returns only `{ entries, stats }`. The `tasks` array with individual results is internal to the compression pipeline and not exposed.

3. **`finalEntries` vs compressed entries** - After compression, entries go through tool removal, then repair, then sessionId update. The spec references `finalEntries` but what we actually want for "after compression" is the state immediately after `compressMessages()` returns, before subsequent transformations.

#### Issue 2.2: Task Status Mismatch

The spec shows `task.status === "skipped"` but examining `types.ts`:

```typescript
export interface CompressionTask {
  // ...
  status: "pending" | "success" | "failed";  // No "skipped" status!
}
```

Skipped messages (below threshold) are never added to the tasks array - they're filtered out in `createCompressionTasks()`. The debug logger needs a different approach to identify skipped messages.

### Logic Issues

#### Issue 2.3: What Counts as "Attempted"?

The spec conflates "attempted" with "in tasks array":
- Messages below min tokens are never in tasks (skipped before creation)
- The spec shows a "skipped" status that doesn't exist
- Summary counts won't match reality

---

## 3. Clarity Assessment

### Clear
- Markdown output format is well-specified
- File paths and naming are unambiguous
- Message field formatting is explicit

### Unclear
- What happens if compression is disabled but `debugLog: true`?
- Should debug log include messages that weren't in compression zones at all?
- How verbose should the console log be?

---

## 4. Integration Assessment

### Current `cloneSessionV2()` Flow

```
1. Find/load source
2. Parse entries
3. Identify turns
4. Apply compression  --> entries mutated, tasks internal
5. Apply tool removal --> entries modified again
6. Repair UUID chain
7. Update session ID
8. Write output
9. Log lineage
10. Return
```

### Integration Points

| Data Needed | Currently Available | Solution |
|-------------|---------------------|----------|
| Original entries | No (mutated) | Clone before compression |
| Compressed entries | Yes (from compressMessages) | Store intermediate |
| Tasks with results | No (internal) | Modify return type |
| Skipped messages | No (not tracked) | Add to stats or separate list |

### Required Changes to `compressMessages()`

The return type needs to expand:

```typescript
// Current
{ entries: SessionEntry[]; stats: CompressionStats }

// Needed
{ entries: SessionEntry[]; stats: CompressionStats; tasks: CompressionTask[] }
```

This is a **breaking change** to the compression interface that affects other code.

---

## 5. Issues Summary

### Blocking Issues (Must Fix)

| ID | Issue | Impact |
|----|-------|--------|
| B1 | Original entries not preserved | Debug log can't show "before" state |
| B2 | Tasks array not returned from `compressMessages()` | Can't iterate individual results |
| B3 | No "skipped" status in CompressionTask | Status logic will fail |

### Should Fix

| ID | Issue | Impact |
|----|-------|--------|
| S1 | No error handling for debug log write | Silent failure possible |
| S2 | Debug log path not in response | User can't easily find it |
| S3 | Ambiguity on what "after compression" means | Confusion if tool removal also applies |

### Nice to Have

| ID | Issue | Impact |
|----|-------|--------|
| N1 | No structured JSON output option | Harder to parse programmatically |
| N2 | No size limit on debug log | Large sessions = huge log files |

---

## 6. Recommendations

### Required Specification Changes

#### R1: Preserve Original Entries

Add to implementation section:

```typescript
// In cloneSessionV2()
const originalEntries = entries.map(e => ({ ...e })); // Shallow clone before compression
```

#### R2: Return Tasks from Compression

Modify `compressMessages()` return type:

```typescript
// compression.ts
export async function compressMessages(
  ...
): Promise<{ entries: SessionEntry[]; stats: CompressionStats; tasks: CompressionTask[] }> {
  // ...
  return { entries: compressedEntries, stats, tasks: completedTasks };
}
```

Update `session-clone.ts` to destructure:

```typescript
const { entries: compressedEntries, stats: compressionStats, tasks } = await compressMessages(...);
entries = compressedEntries;
```

#### R3: Handle Skipped Messages Correctly

Two options:

**Option A:** Track skipped in tasks array
- Add `status: "skipped"` to CompressionTask type
- Modify `createCompressionTasks()` to include skipped tasks with that status

**Option B:** Separate tracking (cleaner)
- Add `skippedIndexes: number[]` to return value
- Debug logger uses this list separately

Recommend **Option A** for consistency with spec's design.

#### R4: Update Types

```typescript
// types.ts
export interface CompressionTask {
  // ...
  status: "pending" | "success" | "failed" | "skipped";  // Add skipped
}
```

### Suggested Additions

#### Add Debug Log Path to Response

```typescript
// clone-v2.ts
export const CloneResponseSchemaV2 = z.object({
  success: z.boolean(),
  outputPath: z.string(),
  debugLogPath: z.string().optional(),  // NEW
  stats: z.object({...}),
});
```

#### Add Error Handling

```typescript
// In cloneSessionV2()
try {
  await writeCompressionDebugLog(...);
} catch (err) {
  console.warn(`[warn] Failed to write debug log: ${err}`);
  // Continue - debug log failure should not fail the clone
}
```

---

## 7. Revised Implementation Outline

After applying recommendations:

```typescript
// session-clone.ts
export async function cloneSessionV2(request: CloneRequestV2): Promise<CloneResponseV2> {
  // 1-2. Find/load/parse
  const sourcePath = await findSessionFile(request.sessionId);
  const sourceContent = await readFile(sourcePath, "utf-8");
  let entries = parseSession(sourceContent);
  const turns = identifyTurns(entries);

  // 3. Save original for debug logging
  const originalEntries = request.debugLog ? entries.map(e => ({ ...e })) : [];

  let compressionStats: CompressionStats | undefined;
  let compressionTasks: CompressionTask[] = [];
  let entriesAfterCompression: SessionEntry[] = entries;

  // 4. Compression
  if (request.compressionBands?.length) {
    const compressionConfig = loadCompressionConfig();
    const result = await compressMessages(entries, turns, request.compressionBands, compressionConfig);
    entries = result.entries;
    compressionStats = result.stats;
    compressionTasks = result.tasks;  // NEW: tasks now returned
    entriesAfterCompression = entries;  // Capture state after compression
  }

  // 5-8. Tool removal, repair, write (unchanged)
  // ...

  // 9. Debug log
  let debugLogPath: string | undefined;
  if (request.debugLog && compressionTasks.length > 0) {
    try {
      const debugLogDir = path.join(process.cwd(), "clone-debug-log");
      debugLogPath = await writeCompressionDebugLog(
        request.sessionId,
        newSessionId,
        sourcePath,
        outputPath,
        originalEntries,
        entriesAfterCompression,
        compressionTasks,
        debugLogDir
      );
    } catch (err) {
      console.warn(`[warn] Debug log failed: ${err}`);
    }
  }

  return {
    success: true,
    outputPath,
    debugLogPath,  // NEW
    stats: { ... }
  };
}
```

---

## 8. Effort Estimate

| Change | Effort |
|--------|--------|
| Update CompressionTask type | 5 min |
| Modify compressMessages() return | 10 min |
| Update cloneSessionV2() | 20 min |
| Implement debug logger | 30 min |
| Update schema | 5 min |
| Test manually | 15 min |

**Total:** ~1.5 hours

---

## 9. Conclusion

The Phase 5.1 specification has a solid design for debug output format but needs **data flow corrections** before implementation. The fixes are straightforward:

1. Return `tasks` from `compressMessages()`
2. Add `"skipped"` status to CompressionTask
3. Preserve original entries before mutation
4. Add error handling for debug log writes

With these changes, the spec is implementable. Without them, the implementation will fail at runtime due to missing data.

**Recommendation:** Update spec with fixes from Section 6, then proceed to implementation.
