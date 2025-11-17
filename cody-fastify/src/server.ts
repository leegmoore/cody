import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { registerConversationRoutes } from "./api/routes/conversations.js";
import { registerMessageRoutes } from "./api/routes/messages.js";
import { registerTurnRoutes } from "./api/routes/turns.js";
import { AppError } from "./api/errors/api-errors.js";

export async function createServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: "*" });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }));

  // Register API routes with Zod validation
  app.register(
    (sub) => {
      sub.setValidatorCompiler(validatorCompiler);
      sub.setSerializerCompiler(serializerCompiler);

      registerConversationRoutes(sub);
      registerMessageRoutes(sub);
      registerTurnRoutes(sub);
    },
    { prefix: "/api/v1" },
  );

  // Global error handler
  app.setErrorHandler((err, req, reply) => {
    // Fastify validation errors (including Zod validation errors wrapped by Fastify)
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "FST_ERR_VALIDATION"
    ) {
      const message =
        ("message" in err && typeof err.message === "string"
          ? err.message
          : "Validation error");
      reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message,
          details: "validation" in err ? err.validation : [],
        },
      });
      return;
    }

    // Zod validation errors (direct, not wrapped)
    if (err instanceof ZodError) {
      const message = err.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message,
          details: { errors: err.issues },
        },
      });
      return;
    }

    // App errors (including NotImplementedError)
    if (err instanceof AppError) {
      reply.code(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
      return;
    }

    // Unexpected errors
    app.log.error({ err, req: req.id }, "Unexpected error");
    reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId: req.id,
      },
    });
  });

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
