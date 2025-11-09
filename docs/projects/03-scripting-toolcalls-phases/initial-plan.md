# Script-Based Tool Calling Integration Project

**Project Goal:** Integrate script harness into core system, enable compositional tool workflows.

**Prerequisites:** Core Implementation Project complete (UI Integration Phases 1-8)

**Approach:** Add script execution alongside structured calls, progressive feature enablement, extensive testing.

**Output:** Working script harness + Enhanced CLI + Updated library spec

---

## Phase 1: Script Detection & Execution

**Add:**
- Script detector (XML tag scanning)
- Basic QuickJS execution
- Tool proxy (3 tools: exec, readFile, applyPatch)

**Wire:**
- Script detection before tool router
- Execution results → conversation history

**CLI:**
- Display when script executing
- Show script progress

**Library Spec:**
- Script execution interface
- Basic tool access

---

## Phase 2: Full Tool Integration

**Add:**
- All tools exposed to scripts
- Tool packs (select which tools available)
- Argument validation

**Beef Up:**
- Error messages (script-specific)
- Tool results formatting

**Library Spec:**
- Complete tool registry exposure
- Tool pack configuration

---

## Phase 3: Promise Lifecycle

**Add:**
- Promise tracking
- Orphaned promise cleanup
- tools.spawn (detached tasks)

**Beef Up:**
- Async error handling
- Timeout displays

**Library Spec:**
- Async tool patterns
- Lifecycle guarantees

---

## Phase 4: Approval Integration

**Add:**
- Approval bridge (pause scripts)
- Suspend/resume mechanism

**Beef Up:**
- Approval UI (show script context)
- Denial handling

**CLI:**
- Script metadata in approval prompts
- Resume indicators

**Library Spec:**
- Approval callback patterns
- Script control interface

---

## Phase 5: Performance & Security

**Add:**
- Worker pooling
- Script caching
- Compilation caching

**Beef Up:**
- Security boundaries
- Resource limit enforcement

**Library Spec:**
- Configuration options
- Performance tuning

---

## After Phase 5

**Complete:**
- Full script harness operational
- All tools accessible via scripts
- Performance optimized
- Security validated

**Library Spec:**
- Script execution API
- Tool composition patterns

**Ready For:** Next innovation project
