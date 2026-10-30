import { assertSafeTestDatabaseName } from '../../src/config/testDatabase';

process.env.NODE_ENV = 'test';

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI =
    'mongodb://localhost:27017/transaction_ledger?replicaSet=rs0&directConnection=true';
}

const configuredDatabaseName = process.env.MONGODB_DB_NAME;
if (configuredDatabaseName) {
  assertSafeTestDatabaseName(configuredDatabaseName);
} else {
  process.env.MONGODB_DB_NAME = `transaction_ledger_test_${process.pid}`;
}
