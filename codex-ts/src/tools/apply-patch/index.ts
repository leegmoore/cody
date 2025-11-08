/**
 * Apply-patch tool - applies unified diff patches to files
 * Supports tree-sitter heredoc parsing for bash scripts
 */

export {
  applyPatch,
  type ApplyPatchOptions,
  type ApplyPatchResult,
} from "./applyPatch.js";
export {
  parsePatch,
  type ApplyPatchArgs,
  type Hunk,
  type UpdateFileChunk,
} from "./parser.js";
export { seekSequence } from "./seekSequence.js";
