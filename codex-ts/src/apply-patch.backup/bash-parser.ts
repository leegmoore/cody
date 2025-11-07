/**
 * Bash heredoc parsing using tree-sitter
 *
 * TODO: This needs tree-sitter-bash integration
 * For now, this is a simplified version that handles basic cases
 */

import type {
  MaybeApplyPatch,
  ApplyPatchArgs,
  ExtractHeredocError,
} from './types.js';
import { APPLY_PATCH_COMMANDS } from './types.js';
import { parsePatch } from './parser.js';

/**
 * Maybe parse apply_patch from command arguments
 */
export function maybeParseApplyPatch(argv: string[]): MaybeApplyPatch {
  // Direct invocation: apply_patch <patch>
  if (
    argv.length === 2 &&
    APPLY_PATCH_COMMANDS.includes(argv[0] as 'apply_patch' | 'applypatch')
  ) {
    try {
      const parsed = parsePatch(argv[1]);
      return { type: 'Body', value: parsed };
    } catch (err) {
      return { type: 'PatchParseError', error: err as any };
    }
  }

  // Bash heredoc form: bash -lc "script"
  if (argv.length === 3 && argv[0] === 'bash' && argv[1] === '-lc') {
    const script = argv[2];
    try {
      const extracted = extractApplyPatchFromBash(script);
      if (extracted.type === 'Error') {
        return { type: 'ShellParseError', error: extracted.error };
      }
      const { body, workdir } = extracted;
      try {
        const parsed = parsePatch(body);
        if (workdir) {
          parsed.workdir = workdir;
        }
        return { type: 'Body', value: parsed };
      } catch (err) {
        return { type: 'PatchParseError', error: err as any };
      }
    } catch (err) {
      if (isExtractHeredocError(err)) {
        return { type: 'ShellParseError', error: err };
      }
      return { type: 'NotApplyPatch' };
    }
  }

  return { type: 'NotApplyPatch' };
}

/**
 * Extract heredoc from bash script
 * TODO: Replace with proper tree-sitter parsing
 */
function extractApplyPatchFromBash(
  script: string
):
  | { type: 'Success'; body: string; workdir?: string }
  | { type: 'Error'; error: ExtractHeredocError } {
  // Simple regex-based extraction for common patterns
  // Pattern 1: apply_patch <<'EOF'\n...\nEOF
  // Pattern 2: cd <path> && apply_patch <<'EOF'\n...\nEOF

  // Check for cd prefix
  const cdPattern = /^cd\s+(['"]?)([^\s'"]+)\1\s+&&\s+/;
  const cdMatch = script.match(cdPattern);
  const workdir = cdMatch ? cdMatch[2] : undefined;
  const remaining = cdMatch ? script.slice(cdMatch[0].length) : script;

  // Check for apply_patch with heredoc
  const heredocPattern =
    /^(?:apply_patch|applypatch)\s+<<['"]?EOF['"]?\n([\s\S]*?)\nEOF\s*$/;
  const heredocMatch = remaining.match(heredocPattern);

  if (heredocMatch) {
    return {
      type: 'Success',
      body: heredocMatch[1],
      workdir,
    };
  }

  return {
    type: 'Error',
    error: { type: 'CommandDidNotStartWithApplyPatch' },
  };
}

function isExtractHeredocError(err: any): err is ExtractHeredocError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err.type === 'CommandDidNotStartWithApplyPatch' ||
      err.type === 'FailedToLoadBashGrammar' ||
      err.type === 'HeredocNotUtf8' ||
      err.type === 'FailedToParsePatchIntoAst' ||
      err.type === 'FailedToFindHeredocBody')
  );
}
