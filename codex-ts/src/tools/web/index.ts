/**
 * Web Tools - Search and Fetch
 */

export {
  webSearch,
  type WebSearchParams,
  type WebSearchResult,
  type SearchResult,
} from "./search.js";
export {
  fetchUrl,
  type FetchUrlParams,
  type FetchUrlResult,
  type FetchedDocument,
  getCacheStats,
  clearCache,
} from "./fetch.js";
