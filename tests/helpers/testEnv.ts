import { assertSafeTestDatabaseName } from '../../src/config/testDatabase';

process.env.NODE_ENV = 'test';

const configuredDatabaseName = process.env.MONGODB_DB_NAME;
if (configuredDatabaseName) {
  assertSafeTestDatabaseName(configuredDatabaseName);
} else {
  process.env.MONGODB_DB_NAME = `transaction_ledger_test_${process.pid}`;
}
