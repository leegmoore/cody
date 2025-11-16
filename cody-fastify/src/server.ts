import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import cors from "@fastify/cors";

export async function createServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: "*" });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }));

  app.register(
    (sub) => {
      sub.setValidatorCompiler(validatorCompiler);
      sub.setSerializerCompiler(serializerCompiler);
      // Future API routes will go here
    },
    { prefix: "/api/v1" },
  );

  return app;
}

async function start() {
  const app = await createServer();
  const port = Number(process.env.PORT ?? "4010");
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (import.meta.main) {
  void start();
}
