import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { buildConversationHandlers } from "../handlers/conversation-handlers.js";
import {
  CreateConversationSchema,
  UpdateConversationSchema,
  ListConversationsQuerySchema,
  ConversationResponseSchema,
  ListConversationsResponseSchema,
} from "../schemas/conversation.js";
import type { CodexRuntime } from "../services/codex-runtime.js";

// Extend FastifyInstance to include codexRuntime
declare module "fastify" {
  interface FastifyInstance {
    codexRuntime: CodexRuntime;
  }
}

export function registerConversationRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  const codexRuntime = app.codexRuntime;
  const handlers = buildConversationHandlers(codexRuntime);

  typedApp.post(
    "/conversations",
    {
      schema: {
        body: CreateConversationSchema,
        response: { 201: ConversationResponseSchema },
      },
    },
    handlers.create,
  );

  typedApp.get(
    "/conversations",
    {
      schema: {
        querystring: ListConversationsQuerySchema,
        response: { 200: ListConversationsResponseSchema },
      },
    },
    handlers.list,
  );

  typedApp.get(
    "/conversations/:id",
    {
      schema: {
        response: { 200: ConversationResponseSchema },
      },
    },
    handlers.get,
  );

  typedApp.patch(
    "/conversations/:id",
    {
      schema: {
        body: UpdateConversationSchema,
        response: { 200: ConversationResponseSchema },
      },
    },
    handlers.update,
  );

  typedApp.delete("/conversations/:id", handlers.delete);
}
