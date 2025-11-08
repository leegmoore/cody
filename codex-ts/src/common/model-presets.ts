import { ReasoningEffort } from "../protocol/types.js";

/**
 * A reasoning effort option that can be surfaced for a model.
 */
export interface ReasoningEffortPreset {
  /** Effort level that the model supports */
  effort: ReasoningEffort;
  /** Short human description shown next to the effort in UIs */
  description: string;
}

/**
 * Metadata describing a Codex-supported model.
 */
export interface ModelPreset {
  /** Stable identifier for the preset */
  id: string;
  /** Model slug (e.g., "gpt-5") */
  model: string;
  /** Display name shown in UIs */
  displayName: string;
  /** Short human description shown in UIs */
  description: string;
  /** Reasoning effort applied when none is explicitly chosen */
  defaultReasoningEffort: ReasoningEffort;
  /** Supported reasoning effort options */
  supportedReasoningEfforts: ReasoningEffortPreset[];
  /** Whether this is the default model for new users */
  isDefault: boolean;
}

/**
 * Built-in list of model presets.
 *
 * @param _authMode - Optional auth mode parameter (for future use)
 * @returns Array of model presets
 *
 * @example
 * ```typescript
 * const models = builtinModelPresets();
 * const defaultModel = models.find(m => m.isDefault);
 * console.log(defaultModel.displayName); // "gpt-5-codex"
 * ```
 */
export function builtinModelPresets(_authMode?: string): ModelPreset[] {
  return [
    {
      id: "gpt-5-codex",
      model: "gpt-5-codex",
      displayName: "gpt-5-codex",
      description: "Optimized for coding tasks with many tools.",
      defaultReasoningEffort: ReasoningEffort.Medium,
      supportedReasoningEfforts: [
        {
          effort: ReasoningEffort.Low,
          description: "Fastest responses with limited reasoning",
        },
        {
          effort: ReasoningEffort.Medium,
          description: "Dynamically adjusts reasoning based on the task",
        },
        {
          effort: ReasoningEffort.High,
          description:
            "Maximizes reasoning depth for complex or ambiguous problems",
        },
      ],
      isDefault: true,
    },
    {
      id: "gpt-5",
      model: "gpt-5",
      displayName: "gpt-5",
      description: "Broad world knowledge with strong general reasoning.",
      defaultReasoningEffort: ReasoningEffort.Medium,
      supportedReasoningEfforts: [
        {
          effort: ReasoningEffort.Minimal,
          description: "Fastest responses with little reasoning",
        },
        {
          effort: ReasoningEffort.Low,
          description:
            "Balances speed with some reasoning; useful for straightforward queries and short explanations",
        },
        {
          effort: ReasoningEffort.Medium,
          description:
            "Provides a solid balance of reasoning depth and latency for general-purpose tasks",
        },
        {
          effort: ReasoningEffort.High,
          description:
            "Maximizes reasoning depth for complex or ambiguous problems",
        },
      ],
      isDefault: false,
    },
  ];
}
