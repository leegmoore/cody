/**
 * Apply patch hunks to files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { diffLines } from 'diff';
import type {
  Hunk,
  UpdateFileChunk,
  AffectedPaths,
  ApplyPatchFileUpdate,
  ApplyPatchFileChange,
  ApplyPatchAction,
  MaybeApplyPatchVerified,
  ApplyPatchArgs,
} from './types.js';
import { ApplyPatchError, IoError } from './types.js';
import { parsePatch, resolveHunkPath } from './parser.js';
import { seekSequence } from './seek-sequence.js';

/**
 * Apply a patch string to the filesystem
 */
export function applyPatch(patch: string): AffectedPaths {
  const parsed = parsePatch(patch);
  return applyHunks(parsed.hunks);
}

/**
 * Apply hunks to the filesystem
 */
export function applyHunks(hunks: Hunk[]): AffectedPaths {
  return applyHunksToFiles(hunks);
}

/**
 * Apply hunks to files, returning affected paths
 */
function applyHunksToFiles(hunks: Hunk[]): AffectedPaths {
  if (hunks.length === 0) {
    throw new ApplyPatchError('No files were modified.');
  }

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const hunk of hunks) {
    switch (hunk.type) {
      case 'AddFile': {
        const { path: filePath, contents } = hunk;
        const dir = path.dirname(filePath);
        if (dir && dir !== '.') {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, contents);
        added.push(filePath);
        break;
      }

      case 'DeleteFile': {
        const { path: filePath } = hunk;
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          throw new ApplyPatchError(
            `Failed to delete file ${filePath}`,
            err as Error
          );
        }
        deleted.push(filePath);
        break;
      }

      case 'UpdateFile': {
        const { path: filePath, movePath, chunks } = hunk;
        const { newContents } = deriveNewContentsFromChunks(filePath, chunks);

        if (movePath) {
          const dest = movePath;
          const dir = path.dirname(dest);
          if (dir && dir !== '.') {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(dest, newContents);
          fs.unlinkSync(filePath);
          modified.push(dest);
        } else {
          fs.writeFileSync(filePath, newContents);
          modified.push(filePath);
        }
        break;
      }
    }
  }

  return { added, modified, deleted };
}

/**
 * Derive new file contents from applying chunks
 */
function deriveNewContentsFromChunks(
  filePath: string,
  chunks: UpdateFileChunk[]
): { originalContents: string; newContents: string } {
  let originalContents: string;
  try {
    originalContents = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new IoError(
      `Failed to read file to update ${filePath}`,
      err as Error
    );
  }

  let originalLines = originalContents.split('\n');

  // Drop the trailing empty element that results from the final newline
  if (
    originalLines.length > 0 &&
    originalLines[originalLines.length - 1] === ''
  ) {
    originalLines.pop();
  }

  const replacements = computeReplacements(originalLines, filePath, chunks);
  let newLines = applyReplacements(originalLines, replacements);

  // Ensure trailing newline
  if (newLines.length === 0 || newLines[newLines.length - 1] !== '') {
    newLines.push('');
  }

  const newContents = newLines.join('\n');
  return { originalContents, newContents };
}

/**
 * Compute replacements needed to transform original lines
 */
