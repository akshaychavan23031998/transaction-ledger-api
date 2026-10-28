import { z } from 'zod';

const baseMutation = {
  account_id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  type: z.enum(['credit', 'debit']),
  amount: z.string().min(1).max(32),
  description: z.string().trim().min(1).max(500),
  reference_id: z.string().trim().min(1).max(100),
};

export const createLedgerSchema = z.object(baseMutation).strict();

export const historyQuerySchema = z
  .object({
    type: z.enum(['credit', 'debit']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

export type CreateLedgerInput = z.infer<typeof createLedgerSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
