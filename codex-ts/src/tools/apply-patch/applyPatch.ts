import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, normalize, posix, resolve, sep } from "node:path";
import { createRequire } from "node:module";

import { Language, Parser, Query } from "web-tree-sitter";

import {
  ApplyPatchArgs,
  Hunk,
  InvalidHunkError,
  InvalidPatchError,
  UpdateFileChunk,
  parsePatch,
} from "./parser.js";
import { seekSequence } from "./seekSequence.js";

export interface ApplyPatchOptions {
  cwd?: string;
}

export interface ApplyPatchResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

const APPLY_PATCH_COMMANDS = new Set(["apply_patch", "applypatch"]);

const nodeRequire = createRequire(import.meta.url);
const BASH_WASM_PATH = nodeRequire.resolve(
  "@vscode/tree-sitter-wasm/wasm/tree-sitter-bash.wasm",
);

const APPLY_PATCH_QUERY = String.raw`
            (
              program
                . (redirected_statement
                    body: (command
                            name: (command_name (word) @apply_name) .)
                    (#any-of? @apply_name "apply_patch" "applypatch")
                    redirect: (heredoc_redirect
                                . (heredoc_start)
                                . (heredoc_body) @heredoc
                                . (heredoc_end)
                                .))
                .)

            (
              program
                . (redirected_statement
                    body: (list
                            . (command
                                name: (command_name (word) @cd_name) .
                                argument: [
                                  (word) @cd_path
                                  (string (string_content) @cd_path)
                                  (raw_string) @cd_raw_string
                                ] .)
                            "&&"
                            . (command
                                name: (command_name (word) @apply_name))
                            .)
                    (#eq? @cd_name "cd")
                    (#any-of? @apply_name "apply_patch" "applypatch")
                    redirect: (heredoc_redirect
                                . (heredoc_start)
                                . (heredoc_body) @heredoc
                                . (heredoc_end)
                                .))
                .)
            `;

type ExtractHeredocErrorType =
  | "command-did-not-start-with-apply-patch"
  | "failed-to-load-bash-grammar"
  | "heredoc-not-utf8"
  | "failed-to-parse-patch-into-ast"
  | "failed-to-find-heredoc-body";

export class ExtractHeredocError extends Error {
  readonly type: ExtractHeredocErrorType;

