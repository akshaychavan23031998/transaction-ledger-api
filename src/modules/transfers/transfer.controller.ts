import type { RequestHandler } from 'express';

import { createTransfer } from './transfer.service';

export const postTransfer: RequestHandler = async (req, res) => {
  const result = await createTransfer(req.body);
  res.status(result.status === 'created' ? 201 : 200).json({
    success: true,
    data: result.data,
    request_id: req.requestId,
  });
};
