import mongoose from 'mongoose';

import { env } from './env';
import { AccountModel } from '../modules/accounts/account.model';
import { LedgerModel } from '../modules/ledger/ledger.model';
import { TransferModel } from '../modules/transfers/transfer.model';
export { assertSafeTestDatabaseName } from './testDatabase';

export async function connectDatabase(
  uri = env.MONGODB_URI,
  databaseName = process.env.MONGODB_DB_NAME ?? env.MONGODB_DB_NAME,
): Promise<void> {
  await mongoose.connect(uri, {
    dbName: databaseName,
    serverSelectionTimeoutMS: 5000,
  });
}

export async function initializeDatabase(): Promise<void> {
  await Promise.all([
    AccountModel.createIndexes(),
    LedgerModel.createIndexes(),
    TransferModel.createIndexes(),
  ]);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
