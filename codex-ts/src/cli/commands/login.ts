import type { Command } from "commander";
import { loadCliConfig, createAuthManagerFromCliConfig } from "../config.js";
import type { AuthMethod, Config } from "../../core/config.js";
import { AuthManager } from "../../core/auth/index.js";

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Show authentication status")
    .action(async () => {
      const loaded = await loadCliConfig();
      const authManager = createAuthManagerFromCliConfig(
        loaded.cli,
        loaded.core,
      );
      const currentMethod = authManager.getSelectedMethod();

      console.log("\nAuthentication Status:\n");
      console.log(`Current method: ${currentMethod}\n`);

      const methods: Array<{
        name: AuthMethod;
        provider: "openai" | "anthropic";
        fallback: string;
      }> = [
        {
          name: "openai-api-key",
          provider: "openai",
          fallback:
            'Set in config: [auth]\nopenai_api_key = "sk-..." or run: cody set-auth openai-api-key',
        },
        {
          name: "anthropic-api-key",
          provider: "anthropic",
          fallback:
            'Set in config: [auth]\nanthropic_api_key = "sk-ant-..." or run: cody set-auth anthropic-api-key',
        },
        {
          name: "oauth-chatgpt",
          provider: "openai",
          fallback:
            "Log in via ChatGPT Pro CLI to refresh token or run: cody set-auth openai-api-key",
        },
        {
          name: "oauth-claude",
          provider: "anthropic",
          fallback:
            "Log in via Claude Code to refresh token or run: cody set-auth anthropic-api-key",
        },
      ];

      console.log("Available methods:\n");
      for (const method of methods) {
        const { available, message } = await checkMethodAvailability(
          authManager,
          loaded.core,
          method.name,
          method.provider,
        );
        const marker = method.name === currentMethod ? "→" : " ";
        const status = available ? "✓" : "✗";
        console.log(`${marker} ${status} ${method.name}`);
        if (!available) {
          console.log(`      ${message ?? method.fallback}`);
        }
      }

      console.log();
    });
}

async function checkMethodAvailability(
  baseManager: AuthManager,
  baseConfig: Config,
  method: AuthMethod,
  provider: "openai" | "anthropic",
): Promise<{ available: boolean; message?: string }> {
  const config =
    method === baseManager.getSelectedMethod()
      ? baseConfig
      : cloneConfigForMethod(baseConfig, method);
  const manager =
    method === baseManager.getSelectedMethod()
      ? baseManager
      : new AuthManager(config);
  try {
    await manager.getToken(provider);
    return { available: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Token not available.";
    return { available: false, message };
  }
}

function cloneConfigForMethod(config: Config, method: AuthMethod): Config {
  return {
    ...config,
    auth: {
      ...(config.auth ?? { method }),
      method,
    },
  };
}
