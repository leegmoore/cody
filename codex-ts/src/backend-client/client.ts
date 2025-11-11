/**
 * HTTP client for Codex backend API.
 *
 * Supports both:
 * - Codex API paths (/api/codex/...)
 * - ChatGPT API paths (/wham/...)
 *
 * Ported from: codex-rs/backend-client/src/client.rs
 */

import type {
  CodeTaskDetailsResponse,
  PaginatedListTaskListItem,
  RateLimitStatusPayload,
  TurnAttemptsSiblingTurnsResponse,
} from "./types.js";
import type { CodexAuth } from "../core/auth/stub-auth.js";
import type { RateLimitSnapshot, RateLimitWindow } from "../protocol/protocol.js";
import { getCodexUserAgent } from "./user-agent.js";

/**
 * Path style for backend API requests
 */
export enum PathStyle {
  /** Use /api/codex/... paths */
  CodexApi = "codex",
  /** Use /wham/... paths (ChatGPT) */
  ChatGptApi = "chatgpt",
}

/**
 * Determine path style from base URL
 */
export function pathStyleFromBaseUrl(baseUrl: string): PathStyle {
  if (baseUrl.includes("/backend-api")) {
    return PathStyle.ChatGptApi;
  }
  return PathStyle.CodexApi;
}

/**
 * Normalize base URL by trimming trailing slashes and adding /backend-api
 * for ChatGPT hostnames
 */
function normalizeBaseUrl(url: string): string {
  let normalized = url;
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  // Normalize common ChatGPT hostnames to include /backend-api
  if (
    (normalized.startsWith("https://chatgpt.com") ||
      normalized.startsWith("https://chat.openai.com")) &&
    !normalized.includes("/backend-api")
  ) {
    normalized = `${normalized}/backend-api`;
  }

  return normalized;
}

/**
 * Client for Codex backend API
 */
export class Client {
  private readonly baseUrl: string;
  private readonly bearerToken?: string;
  private readonly userAgent?: string;
  private readonly chatgptAccountId?: string;
  private readonly pathStyle: PathStyle;

