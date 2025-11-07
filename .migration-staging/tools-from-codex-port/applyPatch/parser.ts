const BEGIN_PATCH_MARKER = "*** Begin Patch";
const END_PATCH_MARKER = "*** End Patch";
const ADD_FILE_MARKER = "*** Add File: ";
const DELETE_FILE_MARKER = "*** Delete File: ";
const UPDATE_FILE_MARKER = "*** Update File: ";
const MOVE_TO_MARKER = "*** Move to: ";
const EOF_MARKER = "*** End of File";
const CHANGE_CONTEXT_MARKER = "@@ ";
const EMPTY_CHANGE_CONTEXT_MARKER = "@@";

const PARSE_IN_STRICT_MODE = false;

export interface UpdateFileChunk {
  changeContext: string | null;
  oldLines: string[];
  newLines: string[];
  isEndOfFile: boolean;
}

export type Hunk =
  | { type: "add"; path: string; contents: string }
  | { type: "delete"; path: string }
  | { type: "update"; path: string; movePath: string | null; chunks: UpdateFileChunk[] };

export interface ApplyPatchArgs {
  patch: string;
  hunks: Hunk[];
  workdir: string | null;
}

export enum ParseMode {
  Strict = "strict",
  Lenient = "lenient",
}

export class InvalidPatchError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super(`invalid patch: ${detail}`);
    this.detail = detail;
    this.name = "InvalidPatchError";
  }
}

export class InvalidHunkError extends Error {
  readonly detail: string;
  readonly lineNumber: number;

  constructor(detail: string, lineNumber: number) {
    super(`invalid hunk at line ${lineNumber}, ${detail}`);
    this.detail = detail;
    this.lineNumber = lineNumber;
    this.name = "InvalidHunkError";
  }
}

export function parsePatch(patch: string): ApplyPatchArgs {
  const mode = PARSE_IN_STRICT_MODE ? ParseMode.Strict : ParseMode.Lenient;
  return parsePatchText(patch, mode);
}

export function parsePatchText(patch: string, mode: ParseMode): ApplyPatchArgs {
  const trimmed = patch.trim();
  const lines = trimmed.length === 0 ? [] : splitLines(trimmed);

  let relevantLines: readonly string[];
  try {
    checkPatchBoundariesStrict(lines);
    relevantLines = lines;
  } catch (error) {
    if (mode === ParseMode.Lenient && error instanceof InvalidPatchError) {
      relevantLines = checkPatchBoundariesLenient(lines, error);
    } else {
      throw error;
    }
  }

  if (relevantLines.length < 2) {
    // This should only happen when strict validation failed and lenient mode returned fewer lines.
    throw new InvalidPatchError("The last line of the patch must be '*** End Patch'");
  }

  const hunks: Hunk[] = [];
  const bodyLines = relevantLines.slice(1, relevantLines.length - 1);
  let remainingLines = bodyLines;
  let lineNumber = 2;
  while (remainingLines.length > 0) {
    const [hunk, consumed] = parseOneHunk(remainingLines, lineNumber);
    hunks.push(hunk);
    lineNumber += consumed;
    remainingLines = remainingLines.slice(consumed);
  }

  return {
    hunks,
    patch: relevantLines.join("\n"),
    workdir: null,
  };
}

