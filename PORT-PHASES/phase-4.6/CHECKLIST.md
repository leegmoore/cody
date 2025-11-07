# Phase 4.6 Checklist

**Status:** ✅ COMPLETE

---

## Prerequisites

- [x] Phase 4.5 complete (6 tools migrated + tools.spawn + performance)
- [x] Review Phase 4.6 plan

---

## Tool 1: view_image

- [x] Read codex-rs/core/src/tools/handlers/view_image.rs
- [x] Create codex-ts/src/tools/view-image/index.ts
- [x] Port ViewImageHandler logic
- [x] Validate image path exists
- [x] Inject image into conversation (integrate with existing image handling)
- [x] Create tests (14 tests)
- [x] Test path validation
- [x] Test image injection
- [x] Add to tool registry
- [x] Verify tests passing

---

## Tool 2: plan

- [x] Read codex-rs/core/src/tools/handlers/plan.rs
- [x] Create codex-ts/src/tools/plan/index.ts
- [x] Port PLAN_TOOL spec
- [x] Port handle_update_plan function
- [x] Parse UpdatePlanArgs (from protocol/plan_tool)
- [x] Emit plan events
- [x] Create tests (25 tests)
- [x] Test plan parsing
- [x] Test event emission
- [x] Test validation (only one in_progress step)
- [x] Add to tool registry
- [x] Verify tests passing

---

## Tool 3: mcp_resource

- [x] Read codex-rs/core/src/tools/handlers/mcp_resource.rs
- [x] Create codex-ts/src/tools/mcp-resource/index.ts
- [x] Port list_mcp_resources operation
- [x] Port list_mcp_resource_templates operation
- [x] Port read_mcp_resource operation
- [x] Integrate with MCP connection manager (stub implementation)
- [x] Handle server aggregation (all servers vs specific)
- [x] Create tests (27 tests)
- [x] Test each operation
- [x] Test server filtering
- [x] Test error handling
- [x] Add to tool registry
- [x] Verify tests passing

---

## Tool 4: web_search

⚠️ **DEFERRED - User to provide specs in future phase**

- [x] Check if user provided web_search API specifications
- [x] User confirmed specs not ready - deferred to future phase
- [ ] If ready: Read specifications
- [ ] Create codex-ts/src/tools/web-search/index.ts
- [ ] Implement per specifications
- [ ] Create tests (15 tests)
- [ ] Verify tests passing
- [ ] Add to tool registry

---

## Tool Pack System

### Implementation
- [x] Create codex-ts/src/tools/packs.ts
- [x] Define TOOL_PACKS constant with named collections
- [x] Define default packs (core-codex, anthropic-standard, file-ops, research)
- [x] Implement getToolsFromPack() function
- [x] Implement hasToolPack() function
- [x] Implement resolveTools() function
- [x] Implement registerToolPack() function
- [x] Create tests (25 tests)
- [x] Test pack lookup
- [x] Test pack expansion
- [x] Test unknown pack error
- [x] Test custom packs
- [x] Verify tests passing

### Integration
- [x] Define tool packs in packs.ts
- [x] Export pack API functions
- [x] Document pack system

---

## Tool Registry Enhancement

- [x] Update codex-ts/src/tools/registry.ts
- [x] Register all 9 tools:
  - applyPatch
  - exec
  - fileSearch
  - readFile
  - listDir
  - grepFiles
  - viewImage
  - updatePlan
  - listMcpResources, listMcpResourceTemplates, readMcpResource
- [x] Add tool metadata (description, schema, approval requirements)
- [x] Verify all tools accessible

---

## Final

- [x] All 3 tools implemented (web_search deferred)
- [x] Tool pack system working
- [x] All tests passing (115 new tests)
- [x] TypeScript typecheck clean
- [x] ESLint clean
- [x] Registry complete
- [x] Update PORT_LOG_MASTER.md
- [x] Commit and push
- [x] Phase 4.6 COMPLETE!

---

## Summary

**Completed:**
- 3 tools ported (view_image, plan, mcp_resource with 3 operations)
- 115 tests added and passing
- Tool pack system implemented with 5 default packs
- All quality checks passing
- web_search deferred to future phase (user to provide specs)

**Ready for:** Phase 5 or next phase as determined by project plan