  constructor(options: {
    baseUrl: string;
    bearerToken?: string;
    userAgent?: string;
    chatgptAccountId?: string;
    pathStyle?: PathStyle;
  }) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.bearerToken = options.bearerToken;
    this.userAgent = options.userAgent;
    this.chatgptAccountId = options.chatgptAccountId;
    this.pathStyle = options.pathStyle ?? pathStyleFromBaseUrl(this.baseUrl);
  }

  /**
   * Create client from authentication
   */
  static async fromAuth(baseUrl: string, auth: CodexAuth): Promise<Client> {
    const token = await auth.getToken();
    const accountId = auth.getAccountId();

    return new Client({
      baseUrl,
      bearerToken: token,
      userAgent: getCodexUserAgent(),
      chatgptAccountId: accountId,
    });
  }

  /**
   * Get HTTP headers for requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": this.userAgent ?? "codex-cli",
    };

    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    }

    if (this.chatgptAccountId) {
      headers["ChatGPT-Account-Id"] = this.chatgptAccountId;
    }

    return headers;
  }

  /**
   * Execute HTTP request and parse response
   */
  private async execRequest<T>(
    method: string,
    url: string,
    options?: {
      query?: Record<string, string | number>;
      body?: unknown;
    },
  ): Promise<T> {
    // Build query string
    let queryString = "";
    if (options?.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        params.append(key, String(value));
      }
      queryString = "?" + params.toString();
    }

    const fullUrl = url + queryString;
    const headers = this.getHeaders();

    // Add content-type for POST requests
    if (method === "POST" && options?.body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `${method} ${url} failed: ${response.status}; content-type=${contentType}; body=${body}`,
      );
    }

    try {
      return JSON.parse(body) as T;
    } catch (e) {
      throw new Error(
        `Decode error for ${url}: ${e}; content-type=${contentType}; body=${body}`,
      );
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimits(): Promise<RateLimitSnapshot> {
    const path =
      this.pathStyle === PathStyle.CodexApi
        ? "/api/codex/usage"
        : "/wham/usage";
    const url = `${this.baseUrl}${path}`;

    const payload = await this.execRequest<RateLimitStatusPayload>("GET", url);
    return rateLimitSnapshotFromPayload(payload);
  }

  /**
   * List tasks
   */
  async listTasks(options?: {
    limit?: number;
    taskFilter?: string;
    environmentId?: string;
  }): Promise<PaginatedListTaskListItem> {
    const path =
      this.pathStyle === PathStyle.CodexApi
        ? "/api/codex/tasks/list"
        : "/wham/tasks/list";
    const url = `${this.baseUrl}${path}`;

    const query: Record<string, string | number> = {};
    if (options?.limit !== undefined) query.limit = options.limit;
    if (options?.taskFilter) query.task_filter = options.taskFilter;
    if (options?.environmentId) query.environment_id = options.environmentId;

    return this.execRequest<PaginatedListTaskListItem>("GET", url, { query });
  }

  /**
   * Get task details
   */
  async getTaskDetails(taskId: string): Promise<CodeTaskDetailsResponse> {
    const path =
      this.pathStyle === PathStyle.CodexApi
        ? `/api/codex/tasks/${taskId}`
        : `/wham/tasks/${taskId}`;
    const url = `${this.baseUrl}${path}`;

    return this.execRequest<CodeTaskDetailsResponse>("GET", url);
  }

  /**
   * List sibling turns for a turn
   */
  async listSiblingTurns(
    taskId: string,
    turnId: string,
  ): Promise<TurnAttemptsSiblingTurnsResponse> {
    const path =
      this.pathStyle === PathStyle.CodexApi
        ? `/api/codex/tasks/${taskId}/turns/${turnId}/sibling_turns`
        : `/wham/tasks/${taskId}/turns/${turnId}/sibling_turns`;
    const url = `${this.baseUrl}${path}`;

    return this.execRequest<TurnAttemptsSiblingTurnsResponse>("GET", url);
  }

  /**
   * Create a new task
   *
   * @returns The created task ID
   */
  async createTask(requestBody: Record<string, unknown>): Promise<string> {
    const path =
      this.pathStyle === PathStyle.CodexApi
        ? "/api/codex/tasks"
        : "/wham/tasks";
    const url = `${this.baseUrl}${path}`;

    const response = await this.execRequest<Record<string, unknown>>(
      "POST",
      url,
      { body: requestBody },
    );

    // Extract id from JSON: prefer `task.id`; fallback to top-level `id`
    const taskId =
      (response.task as Record<string, unknown> | undefined)?.id ?? response.id;

    if (typeof taskId === "string") {
      return taskId;
    }

    throw new Error(
      `POST ${url} succeeded but no task id found; response=${JSON.stringify(response)}`,
    );
  }
}

/**
 * Convert rate limit payload to snapshot
 */
function rateLimitSnapshotFromPayload(
  payload: RateLimitStatusPayload,
): RateLimitSnapshot {
  const details = payload.rate_limit;

  if (!details) {
    return {
      primary: undefined,
      secondary: undefined,
    };
  }

  return {
    primary: mapRateLimitWindow(details.primary_window),
    secondary: mapRateLimitWindow(details.secondary_window),
  };
}

/**
 * Map rate limit window snapshot to protocol window
 */
function mapRateLimitWindow(
  window:
    | { used_percent: number; limit_window_seconds: number; reset_at: number }
    | null
    | undefined,
): RateLimitWindow | undefined {
  if (!window) return undefined;

  const usedPercent = window.used_percent;
  const windowMinutes = windowMinutesFromSeconds(window.limit_window_seconds);
  const resetsAt = window.reset_at;

  return {
    usedPercent,
    windowMinutes,
    resetsAt,
  };
}

/**
 * Convert seconds to minutes (rounded up)
 */
function windowMinutesFromSeconds(seconds: number): number | undefined {
  if (seconds <= 0) return undefined;
  return Math.ceil(seconds / 60);
}
