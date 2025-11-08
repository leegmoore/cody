/**
 * Types for model-family module.
 * Ported from codex-rs/core/src/config/types.rs and tools/handlers/apply_patch.rs
 */

/**
 * Reasoning summary format for models that support reasoning.
 */
export enum ReasoningSummaryFormat {
  None = 'none',
  Experimental = 'experimental',
}

/**
 * Type of apply_patch tool to provide to the model.
 */
export enum ApplyPatchToolType {
  Freeform = 'freeform',
  Function = 'function',
}
