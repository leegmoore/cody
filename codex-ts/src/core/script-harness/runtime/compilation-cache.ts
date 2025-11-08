/**
 * Compilation cache for script preprocessing
 *
 * Caches the result of script compilation/preprocessing steps like:
 * - TypeScript → JavaScript transpilation (future)
 * - Script wrapping (IIFE, return detection)
 * - AST parsing results
 *
 * Phase 4.5 - Performance Optimizations: Compilation Caching
 *
 * Design:
 * - Keyed by source hash
 * - LRU eviction
 * - Max 1000 entries
 */

import { createHash } from "node:crypto";

/**
 * Compiled script entry
 */
export interface CompiledScript {
  /** Source code hash */
  sourceHash: string;

  /** Original source code */
  sourceCode: string;

  /** Compiled/wrapped code */
  compiledCode: string;

  /** Whether script has return statement */
  hasReturn: boolean;

  /** Compilation timestamp */
  compiledAt: number;

  /** Number of cache hits */
  hits: number;

  /** Last access time */
  lastAccessedAt: number;
}

/**
 * Compilation cache configuration
 */
export interface CompilationCacheConfig {
  /** Maximum cache entries (default: 1000) */
  maxEntries?: number;

  /** Enable caching (default: true) */
  enabled?: boolean;
}

/**
 * LRU cache for compiled scripts
 *
 * Caches the result of script preprocessing to avoid redundant work.
 *
 * @example
 * ```typescript
 * const cache = new CompilationCache({ maxEntries: 1000 });
 *
 * const source = 'return x * 2';
 * const compiled = '(function() { return x * 2 })()';
 *
 * cache.set(source, compiled, true);
 *
 * // Later...
 * const cached = cache.get(source);
 * if (cached) {
 *   // Use cached.compiledCode
 * }
 * ```
 */
export class CompilationCache {
  private config: Required<CompilationCacheConfig>;
  private cache = new Map<string, CompiledScript>();
  private accessOrder: string[] = []; // For LRU tracking

  constructor(config: CompilationCacheConfig = {}) {
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
   * Get cached compilation result
   *
   * @param sourceCode - Original source code
   * @returns Cached result or undefined
   */
  get(sourceCode: string): CompiledScript | undefined {
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

      return entry;
    }

    return undefined;
  }

  /**
   * Store compiled script in cache
   *
   * @param sourceCode - Original source code
   * @param compiledCode - Compiled/wrapped code
   * @param hasReturn - Whether script has return statement
   */
  set(sourceCode: string, compiledCode: string, hasReturn: boolean): void {
    if (!this.config.enabled) {
      return;
    }

    const hash = this.hash(sourceCode);

    // Check if already cached
    if (this.cache.has(hash)) {
      // Update existing entry
      const entry = this.cache.get(hash)!;
      entry.compiledCode = compiledCode;
      entry.hasReturn = hasReturn;
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
    const entry: CompiledScript = {
      sourceHash: hash,
      sourceCode,
      compiledCode,
      hasReturn,
      compiledAt: Date.now(),
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
    avgSourceLength: number;
    avgCompiledLength: number;
    entries: Array<{
      sourceHash: string;
      hits: number;
      age: number;
      sourceLength: number;
      compiledLength: number;
    }>;
  } {
    const entries = Array.from(this.cache.values()).map((entry) => ({
      sourceHash: entry.sourceHash.substring(0, 8),
      hits: entry.hits,
      age: Date.now() - entry.compiledAt,
      sourceLength: entry.sourceCode.length,
      compiledLength: entry.compiledCode.length,
    }));

    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    const avgSourceLength =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + e.sourceLength, 0) / entries.length
        : 0;
    const avgCompiledLength =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + e.compiledLength, 0) / entries.length
        : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      totalHits,
      enabled: this.config.enabled,
      avgSourceLength: Math.round(avgSourceLength),
      avgCompiledLength: Math.round(avgCompiledLength),
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 10), // Top 10
    };
  }

  /**
   * Check if cache contains entry for source code
   *
   * @param sourceCode - Original source code
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

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    if (this.cache.size === 0) {
      return 0;
    }

    const totalAttempts = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.hits + 1,
      0,
    ); // +1 for initial set
    const totalHits = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.hits,
      0,
    );

    return totalHits / totalAttempts;
  }
}
