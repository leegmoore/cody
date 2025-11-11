#!/usr/bin/env node
import "dotenv/config";
import { Command, CommanderError } from "commander";
import { pathToFileURL } from "url";
import { registerNewCommand } from "./commands/new.js";
import { registerChatCommand } from "./commands/chat.js";
import { registerReplCommand } from "./commands/repl.js";
import { createRuntime, type CliRuntime } from "./runtime.js";
import {
  ConfigurationError,
  NoActiveConversationError,
  ValidationError,
} from "../core/errors.js";

export async function runCli(argv = process.argv): Promise<void> {
  const runtime = createRuntime();
  const program = buildProgram(runtime);
  program.exitOverride();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    handleCliError(error);
  }
}

function buildProgram(runtime: CliRuntime): Command {
  const program = new Command();
  program.name("cody").description("Cody CLI");

  registerNewCommand(program, runtime);
  registerChatCommand(program, runtime);
  registerReplCommand(program, runtime);

  return program;
}

function handleCliError(error: unknown): void {
  if (
    error instanceof ConfigurationError ||
    error instanceof NoActiveConversationError ||
    error instanceof ValidationError
  ) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  if (error instanceof CommanderError) {
    console.error(error.message);
    process.exitCode = error.exitCode;
    return;
  }
  console.error(error);
  process.exitCode = 1;
}

export function safeFormatKey(key: string): string {
  if (key.length <= 13) {
    return "***";
  }

  const prefix = key.slice(0, 8);
  const suffix = key.slice(-5);
  return `${prefix}***${suffix}`;
}

const entryPoint = process.argv[1];
if (entryPoint) {
  const entryUrl = pathToFileURL(entryPoint).href;
  if (import.meta.url === entryUrl) {
    runCli();
  }
}
