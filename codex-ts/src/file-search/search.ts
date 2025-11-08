/**
 * File search implementation using globby and fuzzysort
 */

import { globby } from "globby";
import Fuzzysort from "fuzzysort";
import type {
  FileMatch,
  FileSearchResults,
  FileSearchOptions,
} from "./types.js";

/**
 * Run file search with fuzzy matching
 */
export async function run(
  options: FileSearchOptions,
): Promise<FileSearchResults> {
  const {
    pattern,
    limit = 64,
    searchDirectory = process.cwd(),
    exclude = [],
    computeIndices = false,
    respectGitignore = true,
    signal,
  } = options;

  // Check if already aborted
  if (signal?.aborted) {
    return {
      matches: [],
      totalMatchCount: 0,
    };
  }

  // Build glob options (globby doesn't support AbortSignal)
  const globOptions: Parameters<typeof globby>[1] = {
    cwd: searchDirectory,
    gitignore: respectGitignore,
    ignore: exclude,
    onlyFiles: true,
    followSymbolicLinks: true,
    dot: true, // Include hidden files
  };

  // Get all files
  const files = await globby("**/*", globOptions);

  // If signal was aborted, return empty results
  if (signal?.aborted) {
    return {
      matches: [],
      totalMatchCount: 0,
    };
  }

  // Perform fuzzy matching
  const results = Fuzzysort.go(pattern, files, {
    limit: limit * 2, // Get more results for better ranking
    threshold: -10000, // Accept any match
  });

  // Convert to our format
  const totalMatchCount = results.total;
  const matches: FileMatch[] = results.slice(0, limit).map((result) => {
    const match: FileMatch = {
      score: result.score,
      path: result.target,
    };

    if (computeIndices && result.indexes) {
      match.indices = Array.from(result.indexes);
    }

    return match;
  });

  // Sort by score (descending) then path (ascending)
  matches.sort(compareByScoreDescThenPathAsc);

  return {
    matches,
    totalMatchCount,
  };
}

/**
 * Comparator for sorting matches by score (descending) then path (ascending)
 */
function compareByScoreDescThenPathAsc(a: FileMatch, b: FileMatch): number {
  // Higher score first
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  // Alphabetical order for ties
  return a.path.localeCompare(b.path);
}
