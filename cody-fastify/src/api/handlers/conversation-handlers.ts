import type { FastifyRequest, FastifyReply } from "fastify";
import {
  ValidationError,
  NotFoundError,
} from "../errors/api-errors.js";
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
} from "../services/conversation-service.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildConversationHandlers(_manager: any) {
  return {
    async create(
      req: FastifyRequest<{ Body: CreateConversationBody }>,
      reply: FastifyReply,
    ): Promise<void> {
      try {
        const conversation = await createConversation(req.body);
        reply.code(201).send(conversation);
      } catch (error) {
        // Log the error for debugging
        req.log?.error({ err: error }, "Error in create conversation handler");
        
        if (error instanceof Error) {
          if (error.message.includes("does not support")) {
            throw new ValidationError(error.message);
          }
          if (error.message.includes("Unsupported provider")) {
            throw new ValidationError(error.message);
          }
          // Re-throw AppError instances
          if (error instanceof ValidationError) {
            throw error;
          }
          // For file system errors, wrap as internal error but don't expose details
          if (
            error.message.includes("Failed to create conversation") ||
            error.message.includes("Failed to create conversations directory") ||
            error.message.includes("Failed to write conversation file")
          ) {
            // Log the actual error but return a generic message
            req.log?.error(error, "File system error creating conversation");
            throw new Error("Failed to create conversation");
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
      const limit =
        typeof req.query.limit === "string"
          ? parseInt(req.query.limit, 10)
          : req.query.limit;

      const result = await listConversations({
        cursor: req.query.cursor,
        limit,
      });

      reply.code(200).send(result);
    },

    async get(
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> {
      const conversation = await getConversation(req.params.id);
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
          req.params.id,
          req.body,
        );
        reply.code(200).send(conversation);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Conversation not found"
        ) {
          throw new NotFoundError(`Conversation ${req.params.id} not found`);
        }
        if (error instanceof Error && error.message.includes("does not support")) {
          throw new ValidationError(error.message);
        }
        throw error;
      }
    },

    async delete(
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> {
      const deleted = await deleteConversation(req.params.id);
      if (!deleted) {
        throw new NotFoundError(`Conversation ${req.params.id} not found`);
      }

      reply.code(204).send();
    },
  };
}