  constructor(
    type: ExtractHeredocErrorType,
    options: { cause?: unknown } = {},
  ) {
    super(extractHeredocErrorMessage(type));
    this.type = type;
    this.name = "ExtractHeredocError";
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function extractHeredocErrorMessage(type: ExtractHeredocErrorType): string {
  switch (type) {
    case "command-did-not-start-with-apply-patch":
      return "command did not start with apply_patch";
    case "failed-to-load-bash-grammar":
      return "failed to load bash grammar";
    case "heredoc-not-utf8":
      return "heredoc body was not valid utf-8";
    case "failed-to-parse-patch-into-ast":
      return "failed to parse bash script into AST";
    case "failed-to-find-heredoc-body":
      return "failed to find heredoc body";
    default:
      return "failed to extract apply_patch heredoc";
  }
}

export type ApplyPatchErrorType =
  | "parse-error"
  | "io-error"
  | "compute-replacements"
  | "implicit-invocation";

export class ApplyPatchError extends Error {
  readonly type: ApplyPatchErrorType;
  readonly detail?: string;

  private constructor(
    type: ApplyPatchErrorType,
    message: string,
    detail?: string,
    options: { cause?: unknown } = {},
  ) {
    super(message);
    this.type = type;
    this.detail = detail;
    this.name = "ApplyPatchError";
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  static implicitInvocation(): ApplyPatchError {
    return new ApplyPatchError(
      "implicit-invocation",
      'patch detected without explicit call to apply_patch. Rerun as ["apply_patch", "<patch>"]',
    );
  }

  static fromParseError(
    error: InvalidPatchError | InvalidHunkError,
  ): ApplyPatchError {
    const message =
      error instanceof InvalidPatchError
        ? `Invalid patch: ${error.detail}`
        : `Invalid patch hunk on line ${error.lineNumber}: ${error.detail}`;
    return new ApplyPatchError("parse-error", message, error.detail, {
      cause: error,
    });
  }

  static ioError(context: string, cause: unknown): ApplyPatchError {
    const message = `${context}: ${formatIoError(cause)}`;
    return new ApplyPatchError("io-error", message, context, { cause });
  }

  static computeReplacements(
    detail: string,
    options: { cause?: unknown } = {},
  ): ApplyPatchError {
    return new ApplyPatchError("compute-replacements", detail, detail, options);
  }
}

export type MaybeApplyPatch =
  | { type: "body"; args: ApplyPatchArgs }
  | { type: "patch-parse-error"; error: InvalidPatchError | InvalidHunkError }
  | { type: "shell-parse-error"; error: ExtractHeredocError }
  | { type: "not-apply-patch" };

export type ApplyPatchFileChange =
  | { type: "add"; content: string }
  | { type: "delete"; content: string }
  | {
      type: "update";
      unifiedDiff: string;
      movePath: string | null;
      newContent: string;
    };

export interface ApplyPatchAction {
  changes: Map<string, ApplyPatchFileChange>;
  patch: string;
  cwd: string;
}

export type MaybeApplyPatchVerified =
  | { type: "body"; action: ApplyPatchAction }
  | { type: "shell-parse-error"; error: ExtractHeredocError }
  | { type: "correctness-error"; error: ApplyPatchError }
  | { type: "not-apply-patch" };

interface BashResources {
  parser: Parser;
  query: Query;
}

let bashResourcesPromise: Promise<BashResources> | null = null;

async function loadBashResources(): Promise<BashResources> {
  if (bashResourcesPromise === null) {
    bashResourcesPromise = (async () => {
      try {
        await Parser.init();
        const language = await Language.load(BASH_WASM_PATH);
        const parser = new Parser();
        parser.setLanguage(language);
        const query = new Query(language, APPLY_PATCH_QUERY);
        return { parser, query };
      } catch (error) {
        throw new ExtractHeredocError("failed-to-load-bash-grammar", {
          cause: error,
        });
      }
    })();
  }

  return bashResourcesPromise;
}

function trimTrailingNewlines(text: string): string {
  return text.replace(/\n+$/u, "");
}

function stripRawStringQuotes(text: string): string {
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) {
    return text.slice(1, -1);
  }
  return text;
}

async function extractApplyPatchFromBash(
  script: string,
): Promise<{ body: string; workdir: string | null }> {
  let resources: BashResources;
  try {
    resources = await loadBashResources();
  } catch (error) {
    if (error instanceof ExtractHeredocError) {
      throw error;
    }
    throw new ExtractHeredocError("failed-to-load-bash-grammar", {
      cause: error,
    });
  }

  const { parser, query } = resources;
  let tree;
  try {
    tree = parser.parse(script);
  } catch (error) {
    throw new ExtractHeredocError("failed-to-parse-patch-into-ast", {
      cause: error,
    });
  }

  if (!tree) {
    throw new ExtractHeredocError("failed-to-parse-patch-into-ast");
  }

  const matches = query.matches(tree.rootNode);
  for (const match of matches) {
    let heredocText: string | null = null;
    let cdPath: string | null = null;

    for (const capture of match.captures) {
      const captureName = capture.name;
      if (captureName === "heredoc") {
        const text = capture.node.text;
        heredocText = trimTrailingNewlines(text);
      } else if (captureName === "cd_path") {
        cdPath = capture.node.text;
      } else if (captureName === "cd_raw_string") {
        const raw = capture.node.text;
        cdPath = stripRawStringQuotes(raw);
      }
    }

    if (heredocText !== null) {
      return { body: heredocText, workdir: cdPath };
    }
  }

  throw new ExtractHeredocError("command-did-not-start-with-apply-patch");
}

function isPatchParseError(
  error: unknown,
): error is InvalidPatchError | InvalidHunkError {
  return (
    error instanceof InvalidPatchError || error instanceof InvalidHunkError
  );
}

function isImplicitPatchInvocation(body: string): boolean {
  try {
    parsePatch(body);
    return true;
  } catch (error) {
    if (isPatchParseError(error)) {
      return false;
    }
    throw error;
  }
}

export interface ApplyPatchFileUpdate {
  unifiedDiff: string;
  content: string;
}

interface ResolvedPath {
  absolute: string;
  display: string;
}

interface AffectedPaths {
  added: string[];
  modified: string[];
  deleted: string[];
}

interface Replacement {
  start: number;
  deleteCount: number;
  newLines: string[];
}

interface DerivedContents {
  originalContents: string;
  originalLines: string[];
  updatedLines: string[];
  newContents: string;
}

class ApplyPatchFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplyPatchFailure";
  }
}

