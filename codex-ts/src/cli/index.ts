#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { Command, CommanderError } from "commander";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { realpathSync } from "node:fs";
import { registerNewCommand } from "./commands/new.js";
import { registerChatCommand } from "./commands/chat.js";
import { registerReplCommand } from "./commands/repl.js";
import {
  registerListProvidersCommand,
  registerSetApiCommand,
  registerSetProviderCommand,
} from "./commands/providers.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerSetAuthCommand } from "./commands/set-auth.js";
import { registerListCommand } from "./commands/list.js";
import { registerResumeCommand } from "./commands/resume.js";
import { createRuntime, type CliRuntime } from "./runtime.js";
import {
  ConfigurationError,
  NoActiveConversationError,
  ValidationError,
} from "../core/errors.js";

// Load .env from the CLI installation directory, not cwd
// This ensures we get the correct API keys even when running from other directories
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../..", ".env");
loadEnv({ path: envPath, override: true, quiet: true });

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
  program.name("cody").description("Cody CLI").helpCommand(false);

  registerNewCommand(program, runtime);
  registerChatCommand(program, runtime);
  registerReplCommand(program, runtime);
  registerListCommand(program, runtime);
  registerResumeCommand(program, runtime);
  registerSetProviderCommand(program);
  registerSetApiCommand(program);
  registerListProvidersCommand(program);
  registerLoginCommand(program);
  registerSetAuthCommand(program);

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
    if (error.code !== "commander.helpDisplayed") {
      console.error(error.message);
    }
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
const currentPath = fileURLToPath(import.meta.url);
if (!entryPoint) {
  runCli();
} else {
  let entryPath: string;
  try {
    entryPath = realpathSync(entryPoint);
  } catch {
    entryPath = entryPoint;
  }

  if (entryPath === currentPath) {
    runCli();
  }
}
