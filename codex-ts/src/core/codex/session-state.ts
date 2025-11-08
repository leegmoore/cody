/**
 * Session state management helpers.
 * Port of state/session.rs
 */

import type { ResponseItem } from "../../protocol/models.js";
import type {
  TokenUsage,
  TokenUsageInfo,
  RateLimitSnapshot,
} from "../../protocol/protocol.js";
import type { SessionConfiguration, SessionState } from "./types.js";
import { ConversationHistory } from "../conversation-history/index.js";

/**
 * Create a new session state.
 */
export function createSessionState(
  sessionConfiguration: SessionConfiguration,
): SessionState {
  return {
    sessionConfiguration,
    history: new ConversationHistory(),
    latestRateLimits: null,
  };
}

/**
 * Record items to conversation history.
 */
export function recordItems(state: SessionState, items: ResponseItem[]): void {
  state.history.recordItems(items);
}

/**
 * Clone the conversation history.
 */
export function cloneHistory(state: SessionState): ConversationHistory {
  const newHistory = new ConversationHistory();
  const items = state.history.getHistory();
  newHistory.replace(items);
  const tokenInf = state.history.getTokenInfo();
  if (tokenInf) {
    // Copy token info by treating it as TokenUsage
    newHistory.updateTokenInfo(tokenInf as unknown as TokenUsage, undefined);
  }
  return newHistory;
}

/**
 * Replace the conversation history.
 */
export function replaceHistory(
  state: SessionState,
  items: ResponseItem[],
): void {
  state.history.replace(items);
}

/**
 * Update token info from usage.
 */
export function updateTokenInfoFromUsage(
  state: SessionState,
  usage: TokenUsage,
  modelContextWindow: number | null,
): void {
  state.history.updateTokenInfo(usage, modelContextWindow ?? undefined);
}

/**
 * Get current token info.
 */
export function tokenInfo(state: SessionState): TokenUsageInfo | null {
  return state.history.getTokenInfo() ?? null;
}

/**
 * Set rate limits.
 */
export function setRateLimits(
  state: SessionState,
  snapshot: RateLimitSnapshot,
): void {
  state.latestRateLimits = snapshot;
}

/**
 * Get token info and rate limits.
 */
export function tokenInfoAndRateLimits(
  state: SessionState,
): [TokenUsageInfo | null, RateLimitSnapshot | null] {
  return [tokenInfo(state), state.latestRateLimits];
}

/**
 * Set token usage to full (context window exceeded).
 */
export function setTokenUsageFull(
  state: SessionState,
  contextWindow: number,
): void {
  state.history.setTokenUsageFull(contextWindow);
}
