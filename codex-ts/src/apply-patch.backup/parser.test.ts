/**
 * Tests for patch parser
 */

import { describe, it, expect } from 'vitest';
import { parsePatch, resolveHunkPath } from '../../src/apply-patch/parser.js';
import type { Hunk, ParseError } from '../../src/apply-patch/types.js';

describe('parsePatch', () => {
  it('should reject patch without Begin marker', () => {
    expect(() => parsePatch('bad')).toThrow();
  });

  it('should reject patch without End marker', () => {
    expect(() => parsePatch('*** Begin Patch\nbad')).toThrow();
  });

  it('should reject Update hunk without chunks', () => {
    const patch = `*** Begin Patch
*** Update File: test.py
*** End Patch`;
    expect(() => parsePatch(patch)).toThrow('empty');
  });

  it('should parse empty patch', () => {
    const patch = `*** Begin Patch
*** End Patch`;
    const result = parsePatch(patch);
    expect(result.hunks).toEqual([]);
  });

  it('should parse complete patch with all hunk types', () => {
    const patch = `*** Begin Patch
*** Add File: path/add.py
+abc
+def
*** Delete File: path/delete.py
*** Update File: path/update.py
*** Move to: path/update2.py
@@ def f():
-    pass
+    return 123
*** End Patch`;

    const result = parsePatch(patch);
    expect(result.hunks).toEqual([
      {
        type: 'AddFile',
        path: 'path/add.py',
        contents: 'abc\ndef\n',
      },
      {
        type: 'DeleteFile',
        path: 'path/delete.py',
      },
      {
        type: 'UpdateFile',
        path: 'path/update.py',
        movePath: 'path/update2.py',
        chunks: [
          {
            changeContext: 'def f():',
            oldLines: ['    pass'],
            newLines: ['    return 123'],
            isEndOfFile: false,
          },
        ],
      },
    ]);
  });

  it('should parse update hunk followed by add file hunk', () => {
    const patch = `*** Begin Patch
*** Update File: file.py
@@
+line
*** Add File: other.py
+content
*** End Patch`;

    const result = parsePatch(patch);
    expect(result.hunks).toEqual([
      {
        type: 'UpdateFile',
        path: 'file.py',
        movePath: undefined,
        chunks: [
          {
            changeContext: undefined,
            oldLines: [],
            newLines: ['line'],
            isEndOfFile: false,
          },
        ],
      },
      {
        type: 'AddFile',
        path: 'other.py',
        contents: 'content\n',
      },
    ]);
  });

  it('should parse update hunk without explicit @@ header', () => {
    const patch = `*** Begin Patch
*** Update File: file2.py
 import foo
+bar
*** End Patch`;

    const result = parsePatch(patch);
    expect(result.hunks).toEqual([
      {
        type: 'UpdateFile',
        path: 'file2.py',
        movePath: undefined,
        chunks: [
          {
            changeContext: undefined,
            oldLines: ['import foo'],
            newLines: ['import foo', 'bar'],
            isEndOfFile: false,
          },
        ],
      },
    ]);
  });

  it('should handle heredoc wrapper in lenient mode', () => {
    const patchBody = `*** Begin Patch
*** Update File: file2.py
 import foo
+bar
*** End Patch`;

    const wrappedPatches = [
      `<<EOF\n${patchBody}\nEOF\n`,
      `<<'EOF'\n${patchBody}\nEOF\n`,
      `<<"EOF"\n${patchBody}\nEOF\n`,
    ];

    for (const wrapped of wrappedPatches) {
      const result = parsePatch(wrapped);
      expect(result.hunks).toEqual([
        {
          type: 'UpdateFile',
          path: 'file2.py',
          movePath: undefined,
          chunks: [
            {
              changeContext: undefined,
              oldLines: ['import foo'],
              newLines: ['import foo', 'bar'],
              isEndOfFile: false,
            },
          ],
        },
      ]);
    }
  });

  it('should reject invalid hunk header', () => {
    const patch = `*** Begin Patch
*** Frobnicate File: foo
*** End Patch`;
    expect(() => parsePatch(patch)).toThrow('not a valid hunk header');
  });

  it('should parse empty change_context marker', () => {
    const patch = `*** Begin Patch
*** Update File: file.py
@@
+line
*** End Patch`;

    const result = parsePatch(patch);
    expect(result.hunks[0]).toMatchObject({
      type: 'UpdateFile',
      chunks: [
        {
          changeContext: undefined,
          newLines: ['line'],
        },
      ],
    });
  });

  it('should parse End of File marker', () => {
    const patch = `*** Begin Patch
*** Update File: file.py
@@
+line
*** End of File
*** End Patch`;

    const result = parsePatch(patch);
    expect(result.hunks[0]).toMatchObject({
      type: 'UpdateFile',
      chunks: [
        {
          isEndOfFile: true,
        },
      ],
    });
  });

  it('should handle empty lines in chunks', () => {
    const patch = `*** Begin Patch
*** Update File: file.py
@@ context


 line
+added
*** End Patch`;

    const result = parsePatch(patch);
    const chunk = (result.hunks[0] as Extract<Hunk, { type: 'UpdateFile' }>)
      .chunks[0];
    expect(chunk.oldLines).toContain('');
    expect(chunk.newLines).toContain('');
  });
});

describe('resolveHunkPath', () => {
  it('should resolve relative path with cwd', () => {
    const hunk: Hunk = {
      type: 'AddFile',
      path: 'foo.txt',
      contents: 'test',
    };
    const resolved = resolveHunkPath(hunk, '/home/user');
    expect(resolved).toBe('/home/user/foo.txt');
  });

  it('should handle absolute paths', () => {
    const hunk: Hunk = {
      type: 'AddFile',
      path: '/tmp/foo.txt',
      contents: 'test',
    };
    const resolved = resolveHunkPath(hunk, '/home/user');
    expect(resolved).toBe('/tmp/foo.txt');
  });
});
