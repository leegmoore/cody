import { promises as fs, Stats } from "node:fs";
import { join, isAbsolute, resolve } from "node:path";

import { ToolResult } from "./types";

const DEFAULT_OFFSET = 1;
const DEFAULT_LIMIT = 25;
const DEFAULT_DEPTH = 2;
const INDENTATION_SPACES = 2;
const MAX_ENTRY_LENGTH = 500;

enum DirEntryKind {
  Directory,
  File,
  Symlink,
  Other,
}

interface DirEntry {
  name: string;
  displayName: string;
  depth: number;
  kind: DirEntryKind;
}

interface QueueEntry {
  path: string;
  prefix: string;
  remainingDepth: number;
}

interface CollectedEntry {
  entry: DirEntry;
  kind: DirEntryKind;
  fullPath: string;
  relativePath: string;
}

export interface ListDirParams {
  dirPath: string;
  offset?: number;
  limit?: number;
  depth?: number;
}

export async function listDir(params: ListDirParams): Promise<ToolResult> {
  const offset = params.offset ?? DEFAULT_OFFSET;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const depth = params.depth ?? DEFAULT_DEPTH;
  // Accept relative paths and resolve against the current process cwd.
  // NOTE: If we move to production or support additional platforms/sandboxes,
  // reconsider this choice and require absolute paths to simplify policy checks.
  let dirPath = params.dirPath;

  if (offset <= 0) {
    throw new Error("offset must be a 1-indexed entry number");
  }

  if (limit <= 0) {
    throw new Error("limit must be greater than zero");
  }

  if (depth <= 0) {
    throw new Error("depth must be greater than zero");
  }

  if (!isAbsolute(dirPath)) {
    dirPath = resolve(process.cwd(), dirPath);
  }

  const lines = await listDirectoryEntries(dirPath, offset, limit, depth);
  const outputLines = [`Absolute path: ${dirPath}`];
  outputLines.push(...lines);

  return {
    content: outputLines.join("\n"),
    success: true,
  };
}

async function listDirectoryEntries(
  dirPath: string,
  offset: number,
  limit: number,
  depth: number,
): Promise<string[]> {
  const entries: DirEntry[] = [];
  await collectEntries(dirPath, "", depth, entries);

  if (entries.length === 0) {
    return [];
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  const startIndex = offset - 1;
  if (startIndex >= entries.length) {
    throw new Error("offset exceeds directory entry count");
  }

  const remainingEntries = entries.length - startIndex;
  const cappedLimit = Math.min(limit, remainingEntries);
  const endIndex = startIndex + cappedLimit;
  const selectedEntries = entries.slice(startIndex, endIndex);
  const formatted = selectedEntries.map(formatEntryLine);

  if (endIndex < entries.length) {
    formatted.push(`More than ${cappedLimit} entries found`);
  }

  return formatted;
}

async function collectEntries(
  rootPath: string,
  prefix: string,
  depth: number,
  entries: DirEntry[],
): Promise<void> {
  const queue: QueueEntry[] = [{ path: rootPath, prefix, remainingDepth: depth }];

  while (queue.length > 0) {
    const { path, prefix: currentPrefix, remainingDepth } = queue.shift()!;
    let dirents;
    try {
      dirents = await fs.readdir(path, { withFileTypes: true });
    } catch (error) {
      throw new Error(`failed to read directory: ${(error as Error).message}`);
    }

    const collected: CollectedEntry[] = [];

    for (const dirent of dirents) {
      const name = dirent.name;
      const fullPath = join(path, name);
      let stats;
      try {
        stats = await fs.lstat(fullPath);
      } catch (error) {
        throw new Error(`failed to inspect entry: ${(error as Error).message}`);
      }

      const kind = toKind(stats);
      const relativePath = createRelativePath(currentPrefix, name);
      const displayDepth = currentPrefix === "" ? 0 : currentPrefix.split("/").length;
      const sortKey = truncate(normalizePath(relativePath), MAX_ENTRY_LENGTH);
      const displayName = truncate(name, MAX_ENTRY_LENGTH);

      collected.push({
        entry: {
          name: sortKey,
          displayName,
          depth: displayDepth,
          kind,
        },
        kind,
        fullPath,
        relativePath,
      });
    }

    collected.sort((a, b) => a.entry.name.localeCompare(b.entry.name));

    for (const item of collected) {
      if (item.kind === DirEntryKind.Directory && remainingDepth > 1) {
        queue.push({
          path: item.fullPath,
          prefix: item.relativePath,
          remainingDepth: remainingDepth - 1,
        });
      }
      entries.push(item.entry);
    }
  }
}

function formatEntryLine(entry: DirEntry): string {
  const indent = " ".repeat(entry.depth * INDENTATION_SPACES);
  let name = entry.displayName;
  if (entry.kind === DirEntryKind.Directory) {
    name += "/";
  } else if (entry.kind === DirEntryKind.Symlink) {
    name += "@";
  } else if (entry.kind === DirEntryKind.Other) {
    name += "?";
  }
  return `${indent}${name}`;
}

function toKind(stats: Stats): DirEntryKind {
  if (stats.isSymbolicLink()) {
    return DirEntryKind.Symlink;
  }
  if (stats.isDirectory()) {
    return DirEntryKind.Directory;
  }
  if (stats.isFile()) {
    return DirEntryKind.File;
  }
  return DirEntryKind.Other;
}

function createRelativePath(prefix: string, name: string): string {
  return prefix ? `${prefix}/${name}` : name;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return Array.from(value).slice(0, maxLength).join("");
}
