import type { RequestHandler } from 'express';

import { logger } from '../logger/logger';

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        route: req.route?.path ?? req.path,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      },
      'http_request',
    );
  });
  next();
};
