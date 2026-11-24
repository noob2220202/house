import { pyeongToSqm, sqmToPyeong } from '@/lib/format/area';

/** 평 ↔ ㎡ 환산 (1평 = 3.305785㎡). */
export type AreaInputUnit = 'sqm' | 'pyeong';

export interface AreaConversion {
  sqm: number;
  pyeong: number;
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** Converts a value in either unit to both, rounded to two decimals. Null for invalid input. */
export function convertArea(value: number, from: AreaInputUnit): AreaConversion | null {
  if (!Number.isFinite(value) || value < 0) return null;
  return from === 'sqm'
    ? { sqm: round2(value), pyeong: sqmToPyeong(value, 2) }
    : { sqm: pyeongToSqm(value, 2), pyeong: round2(value) };
}

/** 아파트에서 자주 쓰는 전용면적 (㎡) — 빠른 선택 칩과 환산표에 쓴다. */
export const COMMON_EXCLUSIVE_SQM = [39, 49, 59, 74, 84, 101, 114, 135] as const;

/** Reference rows for the conversion table. */
export function areaReferenceRows(
  sqms: readonly number[] = COMMON_EXCLUSIVE_SQM,
): AreaConversion[] {
  return sqms.map((sqm) => ({ sqm, pyeong: sqmToPyeong(sqm, 1) }));
}
