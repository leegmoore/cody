/**
 * Parser for patch text format
 *
 * The official grammar for the apply-patch format is:
 *
 * start: begin_patch hunk+ end_patch
 * begin_patch: "*** Begin Patch" LF
 * end_patch: "*** End Patch" LF?
 *
 * hunk: add_hunk | delete_hunk | update_hunk
 * add_hunk: "*** Add File: " filename LF add_line+
 * delete_hunk: "*** Delete File: " filename LF
 * update_hunk: "*** Update File: " filename LF change_move? change?
 * filename: /(.+)/
 * add_line: "+" /(.+)/ LF -> line
 *
 * change_move: "*** Move to: " filename LF
 * change: (change_context | change_line)+ eof_line?
 * change_context: ("@@" | "@@ " /(.+)/) LF
 * change_line: ("+" | "-" | " ") /(.+)/ LF
 * eof_line: "*** End of File" LF
 */

import * as path from "node:path";
import type {
  ParseError,
  Hunk,
  UpdateFileChunk,
  ApplyPatchArgs,
} from "./types.js";
import {
  BEGIN_PATCH_MARKER,
  END_PATCH_MARKER,
  ADD_FILE_MARKER,
  DELETE_FILE_MARKER,
  UPDATE_FILE_MARKER,
  MOVE_TO_MARKER,
  EOF_MARKER,
  CHANGE_CONTEXT_MARKER,
  EMPTY_CHANGE_CONTEXT_MARKER,
} from "./types.js";

// Currently parse in lenient mode for all models (matching Rust behavior)
const PARSE_IN_STRICT_MODE = false;

type ParseMode = "Strict" | "Lenient";

/**
 * Parse patch text into structured hunks
 */
export function parsePatch(patch: string): ApplyPatchArgs {
  const mode: ParseMode = PARSE_IN_STRICT_MODE ? "Strict" : "Lenient";
  return parsePatchText(patch, mode);
}

/**
 * Internal parsing function with mode selection
 */
function parsePatchText(patch: string, mode: ParseMode): ApplyPatchArgs {
  const lines = patch.trim().split("\n");

  let processedLines: string[];
  try {
    checkPatchBoundariesStrict(lines);
    processedLines = lines;
  } catch (e) {
    if (mode === "Strict") {
      throw e;
    }
    // Try lenient mode
    processedLines = checkPatchBoundariesLenient(lines, e as ParseError);
  }

  const hunks: Hunk[] = [];
  const lastLineIndex = processedLines.length - 1;
  let remainingLines = processedLines.slice(1, lastLineIndex);
  let lineNumber = 2;

  while (remainingLines.length > 0) {
    const [hunk, hunkLines] = parseOneHunk(remainingLines, lineNumber);
    hunks.push(hunk);
    lineNumber += hunkLines;
    remainingLines = remainingLines.slice(hunkLines);
  }

  return {
    patch: processedLines.join("\n"),
    hunks,
  };
}

/**
 * Check that patch starts with Begin and ends with End markers
 */
function checkPatchBoundariesStrict(lines: string[]): void {
  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];

  if (firstLine !== BEGIN_PATCH_MARKER) {
    throw {
      type: "InvalidPatchError",
      message: "The first line of the patch must be '*** Begin Patch'",
    } as ParseError;
  }

  if (lastLine !== END_PATCH_MARKER) {
    throw {
      type: "InvalidPatchError",
      message: "The last line of the patch must be '*** End Patch'",
    } as ParseError;
  }
}

/**
 * Try lenient parsing for heredoc format
 */
function checkPatchBoundariesLenient(
  originalLines: string[],
  originalError: ParseError,
): string[] {
  if (originalLines.length < 4) {
    throw originalError;
  }

  const first = originalLines[0];
  const last = originalLines[originalLines.length - 1];

  // Check for heredoc markers
  if (
    (first === "<<EOF" || first === "<<'EOF'" || first === '<<"EOF"') &&
    last.endsWith("EOF")
  ) {
    const innerLines = originalLines.slice(1, originalLines.length - 1);
    checkPatchBoundariesStrict(innerLines);
    return innerLines;
  }

  throw originalError;
}

/**
 * Parse a single hunk from the lines
 */
