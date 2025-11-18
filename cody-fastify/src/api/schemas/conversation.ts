import { z } from "zod";

export const CreateConversationSchema = z.object({
  modelProviderId: z.string().min(1),
  modelProviderApi: z.string().min(1),
  model: z.string().min(1),
  title: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  agentRole: z.string().optional(),
});

export const ListConversationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.union([z.number(), z.string()]).optional(),
});

export const UpdateConversationSchema = z
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

export const ConversationResponseSchema = z.object({
  conversationId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  modelProviderId: z.string(),
  modelProviderApi: z.string(),
  model: z.string(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  parent: z.string().nullable(),
  tags: z.array(z.string()),
  agentRole: z.string().nullable(),
  history: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
    }),
  ),
});

export const ListConversationsResponseSchema = z.object({
  conversations: z.array(ConversationResponseSchema),
  nextCursor: z.string().nullable(),
});

// Inferred types
export type CreateConversationBody = z.infer<typeof CreateConversationSchema>;
export type ListConversationsQuery = z.infer<
  typeof ListConversationsQuerySchema
>;
export type UpdateConversationBody = z.infer<typeof UpdateConversationSchema>;
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;
