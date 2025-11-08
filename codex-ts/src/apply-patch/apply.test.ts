/**
 * Tests for patch application
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  applyPatch,
  unifiedDiffFromChunks,
  printSummary,
  maybeParseApplyPatchVerified,
} from "../../src/apply-patch/apply.js";
import type { UpdateFileChunk } from "../../src/apply-patch/types.js";

function wrapPatch(body: string): string {
  return `*** Begin Patch\n${body}\n*** End Patch`;
}

describe("applyPatch", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "apply-patch-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir("/");
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should add file with contents", () => {
    const filePath = path.join(tmpDir, "add.txt");
    const patch = wrapPatch(`*** Add File: ${filePath}
+ab
+cd`);

    const _affected = applyPatch(patch);

    expect(_affected.added).toEqual([filePath]);
    expect(_affected.modified).toEqual([]);
    expect(_affected.deleted).toEqual([]);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("ab\ncd\n");
  });

  it("should delete file", () => {
    const filePath = path.join(tmpDir, "del.txt");
    fs.writeFileSync(filePath, "x");

    const patch = wrapPatch(`*** Delete File: ${filePath}`);
    const _affected = applyPatch(patch);

    expect(_affected.deleted).toEqual([filePath]);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("should update file content", () => {
    const filePath = path.join(tmpDir, "update.txt");
    fs.writeFileSync(filePath, "foo\nbar\n");

    const patch = wrapPatch(`*** Update File: ${filePath}
@@
 foo
-bar
+baz`);

    const _affected = applyPatch(patch);

    expect(_affected.modified).toEqual([filePath]);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("foo\nbaz\n");
  });

  it("should move file with update", () => {
    const srcPath = path.join(tmpDir, "src.txt");
    const destPath = path.join(tmpDir, "dst.txt");
    fs.writeFileSync(srcPath, "line\n");

    const patch = wrapPatch(`*** Update File: ${srcPath}
*** Move to: ${destPath}
@@
-line
+line2`);

    const _affected = applyPatch(patch);

    expect(_affected.modified).toEqual([destPath]);
    expect(fs.existsSync(srcPath)).toBe(false);
    expect(fs.readFileSync(destPath, "utf-8")).toBe("line2\n");
  });

  it("should apply multiple update chunks to single file", () => {
    const filePath = path.join(tmpDir, "multi.txt");
    fs.writeFileSync(filePath, "foo\nbar\nbaz\nqux\n");

    const patch = wrapPatch(`*** Update File: ${filePath}
@@
 foo
-bar
+BAR
@@
 baz
-qux
+QUX`);

    const _affected = applyPatch(patch);

    expect(_affected.modified).toEqual([filePath]);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("foo\nBAR\nbaz\nQUX\n");
  });

  it("should handle interleaved changes", () => {
    const filePath = path.join(tmpDir, "interleaved.txt");
    fs.writeFileSync(filePath, "a\nb\nc\nd\ne\nf\n");

    const patch = wrapPatch(`*** Update File: ${filePath}
@@
 a
-b
+B
@@
 c
 d
-e
+E
@@
 f
+g
*** End of File`);

    const _affected = applyPatch(patch);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("a\nB\nc\nd\nE\nf\ng\n");
  });

  it("should handle pure addition followed by removal", () => {
    const filePath = path.join(tmpDir, "panic.txt");
    fs.writeFileSync(filePath, "line1\nline2\nline3\n");

    const patch = wrapPatch(`*** Update File: ${filePath}
@@
+after-context
+second-line
@@
 line1
-line2
-line3
+line2-replacement`);

    const _affected = applyPatch(patch);
    expect(fs.readFileSync(filePath, "utf-8")).toBe(
      "line1\nline2-replacement\nafter-context\nsecond-line\n",
    );
  });

  it("should update line with unicode dash", () => {
    const filePath = path.join(tmpDir, "unicode.py");
    const original =
      "import asyncio  # local import \u2013 avoids top\u2011level dep\n";
    fs.writeFileSync(filePath, original);

    const patch = wrapPatch(`*** Update File: ${filePath}
@@
-import asyncio  # local import - avoids top-level dep
+import asyncio  # HELLO`);

    const _affected = applyPatch(patch);
    expect(fs.readFileSync(filePath, "utf-8")).toBe(
      "import asyncio  # HELLO\n",
    );
  });

  it("should throw error on empty patch", () => {
    const patch = `*** Begin Patch
*** End Patch`;
    expect(() => applyPatch(patch)).toThrow("No files were modified");
  });

  it("should throw error when context not found", () => {
    const filePath = path.join(tmpDir, "modify.txt");
    fs.writeFileSync(filePath, "line1\nline2\n");

    const patch = wrapPatch(`*** Update File: ${filePath}
@@
-missing
+changed`);

    expect(() => applyPatch(patch)).toThrow("Failed to find expected lines");
  });

  it("should throw error when file to delete does not exist", () => {
    const patch = wrapPatch("*** Delete File: missing.txt");
    expect(() => applyPatch(patch)).toThrow("Failed to delete");
  });

  it("should throw error when file to update does not exist", () => {
    const patch = wrapPatch(`*** Update File: missing.txt
@@
-old
+new`);
    expect(() => applyPatch(patch)).toThrow("Failed to read");
  });

  it("should create nested directories when adding file", () => {
    const filePath = path.join(tmpDir, "nested", "new.txt");
    const patch = wrapPatch(`*** Add File: ${filePath}
+created`);

    const _affected = applyPatch(patch);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("created\n");
  });

  it("should append trailing newline when updating", () => {
    const filePath = path.join(tmpDir, "no_newline.txt");
    fs.writeFileSync(filePath, "no newline at end");

    const patch = wrapPatch(`*** Update File: ${filePath}
@@
-no newline at end
+first line
+second line`);

    const _affected = applyPatch(patch);
    const contents = fs.readFileSync(filePath, "utf-8");
    expect(contents.endsWith("\n")).toBe(true);
    expect(contents).toBe("first line\nsecond line\n");
  });
});

describe("unifiedDiffFromChunks", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "diff-test-"));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should generate unified diff for multiple chunks", () => {
    const filePath = path.join(tmpDir, "multi.txt");
    fs.writeFileSync(filePath, "foo\nbar\nbaz\nqux\n");

    const chunks: UpdateFileChunk[] = [
      {
        changeContext: undefined,
        oldLines: ["foo", "bar"],
        newLines: ["foo", "BAR"],
        isEndOfFile: false,
      },
      {
        changeContext: undefined,
        oldLines: ["baz", "qux"],
        newLines: ["baz", "QUX"],
        isEndOfFile: false,
      },
    ];

    const result = unifiedDiffFromChunks(filePath, chunks);
    expect(result.content).toBe("foo\nBAR\nbaz\nQUX\n");
    expect(result.unifiedDiff).toContain("-bar");
    expect(result.unifiedDiff).toContain("+BAR");
    expect(result.unifiedDiff).toContain("-qux");
    expect(result.unifiedDiff).toContain("+QUX");
  });

  it("should handle first line replacement", () => {
    const filePath = path.join(tmpDir, "first.txt");
    fs.writeFileSync(filePath, "foo\nbar\nbaz\n");

    const chunks: UpdateFileChunk[] = [
      {
        changeContext: undefined,
        oldLines: ["foo", "bar"],
        newLines: ["FOO", "bar"],
        isEndOfFile: false,
      },
    ];

    const result = unifiedDiffFromChunks(filePath, chunks);
    expect(result.content).toBe("FOO\nbar\nbaz\n");
    expect(result.unifiedDiff).toContain("-foo");
    expect(result.unifiedDiff).toContain("+FOO");
  });

  it("should handle last line replacement", () => {
    const filePath = path.join(tmpDir, "last.txt");
    fs.writeFileSync(filePath, "foo\nbar\nbaz\n");

    const chunks: UpdateFileChunk[] = [
      {
        changeContext: undefined,
        oldLines: ["foo", "bar", "baz"],
        newLines: ["foo", "bar", "BAZ"],
        isEndOfFile: false,
      },
    ];

    const result = unifiedDiffFromChunks(filePath, chunks);
    expect(result.content).toBe("foo\nbar\nBAZ\n");
    expect(result.unifiedDiff).toContain("-baz");
    expect(result.unifiedDiff).toContain("+BAZ");
  });

  it("should handle insertion at EOF", () => {
    const filePath = path.join(tmpDir, "insert.txt");
    fs.writeFileSync(filePath, "foo\nbar\nbaz\n");

    const chunks: UpdateFileChunk[] = [
      {
        changeContext: undefined,
        oldLines: [],
        newLines: ["quux"],
        isEndOfFile: true,
      },
    ];

    const result = unifiedDiffFromChunks(filePath, chunks);
    expect(result.content).toBe("foo\nbar\nbaz\nquux\n");
    expect(result.unifiedDiff).toContain("+quux");
  });
});

describe("printSummary", () => {
  it("should format summary correctly", () => {
    const affected = {
      added: ["file1.txt", "file2.txt"],
      modified: ["file3.txt"],
      deleted: ["file4.txt"],
    };

    const summary = printSummary(affected);
    expect(summary).toContain("Success. Updated the following files:");
    expect(summary).toContain("A file1.txt");
    expect(summary).toContain("A file2.txt");
    expect(summary).toContain("M file3.txt");
    expect(summary).toContain("D file4.txt");
  });
});

describe("maybeParseApplyPatchVerified", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-test-"));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should detect implicit invocation with single arg", () => {
    const patch = wrapPatch("*** Add File: foo\n+hi");
    const result = maybeParseApplyPatchVerified([patch], tmpDir);
    expect(result.type).toBe("CorrectnessError");
  });

  it("should detect implicit invocation in bash script", () => {
    const patch = wrapPatch("*** Add File: foo\n+hi");
    const result = maybeParseApplyPatchVerified(["bash", "-lc", patch], tmpDir);
    expect(result.type).toBe("CorrectnessError");
  });

  it("should parse valid apply_patch command", () => {
    const filePath = path.join(tmpDir, "source.txt");
    fs.writeFileSync(filePath, "session directory content\n");

    const patch = wrapPatch(`*** Update File: source.txt
@@
-session directory content
+updated session directory content`);

    const result = maybeParseApplyPatchVerified(["apply_patch", patch], tmpDir);

    expect(result.type).toBe("Body");
    if (result.type === "Body") {
      expect(result.value.changes.size).toBe(1);
      const change = result.value.changes.get(path.join(tmpDir, "source.txt"));
      expect(change?.type).toBe("Update");
      if (change?.type === "Update") {
        expect(change.newContent).toBe("updated session directory content\n");
      }
    }
  });

  it("should return NotApplyPatch for non-apply_patch commands", () => {
    const result = maybeParseApplyPatchVerified(["echo", "hello"], tmpDir);
    expect(result.type).toBe("NotApplyPatch");
  });

  it("should return CorrectnessError for invalid patch", () => {
    const result = maybeParseApplyPatchVerified(
      ["apply_patch", "invalid patch"],
      tmpDir,
    );
    expect(result.type).toBe("CorrectnessError");
  });
});
