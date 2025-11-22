import type { FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ValidationError } from "../errors/api-errors.js";
import type { SubmitMessageBody } from "../schemas/message.js";
import {
  validateProviderApi,
  getConversationMetadataSummary,
} from "../services/conversation-service-codex.js";
import { randomUUID } from "node:crypto";
import type { CodexRuntime } from "../services/codex-runtime.js";
import { clientStreamManager } from "../client-stream/client-stream-manager.js";
import { processMessage } from "../services/message-processor.js";
import { convexClient } from "../services/convex-client.js";
import { api } from "../../../convex/_generated/api.js";

export function buildMessageHandlers(codexRuntime: CodexRuntime) {
  return {
    async submit(
      req: FastifyRequest<{
        Params: { id: string };
        Body: SubmitMessageBody;
      }>,
      reply: FastifyReply,
    ): Promise<void> {
      // Get conversation from Codex
      let conversation;
      try {
        conversation = await codexRuntime.getConversation(req.params.id);
      } catch {
        // Normalize any parsing/lookup errors to 404
        throw new NotFoundError(`Conversation ${req.params.id} not found`);
      }
      if (!conversation) {
        throw new NotFoundError(`Conversation ${req.params.id} not found`);
      }

      // Validate message not empty
      if (!req.body.message || req.body.message.trim().length === 0) {
        throw new ValidationError("Message cannot be empty");
      }

      // Sync User Message to Convex immediately
      // Use fire-and-forget to not block the turn creation, but handle errors
      convexClient
        .mutation(api.messages.add, {
          conversationId: req.params.id, // externalId
          role: "user",
          content: req.body.message,
        })
        .catch((err) => {
          req.log?.error(
            { err, conversationId: req.params.id },
            "Failed to sync user message to Convex",
          );
        });

      // Load conversation metadata for defaults
      const conversationMetadata =
        (await getConversationMetadataSummary(codexRuntime, req.params.id)) ??
        null;

      // Determine effective model/provider for this turn
      let modelProviderId: string | undefined;
      let modelProviderApi: string | undefined;
      let model: string | undefined;

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
          throw new ValidationError(
            validation.error || "Invalid provider/API combination",
          );
        }

        modelProviderId = req.body.modelProviderId;
        modelProviderApi = req.body.modelProviderApi;
        model = req.body.model;
      } else {
        // Use conversation defaults (fall back to runtime config)
        const config = codexRuntime.getConfig();
        modelProviderId =
          conversationMetadata?.modelProviderId ?? config.modelProviderId;
        modelProviderApi =
          conversationMetadata?.modelProviderApi ?? config.modelProviderApi;
        model = conversationMetadata?.model ?? config.model;
      }

      // Generate turnId
      const turnId = randomUUID();

      // Send message via Codex (this returns submission ID)
      // NOTE: Overrides (modelProviderId/modelProviderApi/model) are validated and stored
      // in the turn record above, but Codex's conversation.sendMessage() uses the
      // conversation's original config. To fully support per-turn overrides, we would
      // need to either:
      // 1. Modify codex-ts to accept config overrides in the user_turn Op, or
      // 2. Create a new conversation with updated config (not ideal for history continuity)
      // For now, the turn record stores what was requested, but Codex uses the original config.
      const submissionId = await conversation.sendMessage(req.body.message);

      // Create turn record
      await clientStreamManager.createTurn(
        turnId,
        req.params.id,
        submissionId,
        modelProviderId,
        modelProviderApi,
        model,
      );

      // Start async processing of events
      // Don't await - let it run in background
      processMessage(conversation, submissionId, turnId, req.params.id).catch(
        (error) => {
          req.log?.error({ err: error, turnId }, "Error processing message");
        },
      );

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
