/**
 * Registry of model providers supported by Codex.
 *
 * Providers can be defined in two places:
 *   1. Built-in defaults compiled into the binary so Codex works out-of-the-box.
 *   2. User-defined entries inside `~/.codex/config.toml` under the `model_providers`
 *      key. These override or extend the defaults at runtime.
 *
 * Ported from: codex-rs/core/src/model_provider_info.rs
 */

/**
 * Default constants for retry and timeout configuration.
 */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000; // 5 minutes
export const DEFAULT_STREAM_MAX_RETRIES = 5;
export const DEFAULT_REQUEST_MAX_RETRIES = 4;

/** Hard cap for user-configured stream_max_retries */
const MAX_STREAM_MAX_RETRIES = 100;
/** Hard cap for user-configured request_max_retries */
const MAX_REQUEST_MAX_RETRIES = 100;

/**
 * Wire protocol that the provider speaks.
 *
 * Most third-party services only implement the classic OpenAI Chat Completions
 * JSON schema, whereas OpenAI itself (and a handful of others) additionally expose
 * the more modern Responses API. Anthropic uses the Messages API which has its
 * own request/response format. The three protocols use different shapes and cannot
 * be auto-detected at runtime, therefore each provider entry must declare which
 * one it expects.
 */
export enum WireApi {
  /** The Responses API exposed by OpenAI at `/v1/responses` */
  Responses = "responses",

  /** Regular Chat Completions compatible with `/v1/chat/completions` */
  Chat = "chat",

  /** Anthropic Messages API at `/v1/messages` */
  Messages = "messages",
}

/**
 * Serializable representation of a provider definition.
 */
export interface ModelProviderInfo {
  /** Friendly display name */
  name: string;

  /** Base URL for the provider's OpenAI-compatible API */
  baseUrl?: string;

  /** Environment variable that stores the user's API key for this provider */
  envKey?: string;

  /** Optional instructions to help the user get a valid value for the variable and set it */
  envKeyInstructions?: string;

  /**
   * Value to use with `Authorization: Bearer <token>` header.
   * Use of this config is discouraged in favor of `envKey` for security reasons,
   * but this may be necessary when using this programmatically.
   */
  experimentalBearerToken?: string;

  /** Which wire protocol this provider expects */
  wireApi: WireApi;

  /** Optional query parameters to append to the base URL */
  queryParams?: Record<string, string>;

  /**
   * Additional HTTP headers to include in requests to this provider where
   * the (key, value) pairs are the header name and value.
   */
  httpHeaders?: Record<string, string>;

  /**
   * Optional HTTP headers to include in requests to this provider where the
   * (key, value) pairs are the header name and environment variable whose
   * value should be used. If the environment variable is not set, or the
   * value is empty, the header will not be included in the request.
   */
  envHttpHeaders?: Record<string, string>;

  /** Maximum number of times to retry a failed HTTP request to this provider */
  requestMaxRetries?: number;

  /** Number of times to retry reconnecting a dropped streaming response before failing */
  streamMaxRetries?: number;

  /** Idle timeout (in milliseconds) to wait for activity on a streaming response before treating the connection as lost */
  streamIdleTimeoutMs?: number;

  /**
   * Does this provider require an OpenAI API Key or ChatGPT login token?
   * If true, user is presented with login screen on first run, and login preference
   * and token/key are stored in auth.json. If false (which is the default), login
   * screen is skipped, and API key (if needed) comes from the "envKey" environment variable.
   */
  requiresOpenaiAuth: boolean;
}

/** Default Ollama port */
const DEFAULT_OLLAMA_PORT = 11434;

/** Built-in OSS model provider ID */
export const BUILT_IN_OSS_MODEL_PROVIDER_ID = "oss";

/**
 * Built-in default provider list.
 *
 * We do not want to be in the business of adjudicating which third-party
 * providers are bundled with Codex CLI, so we only include the OpenAI and
 * open source ("oss") providers by default. Users are encouraged to add to
 * `model_providers` in config.toml to add their own providers.
 */
export function builtInModelProviders(): Record<string, ModelProviderInfo> {
  // Note: Reading OPENAI_BASE_URL from environment is handled at runtime
  // to allow users to override the default OpenAI endpoint
  const openaiBaseUrl = process.env.OPENAI_BASE_URL?.trim() || undefined;

  const providers: Record<string, ModelProviderInfo> = {
    openai: {
      name: "OpenAI",
      // Allow users to override the default OpenAI endpoint by
      // exporting `OPENAI_BASE_URL`. This is useful when pointing
      // Codex at a proxy, mock server, or Azure-style deployment
      // without requiring a full TOML override for the built-in
      // OpenAI provider.
      baseUrl: openaiBaseUrl,
      envKey: undefined,
      envKeyInstructions: undefined,
      experimentalBearerToken: undefined,
      wireApi: WireApi.Responses,
      queryParams: undefined,
      httpHeaders: {
        // Note: In Rust this uses env!("CARGO_PKG_VERSION"), we'll use a placeholder
        // or read from package.json in a real implementation
        version: "0.0.0",
      },
      envHttpHeaders: {
        "OpenAI-Organization": "OPENAI_ORGANIZATION",
        "OpenAI-Project": "OPENAI_PROJECT",
      },
      // Use global defaults for retry/timeout unless overridden in config.toml
      requestMaxRetries: undefined,
      streamMaxRetries: undefined,
      streamIdleTimeoutMs: undefined,
      requiresOpenaiAuth: true,
    },
    [BUILT_IN_OSS_MODEL_PROVIDER_ID]: createOssProvider(),
  };

  return providers;
}

