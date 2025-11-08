/**
 * Git operations utilities for Codex.
 *
 * Provides utilities for:
 * - Applying git patches with conflict detection
 * - Creating and restoring ghost commits (snapshots)
 * - Resolving repository paths
 * - Running git commands safely
 */

import { spawn } from "node:child_process";
import { writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, normalize, isAbsolute, sep } from "node:path";
import { symlinkSync, existsSync } from "node:fs";
import { platform } from "node:os";

/**
 * Errors returned while managing git operations.
 */
export class GitToolingError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = "GitToolingError";
  }

  static gitCommand(
    command: string,
    exitCode: number,
    stderr: string,
  ): GitToolingError {
    return new GitToolingError(
      `git command \`${command}\` failed with status ${exitCode}: ${stderr}`,
      "GIT_COMMAND_FAILED",
      { command, exitCode, stderr },
    );
  }

  static notAGitRepository(path: string): GitToolingError {
    return new GitToolingError(
      `${path} is not a git repository`,
      "NOT_A_GIT_REPOSITORY",
      { path },
    );
  }

  static nonRelativePath(path: string): GitToolingError {
    return new GitToolingError(
      `path ${path} must be relative to the repository root`,
      "NON_RELATIVE_PATH",
      { path },
    );
  }

  static pathEscapesRepository(path: string): GitToolingError {
    return new GitToolingError(
      `path ${path} escapes the repository root`,
      "PATH_ESCAPES_REPOSITORY",
      { path },
    );
  }
}

/**
 * Result of running a git command.
 */
interface GitResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a git command and return the result.
 */