export function parseOneHunk(
  lines: readonly string[],
  lineNumber: number,
): [Hunk, number] {
  if (lines.length === 0) {
    throw new InvalidHunkError(
      "'': not enough lines to parse hunk header",
      lineNumber,
    );
  }

  const firstLine = lines[0].trim();
  if (firstLine.startsWith(ADD_FILE_MARKER)) {
    const path = firstLine.slice(ADD_FILE_MARKER.length);
    let contents = "";
    let parsedLines = 1;
    for (const addLine of lines.slice(1)) {
      if (addLine.startsWith("+")) {
        contents += addLine.slice(1);
        contents += "\n";
        parsedLines += 1;
      } else {
        break;
      }
    }
    return [
      {
        type: "add",
        path,
        contents,
      },
      parsedLines,
    ];
  }

  if (firstLine.startsWith(DELETE_FILE_MARKER)) {
    const path = firstLine.slice(DELETE_FILE_MARKER.length);
    return [
      {
        type: "delete",
        path,
      },
      1,
    ];
  }

  if (firstLine.startsWith(UPDATE_FILE_MARKER)) {
    const path = firstLine.slice(UPDATE_FILE_MARKER.length);
    let remaining = lines.slice(1);
    let parsedLines = 1;

    let movePath: string | null = null;
    const potentialMove = remaining[0];
    if (typeof potentialMove === "string" && potentialMove.startsWith(MOVE_TO_MARKER)) {
      movePath = potentialMove.slice(MOVE_TO_MARKER.length);
      remaining = remaining.slice(1);
      parsedLines += 1;
    }

    const chunks: UpdateFileChunk[] = [];
    while (remaining.length > 0) {
      const nextLine = remaining[0];
      if (nextLine.trim().length === 0) {
        parsedLines += 1;
        remaining = remaining.slice(1);
        continue;
      }
      if (nextLine.startsWith("***")) {
        break;
      }

      const [chunk, consumed] = parseUpdateFileChunk(
        remaining,
        lineNumber + parsedLines,
        chunks.length === 0,
      );
      chunks.push(chunk);
      parsedLines += consumed;
      remaining = remaining.slice(consumed);
    }

    if (chunks.length === 0) {
      throw new InvalidHunkError(
        `Update file hunk for path '${path}' is empty`,
        lineNumber,
      );
    }

    return [
      {
        type: "update",
        path,
        movePath,
        chunks,
      },
      parsedLines,
    ];
  }

  throw new InvalidHunkError(
    `'${firstLine}' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'`,
    lineNumber,
  );
}

export function parseUpdateFileChunk(
  lines: readonly string[],
  lineNumber: number,
  allowMissingContext: boolean,
): [UpdateFileChunk, number] {
  if (lines.length === 0) {
    throw new InvalidHunkError("Update hunk does not contain any lines", lineNumber);
  }

  const firstLine = lines[0];
  let changeContext: string | null = null;
  let startIndex = 0;
  if (firstLine === EMPTY_CHANGE_CONTEXT_MARKER) {
    changeContext = null;
    startIndex = 1;
  } else if (firstLine.startsWith(CHANGE_CONTEXT_MARKER)) {
    changeContext = firstLine.slice(CHANGE_CONTEXT_MARKER.length);
    startIndex = 1;
  } else if (!allowMissingContext) {
    throw new InvalidHunkError(
      `Expected update hunk to start with a @@ context marker, got: '${firstLine}'`,
      lineNumber,
    );
  }

  if (startIndex >= lines.length) {
    throw new InvalidHunkError("Update hunk does not contain any lines", lineNumber + 1);
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
        throw new InvalidHunkError("Update hunk does not contain any lines", lineNumber + 1);
      }
      chunk.isEndOfFile = true;
      parsedLines += 1;
      break;
    }

    const firstChar = line[0];
    if (firstChar === undefined) {
      chunk.oldLines.push("");
      chunk.newLines.push("");
      parsedLines += 1;
      continue;
    }

    if (firstChar === " ") {
      const content = line.slice(1);
      chunk.oldLines.push(content);
      chunk.newLines.push(content);
    } else if (firstChar === "+") {
      chunk.newLines.push(line.slice(1));
    } else if (firstChar === "-") {
      chunk.oldLines.push(line.slice(1));
    } else {
      if (parsedLines === 0) {
        throw new InvalidHunkError(
          `Unexpected line found in update hunk: '${line}'. Every line should start with ' ' (context line), '+' (added line), or '-' (removed line)`,
          lineNumber + 1,
        );
      }
      break;
    }
    parsedLines += 1;
  }

  if (parsedLines === 0) {
    throw new InvalidHunkError("Update hunk does not contain any lines", lineNumber + 1);
  }

  return [chunk, parsedLines + startIndex];
}

function splitLines(input: string): string[] {
  return input.split(/\r?\n/);
}

function checkPatchBoundariesStrict(lines: readonly string[]): void {
  const first = lines[0];
  const last = lines.length === 0 ? undefined : lines[lines.length - 1];

  if (first === BEGIN_PATCH_MARKER && last === END_PATCH_MARKER) {
    return;
  }

  if (first !== undefined && first !== BEGIN_PATCH_MARKER) {
    throw new InvalidPatchError("The first line of the patch must be '*** Begin Patch'");
  }

  throw new InvalidPatchError("The last line of the patch must be '*** End Patch'");
}

function checkPatchBoundariesLenient(
  originalLines: readonly string[],
  originalError: InvalidPatchError,
): readonly string[] {
  if (originalLines.length < 4) {
    throw originalError;
  }

  const first = originalLines[0];
  const last = originalLines[originalLines.length - 1];
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
