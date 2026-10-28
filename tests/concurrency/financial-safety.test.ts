import request from 'supertest';

import { app } from '../../src/app';

async function createAccount(name: string) {
  const response = await request(app).post('/api/v1/accounts').send({ account_holder_name: name });
  expect(response.status).toBe(201);
  return response.body.data.account_id as string;
}

describe('financial concurrency', () => {
  it('applies a concurrent duplicate only once', async () => {
    const accountId = await createAccount('Concurrent Duplicate');
    const payload = {
      account_id: accountId,
      type: 'credit',
      amount: '20.00',
      description: 'Concurrent retry',
      reference_id: 'concurrent-same-reference',
    };

    const responses = await Promise.all([
      request(app).post('/api/v1/transactions').send(payload),
      request(app).post('/api/v1/transactions').send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    const balance = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
    expect(balance.body.data.balance).toBe('20.00');
  });

  it('allows only one of two concurrent debits to spend the same funds', async () => {
    const accountId = await createAccount('Concurrent Debits');
    await request(app).post('/api/v1/transactions').send({
      account_id: accountId,
      type: 'credit',
      amount: '100.00',
      description: 'Funding',
      reference_id: 'concurrent-funding',
    });

    const responses = await Promise.all([
      request(app).post('/api/v1/transactions').send({
        account_id: accountId,
        type: 'debit',
        amount: '80.00',
        description: 'A',
        reference_id: 'debit-a',
      }),
      request(app).post('/api/v1/transactions').send({
        account_id: accountId,
        type: 'debit',
        amount: '80.00',
        description: 'B',
        reference_id: 'debit-b',
      }),
    ]);

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(
      responses.filter((response) => response.body.error?.code === 'INSUFFICIENT_FUNDS'),
    ).toHaveLength(1);
    const balance = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
    expect(balance.body.data.balance).toBe('20.00');
  });

  it('applies a concurrent duplicate debit only once', async () => {
    const accountId = await createAccount('Concurrent Duplicate Debit');
    await request(app).post('/api/v1/transactions').send({
      account_id: accountId,
      type: 'credit',
      amount: '100.00',
      description: 'Funding',
      reference_id: 'duplicate-debit-funding',
    });
    const payload = {
      account_id: accountId,
      type: 'debit',
      amount: '30.00',
      description: 'Concurrent debit retry',
      reference_id: 'duplicate-debit-reference',
    };
    const responses = await Promise.all([
      request(app).post('/api/v1/transactions').send(payload),
      request(app).post('/api/v1/transactions').send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    const balance = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
    expect(balance.body.data.balance).toBe('70.00');
  });

  it('returns one success and one idempotency conflict for concurrent conflicting references', async () => {
    const accountId = await createAccount('Concurrent Conflicting Reference');
    const responses = await Promise.all([
      request(app).post('/api/v1/transactions').send({
        account_id: accountId,
        type: 'credit',
        amount: '10.00',
        description: 'First payload',
        reference_id: 'conflicting-concurrent-reference',
      }),
      request(app).post('/api/v1/transactions').send({
        account_id: accountId,
        type: 'credit',
        amount: '11.00',
        description: 'Second payload',
        reference_id: 'conflicting-concurrent-reference',
      }),
    ]);

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(
      responses.filter((response) => response.body.error?.code === 'IDEMPOTENCY_CONFLICT'),
    ).toHaveLength(1);
    const balance = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
    expect(['10.00', '11.00']).toContain(balance.body.data.balance);
  });

  it('commits one concurrent transfer and replays the other', async () => {
    const source = await createAccount('Concurrent transfer source');
    const destination = await createAccount('Concurrent transfer destination');
    await request(app).post('/api/v1/transactions').send({
      account_id: source,
      type: 'credit',
      amount: '100.00',
      description: 'Funding',
      reference_id: 'concurrent-transfer-funding',
    });
    const payload = {
      from_account_id: source,
      to_account_id: destination,
      amount: '40.00',
      description: 'Concurrent transfer',
      reference_id: 'concurrent-transfer-reference',
    };
    const responses = await Promise.all([
      request(app).post('/api/v1/transfers').send(payload),
      request(app).post('/api/v1/transfers').send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    const sourceBalance = await request(app).get(`/api/v1/accounts/${source}/balance`);
    const destinationBalance = await request(app).get(`/api/v1/accounts/${destination}/balance`);
    expect(sourceBalance.body.data.balance).toBe('60.00');
    expect(destinationBalance.body.data.balance).toBe('40.00');
  });

  it('preserves all concurrent unique credits', async () => {
    const accountId = await createAccount('Concurrent Credits');
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        request(app)
          .post('/api/v1/transactions')
          .send({
            account_id: accountId,
            type: 'credit',
            amount: '1.00',
            description: 'Concurrent credit',
            reference_id: `credit-${index}`,
          }),
      ),
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);
    const balance = await request(app).get(`/api/v1/accounts/${accountId}/balance`);
    expect(balance.body.data.balance).toBe('10.00');
  });
});
