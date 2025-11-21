# Provider & Model System Design Brainstorm

**Status:** Initial design brainstorm - needs further hardening and planning
**Date:** 2025-11-16
**Context:** API design session exploring how providers, models, configs, and system prompts should be structured

---

## Core Design Decisions

### 1. Hardcoded Provider Enum (Simple & Inflexible by Design)

**Decision:** Providers are a fixed, hardcoded set - not user-extensible slugs.

```typescript
enum Provider {
  OpenAI = "openai",        // Locked to Responses API
  Anthropic = "anthropic",  // Locked to Messages API
  Google = "google",        // Locked to Content/Parts API
  OpenRouter = "openrouter" // Locked to Chat Completions API
}
```

**Rationale:** Prefer simplicity and inflexibility over indirection and complication. Each provider requires custom adapter code anyway. No value in making providers "pluggable" at this stage.

**Trade-off Accepted:** Users cannot add custom providers without code changes. This is fine for current needs.

---

### 2. Provider-API Lock (One API Per Provider)

**Decision:** Each provider is locked to a single wire API protocol.

- `openai` → Responses API only (until we need to expand)
- `anthropic` → Messages API only
- `google` → Content/Parts API only (native Gemini format)
- `openrouter` + others → Chat Completions API only

**Rationale:** Simplifies the abstraction. No need to select both provider AND API. Provider selection implies the API.

**Future Expansion:** If we need OpenAI Chat Completions support, we can add it later. Not needed now.

---

### 3. Provider Adapter Structure

Each provider has an **Adapter** that encapsulates all provider-specific logic.

**Adapter Responsibilities:**

1. **Curated Model Catalog:**
   - Maintains list of supported models for this provider
   - Each model entry includes:
     - Model slug (with version): `"gpt-5-codex-2024-11-20"`
     - Display name: `"GPT-5 Codex (Nov 2024)"`
     - Default config: `{ temperature: 0.7, reasoningEffort: "high" }`
     - Capabilities metadata: context window, supports tools, supports thinking, etc.

2. **Request Adapter:**
   - Transforms our internal conversation format → provider's wire format
   - Handles provider-specific structures (Responses events vs Messages content blocks vs Gemini parts)

3. **Response/Stream Adapter:**
   - Transforms provider's streaming format → our standard streaming format
   - Normalizes SSE events, chunks, deltas into common `ResponseItems[]`

4. **Config Schema:**
   - Provider-specific options (reasoning, thinking, grounding, verbosity, etc.)
   - Validation and defaults

---

### 4. Model Configuration

