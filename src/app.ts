import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { isDatabaseConnected } from './config/database';
import { openApiDocument } from './docs/openapi';
import { errorHandler, notFoundHandler } from './common/middleware/errors';
import { requestId } from './common/middleware/requestId';
import { requestLogger } from './common/middleware/requestLogger';
import { accountRouter } from './modules/accounts/account.routes';
import { ledgerRouter } from './modules/ledger/ledger.routes';
import { transferRouter } from './modules/transfers/transfer.routes';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb', strict: true }));
app.use(requestId);
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: isDatabaseConnected() ? 'connected' : 'disconnected',
    request_id: _req.requestId,
  });
});

app.use('/api/v1/accounts', accountRouter);
app.use('/api/v1/transactions', ledgerRouter);
app.use('/api/v1/transfers', transferRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get('/api-docs.json', (_req, res) => res.json(openApiDocument));

app.use(notFoundHandler);
app.use(errorHandler);
