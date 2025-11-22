# VALID MODELS - CANONICAL REFERENCE

**Last Updated:** 2025-01-22
**Purpose:** Authoritative list of valid model identifiers for code, tests, and documentation.

---

## CRITICAL RULES FOR AI AGENTS

### MANDATORY BEFORE REFERENCING ANY MODEL:

1. **READ THIS FILE FIRST** - Do not reference models from memory/training data
2. **USE EXACT STRINGS** - Copy/paste from lists below, no variations
3. **NO ASSUMPTIONS** - If model not listed, ASK user, do not guess
4. **NO PLACEHOLDERS** - Never use "gpt-4" or "model-name-here" as examples

### WHEN YOU SEE OLD MODELS IN EXISTING CODE:

- **DO NOT PROPAGATE** - Do not copy old model names into new code/docs
- **FLAG FOR USER** - Report outdated model references for cleanup
- **REPLACE WITH APPROVED** - Use models from this file only

### VIOLATION CONSEQUENCES:

User will call you out harshly. This is not personal - it's a critical engineering constraint to prevent model hallucination from infecting the codebase.

---

## OpenAI Models (Responses API, Chat Completions API)

### GPT-5 Series
```
gpt-5
gpt-5-mini
gpt-5-nano
gpt-5-pro
gpt-5-codex
gpt-5-codex-mini
```

### GPT-5.1 Series
```
gpt-5.1
gpt-5.1-pro
gpt-5.1-mini
gpt-5.1-nano
gpt-5.1-codex
gpt-5.1-codex-mini
gpt-5.1-codex-max
```

### Open Source Models (via OpenAI)
```
gpt-oss-20b
gpt-oss-120b
```

---

## Anthropic Models (Messages API)

### Claude 4.x Series
```
claude-opus-4.1
claude-sonnet-4.5
claude-haiku-4.5
```

---

## OpenRouter Models (Chat Completions API)

### Google Gemini
```
google/gemini-flash-2.0
```

**Limitations:**
- Does NOT support thinking/reasoning mode
- Uses Chat Completions API format (not Responses API)

---

## Default Models (Current System Defaults)

**Primary (OpenAI Responses API):**
```
gpt-5-mini
```

**Secondary (Anthropic Messages API):**
```
claude-sonnet-4.5
```

**Tertiary (OpenRouter):**
```
google/gemini-flash-2.0
```

---

## DEPRECATED MODELS (NEVER REFERENCE THESE)

### Forbidden - OpenAI Legacy
```
❌ gpt-4
❌ gpt-4-turbo
❌ gpt-4o
❌ gpt-4o-mini
❌ gpt-3.5-turbo
❌ text-davinci-003
```

### Forbidden - Anthropic Legacy
```
❌ claude-3-opus
❌ claude-3-sonnet
❌ claude-3-haiku
❌ claude-2
❌ claude-instant
```

### Forbidden - Google Legacy
```
❌ gemini-pro
❌ gemini-1.5-pro
❌ gemini-1.5-flash
```

---

## Model Selection Guidelines

### For Code Examples
**Always use:** `gpt-5-mini` (fastest, cheapest, universally available)

### For Tests
**Service-Mocked Tests:** Use string literal `'test-model'` (mocked, doesn't matter)
**Integration Tests:** Use one of the 3 defaults above

### For Documentation
**When explaining concepts:** Use `gpt-5-mini` or `{model-from-config}`
**When showing configuration:** Show all 3 defaults as options

---

## Updating This File

**When new models are released:**
1. User will update this file with exact strings from provider docs
2. Commit update with message: `docs: update MODELS.md for {provider} {model}`
3. Announce update in team/agent chat

**Do not update this file yourself unless explicitly instructed.**

---

## Model String Verification

**How to verify a model string is current:**
1. Check provider's official API documentation
2. Test with small API call (not speculation)
3. Confirm with user before adding to this list

**Do NOT:**
- Guess based on naming patterns
- Assume logical names (e.g., "gpt-6" doesn't exist yet)
- Reference models from blog posts/rumors without confirmation

---

## For Reference: Why This Matters

Model names in training data are **high-frequency tokens**. When an AI needs to fill a model placeholder, outdated names activate first. This pollutes:
- Test fixtures
- Example code
- Configuration files
- Documentation

Once an old model name enters the codebase, it spreads through copy/paste and becomes **technical debt** that wastes engineering hours.

**This file is the single source of truth to prevent that pollution.**
