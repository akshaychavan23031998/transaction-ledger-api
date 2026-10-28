const accountIdPattern = '^[a-zA-Z0-9_-]{1,64}$';
const positiveAmountPattern = '^(?:0\\.(?:0?[1-9]|[1-9]\\d)|[1-9]\\d*(?:\\.\\d{1,2})?)$';

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Transaction Ledger API',
    version: '1.0.0',
    description: 'An atomic, idempotent account and immutable transaction ledger API.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  tags: [
    { name: 'Health', description: 'Process and database health' },
    { name: 'Accounts', description: 'Account creation and balance/history queries' },
    { name: 'Transactions', description: 'Atomic credit and debit operations' },
    { name: 'Transfers', description: 'Atomic account-to-account transfers' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check service health',
        responses: {
          '200': {
            description: 'The process is running and reports database state.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } },
            },
          },
        },
      },
    },
    '/api/v1/accounts': {
      post: {
        tags: ['Accounts'],
        summary: 'Create an account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateAccount' },
              example: { account_holder_name: 'Ada Lovelace' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AccountResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '500': { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/v1/accounts/{accountId}/balance': {
      get: {
        tags: ['Accounts'],
        summary: 'Read an account balance',
        parameters: [{ $ref: '#/components/parameters/AccountId' }],
        responses: {
          '200': {
            description: 'Current balance',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/BalanceResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/AccountNotFound' },
          '500': { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/v1/accounts/{accountId}/transactions': {
      get: {
        tags: ['Accounts'],
        summary: 'List account transaction history',
        parameters: [
          { $ref: '#/components/parameters/AccountId' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['credit', 'debit'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated history',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/HistoryResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/AccountNotFound' },
          '500': { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/v1/transactions': {
      post: {
        tags: ['Transactions'],
        summary: 'Apply one atomic credit or debit',
        description:
          'reference_id is the idempotency key within an account. An identical retry returns the original ledger result without applying funds twice.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTransaction' },
              example: {
                account_id: 'acc_example',
                type: 'credit',
                amount: '100.00',
                description: 'Initial deposit',
                reference_id: 'deposit-001',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Transaction applied',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/TransactionResponse' } },
            },
          },
          '200': {
            description: 'Identical idempotent replay',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/TransactionResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/AccountNotFound' },
          '409': { $ref: '#/components/responses/ConflictError' },
          '500': { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/v1/transfers': {
      post: {
        tags: ['Transfers'],
        summary: 'Transfer money atomically between two accounts',
        description:
          'The source debit, destination credit, transfer record, and both ledger entries commit together. reference_id is globally idempotent for transfers.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTransfer' },
              example: {
                from_account_id: 'acc_source',
                to_account_id: 'acc_destination',
                amount: '25.50',
                description: 'Payment',
                reference_id: 'transfer-001',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Transfer committed',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/TransferResponse' } },
            },
          },
          '200': {
            description: 'Identical idempotent replay',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/TransferResponse' } },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/AccountNotFound' },
          '409': { $ref: '#/components/responses/ConflictError' },
          '500': { $ref: '#/components/responses/ServerError' },
        },
      },
    },
  },
  components: {
    parameters: {
      AccountId: {
        name: 'accountId',
        in: 'path',
        required: true,
        schema: { type: 'string', pattern: accountIdPattern },
      },
    },
    responses: {
      ValidationError: {
        description: 'Request validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      AccountNotFound: {
        description: 'Account was not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      ServerError: {
        description: 'Unexpected server or database failure',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      ConflictError: {
        description: 'Insufficient funds or idempotency conflict',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
    schemas: {
      CreateAccount: {
        type: 'object',
        additionalProperties: false,
        required: ['account_holder_name'],
        properties: { account_holder_name: { type: 'string', minLength: 1, maxLength: 120 } },
      },
      CreateTransaction: {
        type: 'object',
        additionalProperties: false,
        required: ['account_id', 'type', 'amount', 'description', 'reference_id'],
        properties: {
          account_id: { type: 'string', pattern: accountIdPattern },
          type: { type: 'string', enum: ['credit', 'debit'] },
          amount: {
            type: 'string',
            pattern: positiveAmountPattern,
            example: '10.50',
            description:
              'Positive decimal string, maximum two decimals, maximum 9,999,999,999,999 minor units.',
          },
          description: { type: 'string', minLength: 1, maxLength: 500 },
          reference_id: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Idempotency key scoped to the account.',
          },
        },
      },
      CreateTransfer: {
        type: 'object',
        additionalProperties: false,
        required: ['from_account_id', 'to_account_id', 'amount', 'description', 'reference_id'],
        properties: {
          from_account_id: { type: 'string', pattern: accountIdPattern },
          to_account_id: { type: 'string', pattern: accountIdPattern },
          amount: {
            type: 'string',
            pattern: positiveAmountPattern,
            description:
              'Positive decimal string, maximum two decimals, maximum 9,999,999,999,999 minor units.',
          },
          description: { type: 'string', minLength: 1, maxLength: 500 },
          reference_id: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Globally idempotent transfer key.',
          },
        },
      },
      AccountResponse: {
        type: 'object',
        required: ['success', 'data', 'request_id'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            required: ['account_id', 'account_holder_name', 'balance', 'currency', 'created_at'],
            properties: {
              account_id: { type: 'string' },
              account_holder_name: { type: 'string' },
              balance: { type: 'string', example: '0.00' },
              currency: { type: 'string', example: 'USD' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          request_id: { type: 'string' },
        },
      },
      HealthResponse: {
        type: 'object',
        required: ['status', 'database', 'request_id'],
        properties: {
          status: { type: 'string', example: 'ok' },
          database: { type: 'string', enum: ['connected', 'disconnected'] },
          request_id: { type: 'string' },
        },
      },
      BalanceResponse: {
        type: 'object',
        required: ['success', 'data', 'request_id'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            required: ['account_id', 'balance', 'currency'],
            properties: {
              account_id: { type: 'string' },
              balance: { type: 'string', example: '100.00' },
              currency: { type: 'string', example: 'USD' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          request_id: { type: 'string' },
        },
      },
      TransactionResponse: {
        type: 'object',
        required: ['success', 'data', 'request_id'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            required: ['transaction_id', 'account_id', 'type', 'amount', 'balance', 'reference_id'],
            properties: {
              transaction_id: { type: 'string' },
              account_id: { type: 'string' },
              type: { type: 'string', enum: ['credit', 'debit'] },
              amount: { type: 'string', example: '10.50' },
              balance: { type: 'string', example: '110.50' },
              description: { type: 'string' },
              reference_id: { type: 'string' },
              idempotent_replay: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          request_id: { type: 'string' },
        },
      },
      HistoryResponse: {
        type: 'object',
        required: ['success', 'data', 'request_id'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            required: ['account_id', 'data', 'pagination'],
            properties: {
              account_id: { type: 'string' },
              data: { type: 'array', items: { $ref: '#/components/schemas/HistoryItem' } },
              pagination: { $ref: '#/components/schemas/Pagination' },
            },
          },
          request_id: { type: 'string' },
        },
      },
      HistoryItem: {
        type: 'object',
        properties: {
          transaction_id: { type: 'string' },
          type: { type: 'string', enum: ['credit', 'debit'] },
          amount: { type: 'string' },
          balance: { type: 'string' },
          description: { type: 'string' },
          reference_id: { type: 'string' },
          transfer_id: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total_records: { type: 'integer' },
          total_pages: { type: 'integer' },
        },
      },
      TransferResponse: {
        type: 'object',
        required: ['success', 'data', 'request_id'],
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            required: [
              'transfer_id',
              'from_account_id',
              'to_account_id',
              'amount',
              'reference_id',
              'description',
              'ledger_transaction_ids',
              'balances',
              'idempotent_replay',
              'created_at',
            ],
            properties: {
              transfer_id: { type: 'string' },
              from_account_id: { type: 'string' },
              to_account_id: { type: 'string' },
              amount: { type: 'string' },
              reference_id: { type: 'string' },
              description: { type: 'string' },
              ledger_transaction_ids: { type: 'array', items: { type: 'string' } },
              balances: { type: 'object', additionalProperties: { type: 'string' } },
              idempotent_replay: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          request_id: { type: 'string' },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error', 'request_id'],
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
          request_id: { type: 'string' },
        },
      },
    },
  },
} as const;
