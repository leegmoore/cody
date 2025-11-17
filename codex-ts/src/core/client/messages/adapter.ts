/**
 * Streaming adapter for Anthropic Messages API
 *
 * Converts Anthropic SSE events into Codex ResponseEvent format.
 * Maintains state for text buffering, tool tracking, and usage aggregation.
 *
 * Design reference: MESSAGES_API_INTEGRATION_DESIGN_CODEX.md Section 2.3, 2.4
 */

import type { AnthropicSseEvent } from "./types.js";
import type { ResponseEvent } from "../client-common.js";
import type { ResponseItem } from "../../../protocol/models.js";
import type { TokenUsage } from "../../../protocol/protocol.js";

/**
 * Content block state tracker
 */
interface BlockState {
  type: "text" | "thinking" | "tool_use";
  index: number;
  // For text/thinking blocks
  buffer?: string;
  // For tool blocks
  toolUseId?: string;
  toolName?: string;
  toolInputFragments?: string[];
}

/**
 * Adapter state for streaming conversion
 */
class AdapterState {
  responseId: string | null = null;
  blocks: Map<number, BlockState> = new Map();
  completedBlocks: Set<number> = new Set();
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
  } = {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
  };
  hasEmittedCreated: boolean = false;
  hasEmittedCompleted: boolean = false;

  reset() {
    this.responseId = null;
    this.blocks.clear();
    this.completedBlocks.clear();
    this.usage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };
    this.hasEmittedCreated = false;
    this.hasEmittedCompleted = false;
  }
}

/**
 * Adapt Anthropic SSE events to Codex ResponseEvent stream.
 *
 * This async generator consumes Anthropic events and yields ResponseEvent objects
 * that conform to the Codex protocol.
 *
 * @param events - Iterable of Anthropic SSE events (can be async iterable or array)
 * @yields ResponseEvent objects
 */
export async function* adaptAnthropicStream(
  events: Iterable<AnthropicSseEvent> | AsyncIterable<AnthropicSseEvent>,
): AsyncGenerator<ResponseEvent, void, unknown> {
  const state = new AdapterState();

  for await (const event of events) {
    // Yield events from processing this SSE event
    for (const responseEvent of processEvent(event, state)) {
      yield responseEvent;
    }
  }
}

/**
 * Process a single Anthropic SSE event and generate ResponseEvent(s).
 *
 * @param event - Anthropic SSE event
 * @param state - Current adapter state
 * @returns Array of ResponseEvent objects to emit
 */
function* processEvent(
  event: AnthropicSseEvent,
  state: AdapterState,
): Generator<ResponseEvent> {
  switch (event.type) {
    case "message_start":
      // Initialize new message
      state.reset();
      state.responseId = event.message.id;
      state.usage.inputTokens = event.message.usage?.input_tokens ?? 0;
      state.usage.outputTokens = event.message.usage?.output_tokens ?? 0;

      // Emit Created event once
      if (!state.hasEmittedCreated) {
        state.hasEmittedCreated = true;
        yield { type: "created" };
      }
      break;

    case "content_block_start": {
      // Start tracking new content block
      const blockType = event.content_block.type;
      const blockState: BlockState = {
        type: blockType as "text" | "thinking" | "tool_use",
        index: event.index,
      };

      if (blockType === "text" || blockType === "thinking") {
        blockState.buffer = "";
      } else if (blockType === "tool_use") {
        blockState.toolUseId = event.content_block.id;
        blockState.toolName = event.content_block.name;
        blockState.toolInputFragments = [];
      }

      state.blocks.set(event.index, blockState);
      break;
    }

    case "content_block_delta": {
      // Accumulate delta content
      const block = state.blocks.get(event.index);
      if (!block) {
        break;
      }

      if (event.delta.type === "text_delta") {
        block.buffer = (block.buffer || "") + event.delta.text;
        // Emit text delta
        yield { type: "output_text_delta", delta: event.delta.text };
      } else if (event.delta.type === "thinking_delta") {
        block.buffer = (block.buffer || "") + event.delta.thinking;
        // Emit reasoning delta
        yield { type: "reasoning_content_delta", delta: event.delta.thinking };
      } else if (event.delta.type === "input_json_delta") {
        block.toolInputFragments = block.toolInputFragments || [];
        block.toolInputFragments.push(event.delta.partial_json);
      }
      break;
    }

    case "content_block_stop": {
      // Finalize content block and emit item
      const completedBlock = state.blocks.get(event.index);
      if (!completedBlock || state.completedBlocks.has(event.index)) {
        break;
      }

      state.completedBlocks.add(event.index);

      if (completedBlock.type === "text") {
        // Emit text message item
        const item: ResponseItem = {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: completedBlock.buffer || "",
            },
          ],
        };
        yield { type: "output_item_added", item };
      } else if (completedBlock.type === "thinking") {
        // Emit reasoning summary part added
        yield { type: "reasoning_summary_part_added" };
      } else if (completedBlock.type === "tool_use") {
        // Emit tool call item following custom_tool_call contract
        let toolInput = "{}";
        if (
          completedBlock.toolInputFragments &&
          completedBlock.toolInputFragments.length > 0
        ) {
          const joined = completedBlock.toolInputFragments.join("");
          toolInput = joined.trim() ? joined : "{}";
        }

        const item: ResponseItem = {
          type: "custom_tool_call",
          call_id: completedBlock.toolUseId || "",
          name: completedBlock.toolName || "",
          input: toolInput,
        };
        yield { type: "output_item_added", item };
      }
      break;
    }

    case "message_delta":
      // Update usage from delta
      if (event.usage) {
        if (event.usage.output_tokens !== undefined) {
          state.usage.outputTokens = event.usage.output_tokens;
        }
        if (event.usage.reasoning_tokens !== undefined) {
          state.usage.reasoningTokens = event.usage.reasoning_tokens;
        }
      }
      break;

    case "message_stop": {
      // Emit completion event
      if (!state.hasEmittedCompleted) {
        state.hasEmittedCompleted = true;

        const tokenUsage: TokenUsage = {
          input_tokens: state.usage.inputTokens,
          cached_input_tokens: 0,
          output_tokens: state.usage.outputTokens,
          reasoning_tokens: state.usage.reasoningTokens,
        };

        yield {
          type: "completed",
          responseId: state.responseId || "unknown",
          tokenUsage,
        };
      }
      break;
    }

    case "ping":
      // Ignore ping events (keep-alive)
      break;

    case "error":
      // Error events are handled but don't crash the stream
      console.error("[adapter] Anthropic error event:", event.error);
      break;

    default:
      // Unknown event type
      console.warn(
        "[adapter] Unknown event type:",
        (event as unknown as { type: string }).type,
      );
      break;
  }
}
