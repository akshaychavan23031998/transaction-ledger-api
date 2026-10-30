import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { connectDatabase, initializeDatabase, isDatabaseConnected } from './config/database';
import { openApiDocument } from './docs/openapi';
import { asyncHandler, errorHandler, notFoundHandler } from './common/middleware/errors';
import { requestId } from './common/middleware/requestId';
import { requestLogger } from './common/middleware/requestLogger';
import { accountRouter } from './modules/accounts/account.routes';
import { ledgerRouter } from './modules/ledger/ledger.routes';
import { transferRouter } from './modules/transfers/transfer.routes';

export const app = express();

let databaseInitialization: Promise<void> | undefined;

async function ensureDatabaseReady(): Promise<void> {
  if (isDatabaseConnected()) {
    return;
  }

  databaseInitialization ??= (async () => {
    await connectDatabase();
    await initializeDatabase();
  })();

  try {
    await databaseInitialization;
  } catch (error) {
    databaseInitialization = undefined;
    throw error;
  }
}

const databaseMiddleware = asyncHandler(async (_req, _res, next) => {
  await ensureDatabaseReady();
  next();
});

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb', strict: true }));
app.use(requestId);
app.use(requestLogger);

app.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await ensureDatabaseReady();
    res.json({
      status: 'ok',
      database: isDatabaseConnected() ? 'connected' : 'disconnected',
      request_id: _req.requestId,
    });
  }),
);

app.use('/api/v1', databaseMiddleware);

app.use('/api/v1/accounts', accountRouter);
app.use('/api/v1/transactions', ledgerRouter);
app.use('/api/v1/transfers', transferRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get('/api-docs.json', (_req, res) => res.json(openApiDocument));

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
