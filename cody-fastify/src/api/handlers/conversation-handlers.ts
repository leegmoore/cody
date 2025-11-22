import type { FastifyRequest, FastifyReply } from "fastify";
import { ValidationError, NotFoundError } from "../errors/api-errors.js";
import { ConfigurationError } from "codex-ts/src/core/errors.ts";
import type {
  CreateConversationBody,
  UpdateConversationBody,
  ListConversationsQuery,
} from "../schemas/conversation.js";
import {
  createConversation,
  listConversations,
  getConversation,
  updateConversation,
  deleteConversation,
} from "../services/conversation-service-codex.js";
import type { CodexRuntime } from "../services/codex-runtime.js";

export function buildConversationHandlers(codexRuntime: CodexRuntime) {
  return {
    async create(
      req: FastifyRequest<{ Body: CreateConversationBody }>,
      reply: FastifyReply,
    ): Promise<void> {
      try {
        const conversation = await createConversation(codexRuntime, req.body);
        reply.code(201).send(conversation);
      } catch (error) {
        // Log the error for debugging
        req.log?.error({ err: error }, "Error in create conversation handler");

        if (
          error instanceof ValidationError ||
          error instanceof NotFoundError
        ) {
          throw error;
        }

        // Handle ConfigurationError (missing API keys, etc.) as validation error
        if (error instanceof ConfigurationError) {
          throw new ValidationError(
            `Configuration error: ${error.message}. Please ensure API keys are configured.`,
          );
        }

        if (error instanceof Error) {
          if (error.message.includes("does not support")) {
            throw new ValidationError(error.message);
          }
          if (error.message.includes("Unsupported provider")) {
            throw new ValidationError(error.message);
          }
          if (
            error.message.includes("Missing API key") ||
            error.message.includes("No credentials")
          ) {
            throw new ValidationError(
              `Missing API key: ${error.message}. Please set the required API key environment variable.`,
            );
          }
        }
        // For any other error, log and re-throw (will be caught by global error handler)
        throw error;
      }
    },

    async list(
      req: FastifyRequest<{ Querystring: ListConversationsQuery }>,
      reply: FastifyReply,
    ): Promise<void> {
      const result = await listConversations(codexRuntime, {
        cursor: req.query.cursor,
        limit: req.query.limit,
      });

      reply.code(200).send(result);
    },

    async get(
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> {
      const conversation = await getConversation(codexRuntime, req.params.id);
      if (!conversation) {
        throw new NotFoundError(`Conversation ${req.params.id} not found`);
      }

      reply.code(200).send(conversation);
    },

    async update(
      req: FastifyRequest<{
        Params: { id: string };
        Body: UpdateConversationBody;
      }>,
      reply: FastifyReply,
    ): Promise<void> {
      try {
        const conversation = await updateConversation(
          codexRuntime,
          req.params.id,
          req.body,
        );
        reply.code(200).send(conversation);
      } catch (error) {
        if (
          error instanceof NotFoundError ||
          error instanceof ValidationError
        ) {
          throw error;
        }
        if (
          error instanceof Error &&
          error.message === "Conversation not found"
        ) {
          throw new NotFoundError(`Conversation ${req.params.id} not found`);
        }
        if (
          error instanceof Error &&
          error.message.includes("does not support")
        ) {
          throw new ValidationError(error.message);
        }
        throw error;
      }
    },

    async delete(
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> {
      try {
        const deleted = await deleteConversation(codexRuntime, req.params.id);
        if (!deleted) {
          throw new NotFoundError(`Conversation ${req.params.id} not found`);
        }
        reply.code(204).send();
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw error;
        }
        if (error instanceof Error && error.message.includes("not found")) {
          throw new NotFoundError(`Conversation ${req.params.id} not found`);
        }
        throw error;
      }
    },
  };
}
