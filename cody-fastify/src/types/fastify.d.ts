import type { ModelFactory } from "../core/model-factory.js";

declare module "fastify" {
  interface FastifyInstance {
    modelFactory: ModelFactory;
  }
}
