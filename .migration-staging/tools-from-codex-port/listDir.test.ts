import { describe, test, expect, afterEach } from "bun:test";
import { join } from "node:path";
import { promises as fs } from "node:fs";

import { createTempDir, cleanupTempDirs } from "../helpers/fixtures";
import { expectErrorMessage } from "../helpers/assertions";
import { listDir } from "../../src/tools/listDir";

const SPACES = "  ";

describe("listDir", () => {
  afterEach(async () => {
    await cleanupTempDirs();
  });

  test("lists entries in global alphabetical order with indentation and header", async () => {
    const root = await createTempDir();
    const nested = join(root, "nested");
    const deeper = join(nested, "deeper");
    await fs.mkdir(nested);
    await fs.mkdir(deeper);
    await fs.writeFile(join(root, "entry.txt"), "content");
    await fs.writeFile(join(nested, "child.txt"), "child");
    await fs.writeFile(join(deeper, "grandchild.txt"), "grandchild");

    if (process.platform !== "win32") {
      await fs.symlink(join(root, "entry.txt"), join(root, "link"));
    }

    const result = await listDir({ dirPath: root, offset: 1, limit: 20, depth: 3 });
    const lines = result.content.split("\n");
    expect(lines[0]).toBe(`Absolute path: ${root}`);

    if (process.platform !== "win32") {
      expect(lines.slice(1)).toEqual([
        "entry.txt",
        "link@",
        "nested/",
        `${SPACES}child.txt`,
        `${SPACES}deeper/`,
        `${SPACES}${SPACES}grandchild.txt`,
      ]);
    } else {
      expect(lines.slice(1)).toEqual([
        "entry.txt",
        "nested/",
        `${SPACES}child.txt`,
        `${SPACES}deeper/`,
        `${SPACES}${SPACES}grandchild.txt`,
      ]);
    }
  });

  test("respects depth parameter", async () => {
    const root = await createTempDir();
    const nested = join(root, "nested");
    const deeper = join(nested, "deeper");
    await fs.mkdir(nested);
    await fs.mkdir(deeper);
    await fs.writeFile(join(root, "root.txt"), "root");
    await fs.writeFile(join(nested, "child.txt"), "child");
    await fs.writeFile(join(deeper, "grandchild.txt"), "deep");

    const depthOne = await listDir({ dirPath: root, offset: 1, limit: 20, depth: 1 });
    expect(depthOne.content.split("\n").slice(1)).toEqual(["nested/", "root.txt"]);

    const depthTwo = await listDir({ dirPath: root, offset: 1, limit: 20, depth: 2 });
    expect(depthTwo.content.split("\n").slice(1)).toEqual([
      "nested/",
      `${SPACES}child.txt`,
      `${SPACES}deeper/`,
      "root.txt",
    ]);

    const depthThree = await listDir({ dirPath: root, offset: 1, limit: 20, depth: 3 });
    expect(depthThree.content.split("\n").slice(1)).toEqual([
      "nested/",
      `${SPACES}child.txt`,
      `${SPACES}deeper/`,
      `${SPACES}${SPACES}grandchild.txt`,
      "root.txt",
    ]);
  });

  test("supports offset and limit slicing", async () => {
    const root = await createTempDir();
    for (let idx = 0; idx < 5; idx += 1) {
      await fs.writeFile(join(root, `file_${idx}.txt`), "content");
    }

    const result = await listDir({ dirPath: root, offset: 2, limit: 2, depth: 1 });
    expect(result.content.split("\n").slice(1)).toEqual([
      "file_1.txt",
      "file_2.txt",
      "More than 2 entries found",
    ]);
  });

  test("sorts entries globally before applying pagination", async () => {
    const root = await createTempDir();
    const nested = join(root, "a");
    await fs.mkdir(nested);
    await fs.writeFile(join(nested, "aardvark.txt"), "aardvark");
    await fs.writeFile(join(root, "zeta.txt"), "zeta");

    const result = await listDir({ dirPath: root, offset: 2, limit: 1, depth: 2 });
    expect(result.content.split("\n").slice(1)).toEqual([
      `${SPACES}aardvark.txt`,
      "More than 1 entries found",
    ]);
  });

  test("indicates truncated results when more entries remain", async () => {
    const root = await createTempDir();
    for (let idx = 0; idx < 30; idx += 1) {
      await fs.writeFile(join(root, `entry_${idx}.txt`), "content");
    }

    const result = await listDir({ dirPath: root, offset: 1, limit: 25, depth: 1 });
    const lines = result.content.split("\n").slice(1);
    expect(lines).toHaveLength(26);
    expect(lines.at(-1)).toBe("More than 25 entries found");
  });

  test("errors when offset exceeds entry count", async () => {
    const root = await createTempDir();
    await fs.mkdir(join(root, "nested"));

    await expectErrorMessage(
      listDir({ dirPath: root, offset: 10, limit: 1, depth: 2 }),
      "offset exceeds directory entry count",
    );
  });

  test("validates numeric arguments", async () => {
    const root = await createTempDir();

    await expectErrorMessage(
      listDir({ dirPath: root, offset: 0, limit: 1, depth: 1 }),
      "offset must be a 1-indexed entry number",
    );

    await expectErrorMessage(
      listDir({ dirPath: root, offset: 1, limit: 0, depth: 1 }),
      "limit must be greater than zero",
    );

    await expectErrorMessage(
      listDir({ dirPath: root, offset: 1, limit: 1, depth: 0 }),
      "depth must be greater than zero",
    );
  });

  test("resolves relative path against current working directory", async () => {
    const root = await createTempDir();
    const prev = process.cwd();
    try {
      await fs.writeFile(join(root, "alpha.txt"), "a");
      process.chdir(root);
      const result = await listDir({ dirPath: ".", offset: 1, limit: 10, depth: 1 });
      const lines = result.content.split("\n");
      const resolved = await fs.realpath(root);
      expect(lines[0]).toBe(`Absolute path: ${resolved}`);
      // At least the file we created should appear
      expect(lines.slice(1)).toContain("alpha.txt");
    } finally {
      process.chdir(prev);
    }
  });

  test("uses default pagination and depth values", async () => {
    const root = await createTempDir();
    const nested = join(root, "nested");
    const deeper = join(nested, "deeper");
    await fs.mkdir(nested);
    await fs.mkdir(deeper);
    await fs.writeFile(join(root, "root.txt"), "root");
    await fs.writeFile(join(nested, "child.txt"), "child");
    await fs.writeFile(join(deeper, "grandchild.txt"), "grandchild");

    const result = await listDir({ dirPath: root });
    const lines = result.content.split("\n").slice(1);
    expect(lines).toEqual([
      "nested/",
      `${SPACES}child.txt`,
      `${SPACES}deeper/`,
      "root.txt",
    ]);
  });
});
