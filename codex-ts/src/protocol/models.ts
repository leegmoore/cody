/**
 * Model response and request types for the Codex protocol.
 *
 * Defines types for model interactions including messages, tool calls,
 * function calls, reasoning outputs, and various response item types.
 *
 * Ported from: codex-rs/protocol/src/models.rs
 */

import type { UserInput } from './items.js';

/**
 * Content item within a message.
 *
 * Represents text or image content in user/agent messages.
 */
export type ContentItem =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'output_text'; text: string };

/**
 * Response input item types.
 *
 * Items that can be sent as input to the model in a response context.
 */
export type ResponseInputItem =
  | {
      type: 'message';
      role: string;
      content: ContentItem[];
    }
  | {
      type: 'function_call_output';
      call_id: string;
      output: FunctionCallOutputPayload;
    }
  | {
      type: 'mcp_tool_call_output';
      call_id: string;
      result: CallToolResult | { error: string };
    }
  | {
      type: 'custom_tool_call_output';
      call_id: string;
      output: string;
    };

/**
 * Local shell execution status.
 */
export type LocalShellStatus = 'completed' | 'in_progress' | 'incomplete';

/**
 * Local shell execution action details.
 */
export interface LocalShellExecAction {
  /** Command to execute as an array of strings */
  command: string[];
  /** Optional timeout in milliseconds */
  timeout_ms?: number;
  /** Optional working directory */
  working_directory?: string;
  /** Optional environment variables */
  env?: Record<string, string>;
  /** Optional user to run as */
  user?: string;
}

/**
 * Local shell action types.
 */
export type LocalShellAction = {
  type: 'exec';
} & LocalShellExecAction;

/**
 * Web search action types.
 */
export type WebSearchAction =
  | { type: 'search'; query: string }
  | { type: 'other' };

/**
 * Reasoning item summary content.
 */
export type ReasoningItemReasoningSummary = {
  type: 'summary_text';
  text: string;
};

/**
 * Reasoning item content types.
 */
export type ReasoningItemContent =
  | { type: 'reasoning_text'; text: string }
  | { type: 'text'; text: string };

/**
 * Ghost commit information for tracking uncommitted changes.
 */
export interface GhostCommit {
  /** Commit ID */
  id: string;
  /** Parent commit ID if any */
  parent?: string;
  /** Pre-existing untracked files */
  preexisting_untracked_files: string[];
  /** Pre-existing untracked directories */
  preexisting_untracked_dirs: string[];
}

/**
 * Response item types.
 *
 * Represents various types of items that can appear in model responses.
 */
export type ResponseItem =
  | {
      type: 'message';
      /** Optional ID (not serialized, internal use only) */
      id?: string;
      role: string;
      content: ContentItem[];
    }
  | {
      type: 'reasoning';
      /** ID (not serialized, internal use only) */
      id?: string;
      summary: ReasoningItemReasoningSummary[];
      /** Optional content (conditionally serialized) */
      content?: ReasoningItemContent[];
      encrypted_content?: string;
    }
  | {
      type: 'local_shell_call';
      /** Optional ID (chat completions API) */
      id?: string;
      /** Optional call_id (responses API) */
      call_id?: string;
      status: LocalShellStatus;
      action: LocalShellAction;
    }
  | {
      type: 'function_call';
      /** Optional ID (not serialized, internal use only) */
      id?: string;
      name: string;
      /** Arguments as JSON string */
      arguments: string;
      call_id: string;
    }
  | {
      type: 'function_call_output';
      call_id: string;
      output: FunctionCallOutputPayload;
    }
  | {
      type: 'custom_tool_call';
      /** Optional ID (not serialized, internal use only) */
      id?: string;
      /** Optional status */
      status?: string;
      call_id: string;
      name: string;
      /** Input as JSON string */
      input: string;
    }
  | {
      type: 'custom_tool_call_output';
      call_id: string;
      output: string;
    }
  | {
      type: 'web_search_call';
      /** Optional ID (not serialized, internal use only) */
      id?: string;
      /** Optional status */
      status?: string;
      action: WebSearchAction;
    }
  | {
      type: 'ghost_snapshot';
      ghost_commit: GhostCommit;
    }
  | {
      type: 'other';
    };

/**
 * Shell tool call parameters.
 *
 * Parameters for shell execution tool calls (container.exec or shell).
 */
export interface ShellToolCallParams {
  /** Command to execute as an array */
  command: string[];
  /** Optional working directory */
  workdir?: string;
  /** Optional timeout in milliseconds */
  timeout_ms?: number;
  /** Whether to run with escalated permissions */
  with_escalated_permissions?: boolean;
  /** Justification for the command */
  justification?: string;
}

/**
 * Function call output content item types.
 *
 * Content items that can be returned by tool calls.
 */
export type FunctionCallOutputContentItem =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string };

/**
 * MCP CallToolResult structure (simplified).
 *
 * Result from an MCP tool call.
 */
