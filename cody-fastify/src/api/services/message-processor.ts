import type { Conversation } from "codex-ts/src/core/conversation.ts";
import type { Event } from "codex-ts/src/protocol/protocol.ts";
import type { EventMsg } from "codex-ts/src/protocol/protocol.ts";
import { clientStreamManager } from "../client-stream/client-stream-manager.js";
import { convexClient } from "./convex-client.js";
import { api } from "../../../convex/_generated/api.js";

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
  conversationId: string,
): Promise<void> {
  // Consume events until we get task_complete or turn_aborted for this submission
  let eventsProcessed = 0;
  const maxEvents = 1000; // Safety limit
  let foundCompletionEvent = false;
  let accumulatedMessage = "";
  let capturedError = "";

  while (eventsProcessed < maxEvents && !foundCompletionEvent) {
    try {
      const event: Event = await conversation.nextEvent();
      eventsProcessed++;

      // Only process events for this submission
      if (event.id !== submissionId) {
        continue;
      }

      const msg = event.msg;

      // Accumulate assistant message
      if (msg.type === "agent_message") {
        accumulatedMessage += msg.message;
      } else if (msg.type === "agent_message_delta") {
        accumulatedMessage += msg.delta;
      } else if (msg.type === "agent_message_content_delta") {
        accumulatedMessage += msg.delta;
      }

      // Capture error messages
      if (msg.type === "error") {
        capturedError = msg.message || "An unknown error occurred.";
      }

      // Sync Tool Calls/Outputs to Convex
      if (msg.type === "raw_response_item" && msg.item) {
        const item = msg.item;
        if (item.type === "function_call") {
          await convexClient.mutation(api.messages.add, {
            conversationId,
            role: "assistant",
            content: "",
            turnId,
            type: "tool_call",
            callId: item.call_id ?? item.id,
            toolName: item.name,
            toolArgs: item.arguments,
          }).catch(e => console.error("Failed to sync tool call to Convex", e));
        } else if (item.type === "function_call_output") {
          // Check for failure in output
          if (item.output?.success === false) {
             const errorDetail = typeof item.output.content === "string" 
                ? item.output.content 
                : JSON.stringify(item.output.content);
             capturedError = `Tool execution failed: ${errorDetail}`;
          }

          await convexClient.mutation(api.messages.add, {
            conversationId,
            role: "tool",
            content: "",
            turnId,
            type: "tool_output",
            callId: item.call_id,
            toolOutput: item.output,
          }).catch(e => console.error("Failed to sync tool output to Convex", e));
        }
      }

      // Add event to turn store FIRST
      await clientStreamManager.addEvent(turnId, msg);
      await handleToolFailureEvent(turnId, msg);

      // Update turn status for error events
      if (msg.type === "error") {
        await clientStreamManager.updateTurnStatus(turnId, "error");
      }

      // Check if turn is complete
      if (
        msg.type === "task_complete" ||
        msg.type === "turn_aborted"
      ) {
        foundCompletionEvent = true;
        
        // Sync final Assistant Message to Convex
        if (accumulatedMessage.trim()) {
            await convexClient.mutation(api.messages.add, {
                conversationId,
                role: "assistant",
                content: accumulatedMessage,
                turnId,
            }).catch(e => console.error("Failed to sync assistant message to Convex", e));
        } else if (capturedError) {
            // Fallback: Write error message if no text was generated
            await convexClient.mutation(api.messages.add, {
                conversationId,
                role: "assistant",
                content: `I encountered an error and could not complete the request.\n\nError details: ${capturedError}`,
                turnId,
                status: "failed"
            }).catch(e => console.error("Failed to sync error message to Convex", e));
        }
      }
    } catch (error) {
      // Handle errors - store error event before breaking
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      capturedError = errorMessage; // Capture for fallback write
      
      await clientStreamManager.addEvent(turnId, {
        type: "error",
        message: errorMessage,
      });
      await clientStreamManager.updateTurnStatus(turnId, "error");
      foundCompletionEvent = true;
      
      // Attempt to write fallback message immediately on crash
      if (!accumulatedMessage.trim()) {
          await convexClient.mutation(api.messages.add, {
            conversationId,
            role: "assistant",
            content: `System Error: ${errorMessage}`,
            turnId,
            status: "failed"
        }).catch(e => console.error("Failed to sync crash message to Convex", e));
      }
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

    // Do NOT emit a generic 'error' event here.
    // Doing so causes client-stream-manager to set turn.status = 'error' and close the stream immediately.
    // We want the agent to see the tool failure and respond naturally.
    
    /*
    await clientStreamManager.addEvent(turnId, {
      type: "error",
      message: errorMessage,
    });
    */

    // Do NOT abort the turn here. Let the model see the error and respond.
    // await clientStreamManager.addEvent(turnId, {
    //   type: "turn_aborted",
    //   reason: "replaced",
    // });
  }
}
