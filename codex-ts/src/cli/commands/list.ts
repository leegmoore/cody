import type { Command } from "commander";
import type { CliRuntime } from "../runtime.js";
import { getActiveConversation } from "../state.js";
import { readActiveConversationId } from "../active-conversation-store.js";

function formatTimestamp(value: number): string {
  if (!value) {
    return "unknown";
  }
  return new Date(value).toLocaleString();
}

export function registerListCommand(
  program: Command,
  runtime: CliRuntime,
): void {
  program
    .command("list")
    .description("List saved conversations")
    .action(async () => {
      const loaded = await runtime.loadConfig();
      const manager = await runtime.getManager();
      const conversations = await manager.listConversations(loaded.core);
      const active = getActiveConversation();
      let activeId = active?.conversationId.toString();
      if (!activeId) {
        activeId = await readActiveConversationId(loaded.codexHome);
      }

      if (conversations.length === 0) {
        console.log("\nNo saved conversations.\n");
        console.log("Start a new one: cody new\n");
        return;
      }

      console.log("\nSaved Conversations:\n");
      for (const convo of conversations) {
        const indicator = activeId && convo.id === activeId ? "→" : " ";
        console.log(`${indicator} ${convo.id}`);
        console.log(
          `    Provider: ${convo.provider ?? "unknown"} (${convo.model ?? "unknown"})`,
        );
        console.log(`    Updated: ${formatTimestamp(convo.updatedAt)}`);
        console.log("");
      }
      console.log(`Total: ${conversations.length} conversation(s)\n`);
    });
}
