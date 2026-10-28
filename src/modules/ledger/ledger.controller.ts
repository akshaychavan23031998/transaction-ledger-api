import type { RequestHandler } from 'express';

import { createLedgerTransaction } from './ledger.service';

export const postLedgerTransaction: RequestHandler = async (req, res) => {
  const result = await createLedgerTransaction(req.body);
  res.status(result.status === 'created' ? 201 : 200).json({
    success: true,
    data: result.data,
    request_id: req.requestId,
  });
};