export async function applyPatch(
  patch: string,
  options: ApplyPatchOptions = {},
): Promise<ApplyPatchResult> {
  const cwd = resolveCwd(options.cwd ?? process.cwd());

  let hunks: Hunk[];
  try {
    hunks = parsePatch(patch).hunks;
  } catch (error) {
    if (error instanceof InvalidPatchError) {
      return {
        success: false,
        stdout: "",
        stderr: `Invalid patch: ${error.detail}\n`,
      };
    }
    if (error instanceof InvalidHunkError) {
      return {
        success: false,
        stdout: "",
        stderr: `Invalid patch hunk on line ${error.lineNumber}: ${error.detail}\n`,
      };
    }
    throw error;
  }

  try {
    const affected = await applyHunksToFiles(hunks, cwd);
    return {
      success: true,
      stdout: renderSummary(affected),
      stderr: "",
    };
  } catch (error) {
    const message =
      error instanceof ApplyPatchFailure ? error.message : formatIoError(error);
    return {
      success: false,
      stdout: "",
      stderr: `${message}\n`,
    };
  }
}

export async function maybeParseApplyPatch(
  argv: readonly string[],
): Promise<MaybeApplyPatch> {
  if (argv.length === 2) {
    const [command, body] = argv;
    if (APPLY_PATCH_COMMANDS.has(command)) {
      try {
        const parsed = parsePatch(body);
        return { type: "body", args: parsed };
      } catch (error) {
        if (isPatchParseError(error)) {
          return { type: "patch-parse-error", error };
        }
        throw error;
      }
    }
  }

  if (argv.length === 3) {
    const [command, flag, script] = argv;
    if (command === "bash" && flag === "-lc") {
      try {
        const { body, workdir } = await extractApplyPatchFromBash(script);
        try {
          const parsed = parsePatch(body);
          parsed.workdir = workdir ?? null;
          return { type: "body", args: parsed };
        } catch (error) {
          if (isPatchParseError(error)) {
            return { type: "patch-parse-error", error };
          }
          throw error;
        }
      } catch (error) {
        if (error instanceof ExtractHeredocError) {
          if (error.type === "command-did-not-start-with-apply-patch") {
            return { type: "not-apply-patch" };
          }
          return { type: "shell-parse-error", error };
        }
        throw error;
      }
    }
  }

  return { type: "not-apply-patch" };
}

export async function maybeParseApplyPatchVerified(
  argv: readonly string[],
  cwd: string,
): Promise<MaybeApplyPatchVerified> {
  if (!isAbsolute(cwd)) {
    throw new Error("cwd must be absolute");
  }

  if (argv.length === 1 && isImplicitPatchInvocation(argv[0])) {
    return {
      type: "correctness-error",
      error: ApplyPatchError.implicitInvocation(),
    };
  }

  if (
    argv.length === 3 &&
    argv[0] === "bash" &&
    argv[1] === "-lc" &&
    isImplicitPatchInvocation(argv[2])
  ) {
    return {
      type: "correctness-error",
      error: ApplyPatchError.implicitInvocation(),
    };
  }

  const parsed = await maybeParseApplyPatch(argv);
  if (parsed.type === "body") {
    try {
      const action = await buildApplyPatchAction(parsed.args, cwd);
      return { type: "body", action };
    } catch (error) {
      if (error instanceof ApplyPatchError) {
        return { type: "correctness-error", error };
      }
      throw error;
    }
  }
  if (parsed.type === "shell-parse-error") {
    return { type: "shell-parse-error", error: parsed.error };
  }
  if (parsed.type === "patch-parse-error") {
    return {
      type: "correctness-error",
      error: ApplyPatchError.fromParseError(parsed.error),
    };
  }
  return { type: "not-apply-patch" };
}

