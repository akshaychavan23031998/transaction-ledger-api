import { Router } from 'express';

import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/errors';
import { accountBalance, accountHistory, postAccount } from './account.controller';
import { accountIdParamsSchema, createAccountSchema } from './account.schema';
import { historyQuerySchema } from '../ledger/ledger.schema';

export const accountRouter = Router();
accountRouter.post('/', validate(createAccountSchema, 'body'), asyncHandler(postAccount));
accountRouter.get(
  '/:accountId/balance',
  validate(accountIdParamsSchema, 'params'),
  asyncHandler(accountBalance),
);
accountRouter.get(
  '/:accountId/transactions',
  validate(accountIdParamsSchema, 'params'),
  validate(historyQuerySchema, 'query'),
  asyncHandler(accountHistory),
);
