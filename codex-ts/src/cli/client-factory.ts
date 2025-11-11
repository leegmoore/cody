import { ModelClient } from "../core/client/client.js";
import {
  builtInModelProviders,
  WireApi,
} from "../core/client/model-provider-info.js";
import type { ModelClientFactory } from "../core/client/model-client-factory.js";
import { ConfigurationError } from "../core/errors.js";
import type { CliConfig } from "./config.js";
import { CodexAuth } from "../core/auth/stub-auth.js";

export function createCliModelClientFactory(
  cliConfig: CliConfig,
): ModelClientFactory {
  if (cliConfig.provider.api !== "responses") {
    throw new ConfigurationError(
      `API ${cliConfig.provider.api} not supported in Phase 1`,
    );
  }

  return ({ config }) => {
    const providers = builtInModelProviders();
    const provider = providers[cliConfig.provider.name];
    if (!provider) {
      throw new ConfigurationError(
        `Unknown model provider: ${cliConfig.provider.name}`,
      );
    }

    if (provider.wireApi !== WireApi.Responses) {
      throw new ConfigurationError(
        "Only Responses API providers are available in Phase 1",
      );
    }

    const apiKey = cliConfig.auth.openai_key;
    if (!apiKey) {
      throw new ConfigurationError(
        "OpenAI API key is required. Set auth.openai_key in your config.",
      );
    }

    const auth = CodexAuth.fromApiKey(apiKey);

    return new ModelClient({
      provider,
      modelSlug: cliConfig.provider.model,
      auth,
      reasoningEffort: config.modelReasoningEffort ?? undefined,
      reasoningSummary: config.modelReasoningSummary,
    });
  };
}
