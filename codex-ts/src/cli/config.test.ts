import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { loadCliConfig } from "./config.js";
import { ConfigurationError } from "../core/errors.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "codex-cli-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("loadCliConfig", () => {
  it("loads provider and auth details", async () => {
    const toml = `
[provider]
name = "openai"
api = "responses"
model = "gpt-4o-mini"

[auth]
method = "api-key"
openai_key = "sk-test-123"
`;
    await writeFile(join(tempDir, "config.toml"), toml, "utf-8");

    const loaded = await loadCliConfig({ codexHome: tempDir, cwd: tempDir });
    expect(loaded.cli.provider.model).toBe("gpt-4o-mini");
    expect(loaded.core.model).toBe("gpt-4o-mini");
    expect(loaded.cli.auth.openai_key).toBe("sk-test-123");
  });

  it("throws when config file is missing", async () => {
    await expect(
      loadCliConfig({ codexHome: tempDir, cwd: tempDir }),
    ).rejects.toThrow(ConfigurationError);
  });
});
