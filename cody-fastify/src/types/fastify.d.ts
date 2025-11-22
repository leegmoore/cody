import type { ModelFactory } from "../core/model-factory.js";
import type { CodexRuntime } from "../api/services/codex-runtime.js";

declare module "fastify" {
  interface FastifyInstance {
    codexRuntime: CodexRuntime;
    modelFactory: ModelFactory;
  }
}