async function buildApplyPatchAction(
  args: ApplyPatchArgs,
  cwd: string,
): Promise<ApplyPatchAction> {
  const baseCwd = resolveCwd(cwd);
  const effectiveCwd = resolveEffectiveCwd(baseCwd, args.workdir);
  const changes = new Map<string, ApplyPatchFileChange>();

  for (const hunk of args.hunks) {
    switch (hunk.type) {
      case "add": {
        const target = resolvePatchPathOrThrow(effectiveCwd, hunk.path);
        changes.set(target.absolute, { type: "add", content: hunk.contents });
        break;
      }
      case "delete": {
        const target = resolvePatchPathOrThrow(effectiveCwd, hunk.path);
        let content: string;
        try {
          content = await readFile(target.absolute, "utf8");
        } catch (error) {
          throw ApplyPatchError.ioError(
            `Failed to read ${target.display}`,
            error,
          );
        }
        changes.set(target.absolute, { type: "delete", content });
        break;
      }
      case "update": {
        const source = resolvePatchPathOrThrow(effectiveCwd, hunk.path);
        let derived: DerivedContents;
        try {
          derived = await deriveContentsFromChunks(
            source.absolute,
            source.display,
            hunk.chunks,
          );
        } catch (error) {
          if (error instanceof ApplyPatchFailure) {
            throw ApplyPatchError.computeReplacements(error.message, {
              cause: error,
            });
          }
          throw error;
        }

        let movePath: string | null = null;
        if (hunk.movePath !== null) {
          const destination = resolvePatchPathOrThrow(
            effectiveCwd,
            hunk.movePath,
          );
          movePath = destination.absolute;
        }

        const unifiedDiff = buildUnifiedDiff(
          derived.originalLines,
          derived.updatedLines,
          1,
        );
        changes.set(source.absolute, {
          type: "update",
          unifiedDiff,
          movePath,
          newContent: derived.newContents,
        });
        break;
      }
      default: {
        const exhaustiveCheck: never = hunk;
        throw new Error(
          `Unhandled hunk type ${(exhaustiveCheck as { type: string }).type}`,
        );
      }
    }
  }

  return {
    changes,
    patch: args.patch,
    cwd: effectiveCwd,
  };
}

function resolveEffectiveCwd(baseCwd: string, workdir: string | null): string {
  if (workdir === null) {
    return baseCwd;
  }
  const candidate = isAbsolute(workdir) ? workdir : resolve(baseCwd, workdir);
  return normalize(candidate);
}

function resolvePatchPathOrThrow(
  baseCwd: string,
  rawPath: string,
): ResolvedPath {
  try {
    return resolvePatchPath(baseCwd, rawPath);
  } catch (error) {
    if (error instanceof ApplyPatchFailure) {
      throw ApplyPatchError.computeReplacements(error.message, {
        cause: error,
      });
    }
    throw error;
  }
}

export async function unifiedDiffFromChunks(
  path: string,
  chunks: UpdateFileChunk[],
  context: number = 1,
): Promise<ApplyPatchFileUpdate> {
  const { originalLines, updatedLines, newContents } =
    await deriveContentsFromChunks(path, path, chunks);
  const unifiedDiff = buildUnifiedDiff(originalLines, updatedLines, context);
  return {
    unifiedDiff,
    content: newContents,
  };
}

async function applyHunksToFiles(
  hunks: Hunk[],
  cwd: string,
): Promise<AffectedPaths> {
  if (hunks.length === 0) {
    throw new ApplyPatchFailure("No files were modified.");
  }

  const affected: AffectedPaths = { added: [], modified: [], deleted: [] };

  for (const hunk of hunks) {
    if (hunk.type === "add") {
      const pathInfo = resolvePatchPath(cwd, hunk.path);
      await ensureParentDirectory(
        cwd,
        pathInfo,
        `Failed to create parent directories for ${pathInfo.display}`,
      );
      await writeFileWithContext(pathInfo, hunk.contents);
      affected.added.push(pathInfo.display);
      continue;
    }

    if (hunk.type === "delete") {
      const pathInfo = resolvePatchPath(cwd, hunk.path);
      await removeFileWithContext(
        pathInfo,
        `Failed to delete file ${pathInfo.display}`,
      );
      affected.deleted.push(pathInfo.display);
      continue;
    }

    if (hunk.type === "update") {
      const source = resolvePatchPath(cwd, hunk.path);
      const newContents = await deriveNewContentsFromChunks(
        source,
        hunk.chunks,
      );
      if (hunk.movePath) {
        const destination = resolvePatchPath(cwd, hunk.movePath);
        await ensureParentDirectory(
          cwd,
          destination,
          `Failed to create parent directories for ${destination.display}`,
        );
        await writeFileWithContext(destination, newContents);
        await removeFileWithContext(
          source,
          `Failed to remove original ${source.display}`,
        );
        affected.modified.push(destination.display);
      } else {
        await writeFileWithContext(source, newContents);
        affected.modified.push(source.display);
      }
      continue;
    }
  }

  return affected;
}

