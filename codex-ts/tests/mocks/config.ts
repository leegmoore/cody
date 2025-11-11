import { createDefaultConfig, type Config } from "../../src/core/config.js";

const TEST_CODEX_HOME = "/tmp/codex-test";

export function createMockConfig(overrides: Partial<Config> = {}): Config {
  const base = createDefaultConfig(TEST_CODEX_HOME, process.cwd());

  return {
    ...base,
    ...overrides,
    history: overrides.history ?? base.history,
    mcpServers: overrides.mcpServers ?? base.mcpServers,
  };
}
