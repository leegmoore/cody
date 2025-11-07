import { spawn } from "bun";
import { promises as fs } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { ToolResult } from "./types";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 2000;
const COMMAND_TIMEOUT_MS = 30_000;
const TIMEOUT_MESSAGE = "rg timed out after 30 seconds";

export interface GrepFilesParams {
  pattern: string;
  include?: string | null;
  path?: string | null;
  limit?: number | null;
}

export interface GrepFilesOptions {
  cwd?: string;
  timeoutMs?: number;
  rgCommand?: string;
}

export async function grepFiles(
  params: GrepFilesParams,
  options: GrepFilesOptions = {},
): Promise<ToolResult> {
  const pattern = (params.pattern ?? "").trim();
  if (!pattern) {
    throw new Error("pattern must not be empty");
  }

  const limitInput = params.limit ?? undefined;
  const limit = limitInput === undefined ? DEFAULT_LIMIT : limitInput;
  if (limit <= 0) {
    throw new Error("limit must be greater than zero");
  }
  const cappedLimit = Math.min(limit, MAX_LIMIT);

  const cwd = options.cwd ?? process.cwd();
  const searchPathRaw = params.path ?? cwd;
  const searchPath = resolvePath(searchPathRaw);
  await verifyPathExists(searchPath);

  const include = params.include?.trim();
  const glob = include ? include : undefined;

  const command = options.rgCommand ?? "rg";
  const cmd = buildCommand(command, pattern, glob, searchPath);

  let subprocess: ReturnType<typeof spawn>;
  try {
    subprocess = spawn({
      cmd,
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    throw new Error(
      `failed to launch rg: ${(error as Error).message}. Ensure ripgrep is installed and on PATH.`,
    );
  }

  const timeoutMs = options.timeoutMs ?? COMMAND_TIMEOUT_MS;

  const processPromise = (async () => {
    const [stdout, stderr] = await Promise.all([
      streamToString(subprocess.stdout),
      streamToString(subprocess.stderr),
    ]);
    const exitCode = await subprocess.exited;
    return { stdout, stderr, exitCode };
  })();

  const result = await withTimeout(processPromise, timeoutMs, () => {
    try {
      subprocess.kill();
    } catch {
      // ignore kill errors
    }
  });

  if (result.exitCode === 0) {
    const matches = parseResults(result.stdout, cappedLimit);
    if (matches.length === 0) {
      return { content: "No matches found.", success: false };
    }
    return { content: matches.join("\n"), success: true };
  }

  if (result.exitCode === 1) {
    return { content: "No matches found.", success: false };
  }

  const stderr = result.stderr.trim();
  throw new Error(`rg failed: ${stderr}`);
}

function buildCommand(
  command: string,
  pattern: string,
  glob: string | undefined,
  searchPath: string,
): string[] {
  const args = [
    command,
    "--files-with-matches",
    "--sortr=modified",
    "--regexp",
    pattern,
    "--no-messages",
  ];

  if (glob && glob.length > 0) {
    args.push("--glob", glob);
  }

  args.push("--", searchPath);
  return args;
}

async function verifyPathExists(path: string): Promise<void> {
  try {
    await fs.stat(path);
  } catch (error) {
    throw new Error(`unable to access \`${path}\`: ${(error as Error).message}`);
  }
}

function parseResults(stdout: string, limit: number): string[] {
  const results: string[] = [];
  for (const line of stdout.split("\n")) {
    if (!line) {
      continue;
    }
    results.push(line);
    if (results.length === limit) {
      break;
    }
  }
  return results;
}

async function streamToString(
  stream: ReadableStream<Uint8Array> | number | null | undefined,
): Promise<string> {
  if (!stream || typeof stream === "number") {
    return "";
  }
  const response = new Response(stream);
  return await response.text();
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        onTimeout();
      } catch {
        // ignore errors while killing the process
      }
      reject(new Error(TIMEOUT_MESSAGE));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
