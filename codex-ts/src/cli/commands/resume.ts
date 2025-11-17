import type { Command } from "commander";
import type { CliRuntime } from "../runtime.js";
import { setActiveConversation } from "../state.js";
import { ConversationId } from "../../protocol/conversation-id/index.js";
import {
  ConversationNotFoundError,
  CorruptedRolloutError,
  EmptyRolloutError,
} from "../../core/errors.js";
import { writeActiveConversationId } from "../active-conversation-store.js";

export function registerResumeCommand(
  program: Command,
  runtime: CliRuntime,
): void {
  program
    .command("resume <conversationId>")
    .description("Resume a saved conversation")
    .action(async (conversationId: string) => {
      const loaded = await runtime.loadConfig();
      const manager = await runtime.getManager();

      try {
        ConversationId.fromString(conversationId);
      } catch {
        console.error(
          `Invalid conversation ID format: ${conversationId}. Expected a UUID like conv_1234...`,
        );
        process.exitCode = 1;
        return;
      }

      try {
        const resumed = await manager.resumeConversation(
          loaded.core,
          conversationId,
        );
        setActiveConversation(resumed.conversationId, resumed.conversation);
        await writeActiveConversationId(
          loaded.codexHome,
          resumed.conversationId.toString(),
        );
        console.log(`\nResumed conversation: ${conversationId}\n`);
      } catch (error) {
        handleResumeError(error as Error);
      }
    });
}

function handleResumeError(error: Error): void {
  if (
    error instanceof ConversationNotFoundError ||
    error instanceof CorruptedRolloutError ||
    error instanceof EmptyRolloutError
  ) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  throw error;
}
