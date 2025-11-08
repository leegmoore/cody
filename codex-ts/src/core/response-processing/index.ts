/**
 * Response processing for conversation history.
 * Ported from codex-rs/core/src/response_processing.rs
 *
 * Processes ResponseItems and pairs tool calls with their outputs
 * for recording in conversation history.
 */

import type { ResponseItem, ResponseInputItem } from '../../protocol/models'

/**
 * A processed response item contains both the original item and an optional response
 * that should be sent back to the model.
 */
export interface ProcessedResponseItem {
  /** The response item from the model */
  item: ResponseItem
  /** Optional response to send back to model (e.g., tool call output) */
  response?: ResponseInputItem
}

/**
 * Result of processing response items.
 */
export interface ProcessResult {
  /** Items to send back to the model on next turn */
  responsesToSend: ResponseInputItem[]
  /** Items to record in conversation history */
  itemsToRecord: ResponseItem[]
}

/**
 * Process response items by pairing tool calls with their outputs.
 *
 * Takes processed items (which include both calls and responses) and:
 * 1. Pairs tool calls with their outputs for conversation history
 * 2. Collects responses to send back to the model
 *
 * @param processedItems - Array of processed response items
 * @returns Object with responses to send and items to record
 */
export function processItems(processedItems: ProcessedResponseItem[]): ProcessResult {
  const itemsToRecord: ResponseItem[] = []
  const responsesToSend: ResponseInputItem[] = []

  for (const processed of processedItems) {
    const { item, response } = processed

    // Match the pattern from Rust implementation
    if (item.type === 'message' && item.role === 'assistant' && !response) {
      // Assistant message without a response - record it
      itemsToRecord.push(item)
    } else if (
      item.type === 'local_shell_call' &&
      response?.type === 'function_call_output'
    ) {
      // Local shell call with output - record both
      itemsToRecord.push(item)
      itemsToRecord.push({
        type: 'function_call_output',
        call_id: response.call_id,
        output: response.output,
      })
    } else if (
      item.type === 'function_call' &&
      response?.type === 'function_call_output'
    ) {
      // Function call with output - record both
      itemsToRecord.push(item)
      itemsToRecord.push({
        type: 'function_call_output',
        call_id: response.call_id,
        output: response.output,
      })
    } else if (
      item.type === 'custom_tool_call' &&
      response?.type === 'custom_tool_call_output'
    ) {
      // Custom tool call with output - record both
      itemsToRecord.push(item)
      itemsToRecord.push({
        type: 'custom_tool_call_output',
        call_id: response.call_id,
        output: response.output,
      })
    } else if (item.type === 'reasoning' && !response) {
      // Reasoning output - record it
      itemsToRecord.push(item)
    } else {
      // Log unexpected combinations (in production would use proper logging)
      console.warn('Unexpected response item:', item, 'with response:', response)
    }

    // Collect responses to send back to model
    if (response) {
      responsesToSend.push(response)
    }
  }

  return {
    responsesToSend,
    itemsToRecord,
  }
}

/**
 * Helper to create a ProcessedResponseItem.
 */
export function createProcessedItem(
  item: ResponseItem,
  response?: ResponseInputItem
): ProcessedResponseItem {
  return { item, response }
}
