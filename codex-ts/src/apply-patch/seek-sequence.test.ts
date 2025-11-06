/**
 * Tests for seek-sequence fuzzy matching
 */

import { describe, it, expect } from 'vitest';
import { seekSequence } from '../../src/apply-patch/seek-sequence.js';

describe('seekSequence', () => {
  it('should find exact match', () => {
    const lines = ['foo', 'bar', 'baz'];
    const pattern = ['bar', 'baz'];
    expect(seekSequence(lines, pattern, 0, false)).toBe(1);
  });

  it('should ignore trailing whitespace', () => {
    const lines = ['foo   ', 'bar\t\t'];
    const pattern = ['foo', 'bar'];
    expect(seekSequence(lines, pattern, 0, false)).toBe(0);
  });

  it('should ignore leading and trailing whitespace', () => {
    const lines = ['    foo   ', '   bar\t'];
    const pattern = ['foo', 'bar'];
    expect(seekSequence(lines, pattern, 0, false)).toBe(0);
  });

  it('should return undefined when pattern longer than input', () => {
    const lines = ['just one line'];
    const pattern = ['too', 'many', 'lines'];
    expect(seekSequence(lines, pattern, 0, false)).toBeUndefined();
  });

  it('should return start index for empty pattern', () => {
    const lines = ['foo', 'bar'];
    const pattern: string[] = [];
    expect(seekSequence(lines, pattern, 5, false)).toBe(5);
  });

  it('should search from start position', () => {
    const lines = ['foo', 'bar', 'foo', 'bar'];
    const pattern = ['foo', 'bar'];
    expect(seekSequence(lines, pattern, 0, false)).toBe(0);
    expect(seekSequence(lines, pattern, 1, false)).toBe(2);
  });

  it('should prioritize end-of-file when eof is true', () => {
    const lines = ['foo', 'bar', 'baz', 'qux'];
    const pattern = ['baz', 'qux'];
    expect(seekSequence(lines, pattern, 0, true)).toBe(2);
  });

  it('should normalize Unicode dashes to ASCII', () => {
    const lines = ['import asyncio  # local import \u2013 avoids top\u2011level dep'];
    const pattern = ['import asyncio  # local import - avoids top-level dep'];
    expect(seekSequence(lines, pattern, 0, false)).toBe(0);
  });

  it('should normalize fancy quotes to ASCII', () => {
    const lines = ['She said \u201CHello\u201D'];
    const pattern = ['She said "Hello"'];
    expect(seekSequence(lines, pattern, 0, false)).toBe(0);
  });

  it('should normalize non-breaking spaces', () => {
    const lines = ['foo\u00A0bar'];
    const pattern = ['foo bar'];
    expect(seekSequence(lines, pattern, 0, false)).toBe(0);
  });

  it('should return undefined when no match found', () => {
    const lines = ['foo', 'bar'];
    const pattern = ['baz', 'qux'];
    expect(seekSequence(lines, pattern, 0, false)).toBeUndefined();
  });
});
