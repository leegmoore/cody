import type { Config } from "../config.js";
import type { AuthManager } from "../auth/index.js";
import type { ModelClient } from "./client.js";

export interface ModelClientFactoryParams {
  config: Config;
  authManager: AuthManager;
}

export type ModelClientFactory = (
  params: ModelClientFactoryParams,
) => Promise<ModelClient> | ModelClient;
