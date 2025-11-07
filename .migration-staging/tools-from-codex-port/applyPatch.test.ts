import { afterEach, describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { join } from "node:path";

import {
  ApplyPatchArgs,
  Hunk,
  InvalidHunkError,
  InvalidPatchError,
  ParseMode,
  UpdateFileChunk,
  parseOneHunk,
  parsePatchText,
  parseUpdateFileChunk,
} from "../../src/tools/applyPatch/parser";
import {
  applyPatch,
  maybeParseApplyPatch,
  maybeParseApplyPatchVerified,
  unifiedDiffFromChunks,
} from "../../src/tools/applyPatch/applyPatch";
import { seekSequence } from "../../src/tools/applyPatch/seekSequence";
import {
  cleanupTempDirs,
  createTempDir,
  createTempFile,
} from "../helpers/fixtures";


function expectInvalidPatch(fn: () => ApplyPatchArgs, detail: string): void {
  try {
    fn();
    throw new Error("Expected InvalidPatchError but call succeeded");
  } catch (error) {
    if (!(error instanceof InvalidPatchError)) {
      throw error;
    }
    expect(error.detail).toBe(detail);
  }
}

function expectInvalidHunk(
  fn: () => unknown,
  detail: string,
  lineNumber: number,
): void {
  try {
    fn();
    throw new Error("Expected InvalidHunkError but call succeeded");
  } catch (error) {
    if (!(error instanceof InvalidHunkError)) {
      throw error;
    }
    expect(error.detail).toBe(detail);
    expect(error.lineNumber).toBe(lineNumber);
  }
}
function wrapPatch(body: string): string {
  return `*** Begin Patch\n${body}\n*** End Patch`;
}

function expectedSingleAdd(): Hunk[] {
  return [
    {
      type: "add",
      path: "foo",
      contents: "hi\n",
    },
  ];
}

function argsBash(script: string): string[] {
  return ["bash", "-lc", script];
}

function heredocScript(prefix: string): string {
  return `${prefix}apply_patch <<'PATCH'
*** Begin Patch
*** Add File: foo
+hi
*** End Patch
PATCH`;
}

function heredocScriptWithSuffix(prefix: string, suffix: string): string {
  return `${prefix}apply_patch <<'PATCH'
*** Begin Patch
*** Add File: foo
+hi
*** End Patch
PATCH${suffix}`;
}

async function expectMatch(
  script: string,
  expectedWorkdir: string | null,
): Promise<void> {
  const result = await maybeParseApplyPatch(argsBash(script));
  if (result.type !== "body") {
    throw new Error(`expected body but got ${result.type}`);
  }
  expect(result.args.workdir).toBe(expectedWorkdir);
  expect(result.args.hunks).toEqual(expectedSingleAdd());
}

async function expectNotMatch(script: string): Promise<void> {
  const result = await maybeParseApplyPatch(argsBash(script));
  expect(result.type).toBe("not-apply-patch");
}


describe("applyPatch command parsing", () => {
  afterEach(async () => {
    await cleanupTempDirs();
  });

  test("implicit patch single arg is error", async () => {
    const patch = "*** Begin Patch\n*** Add File: foo\n+hi\n*** End Patch";
    const args = [patch];
    const cwd = await createTempDir();
    const result = await maybeParseApplyPatchVerified(args, cwd);
    expect(result.type).toBe("correctness-error");
    if (result.type !== "correctness-error") {
      throw new Error("should be correctness error");
    }
    expect(result.error.type).toBe("implicit-invocation");
  });

  test("implicit patch bash script is error", async () => {
    const script = "*** Begin Patch\n*** Add File: foo\n+hi\n*** End Patch";
    const args = argsBash(script);
    const cwd = await createTempDir();
    const result = await maybeParseApplyPatchVerified(args, cwd);
    expect(result.type).toBe("correctness-error");
    if (result.type !== "correctness-error") {
      throw new Error("should be correctness error");
    }
    expect(result.error.type).toBe("implicit-invocation");
  });

  test("literal apply_patch invocation returns body", async () => {
    const args = [
      "apply_patch",
      `*** Begin Patch
*** Add File: foo
+hi
*** End Patch
`,
    ];
    const result = await maybeParseApplyPatch(args);
    expect(result.type).toBe("body");
    if (result.type !== "body") {
      throw new Error("should return body");
    }
    expect(result.args.hunks).toEqual(expectedSingleAdd());
  });

  test("literal applypatch invocation returns body", async () => {
    const args = [
      "applypatch",
      `*** Begin Patch
*** Add File: foo
+hi
*** End Patch
`,
    ];
    const result = await maybeParseApplyPatch(args);
    expect(result.type).toBe("body");
    if (result.type !== "body") {
      throw new Error("should return body");
    }
    expect(result.args.hunks).toEqual(expectedSingleAdd());
  });

  test("heredoc matches apply_patch", async () => {
    await expectMatch(heredocScript(""), null);
  });

  test("heredoc matches applypatch", async () => {
    const script = `applypatch <<'PATCH'
*** Begin Patch
*** Add File: foo
+hi
*** End Patch
PATCH`;
    const args = ["bash", "-lc", script];
    const result = await maybeParseApplyPatch(args);
    expect(result.type).toBe("body");
    if (result.type !== "body") {
      throw new Error("should return body");
    }
    expect(result.args.workdir).toBeNull();
    expect(result.args.hunks).toEqual(expectedSingleAdd());
  });

  test("heredoc with leading cd captures workdir", async () => {
    await expectMatch(heredocScript("cd foo && "), "foo");
  });

  test("cd with semicolon is ignored", async () => {
    await expectNotMatch(heredocScript("cd foo; "));
  });

  test("cd with or is ignored", async () => {
    await expectNotMatch(heredocScript("cd bar || "));
  });

  test("cd with pipe is ignored", async () => {
    await expectNotMatch(heredocScript("cd bar | "));
  });

  test("cd single quoted path with spaces is captured", async () => {
    await expectMatch(heredocScript("cd 'foo bar' && "), "foo bar");
  });

  test("cd double quoted path with spaces is captured", async () => {
    await expectMatch(heredocScript('cd "foo bar" && '), "foo bar");
  });

  test("echo and apply_patch is ignored", async () => {
    await expectNotMatch(heredocScript("echo foo && "));
  });

  test("apply_patch with extra arg is ignored", async () => {
    const script = `apply_patch foo <<'PATCH'
*** Begin Patch
*** Add File: foo
+hi
*** End Patch
PATCH`;
    await expectNotMatch(script);
  });

  test("double cd then apply_patch is ignored", async () => {
    await expectNotMatch(heredocScript("cd foo && cd bar && "));
  });

  test("cd with two args is ignored", async () => {
    await expectNotMatch(heredocScript("cd foo bar && "));
  });

  test("cd then apply_patch with trailing commands is ignored", async () => {
    await expectNotMatch(heredocScriptWithSuffix("cd bar && ", " && echo done"));
  });

  test("echo then cd apply_patch is ignored", async () => {
    await expectNotMatch(heredocScript("echo foo; cd bar && "));
  });

  test("maybeParseApplyPatchVerified returns action for update patch", async () => {
    const cwd = await createTempDir();
    await createTempFile(cwd, "source.txt", "session directory content\n");
    const patch = wrapPatch([
      "*** Update File: source.txt",
      "@@",
      "-session directory content",
      "+updated session directory content",
    ].join("\n"));
    const args = ["apply_patch", patch];
    const result = await maybeParseApplyPatchVerified(args, cwd);
    expect(result.type).toBe("body");
    if (result.type !== "body") {
      throw new Error("expected body response");
    }
    const expectedPath = join(cwd, "source.txt");
    expect(result.action.cwd).toBe(cwd);
    expect(result.action.patch).toBe(patch);
    expect(result.action.changes.size).toBe(1);
    const change = result.action.changes.get(expectedPath);
    if (!change || change.type !== "update") {
      throw new Error("expected single update change");
    }
    expect(change.movePath).toBeNull();
    expect(change.newContent).toBe("updated session directory content\n");
    expect(change.unifiedDiff).toBe([
      "@@ -1 +1 @@",
      "-session directory content",
      "+updated session directory content",
      "",
    ].join("\n"));
  });

  test("maybeParseApplyPatchVerified returns action for mixed operations", async () => {
    const cwd = await createTempDir();
    await createTempFile(cwd, "remove.txt", "remove me\n");
    await createTempFile(cwd, "source.txt", "line1\nline2\n");

    const patch = wrapPatch([
      "*** Add File: added.txt",
      "+hello new file",
      "*** Delete File: remove.txt",
      "*** Update File: source.txt",
      "@@",
      "-line1",
      "+line1 updated",
      " line2",
    ].join("\n"));

    const result = await maybeParseApplyPatchVerified(["apply_patch", patch], cwd);

    expect(result.type).toBe("body");
    if (result.type !== "body") {
      throw new Error("expected body response");
    }

    expect(result.action.cwd).toBe(cwd);
    expect(result.action.patch).toBe(patch);
    expect(result.action.changes.size).toBe(3);

    const addedPath = join(cwd, "added.txt");
    const added = result.action.changes.get(addedPath);
    if (!added || added.type !== "add") {
      throw new Error("expected added file change");
    }
    expect(added.content).toBe("hello new file\n");

    const deletedPath = join(cwd, "remove.txt");
    const deleted = result.action.changes.get(deletedPath);
    if (!deleted || deleted.type !== "delete") {
      throw new Error("expected deleted file change");
    }
    expect(deleted.content).toBe("remove me\n");

    const updatedPath = join(cwd, "source.txt");
    const updated = result.action.changes.get(updatedPath);
    if (!updated || updated.type !== "update") {
      throw new Error("expected updated file change");
    }
    expect(updated.movePath).toBeNull();
    expect(updated.newContent).toBe("line1 updated\nline2\n");
    expect(updated.unifiedDiff).toBe([
      "@@ -1,2 +1,2 @@",
      "-line1",
      "+line1 updated",
      " line2",
      "",
    ].join("\n"));
  });

  test("maybeParseApplyPatchVerified resolves cd workdir and move path", async () => {
    const cwd = await createTempDir();
    const nested = join(cwd, "nested dir");
    await createTempFile(nested, "source.txt", "before\n");

    const patch = wrapPatch([
      "*** Update File: source.txt",
      "*** Move to: renamed.txt",
      "@@",
      "-before",
      "+after",
    ].join("\n"));

    const script = `cd 'nested dir' && apply_patch <<'PATCH'\n${patch}\nPATCH`;
    const result = await maybeParseApplyPatchVerified(argsBash(script), cwd);

    expect(result.type).toBe("body");
    if (result.type !== "body") {
      throw new Error("expected body response");
    }

    const expectedCwd = join(cwd, "nested dir");
    expect(result.action.cwd).toBe(expectedCwd);
    expect(result.action.patch).toBe(patch);
    expect(result.action.changes.size).toBe(1);

    const sourcePath = join(expectedCwd, "source.txt");
    const change = result.action.changes.get(sourcePath);
    if (!change || change.type !== "update") {
      throw new Error("expected update change");
    }
    expect(change.movePath).toBe(join(expectedCwd, "renamed.txt"));
    expect(change.newContent).toBe("after\n");
    expect(change.unifiedDiff).toBe([
      "@@ -1 +1 @@",
      "-before",
      "+after",
      "",
    ].join("\n"));
  });

  test("maybeParseApplyPatchVerified reports io error when delete target missing", async () => {
    const cwd = await createTempDir();
    const patch = wrapPatch("*** Delete File: missing.txt");
    const result = await maybeParseApplyPatchVerified(["apply_patch", patch], cwd);

    expect(result.type).toBe("correctness-error");
    if (result.type !== "correctness-error") {
      throw new Error("expected correctness error");
    }
    expect(result.error.type).toBe("io-error");
    expect(result.error.detail).toBe("Failed to read missing.txt");
    expect(result.error.message.startsWith("Failed to read missing.txt:")).toBe(true);
  });

  test("maybeParseApplyPatchVerified reports compute replacements failure", async () => {
    const cwd = await createTempDir();
    await createTempFile(cwd, "source.txt", "line1\nline2\n");
    const patch = wrapPatch([
      "*** Update File: source.txt",
      "@@",
      "-missing",
      "+replacement",
    ].join("\n"));

    const result = await maybeParseApplyPatchVerified(["apply_patch", patch], cwd);

    expect(result.type).toBe("correctness-error");
    if (result.type !== "correctness-error") {
      throw new Error("expected correctness error");
    }
    expect(result.error.type).toBe("compute-replacements");
    expect(result.error.detail).toBe([
      "Failed to find expected lines in source.txt:",
      "missing",
    ].join("\n"));
  });

  test("maybeParseApplyPatchVerified rejects absolute patch paths", async () => {
    const cwd = await createTempDir();
    const patch = wrapPatch([
      "*** Update File: /tmp/absolute.txt",
      "@@",
      "-line",
      "+line",
    ].join("\n"));

    const result = await maybeParseApplyPatchVerified(["apply_patch", patch], cwd);

    expect(result.type).toBe("correctness-error");
    if (result.type !== "correctness-error") {
      throw new Error("expected correctness error");
    }
    expect(result.error.type).toBe("compute-replacements");
    expect(result.error.detail).toBe("path must be relative");
  });
});
function expectedSingleAdd(): Hunk[] {
  return [
    {
      type: "add",
      path: "foo",
      contents: "hi\n",
    },
  ];
}

function argsBash(script: string): string[] {
  return ["bash", "-lc", script];
}

function heredocScript(prefix: string): string {
  return `${prefix}apply_patch <<'PATCH'
*** Begin Patch
*** Add File: foo
+hi
*** End Patch
PATCH`;
}

function heredocScriptWithSuffix(prefix: string, suffix: string): string {
  return `${prefix}apply_patch <<'PATCH'
*** Begin Patch
*** Add File: foo
+hi
*** End Patch
PATCH${suffix}`;
}



describe("applyPatch parser", () => {
  test("parsePatchText strict validates patch boundaries", () => {
    expectInvalidPatch(
      () => parsePatchText("bad", ParseMode.Strict),
      "The first line of the patch must be '*** Begin Patch'",
    );
    expectInvalidPatch(
      () => parsePatchText("*** Begin Patch\nbad", ParseMode.Strict),
      "The last line of the patch must be '*** End Patch'",
    );
  });

  test("parsePatchText strict handles empty update hunk", () => {
    expectInvalidHunk(
      () =>
        parsePatchText(
          "*** Begin Patch\n*** Update File: test.py\n*** End Patch",
          ParseMode.Strict,
        ),
      "Update file hunk for path 'test.py' is empty",
      2,
    );
  });

  test("parsePatchText strict allows empty patch body", () => {
    const result = parsePatchText(
      "*** Begin Patch\n*** End Patch",
      ParseMode.Strict,
    );
    expect(result.hunks).toEqual([]);
  });

  test("parsePatchText strict parses multiple hunk types", () => {
    const result = parsePatchText(
      [
        "*** Begin Patch",
        "*** Add File: path/add.py",
        "+abc",
        "+def",
        "*** Delete File: path/delete.py",
        "*** Update File: path/update.py",
        "*** Move to: path/update2.py",
        "@@ def f():",
        "-    pass",
        "+    return 123",
        "*** End Patch",
      ].join("\n"),
      ParseMode.Strict,
    );

    const expected: Hunk[] = [
      { type: "add", path: "path/add.py", contents: "abc\ndef\n" },
      { type: "delete", path: "path/delete.py" },
      {
        type: "update",
        path: "path/update.py",
        movePath: "path/update2.py",
        chunks: [
          {
            changeContext: "def f():",
            oldLines: ["    pass"],
            newLines: ["    return 123"],
            isEndOfFile: false,
          },
        ],
      },
    ];

    expect(result.hunks).toEqual(expected);
  });

  test("parsePatchText strict handles update followed by add", () => {
    const result = parsePatchText(
      [
        "*** Begin Patch",
        "*** Update File: file.py",
        "@@",
        "+line",
        "*** Add File: other.py",
        "+content",
        "*** End Patch",
      ].join("\n"),
      ParseMode.Strict,
    );

    const expected: Hunk[] = [
      {
        type: "update",
        path: "file.py",
        movePath: null,
        chunks: [
          {
            changeContext: null,
            oldLines: [],
            newLines: ["line"],
            isEndOfFile: false,
          },
        ],
      },
      { type: "add", path: "other.py", contents: "content\n" },
    ];

    expect(result.hunks).toEqual(expected);
  });

  test("parsePatchText strict allows missing context for first chunk", () => {
    const patch = [
      "*** Begin Patch",
      "*** Update File: file2.py",
      " import foo",
      "+bar",
      "*** End Patch",
    ].join("\n");
    const result = parsePatchText(patch, ParseMode.Strict);

    const expected: Hunk[] = [
      {
        type: "update",
        path: "file2.py",
        movePath: null,
        chunks: [
          {
            changeContext: null,
            oldLines: ["import foo"],
            newLines: ["import foo", "bar"],
            isEndOfFile: false,
          },
        ],
      },
    ];

    expect(result.hunks).toEqual(expected);
    expect(result.patch).toBe(patch);
  });

  test("parsePatchText lenient strips heredoc markers", () => {
    const patchBody = [
      "*** Begin Patch",
      "*** Update File: file2.py",
      " import foo",
      "+bar",
      "*** End Patch",
    ].join("\n");
    const heredocs = [
      `<<EOF\n${patchBody}\nEOF\n`,
      `<<'EOF'\n${patchBody}\nEOF\n`,
      `<<"EOF"\n${patchBody}\nEOF\n`,
    ];

    for (const heredoc of heredocs) {
      const result = parsePatchText(heredoc, ParseMode.Lenient);
      expect(result.patch).toBe(patchBody);
      expect(result.hunks).toEqual([
        {
          type: "update",
          path: "file2.py",
          movePath: null,
          chunks: [
            {
              changeContext: null,
              oldLines: ["import foo"],
              newLines: ["import foo", "bar"],
              isEndOfFile: false,
            },
          ],
        },
      ]);
    }

    expectInvalidPatch(
      () => parsePatchText(`<<\"EOF'\n${patchBody}\nEOF\n`, ParseMode.Lenient),
      "The first line of the patch must be '*** Begin Patch'",
    );
    expectInvalidPatch(
      () => parsePatchText("<<EOF\n*** Begin Patch\n*** Update File: file2.py\nEOF\n", ParseMode.Lenient),
      "The last line of the patch must be '*** End Patch'",
    );
  });

  test("parseOneHunk reports invalid header", () => {
    expectInvalidHunk(
      () => {
        parseOneHunk(["bad"], 234);
        throw new Error("parseOneHunk should throw");
      },
      "'bad' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'",
      234,
    );
  });

  test("parseUpdateFileChunk error cases", () => {
    const expectChunkError = (
      lines: readonly string[],
      detail: string,
      lineNumber: number,
      allowMissingContext: boolean,
    ) => {
      try {
        parseUpdateFileChunk(lines, 123, allowMissingContext);
        throw new Error("Expected parseUpdateFileChunk to throw");
      } catch (error) {
        if (!(error instanceof InvalidHunkError)) {
          throw error;
        }
        expect(error.detail).toBe(detail);
        expect(error.lineNumber).toBe(lineNumber);
      }
    };

    expectChunkError(["bad"], "Expected update hunk to start with a @@ context marker, got: 'bad'", 123, false);
    expectChunkError(["@@"], "Update hunk does not contain any lines", 124, false);
    expectChunkError(
      ["@@", "bad"],
      "Unexpected line found in update hunk: 'bad'. Every line should start with ' ' (context line), '+' (added line), or '-' (removed line)",
      124,
      false,
    );
    expectChunkError(["@@", "*** End of File"], "Update hunk does not contain any lines", 124, false);
  });

  test("parseUpdateFileChunk success cases", () => {
    const [chunkA, linesConsumedA] = parseUpdateFileChunk(
      [
        "@@ change_context",
        "",
        " context",
        "-remove",
        "+add",
        " context2",
        "*** End Patch",
      ],
      123,
      false,
    );
    const expectedChunkA: UpdateFileChunk = {
      changeContext: "change_context",
      oldLines: ["", "context", "remove", "context2"],
      newLines: ["", "context", "add", "context2"],
      isEndOfFile: false,
    };
    expect(chunkA).toEqual(expectedChunkA);
    expect(linesConsumedA).toBe(6);

    const [chunkB, linesConsumedB] = parseUpdateFileChunk(
      ["@@", "+line", "*** End of File"],
      123,
      false,
    );
    const expectedChunkB: UpdateFileChunk = {
      changeContext: null,
      oldLines: [],
      newLines: ["line"],
      isEndOfFile: true,
    };
    expect(chunkB).toEqual(expectedChunkB);
    expect(linesConsumedB).toBe(3);
  });
});


describe("applyPatch executor", () => {
  afterEach(async () => {
    await cleanupTempDirs();
  });

  test("add file hunk creates file with contents", async () => {
    const cwd = await createTempDir();
    const patch = wrapPatch(["*** Add File: add.txt", "+ab", "+cd"].join("\n"));

    const result = await applyPatch(patch, { cwd });

    const expectedStdout = [
      "Success. Updated the following files:",
      "A add.txt",
      "",
    ].join("\n");
    expect(result).toEqual({
      success: true,
      stdout: expectedStdout,
      stderr: "",
    });

    const content = await fs.readFile(join(cwd, "add.txt"), "utf8");
    expect(content).toBe("ab\ncd\n");
  });

  test("delete file hunk removes file", async () => {
    const cwd = await createTempDir();
    await createTempFile(cwd, "del.txt", "x");
    const patch = wrapPatch("*** Delete File: del.txt");

    const result = await applyPatch(patch, { cwd });

    const expectedStdout = [
      "Success. Updated the following files:",
      "D del.txt",
      "",
    ].join("\n");
    expect(result).toEqual({
      success: true,
      stdout: expectedStdout,
      stderr: "",
    });

    await expect(fs.access(join(cwd, "del.txt"))).rejects.toThrow();
  });

  test("update file hunk modifies content", async () => {
    const cwd = await createTempDir();
    await createTempFile(cwd, "update.txt", "foo\nbar\n");
    const patch = wrapPatch([
      "*** Update File: update.txt",
      "@@",
      " foo",
      "-bar",
      "+baz",
    ].join("\n"));

    const result = await applyPatch(patch, { cwd });

    const expectedStdout = [
      "Success. Updated the following files:",
      "M update.txt",
      "",
    ].join("\n");
    expect(result).toEqual({
      success: true,
      stdout: expectedStdout,
      stderr: "",
    });

    const content = await fs.readFile(join(cwd, "update.txt"), "utf8");
    expect(content).toBe("foo\nbaz\n");
  });

  test("update file hunk can move file", async () => {
    const cwd = await createTempDir();
    await createTempFile(cwd, "src.txt", "line\n");
    const patch = wrapPatch([
      "*** Update File: src.txt",
      "*** Move to: dst.txt",
      "@@",
      "-line",
      "+line2",
    ].join("\n"));

    const result = await applyPatch(patch, { cwd });

    const expectedStdout = [
      "Success. Updated the following files:",
      "M dst.txt",
      "",
    ].join("\n");
    expect(result).toEqual({
      success: true,
      stdout: expectedStdout,
      stderr: "",
    });

    await expect(fs.access(join(cwd, "src.txt"))).rejects.toThrow();
    const content = await fs.readFile(join(cwd, "dst.txt"), "utf8");
    expect(content).toBe("line2\n");
  });

  test("multiple update chunks apply to single file", async () => {
    const cwd = await createTempDir();
    await createTempFile(cwd, "multi.txt", "foo\nbar\nbaz\nqux\n");
    const patch = wrapPatch([
      "*** Update File: multi.txt",
      "@@",
      " foo",
      "-bar",
      "+BAR",
      "@@",
      " baz",
      "-qux",
      "+QUX",
    ].join("\n"));

    const result = await applyPatch(patch, { cwd });

    const expectedStdout = [
      "Success. Updated the following files:",
      "M multi.txt",
      "",
    ].join("\n");
    expect(result).toEqual({
      success: true,
      stdout: expectedStdout,
      stderr: "",
    });

    const content = await fs.readFile(join(cwd, "multi.txt"), "utf8");
    expect(content).toBe("foo\nBAR\nbaz\nQUX\n");
  });

  test("update hunk supports interleaved changes with eof append", async () => {
    const cwd = await createTempDir();
    await createTempFile(cwd, "interleaved.txt", "a\nb\nc\nd\ne\nf\n");
    const patch = wrapPatch([
      "*** Update File: interleaved.txt",
      "@@",
      " a",
      "-b",
      "+B",
      "@@",
      " d",
      "-e",
      "+E",
      "@@",
      " f",
      "+g",
      "*** End of File",
    ].join("\n"));

    const result = await applyPatch(patch, { cwd });

    const expectedStdout = [
      "Success. Updated the following files:",
      "M interleaved.txt",
      "",
    ].join("\n");
    expect(result).toEqual({
      success: true,
      stdout: expectedStdout,
      stderr: "",
    });

    const content = await fs.readFile(join(cwd, "interleaved.txt"), "utf8");
    expect(content).toBe("a\nB\nc\nd\nE\nf\ng\n");
  });

  test("pure addition chunk followed by removal rewrites file", async () => {
    const cwd = await createTempDir();
    await createTempFile(cwd, "reorder.txt", "line1\nline2\nline3\n");
    const patch = wrapPatch([
      "*** Update File: reorder.txt",
      "@@",
      "+after-context",
      "+second-line",
      "@@",
      " line1",
      "-line2",
      "-line3",
      "+line2-replacement",
    ].join("\n"));

    const result = await applyPatch(patch, { cwd });

    const expectedStdout = [
      "Success. Updated the following files:",
      "M reorder.txt",
      "",
    ].join("\n");
    expect(result).toEqual({
      success: true,
      stdout: expectedStdout,
      stderr: "",
    });

    const content = await fs.readFile(join(cwd, "reorder.txt"), "utf8");
    expect(content).toBe("line1\nline2-replacement\nafter-context\nsecond-line\n");
  });

  test("applyPatch supports sequential add then update operations", async () => {
    const cwd = await createTempDir();
    const filename = "cli_test.txt";

    const addPatch = wrapPatch([
      `*** Add File: ${filename}`,
      "+hello",
    ].join("\n"));

    const addResult = await applyPatch(addPatch, { cwd });
    expect(addResult).toEqual({
      success: true,
      stdout: [
        "Success. Updated the following files:",
        `A ${filename}`,
        "",
      ].join("\n"),
      stderr: "",
    });
    expect(await fs.readFile(join(cwd, filename), "utf8")).toBe("hello\n");

    const updatePatch = wrapPatch([
      `*** Update File: ${filename}`,
      "@@",
      "-hello",
      "+world",
    ].join("\n"));

    const updateResult = await applyPatch(updatePatch, { cwd });
    expect(updateResult).toEqual({
      success: true,
      stdout: [
        "Success. Updated the following files:",
        `M ${filename}`,
        "",
      ].join("\n"),
      stderr: "",
    });
    expect(await fs.readFile(join(cwd, filename), "utf8")).toBe("world\n");
  });

  test("applyPatch handles mixed add update move delete operations", async () => {
    const cwd = await createTempDir();
    await createTempFile(cwd, "remove.txt", "remove me\n");
    await createTempFile(cwd, "source.txt", "old line\n");

    const patch = wrapPatch([
      "*** Add File: new-dir/new-file.txt",
      "+new file contents",
      "*** Update File: source.txt",
      "*** Move to: renamed.txt",
      "@@",
      "-old line",
      "+new line",
      "*** Delete File: remove.txt",
    ].join("\n"));

    const result = await applyPatch(patch, { cwd });

    expect(result).toEqual({
      success: true,
      stdout: [
        "Success. Updated the following files:",
        "A new-dir/new-file.txt",
        "M renamed.txt",
        "D remove.txt",
        "",
      ].join("\n"),
      stderr: "",
    });

    expect(await fs.readFile(join(cwd, "new-dir", "new-file.txt"), "utf8")).toBe(
      "new file contents\n",
    );
    await expect(fs.access(join(cwd, "source.txt"))).rejects.toThrow();
    expect(await fs.readFile(join(cwd, "renamed.txt"), "utf8")).toBe("new line\n");
    await expect(fs.access(join(cwd, "remove.txt"))).rejects.toThrow();
  });

  test("fails when no hunks were provided", async () => {
    const cwd = await createTempDir();
    const patch = "*** Begin Patch\n*** End Patch";

    const result = await applyPatch(patch, { cwd });

    expect(result.success).toBe(false);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("No files were modified.\n");
  });

  test("fails when update target is missing", async () => {
    const cwd = await createTempDir();
    const patch = wrapPatch([
      "*** Update File: missing.txt",
      "@@",
      "-hello",
      "+world",
    ].join("\n"));

    const result = await applyPatch(patch, { cwd });

    expect(result.success).toBe(false);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/^Failed to read file to update missing\.txt:/);
  });

  test("fails when patch uses absolute path", async () => {
    const cwd = await createTempDir();
    const absolute = join(cwd, "absolute.txt");
    const patch = wrapPatch([
      `*** Add File: ${absolute}`,
      "+content",
    ].join("\n"));

    const result = await applyPatch(patch, { cwd });

    expect(result.success).toBe(false);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("path must be relative\n");
  });
});


