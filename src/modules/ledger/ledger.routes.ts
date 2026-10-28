import { Router } from 'express';

import { asyncHandler } from '../../common/middleware/errors';
import { validate } from '../../common/middleware/validate';
import { postLedgerTransaction } from './ledger.controller';
import { createLedgerSchema } from './ledger.schema';

export const ledgerRouter = Router();
ledgerRouter.post('/', validate(createLedgerSchema, 'body'), asyncHandler(postLedgerTransaction));
