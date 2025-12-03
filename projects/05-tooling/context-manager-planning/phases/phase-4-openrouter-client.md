# Phase 4: OpenRouter Client (TDD)

## Goal

Implement OpenRouter API client with prompt building and Zod validation.

## Context

**Project:** `/Users/leemoore/code/codex-port-02/coding-agent-manager/`

## Test File

`test/openrouter-client.test.ts`

## TDD Red: Write Tests

### TC-09: Thinking Mode Threshold
### TC-14: API Key Missing
### TC-15: Malformed Compression Response

Plus tests for:
- Prompt construction (35% for compress, 10% for heavy-compress)
- JSON in markdown code blocks handling
- API error responses

Mock `global.fetch` for these tests.

## TDD Green: Implement Class

### `OpenRouterClient`

**Key methods:**

```typescript
constructor(config) {
  if (!config.apiKey) throw new ConfigMissingError("OPENROUTER_API_KEY");
  // Store config
}

async compress(text, level, useThinking): Promise<string> {
  const targetPercent = level === "compress" ? 35 : 10;
  const prompt = this.buildPrompt(text, targetPercent);
  const model = useThinking ? this.modelThinking : this.model;
  const response = await this.callAPI(prompt, model);
  return this.validateResponse(response);
}

private buildPrompt(text, targetPercent): string {
  // Use team-bruce inspired template
  // Include: target %, rules, JSON format instruction
  // Return prompt string
}

private async callAPI(prompt, model): Promise<unknown> {
  // POST to https://openrouter.ai/api/v1/chat/completions
  // Return message content
}

private validateResponse(response): string {
  // Strip markdown code blocks if present
  // Parse JSON
  // Validate with CompressionResponseSchema
  // Return response.text
}
```

**Prompt template** (from team-bruce):
```
You are TextCompressor. Rewrite the text below to approximately {targetPercent}% of its original length while preserving intent and factual meaning.

Token estimation: tokens ≈ ceil(characters / 4)

Rules:
- Preserve key entities, claims, and relationships
- Remove redundancy, filler, and hedging
- Keep fluent English
- If unsure about length, err shorter
- Do not include explanations or commentary outside the JSON
- Do not reference "I", "we", "user", "assistant", or conversation roles

Return exactly one JSON object: {"text": "your compressed text"}

Input text:
<<<CONTENT
{text}
CONTENT
```

## Verification

- [ ] All TC tests pass
- [ ] Thinking mode uses `:thinking` suffix
- [ ] ConfigMissingError thrown when no API key
- [ ] Malformed JSON triggers error
- [ ] Markdown code blocks stripped
- [ ] Prompt includes target percentage
- [ ] Existing tests pass
