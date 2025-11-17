import { z } from "zod";

export const TurnQuerySchema = z.object({
  thinkingLevel: z.enum(["none", "full"]).optional(),
  toolLevel: z.enum(["none", "full"]).optional(),
});

export const TurnStatusResponseSchema = z.object({
  turnId: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: z.enum(["running", "completed", "error"]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export type TurnQueryParams = z.infer<typeof TurnQuerySchema>;
export type TurnStatusResponse = z.infer<typeof TurnStatusResponseSchema>;
