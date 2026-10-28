import request from 'supertest';

import { app } from '../../src/app';

async function createAccount(name: string) {
  const response = await request(app).post('/api/v1/accounts').send({ account_holder_name: name });
  expect(response.status).toBe(201);
  return response.body.data.account_id as string;
}

describe('Transaction Ledger API', () => {
  it('creates accounts with a forced zero balance', async () => {
    const response = await request(app)
      .post('/api/v1/accounts')
      .set('x-request-id', 'integration-account')
      .send({ account_holder_name: 'Ada Lovelace' });

    expect(response.status).toBe(201);
    expect(response.headers['x-request-id']).toBe('integration-account');
    expect(response.body.data.balance).toBe('0.00');
    expect(response.body.data.currency).toBe('USD');
  });

  it('rejects unexpected mutation fields and malformed money', async () => {
    const accountId = await createAccount('Grace Hopper');
    const response = await request(app).post('/api/v1/transactions').send({
      account_id: accountId,
      type: 'credit',
      amount: '1.001',
      description: 'bad',
      reference_id: 'bad-1',
      balance_minor: 999999,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('applies credits, debits, exact debits, and prevents overdrafts', async () => {
    const accountId = await createAccount('Katherine Johnson');
    const credit = await request(app).post('/api/v1/transactions').send({
      account_id: accountId,
      type: 'credit',
      amount: '100.00',
      description: 'Funding',
      reference_id: 'funding-1',
    });
    expect(credit.status).toBe(201);
    expect(credit.body.data.balance).toBe('100.00');

    const debit = await request(app).post('/api/v1/transactions').send({
      account_id: accountId,
      type: 'debit',
      amount: '100.00',
      description: 'Withdrawal',
      reference_id: 'withdrawal-1',
    });
    expect(debit.status).toBe(201);
    expect(debit.body.data.balance).toBe('0.00');

    const overdraft = await request(app).post('/api/v1/transactions').send({
      account_id: accountId,
      type: 'debit',
      amount: '0.01',
      description: 'Too much',
      reference_id: 'withdrawal-2',
    });
    expect(overdraft.status).toBe(409);
    expect(overdraft.body.error.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('replays identical references and rejects conflicting references', async () => {
    const accountId = await createAccount('Mary Jackson');
    const payload = {
      account_id: accountId,
      type: 'credit',
      amount: '10.00',
      description: 'Retry me',
      reference_id: 'same-reference',
    };
    const first = await request(app).post('/api/v1/transactions').send(payload);
    const retry = await request(app).post('/api/v1/transactions').send(payload);
    const conflict = await request(app)
      .post('/api/v1/transactions')
      .send({ ...payload, amount: '11.00' });

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data.idempotent_replay).toBe(true);
    expect(retry.body.data.transaction_id).toBe(first.body.data.transaction_id);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const balance = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
    expect(balance.body.data.balance).toBe('10.00');
  });

  it('supports filtered, latest-first paginated history', async () => {
    const accountId = await createAccount('Dorothy Vaughan');
    for (const [index, type] of (['credit', 'credit', 'debit'] as const).entries()) {
      await request(app)
        .post('/api/v1/transactions')
        .send({
          account_id: accountId,
          type,
          amount: '1.00',
          description: `${type}-${index}`,
          reference_id: `history-${index}`,
        });
    }

    const response = await request(app)
      .get(`/api/v1/accounts/${accountId}/transactions`)
      .query({ type: 'credit', page: 1, limit: 1 });
    expect(response.status).toBe(200);
    expect(response.body.data.data).toHaveLength(1);
    expect(response.body.data.data[0].type).toBe('credit');
    expect(response.body.data.pagination.total_records).toBe(2);
    expect(response.body.data.pagination.total_pages).toBe(2);
  });

  it('creates an atomic, idempotent transfer with linked ledger entries', async () => {
    const source = await createAccount('Source');
    const destination = await createAccount('Destination');
    await request(app).post('/api/v1/transactions').send({
      account_id: source,
      type: 'credit',
      amount: '50.00',
      description: 'Funding',
      reference_id: 'source-funding',
    });

    const payload = {
      from_account_id: source,
      to_account_id: destination,
      amount: '25.50',
      description: 'Transfer',
      reference_id: 'transfer-1',
    };
    const response = await request(app).post('/api/v1/transfers').send(payload);
    const replay = await request(app).post('/api/v1/transfers').send(payload);
    expect(response.status).toBe(201);
    expect(response.body.data.ledger_transaction_ids).toHaveLength(2);
    expect(replay.status).toBe(200);

    const sourceBalance = await request(app).get(`/api/v1/accounts/${source}/balance`);
    const destinationBalance = await request(app).get(`/api/v1/accounts/${destination}/balance`);
    expect(sourceBalance.body.data.balance).toBe('24.50');
    expect(destinationBalance.body.data.balance).toBe('25.50');
  });

  it('serves health and raw OpenAPI documentation', async () => {
    const health = await request(app).get('/health');
    const docs = await request(app).get('/api-docs.json');
    expect(health.status).toBe(200);
    expect(docs.status).toBe(200);
    expect(docs.body.openapi).toBe('3.0.3');
  });
});
