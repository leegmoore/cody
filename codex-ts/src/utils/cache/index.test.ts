import { describe, it, expect } from 'vitest';
import { LruCache, sha1Digest } from './index.js';

describe('LruCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LruCache<string, number>(2);

    expect(cache.get('first')).toBeUndefined();
    cache.insert('first', 1);
    expect(cache.get('first')).toBe(1);
  });

  it('evicts least recently used entries', () => {
    const cache = new LruCache<string, number>(2);

    cache.insert('a', 1);
    cache.insert('b', 2);
    expect(cache.get('a')).toBe(1); // Access 'a' to make it more recent

    cache.insert('c', 3); // This should evict 'b'

    expect(cache.get('b')).toBeUndefined(); // 'b' was evicted
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('returns undefined for zero capacity', () => {
    const cache = LruCache.tryWithCapacity<string, number>(0);
    expect(cache).toBeUndefined();
  });

  it('creates cache with non-zero capacity', () => {
    const cache = LruCache.tryWithCapacity<string, number>(5);
    expect(cache).toBeDefined();
    expect(cache).toBeInstanceOf(LruCache);
  });

  it('gets or inserts with factory function', () => {
    const cache = new LruCache<string, number>(2);
    let callCount = 0;

    const value1 = cache.getOrInsertWith('key', () => {
      callCount++;
      return 42;
    });

    expect(value1).toBe(42);
    expect(callCount).toBe(1);

    // Second call should use cached value
    const value2 = cache.getOrInsertWith('key', () => {
      callCount++;
      return 99;
    });

    expect(value2).toBe(42);
    expect(callCount).toBe(1); // Factory not called again
  });

  it('gets or tries to insert with fallible factory', () => {
    const cache = new LruCache<string, number>(2);

    const result1 = cache.getOrTryInsertWith('key', () => {
      return { ok: true, value: 42 };
    });

    expect(result1).toEqual({ ok: true, value: 42 });

    // Second call should use cached value
    const result2 = cache.getOrTryInsertWith('key', () => {
      return { ok: true, value: 99 };
    });

    expect(result2).toEqual({ ok: true, value: 42 });
  });

  it('handles factory errors', () => {
    const cache = new LruCache<string, number>(2);

    const result = cache.getOrTryInsertWith('key', () => {
      return { ok: false, error: 'Failed' };
    });

    expect(result).toEqual({ ok: false, error: 'Failed' });
    expect(cache.get('key')).toBeUndefined(); // Not cached on error
  });

  it('removes entries', () => {
    const cache = new LruCache<string, number>(2);
    cache.insert('key', 42);

    expect(cache.get('key')).toBe(42);

    const removed = cache.remove('key');
    expect(removed).toBe(42);
    expect(cache.get('key')).toBeUndefined();
  });

  it('clears all entries', () => {
    const cache = new LruCache<string, number>(2);
    cache.insert('a', 1);
    cache.insert('b', 2);

    cache.clear();

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('returns previous value on insert', () => {
    const cache = new LruCache<string, number>(2);

    const prev1 = cache.insert('key', 42);
    expect(prev1).toBeUndefined();

    const prev2 = cache.insert('key', 99);
    expect(prev2).toBe(42);
    expect(cache.get('key')).toBe(99);
  });
});

describe('sha1Digest', () => {
  it('computes SHA-1 digest of bytes', () => {
    const input = new TextEncoder().encode('hello world');
    const digest = sha1Digest(input);

    // Expected SHA-1 of "hello world"
    const expected = new Uint8Array([
      0x2a, 0xae, 0x6c, 0x35, 0xc9, 0x4f, 0xcf, 0xb4,
      0x15, 0xdb, 0xe9, 0x5f, 0x40, 0x8b, 0x9c, 0xe9,
      0x1e, 0xe8, 0x46, 0xed
    ]);

    expect(digest).toEqual(expected);
  });

  it('computes different digests for different inputs', () => {
    const input1 = new TextEncoder().encode('hello');
    const input2 = new TextEncoder().encode('world');

    const digest1 = sha1Digest(input1);
    const digest2 = sha1Digest(input2);

    expect(digest1).not.toEqual(digest2);
  });

  it('handles empty input', () => {
    const input = new Uint8Array(0);
    const digest = sha1Digest(input);

    // SHA-1 of empty string
    const expected = new Uint8Array([
      0xda, 0x39, 0xa3, 0xee, 0x5e, 0x6b, 0x4b, 0x0d,
      0x32, 0x55, 0xbf, 0xef, 0x95, 0x60, 0x18, 0x90,
      0xaf, 0xd8, 0x07, 0x09
    ]);

    expect(digest).toEqual(expected);
  });
});
