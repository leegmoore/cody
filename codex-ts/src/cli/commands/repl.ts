import type { Command } from "commander";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { CliRuntime } from "../runtime.js";
import {
  clearActiveConversation,
  requireActiveConversation,
  setActiveConversation,
} from "../state.js";
import { renderConversationUntilComplete } from "../display.js";
import { NoActiveConversationError } from "../../core/errors.js";
import {
  clearActiveConversationId,
  readActiveConversationId,
  writeActiveConversationId,
} from "../active-conversation-store.js";

export function registerReplCommand(
  program: Command,
  runtime: CliRuntime,
): void {
  program
    .command("repl")
    .description("Start an interactive Cody session")
    .action(async () => {
      await startRepl(runtime);
    });
}

export async function startRepl(
  runtime: CliRuntime,
  bootstrap: string[][] = [],
): Promise<void> {
  const rl = readline.createInterface({ input, output, terminal: true });
  const loaded = await runtime.loadConfig();
  const manager = await runtime.getManager();
  const codexHome = loaded.codexHome;

  output.write("Cody REPL. Type 'help' for commands.\n");
  let running = true;

  const persistActiveConversation = async (
    conversationId: string,
  ): Promise<void> => {
    await writeActiveConversationId(codexHome, conversationId);
  };

  const clearPersistedConversation = async (): Promise<void> => {
    await clearActiveConversationId(codexHome);
  };

  const tryRestorePersistedConversation = async () => {
    const storedId = await readActiveConversationId(codexHome);
    if (!storedId) {
      return null;
    }
    try {
      const restored = await manager.resumeConversation(loaded.core, storedId);
      setActiveConversation(restored.conversationId, restored.conversation);
      await persistActiveConversation(restored.conversationId.toString());
      output.write(`Resumed conversation: ${storedId}\n`);
      return restored.conversation;
    } catch (error) {
      output.write(
        `Failed to resume conversation ${storedId}: ${String(error)}\n`,
      );
      await clearPersistedConversation();
      return null;
    }
  };

  const runCommand = async (tokens: string[]): Promise<boolean> => {
    const [command, ...rest] = tokens;

    try {
      switch (command) {
        case "help":
          showHelp();
          break;
        case "exit":
        case "quit":
          running = false;
          return false;
        case "new": {
          const result = await manager.newConversation(loaded.core);
          setActiveConversation(result.conversationId, result.conversation);
          await persistActiveConversation(result.conversationId.toString());
          output.write(
            `Created conversation: ${result.conversationId.toString()}\n`,
          );
          break;
        }
        case "chat": {
          const message = rest.join(" ").trim();
          if (!message) {
            output.write("Message cannot be empty.\n");
            break;
          }
          let conversation;
          try {
            conversation = requireActiveConversation().conversation;
          } catch (error) {
            if (error instanceof NoActiveConversationError) {
              const restored = await tryRestorePersistedConversation();
              if (restored) {
                conversation = restored;
              } else {
                const result = await manager.newConversation(loaded.core);
                setActiveConversation(
                  result.conversationId,
                  result.conversation,
                );
                await persistActiveConversation(
                  result.conversationId.toString(),
                );
                output.write(
                  `Started new conversation: ${result.conversationId.toString()}\n`,
                );
                conversation = result.conversation;
              }
            } else {
              throw error;
            }
          }
          await conversation.sendMessage(message);
          await renderConversationUntilComplete(conversation);
          break;
        }
        case "reset":
          clearActiveConversation();
          await clearPersistedConversation();
          output.write("Cleared active conversation.\n");
          break;
        default:
          output.write("Unknown command. Type 'help' for options.\n");
          break;
      }
    } catch (error) {
      output.write(`${String(error)}\n`);
    }
    return true;
  };

  for (const commandTokens of bootstrap) {
    const shouldContinue = await runCommand(commandTokens);
    if (!shouldContinue) {
      rl.close();
      return;
    }
  }

  while (running) {
    let line: string;
    try {
      line = await rl.question("cody> ");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ERR_USE_AFTER_CLOSE") {
        break;
      }
      throw error;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const tokens = trimmed.split(" ");
    const shouldContinue = await runCommand(tokens);
    if (!shouldContinue) {
      break;
    }
  }

  rl.close();
}

function showHelp(): void {
  output.write(
    "Commands:\n" +
      "  new            Create a new conversation\n" +
      "  chat <text>    Send a message to the active conversation\n" +
      "  reset          Clear active conversation\n" +
      "  exit           Leave the REPL\n",
  );
}