describe("applyPatch unified diff", () => {
  afterEach(async () => {
    await cleanupTempDirs();
  });

  test("unified diff replaces middle lines", async () => {
    const cwd = await createTempDir();
    const file = join(cwd, "multi.txt");
    await createTempFile(cwd, "multi.txt", "foo\nbar\nbaz\nqux\n");
    const patch = wrapPatch([
      `*** Update File: ${file}`,
      "@@",
      " foo",
      "-bar",
      "+BAR",
      "@@",
      " baz",
      "-qux",
      "+QUX",
    ].join("\n"));

    const parsed = parsePatchText(patch, ParseMode.Strict);
    const hunk = parsed.hunks[0];
    if (!hunk || hunk.type !== "update") {
      throw new Error("Expected a single update hunk");
    }

    const diff = await unifiedDiffFromChunks(file, hunk.chunks);
    expect(diff).toEqual({
      unifiedDiff: [
        "@@ -1,4 +1,4 @@",
        " foo",
        "-bar",
        "+BAR",
        " baz",
        "-qux",
        "+QUX",
        "",
      ].join("\n"),
      content: "foo\nBAR\nbaz\nQUX\n",
    });
  });

  test("unified diff replaces first line", async () => {
    const cwd = await createTempDir();
    const file = join(cwd, "first.txt");
    await createTempFile(cwd, "first.txt", "foo\nbar\nbaz\n");
    const patch = wrapPatch([
      `*** Update File: ${file}`,
      "@@",
      "-foo",
      "+FOO",
      " bar",
    ].join("\n"));

    const parsed = parsePatchText(patch, ParseMode.Strict);
    const hunk = parsed.hunks[0];
    if (!hunk || hunk.type !== "update") {
      throw new Error("Expected a single update hunk");
    }

    const diff = await unifiedDiffFromChunks(file, hunk.chunks);
    expect(diff).toEqual({
      unifiedDiff: [
        "@@ -1,2 +1,2 @@",
        "-foo",
        "+FOO",
        " bar",
        "",
      ].join("\n"),
      content: "FOO\nbar\nbaz\n",
    });
  });

  test("unified diff replaces last line", async () => {
    const cwd = await createTempDir();
    const file = join(cwd, "last.txt");
    await createTempFile(cwd, "last.txt", "foo\nbar\nbaz\n");
    const patch = wrapPatch([
      `*** Update File: ${file}`,
      "@@",
      " foo",
      " bar",
      "-baz",
      "+BAZ",
    ].join("\n"));

    const parsed = parsePatchText(patch, ParseMode.Strict);
    const hunk = parsed.hunks[0];
    if (!hunk || hunk.type !== "update") {
      throw new Error("Expected a single update hunk");
    }

    const diff = await unifiedDiffFromChunks(file, hunk.chunks);
    expect(diff).toEqual({
      unifiedDiff: [
        "@@ -2,2 +2,2 @@",
        " bar",
        "-baz",
        "+BAZ",
        "",
      ].join("\n"),
      content: "foo\nbar\nBAZ\n",
    });
  });

  test("unified diff adds line at eof", async () => {
    const cwd = await createTempDir();
    const file = join(cwd, "insert.txt");
    await createTempFile(cwd, "insert.txt", "foo\nbar\nbaz\n");
    const patch = wrapPatch([
      `*** Update File: ${file}`,
      "@@",
      "+quux",
      "*** End of File",
    ].join("\n"));

    const parsed = parsePatchText(patch, ParseMode.Strict);
    const hunk = parsed.hunks[0];
    if (!hunk || hunk.type !== "update") {
      throw new Error("Expected a single update hunk");
    }

    const diff = await unifiedDiffFromChunks(file, hunk.chunks);
    expect(diff).toEqual({
      unifiedDiff: [
        "@@ -3 +3,2 @@",
        " baz",
        "+quux",
        "",
      ].join("\n"),
      content: "foo\nbar\nbaz\nquux\n",
    });
  });

  test("unified diff handles interleaved changes", async () => {
    const cwd = await createTempDir();
    const file = join(cwd, "interleaved.txt");
    await createTempFile(cwd, "interleaved.txt", "a\nb\nc\nd\ne\nf\n");
    const patch = wrapPatch([
      `*** Update File: ${file}`,
      "@@",
      " a",
      "-b",
      "+B",
      "@@",
      " d",
      "-e",
      "+E",
      "@@",
      " f",
      "+g",
      "*** End of File",
    ].join("\n"));

    const parsed = parsePatchText(patch, ParseMode.Strict);
    const hunk = parsed.hunks[0];
    if (!hunk || hunk.type !== "update") {
      throw new Error("Expected a single update hunk");
    }

    const diff = await unifiedDiffFromChunks(file, hunk.chunks);
    expect(diff).toEqual({
      unifiedDiff: [
        "@@ -1,6 +1,7 @@",
        " a",
        "-b",
        "+B",
        " c",
        " d",
        "-e",
        "+E",
        " f",
        "+g",
        "",
      ].join("\n"),
      content: "a\nB\nc\nd\nE\nf\ng\n",
    });
  });
});


