import type { ErrorRequestHandler, RequestHandler } from 'express';

import { logger } from '../logger/logger';
import { AppError } from '../errors/AppError';

export const asyncHandler =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  void _next;
  const isDuplicate =
    typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
  const appError =
    error instanceof AppError
      ? error
      : isDuplicate
        ? new AppError(409, 'DUPLICATE_REFERENCE', 'Reference ID has already been used')
        : new AppError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');

  logger.error(
    {
      requestId: req.requestId,
      errorCode: appError.code,
      error: error instanceof Error ? error.message : String(error),
    },
    'request_failed',
  );

  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
    request_id: req.requestId,
  });
};
