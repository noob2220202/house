import { Prisma } from '@prisma/client';

/** Prisma Decimal → number for API responses (areas/ratios; never for money, which is Int 만원). */
export function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  return new Prisma.Decimal(value).toNumber();
}
