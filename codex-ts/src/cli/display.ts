import type { Conversation } from "../core/conversation.js";
import type { EventMsg } from "../protocol/protocol.js";

export async function renderConversationUntilComplete(
  conversation: Conversation,
): Promise<void> {
  // Loop until the agent indicates completion or abort.
  let done = false;
  while (!done) {
    const event = await conversation.nextEvent();
    done = handleEvent(event.msg);
  }
}

function handleEvent(msg: EventMsg): boolean {
  switch (msg.type) {
    case "agent_message":
      console.log(`Assistant: ${msg.message}`);
      return false;
    case "error":
      console.error(`Error: ${msg.message}`);
      return false;
    case "task_complete":
    case "turn_aborted":
      return true;
    default:
      return false;
  }
}
