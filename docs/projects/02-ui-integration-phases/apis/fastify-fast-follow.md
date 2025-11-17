# Fast-Follow Features for Cody API

**Status:** Deferred to Phase 2.3+
**Context:** Features discussed but not in Phase 6 scope

---

## Clone Conversation

### POST /api/v1/conversations/:id/clone
Clone conversation with parent reference

**Request:**
```json
{
  "title": "Cloned Version",
  "summary": "Copy of original",
  "tags": ["clone", "experiment"]
}
```
All fields optional

**Response 201:**
```json
{
  "conversationId": "new-uuid",
  "createdAt": "iso-8601",
  "updatedAt": "iso-8601",
  "parent": "original-conversation-id",
  "defaultProvider": "openai",
  "defaultPrimaryModel": "gpt-5-codex",
  "defaultSecondaryModel": null,
  "title": "Cloned Version",
  "summary": "Copy of original",
  "tags": ["clone", "experiment"],
  "agentRole": null,
  "history": [
    /* Copied from original conversation */
  ]
}
```

**Behavior:**
- Creates new conversation
- Copies full history from original
- Sets parent field to original ID
- Applies metadata overrides from request
- Original conversation unchanged

**Tests:**
- Clone without overrides → copies all metadata
- Clone with overrides → applies new metadata
- Clone non-existent → 404
- Parent field correctly set

---

## Autonomous Loop Runs

**Status:** Needs design work - deferred to Phase 2.5+

**Context:**
v/codex-port has a continuous run implementation, but the client interaction model needs rethinking:
- How does client check run progress without full event stream?
- How does client get summarized status ("turn 15 of 100, working on X")?
- How does client detect problems and get recommendations to intervene?
- What events does client need vs. what's internal?
- How does stop/pause/resume actually work from client perspective?

**TODO:**
- Design client-facing progress API (not just full event stream dump)
- Design problem detection and notification
- Design control flow (stop, pause, resume with proper state transitions)
- Reference v/codex-port implementation but improve client experience

**Defer until:** Phase 2.5 (after basic messaging works)

---

## Why These Are Deferred

**Clone:** Nice-to-have, not critical for basic API

**Autonomous Runs:** Complex feature requiring design work:
- Client progress visibility model
- Problem detection and reporting
- Control message handling
- Background worker pool
- Run state machine
- Multi-turn coordination

**Phase 6 focuses on:** Single message submission with streaming. Autonomous loops come later after we've proven the basic pattern.

---

## Event Stream Decorators - Summary Levels

**Status:** Deferred to Phase 2.6+

**Current Phase 6 Implementation:**
- `thinkingLevel=none|full` (default: full)
- `toolLevel=none|full` (default: none)

**Future Summary Levels:**

### Tool Call Summaries

**toolLevel Values:**
- `none` - No tool events
- `summary` - Tool name + first 4 lines of output + key for full details
- `minimal` - "Tool X called successfully" or "Tool X failed" + key
- `full` - Complete tool execution details (all output)

**Example (toolLevel=summary):**
```json
{
  "type": "tool_summary",
  "toolName": "readFile",
  "status": "success",
  "outputPreview": "Line 1\nLine 2\nLine 3\nLine 4\n...",
  "outputKey": "turn-123-event-5",
  "fullDetailsUrl": "/api/v1/turns/123/events/5"
}
```

**Example (toolLevel=minimal):**
```json
{
  "type": "tool_summary",
  "toolName": "exec",
  "status": "success",
  "outputKey": "turn-123-event-5"
}
```

### Thinking Summaries

**thinkingLevel Values:**
- `none` - No thinking events
- `summary` - First line + "..." + key for full thinking
- `full` - Complete thinking blocks (default)

**Example (thinkingLevel=summary):**
```json
{
  "type": "thinking_summary",
  "preview": "Let me analyze the requirements...",
  "thinkingKey": "turn-123-event-2",
  "fullDetailsUrl": "/api/v1/turns/123/events/2"
}
```

### Implementation Requirements

**For summarization to work:**
1. Event processor generates summaries during turn execution
2. Summaries stored in Redis with event keys
3. New endpoint: `GET /api/v1/turns/:turnId/events/:eventKey` - Retrieve full event details
4. Summary generation logic for:
   - Tool output truncation (first N lines)
   - Thinking block truncation (first line or sentence)
5. Redis storage for:
   - Full events: `turn:{turnId}:event:{eventKey}`
   - Summary data indexed separately

**Complexity:**
- Requires event processing layer
- Separate storage for full events vs. summaries
- Additional endpoint for detail retrieval
- More Redis operations per event

**Defer until:** After basic streaming proven stable (Phase 2.6+)
