/**
 * Conversation history management.
 * Ported from codex-rs/core/src/conversation_history.rs
 *
 * Manages conversation transcript with deduplication, normalization,
 * and output truncation for model context.
 */

import type {
  ResponseItem,
  FunctionCallOutputContentItem,
} from "../../protocol/models";
import type { TokenUsage, TokenUsageInfo } from "../../protocol/protocol";
import {
  takeBytesAtCharBoundary,
  takeLastBytesAtCharBoundary,
} from "../../utils/string";
import {
  newOrAppendTokenUsage,
  fillToContextWindow,
  fullContextWindow,
} from "./utils";

// Model-formatting limits: clients get full streams; only content sent to the model is truncated.
export const MODEL_FORMAT_MAX_BYTES = 10 * 1024; // 10 KiB
export const MODEL_FORMAT_MAX_LINES = 256; // lines
export const MODEL_FORMAT_HEAD_LINES = MODEL_FORMAT_MAX_LINES / 2;
export const MODEL_FORMAT_TAIL_LINES =
  MODEL_FORMAT_MAX_LINES - MODEL_FORMAT_HEAD_LINES; // 128
export const MODEL_FORMAT_HEAD_BYTES = MODEL_FORMAT_MAX_BYTES / 2;

/**
 * Transcript of conversation history.
 * Items are ordered from oldest to newest.
 */
export class ConversationHistory {
  private items: ResponseItem[] = [];
  private tokenInfo: TokenUsageInfo | undefined = undefined;

  constructor() {
    this.tokenInfo = undefined;
  }

  /**
   * Get current token usage information.
   */
  getTokenInfo(): TokenUsageInfo | undefined {
    return this.tokenInfo;
  }

  /**
   * Set token usage to indicate full context window used.
   */
  setTokenUsageFull(contextWindow: number): void {
    if (this.tokenInfo) {
      fillToContextWindow(this.tokenInfo, contextWindow);
    } else {
      this.tokenInfo = fullContextWindow(contextWindow);
    }
  }

  /**
   * Record items in conversation history.
   * Items are ordered from oldest to newest.
   */
  recordItems(items: ResponseItem[]): void {
    for (const item of items) {
      const isGhostSnapshot = item.type === "ghost_snapshot";
      if (!isApiMessage(item) && !isGhostSnapshot) {
        continue;
      }

      const processed = this.processItem(item);
      this.items.push(processed);
    }
  }

  /**
   * Get conversation history with normalization applied.
   */
  getHistory(): ResponseItem[] {
    this.normalizeHistory();
    return [...this.items];
  }

  /**
   * Get history prepared for sending to the model.
   * Filters out extra response items and removes GhostSnapshots.
   */
  getHistoryForPrompt(): ResponseItem[] {
    const history = this.getHistory();
    return this.removeGhostSnapshots(history);
  }

  /**
   * Remove the oldest item from history.
   * Also removes any paired item (e.g., call/output pair).
   */
  removeFirstItem(): void {
    if (this.items.length === 0) return;

    const removed = this.items.shift();
    if (!removed) return;

    // If the removed item participates in a call/output pair, also remove
    // its corresponding counterpart to keep invariants intact.
    this.removeCorrespondingFor(removed);
  }

  /**
   * Replace entire history with new items.
   */
  replace(items: ResponseItem[]): void {
    this.items = items;
  }

  /**
   * Update token usage information with new usage data.
   */
  updateTokenInfo(usage: TokenUsage, modelContextWindow?: number): void {
    this.tokenInfo = newOrAppendTokenUsage(
      this.tokenInfo,
      usage,
      modelContextWindow,
    );
  }

  /**
   * Normalize history by ensuring call/output pairs are consistent.
   * Enforces two invariants:
   * 1. Every call (function/custom) has a corresponding output entry
   * 2. Every output has a corresponding call entry
   */
  private normalizeHistory(): void {
    // All function/tool calls must have corresponding outputs
    this.ensureCallOutputsPresent();

    // All outputs must have corresponding function/tool calls
    this.removeOrphanOutputs();
  }

