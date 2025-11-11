import type { Command } from "commander";
import type { CliRuntime } from "../runtime.js";
import { startRepl } from "./repl.js";

export function registerNewCommand(
  program: Command,
  runtime: CliRuntime,
): void {
  program
    .command("new")
    .description("Create a new conversation (starts REPL)")
    .action(async () => {
      await startRepl(runtime, [["new"]]);
    });
}
