import type { ClientSession } from 'mongoose';
import mongoose from 'mongoose';

import { env } from '../../config/env';

export function isTransientTransactionError(error: unknown): boolean {
  if (!(error instanceof mongoose.Error) && !(error instanceof Error)) {
    return false;
  }

  const labels = (error as Error & { errorLabels?: string[] }).errorLabels ?? [];
  const code = (error as Error & { code?: number }).code;
  return (
    labels.includes('TransientTransactionError') ||
    labels.includes('UnknownTransactionCommitResult') ||
    code === 112
  );
}

export async function runInTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= env.TRANSACTION_RETRY_ATTEMPTS; attempt += 1) {
    let session: ClientSession | undefined;
    try {
      session = await mongoose.startSession();
      const activeSession = session;
      let result: T | undefined;
      await activeSession.withTransaction(async () => {
        result = await work(activeSession);
      });
      return result as T;
    } catch (error) {
      lastError = error;
      if (!isTransientTransactionError(error) || attempt === env.TRANSACTION_RETRY_ATTEMPTS) {
        throw error;
      }
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Transaction failed');
}