**Model Selection Includes:**
- `providerSlug: string` - Which provider (from hardcoded enum)
- `modelSlug: string` - Which model (from provider's catalog)
- `modelConfig?: object` - Weakly-typed, provider-specific settings

**Default Config Per Model:**
Each model in the catalog has defaults:
```typescript
{
  slug: "gpt-5-codex",
  defaultConfig: {
    temperature: 0.7,
    reasoningEffort: "high",
    verbosity: "medium",
    maxTokens: 16384
  }
}
```

**Overridable at:**
- System/global level (lowest priority)
- Conversation creation (medium priority)
- Individual turn (highest priority)

---

### 5. System Prompt as Co-Selected Resource

**Decision:** System prompts are selected alongside model config, not automatically coupled.

**System Prompt Catalog:**
- Named/slugged prompts: `"coder-aggressive"`, `"planner-detailed"`, `"general"`
- Some provider/model-optimized: `"gpt-5-codex-default"`, `"claude-sonnet-coder"`
- Managed as separate resources (versioned, editable, A/B testable)

**Selection Pattern:**
```typescript
{
  provider: "openai",
  model: "gpt-5-codex",
  modelConfig: { temperature: 0.7 },
  systemPrompt: "coder-aggressive"  // Selected together, not auto-coupled
}
```

**Selection Levels:**
- Turn override (highest priority)
- Conversation default
- System/global default (lowest priority)

---

### 6. Agent-Maintained Model Catalog

**Problem:** Hardcoded model lists go stale as providers release new versions.

**Solution:** Automate maintenance with a monitoring agent.

**The Agent:**
- Watches provider announcements (OpenAI blog, Anthropic releases, Google AI updates)
- Monitors for new model versions
- Has instructions for integration criteria
- Submits PR to update hardcoded model lists same-day
- Texts user for decisions when needed

**What It Updates:**
- New model entries in provider adapter catalogs
- Default configs if provider changes defaults
- Deprecation warnings
- Capability metadata

**Benefits:**
- Keep code simple (hardcoded)
- Stay current (automated updates)
- Maintain oversight (agent asks questions)
- Same-day response to model drops

---

## API Structure (Sketch)

### Provider & Model Discovery

```
GET /providers
→ Returns list of supported providers

GET /providers/{provider}/models
→ Returns curated model catalog for that provider

GET /providers/{provider}/models/{modelSlug}
→ Returns model metadata (capabilities, default config)
```

### Conversation Creation with Model Selection

```
POST /conversations
{
  provider: "openai",
  model: "gpt-5-codex",
  modelConfig: { temperature: 0.7, reasoningEffort: "high" },
  systemPrompt: "coder-aggressive",
  // ... other conversation metadata
}
```

### Turn-Level Model Override

```
POST /conversations/{id}/messages
{
  message: "...",
  override: {
    provider: "anthropic",      // Try Claude for this turn
    model: "claude-sonnet-4",
    modelConfig: { thinking: true },
    systemPrompt: "planner"
  }
}
```

---

## Open Questions & Areas Needing Refinement

1. **Config Presets:**
   - Should we add named config bundles? (`"coding"`, `"creative"`, `"precise"`)
   - Or keep explicit config objects?
   - How do presets compose with overrides?

2. **Tool Selection:**
   - How do tool packs relate to model/provider selection?
   - Some models/providers may not support all tools
   - How is this validated/constrained?

3. **Prompt Management:**
   - How are system prompts stored/versioned?
   - UI for browsing/editing prompts?
   - Prompt testing/validation workflow?

4. **Model Capability Validation:**
   - How do we validate requested features are supported?
   - Example: requesting `thinking: true` with a model that doesn't support it
   - Fail early or graceful degradation?

5. **Multi-API Support Per Provider:**
   - Future: support both Responses and Chat for OpenAI?
   - Would require provider-API combinations as distinct adapters
   - Defer until concrete need arises

---

## Implementation Notes

**Current State:**
- `ModelProviderInfo` in `core/client/model-provider-info.ts` has basic provider metadata
- `WireApi` enum exists with Responses, Chat, Messages
- Need to add: Content/Parts for Google
- Need to refactor: Make providers fixed enum, add model catalogs per provider

**Next Steps:**
1. Define Provider enum and adapter interface
2. Implement model catalogs for each provider
3. Define model config schemas (weakly typed, provider-specific)
4. Build provider/model discovery endpoints
5. Implement selection at conversation and turn levels
6. Design system prompt catalog and selection
7. Build agent for automated model catalog maintenance

---

## Summary

This design prioritizes **simplicity and maintainability** over **flexibility and abstraction**.

Key principles:
- Fixed provider set (hardcoded enum)
- One API per provider (locked)
- Curated model lists (we decide what's supported)
- Adapters handle all provider-specific logic
- Agent automation handles maintenance (not complex extensibility code)


---

## Refined Design: Provider Gateways & Active Configs (2025-11-20)

**Status:** Consolidated design direction following deep dive session.

### 1. Terminology Shift: Vendor vs. Gateway

To resolve ambiguity and prevent "Provider" overloading, we are splitting the concept:

*   **Model Vendor (Metadata):** The company entity (e.g., OpenAI, Anthropic, Google). Used primarily for grouping in the UI and branding.
*   **Provider Gateway (Functional Unit):** The specific service endpoint and protocol implementation (e.g., `openai-responses`, `openai-chat`, `anthropic-messages`).
    *   This solves the "Provider-API Lock" brittleness. OpenAI can have multiple gateways (`responses` vs `chat`) if needed for legacy support, without monolithic conditional logic.

### 2. Provider Gateway Structure

The **Provider Gateway** is the primary architectural unit. It encapsulates:

1.  **Wire Adapter:** The code that speaks the specific protocol (Responses vs Chat vs Messages).
2.  **Model Registry:** A curated list of specific models *supported by this gateway*.
    *   *Crucial:* Models are data entries in this registry, not hardcoded constants in the adapter.
    *   Entries include capabilities flags: `supportsThinking`, `supportsTools`.
3.  **Config Schema (Zod):** The specific configuration knobs available for this gateway.
    *   *Example:* `openai-responses` requires `reasoning_effort` (Enum).
    *   *Example:* `anthropic-messages` requires `budget_tokens` (Integer).

### 3. Active Config Registry (Saved Presets)

To manage the combinatorial explosion of options (Gateway x Model x Config), we introduce **Active Configs**.

*   **Concept:** A first-class resource that snapshots a valid configuration tuple.
*   **Key/Slug:** A human-readable identifier (e.g., `smart-coder`, `fast-chat`).
*   **Structure:**
    ```typescript
    interface ActiveConfigEntry {
      slug: string;             // "smart-coder"
      providerGatewayId: string; // "openai-responses"
      modelId: string;          // "model-reasoning-v1"
      config: Record<string, any>; // { reasoning_effort: "high" }
    }
    ```
*   **Usage:** The API and UI primarily interact with `slugs`. Users select "Smart Coder", not a raw tuple of provider/model/params.

### 4. Dynamic Configuration & Validation

We do *not* normalize configuration knobs into a generic super-object. We lean into the differences.

*   **Validation:** When an `ActiveConfigEntry` is saved or used, the system looks up the `providerGatewayId`, retrieves its specific `Config Schema`, and validates the `config` payload against it.
*   **UI Generation:** The Client queries the Gateway for its schema (filtered by the selected Model's capabilities) to render the correct form fields (e.g., Dropdown vs. Number Input).

### 5. No-Hardcoding Mandate

*   **Models are Data:** Specific model IDs (e.g., `gpt-4o`, `claude-3-5-sonnet`) MUST NOT appear as hardcoded switch-case constants in the application logic. They exist only as string entries within the Gateway Registries.
*   **Future-Proofing:** This ensures that when a vendor drops a new model, we only update the Registry data, not the Adapter code.
