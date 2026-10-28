import { Router } from 'express';

import { asyncHandler } from '../../common/middleware/errors';
import { validate } from '../../common/middleware/validate';
import { postTransfer } from './transfer.controller';
import { createTransferSchema } from './transfer.schema';

export const transferRouter = Router();
transferRouter.post('/', validate(createTransferSchema, 'body'), asyncHandler(postTransfer));