  /**
   * Ensure all tool calls have corresponding outputs.
   * Missing outputs are synthesized with "aborted" message.
   */
  private ensureCallOutputsPresent(): void {
    // Collect synthetic outputs to insert immediately after their calls
    const missingOutputsToInsert: Array<{ index: number; item: ResponseItem }> =
      [];

    for (let idx = 0; idx < this.items.length; idx++) {
      const item = this.items[idx];

      if (item.type === "function_call") {
        const hasOutput = this.items.some(
          (i) =>
            i.type === "function_call_output" && i.call_id === item.call_id,
        );

        if (!hasOutput) {
          console.warn(
            `Function call output is missing for call id: ${item.call_id}`,
          );
          missingOutputsToInsert.push({
            index: idx,
            item: {
              type: "function_call_output",
              call_id: item.call_id,
              output: { content: "aborted" },
            },
          });
        }
      } else if (item.type === "custom_tool_call") {
        const hasOutput = this.items.some(
          (i) =>
            i.type === "custom_tool_call_output" && i.call_id === item.call_id,
        );

        if (!hasOutput) {
          console.warn(
            `Custom tool call output is missing for call id: ${item.call_id}`,
          );
          missingOutputsToInsert.push({
            index: idx,
            item: {
              type: "custom_tool_call_output",
              call_id: item.call_id,
              output: "aborted",
            },
          });
        }
      } else if (item.type === "local_shell_call" && item.call_id) {
        const hasOutput = this.items.some(
          (i) =>
            i.type === "function_call_output" && i.call_id === item.call_id,
        );

        if (!hasOutput) {
          console.warn(
            `Local shell call output is missing for call id: ${item.call_id}`,
          );
          missingOutputsToInsert.push({
            index: idx,
            item: {
              type: "function_call_output",
              call_id: item.call_id,
              output: { content: "aborted" },
            },
          });
        }
      }
    }

    // Insert from end to avoid shifting indices
    missingOutputsToInsert.sort((a, b) => b.index - a.index);
    for (const { index, item } of missingOutputsToInsert) {
      const insertPos = index + 1; // place immediately after the call
      this.items.splice(insertPos, 0, item);
    }
  }

  /**
   * Remove outputs that don't have corresponding calls.
   */
  private removeOrphanOutputs(): void {
    const orphanCallIds = new Set<string>();

    for (const item of this.items) {
      if (item.type === "function_call_output") {
        const hasCall = this.items.some(
          (i) =>
            (i.type === "function_call" && i.call_id === item.call_id) ||
            (i.type === "local_shell_call" && i.call_id === item.call_id),
        );

        if (!hasCall) {
          console.warn(`Function call is missing for call id: ${item.call_id}`);
          orphanCallIds.add(item.call_id);
        }
      } else if (item.type === "custom_tool_call_output") {
        const hasCall = this.items.some(
          (i) => i.type === "custom_tool_call" && i.call_id === item.call_id,
        );

        if (!hasCall) {
          console.warn(
            `Custom tool call is missing for call id: ${item.call_id}`,
          );
          orphanCallIds.add(item.call_id);
        }
      }
    }

    if (orphanCallIds.size > 0) {
      this.items = this.items.filter((item) => {
        if (
          item.type === "function_call_output" ||
          item.type === "custom_tool_call_output"
        ) {
          return !orphanCallIds.has(item.call_id);
        }
        return true;
      });
    }
  }

  /**
   * Remove the corresponding paired item for the provided item, if any.
   * Pairs: FunctionCall <-> FunctionCallOutput, CustomToolCall <-> CustomToolCallOutput, etc.
   */
  private removeCorrespondingFor(item: ResponseItem): void {
    if (item.type === "function_call") {
      this.removeFirstMatching(
        (i) => i.type === "function_call_output" && i.call_id === item.call_id,
      );
    } else if (item.type === "custom_tool_call") {
      this.removeFirstMatching(
        (i) =>
          i.type === "custom_tool_call_output" && i.call_id === item.call_id,
      );
    } else if (item.type === "local_shell_call" && item.call_id) {
      this.removeFirstMatching(
        (i) => i.type === "function_call_output" && i.call_id === item.call_id,
      );
    } else if (item.type === "function_call_output") {
      this.removeFirstMatching(
        (i) =>
          (i.type === "function_call" && i.call_id === item.call_id) ||
          (i.type === "local_shell_call" && i.call_id === item.call_id),
      );
    } else if (item.type === "custom_tool_call_output") {
      this.removeFirstMatching(
        (i) => i.type === "custom_tool_call" && i.call_id === item.call_id,
      );
    }
  }

  /**
   * Remove first item matching predicate.
   */
  private removeFirstMatching(
    predicate: (item: ResponseItem) => boolean,
  ): void {
    const pos = this.items.findIndex(predicate);
    if (pos !== -1) {
      this.items.splice(pos, 1);
    }
  }

  /**
   * Process item for storage (truncate outputs if needed).
   */
  private processItem(item: ResponseItem): ResponseItem {
    if (item.type === "function_call_output") {
      const truncated = formatOutputForModelBody(item.output.content ?? "");
      const truncatedItems = item.output.content_items
        ? globallyTruncateFunctionOutputItems(item.output.content_items)
        : undefined;

      return {
        type: "function_call_output",
        call_id: item.call_id,
        output: {
          content: truncated,
          content_items: truncatedItems,
          success: item.output.success,
        },
      };
    } else if (item.type === "custom_tool_call_output") {
      const truncated = formatOutputForModelBody(item.output);
      return {
        type: "custom_tool_call_output",
        call_id: item.call_id,
        output: truncated,
      };
    }

    // For all other types, return as-is
    return item;
  }

