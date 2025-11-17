import type { Command } from "commander";
import readline from "node:readline";
import {
  loadCliConfig,
  normalizeAuthMethod,
  readRawCliConfig,
  writeRawCliConfig,
  createAuthManagerFromCliConfig,
} from "../config.js";
import type { CliAuthMethod } from "../config.js";
import type { AuthMethod } from "../../core/config.js";

export function registerSetAuthCommand(program: Command): void {
  program
    .command("set-auth <method>")
    .description("Set authentication method")
    .action(async (method: string) => {
      const normalized = safeNormalize(method);
      if (!normalized) {
        process.exitCode = 1;
        return;
      }

      const methodForManager: AuthMethod =
        normalized === "api-key"
          ? "openai-api-key"
          : (normalized as Exclude<CliAuthMethod, "api-key">);

      const loaded = await loadCliConfig();
      const cli = loaded.cli;
      cli.auth.method = normalized;

      if (
        (normalized === "api-key" || normalized === "openai-api-key") &&
        !cli.auth.openai_key
      ) {
        cli.auth.openai_key = await promptForKey("OpenAI");
      } else if (
        normalized === "anthropic-api-key" &&
        !cli.auth.anthropic_key
      ) {
        cli.auth.anthropic_key = await promptForKey("Anthropic");
      }

      const raw = (await readRawCliConfig()) ?? {};
      raw.auth = {
        ...(raw.auth as Record<string, unknown> | undefined),
        method: cli.auth.method,
        openai_key: cli.auth.openai_key,
        anthropic_key: cli.auth.anthropic_key,
        openrouter_key: cli.auth.openrouter_key,
      };
      await writeRawCliConfig(raw);

      console.log(`✓ Auth method set to ${normalized}`);

      try {
        const authManager = createAuthManagerFromCliConfig(cli, loaded.core);
        await authManager.setMethod(methodForManager);
        const provider =
          methodForManager === "anthropic-api-key" ||
          methodForManager === "oauth-claude"
            ? "anthropic"
            : "openai";
        await authManager.getToken(provider);
        console.log(`✓ Token available for ${provider}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠ Warning: ${message}`);
      }
    });
}

function safeNormalize(value: string): CliAuthMethod | null {
  try {
    return normalizeAuthMethod(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return null;
  }
}

async function promptForKey(provider: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string) =>
    new Promise<string>((resolve) => {
      rl.question(query, (answer) => resolve(answer));
    });

  const value = await question(`Enter ${provider} API key: `);
  rl.close();
  return value.trim();
}
