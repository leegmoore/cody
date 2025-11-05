# Phase 3: Execution & Tools

## Overview

Phase 3 adds command execution, file operations, and tool management. This phase makes the agent actually DO things.

## Goals

1. **Command execution** - Run shell commands with sandboxing
2. **File operations** - Apply patches, search files
3. **Tool management** - Coordinate tool calls
4. **Sandboxing** - Security policies and execution control

## Modules to Port

### Standalone (No Dependencies)

1. **apply-patch** (1,600 lines)
   - Parse and apply file patches
   - Uses tree-sitter for syntax awareness
   - Dependencies: NONE ✅

2. **file-search** (600 lines)
   - Fuzzy file searching
   - Dependencies: common/fuzzy-match (already ported)

3. **execpolicy** (800 lines)
   - Execution policy parsing
   - Dependencies: NONE ✅

### Core Integration

4. **core/exec**
   - Command execution engine
   - Dependencies: exec, execpolicy, core/sandboxing

5. **exec**
   - CLI execution interface
   - Dependencies: core modules

6. **core/tools**
   - Tool specification and coordination
   - Dependencies: apply-patch, file-search, core/exec

7. **core/sandboxing**
   - Sandbox policy enforcement
   - Dependencies: execpolicy, platform-specific modules

### Platform-Specific (Optional)

8. **linux-sandbox** - Linux-specific sandboxing
9. **process-hardening** - Process security
10. **windows-sandbox-rs** - Windows-specific

## Porting Order

**Start with standalone modules (can work in parallel):**
1. apply-patch
2. file-search
3. execpolicy

**Then core integration:**
4. core/sandboxing
5. exec
6. core/exec
7. core/tools

**Platform-specific last (or skip for MVP):**
8. Pick one platform or use Node.js alternatives

## Success Criteria

- [ ] 3 standalone modules ported with tests
- [ ] Command execution works
- [ ] File patching works
- [ ] File search works
- [ ] Sandboxing policies enforced
- [ ] 100% test pass rate
- [ ] Integration: can execute command, apply patch, search files

## Next Phase Preview

Phase 4 will add model integration (client, backend-client, ollama, mcp).
