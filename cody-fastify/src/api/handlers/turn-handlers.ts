import type { FastifyRequest, FastifyReply } from "fastify";
import type { TurnQueryParams } from "../schemas/turn.js";
import { randomUUID } from "node:crypto";

export function buildTurnHandlers() {
  return {
    async getStatus(
      req: FastifyRequest<{
        Params: { id: string };
        Querystring: TurnQueryParams;
      }>,
      reply: FastifyReply,
    ): Promise<void> {
      // Mock implementation - return completed status
      // TODO: Implement real turn status tracking
      const turnId = req.params.id;

      // Validate turnId is a UUID, if not use it anyway (for mock)
      // For now, return mock completed status with valid UUIDs
      reply.code(200).send({
        turnId: turnId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? turnId : randomUUID(),
        conversationId: randomUUID(), // TODO: Get from turn storage
        status: "completed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
    },

    async streamEvents(
      req: FastifyRequest<{
        Params: { id: string };
        Querystring: TurnQueryParams;
      }>,
      reply: FastifyReply,
    ): Promise<void> {
      // Mock implementation - return mock SSE stream
      // TODO: Implement real SSE streaming from Redis
      const _turnId = req.params.id;

      // Set SSE headers
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");

      // Send mock events
      const events = [
        { id: "1", type: "task_started", data: { type: "task_started" } },
        {
          id: "2",
          type: "agent_message",
          data: { type: "agent_message", message: "Mock response" },
        },
        { id: "3", type: "task_complete", data: { type: "task_complete" } },
      ];

      for (const event of events) {
        reply.raw.write(`id: ${event.id}\n`);
        reply.raw.write(`event: cody-event\n`);
        reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);
      }

      reply.raw.end();
    },
  };
}
