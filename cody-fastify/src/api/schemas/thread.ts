import { z } from "zod";
import { ResponseSchema } from "../../core/schema.js";

export const ThreadCreateSchema = z.object({
  modelProviderId: z.string().min(1).default("anthropic"),
  modelProviderApi: z.string().min(1).default("messages"),
  model: z.string().min(1).default("claude-haiku-4.5"),
  title: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  agentRole: z.string().optional(),
});

export const ThreadListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.union([z.number(), z.string()]).optional(),
});

export const ThreadUpdateSchema = z
  .object({
    title: z.string().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).optional(),
    agentRole: z.string().optional(),
    modelProviderId: z.string().optional(),
    modelProviderApi: z.string().optional(),
    model: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const ThreadSummarySchema = z.object({
  threadId: z.string().uuid(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  tags: z.array(z.string()),
  agentRole: z.string().nullable(),
  modelProviderId: z.string().nullable(),
  modelProviderApi: z.string().nullable(),
  model: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ListThreadsResponseSchema = z.object({
  threads: z.array(ThreadSummarySchema),
  nextCursor: z.string().nullable(),
});

export const ThreadWithRunsSchema = z.object({
  thread: ThreadSummarySchema,
  runs: z.array(ResponseSchema),
});

export type ThreadCreateBody = z.infer<typeof ThreadCreateSchema>;
export type ThreadUpdateBody = z.infer<typeof ThreadUpdateSchema>;
export type ThreadListQuery = z.infer<typeof ThreadListQuerySchema>;
export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;
