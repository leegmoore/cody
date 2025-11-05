import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';

/**
 * Result type for fallible operations.
 */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * A minimal LRU (Least Recently Used) cache wrapper.
 *
 * This provides a simple API over the lru-cache library, similar to
 * the Rust BlockingLruCache implementation.
 */
export class LruCache<K, V> {
  private cache: LRUCache<K, V>;

  /**
   * Creates a cache with the specified capacity.
   *
   * @param capacity - Maximum number of entries (must be > 0)
   */
  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be greater than 0');
    }
    this.cache = new LRUCache<K, V>({ max: capacity });
  }

  /**
   * Builds a cache if `capacity` is non-zero, returning `undefined` otherwise.
   *
   * @param capacity - Maximum number of entries
   * @returns Cache instance or undefined if capacity is 0
   */
  static tryWithCapacity<K, V>(capacity: number): LruCache<K, V> | undefined {
    if (capacity > 0) {
      return new LruCache<K, V>(capacity);
    }
    return undefined;
  }

  /**
   * Returns the cached value for `key`, or computes and inserts it.
   *
   * @param key - Cache key
   * @param factory - Function to compute value if not cached
   * @returns The cached or newly computed value
   */
  getOrInsertWith(key: K, factory: () => V): V {
    const existing = this.cache.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const value = factory();
    this.cache.set(key, value);
    return value;
  }

  /**
   * Like `getOrInsertWith`, but the value factory may fail.
   *
   * @param key - Cache key
   * @param factory - Function that returns a Result
   * @returns Result containing the cached or newly computed value
   */
  getOrTryInsertWith<E>(
    key: K,
    factory: () => Result<V, E>
  ): Result<V, E> {
    const existing = this.cache.get(key);
    if (existing !== undefined) {
      return { ok: true, value: existing };
    }

    const result = factory();
    if (result.ok) {
      this.cache.set(key, result.value);
    }
    return result;
  }

  /**
   * Returns the cached value corresponding to `key`, if present.
   *
   * @param key - Cache key
   * @returns The cached value or undefined
   */
  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  /**
   * Inserts `value` for `key`, returning the previous entry if it existed.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @returns The previous value if it existed
   */
  insert(key: K, value: V): V | undefined {
    const prev = this.cache.get(key);
    this.cache.set(key, value);
    return prev;
  }

  /**
   * Removes the entry for `key` if it exists, returning it.
   *
   * @param key - Cache key
   * @returns The removed value if it existed
   */
  remove(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
    }
    return value;
  }

  /**
   * Clears all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Returns the number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Computes the SHA-1 digest of bytes.
 *
 * Useful for content-based cache keys when you want to avoid staleness
 * caused by path-only keys.
 *
 * @param bytes - Input bytes to hash
 * @returns SHA-1 digest as a 20-byte Uint8Array
 *
 * @example
 * ```typescript
 * const content = new TextEncoder().encode('file contents');
 * const digest = sha1Digest(content);
 * // Use digest as cache key
 * ```
 */
export function sha1Digest(bytes: Uint8Array): Uint8Array {
  const hash = createHash('sha1');
  hash.update(bytes);
  return new Uint8Array(hash.digest());
}