/**
 * Create OSS provider with environment-based configuration.
 *
 * These CODEX_OSS_ environment variables are experimental: we may
 * switch to reading values from config.toml instead.
 */
export function createOssProvider(): ModelProviderInfo {
  const codexOssBaseUrl = process.env.CODEX_OSS_BASE_URL?.trim();
  const codexOssPort = process.env.CODEX_OSS_PORT?.trim();

  let baseUrl: string;
  if (codexOssBaseUrl) {
    baseUrl = codexOssBaseUrl;
  } else {
    const port = codexOssPort
      ? parseInt(codexOssPort, 10)
      : DEFAULT_OLLAMA_PORT;
    baseUrl = `http://localhost:${port}/v1`;
  }

  return createOssProviderWithBaseUrl(baseUrl);
}

/**
 * Create OSS provider with explicit base URL.
 */
export function createOssProviderWithBaseUrl(
  baseUrl: string,
): ModelProviderInfo {
  return {
    name: "gpt-oss",
    baseUrl,
    envKey: undefined,
    envKeyInstructions: undefined,
    experimentalBearerToken: undefined,
    wireApi: WireApi.Chat,
    queryParams: undefined,
    httpHeaders: undefined,
    envHttpHeaders: undefined,
    requestMaxRetries: undefined,
    streamMaxRetries: undefined,
    streamIdleTimeoutMs: undefined,
    requiresOpenaiAuth: false,
  };
}

/**
 * Get effective maximum number of request retries for a provider.
 */
export function getRequestMaxRetries(provider: ModelProviderInfo): number {
  return Math.min(
    provider.requestMaxRetries ?? DEFAULT_REQUEST_MAX_RETRIES,
    MAX_REQUEST_MAX_RETRIES,
  );
}

/**
 * Get effective maximum number of stream reconnection attempts for a provider.
 */
export function getStreamMaxRetries(provider: ModelProviderInfo): number {
  return Math.min(
    provider.streamMaxRetries ?? DEFAULT_STREAM_MAX_RETRIES,
    MAX_STREAM_MAX_RETRIES,
  );
}

/**
 * Get effective idle timeout for streaming responses.
 */
export function getStreamIdleTimeout(provider: ModelProviderInfo): number {
  return provider.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
}

/**
 * Get the query string for a provider (including leading '?' if params exist).
 */
export function getQueryString(provider: ModelProviderInfo): string {
  if (!provider.queryParams || Object.keys(provider.queryParams).length === 0) {
    return "";
  }

  const params = Object.entries(provider.queryParams)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  return `?${params}`;
}

/**
 * Get the full URL for API requests based on the provider configuration.
 *
 * Note: For Phase 4.1, this is a simplified version. Full auth integration
 * (ChatGPT detection) will be added in later phases.
 */
export function getFullUrl(
  provider: ModelProviderInfo,
  auth?: { mode: string } | undefined,
): string {
  // Determine default base URL
  let defaultBaseUrl = "https://api.openai.com/v1";
  if (auth?.mode === "ChatGPT") {
    defaultBaseUrl = "https://chatgpt.com/backend-api/codex";
  }

  const queryString = getQueryString(provider);
  const baseUrl = provider.baseUrl ?? defaultBaseUrl;

  // Append the appropriate endpoint based on wire_api
  switch (provider.wireApi) {
    case WireApi.Responses:
      return `${baseUrl}/responses${queryString}`;
    case WireApi.Chat:
      return `${baseUrl}/chat/completions${queryString}`;
    case WireApi.Messages:
      return `${baseUrl}/messages${queryString}`;
  }
}

/**
 * Detect if a provider is an Azure Responses endpoint.
 */
export function isAzureResponsesEndpoint(provider: ModelProviderInfo): boolean {
  if (provider.wireApi !== WireApi.Responses) {
    return false;
  }

  // Check if the name is explicitly "Azure"
  if (provider.name.toLowerCase() === "azure") {
    return true;
  }

  // Check if the base URL contains Azure markers
  if (provider.baseUrl) {
    return matchesAzureResponsesBaseUrl(provider.baseUrl);
  }

  return false;
}

/**
 * Check if a base URL matches known Azure patterns.
 */
function matchesAzureResponsesBaseUrl(baseUrl: string): boolean {
  const base = baseUrl.toLowerCase();
  const AZURE_MARKERS = [
    "openai.azure.",
    "cognitiveservices.azure.",
    "aoai.azure.",
    "azure-api.",
    "azurefd.",
  ];

  return AZURE_MARKERS.some((marker) => base.includes(marker));
}
