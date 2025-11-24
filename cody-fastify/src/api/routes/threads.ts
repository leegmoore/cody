import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  ThreadCreateSchema,
  ThreadListQuerySchema,
  ThreadSummarySchema,
  ThreadUpdateSchema,
  ThreadWithRunsSchema,
  ListThreadsResponseSchema,
} from "../schemas/thread.js";
import {
  createThread,
  deleteThread,
  getThreadWithRuns,
  listThreads,
  updateThread,
} from "../services/thread-service.js";
import { NotFoundError } from "../errors/api-errors.js";

const ThreadParamsSchema = z.object({ id: z.string().uuid() });

export async function registerThreadRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/threads",
    {
      schema: {
        querystring: ThreadListQuerySchema,
        response: {
          200: ListThreadsResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await listThreads(req.query);
      reply.send(result);
    },
  );

  typed.post(
    "/threads",
    {
      schema: {
        body: ThreadCreateSchema,
        response: {
          201: ThreadSummarySchema,
        },
      },
    },
    async (req, reply) => {
      const thread = await createThread(req.body);
      reply.code(201).send(thread);
    },
  );

  typed.get(
    "/threads/:id",
    {
      schema: {
        params: ThreadParamsSchema,
        response: {
          200: ThreadWithRunsSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await getThreadWithRuns(req.params.id);
      if (!result) {
        throw new NotFoundError(`Thread ${req.params.id} not found`);
      }
      reply.send(result);
    },
  );

  typed.patch(
    "/threads/:id",
    {
      schema: {
        params: ThreadParamsSchema,
        body: ThreadUpdateSchema,
        response: {
          200: ThreadSummarySchema,
        },
      },
    },
    async (req, reply) => {
      const updated = await updateThread(req.params.id, req.body);
      reply.send(updated);
    },
  );

  typed.delete(
    "/threads/:id",
    {
      schema: {
        params: ThreadParamsSchema,
      },
    },
    async (req, reply) => {
      const removed = await deleteThread(req.params.id);
      if (!removed) {
        throw new NotFoundError(`Thread ${req.params.id} not found`);
      }
      reply.code(204).send();
    },
  );
}
