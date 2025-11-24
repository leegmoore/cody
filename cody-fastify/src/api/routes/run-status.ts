import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ResponseSchema } from "../../core/schema.js";
import { getRun } from "../services/thread-service.js";
import { NotFoundError } from "../errors/api-errors.js";

const RunParamsSchema = z.object({ id: z.string().uuid() });

export async function registerRunStatusRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/runs/:id",
    {
      schema: {
        params: RunParamsSchema,
        response: {
          200: ResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const run = await getRun(req.params.id);
      if (!run) {
        throw new NotFoundError(`Run ${req.params.id} not found`);
      }
      reply.send(run);
    },
  );
}