function computeReplacements(
  originalLines: string[],
  filePath: string,
  chunks: UpdateFileChunk[]
): Array<[number, number, string[]]> {
  const replacements: Array<[number, number, string[]]> = [];
  let lineIndex = 0;

  for (const chunk of chunks) {
    // If chunk has a change_context, seek to it
    if (chunk.changeContext !== undefined) {
      const idx = seekSequence(
        originalLines,
        [chunk.changeContext],
        lineIndex,
        false
      );
      if (idx === undefined) {
        throw new ApplyPatchError(
          `Failed to find context '${chunk.changeContext}' in ${filePath}`
        );
      }
      lineIndex = idx + 1;
    }

    // Pure addition (no old lines)
    if (chunk.oldLines.length === 0) {
      const insertionIdx =
        originalLines.length > 0 &&
        originalLines[originalLines.length - 1] === ''
          ? originalLines.length - 1
          : originalLines.length;
      replacements.push([insertionIdx, 0, chunk.newLines]);
      continue;
    }

    // Try to find old lines in the file
    let pattern = chunk.oldLines;
    let found = seekSequence(
      originalLines,
      pattern,
      lineIndex,
      chunk.isEndOfFile
    );

    let newSlice = chunk.newLines;

    // If not found and pattern ends with empty string, retry without it
    if (
      found === undefined &&
      pattern.length > 0 &&
      pattern[pattern.length - 1] === ''
    ) {
      pattern = pattern.slice(0, -1);
      if (newSlice.length > 0 && newSlice[newSlice.length - 1] === '') {
        newSlice = newSlice.slice(0, -1);
      }
      found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile);
    }

    if (found !== undefined) {
      replacements.push([found, pattern.length, newSlice]);
      lineIndex = found + pattern.length;
    } else {
      throw new ApplyPatchError(
        `Failed to find expected lines in ${filePath}:\n${chunk.oldLines.join('\n')}`
      );
    }
  }

  // Sort replacements by start index
  replacements.sort((a, b) => a[0] - b[0]);

  return replacements;
}

/**
 * Apply replacements to lines in reverse order
 */
function applyReplacements(
  lines: string[],
  replacements: Array<[number, number, string[]]>
): string[] {
  const result = [...lines];

  // Apply in reverse order to avoid index shifting
  for (let i = replacements.length - 1; i >= 0; i--) {
    const [startIdx, oldLen, newSegment] = replacements[i];

    // Remove old lines
    result.splice(startIdx, oldLen);

    // Insert new lines
    result.splice(startIdx, 0, ...newSegment);
  }

  return result;
}

/**
 * Generate unified diff from applying chunks
 */
export function unifiedDiffFromChunks(
  filePath: string,
  chunks: UpdateFileChunk[]
): ApplyPatchFileUpdate {
  return unifiedDiffFromChunksWithContext(filePath, chunks, 1);
}

/**
 * Generate unified diff with specified context lines
 */
export function unifiedDiffFromChunksWithContext(
  filePath: string,
  chunks: UpdateFileChunk[],
  contextLines: number
): ApplyPatchFileUpdate {
  const { originalContents, newContents } = deriveNewContentsFromChunks(
    filePath,
    chunks
  );

  // Use diff library to generate unified diff
  const patches = diffLines(originalContents, newContents);

  // Build unified diff format
  let unifiedDiff = '';
  let oldLine = 1;
  let newLine = 1;
  const hunkGroups: Array<{
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: string[];
  }> = [];

  let currentHunk: {
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: string[];
  } | null = null;

  for (const part of patches) {
    if (part.added) {
      if (!currentHunk) {
        currentHunk = {
          oldStart: oldLine,
          oldCount: 0,
          newStart: newLine,
          newCount: 0,
          lines: [],
        };
      }
      const lines = part.value.split('\n');
      // Remove last empty line if present
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      for (const line of lines) {
        currentHunk.lines.push('+' + line);
        currentHunk.newCount++;
        newLine++;
      }
    } else if (part.removed) {
      if (!currentHunk) {
        currentHunk = {
          oldStart: oldLine,
          oldCount: 0,
          newStart: newLine,
          newCount: 0,
          lines: [],
        };
      }
      const lines = part.value.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      for (const line of lines) {
        currentHunk.lines.push('-' + line);
        currentHunk.oldCount++;
        oldLine++;
      }
    } else {
      const lines = part.value.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      for (const line of lines) {
        if (!currentHunk) {
          oldLine++;
          newLine++;
        } else {
          currentHunk.lines.push(' ' + line);
          currentHunk.oldCount++;
          currentHunk.newCount++;
          oldLine++;
          newLine++;
        }
      }
      // Finalize current hunk if we have context
      if (currentHunk && currentHunk.lines.length > 0) {
        hunkGroups.push(currentHunk);
        currentHunk = null;
      }
    }
  }

  // Finalize last hunk
  if (currentHunk && currentHunk.lines.length > 0) {
    hunkGroups.push(currentHunk);
  }

  // Build unified diff string
  for (const hunk of hunkGroups) {
    // Format: @@ -oldStart,oldCount +newStart,newCount @@
    unifiedDiff += `@@ -${hunk.oldStart}`;
    if (hunk.oldCount !== 1) {
      unifiedDiff += `,${hunk.oldCount}`;
    }
    unifiedDiff += ` +${hunk.newStart}`;
    if (hunk.newCount !== 1) {
      unifiedDiff += `,${hunk.newCount}`;
    }
    unifiedDiff += ' @@\n';
    unifiedDiff += hunk.lines.join('\n') + '\n';
  }

  return {
    unifiedDiff,
    content: newContents,
  };
}

