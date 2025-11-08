import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  GitToolingError,
  ensureGitRepository,
  resolveHead,
  resolveRepositoryRoot,
  normalizeRelativePath,
  createGhostCommit,
  applyGitPatch,
  restoreGhostCommit,
  restoreToCommit,
} from "./index";

describe("GitToolingError", () => {
  it("should create git command error", () => {
    const error = GitToolingError.gitCommand(
      "git status",
      1,
      "fatal: not a git repository",
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("git status");
    expect(error.message).toContain("fatal: not a git repository");
    expect(error.code).toBe("GIT_COMMAND_FAILED");
  });

  it("should create not a git repository error", () => {
    const error = GitToolingError.notAGitRepository("/tmp/not-a-repo");
    expect(error.message).toContain("/tmp/not-a-repo");
    expect(error.code).toBe("NOT_A_GIT_REPOSITORY");
  });

  it("should create non-relative path error", () => {
    const error = GitToolingError.nonRelativePath("/absolute/path");
    expect(error.message).toContain("must be relative");
    expect(error.code).toBe("NON_RELATIVE_PATH");
  });

  it("should create path escapes repository error", () => {
    const error = GitToolingError.pathEscapesRepository("../../escape");
    expect(error.message).toContain("escapes");
    expect(error.code).toBe("PATH_ESCAPES_REPOSITORY");
  });
});

describe("normalizeRelativePath", () => {
  it("should normalize simple relative path", () => {
    const result = normalizeRelativePath("foo/bar");
    expect(result).toBe(join("foo", "bar"));
  });

  it("should normalize path with dot segments", () => {
    const result = normalizeRelativePath("foo/./bar");
    expect(result).toBe(join("foo", "bar"));
  });

  it("should handle safe parent directory navigation", () => {
    const result = normalizeRelativePath("foo/../bar");
    expect(result).toBe("bar");
  });

  it("should throw on absolute path", () => {
    expect(() => normalizeRelativePath("/absolute/path")).toThrow(
      GitToolingError,
    );
  });

  it("should throw on path that escapes repository", () => {
    expect(() => normalizeRelativePath("../escape")).toThrow(GitToolingError);
    expect(() => normalizeRelativePath("../../escape")).toThrow(
      GitToolingError,
    );
  });
});

describe("Git Operations", () => {
  let tempRepo: string;

  beforeEach(async () => {
    // Create a temporary git repository
    tempRepo = await mkdtemp(join(tmpdir(), "codex-git-test-"));
    execSync("git init", { cwd: tempRepo });
    execSync('git config user.email "test@example.com"', { cwd: tempRepo });
    execSync('git config user.name "Test User"', { cwd: tempRepo });
    execSync("git config commit.gpgsign false", { cwd: tempRepo });
  });

  afterEach(async () => {
    await rm(tempRepo, { recursive: true, force: true });
  });

  describe("ensureGitRepository", () => {
    it("should not throw for valid git repository", async () => {
      await expect(ensureGitRepository(tempRepo)).resolves.toBeUndefined();
    });

    it("should throw for non-git directory", async () => {
      const nonGitDir = await mkdtemp(join(tmpdir(), "not-git-"));
      try {
        await expect(ensureGitRepository(nonGitDir)).rejects.toThrow(
          GitToolingError,
        );
      } finally {
        await rm(nonGitDir, { recursive: true, force: true });
      }
    });
  });

  describe("resolveHead", () => {
    it("should return undefined for repository with no commits", async () => {
      const head = await resolveHead(tempRepo);
      expect(head).toBeUndefined();
    });

    it("should return commit SHA after creating commit", async () => {
      // Create a commit
      const testFile = join(tempRepo, "test.txt");
      await writeFile(testFile, "test content");
      execSync("git add test.txt", { cwd: tempRepo });
      execSync('git commit -m "Initial commit"', { cwd: tempRepo });

      const head = await resolveHead(tempRepo);
      expect(head).toBeDefined();
      expect(head).toMatch(/^[0-9a-f]{40}$/);
    });
  });

  describe("resolveRepositoryRoot", () => {
    it("should return repository root path", async () => {
      const root = await resolveRepositoryRoot(tempRepo);
      expect(root).toBe(tempRepo);
    });

    it("should return root from subdirectory", async () => {
      const subdir = join(tempRepo, "subdir");
      await mkdir(subdir);

      const root = await resolveRepositoryRoot(subdir);
      expect(root).toBe(tempRepo);
    });
  });

  describe("createGhostCommit", () => {
    it("should create ghost commit with no prior commits", async () => {
      // Add some files
      await writeFile(join(tempRepo, "file1.txt"), "content 1");
      await writeFile(join(tempRepo, "file2.txt"), "content 2");

      const ghostCommit = await createGhostCommit({
        repoPath: tempRepo,
        message: "Test snapshot",
      });

      expect(ghostCommit.id).toBeDefined();
      expect(ghostCommit.id).toMatch(/^[0-9a-f]{40}$/);
      expect(ghostCommit.parent).toBeUndefined();
    });

    it("should create ghost commit with parent", async () => {
      // Create initial commit
      await writeFile(join(tempRepo, "initial.txt"), "initial");
      execSync("git add initial.txt", { cwd: tempRepo });
      execSync('git commit -m "Initial"', { cwd: tempRepo });

      const initialHead = await resolveHead(tempRepo);

      // Add more files
      await writeFile(join(tempRepo, "new.txt"), "new content");

      const ghostCommit = await createGhostCommit({
        repoPath: tempRepo,
      });

      expect(ghostCommit.id).toBeDefined();
      expect(ghostCommit.parent).toBe(initialHead);
    });

    it("should use custom message", async () => {
      await writeFile(join(tempRepo, "file.txt"), "content");

      const ghostCommit = await createGhostCommit({
        repoPath: tempRepo,
        message: "Custom snapshot message",
      });

      expect(ghostCommit.id).toBeDefined();
      // Verify message (git show)
      const output = execSync(`git show -s --format=%s ${ghostCommit.id}`, {
        cwd: tempRepo,
        encoding: "utf-8",
      });
      expect(output.trim()).toBe("Custom snapshot message");
    });
  });

  describe("applyGitPatch", () => {
    beforeEach(async () => {
      // Create initial file
      await writeFile(join(tempRepo, "test.txt"), "line 1\nline 2\nline 3\n");
      execSync("git add test.txt", { cwd: tempRepo });
      execSync('git commit -m "Initial"', { cwd: tempRepo });
    });

    it("should apply simple patch", async () => {
      const patch = `diff --git a/test.txt b/test.txt
index abc123..def456 100644
--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,4 @@
 line 1
+new line
 line 2
 line 3
`;

      const result = await applyGitPatch({
        cwd: tempRepo,
        diff: patch,
      });

      expect(result.exitCode).toBe(0);
    });

    it("should run in preflight mode without modifying files", async () => {
      const patch = `diff --git a/test.txt b/test.txt
index abc123..def456 100644
--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,4 @@
 line 1
+new line
 line 2
 line 3
`;

      await applyGitPatch({
        cwd: tempRepo,
        diff: patch,
        preflight: true,
      });

      // File should not be modified
      const content = await require("fs/promises").readFile(
        join(tempRepo, "test.txt"),
        "utf-8",
      );
      expect(content).toBe("line 1\nline 2\nline 3\n");
    });
  });

  describe("restoreToCommit", () => {
    it("should restore working tree to commit", async () => {
      // Create first commit
      await writeFile(join(tempRepo, "file.txt"), "version 1");
      execSync("git add file.txt", { cwd: tempRepo });
      execSync('git commit -m "Version 1"', { cwd: tempRepo });
      const commit1 = await resolveHead(tempRepo);

      // Create second commit
      await writeFile(join(tempRepo, "file.txt"), "version 2");
      execSync("git add file.txt", { cwd: tempRepo });
      execSync('git commit -m "Version 2"', { cwd: tempRepo });

      // Restore to first commit
      await restoreToCommit(tempRepo, commit1!);

      const content = await require("fs/promises").readFile(
        join(tempRepo, "file.txt"),
        "utf-8",
      );
      expect(content).toBe("version 1");
    });
  });

  describe("restoreGhostCommit", () => {
    it("should restore ghost commit state", async () => {
      // Create initial state
      await writeFile(join(tempRepo, "original.txt"), "original");
      execSync("git add original.txt", { cwd: tempRepo });
      execSync('git commit -m "Original"', { cwd: tempRepo });

      // Create modified state
      await writeFile(join(tempRepo, "modified.txt"), "modified content");
      await writeFile(join(tempRepo, "new.txt"), "new content");

      // Create ghost commit of modified state
      const ghostCommit = await createGhostCommit({
        repoPath: tempRepo,
        message: "Snapshot",
      });

      // Make more changes
      await writeFile(join(tempRepo, "another.txt"), "another");

      // Restore ghost commit
      await restoreGhostCommit(tempRepo, ghostCommit);

      // Check that we have the ghost commit state
      const modifiedExists = require("fs").existsSync(
        join(tempRepo, "modified.txt"),
      );
      const newExists = require("fs").existsSync(join(tempRepo, "new.txt"));

      expect(modifiedExists).toBe(true);
      expect(newExists).toBe(true);
    });
  });
});
