/**
 * Strategy pattern interface for conversation history management.
 *
 * This interface allows for multiple history storage and retrieval strategies:
 * - Phase 5.1: RegularHistoryStrategy (full fidelity, filesystem JSONL)
 * - Phase 7: GradientHistoryStrategy (multi-level compression, database)
 * - Future: OneShotHistoryStrategy (epic + log file pattern)
 */

import type { ResponseItem } from "../../protocol/models";
import type { TurnItem } from "../../protocol/items";

/**
 * Token budget for history retrieval.
 */
export interface TokenBudget {
  /** Maximum tokens allowed for history */
  maxTokens: number;
  /** Reserved tokens for system prompts, tools, etc. */
  reservedTokens?: number;
}

/**
 * Statistics about conversation history.
 */
export interface HistoryStats {
  /** Total number of turns */
  turnCount: number;
  /** Total number of items across all turns */
  itemCount: number;
  /** Estimated token count (if available) */
  tokenCount?: number;
}

/**
 * Fidelity level for turn retrieval (for gradient compression in Phase 7).
 */
export enum FidelityLevel {
  /** Full detail - original turn content */
  Full = "full",
  /** High compression - key points preserved */
  High = "high",
  /** Medium compression - summary level */
  Medium = "medium",
  /** Low compression - minimal context */
  Low = "low",
}

/**
 * Content of a turn at a specific fidelity level.
 */
export interface TurnContent {
  /** Turn identifier */
  turnId: string;
  /** Fidelity level of this content */
  fidelity: FidelityLevel;
  /** Turn items at this fidelity */
  items: TurnItem[];
}

/**
 * Strategy interface for conversation history management.
 *
 * Implementations of this interface handle storage, retrieval, and
 * management of conversation history in different ways.
 */
export interface HistoryStrategy {
  /**
   * Record items from a turn in conversation history.
   *
   * @param items - Response items to record
   */
  recordItems(items: ResponseItem[]): Promise<void>;

  /**
   * Get conversation history within a token budget.
   *
   * Returns items suitable for inclusion in model context, respecting
   * the token budget. May truncate or compress history as needed.
   *
   * @param budget - Token budget for history
   * @returns Array of response items to include in prompt
   */
  getHistory(budget: TokenBudget): Promise<ResponseItem[]>;

  /**
   * Get a specific turn at a requested fidelity level.
   *
   * Optional method for strategies that support multi-level compression.
   *
   * @param turnId - Identifier of the turn to retrieve
   * @param level - Desired fidelity level
   * @returns Turn content at requested fidelity, or undefined if not found
   */
  getTurn?(
    turnId: string,
    level: FidelityLevel,
  ): Promise<TurnContent | undefined>;

  /**
   * Get statistics about the conversation history.
   *
   * @returns Current history statistics
   */
  getStats(): HistoryStats;

  /**
   * Clear all conversation history.
   */
  clear(): Promise<void>;
}
