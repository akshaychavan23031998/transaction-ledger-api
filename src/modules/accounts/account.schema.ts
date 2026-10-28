import { z } from 'zod';

export const createAccountSchema = z
  .object({
    account_holder_name: z.string().trim().min(1).max(120),
  })
  .strict();

export const accountIdParamsSchema = z
  .object({
    accountId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  })
  .strict();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
