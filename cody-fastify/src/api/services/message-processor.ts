/**
 * Message Processor
 * 
 * Processes messages asynchronously by consuming Codex events and storing them.
 * 
 * Note: This implementation assumes events are consumed in order. For concurrent
 * submissions to the same conversation, events are filtered by submission ID.
 */

import type { Conversation } from "codex-ts/src/core/conversation.ts";
import type { Event } from "codex-ts/src/protocol/protocol.ts";
import type { EventMsg } from "codex-ts/src/protocol/protocol.ts";
import { clientStreamManager } from "../client-stream/client-stream-manager.js";

/**
 * Process a message submission by consuming events until completion.
 * 
 * This function will keep calling nextEvent() until it receives a task_complete,
 * turn_aborted, or error event for the given submissionId.
 */
export async function processMessage(
  conversation: Conversation,
  submissionId: string,
  turnId: string,
  _conversationId: string,
): Promise<void> {
  // Consume events until we get task_complete or turn_aborted for this submission
  let eventsProcessed = 0;
  const maxEvents = 1000; // Safety limit
  let foundCompletionEvent = false;

  while (eventsProcessed < maxEvents && !foundCompletionEvent) {
    try {
      const event: Event = await conversation.nextEvent();
      eventsProcessed++;

      // Only process events for this submission
      if (event.id !== submissionId) {
        // This event belongs to a different submission
        // In a production system, we'd need a more sophisticated event router
        // For now, we'll skip it and continue waiting for our submission's events
        // Note: This means if multiple submissions are concurrent, events might
        // be processed out of order, but each turn will only get its own events
        continue;
      }

      // Add event to turn store FIRST, before checking if we should break
      // This ensures all events (including tool events and errors) are stored
      await clientStreamManager.addEvent(turnId, event.msg);
      await handleToolFailureEvent(turnId, event.msg);

      // Update turn status for error events
      if (event.msg.type === "error") {
        await clientStreamManager.updateTurnStatus(turnId, "error");
      }

      // Check if turn is complete - break AFTER storing the event
      if (
        event.msg.type === "task_complete" ||
        event.msg.type === "turn_aborted"
      ) {
        foundCompletionEvent = true;
        // Don't break immediately - let the loop check foundCompletionEvent
        // This ensures we've fully processed the completion event
      }
    } catch (error) {
      // Handle errors - store error event before breaking
      await clientStreamManager.addEvent(turnId, {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      await clientStreamManager.updateTurnStatus(turnId, "error");
      foundCompletionEvent = true;
    }
  }

  if (eventsProcessed >= maxEvents && !foundCompletionEvent) {
    await clientStreamManager.addEvent(turnId, {
      type: "error",
      message: "Maximum event limit reached",
    });
    await clientStreamManager.updateTurnStatus(turnId, "error");
  }

  // Ensure turn status is updated if we didn't get a completion event
  const turn = await clientStreamManager.getTurn(turnId);
  if (turn && turn.status === "running" && foundCompletionEvent) {
    // If we found a completion event but status wasn't updated, update it
    if (!turn.completedAt) {
      await clientStreamManager.updateTurnStatus(turnId, "completed");
    }
  }
}

async function handleToolFailureEvent(
  turnId: string,
  msg: EventMsg,
): Promise<void> {
  if (
    msg.type === "raw_response_item" &&
    msg.item?.type === "function_call_output" &&
    msg.item.output?.success === false
  ) {
    const errorMessage =
      typeof msg.item.output.content === "string"
        ? msg.item.output.content
        : JSON.stringify(msg.item.output.content);

    await clientStreamManager.addEvent(turnId, {
      type: "error",
      message: errorMessage,
    });

    await clientStreamManager.addEvent(turnId, {
      type: "turn_aborted",
      reason: "replaced",
    });
  }
}

