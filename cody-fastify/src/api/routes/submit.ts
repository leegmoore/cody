import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  SpanStatusCode,
  context as otelContext,
  trace,
} from "@opentelemetry/api";
import { toolRegistry } from "codex-ts/src/tools/registry.js";
import { RedisStream } from "../../core/redis.js";
import {
  InvalidModelError,
  UnknownProviderError,
  type StreamAdapter,
} from "../../core/model-factory.js";
import { traceContextFromSpanContext } from "../../core/tracing.js";
import {
  createThread,
  ensureThreadExists,
} from "../services/thread-service.js";

const tracer = trace.getTracer("codex.api.submit");

const SubmitBody = z.object({
  prompt: z.string().min(1, "prompt cannot be empty"),
  model: z.string().min(1).optional(),
  providerId: z.string().min(1).optional(),
  runId: z.string().uuid().optional(),
  turnId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
});

const SubmitResponse = z.object({
  runId: z.string().uuid(),
});

const ErrorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export async function registerSubmitRoutes(
  app: FastifyInstance,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/submit",
    {
      schema: {
        body: SubmitBody,
        response: {
          202: SubmitResponse,
          400: ErrorResponse,
          503: ErrorResponse,
          500: ErrorResponse,
        },
      },
    },
    async (req, reply) => {
      const body = req.body;

      const defaultModel =
        process.env.CORE2_MODEL?.trim() ??
        process.env.OPENAI_MODEL?.trim() ??
        "gpt-5-mini";
      const model = body.model ?? defaultModel;
      const providerId = body.providerId ?? "openai";

      const runId = body.runId ?? randomUUID();
      const turnId = body.turnId ?? randomUUID();
      let threadId = body.threadId;
      if (!threadId) {
        const thread = await createThread({
          modelProviderId: providerId,
          modelProviderApi: "responses",
          model,
        });
        threadId = thread.threadId;
      } else {
        await ensureThreadExists(threadId, {
          modelProviderId: providerId,
          modelProviderApi: "responses",
          model,
        });
      }

      const activeSpan = trace.getSpan(otelContext.active());
      const requestContext = otelContext.active();
      const traceContext = activeSpan
        ? traceContextFromSpanContext(activeSpan.spanContext())
        : undefined;

      let redis: RedisStream | undefined;

      try {
        redis = await RedisStream.connect();
      } catch (error) {
        req.log.error({ err: error }, "failed to connect to redis");
        reply.status(503).send({
          error: {
            code: "REDIS_UNAVAILABLE",
            message: "Redis connection failed",
          },
        });
        return;
      }

      const modelFactory = app.modelFactory;
      let adapter: StreamAdapter;
      try {
        adapter = modelFactory.createAdapter({
          providerId,
          model,
          redis,
        });
      } catch (error) {
        await redis.close().catch(() => undefined);
        if (error instanceof UnknownProviderError) {
          reply.status(400).send({
            error: {
              code: "UNKNOWN_PROVIDER",
              message: error.message,
            },
          });
          return;
        }
        if (error instanceof InvalidModelError) {
          reply.status(400).send({
            error: {
              code: "INVALID_MODEL",
              message: error.message,
            },
          });
          return;
        }
        req.log.error(
          { err: error, providerId, model },
          "failed to initialize stream adapter",
        );
        reply.status(500).send({
          error: {
            code: "ADAPTER_INIT_FAILED",
            message: (error as Error).message,
          },
        });
        return;
      }

      const toolSpecs = toolRegistry.getToolSpecs();

      void (async () => {
        try {
          await tracer.startActiveSpan(
            "submit.stream",
            {
              attributes: {
                "codex.run_id": runId,
                "codex.turn_id": turnId,
                "codex.thread_id": threadId,
                "codex.model": model,
                "codex.provider_id": providerId,
              },
            },
            requestContext,
            async (span) => {
              try {
                await adapter.stream({
                  prompt: body.prompt,
                  runId,
                  turnId,
                  threadId,
                  agentId: body.agentId,
                  traceContext,
                  tools: toolSpecs,
                });
              } catch (error) {
                span.recordException(error as Error);
                span.setStatus({ code: SpanStatusCode.ERROR });
                req.log.error({ err: error, runId }, "stream adapter failed");
              } finally {
                span.end();
              }
            },
          );
        } finally {
          await redis?.close().catch(() => undefined);
        }
      })().catch((error) => {
        req.log.error({ err: error, runId }, "submit stream task failed");
      });

      return reply.status(202).send({ runId });
    },
  );
}
