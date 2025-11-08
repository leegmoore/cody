/**
 * Identify whether a base_url points at an OpenAI-compatible root (".../v1").
 *
 * @param baseUrl - The base URL to check
 * @returns True if the URL ends with "/v1"
 *
 * @example
 * ```typescript
 * isOpenAiCompatibleBaseUrl('http://localhost:11434/v1'); // true
 * isOpenAiCompatibleBaseUrl('http://localhost:11434'); // false
 * ```
 */
export function isOpenAiCompatibleBaseUrl(baseUrl: string): boolean {
  const trimmed = baseUrl.replace(/\/+$/, ""); // Remove trailing slashes
  return trimmed.endsWith("/v1");
}

/**
 * Convert a provider base_url into the native Ollama host root.
 *
 * For example, "http://localhost:11434/v1" -> "http://localhost:11434".
 * If the URL doesn't end with "/v1", it's returned as-is (with trailing slashes removed).
 *
 * @param baseUrl - The base URL to convert
 * @returns The host root URL
 *
 * @example
 * ```typescript
 * baseUrlToHostRoot('http://localhost:11434/v1'); // 'http://localhost:11434'
 * baseUrlToHostRoot('http://localhost:11434'); // 'http://localhost:11434'
 * ```
 */
export function baseUrlToHostRoot(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, ""); // Remove trailing slashes

  if (trimmed.endsWith("/v1")) {
    return trimmed.slice(0, -3).replace(/\/+$/, ""); // Remove /v1 and any trailing slashes
  }

  return trimmed;
}
