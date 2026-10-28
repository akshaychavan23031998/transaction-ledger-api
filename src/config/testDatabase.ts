export const TEST_DATABASE_NAME_PATTERN = /^transaction_ledger_test_[a-zA-Z0-9_-]+$/;

export function assertSafeTestDatabaseName(databaseName: string): void {
  if (!TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(
      `Unsafe test database name: ${databaseName}. Expected transaction_ledger_test_<run-id>`,
    );
  }
}
