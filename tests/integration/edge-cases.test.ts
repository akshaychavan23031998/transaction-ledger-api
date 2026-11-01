import request from 'supertest';

import { app } from '../../src/app';
import { MAX_AMOUNT_MINOR, formatMinorUnits } from '../../src/common/utils/money';
import { LedgerModel } from '../../src/modules/ledger/ledger.model';

async function createAccount(name: string): Promise<string> {
  const response = await request(app).post('/api/v1/accounts').send({ account_holder_name: name });
  expect(response.status).toBe(201);
  return response.body.data.account_id as string;
}

describe('edge cases and API contracts', () => {
  it('returns consistent errors for missing accounts and invalid IDs', async () => {
    const missing = 'acc_missing';
    const responses = await Promise.all([
      request(app).get(`/api/v1/accounts/${missing}/balance`),
      request(app).get(`/api/v1/accounts/${missing}/transactions`),
      request(app).post('/api/v1/transactions').send({
        account_id: missing,
        type: 'credit',
        amount: '1.00',
        description: 'missing',
        reference_id: 'missing-1',
      }),
      request(app).post('/api/v1/transfers').send({
        from_account_id: missing,
        to_account_id: 'acc_other',
        amount: '1.00',
        description: 'missing',
        reference_id: 'missing-transfer',
      }),
      request(app).get('/api/v1/accounts/not valid/balance'),
    ]);

    expect(responses.slice(0, 4).map((response) => response.status)).toEqual([404, 404, 404, 404]);
    expect(responses[4].status).toBe(400);
    for (const response of responses) {
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      expect(response.body.request_id).toBeDefined();
    }
  });

  it('rejects invalid pagination and unknown mutation fields', async () => {
    const accountId = await createAccount('Validation');
    const invalidPagination = await request(app)
      .get(`/api/v1/accounts/${accountId}/transactions`)
      .query({ page: 0, limit: 101 });
    const unknownAccountField = await request(app)
      .post('/api/v1/accounts')
      .send({ account_holder_name: 'Invalid', balance: '10.00' });
    const unknownTransferField = await request(app).post('/api/v1/transfers').send({
      from_account_id: accountId,
      to_account_id: 'acc_destination',
      amount: '1.00',
      description: 'Invalid',
      reference_id: 'invalid-transfer',
      balance_minor: 1,
    });

    expect(invalidPagination.status).toBe(400);
    expect(unknownAccountField.status).toBe(400);
    expect(unknownTransferField.status).toBe(400);
  });

  it('matches documented success envelopes for every financial response', async () => {
    const source = await createAccount('Contract source');
    const destination = await createAccount('Contract destination');
    const credit = await request(app).post('/api/v1/transactions').send({
      account_id: source,
      type: 'credit',
      amount: '10.00',
      description: 'Contract funding',
      reference_id: 'contract-funding',
    });
    const balance = await request(app).get(`/api/v1/accounts/${source}/balance`);
    const history = await request(app).get(`/api/v1/accounts/${source}/transactions`);
    const transfer = await request(app).post('/api/v1/transfers').send({
      from_account_id: source,
      to_account_id: destination,
      amount: '2.50',
      description: 'Contract transfer',
      reference_id: 'contract-transfer',
    });

    for (const response of [credit, balance, history, transfer]) {
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
      expect(response.body).toEqual(
        expect.objectContaining({ success: true, request_id: expect.any(String) }),
      );
      expect(response.headers['x-request-id']).toBe(response.body.request_id);
    }
    expect(credit.body.data).toEqual(
      expect.objectContaining({
        transaction_id: expect.any(String),
        account_id: source,
        type: 'credit',
        amount: '10.00',
        balance: '10.00',
        description: 'Contract funding',
        reference_id: 'contract-funding',
        idempotent_replay: false,
      }),
    );
    expect(balance.body.data).toEqual(
      expect.objectContaining({ account_id: source, balance: '10.00', currency: 'USD' }),
    );
    expect(history.body.data).toEqual(
      expect.objectContaining({
        account_id: source,
        data: expect.any(Array),
        pagination: expect.any(Object),
      }),
    );
    expect(transfer.body.data).toEqual(
      expect.objectContaining({
        transfer_id: expect.any(String),
        from_account_id: source,
        to_account_id: destination,
        amount: '2.50',
        reference_id: 'contract-transfer',
        description: 'Contract transfer',
        ledger_transaction_ids: expect.any(Array),
        balances: expect.any(Object),
        idempotent_replay: false,
        created_at: expect.any(String),
      }),
    );
  });

  it('supports duplicate debit replay, conflicts, and cross-account references', async () => {
    const accountA = await createAccount('Debit A');
    const accountB = await createAccount('Debit B');
    await request(app).post('/api/v1/transactions').send({
      account_id: accountA,
      type: 'credit',
      amount: '100.00',
      description: 'fund',
      reference_id: 'fund-a',
    });
    const debit = {
      account_id: accountA,
      type: 'debit',
      amount: '25.00',
      description: 'debit',
      reference_id: 'shared-reference',
    };
    const first = await request(app).post('/api/v1/transactions').send(debit);
    const replay = await request(app).post('/api/v1/transactions').send(debit);
    const conflict = await request(app)
      .post('/api/v1/transactions')
      .send({ ...debit, amount: '26.00' });
    const otherAccount = await request(app)
      .post('/api/v1/transactions')
      .send({
        ...debit,
        account_id: accountB,
        type: 'credit',
        amount: '1.00',
      });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(otherAccount.status).toBe(201);
    expect(first.body.data.transaction_id).toBe(replay.body.data.transaction_id);
  });

  it('rejects transfer/standalone reference collisions explicitly', async () => {
    const source = await createAccount('Collision source');
    const destination = await createAccount('Collision destination');
    await request(app).post('/api/v1/transactions').send({
      account_id: source,
      type: 'credit',
      amount: '10.00',
      description: 'fund',
      reference_id: 'collision-reference',
    });
    const response = await request(app).post('/api/v1/transfers').send({
      from_account_id: source,
      to_account_id: destination,
      amount: '1.00',
      description: 'collision',
      reference_id: 'collision-reference',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('enforces the actual database unique ledger index', async () => {
    const base = {
      account_id: 'acc_index_test',
      type: 'credit' as const,
      amount_minor: 100,
      balance_after_minor: 100,
      description: 'index test',
      reference_id: 'unique-index-reference',
    };
    await LedgerModel.create({ ...base, transaction_id: 'txn_index_1' });
    await expect(
      LedgerModel.create({ ...base, transaction_id: 'txn_index_2' }),
    ).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('accepts the maximum balance once and rejects overflow', async () => {
    const accountId = await createAccount('Maximum balance');
    const maximum = formatMinorUnits(MAX_AMOUNT_MINOR);
    const maximumCredit = await request(app).post('/api/v1/transactions').send({
      account_id: accountId,
      type: 'credit',
      amount: maximum,
      description: 'maximum',
      reference_id: 'maximum-credit',
    });
    const overflow = await request(app).post('/api/v1/transactions').send({
      account_id: accountId,
      type: 'credit',
      amount: '0.01',
      description: 'overflow',
      reference_id: 'overflow-credit',
    });

    expect(maximumCredit.status).toBe(201);
    expect(overflow.status).toBe(400);
    expect(overflow.body.error.code).toBe('INVALID_AMOUNT');
  });

  it('proves latest-first ordering and Swagger UI availability', async () => {
    const accountId = await createAccount('Ordering');
    for (const referenceId of ['order-1', 'order-2', 'order-3']) {
      await request(app).post('/api/v1/transactions').send({
        account_id: accountId,
        type: 'credit',
        amount: '1.00',
        description: referenceId,
        reference_id: referenceId,
      });
    }
    const history = await request(app).get(`/api/v1/accounts/${accountId}/transactions?limit=100`);
    const swagger = await request(app).get('/api-docs').redirects(1);
    expect(
      history.body.data.data.map((entry: { reference_id: string }) => entry.reference_id),
    ).toEqual(['order-3', 'order-2', 'order-1']);
    expect(swagger.status).toBe(200);
    expect(swagger.text).toContain('swagger-ui');
  });

  it('serves Swagger UI assets with executable content types', async () => {
    const assets = [
      ['swagger-ui.css', 'text/css'],
      ['swagger-ui-bundle.js', 'javascript'],
      ['swagger-ui-standalone-preset.js', 'javascript'],
      ['swagger-ui-init.js', 'javascript'],
    ] as const;

    for (const [asset, contentType] of assets) {
      const response = await request(app).get(`/api-docs/${asset}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(contentType);
      expect(response.text).not.toContain('<!DOCTYPE html>');
    }
  });
});
