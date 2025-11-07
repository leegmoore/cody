import { promises as fs } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { ToolResult } from "./types";

const DEFAULT_OFFSET = 1;
const DEFAULT_LIMIT = 2000;
const MAX_LINE_LENGTH = 500;
const TAB_WIDTH = 4;
const COMMENT_PREFIXES = ["#", "//", "--"] as const;

export interface ReadFileParams {
  filePath: string;
  offset?: number;
  limit?: number;
  mode?: "slice" | "indentation";
  anchorLine?: number;
  maxLevels?: number;
  includeSiblings?: boolean;
  includeHeader?: boolean;
  maxLines?: number;
  workdir?: string;
}

interface LineRecord {
  number: number;
  raw: string;
  display: string;
  indent: number;
}

export async function readFile(params: ReadFileParams): Promise<ToolResult> {
  const offset = params.offset ?? DEFAULT_OFFSET;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const mode = params.mode ?? "slice";

  if (offset <= 0) {
    throw new Error("offset must be a 1-indexed line number");
  }

  if (limit <= 0) {
    throw new Error("limit must be greater than zero");
  }

  let workingDir = params.workdir ?? process.cwd();
  if (!isAbsolute(workingDir)) {
    workingDir = resolve(process.cwd(), workingDir);
  }

  let filePath = params.filePath;
  if (!isAbsolute(filePath)) {
    filePath = resolve(workingDir, filePath);
  }

  let fileContent: string;
  try {
    const buffer = await fs.readFile(filePath);
    fileContent = buffer.toString("utf8");
  } catch (error) {
    throw new Error(`failed to read file: ${(error as Error).message}`);
  }

  const lines = splitLines(fileContent);

  if (mode === "indentation") {
    const resultLines = readIndentationMode(lines, {
      anchorLine: params.anchorLine ?? offset,
      limit,
      guardLimit: params.maxLines ?? limit,
      maxLevels: params.maxLevels ?? 0,
      includeSiblings: params.includeSiblings ?? false,
      includeHeader: params.includeHeader ?? true,
    });

    return {
      content: resultLines.join("\n"),
      success: true,
    };
  }

  const resultLines = readSliceMode(lines, offset, limit);

  return {
    content: resultLines.join("\n"),
    success: true,
  };
}

function readSliceMode(lines: string[], offset: number, limit: number): string[] {
  if (lines.length === 0 || offset > lines.length) {
    throw new Error("offset exceeds file length");
  }

  const startIndex = offset - 1;
  const slice = lines.slice(startIndex, startIndex + limit);

  return slice.map((line, index) => {
    const lineNumber = startIndex + index + 1;
    return `L${lineNumber}: ${formatLine(line)}`;
  });
}

function readIndentationMode(
  lines: string[],
  options: {
    anchorLine: number;
    limit: number;
    guardLimit: number;
    maxLevels: number;
    includeSiblings: boolean;
    includeHeader: boolean;
  },
): string[] {
  const { anchorLine, limit, guardLimit, maxLevels, includeSiblings, includeHeader } = options;

  if (anchorLine <= 0) {
    throw new Error("anchor_line must be a 1-indexed line number");
  }

  if (guardLimit <= 0) {
    throw new Error("max_lines must be greater than zero");
  }

  if (lines.length === 0 || anchorLine > lines.length) {
    throw new Error("anchor_line exceeds file length");
  }

  const records = collectLineRecords(lines);
  const effectiveIndents = computeEffectiveIndents(records);
  const anchorIndex = anchorLine - 1;
  const anchorIndent = effectiveIndents[anchorIndex];
  const finalLimit = Math.min(limit, guardLimit, records.length);

  if (finalLimit === 1) {
    const record = records[anchorIndex];
    return [`L${record.number}: ${record.display}`];
  }

  const minIndent =
    maxLevels === 0 ? 0 : Math.max(0, anchorIndent - maxLevels * TAB_WIDTH);

  const result: LineRecord[] = [records[anchorIndex]];
  let upIndex = anchorIndex - 1;
  let downIndex = anchorIndex + 1;
  let upMinIndentCount = 0;
  let downMinIndentCount = 0;

  while (result.length < finalLimit) {
    let progressed = false;

    if (upIndex >= 0) {
      const idx = upIndex;
      if (effectiveIndents[idx] >= minIndent) {
        const record = records[idx];
        result.unshift(record);
        upIndex -= 1;
        let kept = true;

        if (effectiveIndents[idx] === minIndent && !includeSiblings) {
          const allowHeaderComment = includeHeader && isComment(record);
          const canTakeLine = allowHeaderComment || upMinIndentCount === 0;
          if (canTakeLine) {
            upMinIndentCount += 1;
          } else {
            result.shift();
            kept = false;
            upIndex = -1;
          }
        }

        if (kept) {
          progressed = true;
          if (result.length >= finalLimit) {
            break;
          }
        }
      } else {
        upIndex = -1;
      }
    }

    if (result.length >= finalLimit) {
      break;
    }

    if (downIndex < records.length) {
      const idx = downIndex;
      if (effectiveIndents[idx] >= minIndent) {
        const record = records[idx];
        result.push(record);
        downIndex += 1;
        let kept = true;

        if (effectiveIndents[idx] === minIndent && !includeSiblings) {
          if (downMinIndentCount > 0) {
            result.pop();
            kept = false;
            downIndex = records.length;
          }
          downMinIndentCount += 1;
        }

        if (kept) {
          progressed = true;
          if (result.length >= finalLimit) {
            break;
          }
        }
      } else {
        downIndex = records.length;
      }
    }

    if (!progressed) {
      break;
    }
  }

  trimEmptyLines(result);

  return result.map((record) => `L${record.number}: ${record.display}`);
}

function splitLines(content: string): string[] {
  if (content.length === 0) {
    return [];
  }

  const rawLines = content.split("\n");
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  return rawLines.map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
}

function formatLine(line: string): string {
  if (line.length <= MAX_LINE_LENGTH) {
    return line;
  }

  return Array.from(line).slice(0, MAX_LINE_LENGTH).join("");
}

function collectLineRecords(lines: string[]): LineRecord[] {
  return lines.map((line, index) => ({
    number: index + 1,
    raw: line,
    display: formatLine(line),
    indent: measureIndent(line),
  }));
}

function computeEffectiveIndents(records: LineRecord[]): number[] {
  const effective: number[] = [];
  let previousIndent = 0;

  for (const record of records) {
    if (isBlank(record)) {
      effective.push(previousIndent);
    } else {
      previousIndent = record.indent;
      effective.push(previousIndent);
    }
  }

  return effective;
}

function measureIndent(line: string): number {
  let indent = 0;
  for (const ch of line) {
    if (ch === " ") {
      indent += 1;
    } else if (ch === "\t") {
      indent += TAB_WIDTH;
    } else {
      break;
    }
  }
  return indent;
}

function isBlank(record: LineRecord): boolean {
  return record.raw.trim().length === 0;
}

function isComment(record: LineRecord): boolean {
  const trimmed = record.raw.trim();
  return COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

function trimEmptyLines(records: LineRecord[]): void {
  while (records.length > 0 && records[0].raw.trim().length === 0) {
    records.shift();
  }
  while (records.length > 0 && records[records.length - 1].raw.trim().length === 0) {
    records.pop();
  }
}
