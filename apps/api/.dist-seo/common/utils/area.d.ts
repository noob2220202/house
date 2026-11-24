import { pyeongToSqm, SQM_PER_PYEONG, sqmToPyeong } from '@house/shared';
import type { Prisma } from '@prisma/client';
export { pyeongToSqm, SQM_PER_PYEONG, sqmToPyeong };
/** Decimal ㎡ column → 평 (1 decimal), null-safe. */
export declare function decimalSqmToPyeong(sqm: Prisma.Decimal | number | null | undefined): number | null;
/** Label used for 평형 groups, e.g. 84.97㎡ → "25평". */
export declare function pyeongLabel(sqm: number): string;
