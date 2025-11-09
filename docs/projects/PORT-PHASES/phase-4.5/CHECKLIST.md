# Phase 4.5 Checklist

**Status:** Not Started
**Design:** SCRIPT_HARNESS_DESIGN_FINAL.md

---

## Prerequisites

- [x] Phase 4.4 complete (script harness core)
- [x] Tool files staged in .migration-staging/tools-from-codex-port/
- [ ] Review Phase 4.5 plan

---

## Task 1: Tool Migration from codex-port

**Source files are in: .migration-staging/tools-from-codex-port/**

### Migrate applyPatch (REPLACE)
- [ ] Backup current src/apply-patch/ directory
- [ ] Copy .migration-staging/tools-from-codex-port/applyPatch/ to codex-ts/src/tools/apply-patch/
- [ ] Update imports (add .js extensions for ESM)
- [ ] Update return types to match our ToolResult protocol
- [ ] Install web-tree-sitter dependency: npm install web-tree-sitter @vscode/tree-sitter-wasm
- [ ] Adapt tests (create new test files)
- [ ] Verify tree-sitter heredoc parsing works
- [ ] Update tool registry
- [ ] Run: npm test -- apply-patch
- [ ] Verify all passing

### Add readFile (NEW)
- [ ] Copy .migration-staging/tools-from-codex-port/readFile.ts to codex-ts/src/tools/read-file/index.ts
- [ ] Copy .migration-staging/tools-from-codex-port/types.ts to codex-ts/src/tools/read-file/types.ts (for ToolResult reference)
- [ ] Update imports (add .js extensions)
- [ ] Update ToolResult type to match our protocol
- [ ] Replace Bun fs.promises with Node.js fs/promises
- [ ] Add to tool registry
- [ ] Write tests (15-20 tests): test indentation mode, slice mode, edge cases
- [ ] Run: npm test -- read-file
- [ ] Verify all passing

### Add listDir (NEW)
- [ ] Copy .migration-staging/tools-from-codex-port/listDir.ts to codex-ts/src/tools/list-dir/index.ts
- [ ] Copy types.ts reference
- [ ] Update imports (.js extensions)
- [ ] Update ToolResult type
- [ ] Replace Bun fs with Node.js
- [ ] Add to tool registry
- [ ] Write tests (15-20 tests): recursive listing, depth control, entry types
- [ ] Run: npm test -- list-dir
- [ ] Verify all passing

### Add grepFiles (NEW)
- [ ] Copy .migration-staging/tools-from-codex-port/grepFiles.ts to codex-ts/src/tools/grep-files/index.ts
- [ ] Copy types.ts reference
- [ ] Update imports (.js extensions)
- [ ] Update ToolResult type
- [ ] Replace Bun spawn with Node.js child_process spawn
- [ ] Add to tool registry
- [ ] Write tests (15-20 tests): pattern matching, glob filtering, timeout
- [ ] Check ripgrep availability (or provide fallback/error)
- [ ] Run: npm test -- grep-files
- [ ] Verify all passing

### Update Tool Registry
- [ ] Create codex-ts/src/tools/registry.ts (central registry)
- [ ] Register all 6 tools: applyPatch, exec, fileSearch, readFile, listDir, grepFiles
- [ ] Expose to script harness via ToolRegistry interface
- [ ] Test all tools callable from scripts
- [ ] Verify all passing

---

## Task 2: tools.spawn (Detached Tasks)

### Implementation
- [ ] Add spawn to tool-facade.ts
- [ ] Implement spawn.exec() - returns {id, done: Promise}
- [ ] Implement spawn.cancel(id) - cancels detached task
- [ ] Track detached tasks separately (don't auto-cancel)
- [ ] Write tests (10 tests): detached execution, cancellation, cleanup
- [ ] Run: npm test -- tool-facade
- [ ] Verify all passing

---

## Task 3: Performance Optimizations

### Worker Pool
- [ ] Implement WorkerPool class in runtime/
- [ ] Worker reuse with borrow/release
- [ ] Pool size = min(2, cpuCount)
- [ ] Test worker reuse faster than create/destroy
- [ ] Verify all passing

### Context Reuse
- [ ] Implement context.reset() method
- [ ] Contamination detection
- [ ] Recycle worker after 100 scripts
- [ ] Test context isolation between resets
- [ ] Verify all passing

### Script Caching
- [ ] Implement LRU cache for parsed scripts
- [ ] Cache by SHA-256 hash
- [ ] Max 1000 entries
- [ ] Test cache hits improve performance
- [ ] Verify all passing

### Compilation Caching
- [ ] Cache TS→JS transpilation results
- [ ] Cache by source hash
- [ ] Test cache effectiveness
- [ ] Verify all passing

---

## Task 4: Documentation

### User Guide
- [ ] Write docs/script-harness-user-guide.md
- [ ] Explain <tool-calls> syntax
- [ ] Provide examples (serial, parallel, error handling)
- [ ] Best practices section

### Tool API Reference
- [ ] Write docs/script-harness-tools-api.md
- [ ] Document all 6 tools with schemas
- [ ] Parameter descriptions
- [ ] Return value types
- [ ] Error codes

### Configuration Guide
- [ ] Write docs/script-harness-config.md
- [ ] Feature flags (disabled/dry-run/enabled)
- [ ] Resource limits
- [ ] Tool packs

### Error Catalog
- [ ] Write docs/script-harness-errors.md
- [ ] All error types with codes
- [ ] Remediation steps
- [ ] Examples

### Operator Guide
- [ ] Write docs/script-harness-ops.md
- [ ] Monitoring metrics
- [ ] Troubleshooting
- [ ] Performance tuning

---

## Final

- [ ] All 6 tools integrated and working
- [ ] tools.spawn functional
- [ ] Performance optimizations verified
- [ ] All documentation complete
- [ ] Update PORT_LOG_MASTER.md
- [ ] Commit and push
- [ ] Phase 4.5 COMPLETE!
