import type { ConversationManager } from "../core/conversation-manager.js";
import { SessionSource } from "../core/rollout.js";
import { loadCliConfig, createAuthManagerFromCliConfig } from "./config.js";
import type { LoadedCliConfig } from "./config.js";
import { createCliModelClientFactory } from "./client-factory.js";
import { getOrCreateManager } from "./state.js";
import { promptApproval } from "./approval.js";

export interface CliRuntime {
  loadConfig(): Promise<LoadedCliConfig>;
  getManager(): Promise<ConversationManager>;
}

export function createRuntime(): CliRuntime {
  let cachedConfig: LoadedCliConfig | null = null;
  let manager: ConversationManager | null = null;

  return {
    async loadConfig() {
      if (!cachedConfig) {
        cachedConfig = await loadCliConfig();
      }
      return cachedConfig;
    },
    async getManager() {
      if (manager) {
        return manager;
      }
      const loaded = await this.loadConfig();
      const authManager = createAuthManagerFromCliConfig(
        loaded.cli,
        loaded.core,
      );
      const modelClientFactory = createCliModelClientFactory(loaded.cli);
      manager = getOrCreateManager({
        authManager,
        modelClientFactory,
        sessionSource: SessionSource.CLI,
        approvalCallback: promptApproval,
      });
      return manager;
    },
  };
}
