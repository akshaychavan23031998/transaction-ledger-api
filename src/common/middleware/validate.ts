import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '../errors/AppError';

export function validate(schema: ZodType, source: 'body' | 'params' | 'query'): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', result.error.flatten()),
      );
      return;
    }
    res.locals.validated ??= {};
    res.locals.validated[source] = result.data;
    if (source !== 'query') {
      req[source] = result.data;
    }
    next();
  };
}
