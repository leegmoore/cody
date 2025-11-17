import type { FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ValidationError } from "../errors/api-errors.js";
import type { SubmitMessageBody } from "../schemas/message.js";
import { getConversation } from "../services/conversation-service.js";
import { validateProviderApi } from "../services/conversation-service.js";
import { randomUUID } from "node:crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMessageHandlers(_manager: any) {
  return {
    async submit(
      req: FastifyRequest<{
        Params: { id: string };
        Body: SubmitMessageBody;
      }>,
      reply: FastifyReply,
    ): Promise<void> {
      // Check conversation exists
      const conversation = await getConversation(req.params.id);
      if (!conversation) {
        throw new NotFoundError(
          `Conversation ${req.params.id} not found`,
        );
      }

      // Validate message not empty
      if (!req.body.message || req.body.message.trim().length === 0) {
        throw new ValidationError("Message cannot be empty");
      }

      // Validate provider/API override if provided
      if (
        req.body.modelProviderId ||
        req.body.modelProviderApi ||
        req.body.model
      ) {
        if (
          !req.body.modelProviderId ||
          !req.body.modelProviderApi ||
          !req.body.model
        ) {
          throw new ValidationError(
            "If providing model override, all three fields (modelProviderId, modelProviderApi, model) must be provided together",
          );
        }

        const validation = validateProviderApi(
          req.body.modelProviderId,
          req.body.modelProviderApi,
        );
        if (!validation.valid) {
          throw new ValidationError(validation.error || "Invalid provider/API combination");
        }
      }

      // Generate turnId
      const turnId = randomUUID();

      // Return 202 immediately with turnId and URLs
      reply.code(202).send({
        turnId,
        conversationId: req.params.id,
        streamUrl: `/api/v1/turns/${turnId}/stream-events`,
        statusUrl: `/api/v1/turns/${turnId}`,
      });
    },
  };
}
