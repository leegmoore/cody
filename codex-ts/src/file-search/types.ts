/**
 * Types for file-search module
 */

/**
 * A single match result returned from the search
 */
export interface FileMatch {
  /** Relevance score (higher is better in our implementation) */
  score: number;
  /** Path to the matched file (relative to the search directory) */
  path: string;
  /** Optional list of character indices that matched the query */
  indices?: number[];
}

/**
 * Results from a file search operation
 */
export interface FileSearchResults {
  /** List of matches, sorted by score (descending) then path (ascending) */
  matches: FileMatch[];
  /** Total number of matches found (before limiting) */
  totalMatchCount: number;
}

/**
 * Options for file search
 */
export interface FileSearchOptions {
  /** Search pattern (fuzzy match) */
  pattern: string;
  /** Maximum number of results to return (default: 64) */
  limit?: number;
  /** Directory to search in (default: current directory) */
  searchDirectory?: string;
  /** Exclude patterns (glob patterns) */
  exclude?: string[];
  /** Whether to compute character indices for matches (default: false) */
  computeIndices?: boolean;
  /** Whether to respect .gitignore (default: true) */
  respectGitignore?: boolean;
  /** Cancellation signal */
  signal?: AbortSignal;
}
