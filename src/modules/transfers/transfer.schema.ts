import { z } from 'zod';

export const createTransferSchema = z
  .object({
    from_account_id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    to_account_id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    amount: z.string().min(1).max(32),
    description: z.string().trim().min(1).max(500),
    reference_id: z.string().trim().min(1).max(100),
  })
  .strict();

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
