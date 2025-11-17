import { z } from "zod";

export const SubmitMessageSchema = z.object({
  message: z.string().min(1),
  modelProviderId: z.string().optional(),
  modelProviderApi: z.string().optional(),
  model: z.string().optional(),
});

export const SubmitMessageResponseSchema = z.object({
  turnId: z.string().uuid(),
  conversationId: z.string().uuid(),
  streamUrl: z.string(),
  statusUrl: z.string(),
});

export type SubmitMessageBody = z.infer<typeof SubmitMessageSchema>;
export type SubmitMessageResponse = z.infer<typeof SubmitMessageResponseSchema>;
