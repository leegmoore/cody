import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { registerStreamRoutes } from "./api/routes/stream.js";
import { registerSubmitRoutes } from "./api/routes/submit.js";
import { registerThreadRoutes } from "./api/routes/threads.js";
import { registerRunStatusRoutes } from "./api/routes/run-status.js";
import { AppError } from "./api/errors/api-errors.js";
import {
  DefaultModelFactory,
  type ModelFactory,
} from "./core/model-factory.js";
import { PersistenceWorker } from "./workers/persistence-worker.js";

export interface ServerOptions {
  modelFactory?: ModelFactory;
}

export async function createServer(options: ServerOptions = {}) {
  const app = Fastify({
    logger: {
      level: "debug",
    },
  });

  let persistenceWorker: PersistenceWorker | undefined;

  const modelFactory = options.modelFactory ?? new DefaultModelFactory();
  app.decorate("modelFactory", modelFactory);

  await app.register(cors, { origin: "*" });

  // Serve static files from public directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  await app.register(fastifyStatic, {
    root: join(__dirname, "..", "public"),
    prefix: "/",
    maxAge: 0, // Disable cache for development
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    },
  });

  // Initialize Codex runtime
  const codexHome = process.env.CODY_HOME ?? join(tmpdir(), "cody-runtime");
  await mkdir(codexHome, { recursive: true });
  process.env.CODY_HOME ??= codexHome;
  const _cwd = process.cwd();

  try {
    persistenceWorker = new PersistenceWorker();
    await persistenceWorker.start();
    app.log.info("Persistence worker started");
  } catch (error) {
    app.log.warn(
      { err: error },
      "Persistence worker disabled (set CONVEX_URL to enable)",
    );
    persistenceWorker = undefined;
  }

  app.addHook("onClose", async () => {
    if (persistenceWorker) {
      await persistenceWorker.stop().catch(() => undefined);
    }
  });
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }));

  app.register(
    (sub) => {
      sub.setValidatorCompiler(validatorCompiler);
      sub.setSerializerCompiler(serializerCompiler);

      registerSubmitRoutes(sub);
      registerStreamRoutes(sub);
      registerThreadRoutes(sub);
      registerRunStatusRoutes(sub);
    },
    { prefix: "/api/v2" },
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
        "message" in err && typeof err.message === "string"
          ? err.message
          : "Validation error";
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

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down server");
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  try {
    await app.listen({ port, host });
    app.log.info({ port, host }, "Server started");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (import.meta.main) {
  void start();
}
