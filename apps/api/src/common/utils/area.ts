import { pyeongToSqm, SQM_PER_PYEONG, sqmToPyeong } from '@house/shared';
import type { Prisma } from '@prisma/client';
import { decimalToNumber } from './decimal';

export { pyeongToSqm, SQM_PER_PYEONG, sqmToPyeong };

/** Decimal ㎡ column → 평 (1 decimal), null-safe. */
export function decimalSqmToPyeong(sqm: Prisma.Decimal | number | null | undefined): number | null {
  const n = decimalToNumber(sqm);
  return n === null ? null : sqmToPyeong(n);
}

/** Label used for 평형 groups, e.g. 84.97㎡ → "25평". */
export function pyeongLabel(sqm: number): string {
  return `${Math.round(sqm / SQM_PER_PYEONG)}평`;
}
