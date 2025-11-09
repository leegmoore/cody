# Phase 4.5: Script Harness - Optimization & Tools

## Overview

Phase 4.5 optimizes the script harness with performance improvements, adds missing tools from previous port, and creates complete documentation.

**Design Reference:** `/Users/leemoore/code/codex-port-02/SCRIPT_HARNESS_DESIGN_FINAL.md`

**Prerequisites:** Phase 4.4 complete (core implementation working with 401 tests)

## Goals

1. **tools.spawn** - Detached task pattern for long-running operations (phone-a-sme, etc.)
2. **Performance optimization** - Worker pool, context reuse, caching
3. **Tool migration** - Add missing tools from codex-port (readFile, listDir, grepFiles)
4. **Better applyPatch** - Replace with codex-port version (full tree-sitter)
5. **Documentation** - Complete user guides

## What Gets Added

### 1. Tool Migration from codex-port (CRITICAL)

**Why:** Previous Codex port (`~/code/v/codex-port`) has production-quality TypeScript tools we can reuse.

**Tools to migrate:**

**REPLACE (better implementation):**
- ❌ Remove: `codex-ts/src/apply-patch/` (incomplete tree-sitter, regex-based)
- ✅ Copy: `~/code/v/codex-port/src/tools/applyPatch/` → `codex-ts/src/tools/apply-patch/`
- **Why:** codex-port has FULL tree-sitter-bash integration (web-tree-sitter package), ours is stubbed with TODOs
- **Lines:** 1,563 (complete) vs our 2,102 (incomplete)

**ADD (new tools):**
- ✅ Copy: `~/code/v/codex-port/src/tools/readFile.ts` → `codex-ts/src/tools/read-file/`
- ✅ Copy: `~/code/v/codex-port/src/tools/listDir.ts` → `codex-ts/src/tools/list-dir/`
- ✅ Copy: `~/code/v/codex-port/src/tools/grepFiles.ts` → `codex-ts/src/tools/grep-files/`
- **Why:** We never ported these tools - they're missing from our implementation
- **What they do:**
  - **readFile:** Smart file reading with indentation-aware mode (navigates code by indentation)
  - **listDir:** Recursive directory listing with depth control
  - **grepFiles:** Content search using ripgrep (different from file-search which finds filenames)

**Migration tasks:**
1. Copy files from codex-port
2. Update imports (change to `.js` extensions for ESM)
3. Update return types to match our `ToolResult` protocol
4. Remove Bun-specific code (use Node.js equivalents)
5. Add to tool registry
6. Write/adapt tests (15-20 tests per tool)
7. Verify all tools work in script harness
8. Update tool documentation

**Result:** 6 production tools (applyPatch, exec, fileSearch, readFile, listDir, grepFiles)

### 2. tools.spawn (Detached Tasks)

**Why:** Essential for long-running operations like phone-a-sme (can take 10+ minutes)

**Pattern:**
```typescript
const smeCall = tools.spawn.exec({command: ['phone-a-sme', 'question']});
const quickCheck = await tools.exec({command: ['npm', 'test']});
const smeResult = await smeCall.done; // Wait when ready
// Or: await tools.spawn.cancel(smeCall.id);
```

**Implementation:**
- Track separately from PromiseTracker (don't auto-cancel on script end)
- Implement cancel mechanism
- ~50 lines + 10 tests

### 3. Performance Optimizations

**Worker Pool:**
- Reuse workers instead of create/destroy
- Pool size = min(2, CPU cores)
- Amortizes 15ms worker creation
- ~100 lines

**Context Reuse:**
- Reset context (1ms) instead of recreate (8ms)
- Recycle after 100 scripts or if contaminated
- 87% faster initialization
- ~50 lines

**Script Caching:**
- LRU cache of parsed scripts by hash
- Saves ~10ms parsing for retries
- Keep last 1000 scripts
- ~80 lines

**TypeScript Compilation Caching:**
- Cache TS→JS transpilation by source hash
- Saves ~20-30ms per script
- Significant for repeated patterns
- ~40 lines

### 4. Documentation

**Create 5 docs:**
1. **User Guide** - Syntax, examples, best practices
2. **Tool API Reference** - All 6 tools with schemas
3. **Configuration Guide** - Feature flags, limits, modes
4. **Error Catalog** - All error codes with remediation
5. **Operator Guide** - Monitoring, troubleshooting

## Success Criteria

- [ ] isolated-vm runtime working
- [ ] Runtime parity tests pass
- [ ] tools.spawn implemented
- [ ] Full 60 test suite passing
- [ ] Security review complete
- [ ] Red-team signoff
- [ ] Performance targets met (< 100ms overhead)
- [ ] Complete documentation
- [ ] Production deployment plan
- [ ] Feature ready for GA

## Rollout Plan

1. **Alpha:** Dry-run mode only (validation, no execution)
2. **Beta:** Enabled for select models/providers
3. **GA:** Full enablement after security signoff
