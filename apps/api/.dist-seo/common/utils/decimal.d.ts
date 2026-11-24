import { Prisma } from '@prisma/client';
/** Prisma Decimal → number for API responses (areas/ratios; never for money, which is Int 만원). */
export declare function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined): number | null;
