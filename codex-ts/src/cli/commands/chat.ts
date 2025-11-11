import type { Command } from "commander";
import type { CliRuntime } from "../runtime.js";
import { startRepl } from "./repl.js";

export function registerChatCommand(
  program: Command,
  runtime: CliRuntime,
): void {
  program
    .command("chat")
    .description("Send a message (starts REPL)")
    .argument("<message...>", "Message to send")
    .action(async (messageParts: string[]) => {
      const message = messageParts.join(" ");
      await startRepl(runtime, [["chat", message]]);
    });
}
