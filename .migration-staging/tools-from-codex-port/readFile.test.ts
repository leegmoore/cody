import { describe, test, expect, afterEach } from "bun:test";
import { join } from "node:path";

import { createTempDir, createTempFile, cleanupTempDirs } from "../helpers/fixtures";
import { expectErrorMessage } from "../helpers/assertions";
import { readFile } from "../../src/tools/readFile";

describe("readFile", () => {
  afterEach(async () => {
    await cleanupTempDirs();
  });

  test("reads lines from the start of a file", async () => {
    const dir = await createTempDir();
    const file = await createTempFile(dir, "sample.txt", "first\nsecond\nthird\n");

    const result = await readFile({ filePath: file, offset: 1, limit: 2 });

    expect(result.success).toBe(true);
    expect(result.content).toBe("L1: first\nL2: second");
  });

  test("respects offset and limit", async () => {
    const dir = await createTempDir();
    const file = await createTempFile(dir, "sample.txt", "first\nsecond\nthird\nfourth\n");

    const result = await readFile({ filePath: file, offset: 2, limit: 2 });
    expect(result.content).toBe("L2: second\nL3: third");
  });

  test("normalizes CRLF line endings", async () => {
    const dir = await createTempDir();
    const file = await createTempFile(dir, "sample.txt", "first\r\nsecond\r\n");

    const result = await readFile({ filePath: file, offset: 1, limit: 5 });

    expect(result.content).toBe("L1: first\nL2: second");
  });

  test("truncates long lines to max length", async () => {
    const dir = await createTempDir();
    const longLine = "x".repeat(600);
    const file = await createTempFile(dir, "long.txt", `${longLine}\n`);

    const result = await readFile({ filePath: file });
    const [line] = result.content.split("\n");
    expect(line).toBe(`L1: ${"x".repeat(500)}`);
  });

  test("preserves utf-8 characters at boundaries", async () => {
    const dir = await createTempDir();
    const emojis = "😀".repeat(600);
    const file = await createTempFile(dir, "emoji.txt", `${emojis}\n`);

    const result = await readFile({ filePath: file });
    const [line] = result.content.split("\n");
    const [, content] = line.split(": ", 2);
    expect(Array.from(content).length).toBe(500);
    expect(content.endsWith("😀")).toBe(true);
  });

  test("errors when offset exceeds file length", async () => {
    const dir = await createTempDir();
    const file = await createTempFile(dir, "sample.txt", "only one line\n");

    await expectErrorMessage(
      readFile({ filePath: file, offset: 5, limit: 1 }),
      "offset exceeds file length",
    );
  });

  test("validates parameters", async () => {
    const dir = await createTempDir();
    const file = await createTempFile(dir, "sample.txt", "content\n");

    await expectErrorMessage(
      readFile({ filePath: file, offset: 0, limit: 1 }),
      "offset must be a 1-indexed line number",
    );

    await expectErrorMessage(
      readFile({ filePath: file, offset: 1, limit: 0 }),
      "limit must be greater than zero",
    );

  });

  test("errors when file cannot be read", async () => {
    const missing = join("/tmp", `missing-${Date.now()}.txt`);

    await expectErrorMessage(
      readFile({ filePath: missing }),
      new RegExp(`^failed to read file: ENOENT`),
    );
  });

  test("resolves relative path against current working directory", async () => {
    const dir = await createTempDir();
    const file = await createTempFile(dir, "note.txt", "one\n");
    const previous = process.cwd();
    try {
      process.chdir(dir);
      const result = await readFile({ filePath: "note.txt", offset: 1, limit: 1 });
      expect(result.content).toBe("L1: one");
    } finally {
      process.chdir(previous);
    }
  });

  test("resolves relative path using provided workdir", async () => {
    const dir = await createTempDir();
    await createTempFile(dir, "note.txt", "alpha\n");
    const result = await readFile({ filePath: "note.txt", workdir: dir, offset: 1, limit: 1 });
    expect(result.content).toBe("L1: alpha");
  });

  describe("indentation mode", () => {
    test("captures a basic block at the same indentation level", async () => {
      const dir = await createTempDir();
      const file = await createTempFile(
        dir,
        "sample.rs",
        `fn outer() {
    if cond {
        inner();
    }
    tail();
}
`,
      );

      const result = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 3,
        maxLevels: 1,
        limit: 10,
      });

      expect(result.content).toBe(["L2:     if cond {", "L3:         inner();", "L4:     }"].join("\n"));
    });

    test("expands parent scopes up to maxLevels", async () => {
      const dir = await createTempDir();
      const file = await createTempFile(
        dir,
        "module.rs",
        `mod root {
    fn outer() {
        if cond {
            inner();
        }
    }
}
`,
      );

      const shallow = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 4,
        maxLevels: 2,
        limit: 50,
      });

      expect(shallow.content).toBe(
        [
          "L2:     fn outer() {",
          "L3:         if cond {",
          "L4:             inner();",
          "L5:         }",
          "L6:     }",
        ].join("\n"),
      );

      const expanded = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 4,
        maxLevels: 3,
        limit: 50,
      });

      expect(expanded.content).toBe(
        [
          "L1: mod root {",
          "L2:     fn outer() {",
          "L3:         if cond {",
          "L4:             inner();",
          "L5:         }",
          "L6:     }",
          "L7: }",
        ].join("\n"),
      );
    });

    test("respects includeSiblings flag", async () => {
      const dir = await createTempDir();
      const file = await createTempFile(
        dir,
        "siblings.rs",
        `fn wrapper() {
    if first {
        do_first();
    }
    if second {
        do_second();
    }
}
`,
      );

      const withoutSiblings = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 3,
        maxLevels: 1,
        limit: 50,
      });

      expect(withoutSiblings.content).toBe(
        [
          "L2:     if first {",
          "L3:         do_first();",
          "L4:     }",
        ].join("\n"),
      );

      const withSiblings = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 3,
        maxLevels: 1,
        includeSiblings: true,
        limit: 50,
      });

      expect(withSiblings.content).toBe(
        [
          "L2:     if first {",
          "L3:         do_first();",
          "L4:     }",
          "L5:     if second {",
          "L6:         do_second();",
          "L7:     }",
        ].join("\n"),
      );
    });

    test("handles a Python class sample", async () => {
      const dir = await createTempDir();
      const file = await createTempFile(
        dir,
        "example.py",
        `class Foo:
    def __init__(self, size):
        self.size = size
    def double(self, value):
        if value is None:
            return 0
        result = value * self.size
        return result
class Bar:
    def compute(self):
        helper = Foo(2)
        return helper.double(5)
`,
      );

      const result = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 7,
        includeSiblings: true,
        maxLevels: 1,
        limit: 200,
      });

      expect(result.content).toBe(
        [
          "L2:     def __init__(self, size):",
          "L3:         self.size = size",
          "L4:     def double(self, value):",
          "L5:         if value is None:",
          "L6:             return 0",
          "L7:         result = value * self.size",
          "L8:         return result",
        ].join("\n"),
      );
    });

    test.skip("handles a JavaScript sample with nested blocks", async () => {
      // Mirrors the ignored Rust test; current implementation does not yet expand this case.
      const dir = await createTempDir();
      const file = await createTempFile(
        dir,
        "sample.js",
        `export function makeThing() {
    const cache = new Map();
    function ensure(key) {
        if (!cache.has(key)) {
            cache.set(key, []);
        }
        return cache.get(key);
    }
    const handlers = {
        init() {
            console.log("init");
        },
        run() {
            if (Math.random() > 0.5) {
                return "heads";
            }
            return "tails";
        },
    };
    return { cache, handlers };
}
export function other() {
    return makeThing();
}
`,
      );

      const result = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 15,
        maxLevels: 1,
        limit: 200,
      });

      expect(result.content).toBe(
        [
          'L10:         init() {',
          'L11:             console.log("init");',
          "L12:         },",
          "L13:         run() {",
          "L14:             if (Math.random() > 0.5) {",
          'L15:                 return "heads";',
          "L16:             }",
          'L17:             return "tails";',
          "L18:         },",
        ].join("\n"),
      );
    });

    test("handles a shallow C++ sample block", async () => {
      const file = await createCppSample();

      const result = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 18,
        maxLevels: 1,
        limit: 200,
      });

      expect(result.content).toBe(
        [
          "L15:         switch (mode_) {",
          "L16:             case Mode::Fast:",
          "L17:                 return fast();",
          "L18:             case Mode::Slow:",
          "L19:                 return slow();",
          "L20:             default:",
          "L21:                 return fallback();",
          "L22:         }",
        ].join("\n"),
      );
    });

    test("handles a deeper C++ sample block with parents", async () => {
      const file = await createCppSample();

      const result = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 18,
        maxLevels: 2,
        limit: 200,
      });

      expect(result.content).toBe(
        [
          "L13:     // Run the code",
          "L14:     int run() const {",
          "L15:         switch (mode_) {",
          "L16:             case Mode::Fast:",
          "L17:                 return fast();",
          "L18:             case Mode::Slow:",
          "L19:                 return slow();",
          "L20:             default:",
          "L21:                 return fallback();",
          "L22:         }",
          "L23:     }",
        ].join("\n"),
      );
    });

    test("handles C++ blocks without headers when includeHeader is false", async () => {
      const file = await createCppSample();

      const result = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 18,
        maxLevels: 2,
        includeHeader: false,
        limit: 200,
      });

      expect(result.content).toBe(
        [
          "L14:     int run() const {",
          "L15:         switch (mode_) {",
          "L16:             case Mode::Fast:",
          "L17:                 return fast();",
          "L18:             case Mode::Slow:",
          "L19:                 return slow();",
          "L20:             default:",
          "L21:                 return fallback();",
          "L22:         }",
          "L23:     }",
        ].join("\n"),
      );
    });

    test("includes sibling blocks when includeSiblings is true", async () => {
      const file = await createCppSample();

      const result = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 18,
        maxLevels: 2,
        includeHeader: false,
        includeSiblings: true,
        limit: 200,
      });

      expect(result.content).toBe(
        [
          "L7:     void setup() {",
          "L8:         if (enabled_) {",
          "L9:             init();",
          "L10:         }",
          "L11:     }",
          "L12: ",
          "L13:     // Run the code",
          "L14:     int run() const {",
          "L15:         switch (mode_) {",
          "L16:             case Mode::Fast:",
          "L17:                 return fast();",
          "L18:             case Mode::Slow:",
          "L19:                 return slow();",
          "L20:             default:",
          "L21:                 return fallback();",
          "L22:         }",
          "L23:     }",
        ].join("\n"),
      );
    });

    test("errors when anchorLine is zero", async () => {
      const dir = await createTempDir();
      const file = await createTempFile(dir, "tiny.rs", "fn main() {}\n");

      await expectErrorMessage(
        readFile({ filePath: file, mode: "indentation", anchorLine: 0 }),
        "anchor_line must be a 1-indexed line number",
      );
    });

    test("errors when anchorLine exceeds file length", async () => {
      const dir = await createTempDir();
      const file = await createTempFile(dir, "tiny.rs", "fn main() {}\n");

      await expectErrorMessage(
        readFile({ filePath: file, mode: "indentation", anchorLine: 5 }),
        "anchor_line exceeds file length",
      );
    });

    test("errors when maxLines is zero", async () => {
      const dir = await createTempDir();
      const file = await createTempFile(
        dir,
        "sample.rs",
        `fn foo() {
    bar();
}
`,
      );

      await expectErrorMessage(
        readFile({ filePath: file, mode: "indentation", anchorLine: 2, maxLines: 0 }),
        "max_lines must be greater than zero",
      );
    });

    test("respects maxLines guard limit", async () => {
      const dir = await createTempDir();
      const file = await createTempFile(
        dir,
        "sample.rs",
        `fn outer() {
    if cond {
        inner();
    }
}
`,
      );

      const result = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 3,
        maxLevels: 1,
        limit: 10,
        maxLines: 1,
      });

      expect(result.content).toBe("L3:         inner();");
    });

    test("defaults anchor to offset when anchorLine is omitted", async () => {
      const dir = await createTempDir();
      const file = await createTempFile(
        dir,
        "sample.rs",
        `fn outer() {
    inner();
}
`,
      );

      const result = await readFile({
        filePath: file,
        mode: "indentation",
        offset: 2,
        limit: 5,
      });

      expect(result.content).toBe(["L1: fn outer() {", "L2:     inner();", "L3: }"].join("\n"));
    });

    test("trims leading and trailing blank lines from the result", async () => {
      const dir = await createTempDir();
      const file = await createTempFile(
        dir,
        "whitespace.py",
        `
def wrapper():

    def inner():
        pass

`,
      );

      const result = await readFile({
        filePath: file,
        mode: "indentation",
        anchorLine: 4,
        limit: 10,
        maxLevels: 1,
      });

      expect(result.content).toBe(["L4:     def inner():", "L5:         pass"].join("\n"));
    });
  });
});

async function createCppSample(): Promise<string> {
  const dir = await createTempDir();
  return createTempFile(
    dir,
    "sample.cpp",
    `#include <vector>
#include <string>

namespace sample {
class Runner {
public:
    void setup() {
        if (enabled_) {
            init();
        }
    }

    // Run the code
    int run() const {
        switch (mode_) {
            case Mode::Fast:
                return fast();
            case Mode::Slow:
                return slow();
            default:
                return fallback();
        }
    }

private:
    bool enabled_ = false;
    Mode mode_ = Mode::Fast;

    int fast() const {
        return 1;
    }
};
}  // namespace sample
`,
  );
}
