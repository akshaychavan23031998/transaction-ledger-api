import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (req, res, next) => {
  const supplied = req.header('x-request-id');
  const id = supplied && /^[a-zA-Z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
