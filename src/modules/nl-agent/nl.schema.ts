import { z } from 'zod';

export const executeSchema = z.object({
  message: z.string().min(1).max(500),
  conversation_id: z.string().optional(),
});

export const confirmSchema = z.object({
  conversation_id: z.string().min(1),
  confirmation_id: z.string().min(1),
  confirmed: z.boolean(),
});

export type ExecuteInput = z.infer<typeof executeSchema>;
export type ConfirmInput = z.infer<typeof confirmSchema>;
