# Session Format Analysis Prompt - Group 4

**Task: Reverse-engineer Claude Code session file format**

## Background

Claude Code stores conversation sessions as JSONL files (one JSON object per line). We need to understand this format precisely to build tooling that can:
- Clone sessions with modifications
- Remove tool calls from session history
- Remove thinking blocks from session history
- Compress/summarize older turns

Our initial implementation made assumptions that don't match real session data. We need ground-truth analysis of actual session files to build a correct specification.

## Your Assignment

Analyze the following 5 Claude Code session files and produce a detailed specification document. You are reverse-engineering an undocumented format, so be thorough and note any uncertainties.

**Session files to analyze:**
1. `c98ff872-5542-4975-bdc0-a170c6dfeff8`
2. `64aaff1e-8289-494e-b6c4-eaf0c77d0f4e`
3. `3605c8ff-1765-40c3-952a-d03ef353e7fa`
4. `5117a753-c1be-4cc2-999c-f3036fb6f9f3`
5. `12b19743-c72c-4e41-aa91-08ae8c1e08fd`

**Session file location pattern:** `~/.claude/projects/<encoded-project-path>/<sessionId>.jsonl`

To find a session file:
```bash
find ~/.claude/projects -name "<sessionId>.jsonl"
```

---

## Analysis Requirements

### 1. Entry Types Inventory

For each session, catalog ALL entry types found in the `type` field:
- Count occurrences of each type
- Document the complete field structure for each type
- Note which fields are always present vs optional
- Note which fields contain nested objects

**Known types to look for:** `user`, `assistant`, `queue-operation`, `file-history-snapshot`, `summary` - but there may be others.

### 2. Message Structure Deep Dive

For `user` and `assistant` entry types, analyze the `message` object:

**Fields to examine:**
- `role` - values observed
- `model` - when present, what values
- `id` - format and uniqueness
- `stop_reason` - ALL values observed (null, "end_turn", "tool_use", others?)
- `stop_sequence` - when is this non-null?
- `content` - structure and content block types
- `usage` - token counting structure

**Content block types to document:**
- `text` - structure
- `tool_use` - structure, how `id` and `name` are stored
- `tool_result` - structure, how it links to `tool_use`
- `thinking` - structure, including `signature` field
- Any other types found

### 3. Turn Boundaries

A "turn" conceptually means: user sends a message -> Claude responds (possibly with tool calls) -> tool results return -> Claude continues -> eventually Claude stops and waits for user.

**Determine:**
- What field/value indicates Claude has finished responding to the user?
- Does `stop_reason: "end_turn"` appear? If not, what does?
- How do you distinguish "user starting a new turn" from "user providing tool_result"?
- Are there sessions where turn boundaries are ambiguous?

**Count per session:**
- How many "turns" (user-initiated exchanges) occurred?
- How many tool call loops occurred within turns?

### 4. UUID Chain Analysis

Every entry may have `uuid` and `parentUuid` fields forming a linked list.

**Determine:**
- Do ALL entries have these fields?
- Which entries have `uuid: null`?
- Is `parentUuid` always pointing to the immediately previous entry?
- Are there any gaps or broken chains?
- What happens to the chain when tool calls occur?

### 5. Tool Call Mechanics

**For tool_use (Claude calling a tool):**
- Which entry type contains it? (assistant)
- Where in the entry? (message.content array)
- What fields does a tool_use block have?
- Is there one entry per tool call, or can multiple tool calls be in one entry?

**For tool_result (result returning):**
- Which entry type contains it? (user)
- How does it reference the tool_use it's responding to? (tool_use_id)
- Can multiple tool_results be in one entry?

**Pairing analysis:**
- For each session, count tool_use blocks and tool_result blocks
- Are they always 1:1 paired?
- Are there any orphaned tool_use or tool_result blocks?

### 6. Streaming vs Complete Messages

Claude Code appears to write multiple JSONL entries for a single API response.

**Investigate:**
- What distinguishes a streaming chunk from a complete message?
- Look at `message.id` - are multiple entries sharing the same ID?
- Look at `message.usage.output_tokens` - do early entries have low counts?
- Look at `stop_reason` - is it null for streaming chunks, non-null for final?
- How should we identify "the final version" of a message?

### 7. Other Entry Types

**For `queue-operation`:**
- What is its purpose?
- What fields does it have?
- Does it have sessionId that needs updating during clone?

**For `file-history-snapshot`:**
- What is its purpose?
- What fields does it have?

**For `summary`:**
- What is its purpose?
- When does it appear?

**For any other types found:**
- Document fully

### 8. Cross-Session Patterns

After analyzing all 5 sessions:
- What patterns are consistent across all sessions?
- What variations exist?
- Are there version-specific differences? (check `version` field in entries)
- Any anomalies that appear in only some sessions?

---

## Output Requirements

Write your specification document to:
`/Users/leemoore/code/codex-port-02/projects/05-tooling/001-context-manager-01/session-format-analysis-04.md`

**Document structure:**

1. **Executive Summary** - Key findings in 5-10 bullet points

2. **Session Inventory** - Table showing each session analyzed with:
   - Session ID
   - Line count
   - Entry type breakdown
   - Turn count (your best determination)
   - Tool call count
   - Notable characteristics

3. **Entry Type Specifications** - For each entry type:
   - Complete field listing
   - Required vs optional fields
   - Sample JSON (truncated for readability)

4. **Turn Detection Algorithm** - Pseudocode for identifying turn boundaries

5. **Tool Call Pairing Algorithm** - Pseudocode for matching tool_use to tool_result

6. **Message Deduplication** - How to identify the "final" version of a message when multiple entries share the same message.id

7. **Caveats and Edge Cases** - Anything uncertain or potentially problematic

8. **Raw Data** - For each session, include:
   - Entry type counts
   - stop_reason value counts
   - content block type counts

Be thorough. Our implementation depends on this specification being accurate.
