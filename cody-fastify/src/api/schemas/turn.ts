import { z } from "zod";

export const TurnQuerySchema = z.object({
  thinkingLevel: z.enum(["none", "full"]).optional(),
  toolLevel: z.enum(["none", "full"]).optional(),
  thinkingFormat: z.enum(["none", "summary", "full"]).optional(),
  toolFormat: z.enum(["none", "summary", "full"]).optional(),
});

export const TurnStatusResponseSchema = z.object({
  turnId: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: z.enum(["running", "completed", "error"]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  result: z.unknown().optional(),
  thinking: z.array(z.object({ text: z.string() })).optional(),
  toolCalls: z.array(
    z.object({
      name: z.string(),
      callId: z.string(),
      input: z.unknown(),
      output: z.unknown(),
    }),
  ).optional(),
  modelProviderId: z.string().optional(),
  modelProviderApi: z.string().optional(),
  model: z.string().optional(),
});

export type TurnQueryParams = z.infer<typeof TurnQuerySchema>;
export type TurnStatusResponse = z.infer<typeof TurnStatusResponseSchema>;
