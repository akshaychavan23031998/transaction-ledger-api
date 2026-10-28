import { formatMinorUnits, parseAmountToMinor } from '../../src/common/utils/money';

describe('money conversion', () => {
  it.each([
    ['100.00', 10_000],
    ['25.5', 2_550],
    ['0.01', 1],
  ])('converts %s to %s minor units', (amount, expected) => {
    expect(parseAmountToMinor(amount)).toBe(expected);
  });

  it.each(['0', '-1.00', '1.001', '1e2', 'NaN', 'Infinity', '01.00', ''])(
    'rejects invalid amount %s',
    (amount) => {
      expect(() => parseAmountToMinor(amount)).toThrow('Amount');
    },
  );

  it('formats minor units without floating-point arithmetic', () => {
    expect(formatMinorUnits(2550)).toBe('25.50');
    expect(formatMinorUnits(1)).toBe('0.01');
  });
});
