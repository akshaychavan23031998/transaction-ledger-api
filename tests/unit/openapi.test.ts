import OpenAPISchemaValidator from 'openapi-schema-validator';

import { openApiDocument } from '../../src/docs/openapi';

describe('OpenAPI contract', () => {
  it('is a valid OpenAPI 3 document with every public route', () => {
    const validator = new OpenAPISchemaValidator({ version: 3 });
    const result = validator.validate(
      openApiDocument as unknown as Parameters<typeof validator.validate>[0],
    );
    expect(result.errors).toEqual([]);
    expect(Object.keys(openApiDocument.paths)).toEqual(
      expect.arrayContaining([
        '/health',
        '/api/v1/accounts',
        '/api/v1/accounts/{accountId}/balance',
        '/api/v1/accounts/{accountId}/transactions',
        '/api/v1/transactions',
        '/api/v1/transfers',
      ]),
    );
  });

  it('declares the runtime response envelope and money constraints', () => {
    const schemas = openApiDocument.components.schemas;
    expect(schemas.AccountResponse.required).toEqual(
      expect.arrayContaining(['success', 'data', 'request_id']),
    );
    expect(schemas.BalanceResponse.required).toEqual(
      expect.arrayContaining(['success', 'data', 'request_id']),
    );
    expect(schemas.HistoryResponse.required).toEqual(
      expect.arrayContaining(['success', 'data', 'request_id']),
    );
    expect(schemas.TransactionResponse.required).toEqual(
      expect.arrayContaining(['success', 'data', 'request_id']),
    );
    expect(schemas.TransferResponse.required).toEqual(
      expect.arrayContaining(['success', 'data', 'request_id']),
    );
    expect(schemas.CreateTransaction.properties.amount.pattern).toBe(
      schemas.CreateTransfer.properties.amount.pattern,
    );
    expect(schemas.CreateTransaction.properties.amount.pattern).toContain('\\d{1,2}');
    const amountPattern = new RegExp(schemas.CreateTransaction.properties.amount.pattern);
    for (const amount of ['0.01', '0.10', '1', '1.00']) {
      expect(amountPattern.test(amount)).toBe(true);
    }
    for (const amount of ['0', '0.00', '0.001', '01.00', '1.000']) {
      expect(amountPattern.test(amount)).toBe(false);
    }
    expect(schemas.CreateTransaction.additionalProperties).toBe(false);
    expect(schemas.CreateTransfer.additionalProperties).toBe(false);
  });
});
