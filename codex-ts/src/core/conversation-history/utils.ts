/**
 * Utility functions for token usage tracking.
 * Ported from codex-rs/protocol/src/protocol.rs
 */

import type { TokenUsage, TokenUsageInfo } from "../../protocol/protocol";

/**
 * Creates a new TokenUsageInfo or appends to an existing one.
 *
 * @param existing - Existing token usage info
 * @param newUsage - New token usage to append
 * @param contextWindow - Model context window size
 * @returns Updated token usage info
 */
export function newOrAppendTokenUsage(
  existing: TokenUsageInfo | undefined,
  newUsage: TokenUsage | undefined,
  contextWindow: number | undefined,
): TokenUsageInfo | undefined {
  if (!newUsage) {
    return existing;
  }

  if (!existing) {
    return {
      total_token_usage: newUsage,
      last_token_usage: newUsage,
      model_context_window: contextWindow,
    };
  }

  return {
    total_token_usage: {
      input_tokens:
        existing.total_token_usage.input_tokens + newUsage.input_tokens,
      cached_input_tokens:
        existing.total_token_usage.cached_input_tokens +
        newUsage.cached_input_tokens,
      output_tokens:
        existing.total_token_usage.output_tokens + newUsage.output_tokens,
      reasoning_tokens:
        existing.total_token_usage.reasoning_tokens + newUsage.reasoning_tokens,
    },
    last_token_usage: newUsage,
    model_context_window: contextWindow ?? existing.model_context_window,
  };
}

/**
 * Marks token usage as filling the entire context window.
 *
 * @param info - Token usage info to modify
 * @param contextWindow - Context window size
 */
export function fillToContextWindow(
  info: TokenUsageInfo,
  contextWindow: number,
): void {
  info.total_token_usage.input_tokens = contextWindow;
  info.model_context_window = contextWindow;
}

/**
 * Creates a TokenUsageInfo representing a full context window.
 *
 * @param contextWindow - Context window size
 * @returns TokenUsageInfo with context window filled
 */
export function fullContextWindow(contextWindow: number): TokenUsageInfo {
  return {
    total_token_usage: {
      input_tokens: contextWindow,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_tokens: 0,
    },
    last_token_usage: {
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_tokens: 0,
    },
    model_context_window: contextWindow,
  };
}