function parseOneHunk(lines: string[], lineNumber: number): [Hunk, number] {
  const firstLine = lines[0].trim();

  // Add File
  if (firstLine.startsWith(ADD_FILE_MARKER)) {
    const filePath = firstLine.slice(ADD_FILE_MARKER.length);
    let contents = "";
    let parsedLines = 1;

    for (const line of lines.slice(1)) {
      if (line.startsWith("+")) {
        contents += line.slice(1) + "\n";
        parsedLines++;
      } else {
        break;
      }
    }

    return [{ type: "AddFile", path: filePath, contents }, parsedLines];
  }

  // Delete File
  if (firstLine.startsWith(DELETE_FILE_MARKER)) {
    const filePath = firstLine.slice(DELETE_FILE_MARKER.length);
    return [{ type: "DeleteFile", path: filePath }, 1];
  }

  // Update File
  if (firstLine.startsWith(UPDATE_FILE_MARKER)) {
    const filePath = firstLine.slice(UPDATE_FILE_MARKER.length);
    let remainingLines = lines.slice(1);
    let parsedLines = 1;

    // Check for optional "Move to" line
    let movePath: string | undefined;
    if (
      remainingLines.length > 0 &&
      remainingLines[0].startsWith(MOVE_TO_MARKER)
    ) {
      movePath = remainingLines[0].slice(MOVE_TO_MARKER.length);
      remainingLines = remainingLines.slice(1);
      parsedLines++;
    }

    const chunks: UpdateFileChunk[] = [];
    while (remainingLines.length > 0) {
      // Skip blank lines
      if (remainingLines[0].trim() === "") {
        parsedLines++;
        remainingLines = remainingLines.slice(1);
        continue;
      }

      // Stop at next hunk header
      if (remainingLines[0].startsWith("***")) {
        break;
      }

      const [chunk, chunkLines] = parseUpdateFileChunk(
        remainingLines,
        lineNumber + parsedLines,
        chunks.length === 0,
      );
      chunks.push(chunk);
      parsedLines += chunkLines;
      remainingLines = remainingLines.slice(chunkLines);
    }

    if (chunks.length === 0) {
      throw {
        type: "InvalidHunkError",
        message: `Update file hunk for path '${filePath}' is empty`,
        lineNumber,
      } as ParseError;
    }

    return [
      { type: "UpdateFile", path: filePath, movePath, chunks },
      parsedLines,
    ];
  }

  throw {
    type: "InvalidHunkError",
    message: `'${firstLine}' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'`,
    lineNumber,
  } as ParseError;
}

/**
 * Parse a single update file chunk
 */
function parseUpdateFileChunk(
  lines: string[],
  lineNumber: number,
  allowMissingContext: boolean,
): [UpdateFileChunk, number] {
  if (lines.length === 0) {
    throw {
      type: "InvalidHunkError",
      message: "Update hunk does not contain any lines",
      lineNumber,
    } as ParseError;
  }

  // Parse optional context marker
  let changeContext: string | undefined;
  let startIndex = 0;

  if (lines[0] === EMPTY_CHANGE_CONTEXT_MARKER) {
    changeContext = undefined;
    startIndex = 1;
  } else if (lines[0].startsWith(CHANGE_CONTEXT_MARKER)) {
    changeContext = lines[0].slice(CHANGE_CONTEXT_MARKER.length);
    startIndex = 1;
  } else if (!allowMissingContext) {
    throw {
      type: "InvalidHunkError",
      message: `Expected update hunk to start with a @@ context marker, got: '${lines[0]}'`,
      lineNumber,
    } as ParseError;
  }

  if (startIndex >= lines.length) {
    throw {
      type: "InvalidHunkError",
      message: "Update hunk does not contain any lines",
      lineNumber: lineNumber + 1,
    } as ParseError;
  }

  const chunk: UpdateFileChunk = {
    changeContext,
    oldLines: [],
    newLines: [],
    isEndOfFile: false,
  };

  let parsedLines = 0;
  for (const line of lines.slice(startIndex)) {
    if (line === EOF_MARKER) {
      if (parsedLines === 0) {
        throw {
          type: "InvalidHunkError",
          message: "Update hunk does not contain any lines",
          lineNumber: lineNumber + 1,
        } as ParseError;
      }
      chunk.isEndOfFile = true;
      parsedLines++;
      break;
    }

    if (line.length === 0) {
      // Empty line
      chunk.oldLines.push("");
      chunk.newLines.push("");
      parsedLines++;
      continue;
    }

    const prefix = line[0];
    const content = line.slice(1);

    switch (prefix) {
      case " ":
        chunk.oldLines.push(content);
        chunk.newLines.push(content);
        parsedLines++;
        break;
      case "+":
        chunk.newLines.push(content);
        parsedLines++;
        break;
      case "-":
        chunk.oldLines.push(content);
        parsedLines++;
        break;
      default:
        if (parsedLines === 0) {
          throw {
            type: "InvalidHunkError",
            message: `Unexpected line found in update hunk: '${line}'. Every line should start with ' ' (context line), '+' (added line), or '-' (removed line)`,
            lineNumber: lineNumber + 1,
          } as ParseError;
        }
        // Start of next hunk
        return [chunk, parsedLines + startIndex];
    }
  }

  return [chunk, parsedLines + startIndex];
}

/**
 * Helper to resolve hunk path relative to cwd
 */
export function resolveHunkPath(hunk: Hunk, cwd: string): string {
  const hunkPath =
    hunk.type === "AddFile"
      ? hunk.path
      : hunk.type === "DeleteFile"
        ? hunk.path
        : hunk.path;
  return path.resolve(cwd, hunkPath);
}