describe("seekSequence", () => {
  test("exact match finds sequence", () => {
    const haystack = ["foo", "bar", "baz"];
    const pattern = ["bar", "baz"];
    expect(seekSequence(haystack, pattern, 0, false)).toBe(1);
  });

  test("ignores trailing whitespace", () => {
    const haystack = ["foo   ", "bar		"];
    const pattern = ["foo", "bar"];
    expect(seekSequence(haystack, pattern, 0, false)).toBe(0);
  });

  test("ignores leading and trailing whitespace", () => {
    const haystack = ["    foo   ", "   bar	"];
    const pattern = ["foo", "bar"];
    expect(seekSequence(haystack, pattern, 0, false)).toBe(0);
  });

  test("pattern longer than input returns null", () => {
    const haystack = ["just one line"];
    const pattern = ["too", "many", "lines"];
    expect(seekSequence(haystack, pattern, 0, false)).toBeNull();
  });

  test("empty pattern returns start index", () => {
    const haystack = ["alpha", "beta"];
    const pattern: string[] = [];
    expect(seekSequence(haystack, pattern, 5, false)).toBe(5);
  });

  test("start index skips earlier matches", () => {
    const haystack = ["a", "b", "a", "b"];
    const pattern = ["a", "b"];
    expect(seekSequence(haystack, pattern, 2, false)).toBe(2);
  });

  test("prefer end of file chooses final occurrence", () => {
    const haystack = ["alpha", "target", "beta", "target"];
    const pattern = ["target"];
    expect(seekSequence(haystack, pattern, 0, true)).toBe(3);
  });

  test("normalises unicode punctuation", () => {
    const haystack = ['return “value” – cost'];
    const pattern = ['return "value" - cost'];
    expect(seekSequence(haystack, pattern, 0, false)).toBe(0);
  });

  test("normalises unicode whitespace", () => {
    const haystack = ["const value = foo + bar;"];
    const pattern = ["const value = foo + bar;"];
    expect(seekSequence(haystack, pattern, 0, false)).toBe(0);
  });
});
