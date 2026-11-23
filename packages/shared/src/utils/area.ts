import { SQM_PER_PYEONG } from '../constants/units';

/** ㎡ → 평, rounded to `digits` decimals (default 1). */
export function sqmToPyeong(sqm: number, digits = 1): number {
  return round(sqm / SQM_PER_PYEONG, digits);
}

/** 평 → ㎡, rounded to `digits` decimals (default 2). */
export function pyeongToSqm(pyeong: number, digits = 2): number {
  return round(pyeong * SQM_PER_PYEONG, digits);
}

/** "84.97㎡ (25.7평)" */
export function formatArea(sqm: number): string {
  return `${round(sqm, 2)}㎡ (${sqmToPyeong(sqm)}평)`;
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
