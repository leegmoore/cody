# Phase 6: Manual Verification

## Goal

Test with real OpenRouter API against real sessions.

## Context

**Project:** `/Users/leemoore/code/codex-port-02/coding-agent-manager/`

## Prerequisites

1. API key in `.env.local`: `OPENROUTER_API_KEY=sk-or-v1-...`
2. Server running: `npm run dev`

## Test Cases

### Test 1: Basic Compression

1. Find session with 20+ turns
2. Clone with 50% compression:
   ```bash
   curl -X POST http://localhost:3000/api/v2/clone -H "Content-Type: application/json" \
     -d '{"sessionId":"<id>","compressionBands":[{"start":0,"end":50,"level":"compress"}]}'
   ```
3. Verify stats show compression
4. Resume: `claude --dangerously-skip-permissions --resume <new-id>`
5. Check: session loads, compressed content coherent

### Test 2: Heavy Compression

1. Clone with heavy compression, compare reduction to Test 1

### Test 3: Multiple Bands

1. Clone with `[0-30: heavy, 50-80: compress]`
2. Manually verify different compression levels in history

### Test 4: Combined Operations

1. Clone with all options: tool removal + thinking removal + compression
2. Verify all three work together

### Test 5: Thinking Mode

1. Clone session with long messages
2. Verify thinking mode used (check logs or OpenRouter dashboard)

### Test 6: Failure Handling

1. Set very low timeout: `COMPRESSION_TIMEOUT_INITIAL=100`
2. Verify clone completes despite timeouts

## Quality Checks

For each clone:
- Semantic preservation - key points preserved?
- Coherence - readable and fluent?
- Token reduction - meaningful savings?
- Session usability - can resume and continue?

## Documentation

Create `docs/compression-verification-results.md`:
- Compression quality assessment
- Performance characteristics
- Failure patterns observed
- Recommended settings

## Verification

- [ ] All 6 manual tests pass
- [ ] Cloned sessions load in Claude Code
- [ ] Compressed content quality acceptable
- [ ] Performance acceptable
- [ ] Results documented
