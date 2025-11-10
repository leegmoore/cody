# Phase 2: Technical Design

**Phase:** Tool Integration
**Goal:** Add tool execution, approval flow, and tool result handling to conversation loop

---

## Integration Overview

(From TECH-APPROACH Section 3)

Phase 2 adds tool execution to the conversation flow. Models can now request tools (exec, readFile, applyPatch, etc.), CLI prompts user for approval, tools execute, results return to model. This activates the ToolRouter and approval system from the port for the first time. The conversation loop from Phase 1 remains unchanged—we're adding a branch point where Session detects tool calls and routes to ToolRouter instead of just returning to CLI.

---

## [Implementation Specifics - to be added by plan-cody-phase skill]

Actual signatures, mock examples, error handling, wiring code, reference locations...
