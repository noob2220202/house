import { SQM_PER_PYEONG, pyeongToSqm, sqmToPyeong } from '@house/shared';

export { SQM_PER_PYEONG, pyeongToSqm, sqmToPyeong };

export type AreaUnit = 'pyeong' | 'sqm';

/** ㎡ → whole 평 label used across lists: 112.4 → "34평". */
export function formatPyeong(sqm: number, digits = 0): string {
  return `${sqmToPyeong(sqm, digits).toLocaleString('ko-KR')}평`;
}

/** 84.98 → "84.98㎡" (trailing zeros trimmed, max 2 decimals). */
export function formatSqm(sqm: number): string {
  return `${(Math.round(sqm * 100) / 100).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡`;
}

/** Area in the unit chosen by the 평/㎡ toggle. */
export function formatArea(sqm: number, unit: AreaUnit): string {
  return unit === 'pyeong' ? formatPyeong(sqm) : formatSqm(sqm);
}

/**
 * Compact label for cards and map markers, always in the legal unit (계량법: ㎡) with 평 alongside:
 * "85㎡(26평)". With the 평 toggle the visitor chose, 평 leads: "26평(85㎡)".
 */
export function formatAreaPair(sqm: number, unit: AreaUnit = 'sqm'): string {
  const m = `${Math.round(sqm).toLocaleString('ko-KR')}㎡`;
  const p = `${Math.round(sqmToPyeong(sqm, 2)).toLocaleString('ko-KR')}평`;
  return unit === 'pyeong' ? `${p}(${m})` : `${m}(${p})`;
}

/** Both units: "84.98㎡ (25.7평)". */
export function formatAreaBoth(sqm: number): string {
  return `${formatSqm(sqm)} (${sqmToPyeong(sqm, 1)}평)`;
}

/** 공급/전용 pair for detail pages: "공급 112.4㎡ · 전용 84.98㎡". */
export function formatSupplyExclusive(
  supplySqm: number | null | undefined,
  exclusiveSqm: number | null | undefined,
  unit: AreaUnit = 'sqm',
): string {
  const parts: string[] = [];
  if (supplySqm) parts.push(`공급 ${formatArea(supplySqm, unit)}`);
  if (exclusiveSqm) parts.push(`전용 ${formatArea(exclusiveSqm, unit)}`);
  return parts.join(' · ');
}

/** Filter chip label for an area range given in ㎡: "30평~40평", "30평 이상", "전체". */
export function formatAreaFilter(
  minSqm: number | null | undefined,
  maxSqm: number | null | undefined,
  unit: AreaUnit = 'pyeong',
): string {
  const f = (v: number) => formatArea(v, unit);
  const hasMin = minSqm !== null && minSqm !== undefined && minSqm > 0;
  const hasMax = maxSqm !== null && maxSqm !== undefined;
  if (hasMin && hasMax) return `${f(minSqm)}~${f(maxSqm)}`;
  if (hasMin) return `${f(minSqm)} 이상`;
  if (hasMax) return `${f(maxSqm)} 이하`;
  return '전체';
}
