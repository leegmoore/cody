/**
 * Tests for file search
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { run } from './search.js';
import type { FileSearchOptions } from './types.js';

describe('file-search', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-search-test-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should find files with fuzzy matching', async () => {
    // Create test files
    fs.writeFileSync(path.join(tmpDir, 'abc'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'abcde'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'abexy'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'zzz.txt'), 'x');

    const results = await run({
      pattern: 'abe',
      searchDirectory: tmpDir,
      limit: 10,
    });

    expect(results.matches.length).toBeGreaterThan(0);
    expect(results.totalMatchCount).toBeGreaterThan(0);

    // Should find files matching pattern
    const paths = results.matches.map((m) => m.path);
    expect(paths).toContain('abexy');
    expect(paths).toContain('abcde');
  });

  it('should return results sorted by score then path', async () => {
    // Create files with same score
    fs.writeFileSync(path.join(tmpDir, 'b_path.txt'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'a_path.txt'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'z_path.txt'), 'x');

    const results = await run({
      pattern: 'path',
      searchDirectory: tmpDir,
      limit: 10,
    });

    // Should be sorted alphabetically when scores are equal
    const paths = results.matches.map((m) => m.path);
    expect(paths.indexOf('a_path.txt')).toBeLessThan(paths.indexOf('b_path.txt'));
  });

  it('should respect limit parameter', async () => {
    // Create many files
    for (let i = 0; i < 20; i++) {
      fs.writeFileSync(path.join(tmpDir, `file${i}.txt`), 'x');
    }

    const results = await run({
      pattern: 'file',
      searchDirectory: tmpDir,
      limit: 5,
    });

    expect(results.matches.length).toBeLessThanOrEqual(5);
    expect(results.totalMatchCount).toBeGreaterThanOrEqual(20);
  });

  it('should compute indices when requested', async () => {
    fs.writeFileSync(path.join(tmpDir, 'abexy'), 'x');

    const results = await run({
      pattern: 'abe',
      searchDirectory: tmpDir,
      computeIndices: true,
      limit: 10,
    });

    const match = results.matches.find((m) => m.path === 'abexy');
    expect(match).toBeDefined();
    expect(match?.indices).toBeDefined();
    expect(Array.isArray(match?.indices)).toBe(true);
  });

  it('should exclude patterns', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'test.md'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'test.js'), 'x');

    const results = await run({
      pattern: 'test',
      searchDirectory: tmpDir,
      exclude: ['*.txt', '*.md'],
      limit: 10,
    });

    const paths = results.matches.map((m) => m.path);
    expect(paths).toContain('test.js');
    expect(paths).not.toContain('test.txt');
    expect(paths).not.toContain('test.md');
  });

  it('should search in subdirectories', async () => {
    const subDir = path.join(tmpDir, 'sub');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'abce'), 'x');

    const results = await run({
      pattern: 'abe',
      searchDirectory: tmpDir,
      limit: 10,
    });

    const match = results.matches.find((m) => m.path.includes('sub'));
    expect(match).toBeDefined();
  });

  it('should handle empty pattern', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'x');

    const results = await run({
      pattern: '',
      searchDirectory: tmpDir,
      limit: 10,
    });

    // Empty pattern returns no matches in fuzzysort
    expect(results.matches.length).toBe(0);
    expect(results.totalMatchCount).toBe(0);
  });

  it('should handle no matches', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'x');

    const results = await run({
      pattern: 'zzzznonexistent',
      searchDirectory: tmpDir,
      limit: 10,
    });

    expect(results.matches.length).toBe(0);
    expect(results.totalMatchCount).toBe(0);
  });

  it('should respect gitignore when enabled', async () => {
    // Create .gitignore
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'ignored.txt\n');
    fs.writeFileSync(path.join(tmpDir, 'ignored.txt'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'notignored.txt'), 'x');

    const results = await run({
      pattern: 'txt',
      searchDirectory: tmpDir,
      respectGitignore: true,
      limit: 10,
    });

    const paths = results.matches.map((m) => m.path);
    expect(paths).toContain('notignored.txt');
    expect(paths).not.toContain('ignored.txt');
  });

  it('should not respect gitignore when disabled', async () => {
    // Create .gitignore
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'ignored.txt\n');
    fs.writeFileSync(path.join(tmpDir, 'ignored.txt'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'notignored.txt'), 'x');

    const results = await run({
      pattern: 'txt',
      searchDirectory: tmpDir,
      respectGitignore: false,
      limit: 10,
    });

    const paths = results.matches.map((m) => m.path);
    expect(paths).toContain('notignored.txt');
    expect(paths).toContain('ignored.txt');
  });

  it('should handle AbortSignal', async () => {
    // Create many files
    for (let i = 0; i < 100; i++) {
      fs.writeFileSync(path.join(tmpDir, `file${i}.txt`), 'x');
    }

    const controller = new AbortController();

    // Abort immediately
    controller.abort();

    const results = await run({
      pattern: 'file',
      searchDirectory: tmpDir,
      limit: 10,
      signal: controller.signal,
    });

    expect(results.matches.length).toBe(0);
    expect(results.totalMatchCount).toBe(0);
  });
});
