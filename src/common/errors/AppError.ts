export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'ACCOUNT_NOT_FOUND'
  | 'INVALID_AMOUNT'
  | 'INSUFFICIENT_FUNDS'
  | 'DUPLICATE_REFERENCE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'TRANSFER_NOT_ALLOWED'
  | 'DATABASE_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational = true;

  public constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const accountNotFound = () =>
  new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account was not found');

export const idempotencyConflict = () =>
  new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Reference ID was already used with different data');
