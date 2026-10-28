import { connectDatabase, disconnectDatabase, initializeDatabase } from '../src/config/database';
import { AccountModel } from '../src/modules/accounts/account.model';
import { LedgerModel } from '../src/modules/ledger/ledger.model';
import { TransferModel } from '../src/modules/transfers/transfer.model';

async function main(): Promise<void> {
  await connectDatabase();
  await initializeDatabase();
  const [accounts, ledger, transfers] = await Promise.all([
    AccountModel.collection.indexes(),
    LedgerModel.collection.indexes(),
    TransferModel.collection.indexes(),
  ]);
  console.log(
    JSON.stringify(
      {
        status: 'initialized',
        indexes: { accounts, ledger, transfers },
      },
      null,
      2,
    ),
  );
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await disconnectDatabase();
  process.exitCode = 1;
});
