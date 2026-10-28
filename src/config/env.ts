import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z
    .string()
    .min(1)
    .default('mongodb://localhost:27017/transaction_ledger?replicaSet=rs0&directConnection=true'),
  MONGODB_DB_NAME: z.string().min(1).default('transaction_ledger'),
  TRANSACTION_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
});

export const env = envSchema.parse(process.env);