/**
 * Print summary of changes
 */
export function printSummary(affected: AffectedPaths): string {
  let output = 'Success. Updated the following files:\n';
  for (const filePath of affected.added) {
    output += `A ${filePath}\n`;
  }
  for (const filePath of affected.modified) {
    output += `M ${filePath}\n`;
  }
  for (const filePath of affected.deleted) {
    output += `D ${filePath}\n`;
  }
  return output;
}

/**
 * Parse and verify apply_patch command with working directory
 */
export function maybeParseApplyPatchVerified(
  argv: string[],
  cwd: string
): MaybeApplyPatchVerified {
  // Check for implicit invocation (raw patch without apply_patch command)
  if (argv.length === 1) {
    try {
      parsePatch(argv[0]);
      return {
        type: 'CorrectnessError',
        error: new ApplyPatchError(
          "patch detected without explicit call to apply_patch. Rerun as [\"apply_patch\", \"<patch>\"]"
        ),
      };
    } catch {
      // Not a patch, continue
    }
  }

  if (
    argv.length === 3 &&
    argv[0] === 'bash' &&
    argv[1] === '-lc'
  ) {
    try {
      parsePatch(argv[2]);
      return {
        type: 'CorrectnessError',
        error: new ApplyPatchError(
          "patch detected without explicit call to apply_patch. Rerun as [\"apply_patch\", \"<patch>\"]"
        ),
      };
    } catch {
      // Not a patch, continue
    }
  }

  // TODO: Parse bash heredoc form and extract patch
  // For now, just handle direct invocation

  if (argv.length !== 2) {
    return { type: 'NotApplyPatch' };
  }

  const [cmd, patchText] = argv;
  if (cmd !== 'apply_patch' && cmd !== 'applypatch') {
    return { type: 'NotApplyPatch' };
  }

  let parsed: ApplyPatchArgs;
  try {
    parsed = parsePatch(patchText);
  } catch (err) {
    return {
      type: 'CorrectnessError',
      error: new ApplyPatchError('Failed to parse patch', err as Error),
    };
  }

  const { hunks, patch } = parsed;
  const effectiveCwd = cwd;

  const changes = new Map<string, ApplyPatchFileChange>();
  for (const hunk of hunks) {
    const hunkPath = resolveHunkPath(hunk, effectiveCwd);

    switch (hunk.type) {
      case 'AddFile': {
        changes.set(hunkPath, {
          type: 'Add',
          content: hunk.contents,
        });
        break;
      }

      case 'DeleteFile': {
        let content: string;
        try {
          content = fs.readFileSync(hunkPath, 'utf-8');
        } catch (err) {
          return {
            type: 'CorrectnessError',
            error: new IoError(
              `Failed to read ${hunkPath}`,
              err as Error
            ),
          };
        }
        changes.set(hunkPath, {
          type: 'Delete',
          content,
        });
        break;
      }

      case 'UpdateFile': {
        let update: ApplyPatchFileUpdate;
        try {
          update = unifiedDiffFromChunks(hunkPath, hunk.chunks);
        } catch (err) {
          return {
            type: 'CorrectnessError',
            error:
              err instanceof ApplyPatchError
                ? err
                : new ApplyPatchError('Failed to compute diff', err as Error),
          };
        }
        changes.set(hunkPath, {
          type: 'Update',
          unifiedDiff: update.unifiedDiff,
          movePath: hunk.movePath ? path.resolve(cwd, hunk.movePath) : undefined,
          newContent: update.content,
        });
        break;
      }
    }
  }

  return {
    type: 'Body',
    value: {
      changes,
      patch,
      cwd: effectiveCwd,
    },
  };
}
