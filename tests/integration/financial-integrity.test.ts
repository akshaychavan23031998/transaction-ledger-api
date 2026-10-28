import request from 'supertest';

import { app } from '../../src/app';
import { MAX_AMOUNT_MINOR, formatMinorUnits } from '../../src/common/utils/money';
import { setFaultInjection } from '../../src/common/utils/faultInjection';
import { LedgerModel } from '../../src/modules/ledger/ledger.model';
import { TransferModel } from '../../src/modules/transfers/transfer.model';

async function createAccount(name: string): Promise<string> {
  const response = await request(app).post('/api/v1/accounts').send({ account_holder_name: name });
  expect(response.status).toBe(201);
  return response.body.data.account_id as string;
}

async function postTransaction(
  accountId: string,
  type: 'credit' | 'debit',
  amount: string,
  referenceId: string,
) {
  return request(app).post('/api/v1/transactions').send({
    account_id: accountId,
    type,
    amount,
    description: referenceId,
    reference_id: referenceId,
  });
}

async function balance(accountId: string): Promise<string> {
  const response = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
  return response.body.data.balance as string;
}

describe('financial integrity and rollback', () => {
  it('rolls back a balance when ledger insertion is forced to fail', async () => {
    const accountId = await createAccount('Ledger rollback');
    setFaultInjection('ledger_after_balance_update');

    const response = await postTransaction(accountId, 'credit', '12.00', 'rollback-credit');
    expect(response.status).toBe(500);
    expect(await balance(accountId)).toBe('0.00');

    const history = await request(app).get(`/api/v1/accounts/${accountId}/transactions`);
    expect(history.body.data.pagination.total_records).toBe(0);
  });

  it('does not create a ledger entry when balance mutation fails before execution', async () => {
    const accountId = await createAccount('Balance failure');
    setFaultInjection('ledger_before_balance_update');

    const response = await postTransaction(accountId, 'credit', '12.00', 'balance-failure');
    expect(response.status).toBe(500);
    expect(await balance(accountId)).toBe('0.00');
    expect(await LedgerModel.countDocuments({ account_id: accountId })).toBe(0);
  });

  it.each([
    'transfer_after_source_balance',
    'transfer_after_destination_balance',
    'transfer_after_debit_ledger',
  ] as const)('rolls back every transfer write at %s', async (faultPoint) => {
    const source = await createAccount(`Source ${faultPoint}`);
    const destination = await createAccount(`Destination ${faultPoint}`);
    await postTransaction(source, 'credit', '50.00', `fund-${faultPoint}`);
    setFaultInjection(faultPoint);

    const response = await request(app)
      .post('/api/v1/transfers')
      .send({
        from_account_id: source,
        to_account_id: destination,
        amount: '25.00',
        description: 'rollback transfer',
        reference_id: `transfer-${faultPoint}`,
      });

    expect(response.status).toBe(500);
    expect(await balance(source)).toBe('50.00');
    expect(await balance(destination)).toBe('0.00');
    expect(await TransferModel.countDocuments()).toBe(0);
    expect(await LedgerModel.countDocuments({ transfer_id: { $exists: true } })).toBe(0);
  });

  it('rolls back source debit when the destination is already at maximum balance', async () => {
    const source = await createAccount('Overflow source');
    const destination = await createAccount('Overflow destination');
    await postTransaction(source, 'credit', '5.00', 'overflow-source-funding');
    await postTransaction(
      destination,
      'credit',
      formatMinorUnits(MAX_AMOUNT_MINOR),
      'overflow-destination-funding',
    );

    const response = await request(app).post('/api/v1/transfers').send({
      from_account_id: source,
      to_account_id: destination,
      amount: '0.01',
      description: 'overflow transfer',
      reference_id: 'overflow-transfer',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_AMOUNT');
    expect(await balance(source)).toBe('5.00');
    expect(await balance(destination)).toBe(formatMinorUnits(MAX_AMOUNT_MINOR));
    expect(await TransferModel.countDocuments()).toBe(0);
    expect(await LedgerModel.countDocuments({ transfer_id: { $exists: true } })).toBe(0);
  });

  it('reconciles stored balance with committed ledger deltas', async () => {
    const accountId = await createAccount('Reconciliation');
    await postTransaction(accountId, 'credit', '10.00', 'reconcile-credit-1');
    await postTransaction(accountId, 'credit', '2.00', 'reconcile-credit-2');
    await postTransaction(accountId, 'debit', '3.00', 'reconcile-debit-1');

    const history = await request(app).get(`/api/v1/accounts/${accountId}/transactions?limit=100`);
    const delta = history.body.data.data.reduce(
      (sum: number, entry: { type: 'credit' | 'debit'; amount: string }) =>
        sum + (entry.type === 'credit' ? 1 : -1) * Number(entry.amount),
      0,
    );
    expect(delta).toBe(9);
    expect(await balance(accountId)).toBe('9.00');
  });
});
