# Phase 4.4: Script Harness - Core Implementation

## Overview

Phase 4.4 implements the core script-based tool harness allowing LLMs to write TypeScript code that calls Codex tools programmatically. This is a competitive-differentiation feature enabling unprecedented tool composition.

**Design Reference:** `/Users/leemoore/code/codex-port-02/SCRIPT_HARNESS_DESIGN_FINAL.md`

## Goals

1. **QuickJS runtime** - Sandboxed execution environment
2. **Script detection** - XML tag scanning (`<tool-calls>`)
3. **Tool facade** - Expose tools to sandbox
4. **Promise tracking** - Lifecycle management with AbortController
5. **Approval integration** - Pause/resume for user approvals
6. **Basic error handling** - Core error types
7. **Working feature** - Behind dry-run mode for validation

## Modules to Implement

**Core Infrastructure (Week 1-2):**
1. `runtime/types.ts` - ScriptRuntimeAdapter interface
2. `runtime/quickjs-runtime.ts` - QuickJS worker manager
3. `hardening.ts` - Intrinsic freezing prelude
4. `runtime/promise-tracker.ts` - Promise lifecycle management

**Detection & Parsing (Week 2-3):**
5. `detector.ts` - XML tag scanning
6. `parser.ts` - Validation and extraction

**Tool Integration (Week 3-4):**
7. `tool-facade.ts` - Tool proxy with validation
8. `approvals-bridge.ts` - Approval suspend/resume
9. `context.ts` - Execution context factory

**Orchestration (Week 4-5):**
10. `orchestrator.ts` - Main coordinator
11. `serializer.ts` - ResponseItem generation
12. `errors.ts` - Error types
13. `feature-flags.ts` - Mode handling

**Integration:**
14. Update `core/client/response-processing.ts`
15. Update `protocol/models.ts` (ScriptToolCall types)

## Implementation Order

**Week 1:** Runtime + Hardening
**Week 2:** Detection + Parsing
**Week 3:** Tool Facade + Promise Tracking
**Week 4:** Approval Integration
**Week 5:** Orchestration + Serialization

## Testing Strategy

**Target: 40 tests for Phase 4.4**
- Security: 15 tests (S1-S15)
- Functional: 20 tests (F1-F20)
- Integration: 5 tests (I1-I5)

Focus on core functionality. Phase 4.5 expands to full 60 test suite.

## Success Criteria

- [ ] QuickJS runtime working with worker pool
- [ ] XML tag detection and parsing works
- [ ] Basic tools exposed (applyPatch, exec, fileSearch)
- [ ] Promise lifecycle managed (orphaned promises aborted)
- [ ] Approval flow pauses/resumes scripts
- [ ] Errors reported correctly
- [ ] Works with all 3 APIs (Responses, Chat, Messages)
- [ ] Dry-run mode functional
- [ ] 40 tests passing
- [ ] Ready for Phase 4.5 hardening

## What's Deferred to Phase 4.5

- isolated-vm runtime (optional)
- tools.spawn pattern (detached tasks)
- Complete security hardening
- Full test suite (60 tests)
- Security review + red-team
- Performance optimization
- Complete documentation
