import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  ROOT_CONTEXT,
  SpanStatusCode,
  context as otelContext,
  propagation,
  trace,
} from "@opentelemetry/api";
import { RedisStream } from "../../core/redis.js";
import { StreamEventSchema, streamKeyForRun } from "../../core/schema.js";

const tracer = trace.getTracer("codex.api.stream");

const StreamParams = z.object({
  runId: z.string().uuid(),
});

const StreamQuery = z.object({
  from: z.string().optional(),
  blockMs: z.coerce.number().min(1).max(60000).optional(),
  batchSize: z.coerce.number().min(1).max(200).optional(),
});

export async function registerStreamRoutes(
  app: FastifyInstance,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/stream/:runId",
    {
      schema: {
        params: StreamParams,
        querystring: StreamQuery,
      },
    },
    async (req, reply) => {
      const { runId } = req.params;
      const streamKey = streamKeyForRun(runId);
      const fromHeader = req.headers["last-event-id"];
      const fromQuery = req.query.from;
      const blockMs = req.query.blockMs ?? 5000;
      const batchSize = req.query.batchSize ?? 50;

      const redis = await RedisStream.connect();

      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.flushHeaders?.();

      let cursor =
        fromQuery ??
        (typeof fromHeader === "string" && fromHeader.trim().length > 0
          ? fromHeader.trim()
          : "0-0");
      let closed = false;

      const keepAlive = setInterval(() => {
        if (!closed) {
          reply.raw.write(`: keep-alive\n\n`);
        }
      }, 15000);

      const shutdown = async () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        try {
          await redis.close();
        } catch {
          // Swallow close errors to avoid crashing the request teardown.
        }
      };

      req.raw.on("close", () => {
        void shutdown();
      });
      req.raw.on("error", () => {
        void shutdown();
      });

      try {
        while (!closed) {
          let records;
          try {
            records = await redis.read(streamKey, cursor, blockMs, batchSize);
          } catch (error) {
            app.log.error(
              { err: error, runId, cursor, streamKey },
              "redis stream read failed",
            );
            break;
          }

          if (!records.length) {
            continue;
          }

          for (const record of records) {
            cursor = record.id;
            const parsed = StreamEventSchema.parse(record.event);

            const carrier = {
              traceparent: parsed.trace_context.traceparent,
              ...(parsed.trace_context.tracestate
                ? { tracestate: parsed.trace_context.tracestate }
                : {}),
            };

            const parentCtx = propagation.extract(ROOT_CONTEXT, carrier);
            const requestSpan = trace.getSpan(otelContext.active());
            await tracer.startActiveSpan(
              `sse.emit.${parsed.payload.type}`,
              {
                attributes: {
                  "codex.run_id": parsed.run_id,
                  "codex.event_id": record.id,
                  "codex.event_type": parsed.payload.type,
                  "codex.stream_key": streamKey,
                },
                links: requestSpan
                  ? [
                      {
                        context: requestSpan.spanContext(),
                      },
                    ]
                  : undefined,
              },
              parentCtx,
              async (span) => {
                try {
                  reply.raw.write(`id: ${record.id}\n`);
                  reply.raw.write(`event: ${parsed.payload.type}\n`);
                  reply.raw.write(`data: ${JSON.stringify(parsed)}\n\n`);
                } catch (error) {
                  span.recordException(error as Error);
                  span.setStatus({ code: SpanStatusCode.ERROR });
                  throw error;
                } finally {
                  span.end();
                }
              },
            );
          }

          if (!closed) {
            (reply.raw as unknown as { flush?: () => void }).flush?.();
          }
        }
      } finally {
        await shutdown();
      }
    },
  );
}
