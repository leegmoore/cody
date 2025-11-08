/**
 * Model family detection and capabilities.
 * Ported from codex-rs/core/src/model_family.rs
 *
 * A model family is a group of models that share certain characteristics.
 */

import { ReasoningSummaryFormat, ApplyPatchToolType } from './types'

// TODO: Import actual prompt content when available
const BASE_INSTRUCTIONS = '<!-- Base instructions placeholder -->'
const GPT_5_CODEX_INSTRUCTIONS = '<!-- GPT-5 Codex instructions placeholder -->'

/**
 * A model family is a group of models that share certain characteristics.
 */
export interface ModelFamily {
  /**
   * The full model slug used to derive this model family, e.g.
   * "gpt-4.1-2025-04-14".
   */
  slug: string

  /**
   * The model family name, e.g. "gpt-4.1". Note this should be able to be used
   * with getModelInfo from openai_model_info.
   */
  family: string

  /**
   * True if the model needs additional instructions on how to use the
   * "virtual" `apply_patch` CLI.
   */
  needsSpecialApplyPatchInstructions: boolean

  /**
   * Whether the `reasoning` field can be set when making a request to this
   * model family. Note it has `effort` and `summary` subfields (though
   * `summary` is optional).
   */
  supportsReasoningSummaries: boolean

  /**
   * Define if we need a special handling of reasoning summary
   */
  reasoningSummaryFormat: ReasoningSummaryFormat

  /**
   * This should be set to true when the model expects a tool named
   * "local_shell" to be provided. Its contract must be understood natively by
   * the model such that its description can be omitted.
   * See https://platform.openai.com/docs/guides/tools-local-shell
   */
  usesLocalShellTool: boolean

  /**
   * Whether this model supports parallel tool calls when using the
   * Responses API.
   */
  supportsParallelToolCalls: boolean

  /**
   * Present if the model performs better when `apply_patch` is provided as
   * a tool call instead of just a bash command
   */
  applyPatchToolType: ApplyPatchToolType | undefined

  /**
   * Instructions to use for querying the model
   */
  baseInstructions: string

  /**
   * Names of beta tools that should be exposed to this model family.
   */
  experimentalSupportedTools: string[]

  /**
   * Percentage of the context window considered usable for inputs, after
   * reserving headroom for system prompts, tool overhead, and model output.
   * This is applied when computing the effective context window seen by
   * consumers.
   */
  effectiveContextWindowPercent: number

  /**
   * If the model family supports setting the verbosity level when using Responses API.
   */
  supportVerbosity: boolean
}

/**
 * Creates a ModelFamily with default values, overridden by provided options.
 */
function createModelFamily(
  slug: string,
  family: string,
  overrides: Partial<Omit<ModelFamily, 'slug' | 'family'>> = {}
): ModelFamily {
  return {
    slug,
    family,
    needsSpecialApplyPatchInstructions: false,
    supportsReasoningSummaries: false,
    reasoningSummaryFormat: ReasoningSummaryFormat.None,
    usesLocalShellTool: false,
    supportsParallelToolCalls: false,
    applyPatchToolType: undefined,
    baseInstructions: BASE_INSTRUCTIONS,
    experimentalSupportedTools: [],
    effectiveContextWindowPercent: 95,
    supportVerbosity: false,
    ...overrides,
  }
}

/**
 * Returns a `ModelFamily` for the given model slug, or `undefined` if the slug
 * does not match any known model family.
 */
export function findFamilyForModel(slug: string): ModelFamily | undefined {
  if (slug.startsWith('o3')) {
    return createModelFamily(slug, 'o3', {
      supportsReasoningSummaries: true,
      needsSpecialApplyPatchInstructions: true,
    })
  } else if (slug.startsWith('o4-mini')) {
    return createModelFamily(slug, 'o4-mini', {
      supportsReasoningSummaries: true,
      needsSpecialApplyPatchInstructions: true,
    })
  } else if (slug.startsWith('codex-mini-latest')) {
    return createModelFamily(slug, 'codex-mini-latest', {
      supportsReasoningSummaries: true,
      usesLocalShellTool: true,
      needsSpecialApplyPatchInstructions: true,
    })
  } else if (slug.startsWith('gpt-4.1')) {
    return createModelFamily(slug, 'gpt-4.1', {
      needsSpecialApplyPatchInstructions: true,
    })
  } else if (slug.startsWith('gpt-oss') || slug.startsWith('openai/gpt-oss')) {
    return createModelFamily(slug, 'gpt-oss', {
      applyPatchToolType: ApplyPatchToolType.Function,
    })
  } else if (slug.startsWith('gpt-4o')) {
    return createModelFamily(slug, 'gpt-4o', {
      needsSpecialApplyPatchInstructions: true,
    })
  } else if (slug.startsWith('gpt-3.5')) {
    return createModelFamily(slug, 'gpt-3.5', {
      needsSpecialApplyPatchInstructions: true,
    })
  } else if (slug.startsWith('test-gpt-5-codex')) {
    return createModelFamily(slug, slug, {
      supportsReasoningSummaries: true,
      reasoningSummaryFormat: ReasoningSummaryFormat.Experimental,
      baseInstructions: GPT_5_CODEX_INSTRUCTIONS,
      experimentalSupportedTools: ['grep_files', 'list_dir', 'read_file', 'test_sync_tool'],
      supportsParallelToolCalls: true,
      supportVerbosity: true,
    })
  } else if (slug.startsWith('codex-exp-')) {
    // Internal models
    return createModelFamily(slug, slug, {
      supportsReasoningSummaries: true,
      reasoningSummaryFormat: ReasoningSummaryFormat.Experimental,
      baseInstructions: GPT_5_CODEX_INSTRUCTIONS,
      applyPatchToolType: ApplyPatchToolType.Freeform,
      experimentalSupportedTools: ['grep_files', 'list_dir', 'read_file'],
      supportsParallelToolCalls: true,
      supportVerbosity: true,
    })
  } else if (slug.startsWith('gpt-5-codex') || slug.startsWith('codex-')) {
    // Production models
    return createModelFamily(slug, slug, {
      supportsReasoningSummaries: true,
      reasoningSummaryFormat: ReasoningSummaryFormat.Experimental,
      baseInstructions: GPT_5_CODEX_INSTRUCTIONS,
      applyPatchToolType: ApplyPatchToolType.Freeform,
      supportVerbosity: false,
    })
  } else if (slug.startsWith('gpt-5')) {
    return createModelFamily(slug, 'gpt-5', {
      supportsReasoningSummaries: true,
      needsSpecialApplyPatchInstructions: true,
      supportVerbosity: true,
    })
  } else {
    return undefined
  }
}

/**
 * Derives a default model family for an unknown model.
 * This provides safe defaults for models not explicitly recognized.
 */
export function deriveDefaultModelFamily(model: string): ModelFamily {
  return {
    slug: model,
    family: model,
    needsSpecialApplyPatchInstructions: false,
    supportsReasoningSummaries: false,
    reasoningSummaryFormat: ReasoningSummaryFormat.None,
    usesLocalShellTool: false,
    supportsParallelToolCalls: false,
    applyPatchToolType: undefined,
    baseInstructions: BASE_INSTRUCTIONS,
    experimentalSupportedTools: [],
    effectiveContextWindowPercent: 95,
    supportVerbosity: false,
  }
}

// Re-export types
export { ReasoningSummaryFormat, ApplyPatchToolType } from './types'