export interface CallToolResult {
  /** Content blocks from the tool */
  content: ContentBlock[];
  /** Optional structured content */
  structured_content?: unknown;
  /** Whether this is an error */
  is_error?: boolean;
}

/**
 * MCP Content block types.
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mime_type: string }
  | { type: 'resource'; uri: string; text?: string; mime_type?: string }
  | { type: 'embedded_resource'; content: string; mime_type?: string };

/**
 * Function call output payload.
 *
 * The payload sent back to the model when reporting a tool call result.
 * Serializes differently based on whether content_items are present.
 */
export interface FunctionCallOutputPayload {
  /** Plain string content */
  content: string;
  /** Optional structured content items */
  content_items?: FunctionCallOutputContentItem[];
  /** Optional success flag */
  success?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a ResponseInputItem to a ResponseItem.
 */
export function responseInputItemToResponseItem(
  item: ResponseInputItem
): ResponseItem {
  switch (item.type) {
    case 'message':
      return {
        type: 'message',
        role: item.role,
        content: item.content,
        id: undefined,
      };
    case 'function_call_output':
      return {
        type: 'function_call_output',
        call_id: item.call_id,
        output: item.output,
      };
    case 'mcp_tool_call_output': {
      const output =
        'error' in item.result
          ? {
              content: `err: ${item.result.error}`,
              success: false,
            }
          : callToolResultToOutputPayload(item.result);
      return {
        type: 'function_call_output',
        call_id: item.call_id,
        output,
      };
    }
    case 'custom_tool_call_output':
      return {
        type: 'custom_tool_call_output',
        call_id: item.call_id,
        output: item.output,
      };
  }
}

/**
 * Convert UserInput array to ResponseInputItem message.
 */
export function userInputToResponseInputItem(
  inputs: UserInput[]
): ResponseInputItem {
  return {
    type: 'message',
    role: 'user',
    content: inputs.map((input) => {
      switch (input.type) {
        case 'text':
          return { type: 'input_text', text: input.text };
        case 'image':
          return { type: 'input_image', image_url: input.image_url };
        case 'local_image':
          // In a real implementation, this would load and convert the image
          // For now, just return a placeholder
          return {
            type: 'input_text',
            text: `[Local image: ${input.path}]`,
          };
      }
    }),
  };
}

/**
 * Convert CallToolResult to FunctionCallOutputPayload.
 */
export function callToolResultToOutputPayload(
  result: CallToolResult
): FunctionCallOutputPayload {
  const isSuccess = result.is_error !== true;

  // Handle structured_content if present
  if (result.structured_content != null) {
    return {
      content: JSON.stringify(result.structured_content),
      success: isSuccess,
    };
  }

  // Convert content blocks
  const contentItems = convertContentBlocksToItems(result.content);
  const serializedContent = JSON.stringify(result.content);

  return {
    content: serializedContent,
    content_items: contentItems,
    success: isSuccess,
  };
}

/**
 * Convert MCP content blocks to function call output items.
 *
 * Returns undefined if no images are present (text-only can use plain string).
 */
function convertContentBlocksToItems(
  blocks: ContentBlock[]
): FunctionCallOutputContentItem[] | undefined {
  let sawImage = false;
  const items: FunctionCallOutputContentItem[] = [];

  for (const block of blocks) {
    if (block.type === 'text') {
      items.push({ type: 'input_text', text: block.text });
    } else if (block.type === 'image') {
      sawImage = true;
      // Ensure data URL format
      const imageUrl = block.data.startsWith('data:')
        ? block.data
        : `data:${block.mime_type};base64,${block.data}`;
      items.push({ type: 'input_image', image_url: imageUrl });
    } else {
      // Unsupported block type (audio, resource, etc.)
      return undefined;
    }
  }

  return sawImage ? items : undefined;
}

/**
 * Serialize FunctionCallOutputPayload to JSON-compatible format.
 *
 * The Responses API expects different shapes:
 * - If content_items present: serialize as array
 * - Otherwise: serialize as plain string
 */
export function serializeFunctionCallOutputPayload(
  payload: FunctionCallOutputPayload
): string | FunctionCallOutputContentItem[] {
  if (payload.content_items) {
    return payload.content_items;
  }
  return payload.content;
}

/**
 * Deserialize FunctionCallOutputPayload from JSON-compatible format.
 */
export function deserializeFunctionCallOutputPayload(
  data: string | FunctionCallOutputContentItem[]
): FunctionCallOutputPayload {
  if (typeof data === 'string') {
    return {
      content: data,
      success: undefined,
    };
  } else {
    // Array of items
    return {
      content: JSON.stringify(data),
      content_items: data,
      success: undefined,
    };
  }
}

/**
 * Check if reasoning content should be serialized.
 *
 * Content is skipped if it contains no reasoning_text items.
 */
export function shouldSerializeReasoningContent(
  content?: ReasoningItemContent[]
): boolean {
  if (!content) return false;
  return content.some((c) => c.type === 'reasoning_text');
}
