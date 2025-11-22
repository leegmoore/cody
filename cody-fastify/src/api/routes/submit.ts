import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  SpanStatusCode,
  context as otelContext,
  trace,
} from "@opentelemetry/api";
import { RedisStream } from "../../core/redis.js";
import { OpenAIStreamAdapter } from "../../core/adapters/openai-adapter.js";
import { AnthropicStreamAdapter } from "../../core/adapters/anthropic-adapter.js";
import { traceContextFromSpanContext } from "../../core/tracing.js";

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
      const threadId = body.threadId ?? randomUUID();

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

      let adapter: OpenAIStreamAdapter | AnthropicStreamAdapter;
      try {
        if (providerId.toLowerCase() === "anthropic") {
          adapter = new AnthropicStreamAdapter({
            model,
            providerId,
            redis,
          });
        } else {
          adapter = new OpenAIStreamAdapter({
            model,
            providerId,
            redis,
          });
        }
      } catch (error) {
        await redis.close().catch(() => undefined);
        req.log.error({ err: error }, "failed to initialize stream adapter");
        reply.status(500).send({
          error: {
            code: "ADAPTER_INIT_FAILED",
            message: (error as Error).message,
          },
        });
        return;
      }

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
