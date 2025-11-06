/**
 * Types for apply-patch module
 */

/**
 * Errors that can occur during parsing
 */
export type ParseError =
  | { type: 'InvalidPatchError'; message: string }
  | { type: 'InvalidHunkError'; message: string; lineNumber: number };

/**
 * Errors that can occur during patch application
 */
export class ApplyPatchError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ApplyPatchError';
  }
}

export class IoError extends Error {
  constructor(
    public readonly context: string,
    public readonly source: Error
  ) {
    super(`${context}: ${source.message}`);
    this.name = 'IoError';
  }
}

/**
 * A chunk of changes within an UpdateFile hunk
 */
export interface UpdateFileChunk {
  /** Optional context line to locate the chunk */
  changeContext?: string;
  /** Lines to be replaced */
  oldLines: string[];
  /** Lines to replace with */
  newLines: string[];
  /** Whether this chunk is at the end of file */
  isEndOfFile: boolean;
}

/**
 * Types of patch operations
 */
export type Hunk =
  | { type: 'AddFile'; path: string; contents: string }
  | { type: 'DeleteFile'; path: string }
  | {
      type: 'UpdateFile';
      path: string;
      movePath?: string;
      chunks: UpdateFileChunk[];
    };

/**
 * Parsed patch with its hunks
 */
export interface ApplyPatchArgs {
  patch: string;
  hunks: Hunk[];
  workdir?: string;
}

/**
 * Result of parsing apply_patch command arguments
 */
export type MaybeApplyPatch =
  | { type: 'Body'; value: ApplyPatchArgs }
  | { type: 'ShellParseError'; error: ExtractHeredocError }
  | { type: 'PatchParseError'; error: ParseError }
  | { type: 'NotApplyPatch' };

/**
 * Errors from bash heredoc extraction
 */
export type ExtractHeredocError =
  | { type: 'CommandDidNotStartWithApplyPatch' }
  | { type: 'FailedToLoadBashGrammar'; error: Error }
  | { type: 'HeredocNotUtf8'; error: Error }
  | { type: 'FailedToParsePatchIntoAst' }
  | { type: 'FailedToFindHeredocBody' };

/**
 * File changes resulting from applying a patch
 */
export type ApplyPatchFileChange =
  | { type: 'Add'; content: string }
  | { type: 'Delete'; content: string }
  | {
      type: 'Update';
      unifiedDiff: string;
      movePath?: string;
      newContent: string;
    };

/**
 * Verified patch action ready to be applied
 */
export interface ApplyPatchAction {
  changes: Map<string, ApplyPatchFileChange>;
  patch: string;
  cwd: string;
}

/**
 * Result of verifying an apply_patch command
 */
export type MaybeApplyPatchVerified =
  | { type: 'Body'; value: ApplyPatchAction }
  | { type: 'ShellParseError'; error: ExtractHeredocError }
  | { type: 'CorrectnessError'; error: ApplyPatchError }
  | { type: 'NotApplyPatch' };

/**
 * Paths affected by applying a patch
 */
export interface AffectedPaths {
  added: string[];
  modified: string[];
  deleted: string[];
}

/**
 * Result of applying patch chunks to produce new content
 */
export interface ApplyPatchFileUpdate {
  unifiedDiff: string;
  content: string;
}

/**
 * Constants
 */
export const APPLY_PATCH_COMMANDS = ['apply_patch', 'applypatch'] as const;

export const BEGIN_PATCH_MARKER = '*** Begin Patch';
export const END_PATCH_MARKER = '*** End Patch';
export const ADD_FILE_MARKER = '*** Add File: ';
export const DELETE_FILE_MARKER = '*** Delete File: ';
export const UPDATE_FILE_MARKER = '*** Update File: ';
export const MOVE_TO_MARKER = '*** Move to: ';
export const EOF_MARKER = '*** End of File';
export const CHANGE_CONTEXT_MARKER = '@@ ';
export const EMPTY_CHANGE_CONTEXT_MARKER = '@@';
