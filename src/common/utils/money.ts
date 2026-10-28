import { AppError } from '../errors/AppError';

export const MAX_AMOUNT_MINOR = 9_999_999_999_999;
export const MAX_BALANCE_MINOR = 9_999_999_999_999;

const amountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export function parseAmountToMinor(value: string): number {
  if (typeof value !== 'string' || !amountPattern.test(value)) {
    throw new AppError(
      400,
      'INVALID_AMOUNT',
      'Amount must be a positive decimal string with up to two decimals',
    );
  }

  const [whole = '0', fraction = ''] = value.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');

  if (minor <= 0n || minor > BigInt(MAX_AMOUNT_MINOR)) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount is outside the supported range');
  }

  return Number(minor);
}

export function formatMinorUnits(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_BALANCE_MINOR) {
    throw new Error('Invalid persisted minor-unit value');
  }

  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}