async function runGit(
  cwd: string,
  args: string[],
  env?: Record<string, string>,
): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: { ...process.env, ...env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      reject(
        new GitToolingError(
          `Failed to spawn git: ${error.message}`,
          "SPAWN_FAILED",
        ),
      );
    });

    child.on("close", (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Run a git command and return stdout (trimmed), throwing on failure.
 */
async function runGitForStdout(
  cwd: string,
  args: string[],
  env?: Record<string, string>,
): Promise<string> {
  const result = await runGit(cwd, args, env);
  if (result.exitCode !== 0) {
    throw GitToolingError.gitCommand(
      `git ${args.join(" ")}`,
      result.exitCode,
      result.stderr,
    );
  }
  return result.stdout.trim();
}

/**
 * Run a git command for status only (ignore stdout).
 */
async function runGitForStatus(
  cwd: string,
  args: string[],
  env?: Record<string, string>,
): Promise<void> {
  const result = await runGit(cwd, args, env);
  if (result.exitCode !== 0) {
    throw GitToolingError.gitCommand(
      `git ${args.join(" ")}`,
      result.exitCode,
      result.stderr,
    );
  }
}

/**
 * Ensure the path is a git repository.
 */
export async function ensureGitRepository(path: string): Promise<void> {
  try {
    const output = await runGitForStdout(path, [
      "rev-parse",
      "--is-inside-work-tree",
    ]);
    if (output !== "true") {
      throw GitToolingError.notAGitRepository(path);
    }
  } catch (error: any) {
    if (
      error instanceof GitToolingError &&
      error.code === "GIT_COMMAND_FAILED"
    ) {
      if (error.details?.exitCode === 128) {
        throw GitToolingError.notAGitRepository(path);
      }
    }
    throw error;
  }
}

/**
 * Resolve the HEAD commit SHA, or undefined if no HEAD exists.
 */
export async function resolveHead(path: string): Promise<string | undefined> {
  try {
    return await runGitForStdout(path, ["rev-parse", "--verify", "HEAD"]);
  } catch (error: any) {
    if (error instanceof GitToolingError && error.details?.exitCode === 128) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Resolve the repository root path.
 */
export async function resolveRepositoryRoot(path: string): Promise<string> {
  const root = await runGitForStdout(path, ["rev-parse", "--show-toplevel"]);
  return root;
}

/**
 * Normalize a relative path and ensure it doesn't escape the repository.
 */
export function normalizeRelativePath(path: string): string {
  if (isAbsolute(path)) {
    throw GitToolingError.nonRelativePath(path);
  }

  const normalized = normalize(path);
  const parts = normalized.split(sep);

  // Check for parent directory escapes
  let depth = 0;
  for (const part of parts) {
    if (part === "..") {
      depth--;
      if (depth < 0) {
        throw GitToolingError.pathEscapesRepository(path);
      }
    } else if (part !== "." && part !== "") {
      depth++;
    }
  }

  return normalized;
}

/**
 * Details of a ghost commit created from a repository state.
 */
export interface GhostCommit {
  /** Commit ID for the snapshot */
  id: string;
  /** Parent commit ID, if the repository had a HEAD at creation time */
  parent?: string;
  /** Untracked or ignored files that already existed when the snapshot was captured */
  preexisting_untracked_files: string[];
  /** Untracked or ignored directories that already existed when the snapshot was captured */
  preexisting_untracked_dirs: string[];
}

/**
 * Options to control ghost commit creation.
 */
export interface CreateGhostCommitOptions {
  /** Repository path */
  repoPath: string;
  /** Commit message (defaults to "codex snapshot") */
  message?: string;
  /** Paths to force include (ignored files) */
  forceInclude?: string[];
}

/**
 * Create a ghost commit capturing the current state of the repository's working tree.
 *
 * This creates a commit object in git without moving HEAD, useful for creating snapshots.
 */
export async function createGhostCommit(
  options: CreateGhostCommitOptions,
): Promise<GhostCommit> {
  await ensureGitRepository(options.repoPath);

  const repoRoot = await resolveRepositoryRoot(options.repoPath);
  const parent = await resolveHead(repoRoot);
  const message = options.message || "codex snapshot";

  // Create temporary index
  const tempDir = await mkdtemp(join(tmpdir(), "codex-git-index-"));
  const indexPath = join(tempDir, "index");

  try {
    const env = { GIT_INDEX_FILE: indexPath };

    // Pre-populate index with HEAD if it exists
    if (parent) {
      await runGitForStatus(repoRoot, ["read-tree", parent], env);
    }

    // Add all changes
    await runGitForStatus(repoRoot, ["add", "--all"], env);

    // Force add specified paths
    if (options.forceInclude && options.forceInclude.length > 0) {
      const normalized = options.forceInclude.map(normalizeRelativePath);
      await runGitForStatus(repoRoot, ["add", "--force", ...normalized], env);
    }

    // Write tree
    const treeId = await runGitForStdout(repoRoot, ["write-tree"], env);

    // Create commit
    const commitEnv = {
      ...env,
      GIT_AUTHOR_NAME: "Codex",
      GIT_AUTHOR_EMAIL: "codex@openai.com",
      GIT_COMMITTER_NAME: "Codex",
      GIT_COMMITTER_EMAIL: "codex@openai.com",
    };

    const commitArgs = ["commit-tree", treeId];
    if (parent) {
      commitArgs.push("-p", parent);
    }
    commitArgs.push("-m", message);

    const commitId = await runGitForStdout(repoRoot, commitArgs, commitEnv);

    return {
      id: commitId,
      parent,
      preexisting_untracked_files: [],
      preexisting_untracked_dirs: [],
    };
  } finally {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Parameters for applying a git patch.
 */
export interface ApplyGitRequest {
  /** Working directory */
  cwd: string;
  /** Unified diff content */
  diff: string;
  /** Whether to revert the patch (git apply -R) */
  revert?: boolean;
  /** Dry-run mode (git apply --check) */
  preflight?: boolean;
}

/**
 * Result of applying a git patch.
 */
export interface ApplyGitResult {
  /** Exit code from git apply */
  exitCode: number;
  /** Paths that were successfully applied */
  appliedPaths: string[];
  /** Paths that were skipped */
  skippedPaths: string[];
  /** Paths with conflicts */
  conflictedPaths: string[];
  /** stdout from git apply */
  stdout: string;
  /** stderr from git apply */
  stderr: string;
  /** Command that was run (for logging) */
  cmdForLog: string;
}

/**
 * Apply a unified diff to the target repository using git apply.
 */
export async function applyGitPatch(
  req: ApplyGitRequest,
): Promise<ApplyGitResult> {
  const repoRoot = await resolveRepositoryRoot(req.cwd);

  // Write patch to temporary file
  const tempDir = await mkdtemp(join(tmpdir(), "codex-git-patch-"));
  const patchPath = join(tempDir, "patch.diff");

  try {
    await writeFile(patchPath, req.diff);

    // Build git apply args
    const args = ["apply", "--3way"];
    if (req.revert) {
      args.push("-R");
    }
    if (req.preflight) {
      args.push("--check");
    }
    args.push(patchPath);

    const cmdForLog = `git ${args.join(" ")}`;
    const result = await runGit(repoRoot, args);

    const { appliedPaths, skippedPaths, conflictedPaths } = parseGitApplyOutput(
      result.stdout,
      result.stderr,
    );

    return {
      exitCode: result.exitCode,
      appliedPaths: appliedPaths.sort(),
      skippedPaths: skippedPaths.sort(),
      conflictedPaths: conflictedPaths.sort(),
      stdout: result.stdout,
      stderr: result.stderr,
      cmdForLog,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Parse git apply output to extract applied, skipped, and conflicted paths.
 */
function parseGitApplyOutput(
  stdout: string,
  stderr: string,
): {
  appliedPaths: string[];
  skippedPaths: string[];
  conflictedPaths: string[];
} {
  const appliedPaths: string[] = [];
  const skippedPaths: string[] = [];
  const conflictedPaths: string[] = [];

  const combined = stdout + "\n" + stderr;

  // Match patterns like "Applying: path/to/file" or "Applied patch to 'path/to/file'"
  const applyPattern = /(?:Applying|Applied patch to)[:\s]+'?([^'\n]+)'?/g;
  let match;
  while ((match = applyPattern.exec(combined)) !== null) {
    appliedPaths.push(match[1]);
  }

  // Match conflict patterns
  const conflictPattern = /CONFLICT.*?:\s+([^\n]+)/g;
  while ((match = conflictPattern.exec(combined)) !== null) {
    conflictedPaths.push(match[1]);
  }

  // Match skipped patterns
  const skipPattern = /Skipped patch[:\s]+'?([^'\n]+)'?/g;
  while ((match = skipPattern.exec(combined)) !== null) {
    skippedPaths.push(match[1]);
  }

  return { appliedPaths, skippedPaths, conflictedPaths };
}

/**
 * Create a symlink (cross-platform).
 */
export function createSymlink(
  source: string,
  linkTarget: string,
  destination: string,
): void {
  // On Windows, we need to know if the source is a directory
  const isWindows = platform() === "win32";

  if (isWindows) {
    // Check if source is a directory
    const isDir =
      existsSync(source) && require("fs").statSync(source).isDirectory();
    if (isDir) {
      symlinkSync(linkTarget, destination, "dir");
    } else {
      symlinkSync(linkTarget, destination, "file");
    }
  } else {
    // Unix: symlink doesn't need to know the type
    symlinkSync(linkTarget, destination);
  }
}

/**
 * Restore a ghost commit to the working tree.
 */
export async function restoreGhostCommit(
  repoPath: string,
  ghostCommit: GhostCommit,
): Promise<void> {
  await restoreToCommit(repoPath, ghostCommit.id);
}

/**
 * Restore the working tree to a specific commit.
 */
export async function restoreToCommit(
  repoPath: string,
  commitId: string,
): Promise<void> {
  const repoRoot = await resolveRepositoryRoot(repoPath);
  await runGitForStatus(repoRoot, ["checkout", commitId, "--", "."]);
}
