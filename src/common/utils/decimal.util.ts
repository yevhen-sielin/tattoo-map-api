import { Prisma } from '@prisma/client';

/**
 * Convert a Prisma.Decimal (or any Decimal-like object with `.toNumber()`)
 * to a plain `number | null`. Safe for JSON serialisation.
 */
export function decimalToNumber(
  v: { toNumber(): number } | null | undefined,
): number | null {
  if (v == null) return null;
  return typeof v.toNumber === 'function' ? v.toNumber() : Number(v);
}

/**
 * Convert a plain number to a Prisma.Decimal with 6 decimal places,
 * matching a `Decimal(9,6)` column. Returns null when the input is nullish.
 */
export function numberToDecimal6(
  n: number | null | undefined,
): Prisma.Decimal | null {
  return n == null ? null : new Prisma.Decimal(Number(n).toFixed(6));
}
