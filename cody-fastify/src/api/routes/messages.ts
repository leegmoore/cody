import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { buildMessageHandlers } from "../handlers/message-handlers.js";
import {
  SubmitMessageSchema,
  SubmitMessageResponseSchema,
} from "../schemas/message.js";

export function registerMessageRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manager = null as any; // Placeholder
  const handlers = buildMessageHandlers(manager);

  typedApp.post(
    "/conversations/:id/messages",
    {
      schema: {
        body: SubmitMessageSchema,
        response: { 202: SubmitMessageResponseSchema },
      },
    },
    handlers.submit,
  );
}
