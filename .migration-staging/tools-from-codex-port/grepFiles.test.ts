import { describe, test, expect, afterEach } from "bun:test";
import { join } from "node:path";
import { promises as fs } from "node:fs";

import { createTempDir, createTempFile, cleanupTempDirs } from "../helpers/fixtures";
import { expectErrorMessage } from "../helpers/assertions";
import { grepFiles } from "../../src/tools/grepFiles";

describe("grepFiles", () => {
  afterEach(async () => {
    await cleanupTempDirs();
  });

  test("returns matching files sorted by modification time", async () => {
    const dir = await createTempDir();
    const first = await createTempFile(dir, "first.txt", "alpha needle");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await createTempFile(dir, "second.txt", "beta needle");

    const result = await grepFiles({ pattern: "needle", path: dir });

    expect(result.success).toBe(true);
    expect(result.content.split("\n")).toEqual([second, first]);
  });

  test("applies include glob filters", async () => {
    const dir = await createTempDir();
    const match = await createTempFile(dir, "match.rs", "needle");
    await createTempFile(dir, "skip.txt", "needle but filtered");

    const result = await grepFiles({ pattern: "needle", include: "*.rs", path: dir });

    expect(result.success).toBe(true);
    expect(result.content.trim()).toBe(match);
  });

  test("respects limit", async () => {
    const dir = await createTempDir();
    await createTempFile(dir, "old.txt", "needle");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const latest = await createTempFile(dir, "latest.txt", "needle");

    const result = await grepFiles({ pattern: "needle", path: dir, limit: 1 });

    expect(result.content.split("\n")).toEqual([latest]);
  });

  test("returns message when no matches are found", async () => {
    const dir = await createTempDir();
    await createTempFile(dir, "file.txt", "omega");

    const result = await grepFiles({ pattern: "needle", path: dir });

    expect(result.success).toBe(false);
    expect(result.content).toBe("No matches found.");
  });

  test("validates inputs", async () => {
    await expectErrorMessage(
      grepFiles({ pattern: "   ", path: "/tmp" }),
      "pattern must not be empty",
    );

    await expectErrorMessage(
      grepFiles({ pattern: "needle", path: "/tmp", limit: 0 }),
      "limit must be greater than zero",
    );

    const missing = join("/tmp", `missing-${Date.now()}`);
    await expectErrorMessage(
      grepFiles({ pattern: "needle", path: missing }),
      new RegExp(`^unable to access \\\`${missing.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\\``),
    );
  });

  test("times out when rg takes too long", async () => {
    const dir = await createTempDir();
    const fakeRg = join(dir, "fake-rg.sh");
    await fs.writeFile(fakeRg, "#!/bin/bash\nsleep 1\n");
    await fs.chmod(fakeRg, 0o755);

    await expectErrorMessage(
      grepFiles({ pattern: "needle", path: dir }, { timeoutMs: 50, rgCommand: fakeRg }),
      "rg timed out after 30 seconds",
    );
  });
});
