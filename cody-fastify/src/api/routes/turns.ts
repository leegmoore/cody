import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { buildTurnHandlers } from "../handlers/turn-handlers.js";
import { TurnQuerySchema, TurnStatusResponseSchema } from "../schemas/turn.js";

export function registerTurnRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  const codexRuntime = app.codexRuntime;
  const handlers = buildTurnHandlers(codexRuntime);

  typedApp.get(
    "/turns/:id",
    {
      schema: {
        querystring: TurnQuerySchema,
        response: { 200: TurnStatusResponseSchema },
      },
    },
    handlers.getStatus,
  );

  typedApp.get(
    "/turns/:id/stream-events",
    {
      schema: {
        querystring: TurnQuerySchema,
      },
    },
    handlers.streamEvents,
  );
}
