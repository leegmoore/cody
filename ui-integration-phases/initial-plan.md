# UI Integration & Core Implementation Project

**Project Goal:** Wire all ported modules together into working CLI while evolving library and API specifications.

**Approach:** Iterative integration - add thinly, enhance progressively, circular refinement across subsystems.

**Output:** Functional CLI + Library API spec + REST API spec + Integration tests

---

## Phase 1: Basic Chat Foundation

**Add:**
- Responses API only
- API key auth only
- Simple text I/O CLI (no fancy UI)
- Conversation flow (create, send, receive)

**Wire:**
- ConversationManager → ModelClient → ResponseStream
- Basic turn processing
- JSONL persistence

**Library Spec:**
- ConversationManager interface (create, send, resume)
- Basic configuration

**Code Review:**
- conversation-manager integration
- client → history flow
- Persistence format

---

## Phase 2: Structured Tool Calling

**Add:**
- Tools: exec, applyPatch, readFile
- Tool execution in turns
- Approval flow (simple yes/no prompt)

**Wire:**
- ToolRouter → ToolRegistry → Tool execution
- Tool results → conversation history
- Approval system → CLI prompts

**Display:**
- Tool calls (text format)
- Tool results (stdout/stderr)
- Approval requests

**Library Spec:**
- Tool execution interface
- Approval callback pattern

**Code Review:**
- Tool routing logic
- Approval integration
- Result formatting

---

## Phase 3: Chat Completions Integration

**Add:**
- Chat API alongside Responses
- Provider selection

**Beef Up:**
- Client abstraction (dispatch between APIs)
- Error messages (API-specific)

**Wire:**
- Chat adapter → ResponseStream
- Conversion: Chat deltas → events

**Library Spec:**
- Multi-API client interface
- Provider configuration

**Code Review:**
- Adapter layer
- Conversion accuracy
- Event stream consistency

---

## Phase 4: ChatGPT OAuth

**Add:**
- OAuth flow
- Auth selection (API key vs OAuth)

**Beef Up:**
- Auth handling (token refresh)
- CLI auth prompts

**Wire:**
- Login flow → keyring storage
- Token management → client requests

**Library Spec:**
- AuthManager interface
- Multiple auth methods

**Code Review:**
- OAuth implementation
- Token lifecycle
- Security boundaries

---

## Phase 5: Messages API + More Tools

**Add:**
- Anthropic Messages API
- Tools: listDir, grepFiles, fileSearch

**Beef Up:**
- Tool display (categorize by type)
- Provider switching (smoother)

**Wire:**
- Messages adapter → ResponseStream
- New tools → registry
- Content blocks → history

**Library Spec:**
- Complete client abstraction
- Extended tool registry

**Code Review:**
- Messages API integration
- Tool addition pattern
- Thinking block handling

---

## Phase 6: Auth Completion + Tool Display

**Add:**
- Anthropic API key support
- Claude OAuth (if applicable)

**Beef Up:**
- Tool output formatting
- Error display across all APIs
- Approval UI (show context)

**Wire:**
- All auth methods working
- All providers authenticated

**Library Spec:**
- Complete auth abstraction
- Provider-agnostic auth

**Code Review:**
- Auth system completeness
- Provider parity
- Error consistency

---

## Phase 7: Full Provider Matrix

**Add:**
- Any remaining provider variants
- All auth × all providers tested

**Beef Up:**
- Provider switching (seamless)
- Multi-tool workflows (display nicely)
- Conversation list/resume UI

**Library Spec:**
- Provider capabilities interface
- Tool pack configuration

**Code Review:**
- Provider matrix coverage
- Feature flag handling
- Configuration patterns

---

## Phase 8: Tool Catalog Completion

**Add:**
- Remaining tools: viewImage, plan, mcp_resource
- Tool categorization in registry
- Tool pack system

**Beef Up:**
- Tool error messages
- Approval context (show what/why)
- MCP integration display

**Wire:**
- Complete tool registry
- All tools accessible
- Tool packs configurable

**Library Spec:**
- Complete tool catalog
- Tool metadata system

**REST API Spec:**
- Basic endpoints (create conversation, send message)
- Tool execution endpoints
- Session management

**Code Review:**
- Tool registry completeness
- MCP integration
- System cohesion

---

## After Phase 8

**Core Complete:**
- All ported modules wired
- All APIs supported
- All auth methods working
- All tools functional
- CLI operational

**Specs Complete:**
- Library API defined
- REST API designed
- Integration validated

**Ready For:**
- Script harness integration (separate project)
- Compression gradient (separate project)
- Offline processing (separate project)
- Context preprocessing (separate project)

---

## Project Principles

**Iterative:** Add thin, beef up progressively
**Circular:** Touch multiple subsystems each phase
**Incremental:** Every phase is functional
**Reviewed:** Deep reviews per focus area
**Specified:** Library/API specs evolve throughout
**Tested:** Integration tests accumulate

**Result:** Robust, reviewed, well-integrated core system ready for innovations.
