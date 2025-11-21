import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { RedisStream } from "../../core/redis.js";
import { StreamEventSchema, streamKeyForRun } from "../../core/schema.js";

const RunStreamParams = z.object({
  id: z.string().uuid(),
});

const RunStreamQuery = z.object({
  from: z.string().optional(), // last event id
  blockMs: z.coerce.number().optional(),
});

export async function registerRunRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/runs/:id/events",
    {
      schema: {
        params: RunStreamParams,
        querystring: RunStreamQuery,
      },
    },
    async (req, reply) => {
      const { id: runId } = req.params;
      const fromId =
        req.query.from ??
        (req.headers["last-event-id"] as string | undefined) ??
        "0-0";
      const blockMs = req.query.blockMs ?? 5000;

      const redis = await RedisStream.connect();
      const streamKey = streamKeyForRun(runId);

      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.flushHeaders?.();

      let cursor = fromId;
      let closed = false;

      req.raw.on("close", () => {
        closed = true;
        void redis.close();
      });

      while (!closed) {
        const records = await redis.read(streamKey, cursor, blockMs, 100);
        if (!records.length) {
          continue;
        }

        for (const rec of records) {
          cursor = rec.id;
          const parsed = StreamEventSchema.parse(rec.event);
          reply.raw.write(`id: ${rec.id}\n`);
          reply.raw.write(`event: ${parsed.payload.type}\n`);
          reply.raw.write(`data: ${JSON.stringify(parsed)}\n\n`);
        }
        reply.raw.write(`:\n\n`); // keepalive
      }
    },
  );
}
