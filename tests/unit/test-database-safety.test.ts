import { assertSafeTestDatabaseName } from '../../src/config/testDatabase';

describe('test database safety', () => {
  it('accepts only explicitly test-designated database names', () => {
    expect(() => assertSafeTestDatabaseName('transaction_ledger_test_123')).not.toThrow();
    expect(() => assertSafeTestDatabaseName('transaction_ledger')).toThrow('Unsafe test database');
    expect(() => assertSafeTestDatabaseName('transaction_ledger_dev')).toThrow(
      'Unsafe test database',
    );
  });
});
