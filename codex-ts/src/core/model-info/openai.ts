/**
 * OpenAI model information lookup table.
 * Ported from codex-rs/core/src/openai_model_info.rs
 *
 * Provides context window sizes, max output tokens, and auto-compact limits
 * for known OpenAI models.
 */

// Shared constants for commonly used window/token sizes.
export const CONTEXT_WINDOW_272K = 272_000
export const MAX_OUTPUT_TOKENS_128K = 128_000

/**
 * Metadata about a model, particularly OpenAI models.
 * We may want to consider including details like pricing for input/output tokens,
 * though users will need to be able to override this in config, as this
 * information can get out of date.
 */
export interface ModelInfo {
  /** Size of the context window in tokens. This is the maximum size of the input context. */
  contextWindow: number

  /** Maximum number of output tokens that can be generated for the model. */
  maxOutputTokens: number

  /**
   * Token threshold where we should automatically compact conversation history.
   * This considers input tokens + output tokens of this turn.
   */
  autoCompactTokenLimit: number | undefined
}

/**
 * Creates a ModelInfo object with the given window and output token limits.
 * Automatically calculates auto_compact_token_limit as 90% of context window.
 */
function createModelInfo(contextWindow: number, maxOutputTokens: number): ModelInfo {
  return {
    contextWindow,
    maxOutputTokens,
    autoCompactTokenLimit: defaultAutoCompactLimit(contextWindow),
  }
}

/**
 * Default auto-compact limit is 90% of context window.
 */
function defaultAutoCompactLimit(contextWindow: number): number {
  return Math.floor((contextWindow * 9) / 10)
}

/**
 * Gets model information for a given model slug.
 * Returns undefined if the model is not recognized.
 *
 * @param modelSlug - The model identifier/slug (e.g., "gpt-4o", "gpt-5-codex-preview")
 * @returns ModelInfo if known, undefined otherwise
 */
export function getModelInfo(modelSlug: string): ModelInfo | undefined {
  // OSS models have a 128k shared token pool.
  // Arbitrarily splitting it: 3/4 input context, 1/4 output.
  // https://openai.com/index/gpt-oss-model-card/
  if (modelSlug === 'gpt-oss-20b') return createModelInfo(96_000, 32_000)
  if (modelSlug === 'gpt-oss-120b') return createModelInfo(96_000, 32_000)

  // https://platform.openai.com/docs/models/o3
  if (modelSlug === 'o3') return createModelInfo(200_000, 100_000)

  // https://platform.openai.com/docs/models/o4-mini
  if (modelSlug === 'o4-mini') return createModelInfo(200_000, 100_000)

  // https://platform.openai.com/docs/models/codex-mini-latest
  if (modelSlug === 'codex-mini-latest') return createModelInfo(200_000, 100_000)

  // As of Jun 25, 2025, gpt-4.1 defaults to gpt-4.1-2025-04-14.
  // https://platform.openai.com/docs/models/gpt-4.1
  if (modelSlug === 'gpt-4.1' || modelSlug === 'gpt-4.1-2025-04-14') {
    return createModelInfo(1_047_576, 32_768)
  }

  // As of Jun 25, 2025, gpt-4o defaults to gpt-4o-2024-08-06.
  // https://platform.openai.com/docs/models/gpt-4o
  if (modelSlug === 'gpt-4o' || modelSlug === 'gpt-4o-2024-08-06') {
    return createModelInfo(128_000, 16_384)
  }

  // https://platform.openai.com/docs/models/gpt-4o?snapshot=gpt-4o-2024-05-13
  if (modelSlug === 'gpt-4o-2024-05-13') return createModelInfo(128_000, 4_096)

  // https://platform.openai.com/docs/models/gpt-4o?snapshot=gpt-4o-2024-11-20
  if (modelSlug === 'gpt-4o-2024-11-20') return createModelInfo(128_000, 16_384)

  // https://platform.openai.com/docs/models/gpt-3.5-turbo
  if (modelSlug === 'gpt-3.5-turbo') return createModelInfo(16_385, 4_096)

  // Pattern matching for model families
  if (modelSlug.startsWith('gpt-5-codex')) {
    return createModelInfo(CONTEXT_WINDOW_272K, MAX_OUTPUT_TOKENS_128K)
  }

  if (modelSlug.startsWith('gpt-5')) {
    return createModelInfo(CONTEXT_WINDOW_272K, MAX_OUTPUT_TOKENS_128K)
  }

  if (modelSlug.startsWith('codex-')) {
    return createModelInfo(CONTEXT_WINDOW_272K, MAX_OUTPUT_TOKENS_128K)
  }

  // Unknown model
  return undefined
}
