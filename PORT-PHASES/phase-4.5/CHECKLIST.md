# Phase 4.5 Checklist

**Status:** Not Started
**Design:** SCRIPT_HARNESS_DESIGN_FINAL.md

---

## Prerequisites

- [x] Phase 4.4 complete (core implementation, 40 tests)
- [x] QuickJS runtime working
- [x] Basic tool facade functional
- [ ] Review Phase 4.5 plan

---

## Task 1: Tool Migration from codex-port

### Migrate applyPatch (REPLACE)
- [ ] Backup current src/apply-patch/ to .archive/
- [ ] Copy ~/code/v/codex-port/src/tools/applyPatch/ to src/tools/apply-patch/
- [ ] Update imports (add .js extensions)
- [ ] Update return types to match our protocol
- [ ] Install web-tree-sitter dependency
- [ ] Adapt tests (port from codex-port if available)
- [ ] Verify tree-sitter heredoc parsing works
- [ ] Update tool registry
- [ ] Run tests
- [ ] Verify all passing

### Add readFile (NEW)
- [ ] Copy ~/code/v/codex-port/src/tools/readFile.ts to src/tools/read-file/
- [ ] Update imports (.js extensions)
- [ ] Update ToolResult type
- [ ] Replace Bun-specific code with Node.js
- [ ] Add to tool registry
- [ ] Write tests (15-20 tests)
- [ ] Test indentation mode
- [ ] Test slice mode
- [ ] Verify all passing

### Add listDir (NEW)
- [ ] Copy ~/code/v/codex-port/src/tools/listDir.ts to src/tools/list-dir/
- [ ] Update imports (.js extensions)
- [ ] Update ToolResult type
- [ ] Replace Bun-specific code with Node.js
- [ ] Add to tool registry
- [ ] Write tests (15-20 tests)
- [ ] Test recursive listing
- [ ] Test depth control
- [ ] Verify all passing

### Add grepFiles (NEW)
- [ ] Copy ~/code/v/codex-port/src/tools/grepFiles.ts to src/tools/grep-files/
- [ ] Update imports (.js extensions)
- [ ] Update ToolResult type
- [ ] Replace Bun spawn with Node.js spawn
- [ ] Add to tool registry
- [ ] Write tests (15-20 tests)
- [ ] Test pattern matching
- [ ] Test glob filtering
- [ ] Verify ripgrep available (or graceful fallback)
- [ ] Verify all passing

### Update Tool Registry
- [ ] Create central tool registry module
- [ ] Register all 6 tools (applyPatch, exec, fileSearch, readFile, listDir, grepFiles)
- [ ] Expose to script harness
- [ ] Test all tools callable from scripts
- [ ] Verify all passing

---

## Task 2: tools.spawn (Detached Tasks)

### Implementation
- [ ] Implement spawn pattern in tool-facade
- [ ] Add spawn.exec() for detached tasks
- [ ] Add spawn.cancel() for cancellation
- [ ] Test detached task execution
- [ ] Test cancellation
- [ ] Verify tests pass

### tools.http (optional)
- [ ] Implement http tool (if policy allows)
- [ ] Add network policy checks
- [ ] Test HTTP requests
- [ ] Verify tests pass

---

## Task 3: Performance Optimizations

### Worker Pool
- [ ] Implement WorkerPool class
- [ ] Worker reuse logic
- [ ] Pool size configuration
- [ ] Test worker reuse
- [ ] Verify faster than create/destroy

### Context Reuse
- [ ] Implement context reset
- [ ] Contamination detection
- [ ] Recycle after 100 scripts
- [ ] Test context isolation
- [ ] Verify 87% faster init

### Script Caching
- [ ] Implement LRU cache (1000 entries)
- [ ] Cache by SHA-256 hash
- [ ] Test cache hits/misses
- [ ] Verify faster for repeated scripts

### Compilation Caching
- [ ] Cache TS→JS transpilation
- [ ] Cache by source hash
- [ ] Test cache effectiveness
- [ ] Verify 20-30ms savings

---

## Task 4: Documentation

---

### User Guide
- [ ] Write user guide (docs/script-harness.md)
- [ ] Write security model (docs/script-harness-security.md)
- [ ] Write tool API reference (docs/script-harness-api.md)
- [ ] Write configuration guide (docs/script-harness-config.md)
- [ ] Write error catalog (docs/script-harness-errors.md)
- [ ] Write operator runbook (docs/script-harness-ops.md)

---

## Final

- [ ] All 6 tools integrated and working
- [ ] tools.spawn functional
- [ ] Performance optimizations verified
- [ ] All documentation complete
- [ ] Update PORT_LOG_MASTER.md
- [ ] Commit and push
- [ ] Phase 4.5 COMPLETE!
