/**
 * LRU cache for parsed scripts
 *
 * Caches parsed script results to avoid re-parsing identical scripts.
 * Uses SHA-256 hash of source code as the cache key.
 *
 * Phase 4.5 - Performance Optimizations: Script Caching
 *
 * Design:
 * - Max 1000 entries
 * - LRU eviction policy
 * - SHA-256 hash keys
 * - Thread-safe (single-threaded JS, but async-safe)
 */

import { createHash } from "node:crypto";

/**
 * Cached script entry
 */
export interface CachedScript {
  /** Source code hash */
  hash: string;

  /** Parsed script result */
  parsed: {
    success: boolean;
    script?: {
      sourceCode: string;
      hasReturn: boolean;
    };
    error?: string;
  };

  /** When the entry was cached */
  cachedAt: number;

  /** Number of cache hits */
  hits: number;

  /** Last access time */
  lastAccessedAt: number;
}

/**
 * Script cache configuration
 */
export interface ScriptCacheConfig {
  /** Maximum cache entries (default: 1000) */
  maxEntries?: number;

  /** Enable caching (default: true) */
  enabled?: boolean;
}

/**
 * LRU cache for parsed scripts
 *
 * Provides significant performance improvement for repeated script execution.
 *
 * @example
 * ```typescript
 * const cache = new ScriptCache({ maxEntries: 1000 });
 *
 * const script = 'const x = 42; return x * 2;';
 * const parsed = parseScript(script);
 *
 * cache.set(script, parsed);
 *
 * // Later...
 * const cached = cache.get(script);
 * if (cached) {
 *   // Use cached result
 * }
 * ```
 */
export class ScriptCache {
  private config: Required<ScriptCacheConfig>;
  private cache = new Map<string, CachedScript>();
  private accessOrder: string[] = []; // For LRU tracking

  constructor(config: ScriptCacheConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 1000,
      enabled: config.enabled ?? true,
    };
  }

  /**
   * Generate SHA-256 hash of source code
   */
  private hash(sourceCode: string): string {
    return createHash("sha256").update(sourceCode, "utf8").digest("hex");
  }

  /**
   * Get cached script result
   *
   * @param sourceCode - Script source code
   * @returns Cached result or undefined
   */
  get(sourceCode: string): CachedScript["parsed"] | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    const hash = this.hash(sourceCode);
    const entry = this.cache.get(hash);

    if (entry) {
      // Update LRU tracking
      entry.hits++;
      entry.lastAccessedAt = Date.now();

      // Move to end of access order (most recently used)
      const index = this.accessOrder.indexOf(hash);
      if (index !== -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(hash);

      return entry.parsed;
    }

    return undefined;
  }

  /**
   * Store parsed script in cache
   *
   * @param sourceCode - Script source code
   * @param parsed - Parsed script result
   */
  set(sourceCode: string, parsed: CachedScript["parsed"]): void {
    if (!this.config.enabled) {
      return;
    }

    const hash = this.hash(sourceCode);

    // Check if already cached
    if (this.cache.has(hash)) {
      // Update existing entry
      const entry = this.cache.get(hash)!;
      entry.parsed = parsed;
      entry.lastAccessedAt = Date.now();
      return;
    }

    // Evict LRU entry if at max capacity
    if (this.cache.size >= this.config.maxEntries) {
      const lruHash = this.accessOrder.shift();
      if (lruHash) {
        this.cache.delete(lruHash);
      }
    }

    // Add new entry
    const entry: CachedScript = {
      hash,
      parsed,
      cachedAt: Date.now(),
      hits: 0,
      lastAccessedAt: Date.now(),
    };

    this.cache.set(hash, entry);
    this.accessOrder.push(hash);
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    totalHits: number;
    enabled: boolean;
    entries: Array<{
      hash: string;
      hits: number;
      age: number;
    }>;
  } {
    const entries = Array.from(this.cache.values()).map((entry) => ({
      hash: entry.hash.substring(0, 8),
      hits: entry.hits,
      age: Date.now() - entry.cachedAt,
    }));

    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);

    return {
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      totalHits,
      enabled: this.config.enabled,
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 10), // Top 10
    };
  }

  /**
   * Check if cache contains entry for source code
   *
   * @param sourceCode - Script source code
   * @returns true if cached
   */
  has(sourceCode: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const hash = this.hash(sourceCode);
    return this.cache.has(hash);
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Enable or disable caching
   *
   * @param enabled - Whether to enable caching
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }
}