function renderSummary(affected: AffectedPaths): string {
  const lines = ["Success. Updated the following files:"];
  for (const path of affected.added) {
    lines.push(`A ${path}`);
  }
  for (const path of affected.modified) {
    lines.push(`M ${path}`);
  }
  for (const path of affected.deleted) {
    lines.push(`D ${path}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function deriveNewContentsFromChunks(
  pathInfo: ResolvedPath,
  chunks: UpdateFileChunk[],
): Promise<string> {
  const { newContents } = await deriveContentsFromChunks(
    pathInfo.absolute,
    pathInfo.display,
    chunks,
  );
  return newContents;
}

async function deriveContentsFromChunks(
  absolutePath: string,
  displayPath: string,
  chunks: UpdateFileChunk[],
): Promise<DerivedContents> {
  let originalContents: string;
  try {
    originalContents = await readFile(absolutePath, "utf8");
  } catch (error) {
    throw new ApplyPatchFailure(
      `Failed to read file to update ${displayPath}: ${formatIoError(error)}`,
    );
  }

  const originalLines = splitFileLines(originalContents);
  const replacements = computeReplacements(originalLines, chunks, displayPath);

  const patchedLines = applyReplacements([...originalLines], replacements);
  const normalizedLines = [...patchedLines];
  if (
    normalizedLines.length === 0 ||
    normalizedLines[normalizedLines.length - 1] !== ""
  ) {
    normalizedLines.push("");
  }

  const updatedLines = stripTrailingSentinel(normalizedLines);
  const newContents = normalizedLines.join("\n");

  return {
    originalContents,
    originalLines,
    updatedLines,
    newContents,
  };
}

function computeReplacements(
  originalLines: string[],
  chunks: UpdateFileChunk[],
  displayPath: string,
): Replacement[] {
  const replacements: Replacement[] = [];
  let lineIndex = 0;

  for (const chunk of chunks) {
    if (chunk.changeContext !== null) {
      const contextIndex = seekSequence(
        originalLines,
        [chunk.changeContext],
        lineIndex,
        false,
      );
      if (contextIndex === null) {
        throw new ApplyPatchFailure(
          `Failed to find context '${chunk.changeContext}' in ${displayPath}`,
        );
      }
      lineIndex = contextIndex + 1;
    }

    if (chunk.oldLines.length === 0) {
      const insertionIndex = originalLines.length;
      replacements.push({
        start: insertionIndex,
        deleteCount: 0,
        newLines: [...chunk.newLines],
      });
      continue;
    }

    let pattern = [...chunk.oldLines];
    let newSegment = [...chunk.newLines];

    let found = seekSequence(
      originalLines,
      pattern,
      lineIndex,
      chunk.isEndOfFile,
    );

    if (
      found === null &&
      pattern.length > 0 &&
      pattern[pattern.length - 1] === ""
    ) {
      pattern = pattern.slice(0, -1);
      if (newSegment.length > 0 && newSegment[newSegment.length - 1] === "") {
        newSegment = newSegment.slice(0, -1);
      }
      found = seekSequence(
        originalLines,
        pattern,
        lineIndex,
        chunk.isEndOfFile,
      );
    }

    if (found === null) {
      throw new ApplyPatchFailure(
        `Failed to find expected lines in ${displayPath}:\n${chunk.oldLines.join("\n")}`,
      );
    }

    replacements.push({
      start: found,
      deleteCount: pattern.length,
      newLines: newSegment,
    });
    lineIndex = found + pattern.length;
  }

  replacements.sort((left, right) => left.start - right.start);
  return replacements;
}

function applyReplacements(
  lines: string[],
  replacements: Replacement[],
): string[] {
  for (let index = replacements.length - 1; index >= 0; index -= 1) {
    const replacement = replacements[index];
    lines.splice(
      replacement.start,
      replacement.deleteCount,
      ...replacement.newLines,
    );
  }
  return lines;
}

async function ensureParentDirectory(
  cwd: string,
  pathInfo: ResolvedPath,
  errorPrefix: string,
): Promise<void> {
  const parentDisplay = posix.dirname(pathInfo.display);
  if (parentDisplay === "." || parentDisplay === "") {
    return;
  }
  const absoluteParent = resolve(cwd, parentDisplay);
  try {
    await mkdir(absoluteParent, { recursive: true });
  } catch (error) {
    throw new ApplyPatchFailure(`${errorPrefix}: ${formatIoError(error)}`);
  }
}

async function writeFileWithContext(
  pathInfo: ResolvedPath,
  contents: string,
): Promise<void> {
  try {
    await writeFile(pathInfo.absolute, contents, "utf8");
  } catch (error) {
    throw new ApplyPatchFailure(
      `Failed to write file ${pathInfo.display}: ${formatIoError(error)}`,
    );
  }
}

async function removeFileWithContext(
  pathInfo: ResolvedPath,
  errorPrefix: string,
): Promise<void> {
  try {
    await unlink(pathInfo.absolute);
  } catch (error) {
    throw new ApplyPatchFailure(`${errorPrefix}: ${formatIoError(error)}`);
  }
}

function resolveCwd(input: string): string {
  const absolute = isAbsolute(input) ? input : resolve(process.cwd(), input);
  return normalize(absolute);
}

function resolvePatchPath(cwd: string, rawPath: string): ResolvedPath {
  if (rawPath.length === 0) {
    throw new ApplyPatchFailure("path must be relative");
  }

  if (isAbsolute(rawPath)) {
    throw new ApplyPatchFailure("path must be relative");
  }

  const display = normalizeDisplayPath(rawPath);
  if (
    display === "" ||
    display === "." ||
    display === ".." ||
    display.startsWith("../")
  ) {
    throw new ApplyPatchFailure("path must be relative");
  }

  const absolute = resolve(cwd, rawPath);
  ensureWithinCwd(cwd, absolute);

  return { absolute: normalize(absolute), display };
}

function normalizeDisplayPath(relativePath: string): string {
  return posix.normalize(relativePath.replace(/\\/g, "/"));
}

function ensureWithinCwd(cwd: string, target: string): void {
  const normalizedCwd = normalize(cwd);
  const normalizedTarget = normalize(target);
  const prefix = normalizedCwd.endsWith(sep)
    ? normalizedCwd
    : `${normalizedCwd}${sep}`;
  if (!normalizedTarget.startsWith(prefix)) {
    throw new ApplyPatchFailure("path must be relative");
  }
}

type DiffOperation = {
  type: "equal" | "insert" | "delete";
  line: string;
};

type DiffTag = "equal" | "replace" | "delete" | "insert";
type DiffOpcode = [DiffTag, number, number, number, number];

function buildUnifiedDiff(
  originalLines: string[],
  updatedLines: string[],
  context: number,
): string {
  const operations = diffLines(originalLines, updatedLines);
  const opcodes = buildOpcodes(operations);
  const groups = groupOpcodes(opcodes, context);
  if (groups.length === 0) {
    return "";
  }

  const lines: string[] = [];
  for (const group of groups) {
    lines.push(formatUnifiedHeader(group));
    for (const [tag, i1, i2, j1, j2] of group) {
      if (tag === "equal") {
        for (let index = i1; index < i2; index += 1) {
          lines.push(` ${originalLines[index] ?? ""}`);
        }
        continue;
      }
      if (tag === "replace" || tag === "delete") {
        for (let index = i1; index < i2; index += 1) {
          lines.push(`-${originalLines[index] ?? ""}`);
        }
      }
      if (tag === "replace" || tag === "insert") {
        for (let index = j1; index < j2; index += 1) {
          lines.push(`+${updatedLines[index] ?? ""}`);
        }
      }
    }
  }
  lines.push("");
  return lines.join("\n");
}

function diffLines(
  originalLines: string[],
  updatedLines: string[],
): DiffOperation[] {
  const m = originalLines.length;
  const n = updatedLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (originalLines[i] === updatedLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = 0;
  let j = 0;
  const operations: DiffOperation[] = [];

  while (i < m && j < n) {
    if (originalLines[i] === updatedLines[j]) {
      operations.push({ type: "equal", line: originalLines[i] });
      i += 1;
      j += 1;
    } else if (dp[i][j + 1] >= dp[i + 1][j]) {
      operations.push({ type: "insert", line: updatedLines[j] });
      j += 1;
    } else {
      operations.push({ type: "delete", line: originalLines[i] });
      i += 1;
    }
  }

  while (i < m) {
    operations.push({ type: "delete", line: originalLines[i] });
    i += 1;
  }

  while (j < n) {
    operations.push({ type: "insert", line: updatedLines[j] });
    j += 1;
  }

  return operations;
}

function buildOpcodes(operations: DiffOperation[]): DiffOpcode[] {
  const opcodes: DiffOpcode[] = [];
  let i = 0;
  let j = 0;
  let index = 0;

  while (index < operations.length) {
    const op = operations[index];
    if (op.type === "equal") {
      const i1 = i;
      const j1 = j;
      while (index < operations.length && operations[index].type === "equal") {
        i += 1;
        j += 1;
        index += 1;
      }
      opcodes.push(["equal", i1, i, j1, j]);
      continue;
    }

    const i1 = i;
    const j1 = j;
    let hasDelete = false;
    let hasInsert = false;

    while (index < operations.length && operations[index].type !== "equal") {
      const current = operations[index];
      if (current.type === "delete") {
        i += 1;
        hasDelete = true;
      } else {
        j += 1;
        hasInsert = true;
      }
      index += 1;
    }

    let tag: DiffTag;
    if (hasDelete && hasInsert) {
      tag = "replace";
    } else if (hasDelete) {
      tag = "delete";
    } else {
      tag = "insert";
    }
    opcodes.push([tag, i1, i, j1, j]);
  }

  return opcodes;
}

function groupOpcodes(opcodes: DiffOpcode[], context: number): DiffOpcode[][] {
  if (context < 0) {
    throw new Error("context must be non-negative");
  }
  if (opcodes.length === 0) {
    return [];
  }

  const groups: DiffOpcode[][] = [];
  let group: DiffOpcode[] = [];
  const margin = context * 2;

  for (const opcode of opcodes) {
    const [tag, i1, i2, j1, j2] = opcode;
    if (tag === "equal" && i2 - i1 > margin && group.length > 0) {
      group.push(["equal", i1, i1 + context, j1, j1 + context]);
      groups.push(group);
      group = [];
      group.push(["equal", i2 - context, i2, j2 - context, j2]);
    } else {
      group.push(opcode);
    }
  }

  if (group.length > 0) {
    groups.push(group);
  }

  const trimmedGroups: DiffOpcode[][] = [];
  for (const rawGroup of groups) {
    if (rawGroup.every(([tag]) => tag === "equal")) {
      continue;
    }

    const groupCopy = rawGroup.map((item) => [...item]) as DiffOpcode[];
    const first = groupCopy[0];
    if (first[0] === "equal" && first[2] - first[1] > context) {
      first[1] = first[2] - context;
      first[3] = first[4] - context;
    }

    const lastIndex = groupCopy.length - 1;
    const last = groupCopy[lastIndex];
    if (last[0] === "equal" && last[2] - last[1] > context) {
      last[2] = last[1] + context;
      last[4] = last[3] + context;
    }

    trimmedGroups.push(groupCopy);
  }

  return trimmedGroups;
}

function formatUnifiedHeader(group: DiffOpcode[]): string {
  let origStart = Number.POSITIVE_INFINITY;
  let origEnd = Number.NEGATIVE_INFINITY;
  let newStart = Number.POSITIVE_INFINITY;
  let newEnd = Number.NEGATIVE_INFINITY;

  for (const [tag, i1, i2, j1, j2] of group) {
    if (tag !== "insert") {
      origStart = Math.min(origStart, i1);
      origEnd = Math.max(origEnd, i2);
    }
    if (tag !== "delete") {
      newStart = Math.min(newStart, j1);
      newEnd = Math.max(newEnd, j2);
    }
  }

  if (!Number.isFinite(origStart)) {
    origStart = group[0][1];
  }
  if (!Number.isFinite(origEnd)) {
    origEnd = group[0][2];
  }
  if (!Number.isFinite(newStart)) {
    newStart = group[0][3];
  }
  if (!Number.isFinite(newEnd)) {
    newEnd = group[0][4];
  }

  const origRange = formatRangeUnified(origStart, origEnd);
  const newRange = formatRangeUnified(newStart, newEnd);
  return `@@ -${origRange} +${newRange} @@`;
}

function formatRangeUnified(start: number, end: number): string {
  let beginning = start + 1;
  const length = end - start;
  if (length === 0) {
    beginning -= 1;
    return `${beginning},0`;
  }
  if (length === 1) {
    return `${beginning}`;
  }
  return `${beginning},${length}`;
}

function splitFileLines(contents: string): string[] {
  const lines = contents.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function stripTrailingSentinel(lines: string[]): string[] {
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    return lines.slice(0, -1);
  }
  return [...lines];
}

function formatIoError(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}