  /**
   * Remove ghost snapshots from history.
   */
  private removeGhostSnapshots(items: ResponseItem[]): ResponseItem[] {
    return items.filter((item) => item.type !== "ghost_snapshot");
  }
}

/**
 * Truncate function output items to fit within byte budget.
 */
function globallyTruncateFunctionOutputItems(
  items: FunctionCallOutputContentItem[],
): FunctionCallOutputContentItem[] {
  const out: FunctionCallOutputContentItem[] = [];
  let remaining = MODEL_FORMAT_MAX_BYTES;
  let omittedTextItems = 0;

  for (const it of items) {
    if (it.type === "input_text") {
      if (remaining === 0) {
        omittedTextItems++;
        continue;
      }

      const len = it.text.length;
      if (len <= remaining) {
        out.push({ type: "input_text", text: it.text });
        remaining -= len;
      } else {
        const slice = takeBytesAtCharBoundary(it.text, remaining);
        if (slice.length > 0) {
          out.push({ type: "input_text", text: slice });
        }
        remaining = 0;
      }
    } else if (it.type === "input_image") {
      out.push({ type: "input_image", image_url: it.image_url });
    }
  }

  if (omittedTextItems > 0) {
    out.push({
      type: "input_text",
      text: `[omitted ${omittedTextItems} text items ...]`,
    });
  }

  return out;
}

/**
 * Format output for model context with truncation.
 * Shows beginning and end with elision marker if truncated.
 */
export function formatOutputForModelBody(content: string): string {
  const totalLines = content.split("\n").length;
  if (
    content.length <= MODEL_FORMAT_MAX_BYTES &&
    totalLines <= MODEL_FORMAT_MAX_LINES
  ) {
    return content;
  }

  const output = truncateFormattedExecOutput(content, totalLines);
  return `Total output lines: ${totalLines}\n\n${output}`;
}

/**
 * Truncate formatted exec output with head and tail.
 */
function truncateFormattedExecOutput(
  content: string,
  totalLines: number,
): string {
  const segments = content.split("\n").map((line) => line + "\n");
  const headTake = Math.min(MODEL_FORMAT_HEAD_LINES, segments.length);
  const tailTake = Math.min(
    MODEL_FORMAT_TAIL_LINES,
    Math.max(0, segments.length - headTake),
  );
  const omitted = Math.max(0, segments.length - headTake - tailTake);

  const headSliceEnd = segments.slice(0, headTake).join("").length;
  const tailSliceStart =
    tailTake === 0
      ? content.length
      : content.length - segments.slice(-tailTake).join("").length;

  const headSlice = content.substring(0, headSliceEnd);
  const tailSlice = content.substring(tailSliceStart);
  const truncatedByBytes = content.length > MODEL_FORMAT_MAX_BYTES;

  let marker: string | undefined;
  if (omitted > 0) {
    marker = `\n[... omitted ${omitted} of ${totalLines} lines ...]\n\n`;
  } else if (truncatedByBytes) {
    marker = `\n[... output truncated to fit ${MODEL_FORMAT_MAX_BYTES} bytes ...]\n\n`;
  }

  const markerLen = marker ? marker.length : 0;
  const baseHeadBudget = Math.min(
    MODEL_FORMAT_HEAD_BYTES,
    MODEL_FORMAT_MAX_BYTES,
  );
  const headBudget = Math.min(
    baseHeadBudget,
    Math.max(0, MODEL_FORMAT_MAX_BYTES - markerLen),
  );
  const headPart = takeBytesAtCharBoundary(headSlice, headBudget);

  let result = headPart;
  if (marker) {
    result += marker;
  }

  const remaining = Math.max(0, MODEL_FORMAT_MAX_BYTES - result.length);
  if (remaining === 0) {
    return result;
  }

  const tailPart = takeLastBytesAtCharBoundary(tailSlice, remaining);
  result += tailPart;

  return result;
}

/**
 * Check if message is an API message (non-system).
 */
function isApiMessage(message: ResponseItem): boolean {
  if (message.type === "message") {
    return message.role !== "system";
  }

  return (
    message.type === "function_call_output" ||
    message.type === "function_call" ||
    message.type === "custom_tool_call" ||
    message.type === "custom_tool_call_output" ||
    message.type === "local_shell_call" ||
    message.type === "reasoning" ||
    message.type === "web_search_call"
  );
}
