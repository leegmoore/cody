# Project 03: UI Work

**Status:** Active
**Date:** November 2025

---

## Overview

Iterative UI refinement work. Minimal planning, ad-hoc requests, quick turnarounds.

---

## Slices

### Slice 1: Thinking Cards

**Goal:** Get thinking/reasoning cards displaying properly in the UI.

**Context:**
- Reasoning output items already flow through the pipeline (verified by tests)
- UI has partial support but needs refinement
- Cards should show expandable thinking content

**Work:**
- Review current thinking card rendering
- Fix display issues
- Style refinement
- Test with OpenAI reasoning and Anthropic extended thinking

---

### Slice 2: Iterative Refinement

**Goal:** Ad-hoc UI fixes and improvements.

**Approach:**
- User goes through UI, identifies issues
- One-off requests for fixes/changes
- Quick turnaround, minimal spec overhead
- No formal planning - just fix and verify

**Typical requests:**
- Layout adjustments
- Styling fixes
- UX improvements
- Bug fixes
- Small feature additions

---

### Slice 3: Iframe-Based Layout Refactor

**Goal:** Refactor to iframe-based architecture for better modularity.

**Rationale:**
- Better isolation between components
- Easier to swap/upgrade individual pieces
- Potential for embedding in other contexts (Tauri, etc.)
- Cleaner boundary management

**Work (when ready):**
- Design iframe structure
- Implement container/frame communication
- Migrate existing components
- Test isolation and communication

---

## Process

- Slices 1 and 2 are active and interleaved
- Slice 3 is future work (after 1 and 2 stabilize)
- No formal specs for slice 2 - just do it
- Slice 1 may get a light spec if complexity warrants
- Slice 3 will need architecture planning before implementation
