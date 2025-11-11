import { describe, it, expect } from "vitest";
import { createCliModelClientFactory } from "./client-factory.js";
import type { CliConfig } from "./config.js";
import { AuthManager, CodexAuth } from "../core/auth/index.js";
import { createDefaultConfig } from "../core/config.js";

describe("createCliModelClientFactory", () => {
  it("creates a model client with the configured model", async () => {
    const cliConfig: CliConfig = {
      provider: { name: "openai", api: "responses", model: "gpt-5-codex" },
      auth: { method: "api-key", openai_key: "sk-test" },
    };

    const factory = createCliModelClientFactory(cliConfig);
    const authManager = AuthManager.fromAuthForTesting(
      CodexAuth.fromApiKey("sk-test"),
    );
    const config = createDefaultConfig("/tmp/codex", process.cwd());

    const client = await factory({ config, authManager });
    expect(client.getModelSlug()).toBe("gpt-5-codex");
  });
});
